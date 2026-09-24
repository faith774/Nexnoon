import { computeQualityScore, DEFAULT_QUALITY_WEIGHTS } from '../models/PlatformSettings';
import { isCertActive, lifecycleStageOf } from './certification';

export type AttendanceState = 'present' | 'late' | 'absent' | 'excused';

/** Manual marks win; otherwise any join signal counts as attended. */
export function attendanceStateOf(rec: any): AttendanceState | null {
  if (!rec) return null;
  if (rec.manualStatus) return rec.manualStatus;
  if (rec.createdByMark) return null;
  if (rec.zoomJoinedAt || rec.sdkJoinedAt || (rec.authorizedAt && !rec.pendingJoin)) return rec.late ? 'late' : 'present';
  return null;
}

export const isHeldSession = (s: any, now = Date.now()) =>
  s.status === 'completed' || (s.status !== 'cancelled' && new Date(s.endTime).getTime() < now);

type Inputs = {
  instructors: any[];
  classes: any[];
  /** Every enrollment, including dropped ones (needed for dropout). */
  enrollments: any[];
  sessions: any[];
  attendance: any[];
  /** Public (non-hidden) reviews only. */
  reviews: any[];
  incidents: any[];
  payments: any[];
  weights?: typeof DEFAULT_QUALITY_WEIGHTS;
  now?: number;
};

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);

/** Class-level delivery metrics shared by the quality board and the KPI dashboard. */
export function classDeliveryStats(classIds: Set<string>, input: Pick<Inputs, 'classes' | 'enrollments' | 'sessions' | 'attendance'>, now = Date.now()) {
  const enrolls = input.enrollments.filter((e) => classIds.has(String(e.classId)));
  const dropped = enrolls.filter((e) => e.status === 'dropped').length;
  const activeByClass = new Map<string, number>();
  for (const e of enrolls) {
    if (e.status === 'dropped') continue;
    activeByClass.set(String(e.classId), (activeByClass.get(String(e.classId)) || 0) + 1);
  }

  const classSessions = input.sessions.filter((s) => classIds.has(String(s.classId)));
  const held = classSessions.filter((s) => isHeldSession(s, now));
  const recordsBySession = new Map<string, any[]>();
  for (const a of input.attendance) {
    if (!classIds.has(String(a.classId))) continue;
    const key = String(a.sessionId);
    recordsBySession.set(key, [...(recordsBySession.get(key) || []), a]);
  }
  let expected = 0;
  let attended = 0;
  for (const s of held) {
    const recs = recordsBySession.get(String(s._id)) || [];
    const excused = recs.filter((r) => attendanceStateOf(r) === 'excused').length;
    expected += Math.max(0, (activeByClass.get(String(s.classId)) || 0) - excused);
    attended += recs.filter((r) => ['present', 'late'].includes(attendanceStateOf(r) || '')).length;
  }

  // A cohort is finished once it has held sessions and nothing upcoming, or its end date passed.
  const endedIds = new Set(
    input.classes
      .filter((c) => classIds.has(String(c._id)))
      .filter((c) => {
        const own = classSessions.filter((s) => String(s.classId) === String(c._id) && s.status !== 'cancelled');
        const upcoming = own.some((s) => new Date(s.endTime).getTime() >= now);
        return (own.length > 0 && !upcoming) || (c.endDate && new Date(c.endDate).getTime() < now);
      })
      .map((c) => String(c._id))
  );
  const finished = enrolls.filter((e) => endedIds.has(String(e.classId)));
  const active = enrolls.filter((e) => e.status !== 'dropped');
  const completionRate = finished.length
    ? pct(finished.filter((e) => e.status === 'completed').length, finished.length)
    : active.length
      ? Math.round(active.reduce((s, e) => s + (e.progress || 0), 0) / active.length)
      : 0;

  return {
    enrollments: enrolls.length,
    activeEnrollments: active.length,
    dropped,
    dropoutRate: pct(dropped, enrolls.length),
    completionRate,
    completionBasis: finished.length ? ('finished_cohorts' as const) : ('progress' as const),
    heldSessions: held.length,
    attendanceRate: expected ? Math.min(100, pct(attended, expected)) : 0,
    attendanceExpected: expected,
    attended,
  };
}

export function computeInstructorQuality(input: Inputs) {
  const now = input.now ?? Date.now();
  const weights = input.weights || DEFAULT_QUALITY_WEIGHTS;

  return input.instructors.map((instructor) => {
    const id = String(instructor._id);
    const taught = input.classes.filter(
      (c) =>
        String(c.instructor?.id) === id ||
        (c.teachingTeam || []).some((m: any) => String(m.userId) === id && m.status === 'accepted')
    );
    const led = taught.filter((c) => String(c.instructor?.id) === id);
    const classIds = new Set(taught.map((c) => String(c._id)));
    const ledIds = new Set(led.map((c) => String(c._id)));

    const delivery = classDeliveryStats(classIds, input, now);

    const reviews = input.reviews.filter((r) => classIds.has(String(r.classId)));
    const avgRating = reviews.length ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length : 0;
    const satisfaction = pct(reviews.filter((r) => r.rating >= 4).length, reviews.length);
    const feedbackCount = reviews.filter((r) => (r.comment || '').trim()).length;

    const incidents = input.incidents.filter(
      (i) => String(i.instructorId || '') === id || (!i.instructorId && i.classId && ledIds.has(String(i.classId)))
    );
    const openIncidents = incidents.filter((i) => i.status === 'open' || i.status === 'investigating');

    const adminEvaluation =
      typeof instructor.adminEvaluation === 'number' ? Math.max(0, Math.min(100, instructor.adminEvaluation)) : 70;

    const qualityScore = computeQualityScore({
      learnerRating: avgRating,
      completionRate: delivery.completionRate,
      attendanceRate: delivery.attendanceRate,
      feedbackScore: reviews.length ? satisfaction : 0,
      adminEvaluation,
      weights: weights as any,
    });

    const paid = input.payments.filter((p) => classIds.has(String(p.classId)) && p.status === 'completed');
    const earningsByCurrency = paid.reduce<Record<string, number>>((acc, p) => {
      acc[p.currency] = (acc[p.currency] || 0) + p.amount;
      return acc;
    }, {});
    const certs = instructor.certifications || [];

    return {
      id,
      fullName: instructor.fullName,
      email: instructor.email,
      instructorStatus: instructor.instructorStatus || 'none',
      lifecycleStage: lifecycleStageOf(instructor),
      reviewDueAt: instructor.lifecycle?.reviewDueAt || null,
      improvementDueAt: instructor.lifecycle?.improvementPlan?.dueAt || null,
      activeCertifications: certs.length ? certs.filter((c: any) => isCertActive(c)).length : (instructor.approvedCourseIds || []).length,
      adminEvaluation,
      classesTaught: taught.length,
      classesLed: led.length,
      publishedClasses: taught.filter((c) => c.status === 'published').length,
      classIds: [...classIds],
      totalStudents: delivery.activeEnrollments,
      totalEarnings: paid.filter((p) => (p.currency || 'usd').toLowerCase() === 'usd').reduce((s, p) => s + p.amount, 0),
      earningsByCurrency,
      avgRating: Number(avgRating.toFixed(2)),
      reviewsCount: reviews.length,
      satisfaction,
      feedbackCount,
      completionRate: delivery.completionRate,
      completionBasis: delivery.completionBasis,
      attendanceRate: delivery.attendanceRate,
      heldSessions: delivery.heldSessions,
      dropoutRate: delivery.dropoutRate,
      dropped: delivery.dropped,
      incidentsTotal: incidents.length,
      incidentsOpen: openIncidents.length,
      incidentsHighOpen: openIncidents.filter((i) => i.severity === 'high').length,
      qualityScore,
      assignmentCount: taught.reduce((s, c) => s + ((c.assignments as any[])?.length || 0), 0),
      createdAt: instructor.createdAt,
    };
  });
}
