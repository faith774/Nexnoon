import { useState } from 'react';
import { formatInZone, getViewerTimeZone, useViewerTimeZone } from '@/lib/timezone';
import { ViewerTimeZoneSwitcher } from './TimeZonePicker';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Clock,
  CheckCircle,
  Calendar,
  BookOpen,
  Award,
  ArrowUpRight,
  RefreshCw,
  ClipboardList,
  Video,
  Search,
  Radio,
} from 'lucide-react';
import Header from './Header';
import Footer from './Footer';
import BackendState from './BackendState';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useAuth } from '@/contexts/AuthContext';
import { useBackendData } from '@/hooks/useBackendData';
import { classDetailUrl } from '@/lib/url';

type ClassCard = {
  id: string;
  enrollmentId: string;
  title: string;
  instructor: string;
  instructorId: string;
  thumbnail: string;
  category: string;
  progress: number;
  status: string;
  nextSession: string | null;
  nextSessionStart: string | null;
  nextSessionId: string | null;
  nextSessionLive: boolean;
  assignmentCount: number;
  dueAssignmentCount: number;
  certificateUrl: string | null;
  completedAt: string | null;
  enrolledAt: string;
  startDate: string | null;
};

type UpcomingSession = {
  id: string;
  classId: string;
  classTitle: string;
  title: string;
  startTime: string;
  endTime: string;
  status: string;
  thumbnail: string;
  instructor: string;
};

type DueAssignment = {
  id: string;
  classId: string;
  classTitle: string;
  title: string;
  description: string;
  dueDate: string | null;
  submitted: boolean;
};

type CertificateRow = {
  classId: string;
  title: string;
  instructor: string;
  thumbnail: string;
  certificateUrl: string;
  completedAt: string | null;
};

type LearnerData = {
  summary: {
    inProgress: number;
    upcoming: number;
    completed: number;
    certificates: number;
    assignmentsDue: number;
    hoursLearned: number;
    nextSessionAt: string | null;
  };
  continueLearning: ClassCard[];
  upcomingSessions: UpcomingSession[];
  dueAssignments: DueAssignment[];
  certificates: CertificateRow[];
  enrolled: ClassCard[];
  upcoming: ClassCard[];
  completed: ClassCard[];
};

type Tab = 'enrolled' | 'upcoming' | 'completed' | 'certificates';

const FALLBACK_THUMB =
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=640&q=80';

function thumb(url?: string) {
  return url && url.trim() ? url : FALLBACK_THUMB;
}

function formatWhen(iso: string | null | undefined) {
  if (!iso) return 'Not scheduled';
  return formatInZone(iso, getViewerTimeZone(), 'dayTime');
}

function dueLabel(iso: string | null) {
  if (!iso) return 'No due date';
  const t = new Date(iso).getTime();
  const diff = t - Date.now();
  if (diff < 0) return 'Overdue';
  if (diff < 86400000) return 'Due today';
  if (diff < 2 * 86400000) return 'Due tomorrow';
  return `Due ${new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

export default function LearnerDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  useViewerTimeZone();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('enrolled');
  const [search, setSearch] = useState('');

  const query = useBackendData<LearnerData>('/data/learner', false, {
    refetchInterval: 30_000,
  });

  if (authLoading) {
    return <BackendState title="My learning" loading message="Loading Nexnoon" />;
  }
  if (!user) {
    return <BackendState title="My learning" message="Sign in to see your classes and progress." />;
  }
  if (user.role !== 'student' && user.role !== 'admin') {
    return (
      <BackendState
        title="My learning"
        message="This learning home is for learners. Instructors use the teaching studio."
      />
    );
  }
  if (query.isError) {
    return (
      <BackendState
        title="My learning"
        message="Unable to load your dashboard. Check your connection and try again."
        retry={() => query.refetch()}
      />
    );
  }
  if (!query.data) {
    return <BackendState title="My learning" loading message="Loading your classes" />;
  }

  const data = query.data;
  const { summary } = data;
  const firstName = user.name?.split(' ')[0] || 'there';
  const hasAny =
    data.enrolled.length + data.upcoming.length + data.completed.length > 0;

  const filterCards = (list: ClassCard[]) =>
    list.filter((c) =>
      `${c.title} ${c.instructor} ${c.category}`.toLowerCase().includes(search.toLowerCase())
    );

  const tabLists: Record<Tab, ClassCard[] | CertificateRow[]> = {
    enrolled: filterCards(data.enrolled),
    upcoming: filterCards(data.upcoming),
    completed: filterCards(data.completed),
    certificates: data.certificates.filter((c) =>
      `${c.title} ${c.instructor}`.toLowerCase().includes(search.toLowerCase())
    ),
  };

  return (
    <div className="min-h-screen flex flex-col text-[#14110e] bg-[#f3f0ea]">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_15%_-5%,#e8dcc8_0%,transparent_55%),radial-gradient(ellipse_50%_40%_at_90%_5%,#d9e2ec_0%,transparent_50%),linear-gradient(180deg,#efeae2_0%,#f6f4f0_50%,#efeae2_100%)]" />
        <div
          className="absolute inset-0 opacity-[0.28]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(40,30,20,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(40,30,20,0.04) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
      </div>

      <Header variant="light" />

      <main className="flex-1 w-[min(94vw,1180px)] mx-auto py-8 md:py-11">
        <motion.header
          className="mb-8"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="relative overflow-hidden border border-[#ddd6ca]/90 bg-white/75 backdrop-blur-md px-6 py-7 md:px-8 md:py-8">
            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#c45c26] via-[#8a6a4a] to-[#3a5f8a]" />
            <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-[#6b655c] mb-2">
                  Learner home
                </p>
                <h1 className="font-serif text-[2.1rem] md:text-4xl tracking-tight leading-[1.08]">
                  Welcome back, {firstName}
                </h1>
                <p className="mt-2.5 max-w-lg text-sm text-[#5c5348] leading-relaxed">
                  Continue live classes, join upcoming sessions, turn in assignments, and collect
                  certificates — all from one place.
                </p>
                {summary.nextSessionAt && (
                  <p className="mt-3 inline-flex items-center gap-2 text-sm text-[#3d3933] bg-[#faf8f5] border border-[#eee9e0] px-3 py-1.5">
                    <Radio className="h-3.5 w-3.5 text-[#c45c26]" />
                    Next live: {formatWhen(summary.nextSessionAt)}
                  </p>
                )}
                <div className="mt-2">
                  <ViewerTimeZoneSwitcher />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => query.refetch()}
                  className="inline-flex items-center gap-2 border border-[#d5cfc4] bg-white px-3.5 py-2.5 text-sm hover:border-[#14110e]/50 transition-colors"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${query.isFetching ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/browse')}
                  className="inline-flex items-center gap-2 bg-[#14110e] text-white px-4 py-2.5 text-sm hover:bg-black/85 transition-colors"
                >
                  Browse classes
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </motion.header>

        <motion.section
          className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-8"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.05 } },
          }}
        >
          {[
            { label: 'In progress', value: summary.inProgress, hint: 'Active enrollments' },
            { label: 'Upcoming', value: summary.upcoming, hint: 'Starts later' },
            { label: 'Completed', value: summary.completed, hint: 'Finished classes' },
            { label: 'Due work', value: summary.assignmentsDue, hint: 'Open assignments' },
            { label: 'Hours', value: summary.hoursLearned, hint: 'Time in sessions' },
            { label: 'Certificates', value: summary.certificates, hint: 'Issued to you' },
          ].map((s) => (
            <motion.div
              key={s.label}
              variants={{
                hidden: { opacity: 0, y: 10 },
                show: { opacity: 1, y: 0 },
              }}
              className="border border-[#ddd6ca]/90 bg-white/80 px-4 py-3.5"
            >
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#8a847a]">{s.label}</p>
              <p className="font-serif text-2xl mt-1 tracking-tight">{s.value}</p>
              <p className="text-[11px] text-[#8a847a] mt-0.5">{s.hint}</p>
            </motion.div>
          ))}
        </motion.section>

        {!hasAny ? (
          <EmptyLearning onBrowse={() => navigate('/browse')} />
        ) : (
          <div className="space-y-7">
            {/* Continue + agenda */}
            <div className="grid lg:grid-cols-5 gap-5">
              <section className="lg:col-span-3 border border-[#ddd6ca]/90 bg-white/80 p-5 md:p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 flex items-center justify-center bg-[#f0ebe3] text-[#c45c26]">
                      <Play className="h-4 w-4" fill="currentColor" />
                    </div>
                    <div>
                      <h2 className="font-serif text-xl tracking-tight">Continue learning</h2>
                      <p className="text-xs text-[#6b655c]">Pick up where you left off</p>
                    </div>
                  </div>
                </div>
                {!data.continueLearning.length ? (
                  <p className="text-sm text-[#6b655c] border border-dashed border-[#ddd6ca] p-6 text-center">
                    No active classes yet — browse the catalog to enroll.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.continueLearning.map((c, i) => (
                      <motion.article
                        key={c.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.04, 0.2) }}
                        className="group flex gap-3 border border-[#eee9e0] bg-[#faf8f5]/60 p-3 hover:border-[#c45c26]/40 transition-colors"
                      >
                        <button
                          type="button"
                          className="relative h-20 w-28 shrink-0 overflow-hidden"
                          onClick={() => navigate(`/classroom/${c.id}`)}
                        >
                          <ImageWithFallback
                            src={thumb(c.thumbnail)}
                            alt=""
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          {c.nextSessionLive && (
                            <span className="absolute top-1 left-1 text-[9px] uppercase tracking-wide bg-rose-600 text-white px-1.5 py-0.5">
                              Live
                            </span>
                          )}
                        </button>
                        <div className="min-w-0 flex-1 flex flex-col">
                          <button
                            type="button"
                            className="text-left font-medium text-[#14110e] line-clamp-1 group-hover:underline underline-offset-2"
                            onClick={() => navigate(`/classroom/${c.id}`)}
                          >
                            {c.title}
                          </button>
                          <p className="text-xs text-[#6b655c] mt-0.5">{c.instructor}</p>
                          <div className="mt-auto pt-2">
                            <div className="flex justify-between text-[11px] mb-1">
                              <span className="text-[#6b655c]">Progress</span>
                              <span className="font-medium">{c.progress}%</span>
                            </div>
                            <div className="h-1.5 bg-[#ebe6de] overflow-hidden">
                              <div
                                className="h-full bg-[#c45c26] transition-all"
                                style={{ width: `${Math.min(100, c.progress)}%` }}
                              />
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#5c5348]">
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-[#c45c26]" />
                                {c.nextSessionStart ? formatWhen(c.nextSessionStart) : c.nextSession || 'No upcoming session'}
                              </span>
                              {c.dueAssignmentCount > 0 && (
                                <span className="text-[#c45c26]">
                                  {c.dueAssignmentCount} assignment
                                  {c.dueAssignmentCount === 1 ? '' : 's'} due
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5 shrink-0 self-center">
                          {c.nextSessionLive ? (
                            <button
                              type="button"
                              onClick={() => navigate(`/waiting-room/${c.id}`)}
                              className="px-3 py-2 text-xs font-medium bg-rose-600 text-white hover:bg-rose-700"
                            >
                              Join live
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => navigate(`/classroom/${c.id}`)}
                              className="px-3 py-2 text-xs font-medium bg-[#14110e] text-white hover:bg-black/80"
                            >
                              Open
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => navigate(`/assignments/${c.id}`)}
                            className="px-3 py-2 text-xs border border-[#d5cfc4] hover:border-[#14110e]"
                          >
                            Work
                          </button>
                        </div>
                      </motion.article>
                    ))}
                  </div>
                )}
              </section>

              <section className="lg:col-span-2 space-y-5">
                <div className="border border-[#ddd6ca]/90 bg-white/80 p-5 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 flex items-center justify-center bg-[#e8eef4] text-[#3a5f8a]">
                      <Video className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="font-serif text-lg tracking-tight">Upcoming sessions</h2>
                      <p className="text-xs text-[#6b655c]">Across your enrollments</p>
                    </div>
                  </div>
                  {!data.upcomingSessions.length ? (
                    <p className="text-sm text-[#6b655c] py-4 text-center border border-dashed border-[#ddd6ca]">
                      No live sessions on the calendar yet.
                    </p>
                  ) : (
                    <ul className="divide-y divide-[#eee9e0] max-h-72 overflow-y-auto">
                      {data.upcomingSessions.map((s) => {
                        const live = s.status === 'live';
                        return (
                          <li key={s.id} className="py-3 flex gap-3 items-start">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium line-clamp-1">{s.title}</p>
                              <p className="text-xs text-[#6b655c] mt-0.5 line-clamp-1">
                                {s.classTitle}
                              </p>
                              <p className="text-[11px] text-[#8a847a] mt-1 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatWhen(s.startTime)}
                                {live && (
                                  <span className="ml-1 text-rose-700 font-medium">· Live now</span>
                                )}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                navigate(live ? `/waiting-room/${s.classId}` : `/classroom/${s.classId}`)
                              }
                              className={`shrink-0 text-xs px-2.5 py-1.5 ${
                                live
                                  ? 'bg-rose-600 text-white'
                                  : 'border border-[#d5cfc4] hover:border-[#14110e]'
                              }`}
                            >
                              {live ? 'Join' : 'Open'}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="border border-[#ddd6ca]/90 bg-white/80 p-5 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 flex items-center justify-center bg-[#f3e8e0] text-[#c45c26]">
                      <ClipboardList className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="font-serif text-lg tracking-tight">Assignments due</h2>
                      <p className="text-xs text-[#6b655c]">
                        {summary.assignmentsDue} open across your classes
                      </p>
                    </div>
                  </div>
                  {!data.dueAssignments.length ? (
                    <p className="text-sm text-[#6b655c] py-4 text-center border border-dashed border-[#ddd6ca]">
                      You’re caught up — no open assignments.
                    </p>
                  ) : (
                    <ul className="divide-y divide-[#eee9e0] max-h-56 overflow-y-auto">
                      {data.dueAssignments.map((a) => {
                        const overdue =
                          a.dueDate && new Date(a.dueDate).getTime() < Date.now();
                        return (
                          <li key={`${a.classId}-${a.id}`} className="py-3">
                            <button
                              type="button"
                              className="w-full text-left"
                              onClick={() => navigate(`/assignments/${a.classId}`)}
                            >
                              <p className="text-sm font-medium line-clamp-1 hover:underline">
                                {a.title}
                              </p>
                              <p className="text-xs text-[#6b655c] mt-0.5">{a.classTitle}</p>
                              <p
                                className={`text-[11px] mt-1 ${
                                  overdue ? 'text-rose-700 font-medium' : 'text-[#8a847a]'
                                }`}
                              >
                                {dueLabel(a.dueDate)}
                              </p>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </section>
            </div>

            {/* Library tabs */}
            <section className="border border-[#ddd6ca]/90 bg-white/80 p-5 md:p-6 space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="font-serif text-xl tracking-tight">Your classes</h2>
                  <p className="text-sm text-[#6b655c] mt-0.5">
                    Everything you’re enrolled in, starting soon, or finished.
                  </p>
                </div>
                <label className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8a847a]" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter classes…"
                    className="border border-[#d5cfc4] bg-white pl-9 pr-3 py-2 text-sm w-52 outline-none focus:border-[#14110e]"
                  />
                </label>
              </div>

              <div className="border-b border-[#ddd6ca] flex gap-5 overflow-x-auto">
                {(
                  [
                    ['enrolled', `In progress (${data.enrolled.length})`],
                    ['upcoming', `Upcoming (${data.upcoming.length})`],
                    ['completed', `Completed (${data.completed.length})`],
                    ['certificates', `Certificates (${data.certificates.length})`],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={`pb-3 text-sm whitespace-nowrap transition-colors ${
                      tab === id
                        ? 'border-b-2 border-[#14110e] text-[#14110e] font-medium'
                        : 'text-[#6b655c] hover:text-[#14110e]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.22 }}
                >
                  {tab === 'certificates' ? (
                    <CertificateGrid
                      items={tabLists.certificates as CertificateRow[]}
                      onOpen={(id) => navigate(`/certificate/${id}`)}
                    />
                  ) : (
                    <ClassGrid
                      items={tabLists[tab] as ClassCard[]}
                      mode={tab}
                      onOpen={(id) => navigate(`/classroom/${id}`)}
                      onDetail={(id, title) => navigate(classDetailUrl(id, title))}
                      onCert={(id) => navigate(`/certificate/${id}`)}
                      onJoin={(id) => navigate(`/waiting-room/${id}`)}
                      onWork={(id) => navigate(`/assignments/${id}`)}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </section>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

function EmptyLearning({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div className="border border-dashed border-[#ddd6ca] bg-white/60 px-6 py-16 text-center">
      <BookOpen className="h-8 w-8 text-[#c45c26] mx-auto mb-3" />
      <h2 className="font-serif text-2xl tracking-tight mb-2">Start your first class</h2>
      <p className="text-sm text-[#6b655c] max-w-md mx-auto mb-6">
        Browse live classes, enroll, then come back here for sessions, assignments, and progress.
      </p>
      <button
        type="button"
        onClick={onBrowse}
        className="bg-[#c45c26] text-white px-5 py-2.5 text-sm hover:bg-[#a84c1e] transition-colors"
      >
        Browse classes
      </button>
    </div>
  );
}

function ClassGrid({
  items,
  mode,
  onOpen,
  onDetail,
  onCert,
  onJoin,
  onWork,
}: {
  items: ClassCard[];
  mode: 'enrolled' | 'upcoming' | 'completed';
  onOpen: (id: string) => void;
  onDetail: (id: string, title: string) => void;
  onCert: (id: string) => void;
  onJoin: (id: string) => void;
  onWork: (id: string) => void;
}) {
  if (!items.length) {
    return (
      <p className="text-[#6b655c] text-sm py-12 text-center border border-dashed border-[#ddd6ca]">
        Nothing in this list yet.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((c, i) => (
        <motion.article
          key={c.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i * 0.04, 0.24) }}
          className="border border-[#eee9e0] bg-[#faf8f5]/40 overflow-hidden group hover:border-[#14110e]/35 transition-colors"
        >
          <button
            type="button"
            className="relative h-40 w-full overflow-hidden"
            onClick={() => (mode === 'upcoming' ? onDetail(c.id, c.title) : onOpen(c.id))}
          >
            <ImageWithFallback
              src={thumb(c.thumbnail)}
              alt=""
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
            {c.nextSessionLive && (
              <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wide bg-rose-600 text-white px-2 py-0.5">
                Live now
              </span>
            )}
            {mode === 'completed' && (
              <span className="absolute top-2 right-2 p-1.5 bg-[#14110e]">
                <CheckCircle className="h-3.5 w-3.5 text-white" />
              </span>
            )}
          </button>
          <div className="p-4 space-y-3">
            <div>
              <h3 className="font-serif text-lg leading-snug line-clamp-2">{c.title}</h3>
              <p className="text-xs text-[#6b655c] mt-1">{c.instructor}</p>
            </div>
            {mode === 'enrolled' && (
              <>
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-[#6b655c]">Progress</span>
                    <span className="font-medium">{c.progress}%</span>
                  </div>
                  <div className="h-1.5 bg-[#ebe6de] overflow-hidden">
                    <div
                      className="h-full bg-[#c45c26]"
                      style={{ width: `${Math.min(100, c.progress)}%` }}
                    />
                  </div>
                </div>
                <p className="text-xs text-[#5c5348] flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-[#c45c26]" />
                  {c.nextSession || 'No upcoming session'}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {c.nextSessionLive ? (
                    <button
                      type="button"
                      onClick={() => onJoin(c.id)}
                      className="py-2.5 text-xs font-medium bg-rose-600 text-white"
                    >
                      Join live
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onOpen(c.id)}
                      className="py-2.5 text-xs font-medium bg-[#14110e] text-white"
                    >
                      Classroom
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onWork(c.id)}
                    className="py-2.5 text-xs border border-[#d5cfc4]"
                  >
                    Assignments
                  </button>
                </div>
              </>
            )}
            {mode === 'upcoming' && (
              <div className="bg-[#f0ebe3] p-3 text-center">
                <p className="text-[10px] uppercase tracking-wide text-[#6b655c]">Starts</p>
                <p className="text-sm font-medium mt-0.5">
                  {c.startDate
                    ? new Date(c.startDate).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : c.nextSession || 'TBA'}
                </p>
                <button
                  type="button"
                  onClick={() => onDetail(c.id, c.title)}
                  className="mt-3 w-full py-2 text-xs bg-[#14110e] text-white"
                >
                  View class
                </button>
              </div>
            )}
            {mode === 'completed' && (
              <>
                <div className="text-xs text-[#6b655c]">
                  Completed{' '}
                  <span className="font-medium text-[#14110e]">
                    {c.completedAt
                      ? new Date(c.completedAt).toLocaleDateString()
                      : '—'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onOpen(c.id)}
                    className="py-2.5 text-xs border border-[#d5cfc4]"
                  >
                    Revisit
                  </button>
                  {c.certificateUrl ? (
                    <button
                      type="button"
                      onClick={() => onCert(c.id)}
                      className="py-2.5 text-xs font-medium bg-[#14110e] text-white"
                    >
                      Certificate
                    </button>
                  ) : (
                    <span className="py-2.5 text-xs text-center text-[#8a847a] self-center">
                      Cert pending
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </motion.article>
      ))}
    </div>
  );
}

function CertificateGrid({
  items,
  onOpen,
}: {
  items: CertificateRow[];
  onOpen: (classId: string) => void;
}) {
  if (!items.length) {
    return (
      <p className="text-[#6b655c] text-sm py-12 text-center border border-dashed border-[#ddd6ca]">
        No certificates issued yet. Finish a class to earn one.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((c) => (
        <article
          key={c.classId}
          className="border border-[#eee9e0] p-4 flex gap-3 items-center hover:border-[#14110e]/35 transition-colors"
        >
          <div className="h-14 w-14 shrink-0 flex items-center justify-center bg-[#f0ebe3] text-[#c45c26]">
            <Award className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium line-clamp-1">{c.title}</p>
            <p className="text-xs text-[#6b655c] mt-0.5">{c.instructor}</p>
            <button
              type="button"
              onClick={() => onOpen(c.classId)}
              className="mt-2 text-xs font-medium text-[#c45c26] hover:underline inline-flex items-center gap-1"
            >
              View certificate
              <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
