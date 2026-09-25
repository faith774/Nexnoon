import BrandLoader from '@/app/components/BrandLoader';
import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ArrowRight, BookOpen, Search as SearchIcon } from 'lucide-react';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import ClassBrowseCard from '@/app/components/ClassBrowseCard';
import ClassFiltersSheet from '@/app/components/ClassFiltersSheet';
import CategoryFilterBar from '@/app/components/CategoryFilterBar';
import ClassSearchAutocomplete from '@/app/components/ClassSearchAutocomplete';
import { Button } from '@/app/components/ui/button';
import { classService, courseService } from '@/lib/api';
import type { Class, Course } from '@/types/api';
import {
  DEFAULT_CLASS_FILTERS,
  applyClassBrowseFilters,
  countActiveFilters,
  extractStartHour,
  type ClassBrowseFilters,
} from '@/lib/classFilters';
import type { ClassBrowseCardData } from '@/app/components/ClassBrowseCard';

function formatDuration(minutes?: number): string {
  if (!minutes || minutes <= 0) return '';
  if (minutes >= 60) {
    const hours = Math.round((minutes / 60) * 10) / 10;
    return hours === 1 ? '1 hr' : `${hours} hrs`;
  }
  return `${minutes} min`;
}

function apiClassToCard(c: Class & { _id?: string }): ClassBrowseCardData {
  const id = c.id ?? c._id;
  const scheduleStart = c.schedule?.[0]?.startTime;
  return {
    id: id != null ? String(id) : '',
    title: c.title,
    instructor:
      typeof c.instructor === 'object' && c.instructor?.name ? c.instructor.name : 'Instructor',
    price: c.price ?? 0,
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

export default function Search() {
  const location = useLocation();
  const navigate = useNavigate();
  const query = new URLSearchParams(location.search).get('q') || '';

  const [searchTerm, setSearchTerm] = useState(query);
  const [filters, setFilters] = useState<ClassBrowseFilters>({ ...DEFAULT_CLASS_FILTERS });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [apiResults, setApiResults] = useState<ClassBrowseCardData[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [catalog, setCatalog] = useState<Course[]>([]);

  useEffect(() => {
    courseService.getCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  const matchingCourses = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return catalog
      .filter((c) =>
        [c.title, c.category, ...(c.languageOfferings || []).map((o) => o.label)]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      )
      .slice(0, 4);
  }, [catalog, query]);

  useEffect(() => {
    setSearchTerm(query);
  }, [query]);

  useEffect(() => {
    setSearchLoading(true);
    classService
      .searchClasses(query.trim(), { pageSize: 100 })
      .then((res) =>
        setApiResults(
          (res.data || [])
            .map(apiClassToCard)
            .filter((c) => c.id != null && c.id !== '')
        )
      )
      .catch(() => setApiResults([]))
      .finally(() => setSearchLoading(false));
  }, [query]);

  const filteredResults = useMemo(
    () => applyClassBrowseFilters(apiResults, filters),
    [apiResults, filters]
  );

  const activeCount = useMemo(() => countActiveFilters(filters), [filters]);

  const clearFilters = () => setFilters({ ...DEFAULT_CLASS_FILTERS });

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#14110e]">
      <Header variant="light" />

      <main className="flex-1 flex flex-col">
        {/* Section 1 — Search hero */}
        <section className="relative z-40 border-b border-[#ebe6de] bg-[#14110e] text-white">
          <div
            className="pointer-events-none absolute inset-0 overflow-hidden opacity-40"
            style={{
              backgroundImage:
                'radial-gradient(ellipse 80% 60% at 10% 0%, rgba(136,157,209,0.45), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 20%, rgba(196,92,38,0.2), transparent 50%)',
            }}
          />
          <div className="relative w-[90vw] mx-auto py-12 md:py-16">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45 mb-3">
              Nexnoon search
            </p>
            <h1 className="font-serif text-4xl md:text-5xl tracking-tight leading-[1.05] max-w-3xl">
              {query ? (
                <>
                  Classes matching{' '}
                  <span className="text-[#c8d2ea] italic">“{query}”</span>
                </>
              ) : (
                'Find your next live class'
              )}
            </h1>
            <p className="mt-3 text-white/60 max-w-xl text-base leading-relaxed">
              Search by topic, instructor, or skill—then refine by level, language, schedule, and
              price.
            </p>

            <div className="relative z-50 mt-8 max-w-3xl">
              <ClassSearchAutocomplete
                variant="hero"
                value={searchTerm}
                onChange={setSearchTerm}
                onSubmitSearch={(term) =>
                  navigate(`/search?q=${encodeURIComponent(term)}`)
                }
                placeholder="Search classes, instructors, or topics…"
              />
            </div>
          </div>
        </section>

        {/* Section 2 — Refine bar */}
        <CategoryFilterBar
          value={filters}
          onChange={setFilters}
          onOpenFilters={() => setSheetOpen(true)}
        />

        {/* Section 3 — Results */}
        <section className="flex-1 bg-[#f7f5f1]">
          <div className="w-[90vw] mx-auto py-10 md:py-12">
            {matchingCourses.length > 0 ? (
              <div className="mb-10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a847a] mb-3">
                  Courses
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {matchingCourses.map((course) => (
                    <Link
                      key={course.id}
                      to={`/courses/${course.slug}`}
                      className="group flex items-center gap-4 border border-[#e4dfd6] bg-white p-4 transition hover:border-[#14110e]/40"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#fbeee6] text-[#c45c26]">
                        <BookOpen className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{course.title}</span>
                        <span className="block truncate text-xs text-[#8a847a]">
                          {(course.languageOfferings || []).filter((o) => o.status !== 'inactive').map((o) => o.label).join(' · ') || course.category || 'Compare every class in one place'}
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-[#8a847a] transition group-hover:translate-x-0.5 group-hover:text-[#14110e]" />
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a847a] mb-1">
                  Results
                </p>
                <h2 className="font-serif text-2xl md:text-3xl tracking-tight">
                  {searchLoading
                    ? 'Searching…'
                    : `${filteredResults.length} live class${filteredResults.length === 1 ? '' : 'es'}`}
                </h2>
              </div>
              {!searchLoading && filteredResults.length > 0 ? (
                <p className="text-sm text-[#7a746a]">
                  Showing all matches
                  {query ? ` for “${query}”` : ''}
                </p>
              ) : null}
            </div>

            {searchLoading ? (
              <div className="rounded-[1.75rem] border border-[#ebe6de] bg-white py-20">
                <BrandLoader />
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="rounded-[1.75rem] border border-[#ebe6de] bg-white px-8 py-20 text-center">
                <span className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0ebe3] text-[#6b655c]">
                  <SearchIcon className="h-6 w-6" />
                </span>
                <h3 className="font-serif text-2xl tracking-tight">No classes found</h3>
                <p className="mt-2 mx-auto max-w-md text-sm text-[#7a746a] leading-relaxed">
                  Nothing matched this search and filter combination. Try another keyword or clear
                  filters.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Button
                    type="button"
                    onClick={clearFilters}
                    variant="outline"
                    className="h-11 rounded-2xl border-[#e0dbd2] px-5"
                  >
                    Clear filters
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      clearFilters();
                      navigate('/browse');
                    }}
                    className="h-11 rounded-2xl bg-[#14110e] px-5 text-white hover:bg-[#2a2520]"
                  >
                    Browse all classes
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 md:gap-8">
                {filteredResults.map((card) => (
                  <ClassBrowseCard key={card.id} data={card} fullWidth />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <ClassFiltersSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        value={filters}
        activeCount={activeCount}
        onApply={setFilters}
        onClear={clearFilters}
      />

      <Footer />
    </div>
  );
}
