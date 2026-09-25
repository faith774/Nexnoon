import { Router } from 'express';
import { refundPayment, releaseSeat } from '../utils/seats';
import { formatWhen, pickTimeZone } from '../utils/time';
import { isValidObjectId, Types } from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { User, LifecycleStage } from '../models/User';
import { ClassModel, ClassScheduleModel } from '../models/Class';
import { CourseModel } from '../models/Course';
import { EnrollmentModel } from '../models/Enrollment';
import { PaymentModel } from '../models/Payment';
import { ReviewModel } from '../models/Review';
import { AttendanceRecordModel } from '../models/AttendanceRecord';
import { IncidentModel, INCIDENT_TYPES } from '../models/Incident';
import { NotificationModel } from '../models/Notification';
import { logActivity } from '../models/ActivityLog';
import { getPlatformSettings } from '../models/PlatformSettings';
import { isCertActive, lifecycleStageOf, syncApprovedCourseIds } from '../utils/certification';
import { attendanceStateOf, classDeliveryStats, isHeldSession } from '../utils/quality';
import { recomputeClassRating } from '../utils/reviews';
import { buildAttendanceMatrix, markAttendance, markAttendanceSchema } from '../utils/attendance';
import { buildClassUpdateEmail, buildInstructorDecisionEmail, sendEmailSafe } from '../utils/email';
import { EarningModel } from '../models/Earning';
import { PayoutModel } from '../models/Payout';
import { balancesFor, syncEarnings } from '../utils/earnings';
import { connectSnapshot, getStripe, round2, toMinorUnits } from '../utils/stripe';
import { lookupZoomUser } from '../utils/zoom';
import { rehostInstructorMeetings } from '../utils/zoomHosts';

const router = Router();
router.use(requireAuth, requireRole('admin'));

const DAY = 86_400_000;
const addDays = (d: Date, days: number) => new Date(d.getTime() + days * DAY);

async function notifyInstructor(user: { _id: any; email: string; fullName: string }, title: string, message: string, actionUrl = '/instructor/dashboard', email = true) {
  await NotificationModel.create({ userId: user._id, type: 'system', title, message, read: false, actionUrl }).catch(() => {});
  if (email) {
    await sendEmailSafe(user.email, title, buildClassUpdateEmail({ learnerName: user.fullName, heading: title, body: message, actionUrl }));
  }
}

/** Classes this instructor leads that still have sessions ahead — they need a new lead after removal. */
async function upcomingLedClasses(userId: string, filter: Record<string, unknown> = {}) {
  const classes = await ClassModel.find({ 'instructor.id': userId, cancelledAt: { $exists: false }, ...filter }).select('_id title');
  if (!classes.length) return [];
  const withUpcoming = await ClassScheduleModel.distinct('classId', {
    classId: { $in: classes.map((c) => c._id) },
    status: 'scheduled',
    startTime: { $gt: new Date() },
  });
  const ids = new Set(withUpcoming.map(String));
  return classes.filter((c) => ids.has(String(c._id))).map((c) => ({ id: String(c._id), title: c.title }));
}

/* ------------------------------------------------------------------ */
/* Zoom host mapping                                                   */
/* ------------------------------------------------------------------ */

const zoomHostSchema = z.object({
  zoomEmail: z.union([z.string().trim().toLowerCase().email().max(200), z.literal('')]),
  zoomHostEnabled: z.boolean(),
});

/**
 * Maps an instructor to their own Zoom user so their meetings are hosted under it (and can run at the same time as
 * other instructors' classes). Without a mapping everything runs on the shared platform Zoom user.
 */
router.patch('/instructors/:id/zoom-host', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid instructor ID' });
  const parsed = zoomHostSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Enter a valid Zoom email' });
  const { zoomEmail, zoomHostEnabled } = parsed.data;
  if (zoomHostEnabled && !zoomEmail) {
    return res.status(400).json({ success: false, message: 'Add the instructor’s Zoom email before turning this on' });
  }
  const user = await User.findOne({ _id: req.params.id, role: 'instructor' });
  if (!user) return res.status(404).json({ success: false, message: 'Instructor not found' });

  let zoomUserId: string | undefined;
  let warning: string | undefined;
  if (zoomEmail && zoomHostEnabled) {
    try {
      const found = await lookupZoomUser(zoomEmail);
      if (found === null) {
        return res.status(400).json({ success: false, message: 'That email isn’t a user in the Nexnoon Zoom account. Invite them in Zoom first.' });
      }
      if (found) {
        zoomUserId = found.id;
        if (!found.licensed) warning = 'This Zoom user is on a Basic (free) seat, so meetings are limited to 40 minutes.';
      } else {
        warning = 'Zoom isn’t configured, so the email couldn’t be checked.';
      }
    } catch {
      return res.status(502).json({ success: false, message: 'Couldn’t reach Zoom to check this user. Try again shortly.' });
    }
  }

  user.zoomEmail = zoomEmail || undefined;
  user.zoomUserId = zoomUserId;
  user.zoomHostEnabled = zoomHostEnabled;
  await user.save();

  const rehost = await rehostInstructorMeetings(user.id);

  await logActivity({
    category: 'instructor',
    action: 'zoom_host',
    message: zoomHostEnabled
      ? `Admin set ${user.fullName}'s Zoom host to ${zoomEmail}`
      : `Admin switched ${user.fullName} to the shared Zoom host`,
    actorId: req.user!.id,
    actorName: 'Admin',
    actorRole: 'admin',
    targetUserId: user.id,
  });

  return res.json({
    success: true,
    data: { zoomEmail: user.zoomEmail || '', zoomHostEnabled: user.zoomHostEnabled },
    message: [
      zoomHostEnabled ? 'Meetings will be hosted under this Zoom user.' : 'Meetings will use the shared Zoom host.',
      rehost.moved ? `${rehost.moved} upcoming meeting${rehost.moved === 1 ? '' : 's'} moved.` : '',
      rehost.failed ? `${rehost.failed} couldn’t be moved and keep their current host.` : '',
      warning,
    ]
      .filter(Boolean)
      .join(' '),
  });
});

/* ------------------------------------------------------------------ */
/* Instructor lifecycle (PRD §7)                                       */
/* ------------------------------------------------------------------ */

const LIFECYCLE_ACTIONS = [
  'start_review',
  'schedule_interview',
  'interview_pass',
  'interview_fail',
  'complete_training',
  'certify',
  'renew',
  'improve',
  'complete_improvement',
  'suspend',
  'reinstate',
  'remove',
] as const;

const lifecycleSchema = z.object({
  action: z.enum(LIFECYCLE_ACTIONS),
  note: z.string().trim().max(3000).optional(),
  date: z.string().datetime().optional(),
});

const NOTE_REQUIRED = new Set(['interview_fail', 'improve', 'suspend', 'remove']);

router.post('/instructors/:id/lifecycle', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid instructor ID' });
  const parsed = lifecycleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid lifecycle action' });
  const { action, note, date } = parsed.data;
  if (NOTE_REQUIRED.has(action) && !note) {
    return res.status(400).json({ success: false, message: 'Add a note explaining this decision' });
  }

  const user = await User.findById(req.params.id);
  if (!user || user.role !== 'instructor') return res.status(404).json({ success: false, message: 'Instructor not found' });

  const stage = lifecycleStageOf(user)!;
  const status = user.instructorStatus;
  const lc = (user.lifecycle ||= { history: [] } as any)!;
  lc.history ||= [];
  const now = new Date();
  const fail = (message: string) => res.status(409).json({ success: false, message });
  const preApproval = status === 'pending';
  let nextStage: LifecycleStage = stage;
  let notice: { title: string; message: string } | null = null;
  let warning: string | undefined;

  switch (action) {
    case 'start_review':
      if (!preApproval) return fail('Only pending applications can be reviewed');
      nextStage = 'review';
      break;
    case 'schedule_interview':
      if (!preApproval) return fail('Only pending applicants can be interviewed');
      if (!date) return fail('Pick the interview date and time');
      lc.interview = { ...(lc.interview || {}), scheduledAt: new Date(date), result: undefined, decidedAt: undefined };
      nextStage = 'interview';
      notice = {
        title: 'Interview scheduled',
        message: `Your Nexnoon teaching interview is scheduled for ${formatWhen(date, pickTimeZone(user.timezone))}.${note ? `\n\n${note}` : ''}`,
      };
      break;
    case 'interview_pass':
      if (!preApproval) return fail('Only pending applicants can pass an interview');
      lc.interview = { ...(lc.interview || {}), result: 'pass', notes: note, decidedAt: now };
      nextStage = 'training';
      notice = { title: 'Interview passed', message: 'You passed your interview. Next step: complete the Nexnoon instructor training.' };
      break;
    case 'interview_fail':
      if (!preApproval) return fail('Only pending applicants can fail an interview');
      lc.interview = { ...(lc.interview || {}), result: 'fail', notes: note, decidedAt: now };
      user.instructorStatus = 'rejected';
      nextStage = 'rejected';
      break;
    case 'complete_training':
      if (lc.interview?.result !== 'pass' && preApproval) return fail('The applicant must pass the interview before training');
      lc.trainingCompletedAt = now;
      nextStage = preApproval ? 'training' : stage;
      break;
    case 'certify':
      if (!preApproval) return fail('This instructor is not waiting for certification');
      if (lc.interview?.result !== 'pass') return fail('Record a passed interview before certifying');
      if (!lc.trainingCompletedAt) return fail('Mark training complete before certifying');
      user.instructorStatus = 'approved';
      if (typeof user.adminEvaluation !== 'number') user.adminEvaluation = 80;
      lc.reviewDueAt = date ? new Date(date) : addDays(now, 365);
      nextStage = 'certified';
      warning = 'Now certify them for specific course × language pairs so they can be assigned classes.';
      break;
    case 'renew':
      if (status !== 'approved') return fail('Only active instructors can be renewed');
      lc.renewedAt = now;
      lc.reviewDueAt = date ? new Date(date) : addDays(now, 365);
      lc.improvementPlan = undefined;
      nextStage = 'active';
      notice = { title: 'Teaching renewed', message: `Your Nexnoon teaching status was renewed until ${lc.reviewDueAt.toDateString()}. Thank you!` };
      break;
    case 'improve':
      if (status !== 'approved') return fail('Only active instructors can be put on an improvement plan');
      lc.improvementPlan = { notes: note, startedAt: now, dueAt: date ? new Date(date) : addDays(now, 30) };
      nextStage = 'improvement';
      notice = {
        title: 'Improvement plan',
        message: `The Nexnoon team opened an improvement plan for you (review by ${lc.improvementPlan.dueAt!.toDateString()}):\n\n${note}`,
      };
      break;
    case 'complete_improvement':
      if (stage !== 'improvement') return fail('This instructor has no open improvement plan');
      lc.improvementPlan = undefined;
      nextStage = 'active';
      notice = { title: 'Improvement plan closed', message: 'Your improvement plan was closed. Keep up the good work!' };
      break;
    case 'suspend':
      if (status !== 'approved') return fail('Only active instructors can be suspended');
      user.instructorStatus = 'suspended';
      user.adminEvaluation = Math.min(user.adminEvaluation ?? 70, 30);
      nextStage = 'suspended';
      break;
    case 'reinstate':
      if (status !== 'suspended' || stage === 'removed') return fail('Only suspended instructors can be reinstated');
      user.instructorStatus = 'approved';
      nextStage = 'active';
      break;
    case 'remove': {
      if (stage === 'removed') return fail('This instructor was already removed');
      user.instructorStatus = 'suspended';
      for (const c of user.certifications || []) if (c.status !== 'revoked') c.status = 'revoked';
      syncApprovedCourseIds(user);
      nextStage = 'removed';
      const affected = await upcomingLedClasses(String(user._id));
      if (affected.length) warning = `They still lead ${affected.length} class(es) with upcoming sessions: ${affected.map((c) => c.title).join(', ')}. Assign a new lead.`;
      notice = { title: 'Removed from the Nexnoon roster', message: `Your teaching access and course certifications were revoked.\n\nReason: ${note}` };
      break;
    }
  }

  lc.stage = nextStage;
  lc.history.push({ stage: nextStage, action, note, at: now, by: req.user!.id as any, byName: 'Admin' });
  user.markModified('lifecycle');
  await user.save();

  if (notice) await notifyInstructor(user, notice.title, notice.message);
  if (action === 'certify' || action === 'reinstate') {
    await NotificationModel.create({ userId: user._id, type: 'system', title: 'You’re certified to teach', message: 'You can now be assigned Nexnoon classes.', read: false, actionUrl: '/instructor/dashboard' }).catch(() => {});
    await sendEmailSafe(user.email, 'You’re approved to teach on Nexnoon', buildInstructorDecisionEmail(user.fullName, 'approved'));
  }
  if (action === 'interview_fail') {
    await sendEmailSafe(user.email, 'Instructor application update', buildInstructorDecisionEmail(user.fullName, 'rejected'));
  }
  if (action === 'suspend') {
    await notifyInstructor(user, 'Instructor account suspended', `Your teaching privileges are suspended.\n\nReason: ${note}`);
  }

  await logActivity({
    category: 'instructor',
    action: `lifecycle_${action}`,
    message: `${user.fullName}: ${action.replace(/_/g, ' ')}${note ? ` — ${note.slice(0, 140)}` : ''}`,
    actorId: req.user!.id,
    actorName: 'Admin',
    actorRole: 'admin',
    targetUserId: String(user._id),
  });

  return res.json({
    success: true,
    data: { stage: nextStage, instructorStatus: user.instructorStatus, warning },
    message: warning ? `Saved. ${warning}` : 'Lifecycle updated',
  });
});

/* ------------------------------------------------------------------ */
/* Certifications: instructor × course × language                      */
/* ------------------------------------------------------------------ */

const certifySchema = z.object({
  courseId: z.string(),
  languageOfferingIds: z.array(z.string()).max(50).default([]),
  expiresAt: z.string().datetime().nullable().optional(),
  note: z.string().trim().max(1000).optional(),
});

router.post('/instructors/:id/certifications', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid instructor ID' });
  const parsed = certifySchema.safeParse(req.body);
  if (!parsed.success || !isValidObjectId(parsed.data.courseId)) {
    return res.status(400).json({ success: false, message: 'Pick a course and at least one language' });
  }
  const { courseId, languageOfferingIds, expiresAt, note } = parsed.data;

  const [user, course] = await Promise.all([User.findById(req.params.id), CourseModel.findById(courseId)]);
  if (!user || user.role !== 'instructor') return res.status(404).json({ success: false, message: 'Instructor not found' });
  if (user.instructorStatus !== 'approved') {
    return res.status(409).json({ success: false, message: 'Certify the instructor (lifecycle) before granting course permissions' });
  }
  if (!course || course.status === 'archived') return res.status(404).json({ success: false, message: 'Course not found' });

  const offerings = (course.languageOfferings || []).filter((o) => o.status !== 'inactive');
  let targets: (Types.ObjectId | undefined)[];
  if (offerings.length) {
    if (!languageOfferingIds.length) return res.status(400).json({ success: false, message: 'Pick at least one language' });
    const valid = offerings.filter((o) => languageOfferingIds.includes(String(o._id)));
    if (valid.length !== languageOfferingIds.length) return res.status(400).json({ success: false, message: 'One of the languages is not offered for this course' });
    targets = valid.map((o) => o._id as Types.ObjectId);
  } else {
    targets = [undefined];
  }

  const now = new Date();
  for (const lang of targets) {
    const existing = user.certifications.find(
      (c) => String(c.courseId) === courseId && String(c.languageOfferingId || '') === String(lang || '')
    );
    if (existing) {
      existing.status = 'active';
      existing.certifiedAt = now;
      existing.expiresAt = expiresAt ? new Date(expiresAt) : undefined;
      existing.note = note;
      existing.certifiedBy = req.user!.id as any;
    } else {
      user.certifications.push({
        courseId: course._id,
        languageOfferingId: lang,
        status: 'active',
        certifiedAt: now,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        note,
        certifiedBy: req.user!.id,
      } as any);
    }
  }
  // A language-specific grant supersedes an old all-language legacy grant for the same course.
  if (offerings.length) {
    for (const c of user.certifications) {
      if (String(c.courseId) === courseId && !c.languageOfferingId && c.status === 'active') c.status = 'revoked';
    }
  }
  syncApprovedCourseIds(user);
  const lc = (user.lifecycle ||= { history: [] } as any)!;
  if (lifecycleStageOf(user) === 'certified') lc.stage = 'active';
  lc.history.push({ stage: lc.stage || 'active', action: 'course_certified', note: `${course.title}`, at: now, by: req.user!.id as any, byName: 'Admin' });
  user.markModified('lifecycle');
  await user.save();

  const labels = offerings.filter((o) => targets.some((t) => String(t) === String(o._id))).map((o) => o.label);
  const scope = `${course.title}${labels.length ? ` (${labels.join(', ')})` : ''}`;
  await notifyInstructor(user, 'New course certification', `You are now certified to teach ${scope}.`, '/instructor/dashboard', false);
  await logActivity({
    category: 'instructor',
    action: 'certification_grant',
    message: `${user.fullName} certified for ${scope}`,
    actorId: req.user!.id,
    actorName: 'Admin',
    actorRole: 'admin',
    targetUserId: String(user._id),
    meta: { courseId, languageOfferingIds, expiresAt },
  });

  return res.status(201).json({ success: true, message: `Certified for ${scope}` });
});

const certUpdateSchema = z.object({
  status: z.enum(['active', 'suspended', 'revoked']).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  note: z.string().trim().max(1000).optional(),
});

router.patch('/instructors/:id/certifications/:certId', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id) || !isValidObjectId(req.params.certId)) {
    return res.status(400).json({ success: false, message: 'Invalid ID' });
  }
  const parsed = certUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid certification change' });

  const user = await User.findById(req.params.id);
  if (!user || user.role !== 'instructor') return res.status(404).json({ success: false, message: 'Instructor not found' });
  const cert = user.certifications.find((c) => String(c._id) === req.params.certId);
  if (!cert) return res.status(404).json({ success: false, message: 'Certification not found' });

  if (parsed.data.status === 'active' && user.instructorStatus !== 'approved') {
    return res.status(409).json({ success: false, message: 'Reinstate the instructor before reactivating certifications' });
  }
  if (parsed.data.status) cert.status = parsed.data.status;
  if (parsed.data.expiresAt !== undefined) cert.expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined;
  if (parsed.data.note !== undefined) cert.note = parsed.data.note;
  syncApprovedCourseIds(user);
  await user.save();

  const course = await CourseModel.findById(cert.courseId).select('title languageOfferings');
  const lang = course?.languageOfferings?.find((o) => String(o._id) === String(cert.languageOfferingId || ''))?.label;
  const scope = `${course?.title || 'course'}${lang ? ` (${lang})` : ''}`;

  let warning: string | undefined;
  if (!isCertActive(cert)) {
    const affected = await upcomingLedClasses(String(user._id), {
      courseId: cert.courseId,
      ...(cert.languageOfferingId ? { languageOfferingId: cert.languageOfferingId } : {}),
    });
    if (affected.length) warning = `They still lead ${affected.length} upcoming class(es) for ${scope}: ${affected.map((c) => c.title).join(', ')}.`;
    await notifyInstructor(user, 'Certification updated', `Your certification for ${scope} is now ${cert.status}.`, '/instructor/dashboard', false);
  }

  await logActivity({
    category: 'instructor',
    action: `certification_${cert.status}`,
    message: `${user.fullName}: certification for ${scope} set to ${cert.status}`,
    actorId: req.user!.id,
    actorName: 'Admin',
    actorRole: 'admin',
    targetUserId: String(user._id),
  });

  return res.json({ success: true, data: { warning }, message: warning ? `Saved. ${warning}` : 'Certification updated' });
});

/* ------------------------------------------------------------------ */
/* Incidents                                                           */
/* ------------------------------------------------------------------ */

const incidentSchema = z.object({
  type: z.enum(INCIDENT_TYPES),
  severity: z.enum(['low', 'medium', 'high']).default('medium'),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).optional(),
  classId: z.string().optional(),
  sessionId: z.string().optional(),
  instructorId: z.string().optional(),
  learnerId: z.string().optional(),
  occurredAt: z.string().datetime().optional(),
});

const optionalId = (v?: string) => (v && isValidObjectId(v) ? v : undefined);

function toIncidentDto(i: any, names: Map<string, string>, classTitles: Map<string, string>) {
  return {
    id: String(i._id),
    type: i.type,
    severity: i.severity,
    status: i.status,
    title: i.title,
    description: i.description || '',
    resolution: i.resolution || '',
    classId: i.classId ? String(i.classId) : null,
    classTitle: i.classId ? classTitles.get(String(i.classId)) || 'Deleted class' : null,
    instructorId: i.instructorId ? String(i.instructorId) : null,
    instructorName: i.instructorId ? names.get(String(i.instructorId)) || 'Deleted user' : null,
    learnerId: i.learnerId ? String(i.learnerId) : null,
    learnerName: i.learnerId ? names.get(String(i.learnerId)) || 'Deleted user' : null,
    reportedByName: i.reportedByName || '',
    reporterRole: i.reporterRole || 'admin',
    occurredAt: i.occurredAt,
    resolvedAt: i.resolvedAt || null,
    createdAt: i.createdAt,
  };
}

router.get('/incidents', async (_req, res) => {
  const incidents = await IncidentModel.find().sort({ createdAt: -1 }).limit(1000).lean();
  const userIds = [...new Set(incidents.flatMap((i) => [i.instructorId, i.learnerId]).filter(Boolean).map(String))];
  const classIds = [...new Set(incidents.map((i) => i.classId).filter(Boolean).map(String))];
  const [users, classes] = await Promise.all([
    User.find({ _id: { $in: userIds } }).select('fullName').lean(),
    ClassModel.find({ _id: { $in: classIds } }).select('title').lean(),
  ]);
  const names = new Map(users.map((u) => [String(u._id), u.fullName]));
  const titles = new Map(classes.map((c) => [String(c._id), c.title]));
  return res.json({ success: true, data: incidents.map((i) => toIncidentDto(i, names, titles)) });
});

router.post('/incidents', async (req: AuthRequest, res) => {
  const parsed = incidentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid incident' });
  const d = parsed.data;
  const classId = optionalId(d.classId);
  let instructorId = optionalId(d.instructorId);
  if (classId && !instructorId) {
    const cls = await ClassModel.findById(classId).select('instructor.id');
    instructorId = cls?.instructor?.id ? String(cls.instructor.id) : undefined;
  }
  const incident = await IncidentModel.create({
    type: d.type,
    severity: d.severity,
    title: d.title,
    description: d.description,
    classId,
    sessionId: optionalId(d.sessionId),
    instructorId,
    learnerId: optionalId(d.learnerId),
    occurredAt: d.occurredAt ? new Date(d.occurredAt) : new Date(),
    reportedBy: req.user!.id,
    reportedByName: 'Admin',
    reporterRole: 'admin',
  });
  await logActivity({
    category: 'system',
    action: 'incident_open',
    message: `Incident (${d.severity}) logged: ${d.title}`,
    actorId: req.user!.id,
    actorName: 'Admin',
    actorRole: 'admin',
    targetUserId: instructorId,
    targetClassId: classId,
  });
  return res.status(201).json({ success: true, data: { id: String(incident._id) }, message: 'Incident logged' });
});

const incidentUpdateSchema = z.object({
  status: z.enum(['open', 'investigating', 'resolved', 'dismissed']).optional(),
  severity: z.enum(['low', 'medium', 'high']).optional(),
  resolution: z.string().trim().max(5000).optional(),
});

router.patch('/incidents/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid incident ID' });
  const parsed = incidentUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid incident change' });
  const incident = await IncidentModel.findById(req.params.id);
  if (!incident) return res.status(404).json({ success: false, message: 'Incident not found' });

  const { status, severity, resolution } = parsed.data;
  if ((status === 'resolved' || status === 'dismissed') && !(resolution || incident.resolution)) {
    return res.status(400).json({ success: false, message: 'Write a resolution note before closing the incident' });
  }
  if (severity) incident.severity = severity;
  if (resolution !== undefined) incident.resolution = resolution;
  if (status) {
    incident.status = status;
    if (status === 'resolved' || status === 'dismissed') {
      incident.resolvedAt = new Date();
      incident.resolvedBy = req.user!.id as any;
    } else {
      incident.resolvedAt = undefined;
    }
  }
  await incident.save();
  await logActivity({
    category: 'system',
    action: `incident_${incident.status}`,
    message: `Incident "${incident.title}" → ${incident.status}`,
    actorId: req.user!.id,
    actorName: 'Admin',
    actorRole: 'admin',
    targetUserId: incident.instructorId ? String(incident.instructorId) : undefined,
    targetClassId: incident.classId ? String(incident.classId) : undefined,
  });
  return res.json({ success: true, message: `Incident ${incident.status}` });
});

/* ------------------------------------------------------------------ */
/* Attendance                                                          */
/* ------------------------------------------------------------------ */

router.get('/classes/:id/attendance', async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid class ID' });
  const cls = await ClassModel.findById(req.params.id).select('title timezone').lean();
  if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });

  return res.json({ success: true, data: await buildAttendanceMatrix(cls) });
});

router.put('/classes/:id/attendance', async (req: AuthRequest, res) => {
  const parsed = markAttendanceSchema.safeParse(req.body);
  if (!parsed.success || !isValidObjectId(req.params.id) || !isValidObjectId(parsed.data.sessionId) || !isValidObjectId(parsed.data.userId)) {
    return res.status(400).json({ success: false, message: 'Invalid attendance mark' });
  }
  const { userId, status } = parsed.data;
  const result = await markAttendance(req.params.id, parsed.data, req.user!.id);
  if (!result.ok) return res.status(result.status).json({ success: false, message: result.message });

  await logActivity({
    category: 'class',
    action: 'attendance_mark',
    message: `Admin marked attendance "${status ?? 'auto'}" for session "${result.sessionTitle}"`,
    actorId: req.user!.id,
    actorName: 'Admin',
    actorRole: 'admin',
    targetUserId: userId,
    targetClassId: req.params.id,
  });
  return res.json({ success: true, message: status ? `Marked ${status}` : 'Reset to automatic' });
});

/* ------------------------------------------------------------------ */
/* Review moderation                                                   */
/* ------------------------------------------------------------------ */

router.get('/reviews', async (_req, res) => {
  const reviews = await ReviewModel.find().sort({ createdAt: -1 }).limit(2000).lean();
  const classIds = [...new Set(reviews.map((r) => String(r.classId)))];
  const userIds = [...new Set(reviews.map((r) => String(r.userId)))];
  const [classes, users] = await Promise.all([
    ClassModel.find({ _id: { $in: classIds } }).select('title instructor').lean(),
    User.find({ _id: { $in: userIds } }).select('email').lean(),
  ]);
  const clsById = new Map(classes.map((c) => [String(c._id), c]));
  const emailById = new Map(users.map((u) => [String(u._id), u.email]));
  return res.json({
    success: true,
    data: reviews.map((r) => {
      const c = clsById.get(String(r.classId));
      return {
        id: String(r._id),
        classId: String(r.classId),
        classTitle: c?.title || 'Deleted class',
        instructorId: c?.instructor?.id ? String(c.instructor.id) : '',
        instructorName: c?.instructor?.name || '',
        userId: String(r.userId),
        userName: r.userName,
        userEmail: emailById.get(String(r.userId)) || '',
        rating: r.rating,
        comment: r.comment || '',
        status: r.status || 'visible',
        moderationNote: r.moderationNote || '',
        moderatedAt: r.moderatedAt || null,
        createdAt: r.createdAt,
      };
    }),
  });
});

router.patch('/reviews/:id', async (req: AuthRequest, res) => {
  const parsed = z.object({ status: z.enum(['visible', 'flagged', 'hidden']), note: z.string().trim().max(1000).optional() }).safeParse(req.body);
  if (!parsed.success || !isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid moderation action' });
  if (parsed.data.status === 'hidden' && !parsed.data.note) {
    return res.status(400).json({ success: false, message: 'Say why the review is hidden' });
  }
  const review = await ReviewModel.findById(req.params.id);
  if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
  review.status = parsed.data.status;
  if (parsed.data.note !== undefined) review.moderationNote = parsed.data.note;
  review.moderatedAt = new Date();
  review.moderatedBy = req.user!.id as any;
  await review.save();
  await recomputeClassRating(review.classId);
  await logActivity({
    category: 'learner',
    action: `review_${parsed.data.status}`,
    message: `Review by ${review.userName} set to ${parsed.data.status}${parsed.data.note ? `: ${parsed.data.note}` : ''}`,
    actorId: req.user!.id,
    actorName: 'Admin',
    actorRole: 'admin',
    targetUserId: String(review.userId),
    targetClassId: String(review.classId),
  });
  return res.json({ success: true, message: `Review ${parsed.data.status === 'visible' ? 'restored' : parsed.data.status}` });
});

router.delete('/reviews/:id', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid review ID' });
  const review = await ReviewModel.findById(req.params.id);
  if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
  await review.deleteOne();
  await recomputeClassRating(review.classId);
  await logActivity({
    category: 'learner',
    action: 'review_delete',
    message: `Admin deleted a ${review.rating}★ review by ${review.userName}`,
    actorId: req.user!.id,
    actorName: 'Admin',
    actorRole: 'admin',
    targetUserId: String(review.userId),
    targetClassId: String(review.classId),
  });
  return res.json({ success: true, message: 'Review deleted' });
});

/* ------------------------------------------------------------------ */
/* KPIs (PRD §19)                                                      */
/* ------------------------------------------------------------------ */

router.get('/kpis', async (req, res) => {
  const days = Math.max(0, Math.min(3650, Number(req.query.days ?? 30) || 0));
  const now = new Date();
  const from = days ? addDays(now, -days) : new Date(0);
  const inWindow = (d?: Date | string | null) => !!d && new Date(d) >= from && new Date(d) <= now;

  const [settings, classes, sessions, enrollments, payments, reviews, attendance, users, courses] = await Promise.all([
    getPlatformSettings(),
    ClassModel.find().select('title status courseId instructor teachingTeam enrolledStudents maxStudents endDate cancelledAt createdAt').lean(),
    ClassScheduleModel.find().select('classId status startTime endTime').lean(),
    EnrollmentModel.find().select('classId userId status progress enrolledAt completedAt').lean(),
    PaymentModel.find({ paymentMethod: { $ne: 'demo' } }).select('classId userId amount currency status createdAt').lean(),
    ReviewModel.find({ status: { $ne: 'hidden' } }).select('classId userId rating comment createdAt').lean(),
    AttendanceRecordModel.find().select('classId sessionId userId late authorizedAt pendingJoin sdkJoinedAt zoomJoinedAt manualStatus createdByMark').lean(),
    User.find({ role: 'instructor' }).select('instructorStatus createdAt').lean(),
    CourseModel.find().select('title status').lean(),
  ]);

  const seatCap = settings.maxClassSeats || 25;
  const feePct = settings.platformFeePercent ?? 20;

  const windowPayments = payments.filter((p) => inWindow(p.createdAt));
  const completedPayments = windowPayments.filter((p) => p.status === 'completed');
  const gmv = completedPayments.reduce((s, p) => s + p.amount, 0);
  const refunded = windowPayments.filter((p) => p.status === 'refunded').reduce((s, p) => s + p.amount, 0);
  const processingFees = completedPayments.reduce((s, p) => s + p.amount * 0.029 + 0.3, 0);
  const platformRevenue = gmv * (feePct / 100);
  const newEnrollments = enrollments.filter((e) => inWindow(e.enrolledAt));
  const paidEnrollKeys = new Set(completedPayments.map((p) => `${p.classId}:${p.userId}`));
  const freeEnrollments = newEnrollments.filter((e) => !paidEnrollKeys.has(`${e.classId}:${e.userId}`)).length;

  const allClassIds = new Set(classes.map((c) => String(c._id)));
  const windowSessions = sessions.filter((s) => inWindow(s.startTime));
  const attendanceStats = classDeliveryStats(allClassIds, { classes, enrollments, sessions: windowSessions, attendance });
  const deliveryAll = classDeliveryStats(allClassIds, { classes, enrollments, sessions, attendance });

  const windowReviews = reviews.filter((r) => inWindow(r.createdAt));
  const avgRating = windowReviews.length ? windowReviews.reduce((s, r) => s + r.rating, 0) / windowReviews.length : 0;

  const perLearner = new Map<string, number>();
  for (const e of enrollments) {
    if (e.status === 'dropped') continue;
    perLearner.set(String(e.userId), (perLearner.get(String(e.userId)) || 0) + 1);
  }
  const learnersWithAny = perLearner.size;
  const repeatLearners = [...perLearner.values()].filter((n) => n >= 2).length;

  const approved = users.filter((u) => u.instructorStatus === 'approved');
  const activeClassIds = new Set(
    windowSessions.filter((s) => s.status !== 'cancelled').map((s) => String(s.classId))
  );
  const upcoming = sessions.filter((s) => s.status === 'scheduled' && new Date(s.startTime) > now);
  for (const s of upcoming) activeClassIds.add(String(s.classId));
  const utilized = new Set<string>();
  for (const c of classes) {
    if (!activeClassIds.has(String(c._id))) continue;
    utilized.add(String(c.instructor?.id));
    for (const m of c.teachingTeam || []) if (m.status === 'accepted') utilized.add(String(m.userId));
  }
  const utilizedApproved = approved.filter((u) => utilized.has(String(u._id))).length;

  const published = classes.filter((c) => c.status === 'published' && !c.cancelledAt);
  const avgFill = published.length
    ? Math.round(published.reduce((s, c) => s + ((c.enrolledStudents || 0) / (c.maxStudents || seatCap)) * 100, 0) / published.length)
    : 0;
  const paidClassCount = new Set(completedPayments.map((p) => String(p.classId))).size;

  const lowRated = new Set(reviews.filter((r) => r.rating < 3).map((r) => `${r.classId}:${r.userId}`));
  const successful = enrollments.filter(
    (e) => e.status === 'completed' && !lowRated.has(`${e.classId}:${e.userId}`) && (!days || inWindow(e.completedAt || e.enrolledAt))
  ).length;

  const attendedLearners = new Set(
    attendance
      .filter((a) => ['present', 'late'].includes(attendanceStateOf(a) || '') && (!days || inWindow(a.authorizedAt)))
      .map((a) => `${a.classId}:${a.userId}`)
  );

  // Weekly buckets for 30/90 days, monthly otherwise.
  const monthly = !days || days > 120;
  const bucketOf = (d: Date) => {
    const x = new Date(d);
    if (monthly) return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}`;
    const monday = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate() - ((x.getUTCDay() + 6) % 7)));
    return monday.toISOString().slice(0, 10);
  };
  const series = new Map<string, { period: string; enrollments: number; gmv: number; sessions: number }>();
  const touch = (d: Date) => {
    const k = bucketOf(d);
    if (!series.has(k)) series.set(k, { period: k, enrollments: 0, gmv: 0, sessions: 0 });
    return series.get(k)!;
  };
  for (const e of newEnrollments) touch(new Date(e.enrolledAt)).enrollments++;
  for (const p of completedPayments) touch(new Date(p.createdAt)).gmv += p.amount;
  for (const s of windowSessions) if (isHeldSession(s)) touch(new Date(s.startTime)).sessions++;

  const courseTitle = new Map(courses.map((c) => [String(c._id), c.title]));
  const byCourse = new Map<string, { courseId: string; title: string; classes: number; enrollments: number; gmv: number }>();
  const classCourse = new Map(classes.map((c) => [String(c._id), c.courseId ? String(c.courseId) : 'none']));
  const courseRow = (id: string) => {
    if (!byCourse.has(id)) byCourse.set(id, { courseId: id, title: id === 'none' ? 'Not linked to a course' : courseTitle.get(id) || 'Deleted course', classes: 0, enrollments: 0, gmv: 0 });
    return byCourse.get(id)!;
  };
  for (const c of classes) courseRow(classCourse.get(String(c._id))!).classes++;
  for (const e of newEnrollments) courseRow(classCourse.get(String(e.classId)) || 'none').enrollments++;
  for (const p of completedPayments) courseRow(classCourse.get(String(p.classId)) || 'none').gmv += p.amount;

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
  const round2 = (n: number) => Math.round(n * 100) / 100;

  return res.json({
    success: true,
    data: {
      window: { days, from: days ? from : null, to: now },
      northStar: {
        successfulLearners: successful,
        activeClasses: activeClassIds.size,
        perActiveClass: activeClassIds.size ? round2(successful / activeClassIds.size) : 0,
      },
      kpis: {
        applications: windowPayments.length + freeEnrollments,
        paymentAttempts: windowPayments.length,
        instructorApplications: users.filter((u) => inWindow(u.createdAt)).length,
        enrollments: newEnrollments.length,
        freeEnrollments,
        paidEnrollments: completedPayments.length,
        enrollmentConversion: pct(completedPayments.length, windowPayments.length),
        fillRate: avgFill,
        attendanceRate: attendanceStats.attendanceRate,
        sessionsHeld: attendanceStats.heldSessions,
        completionRate: deliveryAll.completionRate,
        dropoutRate: deliveryAll.dropoutRate,
        satisfaction: pct(windowReviews.filter((r) => r.rating >= 4).length, windowReviews.length),
        avgRating: round2(avgRating),
        reviews: windowReviews.length,
        repeatEnrollment: pct(repeatLearners, learnersWithAny),
        instructorUtilization: pct(utilizedApproved, approved.length),
        certifiedInstructors: approved.length,
        teachingInstructors: utilizedApproved,
        gmv: round2(gmv),
        refunded: round2(refunded),
        revenuePerClass: paidClassCount ? round2(gmv / paidClassCount) : 0,
        platformFeePercent: feePct,
        estPlatformRevenue: round2(platformRevenue),
        estProcessingFees: round2(processingFees),
        estContributionMargin: round2(platformRevenue - processingFees),
      },
      funnel: [
        { stage: 'Checkout started', value: windowPayments.length + freeEnrollments },
        { stage: 'Enrolled', value: newEnrollments.length },
        { stage: 'Attended a session', value: attendedLearners.size },
        { stage: 'Completed', value: enrollments.filter((e) => e.status === 'completed' && (!days || inWindow(e.completedAt || e.enrolledAt))).length },
      ],
      series: [...series.values()].sort((a, b) => a.period.localeCompare(b.period)).map((s) => ({ ...s, gmv: round2(s.gmv) })),
      courses: [...byCourse.values()].sort((a, b) => b.enrollments - a.enrollments || b.gmv - a.gmv).map((c) => ({ ...c, gmv: round2(c.gmv) })),
    },
  });
});

/* ------------------------------------------------------------------ */
/* Payouts                                                             */
/* ------------------------------------------------------------------ */

router.get('/payouts', async (_req, res) => {
  await syncEarnings();
  const [payouts, balances, feeTotals, held] = await Promise.all([
    PayoutModel.find().sort({ requestedAt: -1 }).limit(500).lean(),
    balancesFor(),
    EarningModel.aggregate<{ _id: string; platformFee: number; gross: number }>([
      { $match: { status: { $ne: 'void' } } },
      { $group: { _id: '$currency', platformFee: { $sum: '$platformFee' }, gross: { $sum: '$gross' } } },
    ]),
    EarningModel.countDocuments({ status: 'pending', availableAt: null }),
  ]);
  const instructorIds = [...new Set([...payouts.map((p) => String(p.instructorId)), ...balances.keys()])];
  const users = await User.find({ _id: { $in: instructorIds } }).select('fullName email instructorStatus payout').lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  const who = (id: string) => {
    const u = byId.get(id);
    return {
      instructorName: u?.fullName || 'Deleted user',
      instructorEmail: u?.email || '',
      instructorStatus: u?.instructorStatus || 'none',
      payoutsEnabled: !!u?.payout?.payoutsEnabled,
      stripeConnected: !!u?.payout?.stripeAccountId,
    };
  };

  return res.json({
    success: true,
    data: {
      stripeReady: !!getStripe(),
      heldEarnings: held,
      totals: feeTotals.map((t) => ({ currency: t._id, platformFee: round2(t.platformFee), gross: round2(t.gross) })),
      payouts: payouts.map((p) => ({
        id: String(p._id),
        instructorId: String(p.instructorId),
        ...who(String(p.instructorId)),
        currency: p.currency,
        amount: p.amount,
        fee: p.fee,
        net: p.net,
        status: p.status,
        method: p.method || null,
        reference: p.reference || '',
        note: p.note || '',
        failureReason: p.failureReason || '',
        stripeTransferId: p.stripeTransferId || '',
        items: p.earningIds.length,
        requestedAt: p.requestedAt,
        decidedAt: p.decidedAt || null,
      })),
      balances: [...balances.entries()].flatMap(([instructorId, rows]) => rows.map((r) => ({ instructorId, ...who(instructorId), ...r }))),
    },
  });
});

const approveSchema = z.object({
  method: z.enum(['stripe', 'manual']),
  reference: z.string().trim().max(300).optional(),
});

router.post('/payouts/:id/approve', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid payout ID' });
  const parsed = approveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Choose how this payout is sent' });
  const { method, reference } = parsed.data;
  if (method === 'manual' && !reference) {
    return res.status(400).json({ success: false, message: 'Add the bank / Wise / Payoneer reference for a manual payout' });
  }

  // Claim the payout so two admins can't send it twice.
  const payout = await PayoutModel.findOneAndUpdate({ _id: req.params.id, status: { $in: ['requested', 'failed'] } }, { $set: { status: 'processing' } }, { new: true });
  if (!payout) return res.status(409).json({ success: false, message: 'This payout was already handled' });
  const instructor = await User.findById(payout.instructorId);
  const release = async (failureReason: string) => {
    payout.status = 'failed';
    payout.failureReason = failureReason;
    await payout.save();
  };

  if (method === 'stripe') {
    const stripe = getStripe();
    if (!stripe) {
      await release('Stripe is not configured');
      return res.status(503).json({ success: false, message: 'Stripe is not configured. Pay manually and record the reference instead.' });
    }
    const accountId = instructor?.payout?.stripeAccountId;
    if (!accountId) {
      await release('Instructor has not connected Stripe');
      return res.status(409).json({ success: false, message: 'This instructor has not connected a Stripe account.' });
    }
    try {
      const account = await stripe.accounts.retrieve(accountId);
      instructor!.payout = connectSnapshot(account);
      await instructor!.save();
      if (!account.payouts_enabled) {
        await release('Stripe account cannot receive payouts yet');
        return res.status(409).json({ success: false, message: 'Stripe has not enabled payouts on this instructor’s account yet.' });
      }
      const transfer = await stripe.transfers.create(
        {
          amount: toMinorUnits(payout.net),
          currency: payout.currency,
          destination: accountId,
          transfer_group: `payout_${payout.id}`,
          metadata: { payoutId: payout.id, instructorId: String(payout.instructorId) },
        },
        { idempotencyKey: `payout-${payout.id}` }
      );
      payout.stripeTransferId = transfer.id;
    } catch (err: any) {
      await release(err?.message || 'Stripe transfer failed');
      return res.status(502).json({ success: false, message: `Stripe transfer failed: ${err?.message || 'unknown error'}` });
    }
  }

  payout.status = 'paid';
  payout.method = method;
  payout.reference = reference || payout.stripeTransferId;
  payout.failureReason = undefined;
  payout.decidedAt = new Date();
  payout.decidedBy = req.user!.id as any;
  await payout.save();
  await EarningModel.updateMany({ payoutId: payout._id }, { $set: { status: 'paid' } });

  const amountLabel = `${payout.net.toFixed(2)} ${payout.currency.toUpperCase()}`;
  if (instructor) {
    await NotificationModel.create({
      userId: instructor._id,
      type: 'payment',
      title: 'Payout sent',
      message: `${amountLabel} is on its way${method === 'stripe' ? ' via Stripe' : ''}.`,
      read: false,
      actionUrl: '/earnings',
    }).catch(() => {});
  }
  await logActivity({
    category: 'payment',
    action: 'payout_paid',
    message: `Admin paid ${amountLabel} to ${instructor?.fullName || 'instructor'} (${method}${reference ? `, ref ${reference}` : ''})`,
    actorId: req.user!.id,
    actorName: 'Admin',
    actorRole: 'admin',
    targetUserId: String(payout.instructorId),
  });
  return res.json({ success: true, message: `Payout of ${amountLabel} marked as sent` });
});

router.post('/payouts/:id/reject', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid payout ID' });
  const parsed = z.object({ note: z.string().trim().min(3).max(2000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Tell the instructor why the payout was rejected' });
  const payout = await PayoutModel.findOneAndUpdate(
    { _id: req.params.id, status: { $in: ['requested', 'failed'] } },
    { $set: { status: 'rejected', note: parsed.data.note, decidedAt: new Date(), decidedBy: req.user!.id } },
    { new: true }
  );
  if (!payout) return res.status(409).json({ success: false, message: 'This payout was already handled' });
  await EarningModel.updateMany({ payoutId: payout._id, status: 'requested' }, { $set: { status: 'available' }, $unset: { payoutId: '' } });

  const instructor = await User.findById(payout.instructorId).select('fullName');
  await NotificationModel.create({
    userId: payout.instructorId,
    type: 'payment',
    title: 'Payout request declined',
    message: `Your payout request was declined: ${parsed.data.note}. The balance is available again.`,
    read: false,
    actionUrl: '/earnings',
  }).catch(() => {});
  await logActivity({
    category: 'payment',
    action: 'payout_rejected',
    message: `Admin declined a ${payout.net.toFixed(2)} ${payout.currency.toUpperCase()} payout to ${instructor?.fullName || 'instructor'}: ${parsed.data.note}`,
    actorId: req.user!.id,
    actorName: 'Admin',
    actorRole: 'admin',
    targetUserId: String(payout.instructorId),
  });
  return res.json({ success: true, message: 'Payout declined; the balance is available to the instructor again' });
});

/** Full refund of a learner payment. The ledger voids or claws back the instructor share. */
router.post('/payments/:id/refund', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid payment ID' });
  const parsed = z.object({ reason: z.string().trim().min(3).max(500) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Add a reason for the refund' });
  const payment = await PaymentModel.findById(req.params.id);
  if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
  if (payment.status !== 'completed') return res.status(409).json({ success: false, message: `Only completed payments can be refunded (this one is ${payment.status})` });

  try {
    await refundPayment(payment, parsed.data.reason);
  } catch (err: any) {
    return res.status(502).json({ success: false, message: `Refund failed: ${err?.message || 'unknown error'}` });
  }
  const dropped = await EnrollmentModel.findOneAndUpdate(
    { classId: payment.classId, userId: payment.userId, status: 'active' },
    { $set: { status: 'dropped', droppedAt: new Date() } }
  );
  if (dropped) await releaseSeat(String(payment.classId));

  const cls = await ClassModel.findById(payment.classId).select('title');
  await NotificationModel.create({
    userId: payment.userId,
    type: 'payment',
    title: 'Refund issued',
    message: `Your payment of ${payment.amount.toFixed(2)} ${payment.currency.toUpperCase()} for "${cls?.title || 'a class'}" was refunded.${dropped ? ' Your place in the class has been released.' : ''}`,
    actionUrl: '/my-classes?tab=payments',
    read: false,
  }).catch(() => {});
  await logActivity({
    category: 'payment',
    action: 'refund',
    message: `Admin refunded ${payment.amount.toFixed(2)} ${payment.currency.toUpperCase()} for "${cls?.title || 'class'}": ${parsed.data.reason}`,
    actorId: req.user!.id,
    actorName: 'Admin',
    actorRole: 'admin',
    targetUserId: String(payment.userId),
    targetClassId: String(payment.classId),
  });
  return res.json({ success: true, message: 'Payment refunded' });
});

/* ------------------------------------------------------------------ */
/* Free-class approval                                                 */
/* ------------------------------------------------------------------ */

router.post('/classes/:id/free-approval', async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid class ID' });
  const parsed = z.object({ decision: z.enum(['approve', 'reject']), note: z.string().trim().max(1000).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Approve or reject' });
  const { decision, note } = parsed.data;
  if (decision === 'reject' && !note) return res.status(400).json({ success: false, message: 'Tell the instructor why the free class was rejected' });

  const cls = await ClassModel.findById(req.params.id);
  if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });
  if (cls.price !== 0) return res.status(409).json({ success: false, message: 'This class is not free' });
  if (cls.cancelledAt) return res.status(409).json({ success: false, message: 'This class was cancelled' });

  const wanted = cls.freeApproval?.requestedStatus;
  cls.freeApproval = {
    status: decision === 'approve' ? 'approved' : 'rejected',
    requestedAt: cls.freeApproval?.requestedAt,
    requestedStatus: wanted,
    decidedAt: new Date(),
    decidedBy: req.user!.id as any,
    note,
  };
  if (decision === 'approve' && wanted === 'published') cls.status = 'published';
  if (decision === 'reject' && cls.status === 'published') cls.status = 'draft';
  await cls.save();

  const title = decision === 'approve' ? 'Free class approved' : 'Free class not approved';
  const message =
    decision === 'approve'
      ? `"${cls.title}" can run for free${cls.status === 'published' ? ' and is now live' : '. Publish it when you’re ready'}.`
      : `"${cls.title}" can’t run for free: ${note}. Set a price within the course range to publish it.`;
  await NotificationModel.create({ userId: cls.instructor.id, type: 'class', title, message, read: false, actionUrl: `/edit-class/${cls.id}` }).catch(() => {});
  await logActivity({
    category: 'class',
    action: decision === 'approve' ? 'free_approved' : 'free_rejected',
    message: `Admin ${decision === 'approve' ? 'approved' : 'rejected'} free pricing for "${cls.title}"${note ? `: ${note}` : ''}`,
    actorId: req.user!.id,
    actorName: 'Admin',
    actorRole: 'admin',
    targetUserId: String(cls.instructor.id),
    targetClassId: cls.id,
  });
  return res.json({ success: true, message: decision === 'approve' ? 'Free class approved' : 'Free class rejected' });
});

export default router;
