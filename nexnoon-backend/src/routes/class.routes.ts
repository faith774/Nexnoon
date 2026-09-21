import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import multer from 'multer';
import { User } from '../models/User';
import { z } from 'zod';
import { ClassModel, ClassScheduleModel } from '../models/Class';
import { EnrollmentModel } from '../models/Enrollment';
import { AssignmentSubmissionModel } from '../models/AssignmentSubmission';
import { ReviewModel } from '../models/Review';
import { AttendanceRecordModel } from '../models/AttendanceRecord';
import { requireAuth, requireRole, requireApprovedInstructor, AuthRequest } from '../middleware/auth';
import { createZoomMeeting, updateZoomMeeting, generateZoomMeetingSDKSignature, getZoomMeetingStartUrl } from '../utils/zoom';
import { evaluateJoinWindow, sessionsOverlap } from '../config/liveClassPolicy';
import { notifyClassSessionStarted } from '../utils/notify';
import { uploadClassFile } from '../utils/cloudinary';
import { rateLimit } from '../middleware/rateLimit';
import { ENV } from '../config/env';
import { getMaxClassSeats } from '../models/PlatformSettings';

const router = Router();

/** Course materials/assignment attachments: common office/doc/media types, capped at 25MB. */
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
  limits: { fileSize: 25 * 1024 * 1024 },
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
  return { ...rest, id: id || _id };
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
 * Resolves which Zoom user an instructor's meetings should be created under.
 * Prefers an explicit instructor -> Zoom user mapping; falls back to the shared
 * Server-to-Server OAuth app identity ("me") only for backward compatibility with
 * accounts that predate per-instructor mapping. `zoomHostUserId` is what
 * conflict-detection groups by, so it's always populated even on the fallback path.
 */
async function resolveInstructorZoomHost(instructorId: string): Promise<{ hostIdentifier?: string; zoomHostUserId: string }> {
  const instructor = await User.findById(instructorId);
  if (instructor?.zoomHostEnabled && (instructor.zoomUserId || instructor.zoomEmail)) {
    const identifier = instructor.zoomUserId || instructor.zoomEmail!;
    return { hostIdentifier: identifier, zoomHostUserId: identifier };
  }
  // Documented fallback for pre-existing data: the shared platform Zoom user.
  return { hostIdentifier: undefined, zoomHostUserId: 'shared:me' };
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
    status: { $ne: 'cancelled' },
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  };
  if (excludeSessionId) baseQuery._id = { $ne: excludeSessionId };

  const [instructorConflict, hostConflict] = await Promise.all([
    ClassScheduleModel.findOne({ ...baseQuery, classId: { $in: candidateClassIds } }),
    ClassScheduleModel.findOne({ ...baseQuery, zoomHostUserId }),
  ]);

  if (instructorConflict) return { reason: 'instructor' };
  if (hostConflict) return { reason: 'zoom_host' };
  return null;
}

/**
 * Marks a session as attended for a student's enrollment and recomputes progress.
 * Best-effort: attendance is inferred from successfully requesting join credentials
 * (there's no Zoom webhook wired up to confirm actual in-meeting presence), so this
 * must never block the join response if it fails.
 */
async function recordSessionAttendance(enrollmentId: string, classId: string, sessionId: string) {
  try {
    await EnrollmentModel.updateOne(
      { _id: enrollmentId },
      { $addToSet: { attendedSessions: sessionId } }
    );

    const [enrollment, totalSessions] = await Promise.all([
      EnrollmentModel.findById(enrollmentId),
      ClassScheduleModel.countDocuments({ classId, status: { $ne: 'cancelled' } }),
    ]);
    if (!enrollment || totalSessions === 0) return;

    const attended = enrollment.attendedSessions.length;
    const progress = Math.min(100, Math.round((attended / totalSessions) * 100));

    enrollment.progress = progress;
    if (attended >= totalSessions && enrollment.status === 'active') {
      enrollment.status = 'completed';
      enrollment.completedAt = new Date();
    }
    await enrollment.save();
  } catch (error) {
    console.error('Failed to record session attendance:', error);
  }
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
    curriculum: z.array(z.object({ title: z.string().max(500), topics: z.array(z.string().max(2000)).max(100), project: z.string().max(5000) })).max(100).optional(),
    faqs: z.array(z.object({ question: z.string().max(1000), answer: z.string().max(5000) })).max(100).optional(),
  }).optional(),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  level: z.enum(['Beginner', 'Intermediate', 'Advanced']),
  price: z.number().min(0),
  thumbnail: z.string().max(4000000).optional(),
  language: z.string().optional(),
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

  const query: any = { status: 'published' };
  if (search) {
    query.title = { $regex: search, $options: 'i' };
  }

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

router.get('/search', async (req, res) => {
  const q = (req.query.q as string) || '';
  const parsed = listParamsSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Invalid query params' });
  }
  const { page = 1, pageSize = 10 } = parsed.data;

  const query: any = { status: 'published' };
  if (q) {
    query.title = { $regex: q, $options: 'i' };
  }

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

router.get('/category/:category', async (req, res) => {
  const parsed = listParamsSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Invalid query params' });
  }
  const { page = 1, pageSize = 10 } = parsed.data;

  const categoryNames: Record<string, string[]> = { 'health-wellness': ['Health & Wellness', 'Health & Fitness'], languages: ['Languages', 'Language', 'Language Learning'] };
  const names = categoryNames[req.params.category.toLowerCase()] || [req.params.category.replace(/-/g, ' ')];
  const query: any = { status: 'published', category: { $in: names.map(name => new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i')) } };

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

router.get('/my', requireAuth, requireRole('instructor', 'admin'), async (req: AuthRequest, res) => {
  const parsed = listParamsSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Invalid query params' });
  }
  const { page = 1, pageSize = 10 } = parsed.data;

  const query: any = { 'instructor.id': req.user!.id };

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
  if (cls.status !== 'published' && req.user?.role !== 'admin' && String(cls.instructor.id) !== req.user?.id) return res.status(404).json({ success: false, message: 'Class not found' });
  const sessions = await ClassScheduleModel.find({ classId: cls.id })
    .sort({ sessionNumber: 1 })
    .lean();
  const schedule = sessions.map((s: any) => { const { zoomLink, zoomMeetingId, zoomPasscode, recordingUrl, zoomHostUserId, meetingCreationStatus, ...publicSession } = normalizeSchedule(s); return publicSession; });
  const data = { ...normalizeClass(cls), schedule };
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

  const data = parsed.data;
  const instructor = await User.findById(req.user!.id);
  if (!instructor) return res.status(401).json({ success: false, message: 'Account not found' });

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

    const { zoomHostUserId } = await resolveInstructorZoomHost(req.user!.id);
    for (const s of data.schedule) {
      const conflict = await findSchedulingConflict({
        instructorId: req.user!.id,
        zoomHostUserId,
        startTime: new Date(s.startTime),
        endTime: new Date(s.endTime),
      });
      if (conflict) {
        return res.status(409).json({
          success: false,
          message: conflict.reason === 'instructor'
            ? `You already have a session scheduled during "${s.title}"'s time`
            : `Your assigned Zoom host already has a meeting during "${s.title}"'s time`,
        });
      }
    }
  }

  const cls = await ClassModel.create({
    ...data,
    // Capacity is platform-wide (admin setting), not per-class instructor input.
    maxStudents: maxClassSeats,
    currency: 'USD',
    instructor: {
      id: req.user!.id,
      name: instructor.fullName,
      avatar: instructor.avatar,
    },
    status: data.status || 'published',
  });

  if (data.schedule?.length) {
    const { hostIdentifier, zoomHostUserId } = await resolveInstructorZoomHost(req.user!.id);
    const scheduleDocs = await Promise.all(
      data.schedule.map(async (s) => {
        try {
          const zoom = await createZoomMeeting({
            topic: `${cls.title} - ${s.title}`,
            startTime: s.startTime,
            durationMinutes: (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000,
            hostIdentifier,
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

  return res.status(201).json({
    success: true,
    data: normalizeClass(cls),
    message: 'Class created successfully',
  });
});

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

    const isInstructor = req.user!.role === 'instructor' && String(cls.instructor.id) === req.user!.id;
    const isAdmin = req.user!.role === 'admin';

    // 5. Active enrollment (instructor/admin skip this - they're not "enrolled")
    let enrollment: InstanceType<typeof EnrollmentModel> | null = null;
    if (!isInstructor && !isAdmin) {
      enrollment = await EnrollmentModel.findOne({ classId: req.params.classId, userId: req.user!.id });
      if (!enrollment || enrollment.status !== 'active') {
        return res.status(403).json({ success: false, message: 'Not enrolled in this class' });
      }
    }

    // 6-8. Not cancelled/ended/completed, within the join window, meeting exists
    const decision = evaluateJoinWindow(
      {
        status: session.status,
        startTime: session.startTime,
        endTime: session.endTime,
        hasZoomMeeting: !!session.zoomMeetingId,
      },
      new Date()
    );
    if (!decision.allowed) {
      return res.status(decision.httpStatus).json({ success: false, message: decision.message });
    }

    // 9. Meeting SDK configuration available
    if (!ENV.ZOOM_MEETING_SDK_CLIENT_ID || !ENV.ZOOM_MEETING_SDK_CLIENT_SECRET) {
      return res.status(503).json({ success: false, message: 'Zoom Meeting SDK not configured' });
    }

    try {
      // Participant role only (0) for every joiner, instructor/admin included -
      // instructors host through Zoom's native start-URL flow (see /host-access),
      // never through an embedded host role in this SDK join.
      const signature = generateZoomMeetingSDKSignature({ meetingNumber: session.zoomMeetingId! });

      const user = await User.findById(req.user!.id);

      if (enrollment) {
        const late = decision.code === 'late_joinable';
        await AttendanceRecordModel.updateOne(
          { sessionId: session.id, userId: req.user!.id },
          { $setOnInsert: { classId: cls.id, enrollmentId: enrollment.id, authorizedAt: new Date(), late } },
          { upsert: true }
        ).catch((error) => console.error('Failed to record join authorization:', error instanceof Error ? error.message : error));
        await recordSessionAttendance(enrollment.id, req.params.classId, session.id);
      }

      return res.json({
        success: true,
        data: {
          signature,
          meetingNumber: session.zoomMeetingId,
          passWord: session.zoomPasscode || undefined,
          userName: user?.fullName || 'Student',
          userEmail: user?.email,
        },
      });
    } catch (error) {
      return res.status(503).json({ success: false, message: 'Failed to generate meeting credentials' });
    }
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

    const isOwner = req.user!.role === 'instructor' && String(cls.instructor.id) === req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'You are not the assigned instructor for this class' });
    }

    const session = await ClassScheduleModel.findOne({ _id: req.params.sessionId, classId: req.params.classId });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    if (session.status === 'cancelled' || session.status === 'completed') {
      return res.status(409).json({ success: false, message: `Session is ${session.status}` });
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

    return res.json({ success: true, data: { startUrl } });
  }
);

/**
 * Student-only: submits (or resubmits, overwriting in place) an answer to one of
 * the class's embedded `assignments` entries - a written answer, an attached
 * file, or both. Registered ahead of the instructor-only `/:id` ownership gate
 * below since this is a student action, not an instructor one.
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
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({ success: true, data: normalizeSubmission(submission), message: 'Assignment submitted' });
  }
);

router.use('/:id', async (req: AuthRequest, res, next) => {
  if (req.method === 'GET') return next();
  return requireAuth(req, res, async () => {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid class ID' });
    try {
      const cls = await ClassModel.findById(req.params.id);
      if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });
      if (req.user!.role !== 'admin' && String(cls.instructor.id) !== req.user!.id) {
        return res.status(403).json({ success: false, message: 'You can only change your own classes' });
      }
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
  const { maxStudents: _ignoredMaxStudents, ...classUpdates } = parsed.data;
  Object.assign(cls, classUpdates);
  cls.maxStudents = await getMaxClassSeats();
  await cls.save();

  return res.json({
    success: true,
    data: normalizeClass(cls),
    message: 'Class updated successfully',
  });
});

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

router.delete('/:id', requireAuth, requireRole('instructor', 'admin'), async (req, res) => {
  const cls = await ClassModel.findById(req.params.id);
  if (!cls) {
    return res.status(404).json({ success: false, message: 'Class not found' });
  }

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

router.get('/:id/schedule', async (req, res) => {
  const sessions = await ClassScheduleModel.find({ classId: req.params.id }).sort({
    sessionNumber: 1,
  });
  return res.json({ success: true, data: sessions.map(s => { const { zoomLink, zoomMeetingId, zoomPasscode, recordingUrl, zoomHostUserId, meetingCreationStatus, ...publicSession } = normalizeSchedule(s); return publicSession; }) });
});

const createSessionSchema = z.object({
  sessionNumber: z.number(),
  title: z.string().min(1),
  description: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
});

router.post(
  '/:id/schedule',
  requireAuth,
  requireRole('instructor'),
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

    const startTime = new Date(body.startTime);
    const endTime = new Date(body.endTime);
    if (endTime <= startTime) {
      return res.status(400).json({ success: false, message: 'End time must be after start time' });
    }

    const instructorId = String(cls.instructor.id);
    const { hostIdentifier, zoomHostUserId } = await resolveInstructorZoomHost(instructorId);

    // Idempotent claim: (classId, sessionNumber) is unique, so a resubmitted request
    // for the same session number lands on the same document instead of creating a
    // second one. A brand-new session number claims a fresh placeholder document
    // before Zoom is ever called; a retry of a previously failed/pending claim
    // reuses that same document instead of inserting again.
    let session = await ClassScheduleModel.findOneAndUpdate(
      { classId: cls.id, sessionNumber: body.sessionNumber, meetingCreationStatus: { $in: ['pending', 'failed'] } },
      { $set: { meetingCreationStatus: 'creating', title: body.title, description: body.description, startTime, endTime } },
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
            ? 'You already have a session scheduled during this time'
            : 'Your assigned Zoom host already has a meeting during this time',
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

    try {
      const zoom = await createZoomMeeting({
        topic: `${cls.title} - ${body.title}`,
        startTime: body.startTime,
        durationMinutes: (endTime.getTime() - startTime.getTime()) / 60000,
        hostIdentifier,
      });

      session.zoomLink = zoom.join_url || undefined;
      session.zoomMeetingId = zoom.id ? String(zoom.id) : undefined;
      session.zoomPasscode = zoom.password;
      // zoomStartUrl is intentionally not persisted here either - see the
      // deprecation note on the schema field and the host-access route.
      session.meetingCreationStatus = zoom.id ? 'ready' : 'skipped';
      await session.save();
    } catch (error) {
      session.meetingCreationStatus = 'failed';
      await session.save();
      console.error(`Zoom meeting creation failed for session ${session.id}:`, error instanceof Error ? error.message : error);
      return res.status(503).json({ success: false, message: 'Could not set up the Zoom meeting for this session. It has been saved and can be retried.' });
    }

    return res.status(201).json({ success: true, data: stripHostFields(normalizeSchedule(session)) });
  }
);

const updateSessionSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
});

router.patch('/:id/schedule/:sessionId', requireAuth, requireRole('instructor'), async (req: AuthRequest, res) => {
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

  const { startTime, endTime } = parsed.data;
  const isRescheduling = startTime !== undefined || endTime !== undefined;
  let zoomSynced = true;

  if (isRescheduling) {
    const newStart = startTime ? new Date(startTime) : session.startTime;
    const newEnd = endTime ? new Date(endTime) : session.endTime;
    if (newEnd <= newStart) {
      return res.status(400).json({ success: false, message: 'End time must be after start time' });
    }

    const conflict = await findSchedulingConflict({
      instructorId: String(cls.instructor.id),
      zoomHostUserId: session.zoomHostUserId || 'shared:me',
      startTime: newStart,
      endTime: newEnd,
      excludeSessionId: session.id,
    });
    if (conflict) {
      return res.status(409).json({
        success: false,
        message: conflict.reason === 'instructor'
          ? 'You already have a session scheduled during this time'
          : 'Your assigned Zoom host already has a meeting during this time',
      });
    }

    if (session.zoomMeetingId) {
      try {
        await updateZoomMeeting(session.zoomMeetingId, {
          startTime: newStart.toISOString(),
          durationMinutes: (newEnd.getTime() - newStart.getTime()) / 60000,
        });
      } catch (error) {
        // Our own join-window check reads startTime/endTime from this document
        // directly, not from Zoom's copy, so joining still works correctly even
        // if Zoom's own record (calendar invite, meeting list) is now out of sync.
        // Don't block the reschedule over a cosmetic mismatch.
        zoomSynced = false;
        console.error(`Failed to sync reschedule to Zoom meeting ${session.zoomMeetingId}:`, error instanceof Error ? error.message : error);
      }
    }
  }

  Object.assign(session, parsed.data);
  await session.save();

  const message = !isRescheduling
    ? 'Session updated successfully'
    : zoomSynced
      ? 'Session rescheduled successfully'
      : 'Session rescheduled in Nexnoon. Zoom could not be updated automatically; please contact support if this repeats.';

  return res.json({ success: true, data: stripHostFields(normalizeSchedule(session)), message });
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
router.post('/:id/schedule/:sessionId/start', requireAuth, requireRole('instructor'), async (req, res) => {
  const session = await ClassScheduleModel.findOne({ _id: req.params.sessionId, classId: req.params.id });
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }
  if (session.status === 'completed' || session.status === 'cancelled') {
    return res.status(409).json({ success: false, message: `Session is ${session.status}` });
  }

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

  return res.json({ success: true, data: stripHostFields(normalizeSchedule(session)), message: 'Class started' });
});

/**
 * Manual fallback for finalizing a session: the meeting.ended webhook already
 * does this automatically the moment Zoom reports the meeting stopped, but an
 * instructor who ended the meeting some other way (or whose Zoom account isn't
 * webhook-subscribed) needs a way to close it out themselves so it doesn't sit
 * at "live"/"scheduled" forever and keep blocking a real completed state.
 */
router.post('/:id/schedule/:sessionId/complete', requireAuth, requireRole('instructor'), async (req, res) => {
  const session = await ClassScheduleModel.findOne({ _id: req.params.sessionId, classId: req.params.id });
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }
  if (session.status === 'completed' || session.status === 'cancelled') {
    return res.status(409).json({ success: false, message: `Session is already ${session.status}` });
  }

  session.status = 'completed';
  await session.save();

  return res.json({ success: true, data: stripHostFields(normalizeSchedule(session)), message: 'Session marked complete' });
});

router.delete('/:id/schedule/:sessionId', requireAuth, requireRole('instructor'), async (req, res) => {
  const session = await ClassScheduleModel.findOne({ _id: req.params.sessionId, classId: req.params.id });
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }
  await session.deleteOne();
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

  const query = { classId: req.params.id };

  const [items, totalItems] = await Promise.all([
    ReviewModel.find(query)
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


