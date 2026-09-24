import { useState } from 'react';
import { Activity, AlertTriangle, ArrowUpRight, CheckCircle2, Flame, TrendingUp } from 'lucide-react';
import { useAdmin } from './context';
import { PaymentsPanel } from './Panels';
import { Panel, Pill, ProgressBar, StatTile, btn, fmtDateTime, money } from './ui';
import type { AdminIntent, AdminTab } from './types';

type Attention = { id: string; tone: 'warn' | 'info'; title: string; detail: string; tab: AdminTab; intent?: AdminIntent; cta: string };

export default function OverviewSection() {
  const { data, classOps, seatCap, goTo, search } = useAdmin();
  const [period, setPeriod] = useState<'all' | 'week' | 'month' | 'year'>('all');

  const s = data.summary;
  const pending = s?.pendingInstructors || 0;
  const nearFull = s?.nearFullClasses ?? 0;
  const lowFill = s?.lowFillClasses ?? 0;
  const draftCourses = (data.courses || []).filter((c) => c.status === 'draft').length;
  const closedMissing = (data.assignmentOps || []).filter(
    (a) => a.dueDate && new Date(a.dueDate).getTime() < Date.now() && a.submissionCount < a.enrolledStudents
  ).length;
  const learnersNoClass = (data.users || []).filter((u) => u.role === 'student' && !(u.enrollmentCount ?? 0)).length;

  const pendingPayouts = s?.pendingPayouts ?? 0;
  const urgentIncidents = s?.urgentIncidents ?? 0;
  const freePending = classOps.filter((c) => c.freeApproval?.status === 'pending').length;

  const attention: Attention[] = [
    urgentIncidents && {
      id: 'incidents',
      tone: 'warn',
      title: `${urgentIncidents} high-severity report${urgentIncidents === 1 ? '' : 's'} open`,
      detail: 'Off-platform payment or conduct reports from learners.',
      tab: 'quality',
      cta: 'Investigate',
    },
    pendingPayouts && {
      id: 'payouts',
      tone: 'warn',
      title: `${pendingPayouts} payout request${pendingPayouts === 1 ? '' : 's'} waiting`,
      detail: 'Instructors are waiting to be paid.',
      tab: 'payouts',
      cta: 'Review',
    },
    freePending && {
      id: 'free-classes',
      tone: 'warn',
      title: `${freePending} free class${freePending === 1 ? '' : 'es'} awaiting approval`,
      detail: 'Hidden from learners until you approve or reject.',
      tab: 'classes',
      intent: { classStatus: 'free-approval' },
      cta: 'Review',
    },
    pending && {
      id: 'pending',
      tone: 'warn',
      title: `${pending} instructor application${pending === 1 ? '' : 's'} waiting`,
      detail: 'Review profiles and approve or reject.',
      tab: 'instructors',
      intent: { instructorFilter: 'pending' },
      cta: 'Review',
    },
    nearFull && {
      id: 'near-full',
      tone: 'info',
      title: `${nearFull} class${nearFull === 1 ? ' is' : 'es are'} nearly full`,
      detail: `80%+ of the ${seatCap}-seat cap taken. Consider opening another cohort.`,
      tab: 'classes',
      intent: { classFill: 'near-full' },
      cta: 'See classes',
    },
    lowFill && {
      id: 'low-fill',
      tone: 'warn',
      title: `${lowFill} class${lowFill === 1 ? ' has' : 'es have'} low enrollment`,
      detail: 'Under 30% full. They may need promotion.',
      tab: 'classes',
      intent: { classFill: 'low-fill' },
      cta: 'See classes',
    },
    closedMissing && {
      id: 'missing',
      tone: 'info',
      title: `${closedMissing} closed assignment${closedMissing === 1 ? '' : 's'} with missing work`,
      detail: 'Past due and not every learner submitted.',
      tab: 'assignments',
      cta: 'Open',
    },
    draftCourses && {
      id: 'drafts',
      tone: 'info',
      title: `${draftCourses} course${draftCourses === 1 ? '' : 's'} still in draft`,
      detail: 'Learners can’t see drafts in the catalog.',
      tab: 'courses',
      cta: 'Open',
    },
    learnersNoClass && {
      id: 'no-class',
      tone: 'info',
      title: `${learnersNoClass} learner${learnersNoClass === 1 ? '' : 's'} not in any class`,
      detail: 'Signed up but never enrolled.',
      tab: 'learners',
      cta: 'View',
    },
  ].filter(Boolean) as Attention[];

  const days = period === 'week' ? 7 : period === 'month' ? 30 : period === 'year' ? 365 : Infinity;
  const after = Date.now() - days * 86400000;
  const payments = data.payments.filter((p) => new Date(p.createdAt).getTime() >= after);

  const topClasses = classOps
    .filter((c) => c.status === 'published')
    .sort((a, b) => b.fillRate - a.fillRate)
    .slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatTile label="Learners" value={s?.totalLearners ?? 0} hint={`${s?.totalEnrollments ?? 0} enrollments`} onClick={() => goTo('learners')} />
        <StatTile
          label="Instructors"
          value={s?.totalInstructors ?? 0}
          hint={pending ? `${pending} awaiting review` : 'All reviewed'}
          tone={pending ? 'warn' : undefined}
          onClick={() => goTo('instructors', pending ? { instructorFilter: 'pending' } : { instructorFilter: 'all' })}
        />
        <StatTile label="Courses" value={s?.totalCourses ?? 0} hint={`${s?.publishedCourses ?? 0} published`} onClick={() => goTo('courses')} />
        <StatTile
          label="Classes"
          value={s?.publishedClasses ?? 0}
          hint={`published · avg ${s?.avgFillRate ?? 0}% full`}
          onClick={() => goTo('classes')}
        />
        <StatTile label="Platform GMV" value={money(s?.platformGmv || 0)} hint="Completed payments" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Panel
          title="Needs attention"
          subtitle={attention.length ? `${attention.length} thing${attention.length === 1 ? '' : 's'} to look at` : 'Nothing urgent'}
          icon={<AlertTriangle className="h-4 w-4" />}
          bodyClassName=""
        >
          {attention.length ? (
            <ul className="divide-y divide-[#eef2f7]">
              {attention.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-3.5 md:px-6">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${a.tone === 'warn' ? 'bg-amber-500' : 'bg-[#3a5f8a]'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#0b1220]">{a.title}</p>
                    <p className="text-xs text-[#7a8898]">{a.detail}</p>
                  </div>
                  <button type="button" className={btn.link} onClick={() => goTo(a.tab, a.intent)}>
                    {a.cta} <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-3 px-6 py-8 text-sm text-[#5c6b7a]">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              All clear. No pending approvals, capacity issues or missing work.
            </div>
          )}
        </Panel>

        <Panel
          title="Fullest classes"
          subtitle={`Seat cap is ${seatCap} per class`}
          icon={<Flame className="h-4 w-4" />}
          actions={
            <button type="button" className={btn.link} onClick={() => goTo('classes')}>
              All classes
            </button>
          }
          bodyClassName=""
        >
          {topClasses.length ? (
            <ul className="divide-y divide-[#eef2f7]">
              {topClasses.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => goTo('classes', { openClassId: c.id })}
                    className="flex w-full items-center gap-4 px-5 py-3 text-left hover:bg-[#f7f9fc] md:px-6"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#0b1220]">{c.title}</p>
                      <p className="truncate text-xs text-[#7a8898]">{c.instructorName || 'No instructor'}</p>
                    </div>
                    <div className="w-28">
                      <p className="mb-1 text-right text-[11px] tabular-nums text-[#5c6b7a]">
                        {c.enrolledStudents}/{c.maxStudents}
                      </p>
                      <ProgressBar value={c.fillRate} tone={c.fillRate >= 80 ? 'bg-emerald-500' : undefined} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-6 py-8 text-sm text-[#5c6b7a]">No published classes yet.</p>
          )}
        </Panel>
      </div>

      <Panel
        title="Latest activity"
        subtitle="Approvals, enrollments, payments and submissions"
        icon={<Activity className="h-4 w-4" />}
        actions={
          <button type="button" className={btn.link} onClick={() => goTo('activity')}>
            Full log
          </button>
        }
        bodyClassName=""
      >
        {(data.activity || []).length ? (
          <ul className="divide-y divide-[#eef2f7]">
            {(data.activity || []).slice(0, 6).map((item) => (
              <li key={item.id} className="flex items-start gap-3 px-5 py-3 text-sm md:px-6">
                <Pill tone="blue" className="mt-0.5 w-[84px] justify-center">
                  {item.category}
                </Pill>
                <p className="min-w-0 flex-1 text-[#0b1220]">{item.message}</p>
                <span className="hidden shrink-0 text-xs text-[#9aa7b5] sm:block">{fmtDateTime(item.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-6 py-8 text-sm text-[#5c6b7a]">No activity yet.</p>
        )}
      </Panel>

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-medium text-[#0b1220]">
            <TrendingUp className="h-4 w-4 text-[#3a5f8a]" /> Revenue
          </p>
          <select
            aria-label="Payment period"
            className="border border-[#d0dae6] bg-white px-3 py-2 text-sm outline-none focus:border-[#3a5f8a]"
            value={period}
            onChange={(e) => setPeriod(e.target.value as typeof period)}
          >
            <option value="all">All time</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
            <option value="year">Last 365 days</option>
          </select>
        </div>
        <PaymentsPanel payments={payments} search={search} />
      </div>
    </div>
  );
}
