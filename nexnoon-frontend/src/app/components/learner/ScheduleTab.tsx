import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CalendarPlus, Play, Radio, Video } from 'lucide-react';
import { btn, EmptyBlock, Pill, SegmentedTabs } from '../studio/ui';
import { useTimeFormat } from '@/lib/timezone';
import { attendanceMeta, downloadCalendar, joinState, useNow } from './shared';
import type { LearnerData } from './types';

export default function ScheduleTab({ data }: { data: LearnerData }) {
  const t = useTimeFormat();
  const now = useNow(30_000);
  const [view, setView] = useState<'upcoming' | 'past'>('upcoming');

  const days = useMemo(() => {
    const map = new Map<string, typeof data.upcomingSessions>();
    for (const s of data.upcomingSessions) {
      const key = t.dayKey(s.startTime);
      map.set(key, [...(map.get(key) || []), s]);
    }
    return [...map.entries()];
  }, [data.upcomingSessions, t]);

  const todayKey = t.dayKey(new Date(now).toISOString());
  const tomorrowKey = t.dayKey(new Date(now + 86_400_000).toISOString());

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SegmentedTabs
          value={view}
          onChange={setView}
          tabs={[
            { id: 'upcoming', label: 'Upcoming', count: data.upcomingSessions.length },
            { id: 'past', label: 'Past sessions', count: data.pastSessions.length },
          ]}
        />
        {view === 'upcoming' && data.upcomingSessions.length ? (
          <button type="button" className={btn.secondary} onClick={() => downloadCalendar(data.upcomingSessions)}>
            <CalendarPlus className="h-4 w-4" /> Add to calendar
          </button>
        ) : null}
      </div>

      {view === 'upcoming' ? (
        days.length ? (
          <div className="space-y-6">
            {days.map(([key, list]) => (
              <section key={key}>
                <h3 className="mb-2 flex items-baseline gap-2">
                  <span className="font-serif text-lg tracking-tight">
                    {key === todayKey ? 'Today' : key === tomorrowKey ? 'Tomorrow' : t.weekday(list[0].startTime)}
                  </span>
                  {key === todayKey || key === tomorrowKey ? <span className="text-xs text-[#8a847a]">{t.day(list[0].startTime)}</span> : null}
                </h3>
                <ul className="divide-y divide-[#eee9e0] border border-[#e4dfd6] bg-white">
                  {list.map((s) => {
                    const state = joinState(s, data.policy.joinEarlyMinutes, now);
                    return (
                      <li key={s.id} className="flex flex-wrap items-center gap-4 px-4 py-3.5">
                        <div className="w-16 shrink-0 sm:w-24">
                          <p className="text-sm font-medium tabular-nums">{t.time(s.startTime)}</p>
                          <p className="text-xs text-[#8a847a] tabular-nums">to {t.time(s.endTime)}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {s.sessionNumber ? <span className="mr-1.5 text-[#8a847a]">#{s.sessionNumber}</span> : null}
                            {s.title}
                          </p>
                          <p className="truncate text-xs text-[#8a847a]">{s.classTitle} · {s.instructor}</p>
                        </div>
                        {state === 'later' ? (
                          <Link to={`/classroom/${s.classId}`} className={btn.secondary}>Classroom</Link>
                        ) : (
                          <Link to={`/waiting-room/${s.classId}`} className={btn.accent}>
                            {state === 'live' ? <Radio className="h-3.5 w-3.5 animate-pulse" /> : <Video className="h-3.5 w-3.5" />}
                            {state === 'live' ? 'Join now' : 'Join'}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            <p className="text-xs text-[#8a847a]">Times are shown in your time zone. You can join {data.policy.joinEarlyMinutes} minutes before each session starts.</p>
          </div>
        ) : (
          <EmptyBlock text="No upcoming sessions. When instructors schedule sessions they'll appear here, and we'll remind you by email." />
        )
      ) : data.pastSessions.length ? (
        <ul className="divide-y divide-[#eee9e0] border border-[#e4dfd6] bg-white">
          {data.pastSessions.map((s) => {
            const meta = attendanceMeta[s.attendance];
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-4 px-4 py-3.5">
                <div className="w-28 shrink-0 text-xs text-[#6b655c]">
                  <p className="text-sm text-[#14110e]">{t.date(s.startTime)}</p>
                  {t.time(s.startTime)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.title}</p>
                  <p className="truncate text-xs text-[#8a847a]">{s.classTitle}</p>
                </div>
                <Pill tone={meta.tone}>{meta.label}</Pill>
                {s.hasRecording ? (
                  <Link to={`/recorded-class/${s.classId}?sessionId=${s.id}`} className={btn.link}>
                    <Play className="h-3.5 w-3.5" /> Recording
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyBlock text="Sessions you've had will appear here with your attendance." />
      )}
    </div>
  );
}
