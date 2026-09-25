import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { User } from '../models/User';
import { z } from 'zod';
import { ClassModel, ClassScheduleModel } from '../models/Class';
import { EnrollmentModel } from '../models/Enrollment';
import { AssignmentSubmissionModel } from '../models/AssignmentSubmission';
import { ReviewModel } from '../models/Review';
import { AttendanceRecordModel } from '../models/AttendanceRecord';
import { requireAuth, requireRole, requireApprovedInstructor, AuthRequest } from '../middleware/auth';
import { createZoomMeeting, deleteZoomMeeting, updateZoomMeeting, generateZoomMeetingSDKSignature, getZoomMeetingStartUrl, getZoomAccessToken } from '../utils/zoom';
import { evaluateJoinWindow, sessionsOverlap } from '../config/liveClassPolicy';
import { notifyClassSessionStarted, notifyLearnersClassUpdate, notifyLearnersSessionChange } from '../utils/notify';
import { NotificationModel } from '../models/Notification';
import { uploadClassFile } from '../utils/cloudinary';
import { buildTeachingInviteEmail, sendEmailSafe } from '../utils/email';
import { rateLimit } from '../middleware/rateLimit';
import { ENV } from '../config/env';
import { getMaxClassSeats } from '../models/PlatformSettings';
import { CourseModel } from '../models/Course';
import { logActivity } from '../models/ActivityLog';
import { PaymentModel } from '../models/Payment';
import { isCertifiedFor } from '../utils/certification';
import { teachesClass } from '../utils/team';
import { sessionForViewer } from '../utils/sessionView';
import { formatWhen, isValidTimeZone, pickTimeZone } from '../utils/time';
import { rehostClassMeetings, resolveInstructorZoomHost } from '../utils/zoomHosts';
import {
  buildAttendanceMatrix,
  confirmAttendance,
  LATE_AFTER_START_MS,
  markAttendance,
  markAttendanceSchema,
} from '../utils/attendance';
import { freeClassBlocked, priceRangeError } from '../utils/pricing';
import { closeWaitlist, notEndedFilter, refundPayment } from '../utils/seats';

const router = Router();

/** Ensure every curriculum module has a stable id for linking live sessions. */
function ensureCurriculumIds<T extends { curriculum?: { id?: string; title: string; topics: string[]; project: string }[] }>(
  details: T | undefined
): T | undefined {
  if (!details?.curriculum?.length) return details;
  return {
    ...details,
    curriculum: details.curriculum.map((m) => ({
      ...m,
      id: m.id && m.id.trim() ? m.id.trim() : randomUUID(),
    })),
  };
}

/** Course materials/assignment/preview video uploads: common office/doc/media types, capped at 80MB. */
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/quicktime',
]);

const classFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 80 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_UPLOAD_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error('Unsupported file type'));
    }
    cb(null, true);
  },
});
router.use((req: AuthRequest, res, next) => {
  if (req.headers.authorization) return requireAuth(req, res, next);
  next();
});

/** Ensure API responses use `id` (frontend expects it); Mongoose returns `_id`. */
function normalizeClass(doc: any): any {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  const id = obj._id?.toString?.() ?? obj.id;
  const { _id, ...rest } = obj;
  if (Array.isArray(rest.assignments)) {
    rest.assignments = rest.assignments.map(normalizeAssignment);
  }
  if (Array.isArray(rest.teachingTeam)) {
    rest.teachingTeam = rest.teachingTeam.map((m: any) => ({
      ...m,
      userId: String(m.userId),
    }));
  }
  if (rest.courseId) rest.courseId = String(rest.courseId);
  if (rest.languageOfferingId) rest.languageOfferingId = String(rest.languageOfferingId);
  return { ...rest, id: id || _id };
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Matches the class itself or the course it belongs to, so "spanish" finds every Spanish class. */
async function searchFilter(raw: string) {
  const rx = new RegExp(escapeRegex(raw.trim().slice(0, 100)), 'i');
  const courses = await CourseModel.find({ status: 'published', $or: [{ title: rx }, { category: rx }] }).select('_id').lean();
  return {
    $and: [
      {
        $or: [
          { title: rx },
          { category: rx },
          { language: rx },
          { 'instructor.name': rx },
          ...(courses.length ? [{ courseId: { $in: courses.map((c) => c._id) } }] : []),
        ],
      },
    ],
  };
}

/** Class view for anyone outside the class: no coursework, contact details or internal bookkeeping. */
function publicClass(doc: any): any {
  const data = normalizeClass(doc);
  if (!data) return null;
  const { assignments, remindersSent, ...rest } = data;
  rest.assignmentCount = Array.isArray(assignments) ? assignments.length : 0;
  if (rest.instructor) {
    const { email: _e, ...instructor } = rest.instructor;
    rest.instructor = instructor;
  }
  if (Array.isArray(rest.teachingTeam)) {
    rest.teachingTeam = rest.teachingTeam
      .filter((m: any) => m.status === 'accepted')
      .map(({ email: _e, invitedBy: _i, ...m }: any) => m);
  }
  return rest;
}

async function canSeeFullClass(cls: any, user?: { id: string; role: string }) {
  if (!user) return false;
  if (user.role === 'admin' || teachesClass(cls, user.id)) return true;
  const pending = (cls.teachingTeam || []).some((m: any) => String(m.userId) === user.id && m.status === 'pending');
  if (pending) return true;
  return !!(await EnrollmentModel.exists({ classId: cls._id, userId: user.id, status: { $in: ['active', 'completed'] } }));
}

/**
 * Assignments are subdocuments embedded on the class (no separate collection),
 * but each still gets its own Mongoose-generated `_id` - exposed as `id` here so
 * the frontend has a stable handle to submit against and instructors can delete
 * a single entry.
 */
function normalizeAssignment(assignment: any): any {
  const { _id, ...rest } = assignment;
  return { ...rest, id: _id?.toString?.() ?? rest.id };
}

function normalizeSubmission(doc: any): any {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  const { _id, __v, ...rest } = obj;
  return { ...rest, id: _id?.toString?.() ?? rest.id };
}

/** Strips host/internal-only fields from a schedule doc before it goes in any ordinary API response. */
function stripHostFields<T extends Record<string, any>>(session: T): Omit<T, 'zoomStartUrl' | 'zoomHostUserId' | 'meetingCreationStatus'> {
  const { zoomStartUrl, zoomHostUserId, meetingCreationStatus, ...rest } = session;
  return rest;
}

/**
 * Rejects overlapping sessions for the same Nexnoon instructor or the same Zoom
 * host user - one Zoom host cannot reliably run two simultaneous meetings, and an
 * instructor cannot be in two places at once. Cancelled sessions and the session
 * being updated (when `excludeSessionId` is given) are excluded.
 *
 * "shared:me" (the documented fallback for instructors without an explicit Zoom
 * user mapping) is treated exactly like any other host value here, not
 * special-cased out of the check: the platform must never assume the shared
 * Server-to-Server OAuth account can run two concurrent meetings, so two
 * "shared:me" sessions that overlap are rejected the same as any other same-host
 * conflict. Different instructors with different *explicit* Zoom host mappings
 * are unaffected and may still run truly simultaneous meetings.
 */
async function findSchedulingConflict(params: {
  instructorId: string;
  zoomHostUserId: string;
  startTime: Date;
  endTime: Date;
  excludeSessionId?: string;
}): Promise<{ reason: 'instructor' | 'zoom_host' } | null> {
  const { instructorId, zoomHostUserId, startTime, endTime, excludeSessionId } = params;

  const candidateClassIds = await ClassModel.find({ 'instructor.id': instructorId }).distinct('_id');
  const baseQuery: any = {
    // Completed/cancelled slots do not block a new booking.
    status: { $nin: ['cancelled', 'completed'] },
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  };
  if (excludeSessionId && isValidObjectId(excludeSessionId)) {
    baseQuery._id = { $ne: excludeSessionId };
  }

  const [instructorConflict, hostConflict] = await Promise.all([
    ClassScheduleModel.findOne({ ...baseQuery, classId: { $in: candidateClassIds } }).select('_id'),
    ClassScheduleModel.findOne({ ...baseQuery, zoomHostUserId }).select('_id'),
  ]);

  if (instructorConflict) return { reason: 'instructor' };
  if (hostConflict) return { reason: 'zoom_host' };
  return null;
}

/**
 * Enforce instructor session lifecycle rules:
 * - complete only after start time has been reached (from scheduled/live)
 * - cancel only while scheduled
 * - completed cannot be cancelled; reopen only by moving to a future schedule
 * - `live` is the in-progress state (Zoom start / host)
 */
function validateSessionStatusChange(params: {
  from: string;
  to: string;
  startTime: Date;
  now?: Date;
}): string | null {
  const now = params.now ?? new Date();
  const { from, to, startTime } = params;
  if (from === to) return null;

  if (from === 'completed' && to === 'cancelled') {
    return 'Completed sessions cannot be cancelled. Reschedule to a future date and time instead.';
  }

  if (to === 'cancelled' && from !== 'scheduled') {
    return 'Only scheduled sessions can be cancelled.';
  }

  if (to === 'completed') {
    if (from !== 'scheduled' && from !== 'live') {
      return 'Only scheduled or in-progress sessions can be marked complete.';
    }
    if (now.getTime() < new Date(startTime).getTime()) {
      return 'Cannot mark complete before the session start date and time.';
    }
  }

  if (to === 'scheduled' && (from === 'completed' || from === 'cancelled')) {
    if (new Date(startTime).getTime() <= now.getTime()) {
      return 'To reschedule a completed or cancelled session, set a future date and time.';
    }
  }

  if (to === 'live' && from !== 'scheduled' && from !== 'live') {
    return 'Only a scheduled session can move to in progress.';
  }

  return null;
}


const listParamsSchema = z.object({
  page: z.coerce.number().min(1).optional(),
  pageSize: z.coerce.number().min(1).max(100).optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
  search: z.string().optional(),
  filters: z.any().optional(),
});


const createClassSchema = z.object({
  details: z.object({
    overview: z.string().max(30000).optional(), instructorTitle: z.string().max(200).optional(),
    instructorBio: z.string().max(10000).optional(), instructorImage: z.string().max(4000000).optional(),
    previewVideoUrl: z.union([z.literal(''), z.string().url().startsWith('https://')]).optional(),
    curriculumIntro: z.string().max(2000).optional(), certificateInfo: z.string().max(5000).optional(),
    outcomes: z.array(z.string().max(2000)).max(100).optional(),
    curriculum: z.array(z.object({
      id: z.string().max(64).optional(),
      title: z.string().max(500),
      topics: z.array(z.string().max(2000)).max(100),
      project: z.string().max(5000),
    })).max(100).optional(),
    faqs: z.array(z.object({ question: z.string().max(1000), answer: z.string().max(5000) })).max(100).optional(),
  }).optional(),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  level: z.enum(['Beginner', 'Intermediate', 'Advanced']),
  price: z.number().min(0),
  thumbnail: z.string().max(4000000).optional(),
  language: z.string().optional(),
  courseId: z.string().optional(),
  languageOfferingId: z.string().optional(),
  maxStudents: z.number().int().positive().optional(),
  learningOutcomes: z.array(z.string()).optional(),
  prerequisites: z.array(z.string()).optional(),
  materials: z.array(z.string()).optional(),
  assignments: z
    .array(
      z.object({
        title: z.string().min(1).max(300),
        description: z.string().max(5000).optional(),
        dueDate: z.string().datetime().optional(),
        attachmentUrl: z.string().max(2000).optional(),
      })
    )
    .optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  duration: z.number(),
  totalSessions: z.number(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  timezone: z.string().max(80).refine(isValidTimeZone, 'Unknown timezone').optional(),
  /** Admin only: the approved, course-certified instructor who will lead the class. */
  leadInstructorId: z.string().optional(),
  schedule: z
    .array(
      z.object({
        sessionNumber: z.number(),
        title: z.string(),
        description: z.string().optional(),
        startTime: z.string().datetime(),
        endTime: z.string().datetime(),
      })
    )
    .optional(),
});

router.get('/', async (req, res) => {
  const parsed = listParamsSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Invalid query params' });
  }
  const { page = 1, pageSize = 10, search } = parsed.data;

  const query: any = { status: 'published', ...(await notEndedFilter()) };
  if (search) Object.assign(query, await searchFilter(search));

  const [items, totalItems] = await Promise.all([
    ClassModel.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    ClassModel.countDocuments(query),
  ]);

  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  return res.json({
    success: true,
    data: {
      data: items.map(publicClass),
      pagination: {
        page,
        pageSize,
        totalPages,
        totalItems,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    },
  });
});

router.get('/search', async (req, res) => {
  const q = (req.query.q as string) || '';
  const parsed = listParamsSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Invalid query params' });
  }
  const { page = 1, pageSize = 10 } = parsed.data;

  const query: any = { status: 'published', ...(await notEndedFilter()) };
  if (q.trim()) Object.assign(query, await searchFilter(q));

  const [items, totalItems] = await Promise.all([
    ClassModel.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    ClassModel.countDocuments(query),
  ]);

  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  return res.json({
    success: true,
    data: {
      data: items.map(publicClass),
      pagination: {
        page,
        pageSize,
        totalPages,
        totalItems,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    },
  });
});

router.get('/category/:category', async (req, res) => {
  const parsed = listParamsSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Invalid query params' });
  }
  const { page = 1, pageSize = 10 } = parsed.data;

  const categoryNames: Record<string, string[]> = { 'health-wellness': ['Health & Wellness', 'Health & Fitness'], languages: ['Languages', 'Language', 'Language Learning'] };
  const names = categoryNames[req.params.category.toLowerCase()] || [req.params.category.replace(/-/g, ' ')];
  const query: any = { status: 'published', ...(await notEndedFilter()), category: { $in: names.map(name => new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i')) } };

  const [items, totalItems] = await Promise.all([
    ClassModel.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    ClassModel.countDocuments(query),
  ]);

  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  return res.json({
    success: true,
    data: {
      data: items.map(publicClass),
      pagination: {
        page,
        pageSize,
        totalPages,
        totalItems,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    },
  });
});

router.get('/my', requireAuth, requireRole('instructor', 'admin'), async (req: AuthRequest, res) => {
  const parsed = listParamsSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Invalid query params' });
  }
  const { page = 1, pageSize = 10 } = parsed.data;
  const userId = req.user!.id;

  const query: any = {
    $or: [
      { 'instructor.id': userId },
      { teachingTeam: { $elemMatch: { userId, status: { $in: ['accepted', 'pending'] } } } },
    ],
  };

  const [items, totalItems] = await Promise.all([
    ClassModel.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    ClassModel.countDocuments(query),
  ]);

  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  return res.json({
    success: true,
    data: {
      data: items.map(normalizeClass),
      pagination: {
        page,
        pageSize,
        totalPages,
        totalItems,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    },
  });
});

/** Normalize a schedule document for API (id from _id). */
function normalizeSchedule(doc: any): any {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  const id = obj._id?.toString?.() ?? obj.id;
  const { _id, ...rest } = obj;
  return { ...rest, id: id || _id };
}

router.get('/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid class id' });
  }
  const cls = await ClassModel.findById(req.params.id);
  if (!cls) {
    return res.status(404).json({ success: false, message: 'Class not found' });
  }
  const fullView = await canSeeFullClass(cls, req.user);
  if (cls.status !== 'published' && !fullView) return res.status(404).json({ success: false, message: 'Class not found' });

  // Backfill stable module ids so live sessions can link to curriculum.
  if (cls.details?.curriculum?.some((m) => !m.id)) {
    cls.details = ensureCurriculumIds(cls.details) as typeof cls.details;
    cls.markModified('details');
    await cls.save();
  }

  const sessions = await ClassScheduleModel.find({ classId: cls.id })
    .sort({ sessionNumber: 1 })
    .lean();

  // Soft-link legacy sessions whose title matches a module title.
  const curriculum = cls.details?.curriculum || [];
  for (const raw of sessions) {
    if (raw.moduleId) continue;
    const match = curriculum.find(
      (m) => m.id && m.title.trim().toLowerCase() === String(raw.title || '').trim().toLowerCase()
    );
    if (match?.id) {
      await ClassScheduleModel.updateOne({ _id: raw._id }, { $set: { moduleId: match.id } });
      (raw as any).moduleId = match.id;
    }
  }

  const schedule = sessions.map((s: any) => ({ ...sessionForViewer(normalizeSchedule(s), false), recordingUrl: undefined }));
  const course = cls.courseId
    ? await CourseModel.findOne({ _id: cls.courseId, status: 'published' }).select('title slug').lean()
    : null;
  const data = {
    ...(fullView ? normalizeClass(cls) : publicClass(cls)),
    schedule,
    course: course ? { title: course.title, slug: course.slug } : null,
  };

  // Attach live portfolio fields from User profiles (not per-class bio overrides).
  const teamIds = [
    String(cls.instructor.id),
    ...((cls.teachingTeam || []).map((m) => String(m.userId))),
  ];
  const uniqueIds = [...new Set(teamIds.filter(Boolean))];
  if (uniqueIds.length) {
    const profiles = await User.find({ _id: { $in: uniqueIds } })
      .select('fullName avatar headline bio languages expertise')
      .lean();
    const byId = new Map(profiles.map((u) => [String(u._id), u]));
    const lead = byId.get(String(cls.instructor.id));
    if (lead) {
      data.instructor = {
        ...data.instructor,
        name: lead.fullName || data.instructor?.name,
        avatar: lead.avatar || data.instructor?.avatar || '',
        headline: lead.headline || '',
        bio: lead.bio || '',
        languages: lead.languages || [],
        expertise: lead.expertise || [],
      };
    }
    if (Array.isArray(data.teachingTeam)) {
      data.teachingTeam = data.teachingTeam.map((m: any) => {
        const p = byId.get(String(m.userId));
        return p
          ? {
              ...m,
              name: p.fullName || m.name,
              avatar: p.avatar || '',
              headline: p.headline || '',
              bio: p.bio || '',
            }
          : m;
      });
    }
  }

  return res.json({ success: true, data });
});

router.post('/', requireAuth, requireRole('instructor', 'admin'), requireApprovedInstructor, rateLimit({ windowMs: 60_000, max: ENV.NODE_ENV === 'production' ? 10 : 60, keyPrefix: 'create-class' }), async (req: AuthRequest, res) => {
  const parsed = createClassSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }

  const { leadInstructorId, ...rest } = parsed.data;
  const data = {
    ...rest,
    details: ensureCurriculumIds(rest.details),
  };
  const assignedByAdmin = req.user!.role === 'admin' && !!leadInstructorId;
  if (leadInstructorId && req.user!.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Only admins can assign a lead instructor' });
  }
  if (assignedByAdmin && !isValidObjectId(leadInstructorId)) {
    return res.status(400).json({ success: false, message: 'Invalid lead instructor ID' });
  }
  const leadId = assignedByAdmin ? leadInstructorId! : req.user!.id;
  const instructor = await User.findById(leadId);
  if (!instructor) {
    return res.status(assignedByAdmin ? 404 : 401).json({ success: false, message: assignedByAdmin ? 'Instructor not found' : 'Account not found' });
  }
  if (assignedByAdmin) {
    if (instructor.role !== 'instructor' || instructor.instructorStatus !== 'approved') {
      return res.status(400).json({ success: false, message: `${instructor.fullName} is not an approved instructor` });
    }
    if (!data.courseId) {
      return res.status(400).json({ success: false, message: 'Pick the course this class delivers' });
    }
  }

  let resolvedCourseId: string | undefined;
  let resolvedLanguageOfferingId: string | undefined;
  let resolvedLanguage = data.language;
  let courseDoc: InstanceType<typeof CourseModel> | null = null;

  if (data.courseId) {
    if (!isValidObjectId(data.courseId)) {
      return res.status(400).json({ success: false, message: 'Invalid course ID' });
    }
    const course = await CourseModel.findById(data.courseId);
    if (!course || course.status === 'archived') {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    courseDoc = course;
    if (course.status !== 'published' && req.user!.role !== 'admin') {
      return res.status(400).json({ success: false, message: 'Course must be published' });
    }

    resolvedCourseId = String(course._id);

    if (data.languageOfferingId) {
      if (!isValidObjectId(data.languageOfferingId)) {
        return res.status(400).json({ success: false, message: 'Invalid language offering ID' });
      }
      const offering = (course.languageOfferings || []).find(
        (o) => String(o._id) === data.languageOfferingId
      );
      if (!offering || offering.status === 'inactive') {
        return res.status(400).json({ success: false, message: 'Language offering not available' });
      }
      resolvedLanguageOfferingId = String(offering._id);
      resolvedLanguage = offering.label;
    }

    const leadIsTeaching = req.user!.role === 'instructor' || assignedByAdmin;
    if (leadIsTeaching && !isCertifiedFor(instructor, resolvedCourseId, resolvedLanguageOfferingId)) {
      const scope = `"${course.title}"${resolvedLanguage ? ` in ${resolvedLanguage}` : ''}`;
      return res.status(assignedByAdmin ? 400 : 403).json({
        success: false,
        message: assignedByAdmin
          ? `${instructor.fullName} is not certified for ${scope}. Certify them from the Instructors tab first.`
          : `You are not certified to teach ${scope}. Ask an admin to certify you.`,
      });
    }
  }

  const isAdminCreator = req.user!.role === 'admin';
  const rangeError = isAdminCreator ? null : priceRangeError(courseDoc, data.price);
  if (rangeError) return res.status(400).json({ success: false, message: rangeError });
  let initialStatus = data.status || 'published';
  let freeApproval: any;
  if (data.price === 0) {
    const now = new Date();
    if (isAdminCreator) {
      freeApproval = { status: 'approved', requestedAt: now, decidedAt: now, decidedBy: req.user!.id };
    } else {
      freeApproval = { status: 'pending', requestedAt: now, requestedStatus: initialStatus === 'published' ? 'published' : 'draft' };
      initialStatus = 'draft';
    }
  }

  const maxClassSeats = await getMaxClassSeats();

  // Reject overlaps within the submitted batch itself before touching the DB or Zoom.
  if (data.schedule?.length) {
    for (let i = 0; i < data.schedule.length; i++) {
      for (let j = i + 1; j < data.schedule.length; j++) {
        const a = data.schedule[i];
        const b = data.schedule[j];
        if (sessionsOverlap(new Date(a.startTime), new Date(a.endTime), new Date(b.startTime), new Date(b.endTime))) {
          return res.status(409).json({ success: false, message: `Sessions "${a.title}" and "${b.title}" overlap` });
        }
      }
    }

    const { zoomHostUserId } = await resolveInstructorZoomHost(leadId);
    const who = assignedByAdmin ? `${instructor.fullName} already has` : 'You already have';
    for (const s of data.schedule) {
      const conflict = await findSchedulingConflict({
        instructorId: leadId,
        zoomHostUserId,
        startTime: new Date(s.startTime),
        endTime: new Date(s.endTime),
      });
      if (conflict) {
        return res.status(409).json({
          success: false,
          message: conflict.reason === 'instructor'
            ? `${who} a session scheduled during "${s.title}"'s time`
            : `The assigned Zoom host already has a meeting during "${s.title}"'s time`,
        });
      }
    }
  }

  const cls = await ClassModel.create({
    ...data,
    timezone: data.timezone || (isValidTimeZone(instructor.timezone) ? instructor.timezone : 'UTC'),
    language: resolvedLanguage,
    courseId: resolvedCourseId,
    languageOfferingId: resolvedLanguageOfferingId,
    // Capacity is platform-wide (admin setting), not per-class instructor input.
    maxStudents: maxClassSeats,
    currency: 'USD',
    instructor: {
      id: instructor._id,
      name: instructor.fullName,
      avatar: instructor.avatar,
    },
    teachingTeam: [
      {
        userId: instructor._id,
        name: instructor.fullName,
        email: instructor.email,
        role: 'lead',
        status: 'accepted',
        invitedAt: new Date(),
        respondedAt: new Date(),
      },
    ],
    status: initialStatus,
    freeApproval,
  });

  if (data.schedule?.length) {
    const { hostIdentifier, zoomHostUserId } = await resolveInstructorZoomHost(leadId);
    const scheduleDocs = await Promise.all(
      data.schedule.map(async (s) => {
        try {
          const zoom = await createZoomMeeting({
            topic: `${cls.title} - ${s.title}`,
            startTime: s.startTime,
            durationMinutes: (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000,
            hostIdentifier,
            timezone: cls.timezone || undefined,
          });

          return {
            classId: cls.id,
            sessionNumber: s.sessionNumber,
            title: s.title,
            description: s.description,
            startTime: new Date(s.startTime),
            endTime: new Date(s.endTime),
            zoomLink: zoom.join_url,
            zoomMeetingId: zoom.id ? String(zoom.id) : undefined,
            zoomPasscode: zoom.password,
            // zoomStartUrl is intentionally not persisted - see the deprecation note
            // on the schema field. Host access is always fetched fresh on demand
            // (POST /host-access), never read from a stored value.
            zoomHostUserId,
            meetingCreationStatus: zoom.id ? 'ready' : 'skipped',
          };
        } catch (error) {
          console.error(`Zoom meeting creation failed for new session "${s.title}" on class ${cls.id}:`, error instanceof Error ? error.message : error);
          // Recoverable state: the session is still created so the instructor can see
          // and retry it, rather than silently dropping it or falsely marking it ready.
          return {
            classId: cls.id,
            sessionNumber: s.sessionNumber,
            title: s.title,
            description: s.description,
            startTime: new Date(s.startTime),
            endTime: new Date(s.endTime),
            zoomHostUserId,
            meetingCreationStatus: 'failed',
          };
        }
      })
    );

    await ClassScheduleModel.insertMany(scheduleDocs);
  }

  if (req.user!.role === 'admin') {
    if (assignedByAdmin) {
      await NotificationModel.create({
        userId: instructor._id,
        type: 'system',
        title: 'You were assigned a class',
        message: `An admin assigned you as lead instructor of "${cls.title}".`,
        read: false,
        actionUrl: `/instructor/classes/${cls.id}/manage`,
      }).catch(() => {});
    }
    await logActivity({
      category: 'class',
      action: 'admin_create',
      message: `Admin created "${cls.title}" led by ${instructor.fullName}`,
      actorId: req.user!.id,
      actorName: 'Admin',
      actorRole: 'admin',
      targetUserId: String(instructor._id),
      targetClassId: cls.id,
    });
  }

  const awaitingFreeApproval = freeApproval?.status === 'pending';
  if (awaitingFreeApproval) await requestFreeApproval(cls, instructor.fullName, req.user!.id);

  return res.status(201).json({
    success: true,
    data: normalizeClass(cls),
    message: awaitingFreeApproval
      ? 'Class saved as a draft. Free classes need admin approval before they go live — we’ll notify you.'
      : 'Class created successfully',
  });
});

async function requestFreeApproval(cls: InstanceType<typeof ClassModel>, instructorName: string, actorId: string) {
  await logActivity({
    category: 'class',
    action: 'free_requested',
    message: `${instructorName} asked to run "${cls.title}" for free`,
    actorId,
    actorName: instructorName,
    actorRole: 'instructor',
    targetClassId: cls.id,
  });
  const admins = await User.find({ role: 'admin' }).select('_id').lean();
  if (admins.length) {
    await NotificationModel.insertMany(
      admins.map((a) => ({
        userId: a._id,
        type: 'system',
        title: 'Free class needs approval',
        message: `${instructorName} wants to run "${cls.title}" for free.`,
        read: false,
        actionUrl: `/admin/my-classes?tab=classes`,
      }))
    ).catch(() => {});
  }
}

router.post(
  '/:classId/sessions/:sessionId/join-credentials',
  requireAuth,
  rateLimit({ windowMs: 60_000, max: 20, keyPrefix: 'join-credentials' }),
  async (req: AuthRequest, res) => {
    // 1-2. Authentication (requireAuth) + valid identifiers
    if (!isValidObjectId(req.params.classId) || !isValidObjectId(req.params.sessionId)) {
      return res.status(400).json({ success: false, message: 'Invalid class or session ID' });
    }

    // 3. Class exists
    const cls = await ClassModel.findById(req.params.classId);
    if (!cls) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    // 4. Session exists and belongs to the class
    const session = await ClassScheduleModel.findOne({ _id: req.params.sessionId, classId: req.params.classId });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const onTeam = teachesClass(cls, req.user!.id);
    const isAdmin = req.user!.role === 'admin';

    // 5. Active enrollment (teaching team / admin skip this - they're not "enrolled")
    let enrollment: InstanceType<typeof EnrollmentModel> | null = null;
    if (!onTeam && !isAdmin) {
      enrollment = await EnrollmentModel.findOne({ classId: req.params.classId, userId: req.user!.id });
      if (!enrollment || enrollment.status === 'dropped') {
        return res.status(403).json({ success: false, message: 'Not enrolled in this class' });
      }
    }

    // 6-8. Not cancelled/ended/completed, within the join window, a meeting exists
    const externalUrl = session.meetingUrl || '';
    const decision = evaluateJoinWindow(
      {
        status: session.status,
        startTime: session.startTime,
        endTime: session.endTime,
        hasZoomMeeting: !!session.zoomMeetingId || !!externalUrl,
      },
      new Date()
    );
    if (!decision.allowed) {
      return res.status(decision.httpStatus).json({ success: false, code: decision.code, message: decision.message });
    }

    // Handing out join details isn't attendance yet — POST /joined or the Zoom webhook confirms it.
    const recordJoin = async () => {
      if (!enrollment) return;
      const late = Date.now() > new Date(session.startTime).getTime() + LATE_AFTER_START_MS;
      await AttendanceRecordModel.updateOne(
        { sessionId: session.id, userId: req.user!.id },
        { $setOnInsert: { classId: cls.id, enrollmentId: enrollment.id, authorizedAt: new Date(), late, pendingJoin: true } },
        { upsert: true }
      ).catch((error) => console.error('Failed to record join authorization:', error instanceof Error ? error.message : error));
    };

    // Instructor-provided room (Meet, Teams, personal Zoom…): hand out the link only now, inside the window.
    if (externalUrl) {
      await recordJoin();
      return res.json({ success: true, data: { provider: 'external', joinUrl: externalUrl } });
    }

    const sdkReady = Boolean(ENV.ZOOM_MEETING_SDK_CLIENT_ID && ENV.ZOOM_MEETING_SDK_CLIENT_SECRET);
    if (!sdkReady) {
      // Without the Meeting SDK learners can still join through the Zoom app / web client.
      if (!session.zoomLink) return res.status(503).json({ success: false, message: 'Zoom Meeting SDK not configured' });
      await recordJoin();
      return res.json({ success: true, data: { provider: 'zoom_link', joinUrl: session.zoomLink, passWord: session.zoomPasscode || undefined } });
    }

    try {
      // Participant role only (0) for every joiner, instructor/admin included -
      // hosts start through Zoom's native start-URL flow (see /host-access).
      const signature = generateZoomMeetingSDKSignature({ meetingNumber: session.zoomMeetingId! });
      const user = await User.findById(req.user!.id);
      await recordJoin();

      return res.json({
        success: true,
        data: {
          provider: 'zoom_sdk',
          signature,
          meetingNumber: session.zoomMeetingId,
          passWord: session.zoomPasscode || undefined,
          userName: user?.fullName || 'Student',
          userEmail: user?.email,
          /** Echoed back by Zoom webhooks as participant.customer_key, so attendance matches even without an email. */
          customerKey: req.user!.id,
          /** Fallback when the in-browser client can't start (blocked camera, old browser…). */
          joinUrl: session.zoomLink || undefined,
        },
      });
    } catch (error) {
      return res.status(503).json({ success: false, message: 'Failed to generate meeting credentials' });
    }
  }
);

/**
 * Learner-side confirmation that they actually got into the meeting: the embedded Zoom
 * client finished joining, or they opened the meeting link. Only valid after
 * join-credentials handed out access for this session, and only while it can still be joined.
 */
router.post(
  '/:classId/sessions/:sessionId/joined',
  requireAuth,
  rateLimit({ windowMs: 60_000, max: 20, keyPrefix: 'join-confirm' }),
  async (req: AuthRequest, res) => {
    if (!isValidObjectId(req.params.classId) || !isValidObjectId(req.params.sessionId)) {
      return res.status(400).json({ success: false, message: 'Invalid class or session ID' });
    }
    const session = await ClassScheduleModel.findOne({ _id: req.params.sessionId, classId: req.params.classId });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    const record = await AttendanceRecordModel.findOne({ sessionId: session.id, userId: req.user!.id });
    // Teaching team / admins never get a row, so there's nothing to confirm for them.
    if (!record) return res.json({ success: true, data: { counted: false } });

    const decision = evaluateJoinWindow(
      {
        status: session.status,
        startTime: session.startTime,
        endTime: session.endTime,
        hasZoomMeeting: !!session.zoomMeetingId || !!session.meetingUrl,
      },
      new Date()
    );
    if (!decision.allowed) {
      return res.status(decision.httpStatus).json({ success: false, code: decision.code, message: decision.message });
    }

    await confirmAttendance(record, session, 'client');
    return res.json({ success: true, data: { counted: true, late: record.late } });
  }
);

/**
 * Instructor/admin-only: returns a fresh Zoom host start URL so the assigned
 * instructor can start and control the meeting through Zoom's native host
 * experience. Never returned to students, never logged, never included in any
 * other class/session response.
 */
router.post(
  '/:classId/sessions/:sessionId/host-access',
  requireAuth,
  requireRole('instructor', 'admin'),
  rateLimit({ windowMs: 60_000, max: 10, keyPrefix: 'host-access' }),
  async (req: AuthRequest, res) => {
    // A host start_url is a short-lived credential (Zoom expires it ~2 hours after
    // the meeting was *created*, not from the class's scheduled time - see
    // getZoomMeetingStartUrl), so this response must never be cached by a shared
    // cache, browser back/forward cache, or proxy.
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');

    if (!isValidObjectId(req.params.classId) || !isValidObjectId(req.params.sessionId)) {
      return res.status(400).json({ success: false, message: 'Invalid class or session ID' });
    }

    const cls = await ClassModel.findById(req.params.classId);
    if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });

    if (req.user!.role !== 'admin' && !teachesClass(cls, req.user!.id)) {
      return res.status(403).json({ success: false, message: 'You are not on the teaching team for this class' });
    }

    const session = await ClassScheduleModel.findOne({ _id: req.params.sessionId, classId: req.params.classId });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    if (session.status === 'cancelled' || session.status === 'completed') {
      return res.status(409).json({ success: false, message: `Session is ${session.status}` });
    }
    if (session.meetingUrl) {
      return res.json({ success: true, data: { startUrl: session.meetingUrl, provider: 'external' } });
    }
    if (!session.zoomMeetingId) {
      return res.status(409).json({ success: false, message: 'Meeting not available for this session' });
    }

    // Deliberately ignores any previously-stored zoomStartUrl (deprecated, never
    // trusted as authorization - see the model comment): a start_url generated at
    // meeting-creation time is very likely expired by the time an instructor
    // actually starts a class scheduled hours or days later. The only source of
    // truth for host access is a fresh Retrieve-a-Meeting call made right now.
    const startUrl = await getZoomMeetingStartUrl(session.zoomMeetingId);
    if (!startUrl) {
      // Never surface the Zoom response body or any URL in the error - only a
      // safe, generic message. getZoomMeetingStartUrl itself never logs the URL.
      return res.status(503).json({ success: false, message: 'Unable to retrieve a fresh host start link right now. Please try again shortly.' });
    }

    return res.json({ success: true, data: { startUrl, provider: 'zoom' } });
  }
);

/**
 * Instructor/admin: create (or recreate) a Zoom meeting for a session that has none.
 * Use after configuring Zoom env, or when an earlier create failed/skipped.
 */
router.post(
  '/:id/schedule/:sessionId/ensure-zoom',
  requireAuth,
  requireRole('instructor', 'admin'),
  requireApprovedInstructor,
  rateLimit({ windowMs: 60_000, max: 10, keyPrefix: 'ensure-zoom' }),
  async (req: AuthRequest, res) => {
    if (!isValidObjectId(req.params.id) || !isValidObjectId(req.params.sessionId)) {
      return res.status(400).json({ success: false, message: 'Invalid class or session ID' });
    }

    const cls = await ClassModel.findById(req.params.id);
    if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });

    const isLead = String(cls.instructor.id) === req.user!.id;
    const isAcceptedSupport = (cls.teachingTeam || []).some(
      (m: any) => String(m.userId) === req.user!.id && m.status === 'accepted'
    );
    if (req.user!.role !== 'admin' && !isLead && !isAcceptedSupport) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const session = await ClassScheduleModel.findOne({
      _id: req.params.sessionId,
      classId: req.params.id,
    });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    if (session.status === 'cancelled' || session.status === 'completed') {
      return res.status(409).json({
        success: false,
        message: `Cannot attach Zoom to a ${session.status} session. Reschedule to a future time first.`,
      });
    }

    if (session.zoomMeetingId && session.meetingCreationStatus === 'ready') {
      return res.json({
        success: true,
        data: {
          ...stripHostFields(normalizeSchedule(session)),
          hasZoomMeeting: true,
          meetingCreationStatus: session.meetingCreationStatus,
        },
        message: 'Zoom meeting already ready',
      });
    }

    const token = await getZoomAccessToken();
    if (!token) {
      return res.status(503).json({
        success: false,
        message:
          'Zoom Server-to-Server OAuth is not configured. Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET on the backend, then retry.',
      });
    }

    session.meetingCreationStatus = 'creating';
    await session.save();

    try {
      const { hostIdentifier, zoomHostUserId } = await resolveInstructorZoomHost(String(cls.instructor.id));
      const zoom = await createZoomMeeting({
        topic: `${cls.title} - ${session.title}`,
        startTime: new Date(session.startTime).toISOString(),
        durationMinutes: Math.max(
          15,
          Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60000)
        ),
        hostIdentifier,
        timezone: cls.timezone || undefined,
      });

      if (!zoom.id) {
        session.meetingCreationStatus = 'skipped';
        await session.save();
        return res.status(503).json({
          success: false,
          message: 'Zoom did not return a meeting id. Check Server-to-Server app scopes and credentials.',
          data: {
            ...stripHostFields(normalizeSchedule(session)),
            hasZoomMeeting: false,
            meetingCreationStatus: session.meetingCreationStatus,
          },
        });
      }

      session.zoomLink = zoom.join_url || undefined;
      session.zoomMeetingId = String(zoom.id);
      session.zoomPasscode = zoom.password;
      session.zoomHostUserId = zoomHostUserId;
      session.meetingCreationStatus = 'ready';
      await session.save();

      return res.json({
        success: true,
        data: {
          ...stripHostFields(normalizeSchedule(session)),
          hasZoomMeeting: true,
          meetingCreationStatus: session.meetingCreationStatus,
        },
        message: 'Zoom meeting created for this session',
      });
    } catch (error) {
      session.meetingCreationStatus = 'failed';
      await session.save();
      console.error(
        'ensure-zoom failed:',
        error instanceof Error ? error.message : error
      );
      return res.status(503).json({
        success: false,
        message: 'Could not create Zoom meeting. Verify Zoom credentials and meeting scopes.',
        data: {
          ...stripHostFields(normalizeSchedule(session)),
          hasZoomMeeting: false,
          meetingCreationStatus: session.meetingCreationStatus,
        },
      });
    }
  }
);

/**
 * Student-only: submits (or resubmits, overwriting in place) an answer to one of
 * the class's embedded `assignments` entries - a written answer, an attached
 * file, or both. Registered ahead of the instructor-only `/:id` ownership gate
 * below since this is a student action, not an instructor action.
 */
router.post(
  '/:classId/assignments/:assignmentId/submissions',
  requireAuth,
  rateLimit({ windowMs: 60_000, max: 20, keyPrefix: 'assignment-submit' }),
  (req: AuthRequest, res, next) => {
    classFileUpload.single('file')(req, res, (err: unknown) => {
      if (err) {
        const message = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
          ? 'File is too large (25MB max)'
          : err instanceof Error ? err.message : 'Invalid upload';
        return res.status(400).json({ success: false, message });
      }
      next();
    });
  },
  async (req: AuthRequest, res) => {
    if (!isValidObjectId(req.params.classId)) {
      return res.status(400).json({ success: false, message: 'Invalid class ID' });
    }

    const cls = await ClassModel.findById(req.params.classId);
    if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });

    const assignment = (cls.assignments as any[]).find((a: any) => String(a._id) === req.params.assignmentId);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

    const enrollment = await EnrollmentModel.findOne({
      classId: cls.id,
      userId: req.user!.id,
      status: { $ne: 'dropped' },
    });
    if (!enrollment) return res.status(403).json({ success: false, message: 'Not enrolled in this class' });

    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    let attachmentUrl: string | undefined;
    if (req.file) {
      const result = await uploadClassFile(req.file.buffer, `nexnoon/classes/${cls.id}/submissions`, req.file.originalname, req.file.mimetype);
      if (!result) return res.status(503).json({ success: false, message: 'File uploads are not configured' });
      attachmentUrl = result.url;
    }
    if (!content && !attachmentUrl) {
      return res.status(400).json({ success: false, message: 'Write an answer or attach a file' });
    }

    const submission = await AssignmentSubmissionModel.findOneAndUpdate(
      { assignmentId: req.params.assignmentId, userId: req.user!.id },
      {
        $set: {
          classId: cls.id,
          content: content || undefined,
          ...(attachmentUrl ? { attachmentUrl } : {}),
          submittedAt: new Date(),
        },
        $unset: { grade: 1 },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({ success: true, data: normalizeSubmission(submission), message: 'Assignment submitted' });
  }
);

router.use('/:id', async (req: AuthRequest, res, next) => {
  if (req.method === 'GET') return next();
  // Invitees must be able to accept/decline without being the lead owner.
  const path = `${req.path || ''}${req.url || ''}`;
  if (path.includes('instructors/respond')) return next();
  return requireAuth(req, res, async () => {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid class ID' });
    try {
      const cls = await ClassModel.findById(req.params.id);
      if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });
      const isLead = String(cls.instructor.id) === req.user!.id;
      const isAcceptedSupport = (cls.teachingTeam || []).some(
        (m) => String(m.userId) === req.user!.id && m.role === 'support' && m.status === 'accepted'
      );
      // Lead (or admin) can mutate; accepted support can mutate materials/session flows via same routes.
      if (req.user!.role !== 'admin' && !isLead && !isAcceptedSupport) {
        return res.status(403).json({ success: false, message: 'You can only change classes you teach' });
      }
      if (cls.cancelledAt && req.user!.role !== 'admin') {
        return res.status(409).json({ success: false, message: 'This class was cancelled by an admin and can no longer be changed' });
      }
      // Inviting support instructors remains lead/admin only (enforced in the invite handler).
      next();
    } catch (error) { next(error); }
  });
});

router.patch('/:id', requireAuth, requireRole('instructor', 'admin'), async (req: AuthRequest, res) => {
  const cls = await ClassModel.findById(req.params.id);
  if (!cls) {
    return res.status(404).json({ success: false, message: 'Class not found' });
  }

  const parsed = createClassSchema.partial().omit({ schedule: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid class changes' });
  // Instructors cannot override platform seat capacity; admin controls it via /settings/platform.
  const { maxStudents: _ignoredMaxStudents, leadInstructorId: _useLeadRoute, ...classUpdates } = parsed.data;
  if (cls.cancelledAt && classUpdates.status && classUpdates.status !== 'archived') {
    return res.status(409).json({ success: false, message: 'Cancelled classes cannot be republished. Create a new class instead.' });
  }
  const isAdmin = req.user!.role === 'admin';
  const now = new Date();
  let freeRequested = false;
  if (classUpdates.price !== undefined && classUpdates.price !== cls.price) {
    if (!isAdmin && classUpdates.price > 0) {
      const course = cls.courseId ? await CourseModel.findById(cls.courseId).select('title pricing') : null;
      const rangeError = priceRangeError(course, classUpdates.price);
      if (rangeError) return res.status(400).json({ success: false, message: rangeError });
    }
    if (classUpdates.price > 0) {
      cls.freeApproval = undefined;
    } else if (isAdmin) {
      cls.freeApproval = { status: 'approved', requestedAt: now, decidedAt: now, decidedBy: req.user!.id as any };
    } else if (cls.freeApproval?.status !== 'approved') {
      const wanted = (classUpdates.status ?? cls.status) === 'published' ? 'published' : 'draft';
      cls.freeApproval = { status: 'pending', requestedAt: now, requestedStatus: wanted };
      freeRequested = true;
    }
  }
  const nextPrice = classUpdates.price ?? cls.price;
  const wantsPublished = (classUpdates.status ?? cls.status) === 'published';
  if (nextPrice === 0 && wantsPublished && freeClassBlocked({ price: 0, freeApproval: cls.freeApproval })) {
    if (isAdmin) {
      cls.freeApproval = { ...cls.freeApproval!, status: 'approved', decidedAt: now, decidedBy: req.user!.id as any };
    } else if (freeRequested) {
      classUpdates.status = 'draft';
    } else {
      return res.status(409).json({ success: false, message: 'Free classes need admin approval before they can be published.' });
    }
  }

  const prevStatus = cls.status;
  if (classUpdates.details) {
    classUpdates.details = ensureCurriculumIds(classUpdates.details);
  }
  Object.assign(cls, classUpdates);
  cls.maxStudents = await getMaxClassSeats();
  await cls.save();
  if (freeRequested) await requestFreeApproval(cls, cls.instructor.name, req.user!.id);

  if (req.user!.role === 'admin' && cls.status !== prevStatus) {
    await logActivity({
      category: 'class',
      action: `status_${cls.status}`,
      message: `Admin changed "${cls.title}" from ${prevStatus} to ${cls.status}`,
      actorId: req.user!.id,
      actorName: 'Admin',
      actorRole: 'admin',
      targetClassId: cls.id,
    });
  }

  return res.json({
    success: true,
    data: normalizeClass(cls),
    message: freeRequested
      ? 'Saved as a draft. Free classes need admin approval before they go live — we’ll notify you.'
      : 'Class updated successfully',
  });
});

const gradeSchema = z.object({
  score: z.number().min(0),
  maxScore: z.number().min(1).max(1000).default(100),
  feedback: z.string().trim().max(5000).optional(),
});

/** Teaching team (or admin) grades a learner's submission; the learner is notified. */
router.put(
  '/:id/assignments/:assignmentId/submissions/:submissionId/grade',
  requireAuth,
  requireRole('instructor', 'admin'),
  async (req: AuthRequest, res) => {
    const parsed = gradeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: 'Score must be a number from 0 up to the max score' });
    if (parsed.data.score > parsed.data.maxScore) {
      return res.status(400).json({ success: false, message: 'Score cannot exceed the max score' });
    }
    if (!isValidObjectId(req.params.submissionId)) return res.status(400).json({ success: false, message: 'Invalid submission ID' });

    const [cls, submission, grader] = await Promise.all([
      ClassModel.findById(req.params.id).select('title assignments instructor teachingTeam'),
      AssignmentSubmissionModel.findOne({ _id: req.params.submissionId, classId: req.params.id, assignmentId: req.params.assignmentId }),
      User.findById(req.user!.id).select('fullName'),
    ]);
    if (!cls || !submission) return res.status(404).json({ success: false, message: 'Submission not found' });
    if (req.user!.role !== 'admin' && !teachesClass(cls, req.user!.id)) {
      return res.status(403).json({ success: false, message: 'You can only grade classes you teach' });
    }

    const wasGraded = !!submission.grade;
    submission.grade = {
      score: parsed.data.score,
      maxScore: parsed.data.maxScore,
      feedback: parsed.data.feedback || undefined,
      gradedAt: new Date(),
      gradedBy: req.user!.id as any,
      gradedByName: grader?.fullName,
    };
    await submission.save();

    const assignment = (cls.assignments as any[]).find((a: any) => String(a._id) === req.params.assignmentId);
    await NotificationModel.create({
      userId: submission.userId,
      type: 'class',
      title: wasGraded ? 'Grade updated' : 'Assignment graded',
      message: `${assignment?.title || 'Your assignment'} in ${cls.title}: ${parsed.data.score}/${parsed.data.maxScore}`,
      read: false,
      actionUrl: `/assignments/${cls.id}`,
    }).catch(() => {});

    if (req.user!.role === 'admin') {
      await logActivity({
        category: 'assignment',
        action: 'grade',
        message: `Admin graded a submission in ${cls.title}: ${parsed.data.score}/${parsed.data.maxScore}`,
        actorId: req.user!.id,
        actorName: 'Admin',
        actorRole: 'admin',
        targetUserId: String(submission.userId),
        targetClassId: cls.id,
      });
    }

    return res.json({ success: true, data: normalizeSubmission(submission), message: wasGraded ? 'Grade updated' : 'Graded' });
  }
);

/** Attendance grid for the teaching team (admins use /admin/classes/:id/attendance). */
router.get('/:id/attendance', requireAuth, requireRole('instructor', 'admin'), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid class ID' });
  const cls = await ClassModel.findById(req.params.id).select('title timezone instructor teachingTeam').lean();
  if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });
  if (req.user!.role !== 'admin' && !teachesClass(cls as any, req.user!.id)) {
    return res.status(403).json({ success: false, message: 'You can only view attendance for classes you teach' });
  }
  return res.json({ success: true, data: await buildAttendanceMatrix(cls) });
});

router.put('/:id/attendance', requireAuth, requireRole('instructor', 'admin'), async (req: AuthRequest, res) => {
  const parsed = markAttendanceSchema.safeParse(req.body);
  if (!parsed.success || !isValidObjectId(req.params.id) || !isValidObjectId(parsed.data.sessionId) || !isValidObjectId(parsed.data.userId)) {
    return res.status(400).json({ success: false, message: 'Invalid attendance mark' });
  }
  const cls = await ClassModel.findById(req.params.id).select('title instructor teachingTeam').lean();
  if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });
  if (req.user!.role !== 'admin' && !teachesClass(cls as any, req.user!.id)) {
    return res.status(403).json({ success: false, message: 'You can only mark attendance for classes you teach' });
  }
  const result = await markAttendance(req.params.id, parsed.data, req.user!.id);
  if (!result.ok) return res.status(result.status).json({ success: false, message: result.message });

  const { status } = parsed.data;
  const actor = await User.findById(req.user!.id).select('fullName').lean();
  await logActivity({
    category: 'class',
    action: 'attendance_mark',
    message: `${actor?.fullName || 'Instructor'} marked attendance "${status ?? 'auto'}" for session "${result.sessionTitle}"`,
    actorId: req.user!.id,
    actorName: actor?.fullName || 'Instructor',
    actorRole: req.user!.role as any,
    targetUserId: parsed.data.userId,
    targetClassId: req.params.id,
  });
  return res.json({ success: true, message: status ? `Marked ${status}` : 'Reset to automatic' });
});

const inviteSchema = z.object({
  email: z.string().email(),
});

/** Lead instructor invites a support instructor (max 2 support members). */
router.post('/:id/instructors/invite', requireAuth, requireRole('instructor', 'admin'), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid class ID' });
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Valid email is required' });

  const cls = await ClassModel.findById(req.params.id);
  if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });

  const isLead = String(cls.instructor.id) === req.user!.id;
  if (req.user!.role !== 'admin' && !isLead) {
    return res.status(403).json({ success: false, message: 'Only the lead instructor can invite support instructors' });
  }

  const invitee = await User.findOne({ email: parsed.data.email.toLowerCase() });
  if (!invitee) return res.status(404).json({ success: false, message: 'No Nexnoon account found for that email' });
  if (invitee.role !== 'instructor' || invitee.instructorStatus !== 'approved') {
    return res.status(400).json({ success: false, message: 'Invitee must be an approved instructor' });
  }
  if (cls.courseId && !isCertifiedFor(invitee, String(cls.courseId), cls.languageOfferingId ? String(cls.languageOfferingId) : null)) {
    return res.status(400).json({
      success: false,
      message: `${invitee.fullName} is not certified for this class's course and language. An admin must certify them first.`,
    });
  }
  if (String(invitee._id) === String(cls.instructor.id)) {
    return res.status(400).json({ success: false, message: 'Lead instructor is already on this class' });
  }

  if (!cls.teachingTeam?.length) {
    const lead = await User.findById(cls.instructor.id);
    cls.teachingTeam = [{
      userId: cls.instructor.id as any,
      name: cls.instructor.name,
      email: lead?.email || '',
      role: 'lead',
      status: 'accepted',
      invitedAt: new Date(),
      respondedAt: new Date(),
    }] as any;
  }

  const existing = cls.teachingTeam.find((m) => String(m.userId) === String(invitee._id));
  if (existing && existing.status !== 'removed' && existing.status !== 'declined') {
    return res.status(409).json({ success: false, message: 'This instructor is already on the teaching team' });
  }

  const activeSupport = cls.teachingTeam.filter(
    (m) => m.role === 'support' && m.status !== 'removed' && m.status !== 'declined'
  );
  if (activeSupport.length >= 2) {
    return res.status(409).json({ success: false, message: 'A class can have at most 2 support instructors' });
  }

  if (existing && (existing.status === 'declined' || existing.status === 'removed')) {
    existing.name = invitee.fullName;
    existing.email = invitee.email;
    existing.role = 'support';
    existing.status = 'pending';
    existing.invitedAt = new Date();
    existing.respondedAt = undefined;
  } else {
    cls.teachingTeam.push({
      userId: invitee._id as any,
      name: invitee.fullName,
      email: invitee.email,
      role: 'support',
      status: 'pending',
      invitedAt: new Date(),
    } as any);
  }
  await cls.save();

  await NotificationModel.create({
    userId: invitee.id,
    type: 'class',
    title: 'Teaching invite',
    message: `You've been invited as support instructor on "${cls.title}".`,
    read: false,
    actionUrl: `/classroom/${cls.id}`,
  }).catch(() => {});

  await sendEmailSafe(
    invitee.email,
    `Teaching invite: ${cls.title}`,
    buildTeachingInviteEmail({
      inviteeName: invitee.fullName,
      leadName: cls.instructor.name,
      classTitle: cls.title,
      classId: cls.id,
    })
  );

  return res.status(201).json({
    success: true,
    data: normalizeClass(cls),
    message: 'Invite sent',
  });
});

/** Support instructor accepts or declines an invite. */
router.post('/:id/instructors/respond', requireAuth, requireRole('instructor', 'admin'), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid class ID' });
  const decision = z.object({ status: z.enum(['accepted', 'declined']) }).safeParse(req.body);
  if (!decision.success) return res.status(400).json({ success: false, message: 'status must be accepted or declined' });

  const cls = await ClassModel.findById(req.params.id);
  if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });

  const member = (cls.teachingTeam || []).find(
    (m) => String(m.userId) === req.user!.id && m.status === 'pending'
  );
  if (!member) return res.status(404).json({ success: false, message: 'No pending invite found' });

  member.status = decision.data.status;
  member.respondedAt = new Date();
  await cls.save();

  return res.json({
    success: true,
    data: normalizeClass(cls),
    message: `Invite ${decision.data.status}`,
  });
});

/** Lead removes a support instructor from the teaching team. */
router.post('/:id/instructors/remove', requireAuth, requireRole('instructor', 'admin'), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid class ID' });
  }
  const parsed = z.object({ userId: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'userId is required' });
  }

  const cls = await ClassModel.findById(req.params.id);
  if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });

  const isLead = String(cls.instructor.id) === req.user!.id;
  if (req.user!.role !== 'admin' && !isLead) {
    return res.status(403).json({ success: false, message: 'Only the lead instructor can remove support instructors' });
  }

  const member = (cls.teachingTeam || []).find(
    (m) => String(m.userId) === parsed.data.userId && m.role === 'support' && m.status !== 'removed'
  );
  if (!member) {
    return res.status(404).json({ success: false, message: 'Support instructor not found on this class' });
  }

  member.status = 'removed';
  member.respondedAt = new Date();
  await cls.save();

  await NotificationModel.create({
    userId: parsed.data.userId,
    type: 'class',
    title: 'Removed from teaching team',
    message: `You were removed from the teaching team on "${cls.title}".`,
    read: false,
    actionUrl: `/my-classes`,
  }).catch(() => {});

  if (req.user!.role === 'admin') {
    await logActivity({
      category: 'class',
      action: 'support_remove',
      message: `Admin removed ${member.name} from the teaching team of ${cls.title}`,
      actorId: req.user!.id,
      actorName: 'Admin',
      actorRole: 'admin',
      targetUserId: parsed.data.userId,
      targetClassId: cls.id,
    });
  }

  return res.json({
    success: true,
    data: normalizeClass(cls),
    message: 'Support instructor removed',
  });
});

/** Loads an instructor an admin wants to put on a class and enforces approval + course certification. */
async function loadAssignableInstructor(
  cls: InstanceType<typeof ClassModel>,
  userId: string
): Promise<{ user: InstanceType<typeof User> } | { status: number; message: string }> {
  if (!isValidObjectId(userId)) return { status: 400, message: 'Invalid instructor ID' };
  const user = await User.findById(userId);
  if (!user) return { status: 404, message: 'Instructor not found' };
  if (user.role !== 'instructor' || user.instructorStatus !== 'approved') {
    return { status: 400, message: `${user.fullName} is not an approved instructor` };
  }
  if (cls.courseId && !isCertifiedFor(user, String(cls.courseId), cls.languageOfferingId ? String(cls.languageOfferingId) : null)) {
    return { status: 400, message: `${user.fullName} is not certified for this class's course${cls.language ? ` in ${cls.language}` : ''}` };
  }
  return { user };
}

function ensureLeadOnTeam(cls: InstanceType<typeof ClassModel>, leadEmail = '') {
  if (cls.teachingTeam?.some((m) => m.role === 'lead' && m.status !== 'removed')) return;
  cls.teachingTeam.push({
    userId: cls.instructor.id,
    name: cls.instructor.name,
    email: leadEmail,
    role: 'lead',
    status: 'accepted',
    invitedAt: new Date(),
    respondedAt: new Date(),
  } as any);
}

/** Admin assigns (or replaces) the lead instructor of a class. */
router.post('/:id/lead', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
  const parsed = z.object({ userId: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'userId is required' });

  const cls = await ClassModel.findById(req.params.id);
  if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });
  if (cls.cancelledAt) return res.status(409).json({ success: false, message: 'This class was cancelled' });
  if (String(cls.instructor.id) === parsed.data.userId) {
    return res.status(400).json({ success: false, message: 'That instructor already leads this class' });
  }

  const loaded = await loadAssignableInstructor(cls, parsed.data.userId);
  if ('status' in loaded) return res.status(loaded.status).json({ success: false, message: loaded.message });
  const next = loaded.user;

  // The new lead must be free for every upcoming session of this class.
  const upcoming = await ClassScheduleModel.find({
    classId: cls.id,
    status: { $in: ['scheduled', 'live'] },
    endTime: { $gt: new Date() },
  });
  const { zoomHostUserId: nextHost } = await resolveInstructorZoomHost(String(next._id));
  for (const s of upcoming) {
    // Only the person matters here; meetings that can't move to their Zoom host stay where they are.
    const conflict = await findSchedulingConflict({
      instructorId: String(next._id),
      zoomHostUserId: nextHost,
      startTime: s.startTime,
      endTime: s.endTime,
    });
    if (conflict?.reason === 'instructor') {
      return res.status(409).json({
        success: false,
        message: `${next.fullName} already teaches another session during "${s.title}" (${s.startTime.toISOString()})`,
      });
    }
  }

  const previous = { id: String(cls.instructor.id), name: cls.instructor.name };
  ensureLeadOnTeam(cls);
  for (const m of cls.teachingTeam) {
    if (m.role === 'lead' && m.status !== 'removed') {
      m.status = 'removed';
      m.respondedAt = new Date();
    }
  }
  const existing = cls.teachingTeam.find((m) => String(m.userId) === String(next._id));
  if (existing) {
    existing.role = 'lead';
    existing.status = 'accepted';
    existing.name = next.fullName;
    existing.email = next.email;
    existing.respondedAt = new Date();
  } else {
    cls.teachingTeam.push({
      userId: next._id,
      name: next.fullName,
      email: next.email,
      role: 'lead',
      status: 'accepted',
      invitedAt: new Date(),
      respondedAt: new Date(),
    } as any);
  }
  cls.instructor = {
    id: next._id as any,
    name: next.fullName,
    avatar: next.avatar,
    bio: next.bio,
    rating: 0,
  } as any;
  await cls.save();

  const rehost = await rehostClassMeetings(cls.id);

  await Promise.all([
    notifyUserInAppSafe(String(next._id), 'You now lead a class', `An admin assigned you as lead instructor of "${cls.title}".`, `/instructor/classes/${cls.id}/manage`),
    notifyUserInAppSafe(previous.id, 'Teaching assignment changed', `You are no longer the lead instructor of "${cls.title}".`, '/my-classes'),
    notifyLearnersClassUpdate({
      classId: cls.id,
      classTitle: cls.title,
      title: 'New instructor',
      message: `${next.fullName} is now the lead instructor of ${cls.title}.`,
      email: false,
    }),
  ]);

  await logActivity({
    category: 'class',
    action: 'lead_change',
    message: `Admin changed the lead of ${cls.title} from ${previous.name} to ${next.fullName}`,
    actorId: req.user!.id,
    actorName: 'Admin',
    actorRole: 'admin',
    targetUserId: String(next._id),
    targetClassId: cls.id,
    meta: { previousLeadId: previous.id, zoomMeetingsMoved: rehost.moved, zoomMeetingsFailed: rehost.failed },
  });

  const zoomNote = rehost.moved
    ? ` ${rehost.moved} upcoming Zoom meeting${rehost.moved === 1 ? '' : 's'} moved to their Zoom account.`
    : '';
  const zoomWarn = rehost.failed
    ? ` ${rehost.failed} Zoom meeting${rehost.failed === 1 ? '' : 's'} couldn't be moved and stay under the previous host (the new lead can still start them).`
    : '';
  return res.json({
    success: true,
    data: normalizeClass(cls),
    message: `${next.fullName} now leads this class.${zoomNote}${zoomWarn}`,
  });
});

/** Admin adds a support instructor directly (no invite round-trip). Max 2 support. */
router.post('/:id/support', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
  const parsed = z.object({ userId: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'userId is required' });

  const cls = await ClassModel.findById(req.params.id);
  if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });
  if (cls.cancelledAt) return res.status(409).json({ success: false, message: 'This class was cancelled' });
  if (String(cls.instructor.id) === parsed.data.userId) {
    return res.status(400).json({ success: false, message: 'That instructor already leads this class' });
  }

  const loaded = await loadAssignableInstructor(cls, parsed.data.userId);
  if ('status' in loaded) return res.status(loaded.status).json({ success: false, message: loaded.message });
  const member = loaded.user;

  ensureLeadOnTeam(cls);
  const existing = cls.teachingTeam.find((m) => String(m.userId) === String(member._id));
  if (existing && existing.status === 'accepted') {
    return res.status(409).json({ success: false, message: `${member.fullName} is already on the teaching team` });
  }
  const activeSupport = cls.teachingTeam.filter(
    (m) => m.role === 'support' && (m.status === 'accepted' || m.status === 'pending') && String(m.userId) !== String(member._id)
  );
  if (activeSupport.length >= 2) {
    return res.status(409).json({ success: false, message: 'A class can have at most 2 support instructors' });
  }

  if (existing) {
    existing.role = 'support';
    existing.status = 'accepted';
    existing.name = member.fullName;
    existing.email = member.email;
    existing.respondedAt = new Date();
  } else {
    cls.teachingTeam.push({
      userId: member._id,
      name: member.fullName,
      email: member.email,
      role: 'support',
      status: 'accepted',
      invitedAt: new Date(),
      respondedAt: new Date(),
    } as any);
  }
  await cls.save();

  await notifyUserInAppSafe(
    String(member._id),
    'Added to a teaching team',
    `An admin added you as support instructor on "${cls.title}".`,
    `/classroom/${cls.id}`
  );
  await logActivity({
    category: 'class',
    action: 'support_add',
    message: `Admin added ${member.fullName} as support on ${cls.title}`,
    actorId: req.user!.id,
    actorName: 'Admin',
    actorRole: 'admin',
    targetUserId: String(member._id),
    targetClassId: cls.id,
  });

  return res.status(201).json({ success: true, data: normalizeClass(cls), message: `${member.fullName} added as support` });
});

/**
 * Admin cancels a whole class: archives it, cancels every upcoming session and
 * notifies learners + teaching team. Enrollments are kept for the record; refunds
 * are handled separately (the response reports how many paid enrollments exist).
 */
router.post('/:id/cancel', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
  const parsed = z.object({
    reason: z.string().trim().min(3, 'Give learners a short reason').max(1000),
    notifyLearners: z.boolean().optional(),
    refundLearners: z.boolean().optional(),
  }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid request' });
  }

  const cls = await ClassModel.findById(req.params.id);
  if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });
  if (cls.cancelledAt) return res.status(409).json({ success: false, message: 'This class is already cancelled' });

  const now = new Date();
  const toCancel = await ClassScheduleModel.find({ classId: cls.id, status: 'scheduled', startTime: { $gt: now } }).select('zoomMeetingId');
  const sessionResult = await ClassScheduleModel.updateMany(
    { _id: { $in: toCancel.map((x) => x._id) } },
    { $set: { status: 'cancelled' } }
  );
  await Promise.all(toCancel.map((x) => deleteZoomMeeting(x.zoomMeetingId)));

  cls.status = 'archived';
  cls.cancelledAt = now;
  cls.cancellationReason = parsed.data.reason;
  await cls.save();
  await closeWaitlist(cls.id);

  let refundsIssued = 0;
  let refundsFailed = 0;
  if (parsed.data.refundLearners) {
    const payments = await PaymentModel.find({ classId: cls.id, status: 'completed' });
    for (const payment of payments) {
      await refundPayment(payment, `Class cancelled: ${parsed.data.reason}`).then(
        () => { refundsIssued += 1; },
        () => { refundsFailed += 1; }
      );
    }
  }

  const learnersNotified = parsed.data.notifyLearners === false
    ? 0
    : await notifyLearnersClassUpdate({
        classId: cls.id,
        classTitle: cls.title,
        title: 'Class cancelled',
        message: `${cls.title} has been cancelled.\n\nReason: ${parsed.data.reason}\n\n${refundsIssued ? 'Your payment is being refunded in full to your card (usually 5–10 business days).' : 'Our team will contact you about next steps.'}`,
        actionUrl: '/my-classes?tab=classes',
      });

  const teamIds = (cls.teachingTeam || [])
    .filter((m) => m.status === 'accepted' || m.role === 'lead')
    .map((m) => String(m.userId));
  const uniqueTeam = [...new Set([String(cls.instructor.id), ...teamIds])];
  await Promise.all(
    uniqueTeam.map((uid) =>
      notifyUserInAppSafe(uid, 'Class cancelled', `An admin cancelled "${cls.title}". Reason: ${parsed.data.reason}`, '/my-classes')
    )
  );

  const paidEnrollments = await PaymentModel.countDocuments({ classId: cls.id, status: 'completed' });

  await logActivity({
    category: 'class',
    action: 'cancel',
    message: `Admin cancelled ${cls.title}: ${parsed.data.reason}`,
    actorId: req.user!.id,
    actorName: 'Admin',
    actorRole: 'admin',
    targetClassId: cls.id,
    meta: { sessionsCancelled: sessionResult.modifiedCount, learnersNotified, paidEnrollments, refundsIssued, refundsFailed },
  });

  return res.json({
    success: true,
    data: {
      class: normalizeClass(cls),
      sessionsCancelled: sessionResult.modifiedCount,
      learnersNotified,
      paidEnrollments,
      refundsIssued,
      refundsFailed,
    },
    message: `Class cancelled. ${sessionResult.modifiedCount} session(s) cancelled, ${learnersNotified} learner(s) notified.${refundsIssued ? ` ${refundsIssued} refund(s) issued.` : ''}${refundsFailed ? ` ${refundsFailed} refund(s) failed; retry them from Payments.` : ''}`,
  });
});

async function notifyUserInAppSafe(userId: string, title: string, message: string, actionUrl: string) {
  await NotificationModel.create({ userId, type: 'class', title, message, read: false, actionUrl }).catch(() => {});
}

/**
 * Instructor/admin-only: uploads a single class-content file (course material or
 * assignment attachment) to Cloudinary and returns its URL. Does not itself write
 * to the class document - the caller (frontend) follows up with a normal
 * PATCH /:id carrying the returned url in `materials` or `assignments`, so this
 * endpoint stays a single-purpose primitive reused by both features.
 */
router.post(
  '/:id/uploads',
  requireAuth,
  requireRole('instructor', 'admin'),
  rateLimit({ windowMs: 60_000, max: 20, keyPrefix: 'class-upload' }),
  async (req: AuthRequest, res, next) => {
    classFileUpload.single('file')(req, res, (err: unknown) => {
      if (err) {
        const message = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
          ? 'File is too large (80MB max)'
          : err instanceof Error ? err.message : 'Invalid upload';
        return res.status(400).json({ success: false, message });
      }
      next();
    });
  },
  async (req: AuthRequest, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided' });
    }

    const result = await uploadClassFile(req.file.buffer, `nexnoon/classes/${req.params.id}`, req.file.originalname, req.file.mimetype);
    if (!result) {
      return res.status(503).json({ success: false, message: 'File uploads are not configured' });
    }

    return res.json({ success: true, data: { url: result.url, name: req.file.originalname } });
  }
);

router.delete('/:id', requireAuth, requireRole('instructor', 'admin'), async (req: AuthRequest, res) => {
  const cls = await ClassModel.findById(req.params.id);
  if (!cls) {
    return res.status(404).json({ success: false, message: 'Class not found' });
  }
  if (req.user!.role !== 'admin') {
    if (String(cls.instructor.id) !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Only the lead instructor can delete this class' });
    }
    if (await EnrollmentModel.exists({ classId: cls._id, status: { $in: ['active', 'completed'] } })) {
      return res.status(409).json({
        success: false,
        message: 'Learners are enrolled in this class. Archive it or ask Nexnoon support to cancel it so they can be looked after.',
      });
    }
  }

  const sessions = await ClassScheduleModel.find({ classId: cls.id, zoomMeetingId: { $exists: true, $ne: null } }).select('zoomMeetingId status');
  await Promise.all(sessions.filter((x) => x.status !== 'completed').map((x) => deleteZoomMeeting(x.zoomMeetingId)));
  await cls.deleteOne();
  await ClassScheduleModel.deleteMany({ classId: cls.id });

  return res.json({
    success: true,
    data: null,
    message: 'Class deleted successfully',
  });
});

router.post('/:id/deletion-request', requireAuth, requireRole('instructor'), async (req, res) => {
  // For brevity, just accept the request and mark class as archived
  const cls = await ClassModel.findById(req.params.id);
  if (!cls) {
    return res.status(404).json({ success: false, message: 'Class not found' });
  }
  cls.status = 'archived';
  await cls.save();

  return res.json({
    success: true,
    data: null,
    message: 'Deletion request submitted',
  });
});

router.get('/:id/schedule', requireAuth, async (req: AuthRequest, res) => {
  const cls = await ClassModel.findById(req.params.id);
  if (!cls) {
    return res.status(404).json({ success: false, message: 'Class not found' });
  }

  // Backfill curriculum module ids when missing.
  if (cls.details?.curriculum?.some((m) => !m.id)) {
    cls.details = ensureCurriculumIds(cls.details) as typeof cls.details;
    cls.markModified('details');
    await cls.save();
  }

  const sessions = await ClassScheduleModel.find({ classId: req.params.id }).sort({
    sessionNumber: 1,
  });

  const curriculum = cls.details?.curriculum || [];
  for (const session of sessions) {
    if (session.moduleId) continue;
    const match = curriculum.find(
      (m) => m.id && m.title.trim().toLowerCase() === String(session.title || '').trim().toLowerCase()
    );
    if (match?.id) {
      session.moduleId = match.id;
      await session.save();
    }
  }

  const canTeach = req.user!.role === 'admin' || teachesClass(cls, req.user!.id);

  return res.json({
    success: true,
    data: sessions.map((s) => {
      const view = sessionForViewer(normalizeSchedule(s), canTeach);
      // This endpoint is public to any signed-in user, so recordings stay with the class.
      return canTeach ? view : { ...view, recordingUrl: undefined };
    }),
  });
});

const isoDateTime = z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
  message: 'Invalid date/time',
});

const httpsLink = z
  .string()
  .trim()
  .max(500)
  .url('Enter a full link')
  .refine((v) => /^https:\/\//i.test(v), 'Use an https:// link');
/** Set a link, or '' / null to clear it. */
const optionalLink = z.union([httpsLink, z.literal(''), z.null()]).optional();

/** Teaching team may open the room / go live from this long before the scheduled start. */
function hostWindowError(startTime: Date) {
  const opensAt = new Date(startTime).getTime() - ENV.LIVE_CLASS_HOST_EARLY_MINUTES * 60_000;
  return Date.now() < opensAt
    ? `You can start this session from ${ENV.LIVE_CLASS_HOST_EARLY_MINUTES} minutes before its scheduled time.`
    : null;
}

const createSessionSchema = z.object({
  sessionNumber: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().optional(),
  startTime: isoDateTime,
  endTime: isoDateTime,
  /** Link to `details.curriculum[].id`. Omit for unassigned/legacy sessions. */
  moduleId: z.string().min(1).max(64).optional(),
  /** Use the instructor's own meeting room instead of creating a platform Zoom meeting. */
  meetingUrl: httpsLink.optional(),
});

router.post(
  '/:id/schedule',
  requireAuth,
  requireRole('instructor', 'admin'),
  rateLimit({ windowMs: 60_000, max: 20, keyPrefix: 'create-session' }),
  async (req: AuthRequest, res) => {
    const parsed = createSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session',
        errors: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      });
    }
    const body = parsed.data;

    const cls = await ClassModel.findById(req.params.id);
    if (!cls) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }
    if (cls.cancelledAt) {
      return res.status(409).json({ success: false, message: 'This class was cancelled; sessions cannot be added' });
    }

    const startTime = new Date(body.startTime);
    const endTime = new Date(body.endTime);
    if (endTime <= startTime) {
      return res.status(400).json({ success: false, message: 'End time must be after start time' });
    }

    const isAdmin = req.user!.role === 'admin';
    const instructorId = String(cls.instructor.id);
    const { hostIdentifier, zoomHostUserId } = await resolveInstructorZoomHost(instructorId);

    // Idempotent claim: (classId, sessionNumber) is unique, so a resubmitted request
    // for the same session number lands on the same document instead of creating a
    // second one. A brand-new session number claims a fresh placeholder document
    // before Zoom is ever called; a retry of a previously failed/pending claim
    // reuses that same document instead of inserting again.
    let session = await ClassScheduleModel.findOneAndUpdate(
      { classId: cls.id, sessionNumber: body.sessionNumber, meetingCreationStatus: { $in: ['pending', 'failed'] } },
      {
        $set: {
          meetingCreationStatus: 'creating',
          title: body.title,
          description: body.description,
          startTime,
          endTime,
          ...(body.moduleId ? { moduleId: body.moduleId } : {}),
        },
      },
      { new: true }
    );

    if (!session) {
      const existing = await ClassScheduleModel.findOne({ classId: cls.id, sessionNumber: body.sessionNumber });
      if (existing) {
        // Already created (or another request currently is) - this is a duplicate
        // submission, not a new session. Return what's there rather than creating
        // (or re-creating) a Zoom meeting for it.
        return res.status(200).json({ success: true, data: stripHostFields(normalizeSchedule(existing)), message: 'Session already exists' });
      }

      const conflict = await findSchedulingConflict({ instructorId, zoomHostUserId, startTime, endTime });
      if (conflict) {
        return res.status(409).json({
          success: false,
          message: conflict.reason === 'instructor'
            ? isAdmin
              ? `${cls.instructor.name} already has a session scheduled during this time`
              : 'You already have a session scheduled during this time'
            : 'The assigned Zoom host already has a meeting during this time',
        });
      }

      try {
        session = await ClassScheduleModel.create({
          classId: cls.id,
          sessionNumber: body.sessionNumber,
          title: body.title,
          description: body.description,
          startTime,
          endTime,
          moduleId: body.moduleId,
          zoomHostUserId,
          meetingCreationStatus: 'creating',
        });
      } catch (error: any) {
        if (error?.code === 11000) {
          const raced = await ClassScheduleModel.findOne({ classId: cls.id, sessionNumber: body.sessionNumber });
          return res.status(200).json({ success: true, data: stripHostFields(normalizeSchedule(raced)), message: 'Session already exists' });
        }
        throw error;
      }
    }

    let zoomWarning: string | undefined;
    if (body.meetingUrl) {
      session.meetingUrl = body.meetingUrl;
      session.meetingCreationStatus = 'skipped';
      await session.save();
    } else try {
      const zoom = await createZoomMeeting({
        topic: `${cls.title} - ${body.title}`,
        startTime: startTime.toISOString(),
        durationMinutes: (endTime.getTime() - startTime.getTime()) / 60000,
        hostIdentifier,
        timezone: cls.timezone || undefined,
      });

      session.zoomLink = zoom.join_url || undefined;
      session.zoomMeetingId = zoom.id ? String(zoom.id) : undefined;
      session.zoomPasscode = zoom.password;
      session.meetingCreationStatus = zoom.id ? 'ready' : 'skipped';
      await session.save();
    } catch (error) {
      session.meetingCreationStatus = 'failed';
      await session.save();
      zoomWarning = 'Session saved, but Zoom meeting could not be created. You can still teach from the classroom.';
      console.error(`Zoom meeting creation failed for session ${session.id}:`, error instanceof Error ? error.message : error);
    }

    notifyLearnersSessionChange({
      classId: cls.id,
      classTitle: cls.title,
      sessionId: session.id,
      sessionTitle: session.title,
      startTime: session.startTime,
      classTimeZone: cls.timezone,
      isUpdate: false,
    }).catch(() => {});

    // Keep class.totalSessions in sync when instructors add sessions later.
    const sessionCount = await ClassScheduleModel.countDocuments({ classId: cls.id });
    if (sessionCount > (cls.totalSessions || 0)) {
      cls.totalSessions = sessionCount;
      await cls.save();
    }

    if (isAdmin) {
      await logActivity({
        category: 'class',
        action: 'session_add',
        message: `Admin scheduled "${session.title}" for ${cls.title}`,
        actorId: req.user!.id,
        actorName: 'Admin',
        actorRole: 'admin',
        targetClassId: cls.id,
      });
    }

    return res.status(201).json({
      success: true,
      data: sessionForViewer(normalizeSchedule(session), true),
      message: zoomWarning
        || (session.meetingUrl
          ? 'Session added with your meeting link'
          : session.zoomMeetingId
          ? 'Session added with Zoom meeting'
          : 'Session added successfully'),
    });
  }
);

const updateSessionSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startTime: isoDateTime.optional(),
  endTime: isoDateTime.optional(),
  /** Instructor can reopen completed/cancelled sessions or mark complete without Zoom webhooks. */
  status: z.enum(['scheduled', 'live', 'completed', 'cancelled']).optional(),
  /** Set to attach/move; null/empty string to unassign from a module. */
  moduleId: z.union([z.string().min(1).max(64), z.literal(''), z.null()]).optional(),
  /** Instructor's own meeting room for this session (replaces the platform Zoom meeting). */
  meetingUrl: optionalLink,
  /** Where learners can rewatch the session (Zoom cloud share link, YouTube unlisted, Drive…). */
  recordingUrl: optionalLink,
});

router.patch('/:id/schedule/:sessionId', requireAuth, requireRole('instructor', 'admin'), async (req: AuthRequest, res) => {
  const session = await ClassScheduleModel.findOne({ _id: req.params.sessionId, classId: req.params.id });
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }
  const cls = await ClassModel.findById(req.params.id);
  if (!cls) {
    return res.status(404).json({ success: false, message: 'Class not found' });
  }

  const parsed = updateSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Invalid session changes',
      errors: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }

  const { startTime, endTime, moduleId, status, meetingUrl, recordingUrl, ...rest } = parsed.data;
  const prevStatus = session.status;
  const newStart = startTime ? new Date(startTime) : session.startTime;
  const newEnd = endTime ? new Date(endTime) : session.endTime;
  const timesChanged =
    Math.abs(newStart.getTime() - new Date(session.startTime).getTime()) > 1000 ||
    Math.abs(newEnd.getTime() - new Date(session.endTime).getTime()) > 1000;

  // Reschedule a completed session → must land on a future slot and reopen as scheduled.
  let nextStatus = status ?? session.status;
  if (
    (prevStatus === 'completed' || prevStatus === 'cancelled') &&
    timesChanged &&
    newStart.getTime() > Date.now() &&
    (status === undefined || status === 'scheduled' || status === prevStatus)
  ) {
    nextStatus = 'scheduled';
  }

  if (newEnd <= newStart) {
    return res.status(400).json({ success: false, message: 'End time must be after start time' });
  }

  if (cls.cancelledAt && nextStatus !== 'cancelled' && (timesChanged || nextStatus !== prevStatus)) {
    return res.status(409).json({ success: false, message: 'This class was cancelled; its sessions cannot be rescheduled' });
  }

  const statusError =
    validateSessionStatusChange({
      from: prevStatus,
      to: nextStatus,
      startTime: newStart,
    }) || (nextStatus === 'live' && prevStatus !== 'live' ? hostWindowError(newStart) : null);
  if (statusError) {
    return res.status(400).json({ success: false, message: statusError });
  }

  if (meetingUrl !== undefined) session.meetingUrl = meetingUrl || undefined;
  if (recordingUrl !== undefined) session.recordingUrl = recordingUrl || undefined;

  if (moduleId !== undefined) {
    if (moduleId === '' || moduleId === null) {
      session.moduleId = undefined;
    } else {
      session.moduleId = moduleId;
    }
  }

  let zoomSynced = true;
  let zoomCreated = false;

  if (timesChanged) {
    const conflict = await findSchedulingConflict({
      instructorId: String(cls.instructor.id),
      zoomHostUserId: session.zoomHostUserId || 'shared:me',
      startTime: newStart,
      endTime: newEnd,
      excludeSessionId: String(session._id),
    });
    if (conflict) {
      return res.status(409).json({
        success: false,
        message: conflict.reason === 'instructor'
          ? req.user!.role === 'admin'
            ? `${cls.instructor.name} already has a session scheduled during this time`
            : 'You already have a session scheduled during this time'
          : 'The assigned Zoom host already has a meeting during this time',
      });
    }

    if (session.zoomMeetingId) {
      try {
        await updateZoomMeeting(session.zoomMeetingId, {
          startTime: newStart.toISOString(),
          durationMinutes: (newEnd.getTime() - newStart.getTime()) / 60000,
          timezone: cls.timezone || undefined,
        });
      } catch (error) {
        zoomSynced = false;
        console.error(
          `Failed to sync reschedule to Zoom meeting ${session.zoomMeetingId}:`,
          error instanceof Error ? error.message : error
        );
      }
    }
  }

  // Create Zoom meeting when reopening/scheduling without one (so classroom host works).
  if (
    !session.meetingUrl &&
    !session.zoomMeetingId &&
    nextStatus === 'scheduled' &&
    newStart.getTime() > Date.now()
  ) {
    try {
      const { hostIdentifier, zoomHostUserId } = await resolveInstructorZoomHost(String(cls.instructor.id));
      const zoom = await createZoomMeeting({
        topic: `${cls.title} - ${parsed.data.title || session.title}`,
        startTime: newStart.toISOString(),
        durationMinutes: (newEnd.getTime() - newStart.getTime()) / 60000,
        hostIdentifier,
        timezone: cls.timezone || undefined,
      });
      if (zoom.id) {
        session.zoomLink = zoom.join_url || undefined;
        session.zoomMeetingId = String(zoom.id);
        session.zoomPasscode = zoom.password;
        session.zoomHostUserId = zoomHostUserId;
        session.meetingCreationStatus = 'ready';
        zoomCreated = true;
      } else {
        session.meetingCreationStatus = 'skipped';
      }
    } catch (error) {
      session.meetingCreationStatus = 'failed';
      console.error('Failed to create Zoom meeting on session update:', error instanceof Error ? error.message : error);
    }
  }

  Object.assign(session, rest);
  if (newStart.getTime() !== new Date(session.startTime).getTime()) session.remindersSent = undefined;
  session.startTime = newStart;
  session.endTime = newEnd;
  session.status = nextStatus as typeof session.status;
  await session.save();

  const justCancelled = nextStatus === 'cancelled' && prevStatus !== 'cancelled';
  if (justCancelled && session.zoomMeetingId) {
    if (await deleteZoomMeeting(session.zoomMeetingId)) {
      session.zoomMeetingId = undefined;
      session.zoomLink = undefined;
      session.zoomPasscode = undefined;
      session.meetingCreationStatus = 'pending';
      await session.save();
    }
  }
  if (nextStatus === 'live' && prevStatus !== 'live') {
    notifyClassSessionStarted({ classId: cls.id, classTitle: cls.title, sessionId: session.id, sessionTitle: session.title }).catch(() => {});
  }
  if (justCancelled) {
    const when = formatWhen(session.startTime, pickTimeZone(cls.timezone));
    notifyLearnersClassUpdate({
      classId: cls.id,
      classTitle: cls.title,
      title: 'Session cancelled',
      message: `"${session.title}" (${when}) in ${cls.title} was cancelled.`,
    }).catch(() => {});
  } else if (timesChanged) {
    notifyLearnersSessionChange({
      classId: cls.id,
      classTitle: cls.title,
      sessionId: session.id,
      sessionTitle: session.title,
      startTime: session.startTime,
      classTimeZone: cls.timezone,
      isUpdate: true,
    }).catch(() => {});
  }

  if (req.user!.role === 'admin' && (justCancelled || timesChanged)) {
    await logActivity({
      category: 'class',
      action: justCancelled ? 'session_cancel' : 'session_reschedule',
      message: justCancelled
        ? `Admin cancelled session "${session.title}" of ${cls.title}`
        : `Admin rescheduled session "${session.title}" of ${cls.title} to ${newStart.toISOString()}`,
      actorId: req.user!.id,
      actorName: 'Admin',
      actorRole: 'admin',
      targetClassId: cls.id,
    });
  }

  const message =
    nextStatus !== prevStatus && !timesChanged
      ? `Session marked ${nextStatus === 'live' ? 'in progress' : nextStatus}`
      : zoomCreated
        ? 'Session updated and Zoom meeting created'
        : !timesChanged
          ? 'Session updated successfully'
          : zoomSynced
            ? 'Session rescheduled successfully'
            : 'Session rescheduled in Nexnoon. Zoom could not be updated automatically; please contact support if this repeats.';

  return res.json({ success: true, data: sessionForViewer(normalizeSchedule(session), true), message });
});

/**
 * Instructor starting a session, called the moment they click "Start Class as
 * Host". Flips status to 'live' synchronously so every enrolled student's join
 * gate opens immediately (see evaluateJoinWindow/ZoomMeetingComponent) instead
 * of waiting on the meeting.started webhook - which never fires at all when
 * Zoom isn't configured (demo/static-link mode) and is otherwise async/delayed.
 * Idempotent: starting an already-live session just re-confirms it without
 * re-notifying students.
 */
router.post('/:id/schedule/:sessionId/start', requireAuth, requireRole('instructor', 'admin'), async (req, res) => {
  const session = await ClassScheduleModel.findOne({ _id: req.params.sessionId, classId: req.params.id });
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }
  if (session.status === 'completed' || session.status === 'cancelled') {
    return res.status(409).json({ success: false, message: `Session is ${session.status}` });
  }
  const tooEarly = session.status === 'live' ? null : hostWindowError(session.startTime);
  if (tooEarly) return res.status(409).json({ success: false, message: tooEarly });

  const wasAlreadyLive = session.status === 'live';
  session.status = 'live';
  await session.save();

  if (!wasAlreadyLive) {
    const cls = await ClassModel.findById(req.params.id);
    if (cls) {
      await notifyClassSessionStarted({
        classId: req.params.id,
        classTitle: cls.title,
        sessionId: session.id,
        sessionTitle: session.title,
      });
    }
  }

  return res.json({ success: true, data: sessionForViewer(normalizeSchedule(session), true), message: 'Class started' });
});

/**
 * Manual fallback for finalizing a session: the meeting.ended webhook already
 * does this automatically the moment Zoom reports the meeting stopped, but an
 * instructor who ended the meeting some other way (or whose Zoom account isn't
 * webhook-subscribed) needs a way to close it out themselves so it doesn't sit
 * at "live"/"scheduled" forever and keep blocking a real completed state.
 */
router.post('/:id/schedule/:sessionId/complete', requireAuth, requireRole('instructor', 'admin'), async (req, res) => {
  const session = await ClassScheduleModel.findOne({ _id: req.params.sessionId, classId: req.params.id });
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }
  if (session.status === 'completed' || session.status === 'cancelled') {
    return res.status(409).json({ success: false, message: `Session is already ${session.status}` });
  }

  const statusError = validateSessionStatusChange({
    from: session.status,
    to: 'completed',
    startTime: session.startTime,
  });
  if (statusError) {
    return res.status(400).json({ success: false, message: statusError });
  }

  session.status = 'completed';
  await session.save();

  return res.json({ success: true, data: sessionForViewer(normalizeSchedule(session), true), message: 'Session marked complete' });
});

router.delete('/:id/schedule/:sessionId', requireAuth, requireRole('instructor', 'admin'), async (req, res) => {
  const session = await ClassScheduleModel.findOne({ _id: req.params.sessionId, classId: req.params.id });
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }
  if (session.status === 'live' || session.status === 'completed') {
    return res.status(409).json({ success: false, message: 'Sessions that have been taught are part of the class record and can’t be deleted.' });
  }
  if (await AttendanceRecordModel.exists({ sessionId: session._id })) {
    return res.status(409).json({ success: false, message: 'Learners already joined this session. Cancel it instead so their attendance is kept.' });
  }
  await deleteZoomMeeting(session.zoomMeetingId);
  await session.deleteOne();

  const cls = await ClassModel.findById(req.params.id).select('title timezone');
  if (cls && session.status === 'scheduled' && new Date(session.startTime).getTime() > Date.now()) {
    notifyLearnersClassUpdate({
      classId: cls.id,
      classTitle: cls.title,
      title: 'Session removed',
      message: `"${session.title}" (${formatWhen(session.startTime, pickTimeZone(cls.timezone))}) was removed from ${cls.title}.`,
    }).catch(() => {});
  }
  return res.json({ success: true, data: null });
});

router.get('/:id/enrollments', requireAuth, requireRole('instructor', 'admin'), async (req: AuthRequest, res) => {
  const cls = await ClassModel.findById(req.params.id);
  if (!cls || (req.user!.role !== 'admin' && String(cls.instructor.id) !== req.user!.id)) return res.status(403).json({ success: false, message: 'Forbidden' });
  const parsed = listParamsSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Invalid query params' });
  }
  const { page = 1, pageSize = 10 } = parsed.data;

  const query = { classId: req.params.id };

  const [items, totalItems] = await Promise.all([
    EnrollmentModel.find(query)
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    EnrollmentModel.countDocuments(query),
  ]);

  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  return res.json({
    success: true,
    data: {
      data: items.map(normalizeClass),
      pagination: {
        page,
        pageSize,
        totalPages,
        totalItems,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    },
  });
});

router.get('/:id/reviews', async (req, res) => {
  const parsed = listParamsSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Invalid query params' });
  }
  const { page = 1, pageSize = 10 } = parsed.data;

  const query = { classId: req.params.id, status: { $ne: 'hidden' } };

  const [items, totalItems] = await Promise.all([
    ReviewModel.find(query)
      .select('-moderationNote -moderatedBy')
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    ReviewModel.countDocuments(query),
  ]);

  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  return res.json({
    success: true,
    data: {
      data: items.map(normalizeClass),
      pagination: {
        page,
        pageSize,
        totalPages,
        totalItems,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    },
  });
});

export default router;


