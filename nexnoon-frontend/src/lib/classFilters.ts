/** Browse / search filters aligned with Live Classes PRD (L2 / C4). */

export type PriceFilter = 'all' | 'free' | 'paid';
export type LevelFilter = 'all' | 'Beginner' | 'Intermediate' | 'Advanced';
export type DurationFilter = 'all' | 'short' | 'medium' | 'long';
export type DateFilter = 'all' | 'week' | 'month' | 'upcoming';
export type TimeOfDayFilter = 'all' | 'morning' | 'afternoon' | 'evening';

export type ClassBrowseFilters = {
  category: string;
  price: PriceFilter;
  level: LevelFilter;
  language: string;
  duration: DurationFilter;
  date: DateFilter;
  timeOfDay: TimeOfDayFilter;
};

export const DEFAULT_CLASS_FILTERS: ClassBrowseFilters = {
  category: 'All',
  price: 'all',
  level: 'all',
  language: 'all',
  duration: 'all',
  date: 'all',
  timeOfDay: 'all',
};

export const BROWSE_CATEGORIES = [
  'All',
  'Development',
  'Design',
  'Marketing',
  'Business',
  'Photography',
  'Music',
  'Health & Wellness',
  'Languages',
] as const;

export const BROWSE_LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Portuguese',
  'Arabic',
  'Mandarin',
  'Hindi',
  'Japanese',
  'Korean',
] as const;

export type FilterableClass = {
  id: string;
  title: string;
  price: number;
  category?: string;
  level?: string;
  language?: string;
  /** Session length in minutes */
  durationMinutes?: number;
  startDate?: string;
  /** Hour 0–23 from startDate or first schedule slot */
  startHour?: number | null;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function matchesDuration(minutes: number | undefined, filter: DurationFilter): boolean {
  if (filter === 'all') return true;
  const m = minutes ?? 0;
  if (filter === 'short') return m > 0 && m < 60;
  if (filter === 'medium') return m >= 60 && m <= 180;
  return m > 180;
}

function matchesDate(startDate: string | undefined, filter: DateFilter): boolean {
  if (filter === 'all') return true;
  if (!startDate) return filter === 'upcoming';
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return false;
  const now = new Date();
  if (filter === 'upcoming') return start.getTime() >= startOfDay(now).getTime();
  const diffMs = start.getTime() - startOfDay(now).getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (filter === 'week') return diffDays >= 0 && diffDays <= 7;
  if (filter === 'month') return diffDays >= 0 && diffDays <= 30;
  return true;
}

function matchesTimeOfDay(hour: number | null | undefined, filter: TimeOfDayFilter): boolean {
  if (filter === 'all') return true;
  if (hour == null || Number.isNaN(hour)) return false;
  if (filter === 'morning') return hour >= 5 && hour < 12;
  if (filter === 'afternoon') return hour >= 12 && hour < 17;
  return hour >= 17 || hour < 5;
}

export function applyClassBrowseFilters<T extends FilterableClass>(
  classes: T[],
  filters: ClassBrowseFilters
): T[] {
  return classes.filter((c) => {
    if (filters.category !== 'All' && c.category !== filters.category) return false;

    if (filters.price === 'free' && c.price !== 0) return false;
    if (filters.price === 'paid' && c.price <= 0) return false;

    if (filters.level !== 'all' && c.level !== filters.level) return false;

    if (filters.language !== 'all') {
      const lang = (c.language || '').trim().toLowerCase();
      if (lang !== filters.language.toLowerCase()) return false;
    }

    if (!matchesDuration(c.durationMinutes, filters.duration)) return false;
    if (!matchesDate(c.startDate, filters.date)) return false;
    if (!matchesTimeOfDay(c.startHour, filters.timeOfDay)) return false;

    return true;
  });
}

export function extractStartHour(startDate?: string, scheduleStart?: string): number | null {
  const raw = scheduleStart || startDate;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours();
}

export function countActiveFilters(filters: ClassBrowseFilters): number {
  let n = 0;
  if (filters.category !== 'All') n += 1;
  if (filters.price !== 'all') n += 1;
  if (filters.level !== 'all') n += 1;
  if (filters.language !== 'all') n += 1;
  if (filters.duration !== 'all') n += 1;
  if (filters.date !== 'all') n += 1;
  if (filters.timeOfDay !== 'all') n += 1;
  return n;
}
