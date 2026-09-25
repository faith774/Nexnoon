import { ClassModel, ClassScheduleModel } from '../models/Class';
import { EnrollmentModel } from '../models/Enrollment';
import { PaymentModel } from '../models/Payment';
import { AssignmentSubmissionModel } from '../models/AssignmentSubmission';
import { ReviewModel } from '../models/Review';
import { AttendanceRecordModel } from '../models/AttendanceRecord';
import { WaitlistModel } from '../models/Waitlist';
import { User } from '../models/User';
import { getPlatformSettings } from '../models/PlatformSettings';
import { ENV } from '../config/env';
import { ensureCertificate } from './certificates';

type ClassState = 'upcoming' | 'in_progress' | 'finished' | 'completed' | 'cancelled' | 'left';
type AttendanceMark = 'present' | 'late' | 'absent' | 'excused' | 'missed';

type SessionRow = {
  id: string;
  classId: string;
  classTitle: string;
  title: string;
  sessionNumber: number;
  startTime: string | null;
  endTime: string | null;
  status: string;
  instructor: string;
  thumbnail: string;
};
type AssignmentRow = {
  id: string;
  classId: string;
  classTitle: string;
  title: string;
  description: string;
  dueDate: string | null;
  hasAttachment: boolean;
  status: 'due' | 'overdue' | 'submitted' | 'graded';
  submittedAt: string | null;
  grade: { score: number; maxScore: number; feedback: string; gradedAt: string | null } | null;
};

const iso = (d?: Date | string | null) => (d ? new Date(d).toISOString() : null);
const DAY = 86_400_000;

/** One payload for the learner dashboard: classes, schedule, coursework, certificates, payments and waitlist. */
export async function buildLearnerDashboard(userId: string) {
  const now = Date.now();
  const [user, settings, enrollments, waitlistEntries, payments] = await Promise.all([
    User.findById(userId).select('fullName timezone avatar').lean(),
    getPlatformSettings(),
    EnrollmentModel.find({ userId }).sort({ enrolledAt: -1 }),
    WaitlistModel.find({ userId, status: { $in: ['waiting', 'offered'] } }).lean(),
    PaymentModel.find({ userId }).sort({ createdAt: -1 }).lean(),
  ]);

  const classIds = [
    ...new Set([
      ...enrollments.map((e) => String(e.classId)),
      ...waitlistEntries.map((w) => String(w.classId)),
      ...payments.map((p) => String(p.classId)),
    ]),
  ];
  const [classes, sessions, submissions, reviews, attendance] = await Promise.all([
    ClassModel.find({ _id: { $in: classIds } })
      .select('title category language thumbnail instructor assignments status cancelledAt cancellationReason startDate endDate timezone price currency courseId')
      .lean(),
    ClassScheduleModel.find({ classId: { $in: enrollments.map((e) => e.classId) } })
      .select('classId title startTime endTime status sessionNumber recordingUrl')
      .sort({ startTime: 1 })
      .lean(),
    AssignmentSubmissionModel.find({ userId, classId: { $in: classIds } }).lean(),
    ReviewModel.find({ userId, classId: { $in: classIds } }).lean(),
    AttendanceRecordModel.find({ userId, classId: { $in: classIds } })
      .select('sessionId manualStatus late pendingJoin')
      .lean(),
  ]);

  const leadIds = [...new Set(classes.map((c) => String(c.instructor?.id)).filter(Boolean))];
  const leads = await User.find({ _id: { $in: leadIds } }).select('fullName avatar').lean();
  const leadById = new Map(leads.map((u) => [String(u._id), u]));
  const classById = new Map(classes.map((c) => [String(c._id), c]));
  const recordBySession = new Map(attendance.map((r) => [String(r.sessionId), r]));
  const submissionByKey = new Map(submissions.map((s) => [`${s.classId}:${s.assignmentId}`, s]));
  const reviewByClass = new Map(reviews.map((r) => [String(r.classId), r]));

  const instructorOf = (cls: (typeof classes)[number]) => {
    const lead = leadById.get(String(cls.instructor?.id));
    return {
      id: String(cls.instructor?.id || ''),
      name: lead?.fullName || cls.instructor?.name || 'Instructor',
      avatar: lead?.avatar || cls.instructor?.avatar || '',
    };
  };

  const markFor = (sessionId: string, attended: Set<string>): AttendanceMark => {
    const rec = recordBySession.get(sessionId);
    if (rec?.manualStatus) return rec.manualStatus;
    if (attended.has(sessionId)) return rec?.late ? 'late' : 'present';
    return 'missed';
  };

  const classCards: { state: ClassState; [key: string]: unknown }[] = [];
  const upcomingSessions: SessionRow[] = [];
  const pastSessions: (SessionRow & { attendance: AttendanceMark; hasRecording: boolean })[] = [];
  const assignments: AssignmentRow[] = [];
  const certificates: Record<string, unknown>[] = [];
  let attendedMs = 0;
  let attendedTotal = 0;
  let attendableTotal = 0;

  for (const e of enrollments) {
    const cls = classById.get(String(e.classId));
    if (!cls) continue;
    const classId = String(cls._id);
    const instructor = instructorOf(cls);
    const own = sessions.filter((s) => String(s.classId) === classId && s.status !== 'cancelled');
    const attended = new Set((e.attendedSessions || []).map(String));
    const held = own.filter((s) => new Date(s.startTime).getTime() <= now);
    const next = own.find((s) => s.status === 'live' || (s.status !== 'completed' && new Date(s.endTime).getTime() > now));
    const ended = own.length ? !next : !!(cls.endDate && new Date(cls.endDate).getTime() < now);
    const first = own[0];
    const last = own[own.length - 1];

    let state: ClassState;
    if (e.status === 'dropped') state = 'left';
    else if (cls.cancelledAt) state = 'cancelled';
    else if (e.status === 'completed') state = 'completed';
    else if (ended) state = 'finished';
    else if (!held.length) state = 'upcoming';
    else state = 'in_progress';

    const active = e.status !== 'dropped' && !cls.cancelledAt;
    if (active) {
      for (const s of held) {
        if (attended.has(String(s._id))) attendedMs += Math.max(0, new Date(s.endTime).getTime() - new Date(s.startTime).getTime());
      }
      attendedTotal += held.filter((s) => attended.has(String(s._id))).length;
      attendableTotal += held.length;
    }

    const classAssignments = (cls.assignments as any[]) || [];
    let submitted = 0;
    let graded = 0;
    let scoreSum = 0;
    for (const a of classAssignments) {
      const sub = submissionByKey.get(`${classId}:${a._id}`);
      if (sub) submitted += 1;
      if (sub?.grade) {
        graded += 1;
        scoreSum += (sub.grade.score / (sub.grade.maxScore || 100)) * 100;
      }
      if (e.status === 'dropped') continue;
      const due = a.dueDate ? new Date(a.dueDate).getTime() : null;
      const status: AssignmentRow['status'] = sub?.grade ? 'graded' : sub ? 'submitted' : due != null && due < now ? 'overdue' : 'due';
      assignments.push({
        id: String(a._id),
        classId,
        classTitle: cls.title,
        title: a.title,
        description: a.description || '',
        dueDate: iso(a.dueDate),
        hasAttachment: !!a.attachmentUrl,
        status,
        submittedAt: iso(sub?.submittedAt),
        grade: sub?.grade
          ? { score: sub.grade.score, maxScore: sub.grade.maxScore, feedback: sub.grade.feedback || '', gradedAt: iso(sub.grade.gradedAt) }
          : null,
      });
    }

    if (active) {
      for (const s of own) {
        const start = new Date(s.startTime).getTime();
        const end = new Date(s.endTime).getTime();
        const base = {
          id: String(s._id),
          classId,
          classTitle: cls.title,
          title: s.title,
          sessionNumber: s.sessionNumber,
          startTime: iso(s.startTime),
          endTime: iso(s.endTime),
          status: s.status,
          instructor: instructor.name,
          thumbnail: cls.thumbnail || '',
        };
        if (s.status === 'live' || (s.status !== 'completed' && end > now)) upcomingSessions.push(base);
        else if (start <= now) pastSessions.push({ ...base, attendance: markFor(String(s._id), attended), hasRecording: !!s.recordingUrl });
      }
    }

    let certificateId: string | null = null;
    if (e.status === 'completed') {
      certificateId = await ensureCertificate(e);
      if (certificateId) {
        certificates.push({
          certificateId,
          classId,
          classTitle: cls.title,
          instructor: instructor.name,
          thumbnail: cls.thumbnail || '',
          completedAt: iso(e.completedAt),
        });
      }
    }

    const review = reviewByClass.get(classId);
    const payment = payments.find((p) => String(p.classId) === classId);
    classCards.push({
      id: classId,
      enrollmentId: String(e._id),
      title: cls.title,
      category: cls.category || '',
      language: cls.language || '',
      thumbnail: cls.thumbnail || '',
      instructor,
      state,
      enrollmentStatus: e.status,
      progress:
        e.status === 'completed'
          ? 100
          : own.length
            ? Math.round((held.filter((s) => attended.has(String(s._id))).length / own.length) * 100)
            : 0,
      attended: held.filter((s) => attended.has(String(s._id))).length,
      held: held.length,
      totalSessions: own.length,
      nextSession: next
        ? { id: String(next._id), title: next.title, startTime: iso(next.startTime), endTime: iso(next.endTime), status: next.status }
        : null,
      firstSessionAt: iso(first?.startTime || cls.startDate),
      lastSessionAt: iso(last?.endTime || cls.endDate),
      assignments: {
        total: classAssignments.length,
        submitted,
        graded,
        averageScore: graded ? Math.round(scoreSum / graded) : null,
        open: classAssignments.length - submitted,
      },
      certificateId,
      enrolledAt: iso(e.enrolledAt),
      completedAt: e.status === 'completed' ? iso(e.completedAt) : null,
      droppedAt: e.status === 'dropped' ? iso(e.droppedAt) : null,
      cancellationReason: cls.cancelledAt ? cls.cancellationReason || '' : null,
      canReview: e.status === 'completed' || (e.status === 'active' && ended),
      review: review ? { id: String(review._id), rating: review.rating, comment: review.comment || '' } : null,
      payment: payment ? { status: payment.status, amount: payment.amount, currency: payment.currency.toUpperCase() } : null,
    });
  }

  upcomingSessions.sort((a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime());
  pastSessions.sort((a, b) => new Date(b.startTime!).getTime() - new Date(a.startTime!).getTime());
  assignments.sort((a, b) => {
    const rank = { overdue: 0, due: 1, submitted: 2, graded: 3 } as const;
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    const at = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bt = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return at - bt;
  });

  const nextUp = upcomingSessions[0] || null;
  const waitlist = await Promise.all(
    waitlistEntries.map(async (w) => {
      const cls = classById.get(String(w.classId));
      const position =
        w.status === 'waiting'
          ? (await WaitlistModel.countDocuments({ classId: w.classId, status: 'waiting', joinedAt: { $lt: w.joinedAt } })) + 1
          : null;
      return {
        classId: String(w.classId),
        classTitle: cls?.title || 'Class',
        thumbnail: cls?.thumbnail || '',
        instructor: cls ? instructorOf(cls).name : '',
        startDate: iso(cls?.startDate),
        status: w.status,
        position,
        joinedAt: iso(w.joinedAt),
        offerExpiresAt: w.status === 'offered' ? iso(w.offerExpiresAt) : null,
      };
    })
  );

  const refundWindowDays = settings.refundWindowDays ?? 7;
  const paymentRows = payments.map((p) => {
    const cls = classById.get(String(p.classId));
    return {
      id: String(p._id),
      classId: String(p.classId),
      classTitle: cls?.title || 'Class',
      amount: p.amount,
      currency: (p.currency || 'usd').toUpperCase(),
      status: p.status,
      createdAt: iso(p.createdAt),
      refundableUntil: p.status === 'completed' ? iso(new Date(new Date(p.createdAt).getTime() + refundWindowDays * DAY)) : null,
    };
  });

  const count = (s: ClassState) => classCards.filter((c) => c.state === s).length;
  return {
    profile: { name: user?.fullName || '', firstName: (user?.fullName || '').split(' ')[0] || '', timezone: user?.timezone || '' },
    policy: { joinEarlyMinutes: ENV.LIVE_CLASS_JOIN_EARLY_MINUTES, refundWindowDays },
    summary: {
      inProgress: count('in_progress'),
      upcoming: count('upcoming'),
      completed: count('completed'),
      finished: count('finished'),
      certificates: certificates.length,
      assignmentsDue: assignments.filter((a) => a.status === 'due' || a.status === 'overdue').length,
      overdue: assignments.filter((a) => a.status === 'overdue').length,
      hoursLearned: Math.round((attendedMs / 3_600_000) * 10) / 10,
      attendanceRate: attendableTotal ? Math.round((attendedTotal / attendableTotal) * 100) : null,
      sessionsThisWeek: upcomingSessions.filter((s) => new Date(s.startTime!).getTime() < now + 7 * DAY).length,
    },
    nextUp,
    classes: classCards,
    upcomingSessions: upcomingSessions.slice(0, 60),
    pastSessions: pastSessions.slice(0, 40),
    assignments,
    certificates,
    payments: paymentRows,
    waitlist,
  };
}
