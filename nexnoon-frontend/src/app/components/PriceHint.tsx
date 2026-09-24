import type { Course } from '@/types/api';

export function priceRangeMessage(course: Course | undefined, rawPrice: string | number): string | null {
  const price = Number(rawPrice);
  if (!course?.pricing || !Number.isFinite(price) || price <= 0) return null;
  const { minPrice, maxPrice } = course.pricing;
  if (minPrice != null && price < minPrice) return `Price must be at least $${minPrice} for ${course.title}.`;
  if (maxPrice != null && price > maxPrice) return `Price can’t be more than $${maxPrice} for ${course.title}.`;
  return null;
}

export default function PriceHint({ course, price }: { course?: Course; price: string | number }) {
  const min = course?.pricing?.minPrice;
  const max = course?.pricing?.maxPrice;
  const error = priceRangeMessage(course, price);
  const free = String(price).trim() !== '' && Number(price) === 0;

  return (
    <div className="mt-1.5 space-y-1 text-xs">
      {min != null || max != null ? (
        <p className="text-[#6b655c]">
          Allowed range for this course:{' '}
          {min != null && max != null ? `$${min} – $${max}` : min != null ? `from $${min}` : `up to $${max}`}
        </p>
      ) : null}
      {error ? <p className="text-rose-700">{error}</p> : null}
      {free ? (
        <p className="text-[#8a5a1f]">
          Free classes need Nexnoon approval before they go live. Never collect payment from learners outside Nexnoon.
        </p>
      ) : null}
    </div>
  );
}
