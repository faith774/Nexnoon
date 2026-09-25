import { Link } from 'react-router';
import { ArrowRight, CalendarDays, Clock, Compass, FileText, Radio, Video } from 'lucide-react';
import { btn, card, EmptyBlock, Pill, SectionLabel } from './ui';
import { useTimeFormat } from '@/lib/timezone';
import { assignmentMeta, classStateMeta, countdown, joinState, Meter, Thumb, useNow } from './shared';
import type { LearnerData, LearnerSession, LearnerTab } from './types';

export function NextUpCard({ session, joinEarlyMinutes }: { session: LearnerSession; joinEarlyMinutes: number }) {
  const t = useTimeFormat();
  const now = useNow(15_000);
  const state = joinState(session, joinEarlyMinutes, now);
  const opensAt = new Date(new Date(session.startTime).getTime() - joinEarlyMinutes * 60_000).toISOString();

  return (
    <section aria-label="Next session" className="relative overflow-hidden rounded-3xl bg-[#14110e] text-white">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#889dd1]/25 blur-3xl" aria-hidden />
      <div className="relative grid gap-0 md:grid-cols-[260px_minmax(0,1fr)]">
        <div className="hidden p-3 pr-0 md:block">
          <Thumb src={session.thumbnail} className="h-full min-h-[180px] w-full rounded-2xl" />
        </div>
        <div className="flex flex-col gap-5 p-5 md:p-7">
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/60">
            {state === 'live' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#c45c26] px-2.5 py-0.5 font-medium text-white">
                <Radio className="h-3 w-3 animate-pulse" /> Live now
              </span>
            ) : (
              <span>Next up · in {countdown(session.startTime, now)}</span>
            )}
            <span className="text-white/30">/</span>
            <span className="truncate">{session.classTitle}</span>
          </div>
          <div>
            <h2 className="font-serif text-2xl leading-tight tracking-tight md:text-3xl">{session.title}</h2>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/70">
              <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{t.day(session.startTime)}</span>
              <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" />{t.time(session.startTime)} – {t.time(session.endTime)}</span>
              <span>with {session.instructor}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {state === 'later' ? (
              <>
                <span className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full bg-white/10 px-5 py-2.5 text-sm text-white/60" aria-disabled>
                  <Video className="h-4 w-4" /> Join opens {t.time(opensAt)}
                </span>
                <Link to={`/classroom/${session.classId}`} className="text-sm text-white/80 underline-offset-4 hover:text-white hover:underline">
                  Prepare in the classroom
                </Link>
              </>
            ) : (
              <Link to={`/waiting-room/${session.classId}`} className="inline-flex items-center gap-1.5 rounded-full bg-[#c45c26] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#a94d1f]">
                <Video className="h-4 w-4" /> {state === 'live' ? 'Join now' : 'Enter waiting room'}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Overview({ data, goTo }: { data: LearnerData; goTo: (tab: LearnerTab) => void }) {
  const t = useTimeFormat();
  const now = useNow(30_000);
  const week = data.upcomingSessions.filter((s) => s.id !== data.nextUp?.id && new Date(s.endTime).getTime() > now).slice(0, 4);
  const todo = data.assignments.filter((a) => a.status === 'due' || a.status === 'overdue').slice(0, 4);
  const enrolled = data.classes.filter((c) => c.state === 'in_progress' || c.state === 'upcoming');
  const shown = (enrolled.length ? enrolled : data.classes.filter((c) => c.state !== 'left')).slice(0, 6);

  if (!data.classes.length && !data.waitlist.length) {
    return (
      <section className={`${card} p-8 text-center md:p-12`}>
        <Compass className="mx-auto h-10 w-10 text-[#c45c26]" />
        <h2 className="mt-4 font-serif text-2xl tracking-tight">Find your first live class</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-[#6b655c]">
          Small groups, real instructors, sessions scheduled in your time zone. Once you enroll, everything you need shows up here.
        </p>
        <Link to="/browse" className={`${btn.accent} mt-6`}>Browse classes <ArrowRight className="h-4 w-4" /></Link>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <SectionLabel aside={<button type="button" className={btn.link} onClick={() => goTo('classes')}>All classes <ArrowRight className="h-3.5 w-3.5" /></button>}>
          Your classes
        </SectionLabel>
        {shown.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {shown.map((c) => {
              const meta = classStateMeta[c.state];
              return (
                <article key={c.enrollmentId} className={`${card} flex flex-col`}>
                  <Link to={`/classroom/${c.id}`} className="group relative block overflow-hidden">
                    <Thumb src={c.thumbnail} alt="" className="aspect-[16/8] w-full transition-transform duration-500 group-hover:scale-[1.03]" />
                    <span className="absolute left-3 top-3"><Pill tone={meta.tone} className="bg-white/95">{meta.label}</Pill></span>
                  </Link>
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div className="min-w-0">
                      <Link to={`/classroom/${c.id}`} className="block truncate font-serif text-lg leading-snug tracking-tight">{c.title}</Link>
                      <p className="mt-0.5 truncate text-xs text-[#6b655c]">with {c.instructor.name}</p>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-[#6b655c]">
                        <span>{c.held ? `${c.attended}/${c.held} sessions` : c.firstSessionAt ? `Starts ${t.date(c.firstSessionAt)}` : 'Schedule coming soon'}</span>
                        <span className="tabular-nums">{c.progress}%</span>
                      </div>
                      <Meter value={c.progress} label={`${c.title} progress`} />
                    </div>
                    {c.nextSession ? (
                      <p className="flex items-center gap-1.5 text-xs text-[#6b655c]">
                        <CalendarDays className="h-3.5 w-3.5 text-[#b5aea3]" />
                        Next · {t.dayTime(c.nextSession.startTime)}
                      </p>
                    ) : null}
                    <div className="mt-auto flex flex-wrap gap-2 pt-1">
                      <Link to={`/classroom/${c.id}`} className={btn.primary}>Open classroom</Link>
                      {c.assignments.open > 0 ? (
                        <Link to={`/assignments/${c.id}`} className={btn.secondary}><FileText className="h-3.5 w-3.5" /> {c.assignments.open} to do</Link>
                      ) : (
                        <Link to={`/materials/${c.id}`} className={btn.secondary}><FileText className="h-3.5 w-3.5" /> Materials</Link>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyBlock text="No active classes right now." action={<Link to="/browse" className={btn.secondary}>Browse classes</Link>} />
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <SectionLabel aside={<button type="button" className={btn.link} onClick={() => goTo('schedule')}>Full schedule <ArrowRight className="h-3.5 w-3.5" /></button>}>
            Coming up
          </SectionLabel>
          {week.length ? (
            <ul className={`${card} divide-y divide-[#eee9e0]`}>
              {week.map((s) => (
                <li key={s.id} className="flex items-center gap-4 px-4 py-3.5">
                  <div className="w-20 shrink-0">
                    <p className="whitespace-nowrap text-[10px] uppercase tracking-[0.12em] text-[#8a847a]">{t.day(s.startTime)}</p>
                    <p className="font-serif text-lg leading-tight tabular-nums">{t.time(s.startTime)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.title}</p>
                    <p className="truncate text-xs text-[#8a847a]">{s.classTitle}</p>
                  </div>
                  {joinState(s, data.policy.joinEarlyMinutes, now) === 'later' ? (
                    <Link to={`/classroom/${s.classId}`} className="shrink-0 text-xs text-[#6b655c] hover:text-[#14110e]">Open</Link>
                  ) : (
                    <Link to={`/waiting-room/${s.classId}`} className={`${btn.accent} shrink-0 px-3 py-1.5 text-xs`}><Video className="h-3.5 w-3.5" /> Join</Link>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyBlock text={data.nextUp ? 'Nothing else scheduled after your next session yet.' : 'No upcoming sessions. New sessions appear here as soon as instructors schedule them.'} />
          )}
        </div>

        <aside className="space-y-6">
        <div>
          <SectionLabel aside={data.assignments.length ? <button type="button" className={btn.link} onClick={() => goTo('assignments')}>All</button> : null}>
            To do
          </SectionLabel>
          {todo.length ? (
            <ul className="space-y-2">
              {todo.map((a) => (
                <li key={`${a.classId}-${a.id}`}>
                  <Link to={`/assignments/${a.classId}`} className="block rounded-2xl border border-[#ebe6de] bg-white p-4 transition-colors hover:border-[#14110e]/30">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{a.title}</p>
                      <Pill tone={assignmentMeta[a.status].tone}>{assignmentMeta[a.status].label}</Pill>
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-[#8a847a]">
                      <FileText className="h-3 w-3" />
                      {a.classTitle}{a.dueDate ? ` · due ${t.dayTime(a.dueDate)}` : ''}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyBlock text="You're all caught up." />
          )}
        </div>

        {data.certificates.length ? (
          <div>
            <SectionLabel>Latest certificate</SectionLabel>
            <Link to={`/certificates/${data.certificates[0].certificateId}`} className="block rounded-2xl border border-[#f0d3c1] bg-gradient-to-br from-[#fbeee6] to-white p-5 transition-colors hover:border-[#c45c26]">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#9a4518]">Certificate of completion</p>
              <p className="mt-1 font-serif text-lg leading-snug">{data.certificates[0].classTitle}</p>
              <p className="mt-2 text-xs text-[#6b655c]">View, download or share <ArrowRight className="inline h-3 w-3" /></p>
            </Link>
          </div>
        ) : null}
        </aside>
      </div>
    </div>
  );
}
