import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Hourglass, RefreshCw, Search } from 'lucide-react';
import Header from './Header';
import Footer from './Footer';
import { ViewerTimeZoneSwitcher } from './TimeZonePicker';
import { btn, SegmentedTabs, StatTile } from './studio/ui';
import { useBackendData } from '@/hooks/useBackendData';
import { useTimeFormat } from '@/lib/timezone';
import Overview, { NextUpCard } from './learner/Overview';
import ClassesTab from './learner/ClassesTab';
import ScheduleTab from './learner/ScheduleTab';
import { AssignmentsTab, CertificatesTab, PaymentsTab } from './learner/WorkTabs';
import LeaveClassModal from './learner/LeaveClassModal';
import ReviewModal from './learner/ReviewModal';
import { countdown, Skeleton, useNow } from './learner/shared';
import type { LearnerClass, LearnerData, LearnerTab } from './learner/types';

const TABS: LearnerTab[] = ['overview', 'schedule', 'classes', 'assignments', 'certificates', 'payments'];
const isTab = (v: string | null): v is LearnerTab => !!v && (TABS as string[]).includes(v);

function greeting(hour: number) {
  if (hour < 5) return 'Good evening';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function summaryLine(data: LearnerData) {
  const parts: string[] = [];
  const { sessionsThisWeek, assignmentsDue, overdue } = data.summary;
  if (sessionsThisWeek) parts.push(`${sessionsThisWeek} session${sessionsThisWeek === 1 ? '' : 's'} in the next 7 days`);
  if (assignmentsDue) parts.push(`${assignmentsDue} assignment${assignmentsDue === 1 ? '' : 's'} to do${overdue ? ` (${overdue} overdue)` : ''}`);
  if (!parts.length) return data.classes.length ? "You're all caught up." : 'Your learning home. Enroll in a class to get started.';
  return `You have ${parts.join(' and ')}.`;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading your dashboard">
      <Skeleton className="h-44 w-full" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
      </div>
      <Skeleton className="h-8 w-2/3" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    </div>
  );
}

export default function LearnerDashboard() {
  const [params, setParams] = useSearchParams();
  const query = useBackendData<LearnerData>('/data/learner', false, { refetchInterval: 60_000 });
  const data = query.data;
  const t = useTimeFormat();
  const now = useNow(30_000);
  const [leaving, setLeaving] = useState<LearnerClass | null>(null);
  const [reviewing, setReviewing] = useState<LearnerClass | null>(null);

  const tabParam = params.get('tab');
  const tab: LearnerTab = isTab(tabParam) ? tabParam : 'overview';
  const goTo = useCallback(
    (next: LearnerTab) => {
      const p = new URLSearchParams(params);
      if (next === 'overview') p.delete('tab');
      else p.set('tab', next);
      setParams(p, { replace: true });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [params, setParams]
  );
  const refresh = useCallback(() => void query.refetch(), [query]);

  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: t.tz }).format(new Date(now)));
  const offers = useMemo(
    () => (data?.waitlist || []).filter((w) => w.status === 'offered' && w.offerExpiresAt && new Date(w.offerExpiresAt).getTime() > now),
    [data, now]
  );
  const nextUp = data?.nextUp && new Date(data.nextUp.endTime).getTime() > now ? data.nextUp : null;
  const nextUpStale = !!data?.nextUp && !nextUp;
  useEffect(() => {
    if (nextUpStale && !query.isFetching) void query.refetch();
  }, [nextUpStale, query]);

  const tabs = data
    ? [
        { id: 'overview' as const, label: 'Overview' },
        { id: 'schedule' as const, label: 'Schedule', count: data.upcomingSessions.length },
        { id: 'classes' as const, label: 'Classes', count: data.classes.filter((c) => c.state !== 'left').length },
        { id: 'assignments' as const, label: 'Assignments', count: data.summary.assignmentsDue },
        { id: 'certificates' as const, label: 'Certificates', count: data.certificates.length },
        { id: 'payments' as const, label: 'Payments' },
      ]
    : [];

  return (
    <div className="min-h-screen bg-[#f6f4f0] text-[#14110e]">
      <Header variant="light" />
      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#8a847a]">My learning</p>
            <h1 className="mt-1 font-serif text-3xl tracking-tight md:text-4xl">
              {greeting(hour)}{data?.profile.firstName ? `, ${data.profile.firstName}` : ''}
            </h1>
            <p className="mt-1.5 text-sm text-[#6b655c]">{data ? summaryLine(data) : 'Loading your classes…'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ViewerTimeZoneSwitcher />
            <button type="button" onClick={refresh} className="flex h-9 w-9 items-center justify-center border border-[#d5cfc4] bg-white text-[#6b655c] hover:text-[#14110e]" aria-label="Refresh">
              <RefreshCw className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} />
            </button>
            <Link to="/browse" className={btn.primary}><Search className="h-4 w-4" /> Browse classes</Link>
          </div>
        </div>

        {query.isLoading ? (
          <DashboardSkeleton />
        ) : query.isError || !data ? (
          <section className="border border-[#e4dfd6] bg-white p-8 text-center">
            <h2 className="font-serif text-xl">We couldn't load your dashboard</h2>
            <p className="mt-1 text-sm text-[#6b655c]">Check your connection and try again.</p>
            <button type="button" onClick={refresh} className={`${btn.primary} mt-5`}>Try again</button>
          </section>
        ) : (
          <div className="space-y-6">
            {offers.map((w) => (
              <div key={w.classId} role="status" className="flex flex-wrap items-center gap-4 border border-[#f0d3c1] bg-[#fbeee6] px-4 py-3.5">
                <Hourglass className="h-5 w-5 shrink-0 text-[#c45c26]" />
                <p className="min-w-0 flex-1 text-sm">
                  <strong className="font-medium">A seat opened in {w.classTitle}.</strong>{' '}
                  <span className="text-[#6b655c]">It's held for you for {countdown(w.offerExpiresAt!, now)}.</span>
                </p>
                <Link to={`/payment/${w.classId}`} className={btn.accent}>Claim my seat</Link>
              </div>
            ))}

            {tab === 'overview' && nextUp ? <NextUpCard session={nextUp} joinEarlyMinutes={data.policy.joinEarlyMinutes} /> : null}

            {tab === 'overview' && data.classes.length ? (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile label="Active classes" value={data.summary.inProgress + data.summary.upcoming} hint={data.summary.upcoming ? `${data.summary.upcoming} starting soon` : 'In progress'} onClick={() => goTo('classes')} />
                <StatTile
                  label="Attendance"
                  value={data.summary.attendanceRate != null ? `${data.summary.attendanceRate}%` : '—'}
                  hint={data.summary.hoursLearned ? `${data.summary.hoursLearned} h of live class` : 'Starts with your first session'}
                  tone={data.summary.attendanceRate != null && data.summary.attendanceRate >= 80 ? 'good' : undefined}
                  onClick={() => goTo('schedule')}
                />
                <StatTile
                  label="To do"
                  value={data.summary.assignmentsDue}
                  hint={data.summary.overdue ? `${data.summary.overdue} overdue` : 'Assignments open'}
                  tone={data.summary.overdue ? 'warn' : undefined}
                  onClick={() => goTo('assignments')}
                />
                <StatTile label="Certificates" value={data.summary.certificates} hint={data.summary.completed ? `${data.summary.completed} class${data.summary.completed === 1 ? '' : 'es'} completed` : 'Earned on completion'} onClick={() => goTo('certificates')} />
              </div>
            ) : null}

            <SegmentedTabs value={tab} onChange={goTo} tabs={tabs} />

            <div role="tabpanel" aria-label={tab}>
              {tab === 'overview' ? <Overview data={data} goTo={goTo} /> : null}
              {tab === 'schedule' ? <ScheduleTab data={data} /> : null}
              {tab === 'classes' ? <ClassesTab data={data} onLeave={setLeaving} onReview={setReviewing} onChanged={refresh} /> : null}
              {tab === 'assignments' ? <AssignmentsTab data={data} /> : null}
              {tab === 'certificates' ? <CertificatesTab data={data} /> : null}
              {tab === 'payments' ? <PaymentsTab data={data} onLeave={setLeaving} /> : null}
            </div>
          </div>
        )}
      </main>
      <Footer />
      <LeaveClassModal cls={leaving} onClose={() => setLeaving(null)} onLeft={refresh} />
      <ReviewModal cls={reviewing} onClose={() => setReviewing(null)} onSaved={refresh} />
    </div>
  );
}
