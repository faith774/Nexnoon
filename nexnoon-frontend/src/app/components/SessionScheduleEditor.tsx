import { useEffect, useState } from 'react';
import { Plus, Trash2, Video } from 'lucide-react';
import type { ClassSchedule } from '@/types/api';
import { getErrorMessage } from '@/lib/api';
import { useAddSession, useDeleteSession, useEnsureZoomMeeting, useUpdateSession } from '@/hooks/api/useClasses';
import { browserTimeZone, formatInZone, splitInZone, tzLabel, useViewerTimeZone, zonedInputToIso } from '@/lib/timezone';

export const sessionFieldLabel = 'block text-xs uppercase tracking-[0.14em] text-[#6b655c] mb-1.5';
export const sessionFieldControl =
  'w-full border border-[#e4dfd6] bg-white px-3 py-2.5 text-sm text-[#14110e] outline-none focus:border-[#14110e] disabled:opacity-60 disabled:bg-[#faf8f5]';

const sessionStatusBadge: Record<ClassSchedule['status'], string> = {
  live: 'bg-red-50 text-red-800 border-red-200',
  scheduled: 'bg-sky-50 text-sky-800 border-sky-200',
  completed: 'bg-[#f0ebe3] text-[#5c5348] border-[#e4dfd6]',
  cancelled: 'bg-gray-100 text-gray-400 border-gray-200',
};

/** Splits an ISO timestamp into date/time strings for <input> fields, as wall-clock time in `tz`. */
export function splitDateTime(iso: string, tz: string = browserTimeZone()): { date: string; time: string } {
  return splitInZone(iso, tz);
}

/** Date + time inputs typed in `tz` → Date, or null when invalid. */
function toInstant(date: string, time: string, tz: string) {
  const iso = zonedInputToIso(`${date}T${time}`, tz);
  return iso ? new Date(iso) : null;
}

/** Shows the viewer's own time when they're in a different zone from the class. */
export function LocalTimeHint({ date, time, timeZone }: { date: string; time: string; timeZone: string }) {
  const [viewerTz] = useViewerTimeZone();
  if (!date || !time || viewerTz === timeZone) return null;
  const at = toInstant(date, time, timeZone);
  if (!at) return null;
  return (
    <p className="text-[11px] text-[#8a847a]">
      That’s {formatInZone(at, viewerTz, 'dayTime')} for you ({tzLabel(viewerTz, at)}).
    </p>
  );
}

function zoomBadge(session: ClassSchedule) {
  if (session.meetingUrl) {
    return { label: 'Own link', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
  }
  if (session.hasZoomMeeting || session.meetingCreationStatus === 'ready') {
    return { label: 'Zoom ready', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
  }
  if (session.meetingCreationStatus === 'failed') {
    return { label: 'Zoom failed', className: 'bg-red-50 text-red-800 border-red-200' };
  }
  if (session.meetingCreationStatus === 'creating' || session.meetingCreationStatus === 'pending') {
    return { label: 'Zoom pending', className: 'bg-amber-50 text-amber-900 border-amber-200' };
  }
  return { label: 'No Zoom yet', className: 'bg-[#f0ebe3] text-[#6b655c] border-[#e4dfd6]' };
}

/** One session row: edit title, date, time, duration; delete scheduled sessions. */
export function SessionScheduleRow({
  classId,
  session,
  modules,
  timeZone = browserTimeZone(),
}: {
  classId: string;
  session: ClassSchedule;
  /** Class time zone: date/time inputs are read and shown in this zone. */
  timeZone?: string;
  /** When provided, allow reassigning this session to another module (or none). */
  modules?: { id: string; title: string }[];
}) {
  const updateSession = useUpdateSession(classId);
  const deleteSession = useDeleteSession(classId);
  const ensureZoom = useEnsureZoomMeeting(classId);
  const [meetingUrl, setMeetingUrl] = useState(session.meetingUrl || '');
  const [recordingUrl, setRecordingUrl] = useState(session.recordingUrl || '');
  const baseline = splitDateTime(session.startTime, timeZone);
  const baselineDuration = Math.max(
    30,
    Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60000)
  );
  const [title, setTitle] = useState(session.title);
  const [date, setDate] = useState(baseline.date);
  const [time, setTime] = useState(baseline.time);
  const [duration, setDuration] = useState(String(baselineDuration));
  const [moduleId, setModuleId] = useState(session.moduleId || '');
  const [status, setStatus] = useState<ClassSchedule['status']>(session.status);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = splitDateTime(session.startTime, timeZone);
    setTitle(session.title);
    setDate(next.date);
    setTime(next.time);
    setDuration(
      String(
        Math.max(
          30,
          Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60000)
        )
      )
    );
    setModuleId(session.moduleId || '');
    setStatus(session.status);
  }, [session.id, session.title, session.startTime, session.endTime, session.moduleId, session.status, timeZone]);

  useEffect(() => {
    setMeetingUrl(session.meetingUrl || '');
    setRecordingUrl(session.recordingUrl || '');
  }, [session.id, session.meetingUrl, session.recordingUrl]);

  const editable = true;
  const changed =
    title.trim() !== session.title ||
    date !== baseline.date ||
    time !== baseline.time ||
    Number(duration) !== baselineDuration ||
    status !== session.status ||
    meetingUrl.trim() !== (session.meetingUrl || '') ||
    recordingUrl.trim() !== (session.recordingUrl || '') ||
    (modules ? moduleId !== (session.moduleId || '') : false);
  const canCreateZoom =
    !session.meetingUrl && !session.hasZoomMeeting && session.status === 'scheduled' && new Date(session.endTime).getTime() > Date.now();
  const zoom = zoomBadge(session);

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    const newStart = toInstant(date, time, timeZone);
    if (!newStart) {
      setError('Enter a valid date and time');
      return;
    }
    const mins = Number(duration) || 60;
    const newEnd = new Date(newStart.getTime() + mins * 60_000);
    const now = Date.now();
    if (status === 'completed' && now < newStart.getTime()) {
      setError('Cannot mark complete before the session start date and time.');
      return;
    }
    if (status === 'cancelled' && session.status !== 'scheduled' && session.status !== 'cancelled') {
      setError('Only scheduled sessions can be cancelled.');
      return;
    }
    if (session.status === 'completed' && status === 'cancelled') {
      setError('Completed sessions cannot be cancelled. Set a future date/time to reschedule.');
      return;
    }
    setError(null);
    try {
      await updateSession.mutateAsync({
        sessionId: session.id,
        data: {
          title: title.trim(),
          startTime: newStart.toISOString(),
          endTime: newEnd.toISOString(),
          status,
          meetingUrl: meetingUrl.trim(),
          recordingUrl: recordingUrl.trim(),
          ...(modules ? { moduleId: moduleId || '' } : {}),
        },
      });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Remove “${session.title}”? Learners will no longer see this session.`)) return;
    setError(null);
    try {
      await deleteSession.mutateAsync(session.id);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="border border-[#e4dfd6] bg-white p-3.5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-[#8a847a]">Live session #{session.sessionNumber}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 border capitalize ${sessionStatusBadge[session.status]}`}>
            {session.status === 'live' ? 'In progress' : session.status}
          </span>
          <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 border inline-flex items-center gap-1 ${zoom.className}`}>
            <Video className="h-3 w-3" />
            {zoom.label}
          </span>
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={sessionFieldLabel}>Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={!editable}
          className={sessionFieldControl}
        />
      </label>

      <div className="grid sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-[#8a847a]">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={!editable}
            aria-label={`${session.title} date`}
            className={sessionFieldControl}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-[#8a847a]">Start time ({tzLabel(timeZone)})</span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            disabled={!editable}
            aria-label={`${session.title} time`}
            className={sessionFieldControl}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-[#8a847a]">Duration</span>
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            disabled={!editable}
            className={sessionFieldControl}
          >
            <option value="30">30 minutes</option>
            <option value="60">1 hour</option>
            <option value="90">1.5 hours</option>
            <option value="120">2 hours</option>
            <option value="180">3 hours</option>
          </select>
        </label>
      </div>

      <LocalTimeHint date={date} time={time} timeZone={timeZone} />

      {modules && modules.length > 0 && (
        <label className="flex flex-col gap-1.5">
          <span className={sessionFieldLabel}>Module</span>
          <select
            value={moduleId}
            onChange={(e) => setModuleId(e.target.value)}
            disabled={!editable}
            className={sessionFieldControl}
          >
            <option value="">Unassigned</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title.trim() || 'Untitled module'}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1.5">
        <span className={sessionFieldLabel}>Status</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ClassSchedule['status'])}
          className={sessionFieldControl}
          aria-label={`${session.title} status`}
        >
          <option value="scheduled">Scheduled</option>
          <option value="live">In progress</option>
          <option
            value="completed"
            disabled={
              status !== 'completed' &&
              (toInstant(date, time, timeZone)?.getTime() ?? 0) > Date.now()
            }
          >
            Completed
          </option>
          <option
            value="cancelled"
            disabled={session.status !== 'scheduled' && status !== 'cancelled'}
          >
            Cancelled
          </option>
        </select>
        <p className="text-[11px] text-[#8a847a]">
          Complete only after start time. Cancel only while scheduled. Reschedule completed sessions with a
          future date/time.
        </p>
      </label>

      <details className="group border-t border-[#eee9e0] pt-2" open={!!session.meetingUrl || !!session.recordingUrl || undefined}>
        <summary className="cursor-pointer text-xs text-[#6b655c] hover:text-[#14110e]">Meeting room &amp; recording</summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-[#8a847a]">Use my own meeting link</span>
            <input
              type="url"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://meet.google.com/…"
              className={sessionFieldControl}
            />
            <span className="text-[11px] text-[#8a847a]">Optional. Replaces the Nexnoon Zoom room; learners only get it when joining.</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-[#8a847a]">Recording link</span>
            <input
              type="url"
              value={recordingUrl}
              onChange={(e) => setRecordingUrl(e.target.value)}
              placeholder="https://…"
              className={sessionFieldControl}
            />
            <span className="text-[11px] text-[#8a847a]">Filled in automatically for Zoom cloud recordings.</span>
          </label>
        </div>
      </details>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!changed || updateSession.isPending}
          className="bg-[#14110e] text-white px-3.5 py-2 text-sm hover:bg-black/80 disabled:opacity-50"
        >
          {updateSession.isPending ? 'Saving…' : 'Save changes'}
        </button>
        {canCreateZoom && (
          <button
            type="button"
            onClick={() => ensureZoom.mutate(session.id)}
            disabled={ensureZoom.isPending}
            className="border border-[#e4dfd6] px-3.5 py-2 text-sm hover:bg-[#faf8f5] disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <Video className="h-3.5 w-3.5" />
            {ensureZoom.isPending ? 'Creating…' : session.meetingCreationStatus === 'failed' ? 'Retry Zoom meeting' : 'Create Zoom meeting'}
          </button>
        )}
        {session.status === 'scheduled' && (
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleteSession.isPending}
            className="border border-red-200 text-red-700 px-3.5 py-2 text-sm hover:bg-red-50 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {deleteSession.isPending ? 'Removing…' : 'Remove'}
          </button>
        )}
      </div>
    </div>
  );
}

export function AddSessionPanel({
  classId,
  sessions,
  defaultDurationMinutes,
  moduleId,
  defaultTitle,
  timeZone = browserTimeZone(),
}: {
  classId: string;
  sessions: ClassSchedule[];
  defaultDurationMinutes: number;
  moduleId?: string;
  defaultTitle?: string;
  /** Class time zone: the new session's date/time are read in this zone. */
  timeZone?: string;
}) {
  const addSession = useAddSession(classId);
  const nextNumber = (sessions?.reduce((max, s) => Math.max(max, s.sessionNumber || 0), 0) || 0) + 1;
  const [title, setTitle] = useState(defaultTitle || `Session ${nextNumber}`);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('18:00');
  const [duration, setDuration] = useState(String(defaultDurationMinutes || 60));
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(defaultTitle || `Session ${nextNumber}`);
  }, [nextNumber, defaultTitle, open]);

  const handleAdd = async () => {
    if (!title.trim()) {
      setError('Enter a session title');
      return;
    }
    if (!date || !time) {
      setError('Pick a date and start time');
      return;
    }
    const start = toInstant(date, time, timeZone);
    if (!start) {
      setError('Invalid date or time');
      return;
    }
    const end = new Date(start.getTime() + Number(duration) * 60_000);
    setError(null);
    try {
      await addSession.mutateAsync({
        sessionNumber: nextNumber,
        title: title.trim(),
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        status: 'scheduled',
        moduleId,
      });
      setDate('');
      setTime('18:00');
      setOpen(false);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full border border-dashed border-[#d5cfc4] bg-white px-3 py-2.5 text-sm text-[#14110e] hover:border-[#14110e] inline-flex items-center justify-center gap-1.5"
      >
        <Plus className="h-4 w-4" />
        Add live session
      </button>
    );
  }

  return (
    <div className="border border-dashed border-[#d5cfc4] bg-white p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-[#14110e]">New live session #{nextNumber}</p>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-[#6b655c] hover:text-[#14110e]">
          Cancel
        </button>
      </div>
      <p className="text-xs text-[#6b655c]">
        Saved immediately. Zoom attaches when configured; learners get an email.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="sm:col-span-2 flex flex-col gap-1.5">
          <span className={sessionFieldLabel}>Title *</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={sessionFieldControl}
            placeholder={`Session ${nextNumber}`}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={sessionFieldLabel}>Date *</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={sessionFieldControl} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={sessionFieldLabel}>Start time * ({tzLabel(timeZone)})</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={sessionFieldControl} />
        </label>
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className={sessionFieldLabel}>Duration</span>
          <select value={duration} onChange={(e) => setDuration(e.target.value)} className={sessionFieldControl}>
            <option value="30">30 minutes</option>
            <option value="60">1 hour</option>
            <option value="90">1.5 hours</option>
            <option value="120">2 hours</option>
            <option value="180">3 hours</option>
          </select>
        </label>
      </div>
      <LocalTimeHint date={date} time={time} timeZone={timeZone} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={() => void handleAdd()}
        disabled={addSession.isPending || !title.trim() || !date || !time}
        className="inline-flex items-center gap-2 bg-[#14110e] text-white px-3.5 py-2 text-sm hover:bg-black/80 disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
        {addSession.isPending ? 'Saving…' : 'Save session'}
      </button>
    </div>
  );
}
