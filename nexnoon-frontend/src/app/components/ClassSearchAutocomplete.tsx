import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, BookOpen, Layers3, Search, UserRound } from 'lucide-react';
import { classService } from '@/lib/api';
import { classDetailUrl } from '@/lib/url';
import { BROWSE_CATEGORIES } from '@/lib/classFilters';
import type { Class } from '@/types/api';

type SuggestItem =
  | {
      kind: 'topic';
      key: string;
      title: string;
      meta: string;
      query: string;
    }
  | {
      kind: 'class';
      key: string;
      title: string;
      meta: string;
      classId: string;
    }
  | {
      kind: 'instructor';
      key: string;
      title: string;
      meta: string;
      query: string;
      instructorId?: string;
    };

function highlightMatch(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-[3px] bg-[#e8eef8] px-0.5 text-[#14110e] font-semibold not-italic">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

function buildSuggestions(query: string, classes: Class[]): SuggestItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const topics: SuggestItem[] = BROWSE_CATEGORIES.filter((c) => c !== 'All')
    .filter((c) => c.toLowerCase().includes(q))
    .slice(0, 4)
    .map((c) => ({
      kind: 'topic' as const,
      key: `topic-${c}`,
      title: c,
      meta: 'Topic',
      query: c,
    }));

  const classItems: SuggestItem[] = classes
    .filter((c) => {
      const title = (c.title || '').toLowerCase();
      const cat = (c.category || '').toLowerCase();
      return title.includes(q) || cat.includes(q);
    })
    .slice(0, 6)
    .map((c) => {
      const id = String(c.id ?? (c as Class & { _id?: string })._id ?? '');
      const instructor =
        typeof c.instructor === 'object' && c.instructor?.name
          ? c.instructor.name
          : 'Instructor';
      return {
        kind: 'class' as const,
        key: `class-${id}`,
        title: c.title,
        meta: `${c.category || 'Class'} · ${instructor}`,
        classId: id,
      };
    })
    .filter((c) => c.classId);

  const instructorMap = new Map<string, { name: string; id?: string; count: number }>();
  for (const c of classes) {
    const name =
      typeof c.instructor === 'object' && c.instructor?.name ? c.instructor.name : '';
    if (!name || !name.toLowerCase().includes(q)) continue;
    const id =
      typeof c.instructor === 'object' && c.instructor?.id ? String(c.instructor.id) : undefined;
    const mapKey = id || name.toLowerCase();
    const prev = instructorMap.get(mapKey);
    if (prev) prev.count += 1;
    else instructorMap.set(mapKey, { name, id, count: 1 });
  }
  const instructors: SuggestItem[] = [...instructorMap.values()].slice(0, 4).map((i) => ({
    kind: 'instructor' as const,
    key: `instr-${i.id || i.name}`,
    title: i.name,
    meta: `${i.count} class${i.count === 1 ? '' : 'es'}`,
    query: i.name,
    instructorId: i.id,
  }));

  return [...topics, ...classItems, ...instructors];
}

type ClassSearchAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmitSearch?: (value: string) => void;
  /** Called when a suggestion is chosen or search is submitted (e.g. close mobile sheet). */
  onClose?: () => void;
  placeholder?: string;
  /** Visual shell around the input */
  variant?: 'hero' | 'header' | 'plain';
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
};

export default function ClassSearchAutocomplete({
  value,
  onChange,
  onSubmitSearch,
  onClose,
  placeholder = 'Search classes, instructors, or topics…',
  variant = 'plain',
  className = '',
  inputClassName = '',
  autoFocus = false,
}: ClassSearchAutocompleteProps) {
  const navigate = useNavigate();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState<Class[]>([]);

  const q = value.trim();
  const suggestions = useMemo(() => buildSuggestions(q, catalog), [q, catalog]);

  const flatItems = useMemo(() => {
    const topics = suggestions.filter((s) => s.kind === 'topic');
    const classes = suggestions.filter((s) => s.kind === 'class');
    const instructors = suggestions.filter((s) => s.kind === 'instructor');
    return [...topics, ...classes, ...instructors];
  }, [suggestions]);

  const seeAllIndex = flatItems.length;
  const totalOptions = flatItems.length + (q ? 1 : 0);
  const showPanel = open && q.length > 0;

  // Prefetch a catalog once for fast local filtering; refresh lightly as user types.
  useEffect(() => {
    if (!open && q.length === 0) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      setLoading(true);
      const req =
        q.length >= 2
          ? classService.searchClasses(q, { pageSize: 40 })
          : classService.getClasses({ pageSize: 60 });
      req
        .then((res) => {
          if (!cancelled) setCatalog(res.data || []);
        })
        .catch(() => {
          if (!cancelled) setCatalog([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, q.length >= 2 ? 180 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q, open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const goSearch = useCallback(
    (term: string) => {
      const next = term.trim();
      if (!next) return;
      setOpen(false);
      onClose?.();
      if (onSubmitSearch) onSubmitSearch(next);
      else navigate(`/search?q=${encodeURIComponent(next)}`);
    },
    [navigate, onClose, onSubmitSearch]
  );

  const selectItem = useCallback(
    (item: SuggestItem) => {
      setOpen(false);
      onClose?.();
      if (item.kind === 'class') {
        navigate(classDetailUrl(item.classId, item.title));
        return;
      }
      if (item.kind === 'instructor' && item.instructorId) {
        navigate(`/instructors/${item.instructorId}`);
        return;
      }
      goSearch(item.query);
    },
    [goSearch, navigate, onClose]
  );

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showPanel || totalOptions === 0) {
      if (e.key === 'Escape') setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % totalOptions);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + totalOptions) % totalOptions);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex === seeAllIndex || flatItems.length === 0) goSearch(q);
      else selectItem(flatItems[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const onFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    goSearch(q);
  };

  const topics = suggestions.filter((s) => s.kind === 'topic');
  const classes = suggestions.filter((s) => s.kind === 'class');
  const instructors = suggestions.filter((s) => s.kind === 'instructor');

  let optionCursor = -1;
  const nextIndex = () => {
    optionCursor += 1;
    return optionCursor;
  };

  const shell =
    variant === 'hero'
      ? 'relative w-full'
      : variant === 'header'
        ? 'relative w-full'
        : 'relative w-full';

  const inputShell =
    variant === 'hero'
      ? 'flex flex-col sm:flex-row gap-3 sm:gap-2 sm:items-center sm:rounded-2xl sm:bg-white sm:p-2 sm:shadow-2xl'
      : variant === 'header'
        ? 'relative'
        : 'relative';

  return (
    <div ref={rootRef} className={`${shell} ${className}`}>
      <form onSubmit={onFormSubmit} className={inputShell} role="search">
        {variant === 'hero' ? (
          <>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#9a948a]" />
              <input
                type="search"
                value={value}
                autoFocus={autoFocus}
                autoComplete="off"
                aria-autocomplete="list"
                aria-controls={listId}
                aria-expanded={showPanel}
                aria-activedescendant={
                  showPanel ? `${listId}-opt-${activeIndex}` : undefined
                }
                role="combobox"
                onFocus={() => setOpen(true)}
                onChange={(e) => {
                  onChange(e.target.value);
                  setOpen(true);
                }}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                className={`w-full rounded-2xl border-0 bg-white py-4 pl-12 pr-4 text-[15px] text-[#14110e] outline-none placeholder:text-[#b0a99e] sm:bg-transparent ${inputClassName}`}
              />
            </div>
            <button
              type="submit"
              className="h-12 shrink-0 rounded-xl bg-[#889dd1] px-8 text-[15px] font-semibold text-[#14110e] hover:bg-[#9aadd9] sm:h-11"
            >
              Search
            </button>
          </>
        ) : variant === 'header' ? (
          <>
            <input
              type="search"
              value={value}
              autoComplete="off"
              aria-autocomplete="list"
              aria-controls={listId}
              aria-expanded={showPanel}
              aria-activedescendant={showPanel ? `${listId}-opt-${activeIndex}` : undefined}
              role="combobox"
              onFocus={() => setOpen(true)}
              onChange={(e) => {
                onChange(e.target.value);
                setOpen(true);
              }}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              aria-label="Search classes"
              className={`h-10 w-full rounded-full border border-transparent bg-[#f3f1ec] pl-10 pr-4 text-sm text-[#14110e] outline-none transition-colors placeholder:text-[#9a948a] hover:bg-[#ece9e2] focus:border-[#d9d3c8] focus:bg-white ${inputClassName}`}
            />
            <button
              type="submit"
              aria-label="Search"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8a847a] hover:text-[#14110e]"
            >
              <Search className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <Search className="pointer-events-none absolute left-5 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-[#9a948a]" />
            <input
              type="search"
              value={value}
              autoComplete="off"
              aria-autocomplete="list"
              aria-controls={listId}
              aria-expanded={showPanel}
              role="combobox"
              onFocus={() => setOpen(true)}
              onChange={(e) => {
                onChange(e.target.value);
                setOpen(true);
              }}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              className={`h-14 w-full rounded-full border border-transparent bg-white pl-12 pr-32 text-[15px] text-[#14110e] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)] outline-none transition placeholder:text-[#a39d93] focus:border-[#c8d2ea] focus:ring-4 focus:ring-white/20 sm:h-16 sm:pl-14 sm:pr-36 ${inputClassName}`}
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-[#14110e] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2b2722] sm:px-8 sm:py-3"
            >
              Search
            </button>
          </>
        )}
      </form>

      {showPanel ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Search suggestions"
          aria-busy={loading}
          className={`absolute left-0 right-0 z-[100] mt-2 overflow-hidden rounded-2xl border border-[#ebe6de] bg-white text-[#14110e] shadow-[0_24px_60px_-28px_rgba(20,17,14,0.55)] ${
            variant === 'hero' ? 'sm:left-0 sm:right-auto sm:w-full' : ''
          }`}
        >
          <div className="max-h-[min(420px,60vh)] overflow-y-auto py-2">
            {flatItems.length === 0 && !loading ? (
              <p className="px-4 py-6 text-sm text-[#7a746a]">
                No quick matches. Press Enter to search all classes.
              </p>
            ) : null}

            {topics.length > 0 ? (
              <section className="px-2 pb-1" aria-label="Topics">
                <h3 className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a847a]">
                  Topics
                </h3>
                <ul>
                  {topics.map((item) => {
                    const idx = nextIndex();
                    const active = idx === activeIndex;
                    return (
                      <li key={item.key}>
                        <button
                          type="button"
                          id={`${listId}-opt-${idx}`}
                          role="option"
                          aria-selected={active}
                          data-hsr-index={idx}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => selectItem(item)}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                            active ? 'bg-[#f3f1ec]' : 'hover:bg-[#faf9f6]'
                          }`}
                        >
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f0ebe3] text-[#5c564e]">
                            <Layers3 className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">
                              {highlightMatch(item.title, q)}
                            </span>
                            <span className="block text-xs text-[#8a847a]">{item.meta}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            {classes.length > 0 ? (
              <section className="px-2 pb-1" aria-label="Classes">
                <h3 className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a847a]">
                  Classes
                </h3>
                <ul>
                  {classes.map((item) => {
                    const idx = nextIndex();
                    const active = idx === activeIndex;
                    return (
                      <li key={item.key}>
                        <button
                          type="button"
                          id={`${listId}-opt-${idx}`}
                          role="option"
                          aria-selected={active}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => selectItem(item)}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                            active ? 'bg-[#f3f1ec]' : 'hover:bg-[#faf9f6]'
                          }`}
                        >
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f0ebe3] text-[#5c564e]">
                            <BookOpen className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">
                              {highlightMatch(item.title, q)}
                            </span>
                            <span className="block truncate text-xs text-[#8a847a]">
                              {item.meta}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            {instructors.length > 0 ? (
              <section className="px-2 pb-1" aria-label="Instructors">
                <h3 className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a847a]">
                  Instructors
                </h3>
                <ul>
                  {instructors.map((item) => {
                    const idx = nextIndex();
                    const active = idx === activeIndex;
                    return (
                      <li key={item.key}>
                        <button
                          type="button"
                          id={`${listId}-opt-${idx}`}
                          role="option"
                          aria-selected={active}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => selectItem(item)}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                            active ? 'bg-[#f3f1ec]' : 'hover:bg-[#faf9f6]'
                          }`}
                        >
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f0ebe3] text-[#5c564e]">
                            <UserRound className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">
                              {highlightMatch(item.title, q)}
                            </span>
                            <span className="block text-xs text-[#8a847a]">{item.meta}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
          </div>

          {q ? (
            <button
              type="button"
              id={`${listId}-opt-${seeAllIndex}`}
              role="option"
              aria-selected={activeIndex === seeAllIndex}
              onMouseEnter={() => setActiveIndex(seeAllIndex)}
              onClick={() => goSearch(q)}
              className={`flex w-full items-center justify-between gap-3 border-t border-[#ebe6de] px-4 py-3.5 text-left text-sm transition-colors ${
                activeIndex === seeAllIndex
                  ? 'bg-[#14110e] text-white'
                  : 'bg-[#faf9f6] text-[#14110e] hover:bg-[#f3f1ec]'
              }`}
            >
              <span>
                See all results for <strong>“{q}”</strong>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 opacity-70" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
