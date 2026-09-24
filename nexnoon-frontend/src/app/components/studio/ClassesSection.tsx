import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CalendarClock, ClipboardCheck, Pencil, Plus, UserCheck, Users, Video } from 'lucide-react';
import { useStudio } from './context';
import type { StudioClass } from './types';
import { EmptyBlock, FilterChips, Pill, ProgressBar, btn, matches, statusToneOf } from './ui';
import { useTimeFormat } from '@/lib/timezone';


type Filter = 'all' | 'live' | 'draft' | 'attention' | 'finished' | 'support';
const FILTERS: Filter[] = ['all', 'live', 'draft', 'attention', 'finished', 'support'];

export function classNeedsAttention(c: StudioClass) {
  return (
    c.freeApproval?.status === 'rejected' ||
    (c.status === 'published' && c.ops.sessionsTotal === 0 && c.myRole === 'lead') ||
    c.ops.attendanceGaps > 0 ||
    c.ops.ungraded > 0
  );
}

export function classIsFinished(c: StudioClass) {
  return c.status === 'archived' || Boolean(c.cancelledAt) || (c.ops.sessionsTotal > 0 && !c.ops.nextSessionAt);
}

export default function ClassesSection() {
  const { data, search, openClass } = useStudio();
  const [params] = useSearchParams();
  const initial = params.get('status') as Filter | null;
  const [filter, setFilter] = useState<Filter>(initial && FILTERS.includes(initial) ? initial : 'all');

  const mine = useMemo(() => data.classes.filter((c) => c.myRole !== 'invited'), [data.classes]);
  const buckets: Record<Filter, StudioClass[]> = useMemo(
    () => ({
      all: mine,
      live: mine.filter((c) => c.status === 'published' && !classIsFinished(c)),
      draft: mine.filter((c) => c.status === 'draft'),
      attention: mine.filter(classNeedsAttention),
      finished: mine.filter(classIsFinished),
      support: mine.filter((c) => c.myRole === 'support'),
    }),
    [mine]
  );

  const rows = buckets[filter]
    .filter((c) => matches(search, c.title, c.courseTitle, c.category, c.languageLabel))
    .sort((a, b) => {
      const an = a.ops.nextSessionAt ? new Date(a.ops.nextSessionAt).getTime() : Infinity;
      const bn = b.ops.nextSessionAt ? new Date(b.ops.nextSessionAt).getTime() : Infinity;
      return an - bn || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const labels: Record<Filter, string> = {
    all: 'All',
    live: 'Live',
    draft: 'Drafts',
    attention: 'Needs attention',
    finished: 'Finished',
    support: 'Supporting',
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips
          label="Filter classes"
          value={filter}
          onChange={setFilter}
          options={FILTERS.filter((f) => f === 'all' || buckets[f].length || f === filter).map((f) => ({
            id: f,
            label: labels[f],
            count: buckets[f].length,
          }))}
        />
        <Link to="/create-class" className={`${btn.accent} sm:hidden`}>
          <Plus className="h-4 w-4" /> New class
        </Link>
      </div>

      {rows.length ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {rows.map((c) => (
            <ClassCard key={c.id} cls={c} onOpen={() => openClass(c.id)} />
          ))}
        </div>
      ) : (
        <EmptyBlock
          text={
            search
              ? 'No classes match your search.'
              : filter === 'all'
                ? 'You’re not teaching any classes yet.'
                : `No classes in “${labels[filter]}”.`
          }
          action={
            filter === 'all' && !search ? (
              <Link to="/create-class" className={btn.accent}>
                Create your first class
              </Link>
            ) : null
          }
        />
      )}
    </div>
  );
}

function ClassCard({ cls: c, onOpen }: { cls: StudioClass; onOpen: () => void }) {
  const t = useTimeFormat();
  const { openClass } = useStudio();
  const finished = classIsFinished(c);
  const statusLabel = c.cancelledAt ? 'cancelled' : finished && c.status === 'published' ? 'finished' : c.status;

  return (
    <article className="group flex flex-col border border-[#e4dfd6] bg-white transition-colors hover:border-[#14110e]/35">
      <button type="button" onClick={onOpen} className="flex gap-4 p-4 text-left">
        <div className="h-20 w-24 shrink-0 overflow-hidden bg-[#f1ede6]">
          {c.thumbnail ? <img src={c.thumbnail} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill tone={statusToneOf(statusLabel)}>{statusLabel}</Pill>
            <Pill tone={c.myRole === 'lead' ? 'ink' : 'clay'}>{c.myRole}</Pill>
            {c.freeApproval?.status === 'pending' ? <Pill tone="amber">Free · awaiting approval</Pill> : null}
            {c.freeApproval?.status === 'rejected' ? <Pill tone="rose">Free · not approved</Pill> : null}
          </div>
          <h3 className="mt-1.5 line-clamp-2 font-serif text-lg leading-snug text-[#14110e]">{c.title}</h3>
          <p className="mt-0.5 truncate text-xs text-[#8a847a]">
            {[c.courseTitle, c.languageLabel].filter(Boolean).join(' · ') || c.category}
          </p>
        </div>
      </button>

      <div className="grid grid-cols-3 divide-x divide-[#eee9e0] border-y border-[#eee9e0] text-xs">
        <div className="px-4 py-2.5">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-[#8a847a]">
            <Users className="h-3 w-3" /> Seats
          </p>
          <p className="mt-1 text-sm text-[#14110e]">
            {c.ops.enrolled}/{c.ops.maxStudents}
          </p>
          <ProgressBar value={c.ops.fillRate} className="mt-1.5" />
        </div>
        <div className="px-4 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[#8a847a]">Sessions</p>
          <p className="mt-1 text-sm text-[#14110e]">
            {c.ops.sessionsHeld}/{c.ops.sessionsTotal} held
          </p>
        </div>
        <div className="px-4 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[#8a847a]">Attendance</p>
          <p className="mt-1 text-sm text-[#14110e]">{c.ops.sessionsHeld ? `${c.ops.attendanceRate}%` : '—'}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-3 p-4">
        <p className="flex items-center gap-2 text-xs text-[#6b655c]">
          <CalendarClock className="h-3.5 w-3.5 text-[#c45c26]" />
          {c.ops.nextSessionAt ? (
            <>
              Next: <span className="text-[#14110e]">{t.dayTime(c.ops.nextSessionAt)}</span>
            </>
          ) : c.ops.sessionsTotal ? (
            'No upcoming sessions'
          ) : (
            'No sessions scheduled'
          )}
        </p>

        {c.ops.attendanceGaps || c.ops.ungraded ? (
          <div className="flex flex-wrap gap-2">
            {c.ops.attendanceGaps ? (
              <button type="button" onClick={() => openClass(c.id, 'attendance')} className="inline-flex items-center gap-1 bg-[#fbeee6] px-2 py-1 text-xs text-[#9a4518] hover:bg-[#f6dccb]">
                <UserCheck className="h-3 w-3" /> {c.ops.attendanceGaps} to mark
              </button>
            ) : null}
            {c.ops.ungraded ? (
              <button type="button" onClick={() => openClass(c.id, 'assignments')} className="inline-flex items-center gap-1 bg-[#fbeee6] px-2 py-1 text-xs text-[#9a4518] hover:bg-[#f6dccb]">
                <ClipboardCheck className="h-3 w-3" /> {c.ops.ungraded} to grade
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="flex gap-2">
          <Link to={`/classroom/${c.id}`} className={`${btn.primary} flex-1 text-xs`}>
            <Video className="h-3.5 w-3.5" /> Classroom
          </Link>
          {c.myRole === 'lead' && !c.cancelledAt ? (
            <Link to={`/edit-class/${c.id}`} className={`${btn.secondary} text-xs`} aria-label={`Edit ${c.title}`}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Link>
          ) : null}
          <button type="button" onClick={onOpen} className={`${btn.secondary} text-xs`}>
            Details
          </button>
        </div>
      </div>
    </article>
  );
}
