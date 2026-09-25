import BrandLoader from '@/app/components/BrandLoader';
import { useState, useEffect, useMemo } from 'react';
import ClassBrowseCard, { type ClassBrowseCardData } from '@/app/components/ClassBrowseCard';
import { classService } from '@/lib/api';
import type { Class } from '@/types/api';
import {
  applyClassBrowseFilters,
  extractStartHour,
  type ClassBrowseFilters,
  DEFAULT_CLASS_FILTERS,
} from '@/lib/classFilters';

function formatDuration(minutes?: number): string {
  if (!minutes || minutes <= 0) return '';
  if (minutes >= 60) {
    const hours = Math.round((minutes / 60) * 10) / 10;
    return hours === 1 ? '1 hr' : `${hours} hrs`;
  }
  return `${minutes} min`;
}

function apiClassToCourse(c: Class & { _id?: string }): ClassBrowseCardData {
  const id = c.id ?? c._id;
  const scheduleStart = c.schedule?.[0]?.startTime;
  return {
    id: id != null ? String(id) : '',
    title: c.title,
    instructor:
      typeof c.instructor === 'object' && c.instructor?.name ? c.instructor.name : 'Instructor',
    price: c.price,
    currency: c.currency || 'USD',
    category: c.category,
    level: c.level,
    language: c.language || '',
    image: c.thumbnail || 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800',
    duration: formatDuration(c.duration),
    durationMinutes: c.duration,
    startDate: c.startDate || scheduleStart,
    startHour: extractStartHour(c.startDate, scheduleStart),
    enrolledStudents: c.enrolledStudents || 0,
    maxStudents: c.maxStudents,
  };
}

interface LiveClassesProps {
  title?: string;
  subtitle?: string;
  variant?: 'default' | 'large';
  showTitle?: boolean;
  selectedCategory?: string;
  limit?: number;
  /** @deprecated Prefer `filters.price` */
  priceRange?: 'all' | 'free' | 'paid';
  filters?: Partial<ClassBrowseFilters>;
  showLoadMore?: boolean;
  excludeId?: string;
}

export default function LiveClasses({
  title = 'Featured Classes',
  subtitle,
  variant = 'default',
  showTitle = true,
  selectedCategory = 'All',
  limit,
  showLoadMore = false,
  priceRange = 'all',
  filters: filtersProp,
  excludeId,
}: LiveClassesProps) {
  const [displayCount, setDisplayCount] = useState(32);
  const [apiClasses, setApiClasses] = useState<ClassBrowseCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  const filters: ClassBrowseFilters = useMemo(
    () => ({
      ...DEFAULT_CLASS_FILTERS,
      category: selectedCategory,
      price: priceRange,
      ...filtersProp,
    }),
    [filtersProp, selectedCategory, priceRange]
  );

  useEffect(() => {
    setLoading(true);
    setError('');
    classService
      .getClasses({ pageSize: 100 })
      .then((res) =>
        setApiClasses(
          (res.data || [])
            .map(apiClassToCourse)
            .filter((card) => card.id != null && card.id !== '')
        )
      )
      .catch(() => {
        setApiClasses([]);
        setError('Unable to load classes. Check the backend connection and try again.');
      })
      .finally(() => setLoading(false));
  }, [retry]);

  const filteredClasses = useMemo(
    () => applyClassBrowseFilters(apiClasses, filters).filter((c) => c.id !== excludeId),
    [apiClasses, filters, excludeId]
  );

  const cardsToShow = limit || (showLoadMore ? displayCount : filteredClasses.length);
  const currentClasses = filteredClasses.slice(0, cardsToShow);
  const hasMore = showLoadMore && displayCount < filteredClasses.length;

  return (
    <section
      className={
        showTitle
          ? variant === 'large'
            ? 'py-16'
            : 'py-12'
          : variant === 'large'
            ? 'pt-6 pb-16'
            : 'pt-6 pb-12'
      }
    >
      <div className="w-[90vw] mx-auto">
        <div>
          {showTitle && (
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
                  {title}
                </h2>
                {subtitle ? (
                  <p className="text-gray-600 mt-1.5 text-sm md:text-base">{subtitle}</p>
                ) : null}
              </div>
            </div>
          )}

          {loading && <BrandLoader />}
          {error && (
            <div role="alert" className="py-8 text-red-700">
              {error}{' '}
              <button type="button" className="underline" onClick={() => setRetry((n) => n + 1)}>
                Retry
              </button>
            </div>
          )}
          {!loading && !error && !filteredClasses.length && (
            <p className="py-8 text-gray-600">
              No classes match these filters. Try clearing filters or check back for new classes.
            </p>
          )}

          <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {currentClasses.map((liveClass, index) => (
              <ClassBrowseCard
                key={`liveclass-${index}-${liveClass.id || liveClass.title}`}
                data={liveClass}
                fullWidth
              />
            ))}
          </div>

          {hasMore && (
            <div className="text-center mt-8">
              <button
                type="button"
                onClick={() => setDisplayCount((n) => n + 32)}
                className="px-6 py-3 bg-black text-white font-medium rounded-lg hover:bg-black/90 transition-colors"
              >
                Load More
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
