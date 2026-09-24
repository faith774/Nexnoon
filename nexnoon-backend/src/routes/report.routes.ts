import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { logActivity } from '../models/ActivityLog';
import { ClassModel } from '../models/Class';
import { EnrollmentModel } from '../models/Enrollment';
import { IncidentModel } from '../models/Incident';
import { NotificationModel } from '../models/Notification';
import { User } from '../models/User';

/** Learners report problems with a class they're enrolled in. Reports become admin incidents. */
const router = Router();

const REPORT_TYPES = ['off_platform_payment', 'instructor_no_show', 'conduct', 'curriculum_drift', 'technical', 'learner_complaint', 'other'] as const;

const reportSchema = z.object({
  type: z.enum(REPORT_TYPES),
  description: z.string().trim().min(10, 'Tell us a little more (at least 10 characters)').max(3000),
});

const TITLES: Record<(typeof REPORT_TYPES)[number], string> = {
  off_platform_payment: 'Asked to pay outside Nexnoon',
  instructor_no_show: 'Instructor did not show up',
  conduct: 'Inappropriate behaviour',
  curriculum_drift: 'Class not following the course',
  technical: 'Technical problem',
  learner_complaint: 'Learner complaint',
  other: 'Other issue',
};

router.post('/classes/:classId', requireAuth, rateLimit({ windowMs: 60 * 60_000, max: 5, keyPrefix: 'class-report' }), async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.classId)) return res.status(400).json({ success: false, message: 'Invalid class' });
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid report' });

  const [cls, enrollment, reporter] = await Promise.all([
    ClassModel.findById(req.params.classId).select('title instructor'),
    EnrollmentModel.exists({ classId: req.params.classId, userId: req.user!.id }),
    User.findById(req.user!.id).select('fullName role'),
  ]);
  if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });
  if (!enrollment) return res.status(403).json({ success: false, message: 'Only learners in this class can report it' });

  const { type, description } = parsed.data;
  const severity = type === 'off_platform_payment' || type === 'conduct' ? 'high' : type === 'instructor_no_show' ? 'medium' : 'low';
  const incident = await IncidentModel.create({
    type,
    severity,
    title: `${TITLES[type]} — ${cls.title}`.slice(0, 200),
    description,
    classId: cls._id,
    instructorId: cls.instructor?.id,
    learnerId: req.user!.id,
    occurredAt: new Date(),
    reportedBy: req.user!.id,
    reportedByName: reporter?.fullName || 'Learner',
    reporterRole: 'student',
  });

  await logActivity({
    category: 'learner',
    action: 'class_report',
    message: `${reporter?.fullName || 'A learner'} reported "${cls.title}": ${TITLES[type]}`,
    actorId: req.user!.id,
    actorName: reporter?.fullName,
    actorRole: 'student',
    targetUserId: cls.instructor?.id ? String(cls.instructor.id) : undefined,
    targetClassId: String(cls._id),
  });
  if (severity === 'high') {
    const admins = await User.find({ role: 'admin' }).select('_id').lean();
    await NotificationModel.insertMany(
      admins.map((a) => ({
        userId: a._id,
        type: 'system',
        title: `Urgent report: ${TITLES[type]}`,
        message: `A learner reported "${cls.title}".`,
        read: false,
        actionUrl: '/admin/dashboard?tab=quality',
      }))
    ).catch(() => {});
  }

  return res.status(201).json({
    success: true,
    data: { id: String(incident._id) },
    message: 'Thanks — our team will review this privately. Your instructor is not told who reported it.',
  });
});

export default router;
