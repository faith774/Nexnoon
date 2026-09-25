import { Router } from 'express';
import { releaseSeat } from '../utils/seats';
import { buildLearnerDashboard } from '../utils/learnerDashboard';
import { formatWhen, pickTimeZone } from '../utils/time';
import { sessionForViewer } from '../utils/sessionView';
import { isValidObjectId } from 'mongoose';
import { ClassModel, ClassScheduleModel } from '../models/Class';
import { EnrollmentModel } from '../models/Enrollment';
import { PaymentModel } from '../models/Payment';
import { AssignmentSubmissionModel } from '../models/AssignmentSubmission';
import { ReviewModel } from '../models/Review';
import { AttendanceRecordModel } from '../models/AttendanceRecord';
import { User, toPublicUser, toInstructorPublicProfile, toInstructorApplication } from '../models/User';
import { CourseModel, toCourseDto } from '../models/Course';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import {
  DEFAULT_QUALITY_WEIGHTS,
  getPlatformSettings,
  getMaxClassSeats,
} from '../models/PlatformSettings';
import { NotificationModel } from '../models/Notification';
import { ActivityLogModel, logActivity } from '../models/ActivityLog';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { ENV } from '../config/env';
import {
  buildInstructorDecisionEmail,
  buildAdminMessageEmail,
  sendEmailSafe,
} from '../utils/email';

import { isCertActive, lifecycleStageOf, syncApprovedCourseIds } from '../utils/certification';
import { attendanceStateOf, classDeliveryStats, computeInstructorQuality, isHeldSession } from '../utils/quality';
import { IncidentModel } from '../models/Incident';
import { PayoutModel } from '../models/Payout';

const router = Router();
const normalize = (doc: any) => ({ ...doc, id: String(doc._id) });
const normalizeAssignment = (assignment: any) => {
  const { _id, ...rest } = assignment;
  return { ...rest, id: String(_id) };
};

function isOnTeachingTeam(cls: any, userId: string) {
  if (String(cls.instructor?.id) === userId) return true;
  return (cls.teachingTeam || []).some(
    (m: any) => String(m.userId) === userId && (m.status === 'accepted' || m.role === 'lead')
  );
}

function hasClassAccess(cls: any, userId: string) {
  if (String(cls.instructor?.id) === userId) return true;
  return (cls.teachingTeam || []).some(
    (m: any) =>
      String(m.userId) === userId &&
      (m.status === 'accepted' || m.status === 'pending' || m.role === 'lead')
  );
}

router.get('/categories', async (_req, res) => {
  const categories = await ClassModel.aggregate([
    { $match: { status: 'published' } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  res.json({ success: true, data: categories.map((c) => ({ name: c._id, count: c.count })) });
});

/** Instructor studio: everything for the classes the caller teaches, with the same quality math as the admin board. */
router.get('/instructor', requireAuth, requireRole('instructor', 'admin'), async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const now = Date.now();
  const DAY = 86_400_000;

  const [classes, me, platformSettings] = await Promise.all([
    ClassModel.find({
      $or: [
        { 'instructor.id': userId },
        { teachingTeam: { $elemMatch: { userId, status: { $in: ['accepted', 'pending'] } } } },
      ],
    })
      .sort({ createdAt: -1 })
      .lean(),
    User.findById(userId)
      .select('fullName email role avatar instructorStatus adminEvaluation approvedCourseIds certifications lifecycle createdAt')
      .lean(),
    getPlatformSettings(),
  ]);
  if (!me) return res.status(404).json({ success: false, message: 'User not found' });

  const roleIn = (c: any): 'lead' | 'support' | 'invited' => {
    if (String(c.instructor?.id) === userId) return 'lead';
    const member = (c.teachingTeam || []).find((m: any) => String(m.userId) === userId);
    return member?.status === 'accepted' ? 'support' : 'invited';
  };
  const taught = classes.filter((c) => roleIn(c) !== 'invited');
  const taughtIds = taught.map((c) => c._id);
  const certs: any[] = (me as any).certifications || [];
  const courseIds = [
    ...certs.map((c) => c.courseId),
    ...((me as any).approvedCourseIds || []),
    ...classes.map((c: any) => c.courseId).filter(Boolean),
  ];

  const [enrollments, sessions, attendance, reviews, incidents, payments, submissions, courses] = await Promise.all([
    EnrollmentModel.find({ classId: { $in: taughtIds } }).populate('userId', 'fullName email avatar').lean(),
    ClassScheduleModel.find({ classId: { $in: taughtIds } }).sort({ startTime: 1 }).lean(),
    AttendanceRecordModel.find({ classId: { $in: taughtIds } })
      .select('classId sessionId userId late authorizedAt pendingJoin sdkJoinedAt zoomJoinedAt manualStatus createdByMark')
      .lean(),
    ReviewModel.find({ classId: { $in: taughtIds }, status: { $ne: 'hidden' } })
      .populate('userId', 'fullName')
      .sort({ createdAt: -1 })
      .lean(),
    IncidentModel.find({ $or: [{ instructorId: userId }, { classId: { $in: taughtIds } }] })
      .select('instructorId classId status severity')
      .lean(),
    PaymentModel.find({ classId: { $in: taughtIds }, paymentMethod: { $ne: 'demo' } }).select('classId status amount currency').lean(),
    AssignmentSubmissionModel.find({ classId: { $in: taughtIds } })
      .populate('userId', 'fullName email')
      .sort({ submittedAt: -1 })
      .lean(),
    CourseModel.find({ _id: { $in: courseIds } }).select('title languageOfferings').lean(),
  ]);

  const weights = platformSettings.qualityWeights || DEFAULT_QUALITY_WEIGHTS;
  const seatCap = platformSettings.maxClassSeats || 25;
  const performance = computeInstructorQuality({
    instructors: [me],
    classes: taught,
    enrollments,
    sessions,
    attendance,
    reviews,
    incidents,
    payments,
    weights: weights as any,
  })[0];

  const coursesById = new Map(courses.map((c: any) => [String(c._id), c]));
  const classesById = new Map(taught.map((c) => [String(c._id), c]));
  const languageLabel = (courseId: unknown, offeringId: unknown) =>
    offeringId
      ? coursesById.get(String(courseId))?.languageOfferings?.find((o: any) => String(o._id) === String(offeringId))?.label || null
      : null;

  const activeEnrollments = enrollments.filter((e) => e.status !== 'dropped');
  const activeCountByClass = new Map<string, number>();
  for (const e of activeEnrollments) activeCountByClass.set(String(e.classId), (activeCountByClass.get(String(e.classId)) || 0) + 1);
  const recordsBySession = new Map<string, any[]>();
  for (const a of attendance) {
    const key = String(a.sessionId);
    recordsBySession.set(key, [...(recordsBySession.get(key) || []), a]);
  }

  const liveSessions = sessions.filter((s) => s.status !== 'cancelled');
  const sessionRows = liveSessions.map((s) => {
    const held = isHeldSession(s, now);
    const recs = recordsBySession.get(String(s._id)) || [];
    const expected = activeCountByClass.get(String(s.classId)) || 0;
    const attended = recs.filter((r) => ['present', 'late'].includes(attendanceStateOf(r) || '')).length;
    return {
      id: String(s._id),
      classId: String(s.classId),
      classTitle: classesById.get(String(s.classId))?.title || 'Class',
      classTimeZone: classesById.get(String(s.classId))?.timezone || null,
      sessionNumber: s.sessionNumber,
      title: s.title,
      startTime: s.startTime,
      endTime: s.endTime,
      status: s.status,
      held,
      expected,
      attended: held ? attended : null,
      /** Held with learners enrolled but not a single join or manual mark recorded. */
      needsAttendance: held && expected > 0 && recs.length === 0,
    };
  });
  const recentCutoff = now - 90 * DAY;
  const sessionsOut = sessionRows.filter((s) => !s.held || new Date(s.endTime).getTime() >= recentCutoff);
  const attendanceGaps = sessionRows.filter((s) => s.needsAttendance && new Date(s.endTime).getTime() >= recentCutoff);
  const nextSession = sessionRows.find((s) => new Date(s.endTime).getTime() > now) || null;

  const assignmentOf = (classId: unknown, assignmentId: unknown) =>
    ((classesById.get(String(classId)) as any)?.assignments || []).find((a: any) => String(a._id) === String(assignmentId));

  const gradingQueue = submissions
    .filter((s: any) => !s.grade?.gradedAt)
    .map((s: any) => {
      const assignment = assignmentOf(s.classId, s.assignmentId);
      return {
        id: String(s._id),
        classId: String(s.classId),
        classTitle: classesById.get(String(s.classId))?.title || 'Class',
        assignmentId: String(s.assignmentId),
        assignmentTitle: assignment?.title || 'Assignment',
        dueDate: assignment?.dueDate || null,
        learnerId: String(s.userId?._id || s.userId),
        learnerName: s.userId?.fullName || 'Deleted user',
        content: s.content || '',
        attachmentUrl: s.attachmentUrl || '',
        submittedAt: s.submittedAt,
        late: Boolean(assignment?.dueDate && new Date(s.submittedAt) > new Date(assignment.dueDate)),
      };
    })
    .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());

  const classRows = classes.map((c: any) => {
    const id = String(c._id);
    const role = roleIn(c);
    const own = sessionRows.filter((s) => s.classId === id);
    const max = c.maxStudents || seatCap;
    const enrolled = activeCountByClass.get(id) ?? c.enrolledStudents ?? 0;
    const stats = role === 'invited' ? null : classDeliveryStats(new Set([id]), { classes: taught, enrollments, sessions, attendance }, now);
    const classReviews = reviews.filter((r) => String(r.classId) === id);
    return {
      ...normalize(c),
      assignments: (c.assignments || []).map(normalizeAssignment),
      myRole: role,
      courseTitle: c.courseId ? coursesById.get(String(c.courseId))?.title || null : null,
      languageLabel: languageLabel(c.courseId, c.languageOfferingId),
      ops: {
        enrolled,
        maxStudents: max,
        seatsLeft: Math.max(0, max - enrolled),
        fillRate: max > 0 ? Math.round((enrolled / max) * 100) : 0,
        sessionsTotal: own.length,
        sessionsHeld: own.filter((s) => s.held).length,
        nextSessionAt: own.find((s) => new Date(s.endTime).getTime() > now)?.startTime || null,
        lastSessionAt: own.length ? own[own.length - 1].endTime : null,
        attendanceRate: stats?.attendanceRate ?? 0,
        completionRate: stats?.completionRate ?? 0,
        dropped: stats?.dropped ?? 0,
        ungraded: gradingQueue.filter((g) => g.classId === id).length,
        attendanceGaps: attendanceGaps.filter((g) => g.classId === id).length,
        avgRating: classReviews.length ? Number((classReviews.reduce((s, r) => s + r.rating, 0) / classReviews.length).toFixed(2)) : null,
        reviewsCount: classReviews.length,
      },
    };
  });

  const learners = enrollments.map((e: any) => {
    const classId = String(e.classId);
    const learnerId = String(e.userId?._id || e.userId);
    const cls: any = classesById.get(classId);
    const held = sessionRows.filter((s) => s.classId === classId && s.held);
    let attended = 0;
    let excused = 0;
    let lastSeenAt: Date | null = null;
    for (const s of held) {
      const rec = (recordsBySession.get(s.id) || []).find((r) => String(r.userId) === learnerId);
      const state = attendanceStateOf(rec);
      if (state === 'present' || state === 'late') {
        attended += 1;
        if (!lastSeenAt || new Date(s.startTime) > lastSeenAt) lastSeenAt = new Date(s.startTime);
      } else if (state === 'excused') excused += 1;
    }
    const expected = held.length - excused;
    const mine = submissions.filter((s: any) => String(s.classId) === classId && String(s.userId?._id || s.userId) === learnerId);
    const graded = mine.filter((s: any) => s.grade?.gradedAt && s.grade.maxScore);
    return {
      id: String(e._id),
      userId: learnerId,
      name: e.userId?.fullName || 'Deleted user',
      email: e.userId?.email || '',
      avatar: e.userId?.avatar || '',
      classId,
      classTitle: cls?.title || 'Class',
      status: e.status,
      progress: e.progress || 0,
      enrolledAt: e.enrolledAt,
      attendanceRate: expected > 0 ? Math.round((attended / expected) * 100) : null,
      sessionsAttended: attended,
      sessionsHeld: held.length,
      lastSeenAt,
      assignmentsTotal: (cls?.assignments || []).length,
      submitted: mine.length,
      avgGrade: graded.length
        ? Math.round(graded.reduce((s: number, g: any) => s + (g.grade.score / g.grade.maxScore) * 100, 0) / graded.length)
        : null,
    };
  });

  const certifications = certs.map((c) => ({
    id: String(c._id),
    courseId: String(c.courseId),
    courseTitle: coursesById.get(String(c.courseId))?.title || 'Course',
    languageLabel: languageLabel(c.courseId, c.languageOfferingId),
    status: isCertActive(c) ? 'active' : c.status === 'active' ? 'expired' : c.status,
    certifiedAt: c.certifiedAt || null,
    expiresAt: c.expiresAt || null,
    note: c.note || '',
  }));
  if (!certs.length) {
    for (const id of (me as any).approvedCourseIds || []) {
      certifications.push({
        id: String(id),
        courseId: String(id),
        courseTitle: coursesById.get(String(id))?.title || 'Course',
        languageLabel: null,
        status: 'active',
        certifiedAt: null,
        expiresAt: null,
        note: '',
      });
    }
  }

  const lifecycle = (me as any).lifecycle || {};
  const invites = classes
    .filter((c) => roleIn(c) === 'invited')
    .map((c: any) => ({ classId: String(c._id), title: c.title, leadName: c.instructor?.name || 'Lead instructor', startDate: c.startDate || null }));
  const led = taught.filter((c) => roleIn(c) === 'lead');
  const soon = (d: unknown, days: number) => Boolean(d && new Date(d as any).getTime() - now < days * DAY);

  res.json({
    success: true,
    data: {
      me: {
        id: userId,
        fullName: me.fullName,
        email: me.email,
        avatar: (me as any).avatar || '',
        instructorStatus: (me as any).instructorStatus || 'none',
        lifecycleStage: lifecycleStageOf(me as any),
        reviewDueAt: lifecycle.reviewDueAt || null,
        renewedAt: lifecycle.renewedAt || null,
        improvementPlan: lifecycle.improvementPlan?.startedAt ? lifecycle.improvementPlan : null,
        memberSince: (me as any).createdAt,
      },
      classes: classRows,
      sessions: sessionsOut,
      nextSession,
      gradingQueue,
      attendanceGaps,
      learners,
      reviews: reviews.slice(0, 100).map((r: any) => ({
        id: String(r._id),
        classId: String(r.classId),
        classTitle: classesById.get(String(r.classId))?.title || 'Class',
        learnerName: r.userId?.fullName || 'Learner',
        rating: r.rating,
        comment: r.comment || '',
        status: r.status,
        createdAt: r.createdAt,
      })),
      certifications,
      invites,
      performance: { ...performance, weights },
      actions: {
        ungraded: gradingQueue.length,
        attendanceGaps: attendanceGaps.length,
        invites: invites.length,
        freePending: led.filter((c: any) => c.freeApproval?.status === 'pending').length,
        freeRejected: led.filter((c: any) => c.freeApproval?.status === 'rejected').length,
        drafts: led.filter((c) => c.status === 'draft').length,
        publishedWithoutSessions: led.filter((c) => c.status === 'published' && !sessionRows.some((s) => s.classId === String(c._id))).length,
        certsExpiring: certifications.filter((c) => c.status === 'active' && c.expiresAt && soon(c.expiresAt, 30)).length,
        reviewDueSoon: soon(lifecycle.reviewDueAt, 30),
      },
      settings: { maxClassSeats: seatCap },
    },
  });
});

/** Search approved instructors for teaching-team invites (closed supply). */
router.get('/instructors', requireAuth, requireRole('instructor', 'admin'), async (req: AuthRequest, res) => {
  const q = String(req.query.q || '').trim();
  const filter: Record<string, unknown> = {
    role: 'instructor',
    instructorStatus: 'approved',
  };
  if (q) {
    filter.$or = [
      { fullName: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
      { headline: { $regex: q, $options: 'i' } },
      { expertise: { $elemMatch: { $regex: q, $options: 'i' } } },
    ];
  }

  const users = await User.find(filter)
    .select('fullName email avatar headline bio languages expertise')
    .sort({ fullName: 1 })
    .limit(30)
    .lean();

  return res.json({
    success: true,
    data: users.map((u) => ({
      id: String(u._id),
      fullName: u.fullName,
      email: u.email,
      avatar: u.avatar || '',
      headline: u.headline || '',
      bio: u.bio || '',
      languages: u.languages || [],
      expertise: u.expertise || [],
      profileReady: Boolean(
        u.avatar &&
          u.headline &&
          u.bio &&
          (u.languages || []).length > 0 &&
          (u.expertise || []).length > 0
      ),
    })),
  });
});

/** Public instructor profile (trust layer). */
router.get('/instructors/:id', async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid instructor ID' });
  }
  const user = await User.findById(req.params.id)
    .select('fullName avatar headline bio languages expertise instructorStatus role createdAt')
    .lean();
  if (!user || user.role !== 'instructor' || user.instructorStatus !== 'approved') {
    return res.status(404).json({ success: false, message: 'Instructor not found' });
  }

  const classes = await ClassModel.find({
    status: 'published',
    $or: [
      { 'instructor.id': String(user._id) },
      { teachingTeam: { $elemMatch: { userId: user._id, status: 'accepted' } } },
    ],
  })
    .select('title category enrolledStudents maxStudents price currency rating thumbnail')
    .sort({ createdAt: -1 })
    .limit(24)
    .lean();

  return res.json({
    success: true,
    data: {
      ...toInstructorPublicProfile(user),
      classes: classes.map((c: any) => ({
        id: String(c._id),
        title: c.title,
        category: c.category,
        enrolledStudents: c.enrolledStudents || 0,
        maxStudents: c.maxStudents,
        price: c.price,
        currency: c.currency,
        rating: c.rating,
        thumbnail: c.thumbnail,
      })),
    },
  });
});

router.get('/admin', requireAuth, requireRole('admin'), async (_req, res) => {
  const [
    users,
    classes,
    payments,
    platformSettings,
    reviews,
    attendance,
    enrollments,
    courses,
    submissions,
    sessions,
    activityLogs,
    allEnrollments,
    incidents,
    openPayouts,
  ] = await Promise.all([
    User.find()
      .select(
        'fullName email role instructorStatus adminEvaluation approvedCourseIds certifications lifecycle createdAt avatar headline bio languages expertise timezone zoomEmail zoomHostEnabled isEmailVerified requestedCourseIds yearsExperience teachingExperience linkedinUrl portfolioUrl sampleVideoUrl applicationUpdatedAt'
      )
      .sort({ createdAt: -1 })
      .lean(),
    ClassModel.find().sort({ createdAt: -1 }).lean(),
    PaymentModel.find({ paymentMethod: { $ne: 'demo' } }).sort({ createdAt: -1 }).lean(),
    getPlatformSettings(),
    ReviewModel.find({ status: { $ne: 'hidden' } }).lean(),
    AttendanceRecordModel.find()
      .select('classId sessionId userId late authorizedAt pendingJoin sdkJoinedAt zoomJoinedAt manualStatus createdByMark')
      .lean(),
    EnrollmentModel.find({ status: { $ne: 'dropped' } }).lean(),
    CourseModel.find().sort({ updatedAt: -1 }).lean(),
    AssignmentSubmissionModel.find().sort({ submittedAt: -1 }).limit(500).lean(),
    ClassScheduleModel.find().sort({ startTime: 1 }).lean(),
    ActivityLogModel.find().sort({ createdAt: -1 }).limit(100).lean(),
    EnrollmentModel.find().select('classId userId status progress enrolledAt').lean(),
    IncidentModel.find().select('instructorId classId status severity').lean(),
    PayoutModel.find({ status: { $in: ['requested', 'failed'] } }).select('net currency').lean(),
  ]);

  const instructors = users.filter((u) => u.role === 'instructor');
  const weights = platformSettings.qualityWeights || {
    learnerRating: 40,
    completion: 20,
    attendance: 15,
    feedback: 15,
    adminEvaluation: 10,
  };
  const seatCap = platformSettings.maxClassSeats || 25;
  const usersById = new Map(users.map((u) => [String(u._id), u]));
  const classesById = new Map(classes.map((c) => [String(c._id), c]));

  const instructorStats = computeInstructorQuality({
    instructors,
    classes,
    enrollments: allEnrollments,
    sessions,
    attendance,
    reviews,
    incidents,
    payments,
    weights: weights as any,
  });

  const learners = users.filter((u) => u.role === 'student');
  const pendingInstructors = instructors.filter((i) => i.instructorStatus === 'pending').length;
  const suspendedInstructors = instructors.filter((i) => i.instructorStatus === 'suspended').length;

  const enrollmentsByUser = enrollments.reduce<Record<string, number>>((acc, e) => {
    const uid = String(e.userId);
    acc[uid] = (acc[uid] || 0) + 1;
    return acc;
  }, {});

  const enrollmentRows = enrollments.map((e) => {
    const cls = classesById.get(String(e.classId));
    const learner = usersById.get(String(e.userId));
    return {
      id: String(e._id),
      userId: String(e.userId),
      learnerName: learner?.fullName || 'Deleted user',
      learnerEmail: learner?.email || '',
      classId: String(e.classId),
      classTitle: cls?.title || 'Deleted class',
      instructorName: cls?.instructor?.name || '',
      instructorId: cls?.instructor?.id ? String(cls.instructor.id) : '',
      status: e.status,
      progress: e.progress ?? 0,
      enrolledAt: e.enrolledAt,
      certificateUrl: e.certificateUrl || null,
    };
  });

  const now = Date.now();
  const classOps = classes.map((c) => {
    const max = c.maxStudents || seatCap;
    const enrolled = c.enrolledStudents || 0;
    const fillRate = max > 0 ? Math.round((enrolled / max) * 100) : 0;
    const classSessions = sessions.filter((s) => String(s.classId) === String(c._id));
    const nextSession = classSessions.find(
      (s) => s.status !== 'cancelled' && new Date(s.endTime).getTime() > now
    );
    const assignmentCount = (c.assignments as any[])?.length || 0;
    const submissionCount = submissions.filter((s) => String(s.classId) === String(c._id)).length;
    return {
      id: String(c._id),
      title: c.title,
      status: c.status,
      category: c.category,
      enrolledStudents: enrolled,
      maxStudents: max,
      fillRate,
      seatsLeft: Math.max(0, max - enrolled),
      price: c.price,
      currency: c.currency,
      thumbnail: c.thumbnail,
      instructorName: c.instructor?.name,
      instructorId: c.instructor?.id ? String(c.instructor.id) : '',
      teachingTeamCount: (c.teachingTeam || []).filter(
        (m: any) => m.role === 'support' && m.status !== 'removed' && m.status !== 'declined'
      ).length,
      assignmentCount,
      submissionCount,
      sessionCount: classSessions.length,
      nextSessionTitle: nextSession?.title || null,
      nextSessionStart: nextSession?.startTime || null,
      timezone: c.timezone || null,
      cancelledAt: c.cancelledAt || null,
      freeApproval: c.freeApproval
        ? { status: c.freeApproval.status, requestedAt: c.freeApproval.requestedAt || null, note: c.freeApproval.note || '' }
        : null,
      createdAt: c.createdAt,
    };
  });

  const assignmentOps = classes.flatMap((c) =>
    ((c.assignments as any[]) || []).map((a: any) => {
      const assignmentId = String(a._id);
      const related = submissions.filter(
        (s) => String(s.classId) === String(c._id) && String(s.assignmentId) === assignmentId
      );
      return {
        id: assignmentId,
        classId: String(c._id),
        classTitle: c.title,
        instructorName: c.instructor?.name || '',
        instructorId: c.instructor?.id ? String(c.instructor.id) : '',
        title: a.title,
        description: a.description || '',
        dueDate: a.dueDate || null,
        submissionCount: related.length,
        enrolledStudents: c.enrolledStudents || 0,
      };
    })
  );

  const fillRates = classOps.filter((c) => c.status === 'published').map((c) => c.fillRate);
  const avgFillRate = fillRates.length
    ? Math.round(fillRates.reduce((s, n) => s + n, 0) / fillRates.length)
    : 0;
  const nearFull = classOps.filter((c) => c.status === 'published' && c.fillRate >= 80).length;
  const lowFill = classOps.filter(
    (c) => c.status === 'published' && c.fillRate < 30 && c.enrolledStudents > 0
  ).length;

  // Compose a live activity feed from durable logs + recent platform events.
  type FeedItem = {
    id: string;
    category: string;
    action: string;
    message: string;
    createdAt: Date | string;
    actorName?: string;
  };
  const composed: FeedItem[] = [];

  for (const log of activityLogs) {
    composed.push({
      id: `log-${log._id}`,
      category: log.category,
      action: log.action,
      message: log.message,
      createdAt: log.createdAt,
      actorName: log.actorName,
    });
  }
  for (const p of payments.slice(0, 40)) {
    const cls = classesById.get(String(p.classId));
    composed.push({
      id: `pay-${p._id}`,
      category: 'payment',
      action: p.status,
      message: `Payment ${p.status}: ${p.amount} ${(p.currency || 'usd').toUpperCase()} · ${cls?.title || 'class'}`,
      createdAt: p.createdAt,
    });
  }
  for (const e of enrollmentRows
    .slice()
    .sort((a, b) => new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime())
    .slice(0, 40)) {
    composed.push({
      id: `enr-${e.id}`,
      category: 'enrollment',
      action: 'enrolled',
      message: `${e.learnerName} enrolled in ${e.classTitle}`,
      createdAt: e.enrolledAt,
      actorName: e.learnerName,
    });
  }
  for (const u of instructors.filter((i) => i.instructorStatus === 'pending').slice(0, 20)) {
    composed.push({
      id: `pending-${u._id}`,
      category: 'instructor',
      action: 'pending',
      message: `${u.fullName} applied to teach`,
      createdAt: u.createdAt,
      actorName: u.fullName,
    });
  }
  for (const s of submissions.slice(0, 30)) {
    const cls = classesById.get(String(s.classId));
    const learner = usersById.get(String(s.userId));
    composed.push({
      id: `sub-${s._id}`,
      category: 'assignment',
      action: 'submitted',
      message: `${learner?.fullName || 'Learner'} submitted an assignment in ${cls?.title || 'a class'}`,
      createdAt: s.submittedAt || (s as any).createdAt,
      actorName: learner?.fullName,
    });
  }

  composed.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const activity = composed.slice(0, 80);

  res.json({
    success: true,
    data: {
      users: users.map((u) => ({
        ...normalize(u),
        enrollmentCount: enrollmentsByUser[String(u._id)] || 0,
        adminEvaluation:
          typeof (u as any).adminEvaluation === 'number' ? (u as any).adminEvaluation : 70,
        approvedCourseIds: ((u as any).approvedCourseIds || []).map((id: any) => String(id)),
        ...(u.role === 'instructor'
          ? {
              ...toInstructorApplication(u),
              certifications: ((u as any).certifications || []).map((c: any) => ({
                id: String(c._id),
                courseId: String(c.courseId),
                languageOfferingId: c.languageOfferingId ? String(c.languageOfferingId) : null,
                status: isCertActive(c) ? 'active' : c.status === 'active' ? 'expired' : c.status,
                certifiedAt: c.certifiedAt,
                expiresAt: c.expiresAt || null,
                note: c.note || '',
              })),
              lifecycle: {
                stage: lifecycleStageOf(u as any),
                interview: (u as any).lifecycle?.interview || null,
                trainingCompletedAt: (u as any).lifecycle?.trainingCompletedAt || null,
                improvementPlan: (u as any).lifecycle?.improvementPlan || null,
                renewedAt: (u as any).lifecycle?.renewedAt || null,
                reviewDueAt: (u as any).lifecycle?.reviewDueAt || null,
                history: ((u as any).lifecycle?.history || []).slice(-30).reverse(),
              },
            }
          : {}),
      })),
      classes: classes.map(normalize),
      classOps,
      courses: courses.map(toCourseDto),
      payments: payments.map((p) => ({
        ...normalize(p),
        classTitle: classesById.get(String(p.classId))?.title,
        student: usersById.get(String((p as any).userId))?.fullName,
      })),
      enrollments: enrollmentRows,
      assignmentOps,
      activity,
      instructorStats,
      summary: {
        totalUsers: users.length,
        totalLearners: learners.length,
        totalInstructors: instructors.length,
        pendingInstructors,
        suspendedInstructors,
        pendingPayouts: openPayouts.length,
        urgentIncidents: incidents.filter((i) => i.severity === 'high' && (i.status === 'open' || i.status === 'investigating')).length,
        totalClasses: classes.length,
        publishedClasses: classes.filter((c) => c.status === 'published').length,
        totalEnrollments: enrollments.length,
        totalAssignments: assignmentOps.length,
        totalSubmissions: submissions.length,
        platformGmv: payments
          .filter((p) => p.status === 'completed')
          .reduce((sum, p) => sum + p.amount, 0),
        avgFillRate,
        nearFullClasses: nearFull,
        lowFillClasses: lowFill,
        totalCourses: courses.length,
        publishedCourses: courses.filter((c) => c.status === 'published').length,
      },
      settings: {
        maxClassSeats: platformSettings.maxClassSeats,
        qualityWeights: weights,
        platformFeePercent: platformSettings.platformFeePercent ?? 20,
        refundWindowDays: platformSettings.refundWindowDays ?? 7,
        minPayout: platformSettings.minPayout ?? 20,
        payoutFeePercent: platformSettings.payoutFeePercent ?? 0.25,
        payoutFeeFixed: platformSettings.payoutFeeFixed ?? 0.25,
        updatedAt: platformSettings.updatedAt,
      },
    },
  });
});

router.get(
  '/admin/classes/:classId/assignments/:assignmentId',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    const { classId, assignmentId } = req.params;
    if (!isValidObjectId(classId) || !isValidObjectId(assignmentId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }
    const cls = await ClassModel.findById(classId).lean();
    if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });
    const assignment = ((cls.assignments as any[]) || []).find((a) => String(a._id) === assignmentId);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    const [enrollments, submissions] = await Promise.all([
      EnrollmentModel.find({ classId: cls._id, status: { $ne: 'dropped' } })
        .populate('userId', 'fullName email avatar')
        .sort({ enrolledAt: 1 })
        .lean(),
      AssignmentSubmissionModel.find({ classId: cls._id, assignmentId })
        .populate('userId', 'fullName email avatar')
        .sort({ submittedAt: -1 })
        .lean(),
    ]);

    const due = assignment.dueDate ? new Date(assignment.dueDate).getTime() : null;
    const toSubmission = (s: any) => {
      const submittedAt = s.submittedAt || s.createdAt;
      return {
        id: String(s._id),
        content: s.content || '',
        attachmentUrl: s.attachmentUrl || '',
        submittedAt,
        updatedAt: s.updatedAt || submittedAt,
        late: due != null && new Date(submittedAt).getTime() > due,
        grade: s.grade
          ? {
              score: s.grade.score,
              maxScore: s.grade.maxScore,
              feedback: s.grade.feedback || '',
              gradedAt: s.grade.gradedAt,
              gradedByName: s.grade.gradedByName || '',
            }
          : null,
      };
    };
    const byUser = new Map(submissions.map((s: any) => [String(s.userId?._id || s.userId), s]));

    const roster = enrollments.map((e: any) => {
      const uid = String(e.userId?._id || e.userId);
      const sub = byUser.get(uid);
      byUser.delete(uid);
      return {
        userId: uid,
        name: e.userId?.fullName || 'Deleted user',
        email: e.userId?.email || '',
        avatar: e.userId?.avatar || '',
        enrolledAt: e.enrolledAt,
        enrolled: true,
        progress: e.progress ?? 0,
        submission: sub ? toSubmission(sub) : null,
      };
    });
    // Submissions from learners who have since left the class are still part of the record.
    for (const [uid, sub] of byUser) {
      const u = (sub as any).userId;
      roster.push({
        userId: uid,
        name: u?.fullName || 'Deleted user',
        email: u?.email || '',
        avatar: u?.avatar || '',
        enrolledAt: null,
        enrolled: false,
        progress: 0,
        submission: toSubmission(sub),
      });
    }

    const submitted = roster.filter((r) => r.submission);
    const late = submitted.filter((r) => r.submission!.late).length;
    const enrolledCount = roster.filter((r) => r.enrolled).length;
    const missing = roster.filter((r) => r.enrolled && !r.submission).length;

    res.json({
      success: true,
      data: {
        assignment: {
          id: assignmentId,
          title: assignment.title,
          description: assignment.description || '',
          dueDate: assignment.dueDate || null,
          attachmentUrl: assignment.attachmentUrl || '',
        },
        class: {
          id: String(cls._id),
          title: cls.title,
          status: cls.status,
          thumbnail: cls.thumbnail || '',
          instructorName: cls.instructor?.name || '',
          instructorId: cls.instructor?.id ? String(cls.instructor.id) : '',
        },
        roster,
        stats: {
          enrolled: enrolledCount,
          submitted: submitted.length,
          onTime: submitted.length - late,
          late,
          missing,
          isPastDue: due != null && due < Date.now(),
          graded: submitted.filter((r) => r.submission!.grade).length,
          avgScorePct: (() => {
            const graded = submitted.filter((r) => r.submission!.grade);
            if (!graded.length) return null;
            const sum = graded.reduce((s, r) => s + (r.submission!.grade!.score / r.submission!.grade!.maxScore) * 100, 0);
            return Math.round(sum / graded.length);
          })(),
        },
      },
    });
  }
);

const instructorDecisionSchema = z.object({
  status: z.enum(['approved', 'rejected', 'suspended']),
});

router.patch('/admin/instructors/:userId', requireAuth, requireRole('admin'), async (req, res) => {
  if (!isValidObjectId(req.params.userId)) {
    return res.status(400).json({ success: false, message: 'Invalid user ID' });
  }
  const parsed = instructorDecisionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'status must be approved, rejected, or suspended',
    });
  }

  const user = await User.findById(req.params.userId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  if (user.role !== 'instructor') {
    return res.status(400).json({ success: false, message: 'User is not an instructor applicant' });
  }

  user.instructorStatus = parsed.data.status;
  if (parsed.data.status === 'approved' && typeof user.adminEvaluation !== 'number') {
    user.adminEvaluation = 80;
  }
  if (parsed.data.status === 'suspended') {
    user.adminEvaluation = Math.min(user.adminEvaluation ?? 70, 30);
  }
  const stage = ({ approved: 'active', rejected: 'rejected', suspended: 'suspended' } as const)[parsed.data.status as 'approved' | 'rejected' | 'suspended'];
  if (stage) {
    user.lifecycle = user.lifecycle || ({ history: [] } as any);
    user.lifecycle!.stage = stage;
    user.lifecycle!.history.push({ stage, action: parsed.data.status, at: new Date(), by: (req as AuthRequest).user?.id as any, byName: 'Admin' });
  }
  await user.save();

  const titles: Record<string, string> = {
    approved: 'Instructor application approved',
    rejected: 'Instructor application rejected',
    suspended: 'Instructor account suspended',
  };
  const messages: Record<string, string> = {
    approved: 'You can now create and teach classes on Nexnoon.',
    rejected: 'Your instructor application was not approved. Contact support if you have questions.',
    suspended: 'Your teaching privileges are suspended. Contact support for details.',
  };

  await NotificationModel.create({
    userId: user.id,
    type: 'system',
    title: titles[parsed.data.status],
    message: messages[parsed.data.status],
    read: false,
    actionUrl: parsed.data.status === 'approved' ? '/instructor/dashboard' : '/teach',
  }).catch(() => {});

  await sendEmailSafe(
    user.email,
    parsed.data.status === 'approved'
      ? 'You’re approved to teach on Nexnoon'
      : parsed.data.status === 'suspended'
        ? 'Your Nexnoon instructor account was suspended'
        : 'Instructor application update',
    buildInstructorDecisionEmail(user.fullName, parsed.data.status)
  );

  const actor = (req as AuthRequest).user;
  await logActivity({
    category: 'instructor',
    action: parsed.data.status,
    message: `${user.fullName} was ${parsed.data.status} as instructor`,
    actorId: actor?.id,
    actorName: 'Admin',
    actorRole: 'admin',
    targetUserId: user.id,
    meta: { email: user.email },
  });

  return res.json({
    success: true,
    data: toPublicUser(user),
    message: `Instructor ${parsed.data.status}`,
  });
});

const adminEvalSchema = z.object({
  adminEvaluation: z.number().min(0).max(100),
});

const approvedCoursesSchema = z.object({
  approvedCourseIds: z.array(z.string()).max(50),
});

/** Assign which courses an instructor is certified to teach. */
router.patch(
  '/admin/instructors/:userId/approved-courses',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    if (!isValidObjectId(req.params.userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }
    const parsed = approvedCoursesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'approvedCourseIds must be an array of ids' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role !== 'instructor') {
      return res.status(400).json({ success: false, message: 'User is not an instructor' });
    }

    const ids = parsed.data.approvedCourseIds.filter((id) => isValidObjectId(id));
    const { CourseModel } = await import('../models/Course');
    const found = await CourseModel.find({ _id: { $in: ids } }).select('_id').lean();
    const keep = new Set(found.map((c) => String(c._id)));
    const actorId = (req as AuthRequest).user?.id;
    for (const cert of user.certifications || []) {
      if (!keep.has(String(cert.courseId)) && cert.status === 'active') cert.status = 'revoked';
    }
    // Course-level (all-language) certification for courses newly ticked here.
    for (const course of found) {
      const has = (user.certifications || []).some((c) => String(c.courseId) === String(course._id) && isCertActive(c));
      if (!has) user.certifications.push({ courseId: course._id, status: 'active', certifiedAt: new Date(), certifiedBy: actorId } as any);
    }
    syncApprovedCourseIds(user);
    await user.save();

    const actor = (req as AuthRequest).user;
    await logActivity({
      category: 'instructor',
      action: 'approved_courses',
      message: `${user.fullName} certified for ${found.length} course(s)`,
      actorId: actor?.id,
      actorName: 'Admin',
      actorRole: 'admin',
      targetUserId: user.id,
      meta: { approvedCourseIds: found.map((c) => String(c._id)) },
    });

    return res.json({
      success: true,
      data: toPublicUser(user),
      message: 'Approved courses updated',
    });
  }
);

/** Set manual admin evaluation component of the quality score (0–100). */
router.patch(
  '/admin/instructors/:userId/evaluation',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    if (!isValidObjectId(req.params.userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }
    const parsed = adminEvalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'adminEvaluation must be 0–100' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role !== 'instructor') {
      return res.status(400).json({ success: false, message: 'User is not an instructor' });
    }

    user.adminEvaluation = parsed.data.adminEvaluation;
    await user.save();

    const actor = (req as AuthRequest).user;
    await logActivity({
      category: 'instructor',
      action: 'evaluation',
      message: `Admin evaluation for ${user.fullName} set to ${parsed.data.adminEvaluation}`,
      actorId: actor?.id,
      actorName: 'Admin',
      actorRole: 'admin',
      targetUserId: user.id,
      meta: { adminEvaluation: parsed.data.adminEvaluation },
    });

    return res.json({
      success: true,
      data: { id: user.id, adminEvaluation: user.adminEvaluation },
      message: 'Admin evaluation updated',
    });
  }
);
const adminMessageSchema = z.object({
  subject: z.string().min(3).max(200),
  body: z.string().min(3).max(5000),
});

/** Super admin emails any user (instructor or learner) with an in-app copy. */
router.post('/admin/users/:userId/email', requireAuth, requireRole('admin'), async (req, res) => {
  if (!isValidObjectId(req.params.userId)) {
    return res.status(400).json({ success: false, message: 'Invalid user ID' });
  }
  const parsed = adminMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'subject and body are required' });
  }

  const user = await User.findById(req.params.userId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  await NotificationModel.create({
    userId: user.id,
    type: 'system',
    title: parsed.data.subject,
    message: parsed.data.body.slice(0, 500),
    read: false,
    actionUrl: '/notifications',
  }).catch(() => {});

  const result = await sendEmailSafe(
    user.email,
    parsed.data.subject,
    buildAdminMessageEmail({
      recipientName: user.fullName,
      subjectLine: parsed.data.subject,
      body: parsed.data.body,
    })
  );

  const actor = (req as AuthRequest).user;
  await logActivity({
    category: 'system',
    action: 'email',
    message: `Admin emailed ${user.fullName}: ${parsed.data.subject}`,
    actorId: actor?.id,
    actorName: 'Admin',
    actorRole: 'admin',
    targetUserId: user.id,
  });

  return res.json({
    success: true,
    data: { emailed: result.sent },
    message: result.sent ? 'Email sent' : 'Saved as notification (email provider not configured)',
  });
});

const profileRequestSchema = z.object({
  missing: z.array(z.string().min(1).max(80)).max(12).default([]),
});

/** Ask an instructor applicant to complete their teaching application. */
router.post(
  '/admin/instructors/:userId/request-profile',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    if (!isValidObjectId(req.params.userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }
    const parsed = profileRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'missing must be a list of item names' });
    }
    const user = await User.findById(req.params.userId);
    if (!user || user.role !== 'instructor') {
      return res.status(404).json({ success: false, message: 'Instructor not found' });
    }

    const link = `${ENV.FRONTEND_URL.replace(/\/+$/, '')}/instructor/application`;
    const missing = parsed.data.missing;
    const subject = 'Complete your Nexnoon teaching profile';
    const body = [
      `Thanks for applying to teach on Nexnoon. Before we can review your application, please complete your teaching profile.`,
      missing.length ? `Still needed: ${missing.join(', ')}.` : '',
      `Complete it here: ${link}`,
      `Complete profiles are reviewed faster.`,
    ]
      .filter(Boolean)
      .join('\n\n');

    await NotificationModel.create({
      userId: user.id,
      type: 'system',
      title: subject,
      message: missing.length ? `Still needed: ${missing.join(', ')}.`.slice(0, 500) : 'Please complete your teaching profile.',
      read: false,
      actionUrl: '/instructor/application',
    }).catch(() => {});

    const result = await sendEmailSafe(
      user.email,
      subject,
      buildAdminMessageEmail({ recipientName: user.fullName, subjectLine: subject, body })
    );

    const actor = (req as AuthRequest).user;
    await logActivity({
      category: 'instructor',
      action: 'profile_request',
      message: `Admin asked ${user.fullName} to complete their teaching profile`,
      actorId: actor?.id,
      actorName: 'Admin',
      actorRole: 'admin',
      targetUserId: user.id,
      meta: { missing },
    });

    return res.json({
      success: true,
      data: { emailed: result.sent },
      message: result.sent
        ? `Asked ${user.fullName} to complete their profile`
        : `Notification sent to ${user.fullName} (email provider not configured)`,
    });
  }
);

const adminCreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(100),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  role: z.enum(['student', 'instructor']),
  /** When creating an instructor, default to approved for academic onboarding. */
  instructorStatus: z.enum(['pending', 'approved']).optional(),
});

/** Academics create learners or tutors from the control panel. */
router.post('/admin/users', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
  const parsed = adminCreateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }

  const { email, password, firstName, lastName, role } = parsed.data;
  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    return res.status(400).json({ success: false, message: 'Email already registered' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const fullName = `${firstName.trim()} ${lastName.trim()}`;
  const instructorStatus =
    role === 'instructor'
      ? parsed.data.instructorStatus || 'approved'
      : 'none';

  const user = await User.create({
    email: email.toLowerCase().trim(),
    password: hashed,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    fullName,
    role,
    instructorStatus,
    isEmailVerified: true,
    adminEvaluation: role === 'instructor' && instructorStatus === 'approved' ? 80 : 70,
  });

  await NotificationModel.create({
    userId: user.id,
    type: 'system',
    title: role === 'instructor' ? 'Instructor account created' : 'Learner account created',
    message:
      role === 'instructor'
        ? instructorStatus === 'approved'
          ? 'An admin created your tutor account. You can sign in and teach.'
          : 'An admin created your tutor account. Approval is still pending.'
        : 'An admin created your learner account. You can sign in and enroll in classes.',
    read: false,
    actionUrl: role === 'instructor' ? '/instructor/dashboard' : '/my-classes',
  }).catch(() => {});

  await logActivity({
    category: role === 'instructor' ? 'instructor' : 'learner',
    action: 'created',
    message: `Admin created ${role} account for ${fullName}`,
    actorId: req.user?.id,
    actorName: 'Admin',
    actorRole: 'admin',
    targetUserId: user.id,
    meta: { email: user.email, instructorStatus },
  });

  return res.status(201).json({
    success: true,
    data: toPublicUser(user),
    message: `${role === 'instructor' ? 'Instructor' : 'Learner'} account created`,
  });
});

const adminEnrollSchema = z.object({
  userId: z.string().min(1),
  classId: z.string().min(1),
});

/** Force-enroll a learner into a class (academic ops; skips payment). */
router.post('/admin/enrollments', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
  const parsed = adminEnrollSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'userId and classId are required' });
  }
  if (!isValidObjectId(parsed.data.userId) || !isValidObjectId(parsed.data.classId)) {
    return res.status(400).json({ success: false, message: 'Invalid user or class ID' });
  }

  const [learner, cls] = await Promise.all([
    User.findById(parsed.data.userId),
    ClassModel.findById(parsed.data.classId),
  ]);
  if (!learner) return res.status(404).json({ success: false, message: 'Learner not found' });
  if (learner.role !== 'student') {
    return res.status(400).json({ success: false, message: 'Only student accounts can be enrolled' });
  }
  if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });

  const existing = await EnrollmentModel.findOne({
    classId: cls._id,
    userId: learner._id,
  });
  if (existing && existing.status !== 'dropped') {
    return res.status(200).json({
      success: true,
      data: normalize(existing.toObject()),
      message: 'Already enrolled',
    });
  }

  const maxClassSeats = await getMaxClassSeats();
  if ((cls.enrolledStudents || 0) >= maxClassSeats && !(existing && existing.status === 'dropped')) {
    return res.status(409).json({
      success: false,
      message: `Class is full (${maxClassSeats} seats).`,
    });
  }

  let enrollment;
  if (existing && existing.status === 'dropped') {
    const reserved = await ClassModel.findOneAndUpdate(
      {
        _id: cls._id,
        enrolledStudents: { $lt: maxClassSeats },
      },
      { $inc: { enrolledStudents: 1 }, $set: { maxStudents: maxClassSeats } },
      { new: true }
    );
    if (!reserved) {
      return res.status(409).json({
        success: false,
        message: `Class is full (${maxClassSeats} seats).`,
      });
    }
    existing.status = 'active';
    existing.progress = 0;
    existing.enrolledAt = new Date();
    existing.completedAt = undefined;
    await existing.save();
    enrollment = existing;
  } else {
    const reserved = await ClassModel.findOneAndUpdate(
      {
        _id: cls._id,
        enrolledStudents: { $lt: maxClassSeats },
      },
      { $inc: { enrolledStudents: 1 }, $set: { maxStudents: maxClassSeats } },
      { new: true }
    );
    if (!reserved) {
      return res.status(409).json({
        success: false,
        message: `Class is full (${maxClassSeats} seats).`,
      });
    }
    enrollment = await EnrollmentModel.create({
      classId: cls._id,
      userId: learner._id,
      status: 'active',
      progress: 0,
      enrolledAt: new Date(),
    });
  }

  await NotificationModel.create({
    userId: learner.id,
    type: 'system',
    title: 'Enrolled by admin',
    message: `You were enrolled in ${cls.title}`,
    read: false,
    actionUrl: `/classroom/${cls.id}`,
  }).catch(() => {});

  await logActivity({
    category: 'enrollment',
    action: 'admin_enroll',
    message: `Admin enrolled ${learner.fullName} in ${cls.title}`,
    actorId: req.user?.id,
    actorName: 'Admin',
    actorRole: 'admin',
    targetUserId: learner.id,
    targetClassId: cls.id,
  });

  return res.status(201).json({
    success: true,
    data: normalize(enrollment.toObject()),
    message: 'Learner enrolled',
  });
});

/** Drop a learner from a class (admin). */
router.delete(
  '/admin/enrollments/:enrollmentId',
  requireAuth,
  requireRole('admin'),
  async (req: AuthRequest, res) => {
    if (!isValidObjectId(req.params.enrollmentId)) {
      return res.status(400).json({ success: false, message: 'Invalid enrollment ID' });
    }

    const enrollment = await EnrollmentModel.findById(req.params.enrollmentId);
    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Enrollment not found' });
    }
    if (enrollment.status === 'dropped') {
      return res.json({ success: true, message: 'Already dropped' });
    }

    enrollment.status = 'dropped';
    enrollment.droppedAt = new Date();
    await enrollment.save();
    await releaseSeat(String(enrollment.classId));

    const [learner, cls] = await Promise.all([
      User.findById(enrollment.userId).select('fullName'),
      ClassModel.findById(enrollment.classId).select('title'),
    ]);

    await logActivity({
      category: 'enrollment',
      action: 'admin_drop',
      message: `Admin dropped ${learner?.fullName || 'learner'} from ${cls?.title || 'class'}`,
      actorId: req.user?.id,
      actorName: 'Admin',
      actorRole: 'admin',
      targetUserId: String(enrollment.userId),
      targetClassId: String(enrollment.classId),
    });

    return res.json({ success: true, message: 'Enrollment dropped' });
  }
);

router.get('/class/:id', requireAuth, async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid class ID' });
  const cls = await ClassModel.findById(req.params.id).lean();
  if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });
  const enrollment = await EnrollmentModel.findOne({
    classId: cls._id,
    userId: req.user!.id,
    status: { $ne: 'dropped' },
  }).lean();
  const canTeach = req.user!.role === 'admin' || isOnTeachingTeam(cls, req.user!.id);
  const canAccess = !!enrollment || canTeach || hasClassAccess(cls, req.user!.id) || req.user!.role === 'admin';
  if (!canAccess) {
    return res.status(403).json({ success: false, message: 'Enroll in this class to access its classroom' });
  }
  const sessions = await ClassScheduleModel.find({ classId: cls._id }).sort({ sessionNumber: 1 }).lean();
  const mySubmissions = enrollment
    ? await AssignmentSubmissionModel.find({ classId: cls._id, userId: req.user!.id }).lean()
    : [];

  let learners: any[] = [];
  let submissionStats: { assignmentId: string; count: number }[] = [];
  if (canTeach) {
    const [enrollments, submissions] = await Promise.all([
      EnrollmentModel.find({ classId: cls._id, status: { $ne: 'dropped' } })
        .populate('userId', 'fullName email')
        .sort({ enrolledAt: -1 })
        .lean(),
      AssignmentSubmissionModel.find({ classId: cls._id }).lean(),
    ]);
    learners = enrollments.map((e: any) => ({
      id: String(e._id),
      userId: String(e.userId?._id || ''),
      name: e.userId?.fullName || 'Deleted user',
      email: e.userId?.email || '',
      progress: e.progress ?? 0,
      status: e.status,
      enrolledAt: e.enrolledAt,
      certificateUrl: e.certificateUrl || null,
      attendedSessions: e.attendedSessions || [],
    }));
    const byAssignment = new Map<string, number>();
    for (const s of submissions as any[]) {
      const key = String(s.assignmentId);
      byAssignment.set(key, (byAssignment.get(key) || 0) + 1);
    }
    submissionStats = Array.from(byAssignment.entries()).map(([assignmentId, count]) => ({
      assignmentId,
      count,
    }));
  }

  res.json({
    success: true,
    data: {
      class: { ...normalize(cls), assignments: (cls.assignments || []).map(normalizeAssignment) },
      sessions: sessions.map((x) => sessionForViewer(normalize(x), canTeach)),
      enrollment: enrollment ? normalize(enrollment) : null,
      canTeach,
      mySubmissions: mySubmissions.map(normalize),
      learners,
      submissionStats,
      policy: {
        joinEarlyMinutes: ENV.LIVE_CLASS_JOIN_EARLY_MINUTES,
        lateJoinGraceMinutes: ENV.LIVE_CLASS_LATE_JOIN_GRACE_MINUTES,
        hostEarlyMinutes: ENV.LIVE_CLASS_HOST_EARLY_MINUTES,
      },
    },
  });
});

/**
 * Learner home dashboard — one round-trip: enrollments, next sessions,
 * due assignments, certificates, and progress (no N+1 class fetches).
 */
router.get('/learner', requireAuth, async (req: AuthRequest, res) => {
  return res.json({ success: true, data: await buildLearnerDashboard(req.user!.id) });
});

export default router;
