import type { ICertification, IUser, LifecycleStage } from '../models/User';

type CertHolder = Pick<IUser, 'approvedCourseIds'> & { certifications?: ICertification[] | any[] };

export function isCertActive(c: Pick<ICertification, 'status' | 'expiresAt'>, now = new Date()) {
  return c.status === 'active' && (!c.expiresAt || new Date(c.expiresAt) > now);
}

/**
 * PRD authorization rule: instructor × course × language.
 * A certification without a language (legacy course-level approval) covers every language,
 * and a class without a language offering only needs the course.
 * Instructors with no certification rows fall back to the legacy `approvedCourseIds` list.
 */
export function isCertifiedFor(user: CertHolder | null | undefined, courseId: string, languageOfferingId?: string | null): boolean {
  if (!user) return false;
  const certs = (user.certifications || []) as ICertification[];
  if (!certs.length) return (user.approvedCourseIds || []).some((id) => String(id) === courseId);
  return certs.some(
    (c) =>
      isCertActive(c) &&
      String(c.courseId) === courseId &&
      (!c.languageOfferingId || !languageOfferingId || String(c.languageOfferingId) === String(languageOfferingId))
  );
}

/** Keeps the legacy `approvedCourseIds` list equal to the courses with at least one active certification. */
export function syncApprovedCourseIds(user: IUser) {
  const ids = new Map<string, any>();
  for (const c of user.certifications || []) {
    if (isCertActive(c)) ids.set(String(c.courseId), c.courseId);
  }
  user.approvedCourseIds = [...ids.values()];
}

/** Stage for accounts created before lifecycle tracking existed. */
export function lifecycleStageOf(user: Pick<IUser, 'instructorStatus' | 'role'> & { lifecycle?: { stage?: LifecycleStage } }): LifecycleStage | null {
  if (user.role !== 'instructor') return null;
  if (user.lifecycle?.stage) return user.lifecycle.stage;
  switch (user.instructorStatus) {
    case 'approved':
      return 'active';
    case 'rejected':
      return 'rejected';
    case 'suspended':
      return 'suspended';
    default:
      return 'applied';
  }
}
