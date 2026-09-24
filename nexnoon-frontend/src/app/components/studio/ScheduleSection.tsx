import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { UserCheck, Video } from 'lucide-react';
import { useStudio } from './context';
import type { StudioSession } from './types';
import { EmptyBlock, FilterChips, Pill, btn, matches } from './ui';
import { ViewerTimeZoneSwitcher } from '../TimeZonePicker';
import { formatInZone, tzLabel, useTimeFormat } from '@/lib/timezone';

type View = 'upcoming' | 'past' | 'attendance';

export default function ScheduleSection() {
  const { data, search, openClass } = useStudio();
  const [params] = useSearchParams();
  const [view, setView] = useState<View>(params.get('view') === 'attendance' ? 'attendance' : 'upcoming');
  const now = Date.now();
  const t = useTimeFormat();
  const todayKey = t.dayKey(new Date(now).toISOString());
  const relative: Record<string, string> = {
    [todayKey]: 'Today',
    [t.dayKey(new Date(now + 86_400_000).toISOString())]: 'Tomorrow',
    [t.dayKey(new Date(now - 86_400_000).toISOString())]: 'Yesterday',
  };
  const dayHeading = (iso: string) => {
    const label = t.weekday(iso);
    const rel = relative[t.dayKey(iso)];
    return rel ? `${rel} · ${label}` : label;
  };

  const upcoming = data.sessions.filter((s) => !s.held);
  const past = data.sessions.filter((s) => s.held).reverse();
  const source = view === 'upcoming' ? upcoming : view === 'past' ? past : data.attendanceGaps;
  const rows = source.filter((s) => matches(search, s.classTitle, s.title));

  const groups: { key: string; heading: string; items: StudioSession[] }[] = [];
  for (const s of rows) {
    const k = t.dayKey(s.startTime);
    const last = groups[groups.length - 1];
    if (last?.key === k) last.items.push(s);
    else groups.push({ key: k, heading: dayHeading(s.startTime), items: [s] });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips
          label="Schedule view"
          value={view}
          onChange={setView}
          options={[
            { id: 'upcoming', label: 'Upcoming', count: upcoming.length },
            { id: 'past', label: 'Past 90 days', count: past.length },
            { id: 'attendance', label: 'Needs attendance', count: data.attendanceGaps.length },
          ]}
        />
        <ViewerTimeZoneSwitcher />
      </div>

      {groups.length ? (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.key}>
              <p className={`mb-2 text-[11px] font-medium uppercase tracking-[0.16em] ${g.key === todayKey ? 'text-[#c45c26]' : 'text-[#8a847a]'}`}>
                {g.heading}
              </p>
              <ul className="divide-y divide-[#eee9e0] border border-[#e4dfd6] bg-white">
                {g.items.map((s) => {
                  const soon = !s.held && new Date(s.startTime).getTime() - now < 15 * 60_000;
                  return (
                    <li key={s.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                      <div className="w-28 shrink-0 tabular-nums">
                        <p className="text-sm text-[#14110e]">{t.time(s.startTime)}</p>
                        <p className="text-xs text-[#8a847a]">until {t.time(s.endTime)}</p>
                      </div>
                      <button type="button" onClick={() => openClass(s.classId, 'sessions')} className="min-w-0 flex-1 text-left">
                        <p className="truncate text-sm font-medium text-[#14110e] hover:underline">{s.classTitle}</p>
                        <p className="truncate text-xs text-[#6b655c]">
                          {s.sessionNumber ? `Session ${s.sessionNumber} · ` : ''}
                          {s.title}
                        </p>
                        {s.classTimeZone && s.classTimeZone !== t.tz ? (
                          <p className="truncate text-[11px] text-[#8a847a]">
                            Class time {formatInZone(s.startTime, s.classTimeZone, 'dayTime')} · {tzLabel(s.classTimeZone, s.startTime)}
                          </p>
                        ) : null}
                      </button>
                      <span className="text-xs text-[#8a847a]">
                        {s.held ? `${s.attended ?? 0}/${s.expected} attended` : `${s.expected} learner${s.expected === 1 ? '' : 's'}`}
                      </span>
                      {s.status === 'live' ? <Pill tone="clay">Live</Pill> : null}
                      {s.needsAttendance ? (
                        <button type="button" onClick={() => openClass(s.classId, 'attendance')} className={`${btn.secondary} py-1.5 text-xs`}>
                          <UserCheck className="h-3.5 w-3.5" /> Mark attendance
                        </button>
                      ) : !s.held ? (
                        <Link to={`/classroom/${s.classId}`} className={`${soon ? btn.accent : btn.secondary} py-1.5 text-xs`}>
                          <Video className="h-3.5 w-3.5" /> {soon ? 'Start' : 'Classroom'}
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <EmptyBlock
          text={
            search
              ? 'No sessions match your search.'
              : view === 'upcoming'
                ? 'No upcoming sessions. Add sessions from a class’s edit page.'
                : view === 'past'
                  ? 'No sessions in the last 90 days.'
                  : 'Every held session has attendance recorded.'
          }
        />
      )}
    </div>
  );
}
