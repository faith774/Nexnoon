import { useEffect, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import type { AssignmentState, AttendanceMark, ClassState, LearnerSession } from './types';
import type { Tone } from '../studio/ui';

export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function joinState(session: Pick<LearnerSession, 'startTime' | 'endTime' | 'status'>, joinEarlyMinutes: number, now: number) {
  const start = new Date(session.startTime).getTime();
  const end = new Date(session.endTime).getTime();
  if (session.status === 'live' || (now >= start && now < end)) return 'live' as const;
  if (now >= start - joinEarlyMinutes * 60_000 && now < end) return 'open' as const;
  return 'later' as const;
}

export function countdown(targetIso: string, now: number) {
  const ms = new Date(targetIso).getTime() - now;
  if (ms <= 0) return 'now';
  const mins = Math.floor(ms / 60_000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const rest = mins % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${rest}m`;
  return `${Math.max(1, rest)} min`;
}

export const classStateMeta: Record<ClassState, { label: string; tone: Tone }> = {
  upcoming: { label: 'Starting soon', tone: 'amber' },
  in_progress: { label: 'In progress', tone: 'clay' },
  finished: { label: 'Finished', tone: 'stone' },
  completed: { label: 'Completed', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'rose' },
  left: { label: 'Left', tone: 'stone' },
};

export const attendanceMeta: Record<AttendanceMark, { label: string; tone: Tone }> = {
  present: { label: 'Attended', tone: 'green' },
  late: { label: 'Joined late', tone: 'amber' },
  absent: { label: 'Absent', tone: 'rose' },
  excused: { label: 'Excused', tone: 'stone' },
  missed: { label: 'Missed', tone: 'rose' },
};

export const assignmentMeta: Record<AssignmentState, { label: string; tone: Tone }> = {
  due: { label: 'To do', tone: 'amber' },
  overdue: { label: 'Overdue', tone: 'rose' },
  submitted: { label: 'Awaiting grade', tone: 'stone' },
  graded: { label: 'Graded', tone: 'green' },
};

export function Thumb({ src, alt = '', className = '' }: { src?: string; alt?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-[#fbeee6] via-[#f6f4f0] to-[#efe9df] text-[#c45c26]/60 ${className}`} aria-hidden>
        <GraduationCap className="h-1/3 w-1/3 max-h-10 max-w-10" />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`object-cover ${className}`} />;
}

export function Meter({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value || 0)));
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} className="h-1.5 overflow-hidden bg-[#eee9e0]">
      <div className={`h-full transition-[width] duration-700 ${v >= 100 ? 'bg-emerald-500' : 'bg-[#c45c26]'}`} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-[#ebe6de] ${className}`} />;
}

const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (v: string) => v.replace(/\\/g, '\\\\').replace(/[,;]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');

export function downloadCalendar(sessions: Pick<LearnerSession, 'id' | 'title' | 'classTitle' | 'classId' | 'startTime' | 'endTime'>[]) {
  const origin = window.location.origin;
  const stamp = icsDate(new Date().toISOString());
  const events = sessions.map((s) =>
    [
      'BEGIN:VEVENT',
      `UID:${s.id}@nexnoon`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(s.startTime)}`,
      `DTEND:${icsDate(s.endTime)}`,
      `SUMMARY:${icsText(`${s.title} · ${s.classTitle}`)}`,
      `DESCRIPTION:${icsText(`Join from your Nexnoon dashboard: ${origin}/waiting-room/${s.classId}`)}`,
      `URL:${origin}/waiting-room/${s.classId}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Live class starts in 15 minutes',
      'END:VALARM',
      'END:VEVENT',
    ].join('\r\n')
  );
  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Nexnoon//Live classes//EN', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join('\r\n');
  const url = URL.createObjectURL(new Blob([body], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'nexnoon-sessions.ics';
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
