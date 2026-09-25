import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import {
  Briefcase,
  Camera,
  ChevronLeft,
  ChevronRight,
  Code2,
  HeartPulse,
  Languages,
  LayoutGrid,
  Megaphone,
  Music,
  Palette,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  BROWSE_CATEGORIES,
  DEFAULT_CLASS_FILTERS,
  countActiveFilters,
  type ClassBrowseFilters,
} from '@/lib/classFilters';

const CATEGORY_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  All: LayoutGrid,
  Development: Code2,
  Design: Palette,
  Marketing: Megaphone,
  Business: Briefcase,
  Photography: Camera,
  Music,
  'Health & Wellness': HeartPulse,
  Languages,
};

function activeFilterLabels(filters: ClassBrowseFilters): { key: keyof ClassBrowseFilters; label: string }[] {
  const chips: { key: keyof ClassBrowseFilters; label: string }[] = [];
  if (filters.category !== 'All') chips.push({ key: 'category', label: filters.category });
  if (filters.level !== 'all') chips.push({ key: 'level', label: filters.level });
  if (filters.language !== 'all') chips.push({ key: 'language', label: filters.language });
  if (filters.date !== 'all') {
    const map = { week: 'This week', month: 'This month', upcoming: 'Upcoming' } as const;
    chips.push({ key: 'date', label: map[filters.date] });
  }
  if (filters.timeOfDay !== 'all') {
    chips.push({
      key: 'timeOfDay',
      label: filters.timeOfDay.charAt(0).toUpperCase() + filters.timeOfDay.slice(1),
    });
  }
  if (filters.duration !== 'all') {
    const map = { short: 'Under 1 hr', medium: '1–3 hrs', long: 'Over 3 hrs' } as const;
    chips.push({ key: 'duration', label: map[filters.duration] });
  }
  if (filters.price !== 'all') {
    chips.push({ key: 'price', label: filters.price === 'free' ? 'Free' : 'Paid' });
  }
  return chips;
}

type Props = {
  value: ClassBrowseFilters;
  onChange: (next: ClassBrowseFilters) => void;
  onOpenFilters: () => void;
  resultCount?: number;
};

export default function CategoryFilterBar({ value, onChange, onOpenFilters, resultCount }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const activeCount = countActiveFilters(value);
  const chips = activeFilterLabels(value);

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdges({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const nudge = (dir: 1 | -1) => {
    scroller.current?.scrollBy({ left: dir * 240, behavior: 'smooth' });
  };

  const removeFilter = (key: keyof ClassBrowseFilters) => {
    onChange({ ...value, [key]: DEFAULT_CLASS_FILTERS[key] });
  };

  return (
    <section className="sticky top-16 z-20 border-b border-[#ebe6de] bg-white/90 backdrop-blur-md">
      <div className="w-[90vw] mx-auto py-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 min-w-0">
            {edges.left ? (
              <>
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-14 bg-gradient-to-r from-white to-transparent" />
                <button
                  type="button"
                  aria-label="Scroll categories left"
                  onClick={() => nudge(-1)}
                  className="absolute left-0 top-1/2 z-20 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-[#e0dbd2] bg-white text-[#3d3933] shadow-sm hover:border-[#14110e]"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </>
            ) : null}

            <div
              ref={scroller}
              onScroll={measure}
              role="tablist"
              aria-label="Categories"
              className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide scroll-smooth py-0.5"
            >
              {BROWSE_CATEGORIES.map((category) => {
                const Icon = CATEGORY_ICONS[category] ?? LayoutGrid;
                const active = value.category === category;
                return (
                  <button
                    key={category}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => onChange({ ...value, category })}
                    className={`group shrink-0 inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-all ${
                      active
                        ? 'border-[#14110e] bg-[#14110e] text-white shadow-[0_6px_16px_-8px_rgba(20,17,14,0.6)]'
                        : 'border-transparent bg-[#f3f1ec] text-[#3d3933] hover:border-[#d9d3c8] hover:bg-white'
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 transition-colors ${
                        active ? 'text-[#c8d2ea]' : 'text-[#8a847a] group-hover:text-[#14110e]'
                      }`}
                    />
                    {category}
                  </button>
                );
              })}
            </div>

            {edges.right ? (
              <>
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-14 bg-gradient-to-l from-white to-transparent" />
                <button
                  type="button"
                  aria-label="Scroll categories right"
                  onClick={() => nudge(1)}
                  className="absolute right-0 top-1/2 z-20 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-[#e0dbd2] bg-white text-[#3d3933] shadow-sm hover:border-[#14110e]"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            ) : null}
          </div>

          <div className="hidden sm:block h-7 w-px bg-[#ebe6de]" />

          <button
            type="button"
            onClick={onOpenFilters}
            className={`shrink-0 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              activeCount > 0
                ? 'border-[#14110e] bg-[#14110e]/[0.04] text-[#14110e]'
                : 'border-[#e0dbd2] bg-white text-[#3d3933] hover:border-[#14110e]'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeCount > 0 ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#14110e] px-1.5 text-[10px] font-semibold text-white">
                {activeCount}
              </span>
            ) : null}
          </button>
        </div>

        {chips.length > 0 || resultCount != null ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {resultCount != null ? (
              <span className="mr-1 text-xs text-[#8a847a]">
                <span className="font-semibold text-[#14110e]">{resultCount}</span>{' '}
                {resultCount === 1 ? 'class' : 'classes'}
              </span>
            ) : null}
            {chips.map((chip) => (
              <button
                key={`${chip.key}-${chip.label}`}
                type="button"
                onClick={() => removeFilter(chip.key)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#ebe6de] bg-[#faf9f6] py-1 pl-3 pr-2 text-xs font-medium text-[#3d3933] hover:border-[#14110e]"
              >
                {chip.label}
                <X className="h-3 w-3 text-[#8a847a]" />
              </button>
            ))}
            {chips.length > 0 ? (
              <button
                type="button"
                onClick={() => onChange({ ...DEFAULT_CLASS_FILTERS })}
                className="px-1 text-xs font-semibold text-[#7a746a] underline-offset-2 hover:text-[#14110e] hover:underline"
              >
                Clear all
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
