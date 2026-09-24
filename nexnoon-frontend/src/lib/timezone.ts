import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import apiClient from '@/lib/api/client';

export const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const FALLBACK_ZONES = [
  'UTC', 'Africa/Lagos', 'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Nairobi', 'Europe/London', 'Europe/Madrid',
  'Europe/Paris', 'Europe/Berlin', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Sao_Paulo',
];

export function allTimeZones(): string[] {
  const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  const zones = supported ? supported('timeZone') : FALLBACK_ZONES;
  return zones.includes('UTC') ? zones : ['UTC', ...zones];
}

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Milliseconds `tz` is ahead of UTC at `date`. */
export function tzOffsetMs(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return wall - Math.floor(date.getTime() / 1000) * 1000;
}

/** Interprets a `YYYY-MM-DDTHH:mm` value as wall-clock time in `tz`. */
export function zonedInputToIso(value: string, tz: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let ts = wall - tzOffsetMs(new Date(wall), tz);
  ts = wall - tzOffsetMs(new Date(ts), tz);
  return new Date(ts).toISOString();
}

export function isoToZonedInput(iso: string, tz: string) {
  const d = new Date(iso);
  return new Date(d.getTime() + tzOffsetMs(d, tz)).toISOString().slice(0, 16);
}

/** Separate date / time strings for <input type="date|time"> in `tz`. */
export function splitInZone(iso: string, tz: string) {
  const v = isoToZonedInput(iso, tz);
  return { date: v.slice(0, 10), time: v.slice(11, 16) };
}

/** "GMT+1", "EST", … for `tz` at `date`. */
export function tzAbbrev(tz: string, date: Date | string = new Date()) {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
    .formatToParts(new Date(date))
    .find((p) => p.type === 'timeZoneName');
  return part?.value || tz;
}

/** "Lagos (GMT+1)". */
export function tzLabel(tz: string, date: Date | string = new Date()) {
  const city = tz === 'UTC' ? 'UTC' : tz.split('/').pop()!.replace(/_/g, ' ');
  return tz === 'UTC' ? 'UTC' : `${city} (${tzAbbrev(tz, date)})`;
}

type Kind = 'datetime' | 'date' | 'time' | 'day' | 'dayTime' | 'weekday';

const KIND_OPTS: Record<Kind, Intl.DateTimeFormatOptions> = {
  datetime: { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' },
  date: { day: 'numeric', month: 'short', year: 'numeric' },
  time: { hour: 'numeric', minute: '2-digit' },
  day: { weekday: 'short', day: 'numeric', month: 'short' },
  dayTime: { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' },
  weekday: { weekday: 'long', day: 'numeric', month: 'long' },
};

export function formatInZone(iso: string | Date | null | undefined, tz: string, kind: Kind = 'datetime', withZone = false) {
  if (!iso) return '—';
  const opts = { ...KIND_OPTS[kind], timeZone: isValidTimeZone(tz) ? tz : 'UTC', ...(withZone ? { timeZoneName: 'short' as const } : {}) };
  return new Date(iso).toLocaleString(undefined, opts);
}

/** Calendar-day key in `tz`, for grouping sessions by the viewer's local day. */
export const dayKeyInZone = (iso: string, tz: string) => isoToZonedInput(iso, tz).slice(0, 10);

/* ------------------------------------------------------------------ */
/* Viewer preference                                                   */
/* ------------------------------------------------------------------ */

const KEY = 'nexnoon.timezone';
const EVENT = 'nexnoon:timezone';

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}
const readOverride = () => localStorage.getItem(KEY);

/** Same choice as useViewerTimeZone, for formatters outside components (re-render comes from a component using the hook). */
export function getViewerTimeZone(): string {
  let profileTz: string | undefined;
  try {
    profileTz = JSON.parse(localStorage.getItem('user') || 'null')?.timezone;
  } catch {
    profileTz = undefined;
  }
  return [readOverride(), profileTz, browserTimeZone()].find(isValidTimeZone) || 'UTC';
}

/** Make `tz` the zone times are shown in on this device, without another profile save. */
export function rememberViewerTimeZone(tz: string) {
  if (!isValidTimeZone(tz)) return;
  localStorage.setItem(KEY, tz);
  window.dispatchEvent(new Event(EVENT));
}

/**
 * The zone this viewer wants times shown in: their explicit choice, else their profile zone, else the device zone.
 * Changing it saves to the profile in the background so emails use it too.
 */
export function useViewerTimeZone(): [string, (tz: string) => void] {
  const { user } = useAuth();
  const override = useSyncExternalStore(subscribe, readOverride, () => null);
  const tz = [override, user?.timezone, browserTimeZone()].find(isValidTimeZone) || 'UTC';

  const setTz = useCallback(
    (next: string) => {
      if (!isValidTimeZone(next)) return;
      localStorage.setItem(KEY, next);
      window.dispatchEvent(new Event(EVENT));
      if (!user) return;
      try {
        const cached = JSON.parse(localStorage.getItem('user') || 'null');
        if (cached) localStorage.setItem('user', JSON.stringify({ ...cached, timezone: next }));
      } catch {
        /* cache is best-effort */
      }
      apiClient.patch('/auth/profile', { timezone: next }).catch(() => {});
    },
    [user]
  );

  return [tz, setTz];
}

/** Formatters bound to the viewer's zone, so every time on screen agrees with the "Times in …" label. */
export function useTimeFormat() {
  const [tz, setTz] = useViewerTimeZone();
  return useMemo(
    () => ({
      tz,
      setTz,
      time: (iso?: string | Date | null) => formatInZone(iso, tz, 'time'),
      day: (iso?: string | Date | null) => formatInZone(iso, tz, 'day'),
      date: (iso?: string | Date | null) => formatInZone(iso, tz, 'date'),
      dateTime: (iso?: string | Date | null) => formatInZone(iso, tz, 'datetime'),
      dayTime: (iso?: string | Date | null) => formatInZone(iso, tz, 'dayTime'),
      weekday: (iso?: string | Date | null) => formatInZone(iso, tz, 'weekday'),
      dayKey: (iso: string) => dayKeyInZone(iso, tz),
    }),
    [tz, setTz]
  );
}
