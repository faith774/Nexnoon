import type { ICourse } from '../models/Course';
import type { IClass } from '../models/Class';

/** Returns an error message when a paid price falls outside the course's admin-set band. */
export function priceRangeError(course: Pick<ICourse, 'title' | 'pricing'> | null | undefined, price: number): string | null {
  if (!course || price <= 0) return null;
  const min = course.pricing?.minPrice;
  const max = course.pricing?.maxPrice;
  if (min != null && price < min) return `"${course.title}" classes must cost at least $${min}.`;
  if (max != null && price > max) return `"${course.title}" classes can cost at most $${max}.`;
  return null;
}

/** Free class still waiting for (or refused) admin approval. Legacy free classes have no record and pass. */
export function freeClassBlocked(cls: Pick<IClass, 'price' | 'freeApproval'>): boolean {
  return cls.price === 0 && !!cls.freeApproval && cls.freeApproval.status !== 'approved';
}
