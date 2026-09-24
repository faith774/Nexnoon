import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  GraduationCap,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Sun,
  Users,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import BackendState from '../BackendState';
import InstructorPayouts from '../InstructorPayouts';
import { useAuth } from '@/contexts/AuthContext';
import { useBackendData } from '@/hooks/useBackendData';
import { formatInZone, useViewerTimeZone } from '@/lib/timezone';
import { ViewerTimeZoneSwitcher } from '../TimeZonePicker';
import { StudioContext, type StudioContextValue } from './context';
import type { ClassPanel, Flash, StudioData, StudioTab } from './types';
import { Avatar, btn } from './ui';
import TodaySection from './TodaySection';
import ClassesSection from './ClassesSection';
import ScheduleSection from './ScheduleSection';
import GradingSection from './GradingSection';
import LearnersSection from './LearnersSection';
import PerformanceSection from './PerformanceSection';
import ClassDrawer from './ClassDrawer';

type NavItem = { id: StudioTab; label: string; icon: typeof Sun; description: string; searchable?: string };

const NAV: { group: string; items: NavItem[] }[] = [
  { group: '', items: [{ id: 'today', label: 'Today', icon: Sun, description: 'What needs you today' }] },
  {
    group: 'Teaching',
    items: [
      { id: 'classes', label: 'Classes', icon: GraduationCap, description: 'Your cohorts, sessions, rosters and assignments', searchable: 'Search classes' },
      { id: 'schedule', label: 'Schedule', icon: CalendarDays, description: 'Every session you teach, by day', searchable: 'Search sessions or classes' },
      { id: 'grading', label: 'Grading', icon: ClipboardCheck, description: 'Submissions waiting for a grade', searchable: 'Search learners or assignments' },
      { id: 'learners', label: 'Learners', icon: Users, description: 'Everyone in your classes, with attendance and progress', searchable: 'Search learners or emails' },
    ],
  },
  {
    group: 'You',
    items: [
      { id: 'performance', label: 'Performance', icon: BarChart3, description: 'Your quality score, certifications and learner reviews' },
      { id: 'earnings', label: 'Earnings', icon: Wallet, description: 'Balances, payouts and your earnings ledger' },
    ],
  },
];

const ALL_ITEMS = NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.group })));
const isTab = (v: string | null): v is StudioTab => !!v && ALL_ITEMS.some((i) => i.id === v);
const PANELS: ClassPanel[] = ['overview', 'sessions', 'roster', 'attendance', 'assignments'];

export default function InstructorStudio({ defaultTab = 'today' }: { defaultTab?: StudioTab }) {
  const { user, isLoading: authLoading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [flashMsg, setFlashMsg] = useState<Flash | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [viewerTz] = useViewerTimeZone();

  const isInstructor = user?.role === 'instructor' || user?.role === 'admin';
  const approved = user?.role === 'admin' || user?.instructorStatus === 'approved';
  const query = useBackendData<StudioData>('/data/instructor', false);

  const tabParam = params.get('tab');
  const tab: StudioTab = isTab(tabParam) ? tabParam : defaultTab;
  const drawerClassId = params.get('class');
  const panelParam = params.get('panel') as ClassPanel | null;
  const drawerPanel: ClassPanel = panelParam && PANELS.includes(panelParam) ? panelParam : 'overview';

  const goTo = useCallback(
    (next: StudioTab, extra: Record<string, string> = {}) => {
      setSearch('');
      setNavOpen(false);
      const qs = new URLSearchParams({ ...(next === 'today' ? {} : { tab: next }), ...extra }).toString();
      navigate(`/instructor/dashboard${qs ? `?${qs}` : ''}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [navigate]
  );

  const openClass = useCallback(
    (classId: string, panel: ClassPanel = 'overview') => {
      const next = new URLSearchParams(params);
      next.set('class', classId);
      if (panel === 'overview') next.delete('panel');
      else next.set('panel', panel);
      setParams(next);
    },
    [params, setParams]
  );

  const setDrawerPanel = (panel: ClassPanel) => drawerClassId && openClass(drawerClassId, panel);
  const closeDrawer = () => {
    const next = new URLSearchParams(params);
    next.delete('class');
    next.delete('panel');
    setParams(next);
  };

  const flash = useCallback((f: Flash) => setFlashMsg(f), []);
  useEffect(() => {
    if (!flashMsg) return;
    const t = window.setTimeout(() => setFlashMsg(null), flashMsg.type === 'err' ? 7000 : 4000);
    return () => window.clearTimeout(t);
  }, [flashMsg]);

  const data = query.data;
  const ctx = useMemo<StudioContextValue | null>(
    () => (data ? { data, search, refetch: () => query.refetch(), flash, goTo, openClass } : null),
    [data, search, query, flash, goTo, openClass]
  );

  const title = 'Instructor studio';
  if (authLoading) return <BackendState title={title} loading message="Loading your studio" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!isInstructor) {
    return <BackendState title={title} message="The studio is for Nexnoon instructors." actionLabel="Become an instructor" actionTo="/teach" />;
  }
  if (!approved) {
    return (
      <BackendState
        title={title}
        message={
          user.instructorStatus === 'rejected'
            ? 'Your instructor application was not approved. Contact support if you have questions.'
            : user.instructorStatus === 'suspended'
              ? 'Your instructor account is suspended. Contact support to restore teaching access.'
              : 'Your instructor application is still under review. An admin must approve you before you can teach.'
        }
        actionLabel="View application status"
        actionTo="/instructor/pending-approval"
      />
    );
  }
  if (query.isError) {
    return <BackendState title={title} message="We couldn’t load your studio. Check your connection and try again." retry={() => query.refetch()} />;
  }
  if (!data || !ctx) return <BackendState title={title} loading message="Loading your studio" />;

  const current = ALL_ITEMS.find((i) => i.id === tab)!;
  const upcomingCount = data.sessions.filter((s) => !s.held).length;
  const badges: Partial<Record<StudioTab, { value: number; alert?: boolean }>> = {
    today: { value: data.actions.attendanceGaps + data.actions.invites + data.actions.freeRejected, alert: true },
    classes: { value: data.classes.filter((c) => c.myRole !== 'invited').length },
    schedule: { value: upcomingCount },
    grading: { value: data.actions.ungraded, alert: true },
    learners: { value: new Set(data.learners.filter((l) => l.status !== 'dropped').map((l) => l.userId)).size },
  };

  const signOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pb-5 pt-6">
        <button type="button" onClick={() => goTo('today')} className="flex items-center gap-2.5 text-left">
          <span className="flex h-9 w-9 items-center justify-center bg-[#c45c26] font-serif text-lg text-white">N</span>
          <span>
            <span className="block font-serif text-lg leading-none tracking-tight text-[#14110e]">Nexnoon</span>
            <span className="mt-1 block text-[10px] uppercase tracking-[0.24em] text-[#8a847a]">Instructor studio</span>
          </span>
        </button>
        <button type="button" onClick={() => setNavOpen(false)} className="p-1.5 text-[#8a847a] hover:text-[#14110e] lg:hidden" aria-label="Close menu">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6" aria-label="Studio sections">
        {NAV.map((g) => (
          <div key={g.group || 'root'}>
            {g.group ? <p className="mb-1.5 px-3 text-[10px] font-medium uppercase tracking-[0.22em] text-[#b5aea3]">{g.group}</p> : null}
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
                        active ? 'text-[#14110e]' : 'text-[#6b655c] hover:bg-[#f1ede6] hover:text-[#14110e]'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="studio-nav-active"
                          className="absolute inset-0 border-l-2 border-[#c45c26] bg-[#f6f4f0]"
                          transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                        />
                      )}
                      <Icon className={`relative h-4 w-4 shrink-0 ${active ? 'text-[#c45c26]' : ''}`} />
                      <span className="relative flex-1 text-left">{item.label}</span>
                      {badge && badge.value > 0 ? (
                        <span
                          className={`relative min-w-[1.4rem] px-1.5 py-0.5 text-center text-[10px] font-semibold tabular-nums ${
                            badge.alert ? 'bg-[#c45c26] text-white' : 'text-[#b5aea3]'
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

      <div className="border-t border-[#eee9e0] p-4">
        <Link to="/profile" className="flex items-center gap-3 hover:opacity-80">
          <Avatar name={data.me.fullName || user.email} src={data.me.avatar || undefined} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-[#14110e]">{data.me.fullName || 'Instructor'}</p>
            <p className="truncate text-xs text-[#8a847a]">{data.me.email}</p>
          </div>
        </Link>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-1.5 border border-[#e4dfd6] px-2 py-2 text-xs text-[#6b655c] transition-colors hover:border-[#14110e]/40 hover:text-[#14110e]"
          >
            <Compass className="h-3.5 w-3.5" /> Browse site
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center justify-center gap-1.5 border border-[#e4dfd6] px-2 py-2 text-xs text-[#6b655c] transition-colors hover:border-[#14110e]/40 hover:text-[#14110e]"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );

  let body: ReactNode;
  switch (tab) {
    case 'classes':
      body = <ClassesSection />;
      break;
    case 'schedule':
      body = <ScheduleSection />;
      break;
    case 'grading':
      body = <GradingSection />;
      break;
    case 'learners':
      body = <LearnersSection />;
      break;
    case 'performance':
      body = <PerformanceSection />;
      break;
    case 'earnings':
      body = <InstructorPayouts />;
      break;
    default:
      body = <TodaySection />;
  }

  const hour = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: viewerTz }));
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = (data.me.fullName || user.name || '').split(' ')[0];

  return (
    <StudioContext.Provider value={ctx}>
      <div className="min-h-screen bg-[#f6f4f0] text-[#14110e]">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-[#e4dfd6] bg-white lg:block">{sidebar}</aside>

        <AnimatePresence>
          {navOpen && (
            <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="absolute inset-0 bg-[#14110e]/40" onClick={() => setNavOpen(false)} aria-hidden />
              <motion.aside
                className="absolute inset-y-0 left-0 w-72 bg-white"
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
          <header className="sticky top-0 z-30 border-b border-[#e4dfd6] bg-[#f6f4f0]/85 backdrop-blur-md">
            <div className="mx-auto flex max-w-[1320px] items-center gap-3 px-4 py-3 md:px-8">
              <button type="button" onClick={() => setNavOpen(true)} className="-ml-1 p-2 text-[#6b655c] hover:text-[#14110e] lg:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </button>
              <p className="hidden text-xs text-[#8a847a] sm:block">
                Studio
                {current.group ? <span> / {current.group}</span> : null}
                <span className="text-[#14110e]"> / {current.label}</span>
              </p>
              <div className="ml-auto flex items-center gap-2">
                {current.searchable ? (
                  <label className="relative w-[min(46vw,300px)]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#b5aea3]" />
                    <input
                      aria-label={current.searchable}
                      placeholder={current.searchable}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full border border-[#e4dfd6] bg-white py-2 pl-9 pr-8 text-sm outline-none transition-[border,box-shadow] focus:border-[#c45c26] focus:ring-2 focus:ring-[#c45c26]/15"
                    />
                    {search ? (
                      <button
                        type="button"
                        onClick={() => setSearch('')}
                        aria-label="Clear search"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[#b5aea3] hover:text-[#14110e]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </label>
                ) : null}
                <button
                  type="button"
                  onClick={() => query.refetch()}
                  aria-label="Refresh"
                  title="Refresh"
                  className="flex h-9 w-9 items-center justify-center border border-[#e4dfd6] bg-white text-[#6b655c] transition-colors hover:border-[#14110e]/40 hover:text-[#14110e]"
                >
                  <RefreshCw className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} />
                </button>
                <Link to="/create-class" className={`${btn.accent} hidden sm:inline-flex`}>
                  <Plus className="h-4 w-4" /> New class
                </Link>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-[1320px] px-4 pb-16 pt-7 md:px-8">
            <div className="mb-6">
              {tab === 'today' ? (
                <>
                  <p className="text-sm text-[#8a847a]">{formatInZone(new Date(), viewerTz, 'weekday')}</p>
                  <h1 className="mt-1 font-serif text-3xl tracking-tight md:text-[2.1rem]">
                    {greeting}
                    {firstName ? `, ${firstName}` : ''}
                  </h1>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#6b655c]">
                    Here’s your teaching day.
                    <ViewerTimeZoneSwitcher />
                  </p>
                </>
              ) : (
                <>
                  <h1 className="font-serif text-3xl tracking-tight md:text-[2.1rem]">{current.label}</h1>
                  <p className="mt-1 text-sm text-[#6b655c]">{current.description}</p>
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

        <ClassDrawer classId={drawerClassId} panel={drawerPanel} onPanel={setDrawerPanel} onClose={closeDrawer} />

        <div className="pointer-events-none fixed bottom-5 right-5 z-[90] flex max-w-sm flex-col gap-2" aria-live="polite">
          <AnimatePresence>
            {flashMsg && (
              <motion.div
                key={flashMsg.text}
                role="status"
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8 }}
                className={`pointer-events-auto flex items-start gap-3 border bg-white px-4 py-3 text-sm shadow-[0_20px_50px_-20px_rgba(20,17,14,0.45)] ${
                  flashMsg.type === 'ok' ? 'border-emerald-200' : 'border-rose-200'
                }`}
              >
                {flashMsg.type === 'ok' ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                )}
                <p className="flex-1 text-[#14110e]">{flashMsg.text}</p>
                <button type="button" onClick={() => setFlashMsg(null)} aria-label="Dismiss" className="text-[#b5aea3] hover:text-[#14110e]">
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </StudioContext.Provider>
  );
}
