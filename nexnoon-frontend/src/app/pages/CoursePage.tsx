import BrandLoader from '@/app/components/BrandLoader';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { ArrowDown, Award, CalendarDays, CheckCircle2, Globe2, Users } from 'lucide-react';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import ClassBrowseCard, { type ClassBrowseCardData } from '@/app/components/ClassBrowseCard';
import { courseService, getErrorMessage } from '@/lib/api';
import { useTimeFormat } from '@/lib/timezone';
import type { CourseClassCard, CourseMarketplacePage } from '@/types/api';

function formatDuration(minutes?: number): string {
  if (!minutes || minutes <= 0) return '';
  if (minutes >= 60) {
    const hours = Math.round((minutes / 60) * 10) / 10;
    return hours === 1 ? '1 hr' : `${hours} hrs`;
  }
  return `${minutes} min`;
}

function toCard(c: CourseClassCard): ClassBrowseCardData {
  return {
    id: c.id,
    title: c.title,
    instructor: c.instructor?.name,
    price: c.price,
    currency: c.currency,
    image: c.thumbnail || 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800',
    duration: formatDuration(c.duration),
    durationMinutes: c.duration,
    category: c.category,
    level: c.level,
    language: c.language,
    startDate: c.startDate,
    enrolledStudents: c.enrolledStudents,
    maxStudents: c.maxStudents,
  };
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active ? 'bg-[#14110e] text-white' : 'bg-[#f3f1ec] text-[#3d3933] hover:bg-[#e8e4dc]'
      }`}
    >
      {children}
    </button>
  );
}

export default function CoursePage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const t = useTimeFormat();
  const [page, setPage] = useState<CourseMarketplacePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState('All');

  const languageParam = searchParams.get('lang') || '';

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setError(null);
    courseService
      .getBySlug(slug, languageParam || undefined)
      .then((data) => {
        if (!cancelled) setPage(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setPage(null);
          setError(getErrorMessage(err) || 'Course not found');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, languageParam]);

  const activeOfferings = useMemo(
    () => (page?.course.languageOfferings || []).filter((o) => o.status !== 'inactive'),
    [page]
  );

  const isActiveLanguage = (code: string) => languageParam.toLowerCase() === code.toLowerCase();

  const setLanguage = (code: string) => {
    const next = new URLSearchParams(searchParams);
    if (!code) next.delete('lang');
    else next.set('lang', code);
    setSearchParams(next, { replace: true });
    setTopic('All');
  };

  const sortedClasses = useMemo(
    () =>
      [...(page?.classes || [])].sort((a, b) => {
        const ta = a.startDate ? new Date(a.startDate).getTime() : Infinity;
        const tb = b.startDate ? new Date(b.startDate).getTime() : Infinity;
        return ta - tb;
      }),
    [page]
  );

  const topics = useMemo(() => {
    const set = new Set<string>();
    sortedClasses.forEach((c) => c.category && set.add(c.category));
    return ['All', ...Array.from(set).sort()];
  }, [sortedClasses]);

  const visibleClasses = useMemo(
    () => (topic === 'All' ? sortedClasses : sortedClasses.filter((c) => c.category === topic)),
    [sortedClasses, topic]
  );

  const nextStart = sortedClasses.find((c) => c.startDate && new Date(c.startDate).getTime() > Date.now())?.startDate;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f4f0] flex items-center justify-center">
        <BrandLoader />
      </div>
    );
  }

  if (!page || error) {
    return (
      <div className="min-h-screen bg-[#f6f4f0] text-[#14110e]">
        <Header variant="light" />
        <main className="w-[min(92vw,720px)] mx-auto py-24 text-center">
          <h1 className="font-serif text-3xl tracking-tight">Course not found</h1>
          <p className="mt-3 text-[#6b655c]">{error || 'This course is unavailable.'}</p>
          <button
            type="button"
            onClick={() => navigate('/browse')}
            className="mt-8 rounded-full bg-[#14110e] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Browse classes
          </button>
        </main>
        <Footer />
      </div>
    );
  }

  const { course, seatCap } = page;
  const preview = course.officialPreviewUrl?.trim();
  const hasAbout = Boolean(preview || course.outcomes?.length || course.certificateNotes);

  const facts = [
    {
      icon: Globe2,
      value: activeOfferings.length ? String(activeOfferings.length) : '—',
      label: activeOfferings.length === 1 ? 'Language' : 'Languages',
    },
    { icon: CalendarDays, value: String(sortedClasses.length), label: sortedClasses.length === 1 ? 'Open class' : 'Open classes' },
    { icon: Users, value: String(seatCap), label: 'Seats max per class' },
    { icon: Award, value: nextStart ? t.day(nextStart) : 'TBA', label: 'Next class starts' },
  ];

  return (
    <div className="min-h-screen bg-[#f7f5f1] text-[#14110e]">
      <Header variant="light" />

      <main>
        <section className="relative overflow-hidden bg-[#14110e] text-white">
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                'radial-gradient(ellipse 70% 60% at 0% 0%, rgba(136,157,209,0.45), transparent 55%), radial-gradient(ellipse 50% 50% at 100% 100%, rgba(196,92,38,0.2), transparent 55%)',
            }}
          />
          <div className="relative mx-auto w-[90vw] pb-10 pt-12 md:pb-12 md:pt-16">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
              {course.category ? `${course.category} · Official course` : 'Official course'}
            </p>
            <h1 className="max-w-3xl font-serif text-4xl leading-[1.05] tracking-tight md:text-6xl">{course.title}</h1>
            {course.description ? (
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/65 md:text-lg">{course.description}</p>
            ) : null}
            <a
              href="#classes"
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#14110e] transition-colors hover:bg-[#c8d2ea]"
            >
              See live classes
              <ArrowDown className="h-4 w-4" />
            </a>
          </div>

          <div className="relative border-t border-white/10">
            <dl className="mx-auto grid w-[90vw] grid-cols-2 md:grid-cols-4">
              {facts.map((f, i) => (
                <div
                  key={f.label}
                  className={`flex items-center gap-3 py-5 md:py-6 ${i % 2 === 1 ? 'pl-5' : ''} ${
                    i > 0 ? 'md:border-l md:border-white/10 md:pl-6' : ''
                  }`}
                >
                  <f.icon className="hidden h-5 w-5 shrink-0 text-white/35 sm:block" />
                  <div className="min-w-0">
                    <dt className="truncate font-serif text-2xl md:text-3xl">{f.value}</dt>
                    <dd className="text-xs text-white/55">{f.label}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {hasAbout ? (
          <section className="border-b border-[#ebe6de] bg-white">
            <div className={`mx-auto grid w-[90vw] gap-10 py-12 md:py-16 ${preview ? 'lg:grid-cols-[1.2fr_1fr]' : ''}`}>
              {preview ? (
                <div className="aspect-video overflow-hidden rounded-3xl bg-black">
                  {/\.(mp4|webm|ogg)(\?|$)/i.test(preview) ? (
                    <video src={preview} controls className="h-full w-full object-contain" />
                  ) : (
                    <iframe
                      title="Course preview"
                      src={preview}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  )}
                </div>
              ) : null}
              <div className="space-y-8">
                {course.outcomes?.length ? (
                  <div>
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8a847a]">What you’ll learn</p>
                    <ul className={`grid gap-3 ${preview ? '' : 'sm:grid-cols-2'}`}>
                      {course.outcomes.map((o) => (
                        <li key={o} className="flex gap-3 text-[15px] leading-relaxed text-[#3d3933]">
                          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#889dd1]" />
                          <span>{o}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {course.certificateNotes ? (
                  <div className="flex gap-4 rounded-2xl bg-[#f7f5f1] p-5">
                    <Award className="h-6 w-6 shrink-0 text-[#14110e]" />
                    <div>
                      <p className="font-serif text-lg">Certificate</p>
                      <p className="mt-1 text-sm leading-relaxed text-[#6b655c]">{course.certificateNotes}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        <section id="classes" className="scroll-mt-16">
          <div className="sticky top-16 z-20 border-b border-[#ebe6de] bg-white/90 backdrop-blur-md">
            <div className="mx-auto flex w-[90vw] flex-col gap-2.5 py-3">
              {activeOfferings.length ? (
                <div className="flex min-w-0 items-center gap-3">
                  <span className="hidden w-[92px] shrink-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#8a847a] sm:inline-flex">
                    <Globe2 className="h-3.5 w-3.5" />
                    Language
                  </span>
                  <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                    <Chip active={!languageParam} onClick={() => setLanguage('')}>
                      All
                    </Chip>
                    {activeOfferings.map((o) => (
                      <Chip key={o.id} active={isActiveLanguage(o.code) || isActiveLanguage(o.label)} onClick={() => setLanguage(o.code)}>
                        {o.label}
                      </Chip>
                    ))}
                  </div>
                </div>
              ) : null}

              {topics.length > 2 ? (
                <div className="flex min-w-0 items-center gap-3">
                  <span className="hidden w-[92px] shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-[#8a847a] sm:inline">
                    Topic
                  </span>
                  <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                    {topics.map((tp) => (
                      <Chip key={tp} active={topic === tp} onClick={() => setTopic(tp)}>
                        {tp}
                      </Chip>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mx-auto w-[90vw] py-10 md:py-12">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8a847a]">Live classes</p>
                <h2 className="font-serif text-3xl tracking-tight">
                  {visibleClasses.length} {visibleClasses.length === 1 ? 'class' : 'classes'} open for enrollment
                </h2>
              </div>
              <p className="text-sm text-[#8a847a]">Soonest first · max {seatCap} learners each</p>
            </div>

            {!visibleClasses.length ? (
              <div className="rounded-3xl border border-dashed border-[#ddd6ca] bg-white/70 px-6 py-16 text-center">
                <p className="font-serif text-xl">No classes here yet</p>
                <p className="mt-2 text-sm text-[#6b655c]">
                  Try another language or topic, or check back soon. New cohorts open regularly.
                </p>
                {languageParam || topic !== 'All' ? (
                  <button
                    type="button"
                    onClick={() => setLanguage('')}
                    className="mt-6 rounded-full bg-[#14110e] px-5 py-2.5 text-sm font-semibold text-white"
                  >
                    Show all classes
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {visibleClasses.map((c) => (
                  <ClassBrowseCard key={c.id} data={toCard(c)} fullWidth showBorderHover />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
