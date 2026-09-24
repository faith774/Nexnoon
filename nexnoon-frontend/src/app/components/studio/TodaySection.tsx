import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  FilePen,
  Hourglass,
  MailPlus,
  Star,
  UserCheck,
  Video,
} from 'lucide-react';
import { classService } from '@/lib/api';
import { getErrorMessage } from '@/lib/api/client';
import { useStudio } from './context';
import { Panel, SectionLabel, StatTile, btn, fmtDate, untilLabel } from './ui';
import { useTimeFormat } from '@/lib/timezone';


type ActionItem = { key: string; icon: ReactNode; title: string; detail: string; cta?: ReactNode; urgent?: boolean };

export default function TodaySection() {
  const t = useTimeFormat();
  const { data, goTo, openClass, refetch, flash } = useStudio();
  const [busy, setBusy] = useState<string | null>(null);
  const { actions, nextSession, performance } = data;
  const now = Date.now();

  const weekEnd = now + 7 * 86_400_000;
  const upcoming = data.sessions.filter((s) => !s.held && new Date(s.endTime).getTime() > now);
  const thisWeek = upcoming.filter((s) => new Date(s.startTime).getTime() < weekEnd);
  const activeLearners = new Set(data.learners.filter((l) => l.status !== 'dropped').map((l) => l.userId)).size;
  const live = nextSession && new Date(nextSession.startTime).getTime() <= now + 15 * 60_000;

  async function respond(classId: string, status: 'accepted' | 'declined') {
    setBusy(classId);
    try {
      await classService.respondToInvite(classId, status);
      flash({ type: 'ok', text: status === 'accepted' ? 'You’re on the teaching team' : 'Invite declined' });
      await refetch();
    } catch (e) {
      flash({ type: 'err', text: getErrorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  const items: ActionItem[] = [];
  for (const inv of data.invites) {
    items.push({
      key: `invite-${inv.classId}`,
      icon: <MailPlus className="h-4 w-4" />,
      title: `Teaching invite: ${inv.title}`,
      detail: `${inv.leadName} invited you as a support instructor${inv.startDate ? ` · starts ${fmtDate(inv.startDate)}` : ''}`,
      urgent: true,
      cta: (
        <div className="flex gap-2">
          <button type="button" disabled={busy === inv.classId} onClick={() => respond(inv.classId, 'accepted')} className={btn.primary}>
            Accept
          </button>
          <button type="button" disabled={busy === inv.classId} onClick={() => respond(inv.classId, 'declined')} className={btn.secondary}>
            Decline
          </button>
        </div>
      ),
    });
  }
  if (actions.attendanceGaps) {
    const first = data.attendanceGaps[0];
    items.push({
      key: 'attendance',
      icon: <UserCheck className="h-4 w-4" />,
      title: `${actions.attendanceGaps} session${actions.attendanceGaps === 1 ? '' : 's'} without attendance`,
      detail: 'No joins were recorded. Mark who was there so learners’ attendance and your score stay accurate.',
      urgent: true,
      cta: (
        <button type="button" onClick={() => openClass(first.classId, 'attendance')} className={btn.secondary}>
          Mark attendance <ArrowRight className="h-3.5 w-3.5" />
        </button>
      ),
    });
  }
  if (actions.ungraded) {
    items.push({
      key: 'grading',
      icon: <ClipboardCheck className="h-4 w-4" />,
      title: `${actions.ungraded} submission${actions.ungraded === 1 ? '' : 's'} to grade`,
      detail: 'Learners are waiting for feedback on their work.',
      urgent: actions.ungraded > 5,
      cta: (
        <button type="button" onClick={() => goTo('grading')} className={btn.secondary}>
          Open grading <ArrowRight className="h-3.5 w-3.5" />
        </button>
      ),
    });
  }
  if (actions.freeRejected) {
    items.push({
      key: 'free-rejected',
      icon: <AlertTriangle className="h-4 w-4" />,
      title: `${actions.freeRejected} free class${actions.freeRejected === 1 ? ' was' : 'es were'} not approved`,
      detail: 'Set a price within the course range, or read the admin’s note and ask again.',
      urgent: true,
      cta: (
        <button type="button" onClick={() => goTo('classes', { status: 'attention' })} className={btn.secondary}>
          Review <ArrowRight className="h-3.5 w-3.5" />
        </button>
      ),
    });
  }
  if (actions.publishedWithoutSessions) {
    items.push({
      key: 'no-sessions',
      icon: <CalendarPlus className="h-4 w-4" />,
      title: `${actions.publishedWithoutSessions} published class${actions.publishedWithoutSessions === 1 ? ' has' : 'es have'} no sessions`,
      detail: 'Learners can’t join until you schedule live sessions.',
      cta: (
        <button type="button" onClick={() => goTo('classes', { status: 'attention' })} className={btn.secondary}>
          Schedule <ArrowRight className="h-3.5 w-3.5" />
        </button>
      ),
    });
  }
  if (actions.certsExpiring || actions.reviewDueSoon || data.me.improvementPlan) {
    items.push({
      key: 'standing',
      icon: <BadgeCheck className="h-4 w-4" />,
      title: data.me.improvementPlan
        ? 'You’re on an improvement plan'
        : actions.certsExpiring
          ? `${actions.certsExpiring} certification${actions.certsExpiring === 1 ? '' : 's'} expiring soon`
          : 'Your quality review is coming up',
      detail: data.me.improvementPlan?.dueAt
        ? `Due ${fmtDate(data.me.improvementPlan.dueAt)}. See what the team asked you to work on.`
        : 'Check your score and certifications before the review.',
      urgent: Boolean(data.me.improvementPlan),
      cta: (
        <button type="button" onClick={() => goTo('performance')} className={btn.secondary}>
          View <ArrowRight className="h-3.5 w-3.5" />
        </button>
      ),
    });
  }
  if (actions.freePending) {
    items.push({
      key: 'free-pending',
      icon: <Hourglass className="h-4 w-4" />,
      title: `${actions.freePending} free class${actions.freePending === 1 ? '' : 'es'} awaiting admin approval`,
      detail: 'Nothing to do. We’ll notify you when an admin decides.',
    });
  }
  if (actions.drafts) {
    items.push({
      key: 'drafts',
      icon: <FilePen className="h-4 w-4" />,
      title: `${actions.drafts} draft${actions.drafts === 1 ? '' : 's'} not published`,
      detail: 'Finish and publish when you’re ready to take enrollments.',
      cta: (
        <button type="button" onClick={() => goTo('classes', { status: 'draft' })} className={btn.secondary}>
          See drafts <ArrowRight className="h-3.5 w-3.5" />
        </button>
      ),
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        {/* Next session */}
        <section className="relative overflow-hidden border border-[#e4dfd6] bg-[#14110e] p-6 text-white md:p-7">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#c45c26]/30 blur-3xl" aria-hidden />
          <p className="relative text-[11px] uppercase tracking-[0.2em] text-white/55">{live ? 'Happening now' : 'Next session'}</p>
          {nextSession ? (
            <div className="relative">
              <h2 className="mt-2 font-serif text-2xl leading-snug md:text-[1.7rem]">{nextSession.classTitle}</h2>
              <p className="mt-1 text-sm text-white/70">
                {nextSession.sessionNumber ? `Session ${nextSession.sessionNumber} · ` : ''}
                {nextSession.title}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span className="inline-flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-[#e89a6c]" />
                  {t.day(nextSession.startTime)} · {t.time(nextSession.startTime)}–{t.time(nextSession.endTime)}
                </span>
                <span className="text-white/60">{live ? 'Open the room now' : `Starts ${untilLabel(nextSession.startTime)}`}</span>
                <span className="text-white/60">{nextSession.expected} learner{nextSession.expected === 1 ? '' : 's'}</span>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link to={`/classroom/${nextSession.classId}`} className="inline-flex items-center gap-1.5 bg-[#c45c26] px-4 py-2 text-sm text-white hover:bg-[#a94d1f]">
                  <Video className="h-4 w-4" /> {live ? 'Start class' : 'Open classroom'}
                </Link>
                <button
                  type="button"
                  onClick={() => openClass(nextSession.classId)}
                  className="inline-flex items-center gap-1.5 border border-white/25 px-4 py-2 text-sm text-white/85 hover:border-white/50 hover:text-white"
                >
                  Class details
                </button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <h2 className="mt-2 font-serif text-2xl">Nothing scheduled yet</h2>
              <p className="mt-1 max-w-md text-sm text-white/70">Add sessions to a class, or create a new cohort for learners to join.</p>
              <div className="mt-6 flex gap-2">
                <Link to="/create-class" className="inline-flex items-center gap-1.5 bg-[#c45c26] px-4 py-2 text-sm text-white hover:bg-[#a94d1f]">
                  Create a class
                </Link>
                <button type="button" onClick={() => goTo('classes')} className="border border-white/25 px-4 py-2 text-sm text-white/85 hover:border-white/50">
                  My classes
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Key numbers */}
        <div className="grid grid-cols-2 gap-3">
          <StatTile
            label="Quality score"
            value={performance.qualityScore}
            hint="Same score the admin team sees"
            tone={performance.qualityScore >= 80 ? 'good' : performance.qualityScore < 60 && performance.heldSessions > 0 ? 'warn' : undefined}
            onClick={() => goTo('performance')}
          />
          <StatTile label="Active learners" value={activeLearners} hint={`${data.classes.filter((c) => c.myRole !== 'invited').length} classes`} onClick={() => goTo('learners')} />
          <StatTile
            label="Attendance"
            value={performance.heldSessions ? `${performance.attendanceRate}%` : '—'}
            hint={performance.heldSessions ? `${performance.heldSessions} sessions held` : 'No sessions held yet'}
          />
          <StatTile
            label="Rating"
            value={performance.reviewsCount ? performance.avgRating.toFixed(1) : '—'}
            hint={performance.reviewsCount ? `${performance.reviewsCount} reviews` : 'No reviews yet'}
            onClick={() => goTo('performance')}
          />
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1.35fr_1fr]">
        <Panel
          title="Needs your attention"
          subtitle={items.length ? `${items.length} item${items.length === 1 ? '' : 's'}` : undefined}
          bodyClassName="divide-y divide-[#eee9e0]"
        >
          {items.length ? (
            items.map((i) => (
              <div key={i.key} className="flex flex-wrap items-center gap-4 px-5 py-4 md:px-6">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center ${i.urgent ? 'bg-[#fbeee6] text-[#c45c26]' : 'bg-[#f1ede6] text-[#6b655c]'}`}
                >
                  {i.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#14110e]">{i.title}</p>
                  <p className="mt-0.5 text-xs text-[#6b655c]">{i.detail}</p>
                </div>
                {i.cta}
              </div>
            ))
          ) : (
            <div className="flex items-center gap-3 px-5 py-8 md:px-6">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <p className="text-sm text-[#6b655c]">You’re all caught up. Nice work.</p>
            </div>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel
            title="This week"
            subtitle={`${thisWeek.length} session${thisWeek.length === 1 ? '' : 's'}`}
            actions={
              <button type="button" onClick={() => goTo('schedule')} className={btn.link}>
                Full schedule
              </button>
            }
            bodyClassName="p-0"
          >
            {thisWeek.length ? (
              <ul className="divide-y divide-[#eee9e0]">
                {thisWeek.slice(0, 6).map((s) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => openClass(s.classId, 'sessions')} className="flex w-full items-center gap-4 px-5 py-3 text-left hover:bg-[#faf8f5]">
                      <div className="w-14 shrink-0 text-center">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-[#8a847a]">
                          {new Date(s.startTime).toLocaleDateString(undefined, { weekday: 'short', timeZone: t.tz })}
                        </p>
                        <p className="font-serif text-xl leading-none text-[#14110e]">{new Date(s.startTime).toLocaleDateString(undefined, { day: 'numeric', timeZone: t.tz })}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-[#14110e]">{s.classTitle}</p>
                        <p className="truncate text-xs text-[#8a847a]">
                          {t.time(s.startTime)} · {s.title}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-[#6b655c]">No sessions in the next 7 days.</p>
            )}
          </Panel>

          <Panel
            title="Latest reviews"
            actions={
              <button type="button" onClick={() => goTo('performance')} className={btn.link}>
                All reviews
              </button>
            }
          >
            {data.reviews.length ? (
              <ul className="space-y-4">
                {data.reviews.slice(0, 3).map((r) => (
                  <li key={r.id}>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-0.5 text-[#c45c26]">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? 'fill-current' : 'opacity-25'}`} />
                        ))}
                      </span>
                      <span className="truncate text-xs text-[#8a847a]">
                        {r.learnerName} · {r.classTitle}
                      </span>
                    </div>
                    {r.comment ? <p className="mt-1 line-clamp-2 text-sm text-[#3d3933]">“{r.comment}”</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <SectionLabel>No reviews yet</SectionLabel>
                <p className="text-sm text-[#6b655c]">Learners can review a class after attending. Reviews feed your quality score.</p>
              </>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
