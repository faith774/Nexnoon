import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Award, CalendarDays, FileText, Hourglass, LogOut, MoreHorizontal, Star, Users } from 'lucide-react';
import { btn, EmptyBlock, FilterChips, Pill, SectionLabel } from './ui';
import { enrollmentService, getErrorMessage } from '@/lib/api';
import { useTimeFormat } from '@/lib/timezone';
import { toast } from 'sonner';
import { classStateMeta, countdown, Meter, Thumb, useNow } from './shared';
import type { LearnerClass, LearnerData, LearnerWaitlist } from './types';

type Filter = 'active' | 'completed' | 'past' | 'all';

function ClassCard({ c, onLeave, onReview }: { c: LearnerClass; onLeave: (c: LearnerClass) => void; onReview: (c: LearnerClass) => void }) {
  const t = useTimeFormat();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [menu]);
  const meta = classStateMeta[c.state];
  const canLeave = c.enrollmentStatus === 'active' && (c.state === 'upcoming' || c.state === 'in_progress');
  const inactive = c.state === 'left' || c.state === 'cancelled';

  return (
    <article className={`flex flex-col rounded-2xl border border-[#ebe6de] bg-white ${inactive ? 'opacity-80' : ''}`}>
      <div className="relative">
        <Thumb src={c.thumbnail} className="aspect-[16/7] w-full rounded-t-2xl" />
        <div className="absolute left-3 top-3"><Pill tone={meta.tone} className="bg-white/95">{meta.label}</Pill></div>
        {canLeave ? (
          <div ref={menuRef} className="absolute right-2 top-2">
            <button
              type="button"
              aria-label="More actions"
              aria-expanded={menu}
              onClick={() => setMenu((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[#6b655c] shadow-sm hover:text-[#14110e]"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menu ? (
              <div className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-xl border border-[#ebe6de] bg-white py-1 shadow-lg" role="menu">
                <button type="button" role="menuitem" onClick={() => { setMenu(false); onLeave(c); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-800 hover:bg-rose-50">
                  <LogOut className="h-4 w-4" /> Leave class
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#8a847a]">{[c.category, c.language].filter(Boolean).join(' · ') || 'Live class'}</p>
          <h3 className="mt-1 font-serif text-lg leading-snug tracking-tight">{c.title}</h3>
          <p className="mt-0.5 text-xs text-[#6b655c]">with {c.instructor.name}</p>
        </div>

        {c.state === 'cancelled' ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
            This class was cancelled{c.cancellationReason ? `: ${c.cancellationReason}` : '.'}
            {c.payment?.status === 'refunded' ? ' Your payment was refunded.' : ''}
          </p>
        ) : c.state === 'left' ? (
          <p className="text-xs text-[#8a847a]">
            You left on {c.droppedAt ? t.date(c.droppedAt) : '—'}{c.payment?.status === 'refunded' ? ' · refunded' : ''}.
          </p>
        ) : (
          <>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-[#6b655c]">
                <span>Progress</span>
                <span className="tabular-nums">{c.progress}%</span>
              </div>
              <Meter value={c.progress} label={`${c.title} progress`} />
            </div>
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-[#f7f5f1] px-2 py-2">
                <dt className="text-[10px] uppercase tracking-[0.12em] text-[#8a847a]">Attended</dt>
                <dd className="mt-0.5 text-sm font-medium tabular-nums">{c.attended}/{c.held || 0}</dd>
              </div>
              <div className="rounded-xl bg-[#f7f5f1] px-2 py-2">
                <dt className="text-[10px] uppercase tracking-[0.12em] text-[#8a847a]">Work</dt>
                <dd className="mt-0.5 text-sm font-medium tabular-nums">{c.assignments.total ? `${c.assignments.submitted}/${c.assignments.total}` : '—'}</dd>
              </div>
              <div className="rounded-xl bg-[#f7f5f1] px-2 py-2">
                <dt className="text-[10px] uppercase tracking-[0.12em] text-[#8a847a]">Grade</dt>
                <dd className="mt-0.5 text-sm font-medium tabular-nums">{c.assignments.averageScore != null ? `${c.assignments.averageScore}%` : '—'}</dd>
              </div>
            </dl>
            {c.nextSession ? (
              <p className="flex items-center gap-1.5 text-xs text-[#6b655c]">
                <CalendarDays className="h-3.5 w-3.5 text-[#b5aea3]" />
                Next: {t.dayTime(c.nextSession.startTime)}
              </p>
            ) : c.totalSessions ? (
              <p className="flex items-center gap-1.5 text-xs text-[#6b655c]"><CalendarDays className="h-3.5 w-3.5 text-[#b5aea3]" />All {c.totalSessions} sessions held</p>
            ) : null}
          </>
        )}

        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          {c.state === 'left' || c.state === 'cancelled' ? (
            <Link to={`/class/${c.id}`} className={btn.secondary}>View class</Link>
          ) : (
            <Link to={`/classroom/${c.id}`} className={btn.primary}>Open classroom</Link>
          )}
          {c.assignments.open > 0 && !inactive ? (
            <Link to={`/assignments/${c.id}`} className={btn.secondary}><FileText className="h-3.5 w-3.5" /> {c.assignments.open} to do</Link>
          ) : null}
          {c.certificateId ? (
            <Link to={`/certificates/${c.certificateId}`} className={btn.secondary}><Award className="h-3.5 w-3.5" /> Certificate</Link>
          ) : null}
          {c.canReview && !inactive ? (
            <button type="button" className={btn.secondary} onClick={() => onReview(c)}>
              <Star className={`h-3.5 w-3.5 ${c.review ? 'fill-[#c45c26] text-[#c45c26]' : ''}`} /> {c.review ? `Your review · ${c.review.rating}/5` : 'Leave a review'}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function WaitlistRow({ w, onChanged }: { w: LearnerWaitlist; onChanged: () => void }) {
  const t = useTimeFormat();
  const now = useNow(30_000);
  const [busy, setBusy] = useState(false);
  const offered = w.status === 'offered';

  async function leave() {
    setBusy(true);
    try {
      toast.success(await enrollmentService.leaveWaitlist(w.classId));
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={`flex flex-wrap items-center gap-4 rounded-2xl border p-3.5 ${offered ? 'border-[#f0d3c1] bg-[#fbeee6]' : 'border-[#ebe6de] bg-white'}`}>
      <Thumb src={w.thumbnail} className="h-12 w-12 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{w.classTitle}</p>
        <p className="text-xs text-[#6b655c]">
          {offered && w.offerExpiresAt
            ? `Seat held for you · ${countdown(w.offerExpiresAt, now)} left (until ${t.dayTime(w.offerExpiresAt)})`
            : `Number ${w.position ?? '—'} in line${w.startDate ? ` · class starts ${t.date(w.startDate)}` : ''}`}
        </p>
      </div>
      <div className="flex gap-2">
        {offered ? <Link to={`/payment/${w.classId}`} className={btn.accent}>Claim seat</Link> : null}
        <button type="button" className={btn.secondary} disabled={busy} onClick={() => void leave()}>
          {offered ? 'Decline' : 'Leave waitlist'}
        </button>
      </div>
    </li>
  );
}

export default function ClassesTab({ data, onLeave, onReview, onChanged }: {
  data: LearnerData;
  onLeave: (c: LearnerClass) => void;
  onReview: (c: LearnerClass) => void;
  onChanged: () => void;
}) {
  const [filter, setFilter] = useState<Filter>(() =>
    data.classes.some((c) => c.state === 'in_progress' || c.state === 'upcoming') ? 'active' : 'all'
  );
  const groups = useMemo(() => {
    const is = (c: LearnerClass, f: Filter) =>
      f === 'all' ||
      (f === 'active' && (c.state === 'in_progress' || c.state === 'upcoming')) ||
      (f === 'completed' && (c.state === 'completed' || c.state === 'finished')) ||
      (f === 'past' && (c.state === 'left' || c.state === 'cancelled'));
    return {
      list: data.classes.filter((c) => is(c, filter)),
      counts: {
        active: data.classes.filter((c) => is(c, 'active')).length,
        completed: data.classes.filter((c) => is(c, 'completed')).length,
        past: data.classes.filter((c) => is(c, 'past')).length,
        all: data.classes.length,
      },
    };
  }, [data.classes, filter]);

  return (
    <div className="space-y-8">
      {data.waitlist.length ? (
        <div>
          <SectionLabel aside={<span className="inline-flex items-center gap-1 text-xs text-[#8a847a]"><Hourglass className="h-3 w-3" /> Seats are held for 24 hours</span>}>
            Waitlists
          </SectionLabel>
          <ul className="space-y-2">
            {data.waitlist.map((w) => <WaitlistRow key={w.classId} w={w} onChanged={onChanged} />)}
          </ul>
        </div>
      ) : null}

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <FilterChips<Filter>
            label="Filter classes"
            value={filter}
            onChange={setFilter}
            options={[
              { id: 'active', label: 'Active', count: groups.counts.active },
              { id: 'completed', label: 'Completed', count: groups.counts.completed },
              { id: 'past', label: 'Left or cancelled', count: groups.counts.past },
              { id: 'all', label: 'All', count: groups.counts.all },
            ]}
          />
          <Link to="/browse" className={btn.link}><Users className="h-3.5 w-3.5" /> Find another class</Link>
        </div>
        {groups.list.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {groups.list.map((c) => <ClassCard key={c.enrollmentId} c={c} onLeave={onLeave} onReview={onReview} />)}
          </div>
        ) : (
          <EmptyBlock
            text={filter === 'active' ? 'No active classes right now.' : filter === 'completed' ? 'Classes you finish will appear here.' : 'Nothing here.'}
            action={filter === 'active' ? <Link to="/browse" className={btn.secondary}>Browse classes</Link> : undefined}
          />
        )}
      </div>
    </div>
  );
}
