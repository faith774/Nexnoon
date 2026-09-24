import { z } from 'zod';
import { ClassScheduleModel } from '../models/Class';
import { EnrollmentModel } from '../models/Enrollment';
import { AttendanceRecordModel } from '../models/AttendanceRecord';
import { attendanceStateOf, classDeliveryStats, isHeldSession } from './quality';

/** Session × learner attendance grid for one class (auto join signals + manual marks). */
export async function buildAttendanceMatrix(cls: { _id: unknown; title: string; timezone?: string | null }) {
  const [sessions, enrollments, records] = await Promise.all([
    ClassScheduleModel.find({ classId: cls._id, status: { $ne: 'cancelled' } }).sort({ startTime: 1 }).lean(),
    EnrollmentModel.find({ classId: cls._id, status: { $ne: 'dropped' } }).populate('userId', 'fullName email avatar').lean(),
    AttendanceRecordModel.find({ classId: cls._id }).lean(),
  ]);
  const now = Date.now();
  const bySessionUser = new Map(records.map((r) => [`${r.sessionId}:${r.userId}`, r]));

  const learners = enrollments.map((e: any) => ({
    userId: String(e.userId?._id || e.userId),
    name: e.userId?.fullName || 'Deleted user',
    email: e.userId?.email || '',
    avatar: e.userId?.avatar || '',
    enrollmentStatus: e.status,
  }));
  const held = sessions.filter((s) => isHeldSession(s, now));

  const cells: Record<string, { state: string | null; source: 'manual' | 'auto' | null; joinedAt: string | null; durationSeconds: number | null }> = {};
  for (const s of sessions) {
    const isHeld = isHeldSession(s, now);
    for (const l of learners) {
      const rec: any = bySessionUser.get(`${s._id}:${l.userId}`);
      const state = attendanceStateOf(rec) ?? (isHeld ? 'absent' : null);
      cells[`${s._id}:${l.userId}`] = {
        state,
        source: rec?.manualStatus ? 'manual' : rec && !rec.createdByMark && attendanceStateOf(rec) ? 'auto' : null,
        joinedAt: rec?.zoomJoinedAt || rec?.sdkJoinedAt || (rec && !rec.createdByMark && !rec.pendingJoin ? rec.authorizedAt : null) || null,
        durationSeconds: rec?.durationSeconds ?? null,
      };
    }
  }
  const attended = (keys: string[]) => keys.filter((k) => ['present', 'late'].includes(cells[k]?.state || '')).length;

  return {
    class: { id: String(cls._id), title: cls.title, timezone: cls.timezone || null },
    sessions: sessions.map((s) => ({
      id: String(s._id),
      sessionNumber: s.sessionNumber,
      title: s.title,
      startTime: s.startTime,
      endTime: s.endTime,
      status: s.status,
      held: isHeldSession(s, now),
      rate:
        isHeldSession(s, now) && learners.length
          ? Math.round((attended(learners.map((l) => `${s._id}:${l.userId}`)) / learners.length) * 100)
          : null,
    })),
    learners: learners.map((l) => ({
      ...l,
      rate: held.length ? Math.round((attended(held.map((s) => `${s._id}:${l.userId}`)) / held.length) * 100) : null,
    })),
    cells,
    summary: classDeliveryStats(new Set([String(cls._id)]), { classes: [cls], enrollments, sessions, attendance: records }),
  };
}

/** A learner who connects this long after the scheduled start is marked late. */
export const LATE_AFTER_START_MS = 10 * 60_000;

/** Adds the session to the enrollment's attended list and recomputes progress. Never throws. */
export async function creditSessionAttendance(enrollmentId: string, classId: string, sessionId: string) {
  try {
    await EnrollmentModel.updateOne({ _id: enrollmentId }, { $addToSet: { attendedSessions: sessionId } });
    const [enrollment, totalSessions] = await Promise.all([
      EnrollmentModel.findById(enrollmentId),
      ClassScheduleModel.countDocuments({ classId, status: { $ne: 'cancelled' } }),
    ]);
    if (!enrollment || totalSessions === 0) return;
    const attended = enrollment.attendedSessions.length;
    enrollment.progress = Math.min(100, Math.round((attended / totalSessions) * 100));
    if (attended >= totalSessions && enrollment.status === 'active') {
      enrollment.status = 'completed';
      enrollment.completedAt = new Date();
    }
    await enrollment.save();
  } catch (error) {
    console.error('Failed to record session attendance:', error);
  }
}

/**
 * Turns a pending join into real attendance. `source` says what proved the learner got in:
 * the browser (SDK connected / meeting link opened) or a Zoom participant webhook.
 * Lateness is judged from the actual join time, and manual marks are left alone.
 */
export async function confirmAttendance(
  record: InstanceType<typeof AttendanceRecordModel>,
  session: { id?: string; _id?: unknown; startTime: Date; classId: unknown },
  source: 'client' | 'zoom',
  at = new Date()
) {
  const firstConfirmation = !record.sdkJoinedAt && !record.zoomJoinedAt && (record.pendingJoin || record.createdByMark);
  if (source === 'client' && !record.sdkJoinedAt) record.sdkJoinedAt = at;
  if (source === 'zoom' && !record.zoomJoinedAt) record.zoomJoinedAt = at;
  if (record.pendingJoin || firstConfirmation) {
    record.pendingJoin = false;
    if (!record.manualStatus) record.late = at.getTime() > new Date(session.startTime).getTime() + LATE_AFTER_START_MS;
  }
  await record.save();
  await creditSessionAttendance(String(record.enrollmentId), String(session.classId), String(session.id || session._id));
}

export const markAttendanceSchema = z.object({
  sessionId: z.string(),
  userId: z.string(),
  status: z.enum(['present', 'late', 'absent', 'excused']).nullable(),
});

type MarkResult = { ok: true; sessionTitle: string } | { ok: false; status: number; message: string };

/** Sets (or clears, with `status: null`) a manual attendance mark. */
export async function markAttendance(
  classId: string,
  mark: z.infer<typeof markAttendanceSchema>,
  markedBy: string
): Promise<MarkResult> {
  const { sessionId, userId, status } = mark;
  const [session, enrollment] = await Promise.all([
    ClassScheduleModel.findOne({ _id: sessionId, classId }),
    EnrollmentModel.findOne({ classId, userId, status: { $ne: 'dropped' } }),
  ]);
  if (!session) return { ok: false, status: 404, message: 'Session not found' };
  if (!enrollment) return { ok: false, status: 404, message: 'Learner is not enrolled in this class' };
  if (status && new Date(session.startTime).getTime() > Date.now()) {
    return { ok: false, status: 409, message: 'You can mark attendance once the session has started' };
  }

  const existing = await AttendanceRecordModel.findOne({ sessionId, userId });
  if (status === null) {
    if (existing?.createdByMark) await existing.deleteOne();
    else if (existing) {
      existing.manualStatus = undefined;
      existing.markedBy = markedBy as any;
      existing.markedAt = new Date();
      await existing.save();
    }
  } else if (existing) {
    existing.manualStatus = status;
    existing.markedBy = markedBy as any;
    existing.markedAt = new Date();
    await existing.save();
  } else {
    await AttendanceRecordModel.create({
      classId,
      sessionId,
      userId,
      enrollmentId: enrollment._id,
      authorizedAt: session.startTime,
      late: status === 'late',
      manualStatus: status,
      markedBy,
      markedAt: new Date(),
      createdByMark: true,
    });
  }
  return { ok: true, sessionTitle: session.title };
}
