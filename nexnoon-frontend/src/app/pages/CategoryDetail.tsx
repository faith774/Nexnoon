import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { classService } from '@/lib/api';
import { ENV } from '@/config/env';
import { BookOpen, ChevronDown, ChevronRight, SearchX } from 'lucide-react';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import ClassBrowseCard, { type ClassBrowseCardData } from '@/app/components/ClassBrowseCard';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { CATEGORIES, findCategory } from '@/lib/categories';

const LEVELS = ['All', 'Beginner', 'Intermediate', 'Advanced'] as const;
const PRICES = [
  { value: 'any', label: 'Any price' },
  { value: 'free', label: 'Free' },
  { value: 'paid', label: 'Paid' },
] as const;
const SORTS = [
  { value: 'popular', label: 'Most popular' },
  { value: 'newest', label: 'Newest first' },
  { value: 'price-low', label: 'Price: low to high' },
  { value: 'price-high', label: 'Price: high to low' },
  { value: 'rating', label: 'Highest rated' },
];

type ApiClass = {
  id: string;
  title: string;
  instructor?: { name?: string };
  rating?: number;
  enrolledStudents?: number;
  maxStudents?: number;
  price?: number;
  currency?: string;
  duration?: number;
  level?: string;
  language?: string;
  startDate?: string;
  thumbnail?: string;
};

type ClassItem = ClassBrowseCardData & { rating: number; students: number };

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-9 shrink-0 rounded-full border px-4 text-sm transition-colors ${
        active
          ? 'border-[#14110e] bg-[#14110e] text-white'
          : 'border-[#ebe6de] bg-white text-[#3d3831] hover:border-[#d9d2c6] hover:bg-[#f7f5f1]'
      }`}
    >
      {children}
    </button>
  );
}

export default function CategoryDetail() {
  const { category } = useParams<{ category: string }>();
  const [sortBy, setSortBy] = useState('popular');
  const [level, setLevel] = useState<(typeof LEVELS)[number]>('All');
  const [price, setPrice] = useState<(typeof PRICES)[number]['value']>('any');
  const useRealData = !ENV.ENABLE_DEMO_MODE;
  const [totalClasses, setTotalClasses] = useState(0);
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(useRealData);
  const [apiClasses, setApiClasses] = useState<ClassItem[]>([]);

  useEffect(() => {
    setLevel('All');
    setPrice('any');
    if (!useRealData || !category) return;
    setLoading(true);
    classService.getClassesByCategory(category, { pageSize: 50 })
      .then((res) => {
        setApiError('');
        setTotalClasses(res.pagination.totalItems);
        setApiClasses(((res.data || []) as unknown as ApiClass[]).map((c) => ({
          id: String(c.id),
          title: c.title,
          instructor: typeof c.instructor === 'object' && c.instructor?.name ? c.instructor.name : 'Instructor',
          price: c.price ?? 0,
          currency: c.currency || 'USD',
          image: c.thumbnail || 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400',
          duration: c.duration ? `${c.duration} min` : '',
          level: c.level ?? 'Beginner',
          language: c.language,
          startDate: c.startDate,
          enrolledStudents: c.enrolledStudents ?? 0,
          maxStudents: c.maxStudents,
          rating: c.rating ?? 0,
          students: c.enrolledStudents ?? 0,
        })));
      })
      .catch(() => { setApiClasses([]); setApiError('Unable to load classes. Please try again.'); })
      .finally(() => setLoading(false));
  }, [useRealData, category]);

  const meta = findCategory(category);
  const name = meta?.name ?? (category ?? '').replace(/-/g, ' ');
  const description = meta?.description ?? 'Live classes from our instructors.';
  const Icon = meta?.icon ?? BookOpen;

  const classes = apiClasses
    .filter((c) => level === 'All' || c.level === level)
    .filter((c) => price === 'any' || (price === 'free' ? c.price === 0 : c.price > 0))
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest': return 0;
        case 'price-low': return a.price - b.price;
        case 'price-high': return b.price - a.price;
        case 'rating': return b.rating - a.rating;
        default: return b.students - a.students;
      }
    });

  const filtered = level !== 'All' || price !== 'any';
  const resetFilters = () => { setLevel('All'); setPrice('any'); };

  return (
    <div className="min-h-screen bg-white">
      <Header variant="light" />

      <main>
        <section className="relative overflow-hidden bg-[#14110e] py-16 md:py-24">
          {meta?.image ? (
            <div className="absolute inset-0">
              <ImageWithFallback src={meta.image} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-[#14110e]/75" />
            </div>
          ) : null}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(90deg, rgba(20,17,14,0.85), rgba(20,17,14,0.2)), radial-gradient(ellipse 50% 60% at 100% 0%, rgba(136,157,209,0.28), transparent 60%)',
            }}
          />

          <div className="relative mx-auto w-[90vw]">
            <nav aria-label="Breadcrumb" className="mb-8 flex items-center gap-1.5 text-sm text-white/60">
              <Link to="/categories" className="transition-colors hover:text-white">Categories</Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="capitalize text-white">{name}</span>
            </nav>

            <div className="max-w-3xl">
              <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#14110e] shadow-sm">
                <Icon className="h-5 w-5" />
              </span>
              <h1 className="mb-4 font-serif text-4xl capitalize leading-[1.05] tracking-tight text-white md:text-6xl">
                {name}
              </h1>
              <p className="mb-7 text-base text-white/70 md:text-lg">{description}</p>
              <div className="flex flex-wrap gap-2 text-sm text-white/85">
                <span className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 backdrop-blur-sm">
                  {loading ? 'Loading…' : `${totalClasses.toLocaleString()} live ${totalClasses === 1 ? 'class' : 'classes'}`}
                </span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 backdrop-blur-sm">
                  All skill levels
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="pb-20 pt-10 md:pt-12">
          <div className="mx-auto w-[90vw]">
            <div className="mb-8 flex flex-col gap-5 border-b border-[#ebe6de] pb-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="font-serif text-2xl tracking-tight text-[#14110e] md:text-3xl">Available classes</h2>
                <p className="mt-1 text-sm text-[#6b655c]">
                  {loading ? 'Loading classes…' : `${classes.length} live ${classes.length === 1 ? 'class' : 'classes'} found`}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:pb-0 [scrollbar-width:none]">
                  {LEVELS.map((l) => (
                    <Chip key={l} active={level === l} onClick={() => setLevel(l)}>{l === 'All' ? 'All levels' : l}</Chip>
                  ))}
                </div>
                <span className="hidden h-6 w-px bg-[#ebe6de] sm:block" />
                <div className="flex gap-2">
                  {PRICES.map((p) => (
                    <Chip key={p.value} active={price === p.value} onClick={() => setPrice(p.value)}>{p.label}</Chip>
                  ))}
                </div>
                <div className="relative sm:ml-1">
                  <label htmlFor="category-sort" className="sr-only">Sort classes</label>
                  <select
                    id="category-sort"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="h-9 w-full appearance-none rounded-full border border-[#ebe6de] bg-[#f7f5f1] pl-4 pr-9 text-sm text-[#3d3831] outline-none transition hover:border-[#d9d2c6] focus:border-[#c8d2ea] focus:ring-2 focus:ring-[#c8d2ea]/60 sm:w-auto"
                  >
                    {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a847a]" />
                </div>
              </div>
            </div>

            {apiError ? (
              <div role="alert" className="rounded-2xl border border-[#f1d6c8] bg-[#fdf6f2] px-5 py-4 text-sm text-[#9a4a1f]">
                {apiError}
              </div>
            ) : loading ? (
              <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="aspect-[4/3] rounded-2xl bg-[#f3f1ec]" />
                    <div className="mt-3 h-3 w-1/4 rounded bg-[#f3f1ec]" />
                    <div className="mt-2 h-4 w-3/4 rounded bg-[#f3f1ec]" />
                    <div className="mt-2 h-3 w-1/2 rounded bg-[#f3f1ec]" />
                  </div>
                ))}
              </div>
            ) : classes.length > 0 ? (
              <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {classes.map((c) => <ClassBrowseCard key={c.id} data={c} fullWidth />)}
              </div>
            ) : (
              <div className="flex flex-col items-center rounded-3xl border border-dashed border-[#ebe6de] bg-[#f7f5f1] px-6 py-16 text-center">
                <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#8a847a] shadow-sm">
                  <SearchX className="h-5 w-5" />
                </span>
                <h3 className="font-serif text-xl text-[#14110e]">
                  {filtered ? 'No classes match these filters' : 'No live classes here yet'}
                </h3>
                <p className="mt-1.5 max-w-sm text-sm text-[#6b655c]">
                  {filtered ? 'Try another level or price.' : 'New classes are added often. Check back soon or explore another category.'}
                </p>
                {filtered ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-5 rounded-full bg-[#14110e] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2b2722]"
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
            )}

            <div className="mt-16 border-t border-[#ebe6de] pt-8">
              <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.16em] text-[#8a847a]">More categories</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.filter((c) => c.slug !== category).map((c) => {
                  const CIcon = c.icon;
                  return (
                    <Link
                      key={c.slug}
                      to={`/category/${c.slug}`}
                      className="inline-flex h-10 items-center gap-2 rounded-full border border-[#ebe6de] bg-white px-4 text-sm text-[#3d3831] transition-colors hover:border-[#d9d2c6] hover:bg-[#f7f5f1]"
                    >
                      <CIcon className="h-4 w-4 text-[#8a847a]" />
                      {c.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
