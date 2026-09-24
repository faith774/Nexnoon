import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareWarning,
  RefreshCw,
  Search,
  Settings2,
  Star,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import BackendState from './BackendState';
import { useAuth } from '@/contexts/AuthContext';
import { useBackendData } from '@/hooks/useBackendData';
import { publicSiteHref } from '@/lib/portal';
import { AdminContext, type AdminContextValue } from './admin/context';
import type { AdminData, AdminIntent, AdminTab, ClassOp, Flash } from './admin/types';
import { initials } from './admin/ui';
import OverviewSection from './admin/OverviewSection';
import InstructorsSection from './admin/InstructorsSection';
import CoursesSection from './admin/CoursesSection';
import ClassesSection from './admin/ClassesSection';
import LearnersSection from './admin/LearnersSection';
import AssignmentsSection from './admin/AssignmentsSection';
import { ActivitySection, SettingsSection } from './admin/PlatformSections';
import { KpiSection, QualitySection, ReviewsSection } from './admin/QualityOps';
import PayoutsSection from './admin/PayoutsSection';

type NavItem = {
  id: AdminTab;
  label: string;
  icon: typeof LayoutDashboard;
  description: string;
  searchable?: string;
};

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: '',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard, description: 'Platform health at a glance' },
      { id: 'kpis', label: 'KPIs', icon: TrendingUp, description: 'North star, growth, learning outcomes and unit economics' },
    ],
  },
  {
    group: 'People',
    items: [
      {
        id: 'instructors',
        label: 'Instructors',
        icon: UserCheck,
        description: 'Lifecycle from application to certification, renewal and removal',
        searchable: 'Search instructors by name or email',
      },
      {
        id: 'learners',
        label: 'Learners',
        icon: Users,
        description: 'Everyone learning on Nexnoon, their classes and progress',
        searchable: 'Search learners, emails or classes',
      },
    ],
  },
  {
    group: 'Academics',
    items: [
      {
        id: 'courses',
        label: 'Courses',
        icon: BookOpen,
        description: 'Official course templates, curriculum and languages',
        searchable: 'Search courses',
      },
      {
        id: 'classes',
        label: 'Classes',
        icon: GraduationCap,
        description: 'Live cohorts, seats, rosters and sessions',
        searchable: 'Search classes or instructors',
      },
      {
        id: 'assignments',
        label: 'Assignments',
        icon: ClipboardList,
        description: 'Posted work and who has submitted it',
        searchable: 'Search assignments or classes',
      },
      {
        id: 'quality',
        label: 'Quality',
        icon: Star,
        description: 'Scores, dropout, feedback and incidents, with renew / improve / remove',
        searchable: 'Search instructors or incidents',
      },
      {
        id: 'reviews',
        label: 'Reviews',
        icon: MessageSquareWarning,
        description: 'Moderate learner reviews before they affect ratings',
        searchable: 'Search reviews, learners or classes',
      },
    ],
  },
  {
    group: 'Platform',
    items: [
      {
        id: 'payouts',
        label: 'Payouts',
        icon: Wallet,
        description: 'Instructor balances, payout requests and refunds',
        searchable: 'Search instructors or references',
      },
      {
        id: 'activity',
        label: 'Activity',
        icon: Activity,
        description: 'Everything that has happened recently',
        searchable: 'Search the activity log',
      },
      { id: 'settings', label: 'Settings', icon: Settings2, description: 'Capacity, quality weights and integrations' },
    ],
  },
];

const ALL_ITEMS = NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.group })));
const isTab = (v: string | null): v is AdminTab => !!v && ALL_ITEMS.some((i) => i.id === v);

export default function AdminPlatformDashboard() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [intent, setIntent] = useState<AdminIntent>(() => {
    const openClassId = params.get('class');
    return openClassId ? { openClassId } : {};
  });
  const [flashMsg, setFlashMsg] = useState<Flash | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  const query = useBackendData<AdminData>('/data/admin');
  const tabParam = params.get('tab');
  const tab: AdminTab = isTab(tabParam) ? tabParam : 'overview';

  const goTo = useCallback(
    (next: AdminTab, nextIntent: AdminIntent = {}) => {
      setIntent(nextIntent);
      setSearch('');
      setNavOpen(false);
      setParams(next === 'overview' ? {} : { tab: next });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [setParams]
  );

  const flash = useCallback((f: Flash) => setFlashMsg(f), []);
  useEffect(() => {
    if (!flashMsg) return;
    const t = window.setTimeout(() => setFlashMsg(null), flashMsg.type === 'err' ? 7000 : 4000);
    return () => window.clearTimeout(t);
  }, [flashMsg]);

  const data = query.data;
  const seatCap = data?.settings?.maxClassSeats ?? 25;
  const classOps = useMemo<ClassOp[]>(() => {
    if (!data) return [];
    if (data.classOps?.length) return data.classOps;
    return data.classes.map((c) => {
      const max = c.maxStudents ?? seatCap;
      const enrolled = c.enrolledStudents || 0;
      return {
        id: c.id,
        title: c.title,
        status: c.status,
        category: c.category,
        enrolledStudents: enrolled,
        maxStudents: max,
        fillRate: max > 0 ? Math.round((enrolled / max) * 100) : 0,
        seatsLeft: Math.max(0, max - enrolled),
        price: c.price,
        currency: c.currency,
        thumbnail: c.thumbnail,
        instructorName: c.instructor?.name,
        teachingTeamCount: (c.teachingTeam || []).filter((m) => m.role === 'support' && m.status === 'accepted').length,
        createdAt: c.createdAt,
      };
    });
  }, [data, seatCap]);

  const ctx = useMemo<AdminContextValue | null>(
    () =>
      data
        ? {
            data,
            classOps,
            seatCap,
            search,
            intent,
            refetch: () => query.refetch(),
            flash,
            goTo,
          }
        : null,
    [data, classOps, seatCap, search, intent, query, flash, goTo]
  );

  if (authLoading) return <BackendState title="Platform control" loading message="Loading Nexnoon" />;
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location }} />;
  if (user.role !== 'admin') {
    return (
      <BackendState
        title="Platform control"
        message="This page is available to administrators only."
        actionLabel="Admin sign in"
        actionTo="/admin/login"
      />
    );
  }
  if (query.isError) {
    return (
      <BackendState
        title="Platform control"
        message="Unable to load platform data. Check the backend connection and try again."
        retry={() => query.refetch()}
      />
    );
  }
  if (!data || !ctx) return <BackendState title="Platform control" loading message="Loading Nexnoon" />;

  const current = ALL_ITEMS.find((i) => i.id === tab)!;
  const badges: Partial<Record<AdminTab, { value: number; alert?: boolean }>> = {
    instructors: { value: data.summary?.pendingInstructors || 0, alert: true },
    payouts: { value: data.summary?.pendingPayouts || 0, alert: true },
    quality: { value: data.summary?.urgentIncidents || 0, alert: true },
    learners: { value: data.summary?.totalLearners ?? 0 },
    courses: { value: data.courses?.length ?? 0 },
    classes: { value: data.summary?.totalClasses ?? data.classes.length },
    assignments: { value: data.assignmentOps?.length ?? 0 },
  };

  const signOut = () => {
    logout();
    navigate('/admin/login', { replace: true });
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pb-5 pt-6">
        <button type="button" onClick={() => goTo('overview')} className="flex items-center gap-2.5 text-left">
          <span className="flex h-9 w-9 items-center justify-center bg-gradient-to-br from-[#e8c48a] to-[#b7793a] font-display text-lg text-[#0b1220]">
            N
          </span>
          <span>
            <span className="block font-display text-lg leading-none tracking-tight text-white">Nexnoon</span>
            <span className="mt-1 block text-[10px] uppercase tracking-[0.24em] text-white/45">Admin console</span>
          </span>
        </button>
        <button type="button" onClick={() => setNavOpen(false)} className="p-1.5 text-white/60 hover:text-white lg:hidden" aria-label="Close menu">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6" aria-label="Admin sections">
        {NAV.map((g) => (
          <div key={g.group || 'root'}>
            {g.group ? <p className="mb-1.5 px-3 text-[10px] font-medium uppercase tracking-[0.22em] text-white/35">{g.group}</p> : null}
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const Icon = item.icon;
                const active = item.id === tab;
                const badge = badges[item.id];
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => goTo(item.id)}
                      aria-current={active ? 'page' : undefined}
                      className={`relative flex w-full items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                        active ? 'text-white' : 'text-white/60 hover:bg-white/[0.04] hover:text-white'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="admin-nav-active"
                          className="absolute inset-0 border-l-2 border-[#e8c48a] bg-white/[0.08]"
                          transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                        />
                      )}
                      <Icon className="relative h-4 w-4 shrink-0" />
                      <span className="relative flex-1 text-left">{item.label}</span>
                      {badge && badge.value > 0 ? (
                        <span
                          className={`relative min-w-[1.4rem] px-1.5 py-0.5 text-center text-[10px] font-semibold tabular-nums ${
                            badge.alert ? 'bg-amber-400 text-[#0b1220]' : 'text-white/40'
                          }`}
                        >
                          {badge.value}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
            {initials(user.name || user.email)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-white">{user.name || 'Administrator'}</p>
            <p className="truncate text-xs text-white/45">{user.email}</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a
            href={publicSiteHref('/')}
            className="inline-flex items-center justify-center gap-1.5 border border-white/15 px-2 py-2 text-xs text-white/75 transition-colors hover:border-white/30 hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5" /> View site
          </a>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center justify-center gap-1.5 border border-white/15 px-2 py-2 text-xs text-white/75 transition-colors hover:border-white/30 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );

  let body: ReactNode;
  switch (tab) {
    case 'instructors':
      body = <InstructorsSection />;
      break;
    case 'courses':
      body = <CoursesSection />;
      break;
    case 'classes':
      body = <ClassesSection />;
      break;
    case 'learners':
      body = <LearnersSection />;
      break;
    case 'assignments':
      body = <AssignmentsSection />;
      break;
    case 'quality':
      body = <QualitySection />;
      break;
    case 'reviews':
      body = <ReviewsSection />;
      break;
    case 'kpis':
      body = <KpiSection />;
      break;
    case 'payouts':
      body = <PayoutsSection />;
      break;
    case 'activity':
      body = <ActivitySection />;
      break;
    case 'settings':
      body = <SettingsSection />;
      break;
    default:
      body = <OverviewSection />;
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = (user.name || '').split(' ')[0];

  return (
    <AdminContext.Provider value={ctx}>
      <div className="min-h-screen bg-[#edf1f6] font-[family-name:var(--font-sans)] text-[#0b1220]">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-[#0b1220] lg:block">{sidebar}</aside>

        <AnimatePresence>
          {navOpen && (
            <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="absolute inset-0 bg-[#0b1220]/50" onClick={() => setNavOpen(false)} aria-hidden />
              <motion.aside
                className="absolute inset-y-0 left-0 w-72 bg-[#0b1220]"
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              >
                {sidebar}
              </motion.aside>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="lg:pl-64">
          <header className="sticky top-0 z-30 border-b border-[#d0dae6]/80 bg-[#edf1f6]/85 backdrop-blur-md">
            <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 md:px-8">
              <button
                type="button"
                onClick={() => setNavOpen(true)}
                className="-ml-1 p-2 text-[#3d4a5c] hover:text-[#0b1220] lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <p className="hidden text-xs text-[#6a7a8c] sm:block">
                Admin
                {current.group ? <span> / {current.group}</span> : null}
                <span className="text-[#0b1220]"> / {current.label}</span>
              </p>
              <div className="ml-auto flex items-center gap-2">
                {current.searchable ? (
                  <label className="relative w-[min(52vw,320px)]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a96a5]" />
                    <input
                      aria-label={current.searchable}
                      placeholder={current.searchable}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full border border-[#d0dae6] bg-white py-2 pl-9 pr-8 text-sm outline-none transition-[border,box-shadow] focus:border-[#3a5f8a] focus:ring-2 focus:ring-[#889dd1]/25"
                    />
                    {search ? (
                      <button
                        type="button"
                        onClick={() => setSearch('')}
                        aria-label="Clear search"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[#8a96a5] hover:text-[#0b1220]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </label>
                ) : null}
                <button
                  type="button"
                  onClick={() => query.refetch()}
                  aria-label="Refresh data"
                  title="Refresh data"
                  className="flex h-9 w-9 items-center justify-center border border-[#d0dae6] bg-white text-[#3d4a5c] transition-colors hover:border-[#3a5f8a]/60 hover:text-[#0b1220]"
                >
                  <RefreshCw className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-7 md:px-8">
            <div className="mb-6">
              {tab === 'overview' ? (
                <>
                  <p className="text-sm text-[#6a7a8c]">
                    {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  <h1 className="mt-1 font-display text-3xl tracking-tight md:text-[2.1rem]">
                    {greeting}
                    {firstName ? `, ${firstName}` : ''}
                  </h1>
                  <p className="mt-1 text-sm text-[#5c6b7a]">Here’s how Nexnoon is doing today.</p>
                </>
              ) : (
                <>
                  <h1 className="font-display text-3xl tracking-tight md:text-[2.1rem]">{current.label}</h1>
                  <p className="mt-1 text-sm text-[#5c6b7a]">{current.description}</p>
                </>
              )}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                {body}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        <div className="pointer-events-none fixed bottom-5 right-5 z-[90] flex max-w-sm flex-col gap-2" aria-live="polite">
          <AnimatePresence>
            {flashMsg && (
              <motion.div
                key={flashMsg.text}
                role="status"
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8 }}
                className={`pointer-events-auto flex items-start gap-3 border bg-white px-4 py-3 text-sm shadow-[0_20px_50px_-20px_rgba(11,18,32,0.45)] ${
                  flashMsg.type === 'ok' ? 'border-emerald-200' : 'border-rose-200'
                }`}
              >
                {flashMsg.type === 'ok' ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                )}
                <p className="flex-1 text-[#0b1220]">{flashMsg.text}</p>
                <button type="button" onClick={() => setFlashMsg(null)} aria-label="Dismiss" className="text-[#9aa7b5] hover:text-[#0b1220]">
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AdminContext.Provider>
  );
}
