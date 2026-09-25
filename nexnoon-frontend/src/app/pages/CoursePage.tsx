import BrandLoader from '@/app/components/BrandLoader';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Globe2,
  Users,
} from 'lucide-react';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import { courseService, getErrorMessage } from '@/lib/api';
import { classDetailUrl } from '@/lib/url';
import type { CourseClassCard, CourseMarketplacePage } from '@/types/api';

function formatPrice(price: number, currency = 'USD') {
  if (price === 0) return 'Free';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: price % 1 === 0 ? 0 : 2,
  }).format(price);
}

function formatWhen(iso?: string) {
  if (!iso) return 'Schedule TBA';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function ClassCard({
  item,
  onOpen,
}: {
  item: CourseClassCard;
  onOpen: () => void;
}) {
  const full = item.seatsLeft <= 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left rounded-2xl border border-[#ebe6de] bg-white p-5 transition hover:border-[#14110e]/35 hover:bg-[#faf9f6]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#14110e] line-clamp-2">{item.title}</p>
          <p className="mt-1 text-xs text-[#8a847a]">
            {item.instructor?.name || 'Instructor'}
            {item.language ? ` · ${item.language}` : ''}
            {item.level ? ` · ${item.level}` : ''}
          </p>
        </div>
        <p className="shrink-0 text-sm font-semibold tabular-nums text-[#14110e]">
          {formatPrice(item.price, item.currency)}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#6b655c]">
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          {formatWhen(item.startDate)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {item.enrolledStudents}/{item.maxStudents} seats
          {full ? ' · Full' : ` · ${item.seatsLeft} left`}
        </span>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#f0ebe3]">
        <div
          className={`h-full rounded-full ${
            item.fillRate >= 80 ? 'bg-[#c45c26]' : item.fillRate < 30 ? 'bg-[#889dd1]' : 'bg-[#14110e]'
          }`}
          style={{ width: `${Math.min(100, item.fillRate)}%` }}
        />
      </div>

      <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#14110e]">
        {full ? 'Class full · Join the waitlist' : item.seatsLeft <= 5 ? `Only ${item.seatsLeft} left · View class` : 'View class'}
        <ArrowRight className="h-4 w-4" />
      </div>
    </button>
  );
}

export default function CoursePage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [page, setPage] = useState<CourseMarketplacePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const languageParam = searchParams.get('lang') || '';

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
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

  const selectedOffering = useMemo(() => {
    if (!languageParam) return null;
    return (
      activeOfferings.find(
        (o) =>
          o.code.toLowerCase() === languageParam.toLowerCase() ||
          o.id === languageParam ||
          o.label.toLowerCase() === languageParam.toLowerCase()
      ) || null
    );
  }, [activeOfferings, languageParam]);

  const setLanguage = (code: string) => {
    const next = new URLSearchParams(searchParams);
    if (!code) next.delete('lang');
    else next.set('lang', code);
    setSearchParams(next, { replace: true });
  };

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
            className="mt-8 rounded-xl bg-[#14110e] px-5 py-2.5 text-sm text-white"
          >
            Browse classes
          </button>
        </main>
        <Footer />
      </div>
    );
  }

  const { course, classes, seatCap } = page;
  const preview = course.officialPreviewUrl?.trim();

  return (
    <div className="min-h-screen bg-[#f6f4f0] text-[#14110e]">
      <Header variant="light" />

      <main>
        <section className="relative border-b border-[#ebe6de] bg-[#14110e] text-white">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                'radial-gradient(ellipse 70% 50% at 15% 0%, rgba(136,157,209,0.4), transparent 55%)',
            }}
          />
          <div className="relative w-[min(92vw,1100px)] mx-auto py-12 md:py-16">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45 mb-3">
              {course.category || 'Official course'}
            </p>
            <h1 className="font-serif text-4xl md:text-5xl tracking-tight leading-[1.05] max-w-3xl">
              {course.title}
            </h1>
            <p className="mt-4 max-w-2xl text-white/70 text-base leading-relaxed">
              {course.description}
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs text-white/55">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1">
                <Globe2 className="h-3.5 w-3.5" />
                {activeOfferings.length
                  ? `${activeOfferings.length} language${activeOfferings.length === 1 ? '' : 's'}`
                  : 'Language offerings coming soon'}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1">
                <Users className="h-3.5 w-3.5" />
                Max {seatCap} seats per class
              </span>
            </div>
          </div>
        </section>

        <div className="w-[min(92vw,1100px)] mx-auto py-10 md:py-14 grid lg:grid-cols-[1.1fr_0.9fr] gap-10">
          <div className="space-y-10">
            {preview ? (
              <section>
                <h2 className="font-serif text-2xl tracking-tight mb-4">Official preview</h2>
                <div className="overflow-hidden rounded-2xl border border-[#ebe6de] bg-black aspect-video">
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
              </section>
            ) : null}

            {course.outcomes?.length ? (
              <section>
                <h2 className="font-serif text-2xl tracking-tight mb-4">What you’ll learn</h2>
                <ul className="space-y-3">
                  {course.outcomes.map((o) => (
                    <li key={o} className="flex gap-3 text-sm leading-relaxed text-[#3d3933]">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-[#889dd1]" />
                      <span>{o}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {course.certificateNotes ? (
              <section className="rounded-2xl border border-[#ebe6de] bg-white p-5">
                <h2 className="font-serif text-xl tracking-tight mb-2">Certificate</h2>
                <p className="text-sm text-[#6b655c] leading-relaxed">{course.certificateNotes}</p>
              </section>
            ) : null}
          </div>

          <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <section className="rounded-2xl border border-[#ebe6de] bg-white p-5">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="h-4 w-4 text-[#6b655c]" />
                <h2 className="font-serif text-xl tracking-tight">Choose a language</h2>
              </div>
              <p className="text-sm text-[#8a847a] mb-4">
                Language is your preference — not locked to location. Then pick a live class cohort.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setLanguage('')}
                  className={`rounded-xl px-3.5 py-2 text-sm transition ${
                    !languageParam
                      ? 'bg-[#14110e] text-white'
                      : 'bg-[#f3f0ea] text-[#3d3933] hover:bg-[#ebe6de]'
                  }`}
                >
                  All
                </button>
                {activeOfferings.map((o) => {
                  const active =
                    selectedOffering?.id === o.id ||
                    languageParam.toLowerCase() === o.code.toLowerCase();
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setLanguage(o.code)}
                      className={`rounded-xl px-3.5 py-2 text-sm transition ${
                        active
                          ? 'bg-[#14110e] text-white'
                          : 'bg-[#f3f0ea] text-[#3d3933] hover:bg-[#ebe6de]'
                      }`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <div className="flex items-end justify-between gap-3 mb-3">
                <h2 className="font-serif text-xl tracking-tight">Live classes</h2>
                <p className="text-xs text-[#8a847a]">
                  {classes.length} open cohort{classes.length === 1 ? '' : 's'}
                </p>
              </div>
              {!classes.length ? (
                <div className="rounded-2xl border border-dashed border-[#ddd6ca] bg-white/70 px-5 py-10 text-center text-sm text-[#6b655c]">
                  No classes for this language yet. Try another language or check back soon.
                </div>
              ) : (
                <div className="space-y-3">
                  {classes.map((c) => (
                    <ClassCard
                      key={c.id}
                      item={c}
                      onOpen={() => navigate(classDetailUrl(c.id, c.title))}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
