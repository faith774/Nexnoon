import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CalendarDays,
  Check,
  Clock3,
  Globe2,
  Layers3,
  Signal,
  Sun,
  Sunset,
  Moon,
  Wallet,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/app/components/ui/sheet';
import {
  BROWSE_LANGUAGES,
  DEFAULT_CLASS_FILTERS,
  countActiveFilters,
  type ClassBrowseFilters,
  type DateFilter,
  type DurationFilter,
  type LevelFilter,
  type PriceFilter,
  type TimeOfDayFilter,
} from '@/lib/classFilters';

function OptionTile({
  active,
  onClick,
  label,
  hint,
  icon,
  className = '',
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group relative flex items-start gap-2.5 rounded-2xl border px-3.5 py-3 text-left transition-all duration-200 ${
        active
          ? 'border-[#14110e] bg-[#14110e] text-white shadow-[0_8px_24px_-12px_rgba(20,17,14,0.55)]'
          : 'border-[#e8e4dc] bg-white text-[#14110e] hover:border-[#cfc8bc] hover:bg-[#fcfbf9]'
      } ${className}`}
    >
      {icon ? (
        <span
          className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
            active ? 'bg-white/15 text-white' : 'bg-[#f4f1ea] text-[#6b655c]'
          }`}
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold leading-tight tracking-tight">{label}</span>
        {hint ? (
          <span className={`mt-0.5 block text-[11px] leading-snug ${active ? 'text-white/65' : 'text-[#8a847a]'}`}>
            {hint}
          </span>
        ) : null}
      </span>
      <span
        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
          active
            ? 'border-white/30 bg-white text-[#14110e]'
            : 'border-[#e0dbd2] bg-transparent text-transparent group-hover:border-[#cfc8bc]'
        }`}
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
    </button>
  );
}

function FilterBlock({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[#ebe6de] bg-white p-4 shadow-[0_1px_0_rgba(20,17,14,0.03)]">
      <div className="mb-3.5 flex items-center gap-2.5">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#f4f1ea] text-[#5c564e]">
          {icon}
        </span>
        <h4 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#6b655c]">
          {title}
        </h4>
      </div>
      {children}
    </section>
  );
}

type ClassFiltersSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: ClassBrowseFilters;
  onApply: (next: ClassBrowseFilters) => void;
  onClear: () => void;
  activeCount?: number;
};

export default function ClassFiltersSheet({
  open,
  onOpenChange,
  value,
  onApply,
  onClear,
  activeCount = 0,
}: ClassFiltersSheetProps) {
  const [draft, setDraft] = useState<ClassBrowseFilters>(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const draftActive = useMemo(() => countActiveFilters(draft), [draft]);

  const apply = () => {
    onApply(draft);
    onOpenChange(false);
  };

  const clear = () => {
    setDraft(DEFAULT_CLASS_FILTERS);
    onClear();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[min(100vw,440px)] sm:max-w-[440px] flex-col gap-0 border-l border-[#e8e4dc] bg-[#f7f5f1] p-0 [&>button]:top-5 [&>button]:right-5 [&>button]:rounded-full [&>button]:border [&>button]:border-[#e8e4dc] [&>button]:bg-white [&>button]:p-2 [&>button]:opacity-100 [&>button]:shadow-sm [&>button]:hover:bg-[#f4f1ea]"
      >
        <SheetHeader className="relative shrink-0 overflow-hidden border-b border-[#ebe6de] bg-white px-6 pb-5 pt-6 pr-16 text-left">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#889dd1] via-[#14110e] to-[#889dd1]"
            aria-hidden
          />
          <SheetTitle className="text-[1.65rem] font-semibold tracking-tight text-[#14110e]">
            Refine classes
          </SheetTitle>
          <SheetDescription className="mt-1.5 text-sm leading-relaxed text-[#7a746a]">
            Dial in level, language, schedule, and price so the right live sessions rise to the top.
          </SheetDescription>
          <div className="mt-4 flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-[#14110e] px-2.5 py-1 text-[11px] font-semibold text-white">
              {draftActive} selected
            </span>
            {activeCount > 0 ? (
              <span className="text-[11px] font-medium text-[#8a847a]">
                {activeCount} applied on browse
              </span>
            ) : (
              <span className="text-[11px] font-medium text-[#8a847a]">No filters applied yet</span>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-3.5 overflow-y-auto px-4 py-4 sm:px-5">
          <FilterBlock icon={<Signal className="h-4 w-4" />} title="Level">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['all', 'All levels', 'Any skill'],
                  ['Beginner', 'Beginner', 'Start here'],
                  ['Intermediate', 'Intermediate', 'Build depth'],
                  ['Advanced', 'Advanced', 'Go deep'],
                ] as [LevelFilter, string, string][]
              ).map(([v, label, hint]) => (
                <OptionTile
                  key={v}
                  active={draft.level === v}
                  onClick={() => setDraft((p) => ({ ...p, level: v }))}
                  label={label}
                  hint={hint}
                />
              ))}
            </div>
          </FilterBlock>

          <FilterBlock icon={<Globe2 className="h-4 w-4" />} title="Language">
            <div className="grid grid-cols-2 gap-2 max-h-[168px] overflow-y-auto pr-0.5">
              <OptionTile
                active={draft.language === 'all'}
                onClick={() => setDraft((p) => ({ ...p, language: 'all' }))}
                label="All languages"
                className="col-span-2"
              />
              {BROWSE_LANGUAGES.map((lang) => (
                <OptionTile
                  key={lang}
                  active={draft.language === lang}
                  onClick={() => setDraft((p) => ({ ...p, language: lang }))}
                  label={lang}
                />
              ))}
            </div>
          </FilterBlock>

          <FilterBlock icon={<CalendarDays className="h-4 w-4" />} title="Start date">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['all', 'Any date', 'Flexible'],
                  ['week', 'This week', 'Next 7 days'],
                  ['month', 'This month', 'Next 30 days'],
                  ['upcoming', 'Upcoming', 'Future only'],
                ] as [DateFilter, string, string][]
              ).map(([v, label, hint]) => (
                <OptionTile
                  key={v}
                  active={draft.date === v}
                  onClick={() => setDraft((p) => ({ ...p, date: v }))}
                  label={label}
                  hint={hint}
                />
              ))}
            </div>
          </FilterBlock>

          <FilterBlock icon={<Clock3 className="h-4 w-4" />} title="Time of day">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <OptionTile
                active={draft.timeOfDay === 'all'}
                onClick={() => setDraft((p) => ({ ...p, timeOfDay: 'all' }))}
                label="Any time"
                hint="All hours"
                className="sm:col-span-2"
              />
              {(
                [
                  ['morning', 'Morning', '5am – 12pm', <Sun className="h-4 w-4" key="sun" />],
                  ['afternoon', 'Afternoon', '12 – 5pm', <Sunset className="h-4 w-4" key="sunset" />],
                  ['evening', 'Evening', '5pm onward', <Moon className="h-4 w-4" key="moon" />],
                ] as [TimeOfDayFilter, string, string, ReactNode][]
              ).map(([v, label, hint, icon]) => (
                <OptionTile
                  key={v}
                  active={draft.timeOfDay === v}
                  onClick={() => setDraft((p) => ({ ...p, timeOfDay: v }))}
                  label={label}
                  hint={hint}
                  icon={icon}
                  className={v === 'evening' ? 'sm:col-span-2' : ''}
                />
              ))}
            </div>
          </FilterBlock>

          <FilterBlock icon={<Layers3 className="h-4 w-4" />} title="Duration">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['all', 'Any length', 'No limit'],
                  ['short', 'Under 1 hr', 'Quick sessions'],
                  ['medium', '1 – 3 hrs', 'Standard'],
                  ['long', 'Over 3 hrs', 'Deep work'],
                ] as [DurationFilter, string, string][]
              ).map(([v, label, hint]) => (
                <OptionTile
                  key={v}
                  active={draft.duration === v}
                  onClick={() => setDraft((p) => ({ ...p, duration: v }))}
                  label={label}
                  hint={hint}
                />
              ))}
            </div>
          </FilterBlock>

          <FilterBlock icon={<Wallet className="h-4 w-4" />} title="Price">
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ['all', 'All'],
                  ['free', 'Free'],
                  ['paid', 'Paid'],
                ] as [PriceFilter, string][]
              ).map(([v, label]) => (
                <OptionTile
                  key={v}
                  active={draft.price === v}
                  onClick={() => setDraft((p) => ({ ...p, price: v }))}
                  label={label}
                />
              ))}
            </div>
          </FilterBlock>
        </div>

        <SheetFooter className="shrink-0 gap-3 border-t border-[#ebe6de] bg-white/95 px-5 py-4 backdrop-blur-sm sm:flex-col">
          <Button
            type="button"
            onClick={apply}
            className="h-12 w-full rounded-2xl bg-[#14110e] text-[15px] font-semibold text-white hover:bg-[#2a2520] shadow-[0_10px_30px_-16px_rgba(20,17,14,0.7)]"
          >
            Show matching classes
          </Button>
          <button
            type="button"
            onClick={clear}
            className="w-full py-1 text-center text-sm font-medium text-[#7a746a] transition-colors hover:text-[#14110e]"
          >
            Clear all filters
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
