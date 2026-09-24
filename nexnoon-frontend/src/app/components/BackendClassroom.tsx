import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  BookOpen,
  ClipboardList,
  Video,
  Award,
  Users,
  Pencil,
  Play,
  FileText,
  Clock,
  UserPlus,
  ShieldCheck,
  Flag,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBackendData } from '@/hooks/useBackendData';
import { apiClient, getErrorMessage } from '@/lib/api';
import { classService } from '@/lib/api/services/class.service';
import { classDetailUrl } from '@/lib/url';
import type { AssignmentAnswer, Class, ClassSchedule, Enrollment } from '@/types/api';
import Header from './Header';
import Footer from './Footer';
import BackendState from './BackendState';
import ZoomMeetingComponent from './ZoomMeetingComponent';
import ManageMaterials from './ManageMaterials';
import ManageAssignments from './ManageAssignments';
import StudentAssignments from './StudentAssignments';
import FileAttachment from './FileAttachment';
import { CertificatePreview } from './CertificatePreview';
import TeachingTeamModal from './TeachingTeamModal';
import { LocalTimeHint } from './SessionScheduleEditor';
import { browserTimeZone, formatInZone, splitInZone, tzLabel, useTimeFormat, zonedInputToIso } from '@/lib/timezone';

type LearnerRow = {
  id: string;
  userId: string;
  name: string;
  email: string;
  progress: number;
  status: string;
  enrolledAt: string;
  certificateUrl?: string | null;
  attendedSessions?: string[];
};

type Workspace = {
  class: Class;
  sessions: ClassSchedule[];
  enrollment: Enrollment | null;
  canTeach: boolean;
  mySubmissions: AssignmentAnswer[];
  learners?: LearnerRow[];
  submissionStats?: { assignmentId: string; count: number }[];
  policy?: { joinEarlyMinutes: number; lateJoinGraceMinutes: number; hostEarlyMinutes: number };
};

type View = 'classroom' | 'materials' | 'assignments' | 'recording' | 'live' | 'waiting' | 'certificate';

const heroFallback = 'https://images.unsplash.com/photo-1572044162444-ad60f128bdea?w=1080';
const safeUrl = (value?: string) => {
  try {
    const url = new URL(value || '');
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
};

const statusBadge: Record<ClassSchedule['status'], string> = {
  live: 'bg-red-100 text-red-800 border-red-200',
  scheduled: 'bg-sky-50 text-sky-800 border-sky-200',
  completed: 'bg-[#f0ebe3] text-[#5c5348] border-[#e4dfd6]',
  cancelled: 'bg-gray-100 text-gray-400 border-gray-200',
};

const navTabs: { route: string; label: string; icon: typeof BookOpen }[] = [
  { route: 'classroom', label: 'Overview', icon: BookOpen },
  { route: 'materials', label: 'Materials', icon: FileText },
  { route: 'assignments', label: 'Assignments', icon: ClipboardList },
  { route: 'waiting-room', label: 'Next session', icon: Video },
  { route: 'certificate', label: 'Certificate', icon: Award },
];

const activeRouteByView: Record<View, string> = {
  classroom: 'classroom',
  materials: 'materials',
  assignments: 'assignments',
  waiting: 'waiting-room',
  live: 'waiting-room',
  recording: 'waiting-room',
  certificate: 'certificate',
};

function LiveClassHeader({
  classId,
  courseTitle,
  instructorName,
  session,
  canTeach,
  onMarkComplete,
  isMarkingComplete,
  markCompleteError,
  onOpenManage,
}: {
  classId: string;
  courseTitle: string;
  instructorName: string;
  session?: ClassSchedule;
  canTeach?: boolean;
  onMarkComplete?: (sessionId: string) => void;
  isMarkingComplete?: boolean;
  markCompleteError?: string | null;
  onOpenManage?: () => void;
}) {
  const t = useTimeFormat();
  const canMarkComplete =
    canTeach && session && session.status !== 'completed' && session.status !== 'cancelled';

  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
      <div className="min-w-0">
        <Link
          to={classDetailUrl(classId, courseTitle)}
          className="inline-flex items-center gap-1.5 text-xs text-[#6b655c] hover:text-[#14110e] transition-colors mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to class page
        </Link>
        <h2 className="font-serif text-xl sm:text-2xl text-[#14110e] truncate">
          {session?.title || 'Live classroom'}
        </h2>
        <p className="text-sm text-[#6b655c] truncate mt-1">
          {courseTitle} · {instructorName}
        </p>
      </div>
      {session && (
        <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-1.5 flex-shrink-0">
          {session.status === 'live' ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse motion-reduce:animate-none" />{' '}
              In progress
            </span>
          ) : (
            <span
              className={`text-xs font-medium px-2.5 py-1 border capitalize ${statusBadge[session.status]}`}
            >
              {session.status}
            </span>
          )}
          <p className="text-sm text-[#6b655c] flex items-center gap-1.5 whitespace-nowrap">
            <Calendar className="h-3.5 w-3.5" /> {formatInZone(session.startTime, t.tz, 'datetime', true)}
          </p>
          {canTeach && onOpenManage && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOpenManage();
              }}
              className="relative z-10 text-xs font-medium text-[#3a5f8a] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <Pencil className="h-3 w-3" />
              Update date or status
            </button>
          )}
          {canMarkComplete && (
            <button
              type="button"
              onClick={() => onMarkComplete?.(session.id)}
              disabled={isMarkingComplete}
              className="text-xs font-medium text-[#c45c26] hover:text-[#a84c1e] underline disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isMarkingComplete ? 'Marking complete…' : 'Mark session complete'}
            </button>
          )}
          {markCompleteError && (
            <p className="text-xs text-red-600 max-w-[220px] text-right">{markCompleteError}</p>
          )}
        </div>
      )}
    </div>
  );
}

function SessionManagePanel({
  session,
  classId,
  timeZone,
  onSaved,
  onClose,
}: {
  session: ClassSchedule;
  classId: string;
  /** Class time zone: date/time fields are shown and saved in it. */
  timeZone: string;
  onSaved: () => Promise<unknown> | void;
  onClose: () => void;
}) {
  const baseline = (() => {
    const parts = splitInZone(session.startTime, timeZone);
    return {
      date: parts.date,
      time: parts.time,
      duration: String(
        Math.max(
          30,
          Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60000)
        )
      ),
    };
  })();
  const [dateVal, setDateVal] = useState(baseline.date);
  const [timeVal, setTimeVal] = useState(baseline.time);
  const [duration, setDuration] = useState(baseline.duration);
  const [status, setStatus] = useState<ClassSchedule['status']>(session.status);
  const [title, setTitle] = useState(session.title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [meetingUrl, setMeetingUrl] = useState(session.meetingUrl || '');
  const [recordingUrl, setRecordingUrl] = useState(session.recordingUrl || '');

  useEffect(() => {
    const parts = splitInZone(session.startTime, timeZone);
    setDateVal(parts.date);
    setTimeVal(parts.time);
    setMeetingUrl(session.meetingUrl || '');
    setRecordingUrl(session.recordingUrl || '');
    setDuration(
      String(
        Math.max(
          30,
          Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60000)
        )
      )
    );
    setStatus(session.status);
    setTitle(session.title);
    setError(null);
    setOk(null);
  }, [session.id, session.startTime, session.endTime, session.status, session.title, session.meetingUrl, session.recordingUrl, timeZone]);

  const startIso = zonedInputToIso(`${dateVal}T${timeVal}`, timeZone);

  const save = async () => {
    const newStart = new Date(startIso || NaN);
    if (!startIso || Number.isNaN(newStart.getTime())) {
      setError('Enter a valid date and time');
      return;
    }
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    const mins = Number(duration) || 60;
    const newEnd = new Date(newStart.getTime() + mins * 60_000);
    const now = Date.now();

    // Client-side guardrails (server enforces the same rules).
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
    if (
      (session.status === 'completed' || session.status === 'cancelled') &&
      status === 'scheduled' &&
      newStart.getTime() <= now
    ) {
      setError('To reschedule, pick a future date and time.');
      return;
    }

    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const res = await apiClient.patch(`/classes/${classId}/schedule/${session.id}`, {
        title: title.trim(),
        startTime: newStart.toISOString(),
        endTime: newEnd.toISOString(),
        status,
        meetingUrl: meetingUrl.trim(),
        recordingUrl: recordingUrl.trim(),
      });
      setOk(res.data.message || 'Session updated');
      await onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const field =
    'w-full border border-[#e4dfd6] bg-white px-3 py-2 text-sm outline-none focus:border-[#14110e]';

  const startReached = !!startIso && Date.now() >= new Date(startIso).getTime();
  const isCompleted = session.status === 'completed';
  const isScheduled = session.status === 'scheduled';
  const isLive = session.status === 'live';

  return (
    <div className="mb-5 border border-[#e4dfd6] bg-[#faf8f5] p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-[#14110e]">Update session</p>
        <button type="button" onClick={onClose} className="text-xs text-[#6b655c] hover:underline">
          Close
        </button>
      </div>
      <p className="text-xs text-[#6b655c] leading-relaxed">
        Complete only after start time. Cancel only while scheduled. To reopen a completed session, set a
        future date/time (Zoom updates automatically when connected).
      </p>
      <label className="block">
        <span className="text-[10px] uppercase tracking-wide text-[#8a847a]">Title</span>
        <input className={`${field} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <div className="grid sm:grid-cols-4 gap-2.5">
        <label className="block sm:col-span-1">
          <span className="text-[10px] uppercase tracking-wide text-[#8a847a]">Date</span>
          <input
            type="date"
            className={`${field} mt-1`}
            value={dateVal}
            onChange={(e) => setDateVal(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-wide text-[#8a847a]">Start ({tzLabel(timeZone)})</span>
          <input
            type="time"
            className={`${field} mt-1`}
            value={timeVal}
            onChange={(e) => setTimeVal(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-wide text-[#8a847a]">Duration</span>
          <select className={`${field} mt-1`} value={duration} onChange={(e) => setDuration(e.target.value)}>
            <option value="30">30 min</option>
            <option value="60">1 hour</option>
            <option value="90">1.5 hours</option>
            <option value="120">2 hours</option>
            <option value="180">3 hours</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-wide text-[#8a847a]">Status</span>
          <select
            className={`${field} mt-1`}
            value={status}
            onChange={(e) => setStatus(e.target.value as ClassSchedule['status'])}
          >
            <option value="scheduled">Scheduled</option>
            {(isScheduled || isLive || status === 'live') && (
              <option value="live" disabled={isCompleted}>
                In progress
              </option>
            )}
            <option value="completed" disabled={!startReached && status !== 'completed'}>
              Completed{!startReached && status !== 'completed' ? ' (after start time)' : ''}
            </option>
            <option value="cancelled" disabled={!isScheduled && status !== 'cancelled'}>
              Cancelled
            </option>
          </select>
        </label>
      </div>
      <LocalTimeHint date={dateVal} time={timeVal} timeZone={timeZone} />
      <div className="grid sm:grid-cols-2 gap-2.5">
        <label className="block">
          <span className="text-[10px] uppercase tracking-wide text-[#8a847a]">Your own meeting link (optional)</span>
          <input
            type="url"
            className={`${field} mt-1`}
            value={meetingUrl}
            placeholder="https://meet.google.com/… or Teams / Zoom link"
            onChange={(e) => setMeetingUrl(e.target.value)}
          />
          <span className="mt-1 block text-[11px] text-[#8a847a]">Replaces the Nexnoon Zoom room. Learners only see it when joining.</span>
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-wide text-[#8a847a]">Recording link</span>
          <input
            type="url"
            className={`${field} mt-1`}
            value={recordingUrl}
            placeholder="https://…"
            onChange={(e) => setRecordingUrl(e.target.value)}
          />
          <span className="mt-1 block text-[11px] text-[#8a847a]">Learners can rewatch once the session is completed.</span>
        </label>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {ok && <p className="text-xs text-emerald-700">{ok}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="bg-[#14110e] text-white px-4 py-2 text-sm disabled:opacity-50 hover:bg-black/80"
        >
          {saving ? 'Saving…' : 'Save session'}
        </button>
        {(isScheduled || isLive) && startReached && status !== 'completed' && (
          <button
            type="button"
            onClick={() => {
              setStatus('completed');
            }}
            className="border border-[#e4dfd6] px-4 py-2 text-sm hover:bg-white"
          >
            Set status to completed
          </button>
        )}
      </div>
    </div>
  );
}

function MeetingPanel({
  session,
  canTeach,
  classId,
  emptyHint,
  onZoomReady,
}: {
  session?: ClassSchedule;
  canTeach: boolean;
  classId: string;
  emptyHint: string;
  onZoomReady?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomStatus, setZoomStatus] = useState<{
    readyForTutors?: boolean;
    readyForLearners?: boolean;
    meetings?: { configured: boolean };
    meetingSdk?: { configured: boolean };
  } | null>(null);

  const [ownLink, setOwnLink] = useState('');
  const hasRoom = !!(session?.hasMeeting || session?.zoomMeetingId);

  useEffect(() => {
    if (!canTeach || hasRoom) return;
    apiClient
      .get('/settings/zoom')
      .then((res) => setZoomStatus(res.data.data))
      .catch(() => setZoomStatus(null));
  }, [canTeach, session?.id, hasRoom]);

  if (hasRoom) return null;

  const saveOwnLink = async () => {
    if (!session || !ownLink.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.patch(`/classes/${classId}/schedule/${session.id}`, { meetingUrl: ownLink.trim() });
      onZoomReady?.();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const createZoom = async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await classService.ensureZoomMeeting(classId, session.id);
      onZoomReady?.();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-[#2a2620] bg-gradient-to-b from-[#1a1714] to-[#0d0b09] p-10 sm:p-14 text-center">
      <Video className="h-8 w-8 text-white/40 mx-auto mb-4" />
      <p className="text-white/70 text-sm max-w-md mx-auto leading-relaxed">{emptyHint}</p>
      {canTeach && zoomStatus && (
        <p className="text-white/45 text-xs mt-3 max-w-md mx-auto">
          Zoom meetings: {zoomStatus.meetings?.configured ? 'configured' : 'not configured'} · Learner
          SDK: {zoomStatus.meetingSdk?.configured ? 'configured' : 'not configured'}
        </p>
      )}
      {error && <p className="text-red-300 text-xs mt-3 max-w-md mx-auto">{error}</p>}
      {canTeach && session && (
        <div className="flex flex-wrap justify-center gap-2 mt-5">
          <button
            type="button"
            onClick={() => void createZoom()}
            disabled={busy}
            className="inline-flex items-center gap-2 text-sm text-[#0d0b09] bg-white px-4 py-2 hover:bg-white/90 disabled:opacity-50"
          >
            <Video className="h-3.5 w-3.5" />
            {busy ? 'Creating Zoom…' : 'Create Zoom meeting'}
          </button>
          <Link
            to={`/edit-class/${classId}`}
            className="inline-flex items-center gap-2 text-sm text-white border border-white/30 px-4 py-2 hover:bg-white/10 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" /> Manage schedule
          </Link>
        </div>
      )}
      {canTeach && session && (
        <form
          className="mx-auto mt-6 flex max-w-md flex-col gap-2 border-t border-white/10 pt-5 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void saveOwnLink();
          }}
        >
          <input
            type="url"
            required
            value={ownLink}
            onChange={(e) => setOwnLink(e.target.value)}
            placeholder="Or paste your own meeting link (Meet, Teams, Zoom)"
            className="min-w-0 flex-1 border border-white/25 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/60"
          />
          <button type="submit" disabled={busy} className="border border-white/30 px-4 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-50">
            Use this link
          </button>
        </form>
      )}
      {canTeach && !session && (
        <Link
          to={`/edit-class/${classId}`}
          className="inline-flex items-center gap-2 mt-5 text-sm text-white border border-white/30 px-4 py-2 hover:bg-white/10 transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" /> Manage schedule in Edit class
        </Link>
      )}
    </div>
  );
}

const REPORT_TYPES = [
  { id: 'off_platform_payment', label: 'Instructor asked me to pay outside Nexnoon' },
  { id: 'instructor_no_show', label: 'Instructor didn’t show up' },
  { id: 'conduct', label: 'Inappropriate behaviour' },
  { id: 'curriculum_drift', label: 'Class doesn’t match the course' },
  { id: 'technical', label: 'Technical problem' },
  { id: 'other', label: 'Something else' },
] as const;

function LearnerSafetyNotice({ classId }: { classId: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<(typeof REPORT_TYPES)[number]['id']>('off_platform_payment');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await apiClient.post(`/reports/classes/${classId}`, { type, description: description.trim() });
      setResult({ ok: true, text: res.data?.message || 'Thanks — our team will look into it.' });
      setDescription('');
      setOpen(false);
    } catch (err) {
      setResult({ ok: false, text: getErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-6 border border-[#eadfcf] bg-[#fff8f0] px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-start gap-2 text-[#5c4a36]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#c45c26]" />
          <span>
            All payments for Nexnoon classes happen on Nexnoon. Never pay an instructor directly — if you’re asked to, please let us know.
          </span>
        </p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 border border-[#d5cfc4] bg-white px-3 py-1.5 text-xs hover:bg-[#f0ebe3]"
        >
          <Flag className="h-3.5 w-3.5" /> Report a problem
        </button>
      </div>
      {result && <p className={`mt-2 text-xs ${result.ok ? 'text-emerald-800' : 'text-rose-700'}`}>{result.text}</p>}
      {open && (
        <div className="mt-3 space-y-3 border-t border-[#eadfcf] pt-3">
          <label className="block">
            <span className="text-xs text-[#6b655c]">What happened?</span>
            <select
              className="mt-1 w-full border border-[#d5cfc4] bg-white px-3 py-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
            >
              {REPORT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-[#6b655c]">Details (only the Nexnoon team sees this)</span>
            <textarea
              rows={3}
              maxLength={2000}
              className="mt-1 w-full resize-y border border-[#d5cfc4] bg-white px-3 py-2 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="When did it happen and what was said? Include amounts or payment links if relevant."
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || description.trim().length < 10}
              onClick={() => void submit()}
              className="bg-[#14110e] px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Send report'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="border border-[#d5cfc4] px-3 py-2 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default function BackendClassroom({ view }: { view: View }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const classId = id || params.get('classId');
  const { user, isLoading: authLoading } = useAuth();
  const [now, setNow] = useState(Date.now());
  const [completingSessionId, setCompletingSessionId] = useState<string | null>(null);
  const [markCompleteError, setMarkCompleteError] = useState<string | null>(null);
  const [manageSessionOpen, setManageSessionOpen] = useState(false);
  const [issuingId, setIssuingId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [classOverride, setClassOverride] = useState<Class | null>(null);
  const t = useTimeFormat();

  const query = useBackendData<Workspace>(`/data/class/${classId || 'missing'}`, false, {
    refetchInterval: 15_000,
  });
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const title = {
    classroom: 'Classroom',
    materials: 'Course materials',
    assignments: 'Assignments',
    recording: 'Class recording',
    live: 'Live session',
    waiting: 'Next session',
    certificate: 'Certificate',
  }[view];

  if (authLoading) return <BackendState title={title} loading message="Loading Nexnoon" />;
  if (!user) return <BackendState title={title} message="Sign in to access your classes." />;
  if (!classId) return <BackendState title={title} message="Select a class from My Classes to continue." />;
  if (query.isError) {
    return (
      <BackendState
        title={title}
        message="Unable to open this class. Check your connection and make sure you are enrolled or teaching it."
        retry={() => query.refetch()}
      />
    );
  }
  if (!query.data) return <BackendState title={title} loading message="Loading Nexnoon" />;

  const {
    class: clsRaw,
    sessions,
    enrollment,
    canTeach,
    mySubmissions,
    learners = [],
    submissionStats = [],
  } = query.data;
  const cls = classOverride?.id === clsRaw.id ? { ...clsRaw, ...classOverride } : clsRaw;
  const isLead = cls.instructor.id === user.id || user.role === 'admin';
  const myPendingInvite = (cls.teachingTeam || []).some(
    (m) => String(m.userId) === user.id && m.status === 'pending'
  );

  const policy = query.data.policy;
  const graceMs = (policy?.lateJoinGraceMinutes ?? 30) * 60_000;
  const classTz = cls.timezone || browserTimeZone();
  const fmtWhen = (v?: string) => (v ? formatInZone(v, t.tz, 'datetime', true) : 'Not scheduled');
  const requested = params.get('sessionId');
  // Late joiners keep the session (not the next one) until the backend's grace period is over.
  const session = requested
    ? sessions.find((s) => s.id === requested)
    : view === 'recording'
      ? sessions.find((s) => s.recordingUrl)
      : sessions.find((s) => s.status === 'live') ||
        sessions.find(
          (s) => s.status !== 'cancelled' && s.status !== 'completed' && new Date(s.endTime).getTime() + graceMs > now
        );

  const recordingUrl = safeUrl(session?.recordingUrl);
  const certificateUrl =
    enrollment?.status === 'completed' ? safeUrl(enrollment.certificateUrl) : undefined;
  const activeRoute = activeRouteByView[view];
  const nextUpcoming = sessions.find(
    (s) => s.status !== 'cancelled' && new Date(s.endTime).getTime() > now
  );
  const countdownMs = nextUpcoming ? Math.max(0, new Date(nextUpcoming.startTime).getTime() - now) : 0;
  const countdown =
    countdownMs > 0
      ? {
          d: Math.floor(countdownMs / 86400000),
          h: Math.floor((countdownMs % 86400000) / 3600000),
          m: Math.floor((countdownMs % 3600000) / 60000),
          s: Math.floor((countdownMs % 60000) / 1000),
        }
      : null;

  const handleMarkComplete = async (sessionId: string) => {
    setCompletingSessionId(sessionId);
    setMarkCompleteError(null);
    try {
      await apiClient.post(`/classes/${classId}/schedule/${sessionId}/complete`);
      await query.refetch();
    } catch (err) {
      setMarkCompleteError(getErrorMessage(err));
    } finally {
      setCompletingSessionId(null);
    }
  };

  const issueCertificate = async (enrollmentId: string) => {
    setIssuingId(enrollmentId);
    setFlash(null);
    try {
      await apiClient.post(`/enrollments/${enrollmentId}/certificate`);
      setFlash('Certificate issued');
      await query.refetch();
    } catch (err) {
      setFlash(getErrorMessage(err));
    } finally {
      setIssuingId(null);
    }
  };

  const teamSupport = (cls.teachingTeam || []).filter(
    (m) => m.role === 'support' && m.status === 'accepted'
  ).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f4f0] text-[#1a1a1a]">
      <Header />

      {/* Hero */}
      <div
        className="relative py-10 sm:py-14 overflow-hidden"
        style={{
          backgroundImage: `url(${cls.thumbnail || heroFallback})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d0b09]/88 via-[#1a1714]/72 to-[#2a2620]/55" />
        <div className="relative z-10 w-[min(92vw,1120px)] mx-auto">
          <Link
            to="/my-classes"
            className="inline-flex items-center gap-2 text-white/70 hover:text-white text-xs mb-3 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to My Classes
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-[10px] uppercase tracking-[0.16em] text-white/80 border border-white/25 px-2 py-0.5">
                  {cls.category}
                </span>
                {canTeach && (
                  <span className="text-[10px] uppercase tracking-[0.16em] bg-[#c45c26] text-white px-2 py-0.5">
                    Teaching
                  </span>
                )}
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl text-white tracking-tight">{cls.title}</h1>
              <p className="text-white/65 text-sm mt-2">
                {cls.instructor.name} · {cls.totalSessions} sessions
                {canTeach && teamSupport > 0 ? ` · ${teamSupport} support instructor${teamSupport > 1 ? 's' : ''}` : ''}
              </p>
            </div>
            {enrollment && (
              <div className="border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-2.5">
                <p className="text-white font-serif text-xl leading-none">{enrollment.progress}%</p>
                <p className="text-white/60 text-[10px] uppercase tracking-wider mt-1 capitalize">
                  {enrollment.status}
                </p>
              </div>
            )}
            {canTeach && (
              <div className="border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-2.5">
                <p className="text-white font-serif text-xl leading-none">{learners.length}</p>
                <p className="text-white/60 text-[10px] uppercase tracking-wider mt-1">Learners</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="flex-1 w-[min(92vw,1120px)] mx-auto pb-12">
        {/* Nav */}
        <nav className="flex flex-wrap gap-1 bg-white border border-[#e4dfd6] p-1.5 -mt-5 sticky top-16 z-40 mb-6 shadow-[0_8px_30px_rgba(20,17,14,0.06)]">
          {navTabs.map(({ route, label, icon: Icon }) => (
            <Link
              key={route}
              to={`/${route}/${classId}`}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm transition-colors ${
                activeRoute === route
                  ? 'bg-[#14110e] text-[#f6f4f0]'
                  : 'text-[#3d3933] hover:bg-[#f0ebe3]'
              }`}
            >
              <Icon className="h-3.5 w-3.5 opacity-80" />
              {label}
            </Link>
          ))}
          {isLead && (
            <button
              type="button"
              onClick={() => setTeamModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm text-[#3d3933] hover:bg-[#f0ebe3] transition-colors ml-auto"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Invite instructors
            </button>
          )}
          {myPendingInvite && !isLead && (
            <button
              type="button"
              onClick={() => setTeamModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm bg-[#c45c26] text-white ml-auto"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Respond to invite
            </button>
          )}
          {canTeach && (
            <Link
              to={`/edit-class/${classId}`}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm text-[#3d3933] hover:bg-[#f0ebe3] transition-colors ${
                !isLead && !myPendingInvite ? 'ml-auto' : ''
              }`}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit class
            </Link>
          )}
        </nav>

        {enrollment && !canTeach && <LearnerSafetyNotice classId={classId} />}

        {flash && (
          <p className="mb-4 text-sm border border-[#e4dfd6] bg-white px-4 py-2.5 text-[#3d3933]">{flash}</p>
        )}

        {/* ——— OVERVIEW ——— */}
        {view === 'classroom' && (
          <div className="space-y-6">
            {canTeach && (
              <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Learners', value: learners.length, hint: 'Active enrollments' },
                  {
                    label: 'Sessions done',
                    value: sessions.filter((s) => s.status === 'completed').length,
                    hint: `of ${sessions.length}`,
                  },
                  { label: 'Materials', value: cls.materials?.length || 0, hint: 'Uploaded files' },
                  {
                    label: 'Assignments',
                    value: cls.assignments?.length || 0,
                    hint: `${submissionStats.reduce((n, s) => n + s.count, 0)} submissions`,
                  },
                ].map((card) => (
                  <div key={card.label} className="border border-[#e4dfd6] bg-white px-4 py-3.5">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[#6b655c]">{card.label}</p>
                    <p className="font-serif text-2xl mt-1 text-[#14110e]">{card.value}</p>
                    <p className="text-xs text-[#8a847a] mt-0.5">{card.hint}</p>
                  </div>
                ))}
              </section>
            )}

            <section className="border border-[#e4dfd6] bg-white p-5 sm:p-7">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 min-w-0">
                  <LiveClassHeader
                    classId={classId!}
                    courseTitle={cls.title}
                    instructorName={cls.instructor.name}
                    session={session}
                    canTeach={canTeach}
                    onMarkComplete={handleMarkComplete}
                    isMarkingComplete={completingSessionId === session?.id}
                    markCompleteError={completingSessionId === null ? markCompleteError : null}
                    onOpenManage={() => setManageSessionOpen((v) => !v)}
                  />
                  {canTeach && manageSessionOpen && session && (
                    <SessionManagePanel
                      session={session}
                      classId={classId!}
                      timeZone={classTz}
                      onSaved={() => query.refetch()}
                      onClose={() => setManageSessionOpen(false)}
                    />
                  )}
                  {session?.hasMeeting || session?.zoomMeetingId ? (
                    <ZoomMeetingComponent
                      key={session.id}
                      classId={classId!}
                      session={session}
                      userName={user?.name || 'Student'}
                      instructorName={cls.instructor.name}
                      isEnrolled={!canTeach && enrollment?.status === 'active'}
                      thumbnail={cls.thumbnail}
                      isHost={canTeach}
                      onSessionStarted={() => query.refetch()}
                      joinEarlyMinutes={policy?.joinEarlyMinutes}
                    />
                  ) : (
                    <MeetingPanel
                      session={session}
                      canTeach={canTeach}
                      classId={classId!}
                      onZoomReady={() => query.refetch()}
                      emptyHint={
                        session
                          ? canTeach
                            ? 'This session has no meeting room yet. Create a Nexnoon Zoom meeting, or use your own link.'
                            : 'The meeting room for this session isn’t ready yet. Check back closer to the start time.'
                          : 'No upcoming session has been scheduled.'
                      }
                    />
                  )}
                </div>

                <aside className="lg:col-span-1 min-w-0">
                  <div className="border border-[#e4dfd6] overflow-hidden sticky top-28">
                    <div className="px-4 py-3 border-b border-[#eee9e0] bg-[#faf8f5]">
                      <h2 className="text-sm font-medium text-[#14110e]">Course content</h2>
                      <p className="text-xs text-[#6b655c]">
                        {sessions.length} session{sessions.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="lg:max-h-[480px] lg:overflow-y-auto divide-y divide-[#f2eee7]">
                      {!sessions.length && (
                        <p className="text-sm text-[#6b655c] p-4">No sessions scheduled yet.</p>
                      )}
                      {sessions.map((s) => {
                        const isActive = session?.id === s.id;
                        const isDone = canTeach
                          ? s.status === 'completed'
                          : !!enrollment?.attendedSessions?.includes(s.id);
                        return (
                          <div
                            key={s.id}
                            className={`px-4 py-3 transition-colors ${isActive ? 'bg-[#fff3ea]' : 'hover:bg-[#faf8f5]'}`}
                          >
                            <Link
                              to={`/classroom/${classId}?sessionId=${s.id}`}
                              className="flex items-start gap-3"
                            >
                              <span className="mt-0.5 flex-shrink-0 w-5 h-5 flex items-center justify-center">
                                {isDone ? (
                                  <CheckCircle2 className="h-5 w-5 text-[#c45c26]" />
                                ) : s.status === 'live' ? (
                                  <span className="relative flex h-3 w-3" aria-hidden="true">
                                    <span className="animate-ping motion-reduce:hidden absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600" />
                                  </span>
                                ) : (
                                  <span
                                    className={`block w-4 h-4 rounded-full border-2 ${
                                      s.status === 'cancelled' ? 'border-gray-200' : 'border-[#d5cfc4]'
                                    }`}
                                  />
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span
                                  className={`block text-sm font-medium truncate ${
                                    isActive
                                      ? 'text-[#c45c26]'
                                      : s.status === 'cancelled'
                                        ? 'text-gray-400'
                                        : 'text-[#14110e]'
                                  }`}
                                >
                                  {s.title}
                                </span>
                                <span className="flex items-center gap-1.5 text-xs text-[#6b655c] mt-0.5">
                                  <Calendar className="h-3 w-3" /> {fmtWhen(s.startTime)}
                                </span>
                              </span>
                            </Link>
                            {safeUrl(s.recordingUrl) && (
                              <Link
                                to={`/recorded-class/${classId}?sessionId=${s.id}`}
                                className="inline-flex items-center gap-1 text-xs text-[#c45c26] hover:underline mt-1.5 ml-8"
                              >
                                <Play className="h-3 w-3" /> Watch recording
                              </Link>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </aside>
              </div>

              <div className="border-t border-[#eee9e0] mt-8 pt-6">
                <h2 className="font-serif text-xl text-[#14110e] mb-2">About this class</h2>
                <p className="whitespace-pre-line text-[#3d3933] text-sm leading-relaxed max-w-3xl">
                  {cls.description}
                </p>
              </div>
            </section>

            {canTeach && (
              <section className="border border-[#e4dfd6] bg-white p-5 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-[#6b655c]" />
                    <h2 className="font-serif text-xl">Learner roster</h2>
                  </div>
                  <Link
                    to={`/students-management?classId=${classId}`}
                    className="text-sm underline text-[#6b655c] hover:text-[#14110e]"
                  >
                    Open full learner management
                  </Link>
                </div>
                {!learners.length ? (
                  <p className="text-sm text-[#6b655c]">No learners enrolled yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#eee9e0] text-[11px] uppercase tracking-wider text-[#6b655c]">
                          {['Learner', 'Progress', 'Attendance', 'Status', 'Certificate'].map((h) => (
                            <th key={h} className="px-3 py-2.5 font-medium">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {learners.map((l) => (
                          <tr key={l.id} className="border-b border-[#f2eee7]">
                            <td className="px-3 py-3">
                              <p className="font-medium">{l.name}</p>
                              <p className="text-xs text-[#8a847a]">{l.email}</p>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2 min-w-[100px]">
                                <div className="flex-1 h-1.5 bg-[#ebe6de]">
                                  <div
                                    className="h-full bg-[#c45c26]"
                                    style={{ width: `${l.progress}%` }}
                                  />
                                </div>
                                <span className="text-xs">{l.progress}%</span>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-[#6b655c]">
                              {l.attendedSessions?.length || 0}/{sessions.length}
                            </td>
                            <td className="px-3 py-3 capitalize">{l.status}</td>
                            <td className="px-3 py-3">
                              {l.certificateUrl || l.status === 'completed' ? (
                                <span className="text-emerald-700 text-xs font-medium">Issued</span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={issuingId === l.id}
                                  onClick={() => issueCertificate(l.id)}
                                  className="text-xs underline text-[#c45c26] disabled:opacity-50"
                                >
                                  {issuingId === l.id ? 'Issuing…' : 'Issue'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {/* ——— MATERIALS ——— */}
        {view === 'materials' && (
          <section className="border border-[#e4dfd6] bg-white p-5 sm:p-7">
            <div className="mb-6">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#6b655c]">Teaching materials</p>
              <h2 className="font-serif text-2xl text-[#14110e] mt-1">Course materials</h2>
              <p className="text-sm text-[#6b655c] mt-1.5 max-w-2xl">
                {canTeach
                  ? 'Upload PDFs, images, and docs to Cloudinary, or paste a Google Drive link. Learners can preview materials in the classroom.'
                  : 'Preview and open files shared by your instructor.'}
              </p>
            </div>
            {canTeach ? (
              <ManageMaterials
                classId={classId!}
                materials={cls.materials || []}
                onChanged={() => query.refetch()}
              />
            ) : !cls.materials?.length ? (
              <p className="text-sm text-[#6b655c] py-8 text-center border border-dashed border-[#ddd6ca]">
                No materials have been added by the instructor yet.
              </p>
            ) : (
              <div className="space-y-2">
                {cls.materials.map((item, index) => (
                  <FileAttachment key={index} url={item} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ——— ASSIGNMENTS ——— */}
        {view === 'assignments' && (
          <section className="border border-[#e4dfd6] bg-white p-5 sm:p-7">
            <div className="mb-6">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#6b655c]">Practice & projects</p>
              <h2 className="font-serif text-2xl text-[#14110e] mt-1">Assignments</h2>
              <p className="text-sm text-[#6b655c] mt-1.5 max-w-2xl">
                {canTeach
                  ? 'Create assignments with due dates and optional attachments. Track learner submissions here.'
                  : 'Complete and submit your work for this class.'}
              </p>
            </div>
            {canTeach ? (
              <ManageAssignments
                classId={classId!}
                assignments={cls.assignments || []}
                submissionStats={submissionStats}
                onChanged={() => query.refetch()}
              />
            ) : (
              <StudentAssignments
                classId={classId!}
                assignments={cls.assignments || []}
                submissions={mySubmissions}
                onChanged={() => query.refetch()}
              />
            )}
          </section>
        )}

        {/* ——— RECORDING ——— */}
        {view === 'recording' && (
          <section className="border border-[#e4dfd6] bg-white p-5 sm:p-7">
            {recordingUrl ? (
              <>
                <h3 className="font-serif text-xl mb-4">{session?.title}</h3>
                <video className="w-full bg-black aspect-video" controls src={recordingUrl} />
                <a
                  className="underline inline-block mt-4 text-sm"
                  href={recordingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open recording
                </a>
              </>
            ) : (
              <p className="text-sm text-[#6b655c]">No recording is available for this session yet.</p>
            )}
          </section>
        )}

        {/* ——— WAITING / NEXT SESSION ——— */}
        {(view === 'live' || view === 'waiting') && (
          <div className="space-y-6">
            {nextUpcoming && countdown && (
              <section className="border border-[#e4dfd6] bg-[#14110e] text-[#f6f4f0] p-6 sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/50 mb-2">Up next</p>
                    <h2 className="font-serif text-2xl">{nextUpcoming.title}</h2>
                    <p className="text-white/60 text-sm mt-2 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {fmtWhen(nextUpcoming.startTime)}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    {[
                      ['Days', countdown.d],
                      ['Hours', countdown.h],
                      ['Min', countdown.m],
                      ['Sec', countdown.s],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="text-center min-w-[3.25rem]">
                        <p className="font-serif text-2xl tabular-nums">{String(value).padStart(2, '0')}</p>
                        <p className="text-[10px] uppercase tracking-wider text-white/45 mt-1">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            <section className="border border-[#e4dfd6] bg-white p-5 sm:p-7">
              {session ? (
                <>
                  <LiveClassHeader
                    classId={classId!}
                    courseTitle={cls.title}
                    instructorName={cls.instructor.name}
                    session={session}
                    canTeach={canTeach}
                    onMarkComplete={handleMarkComplete}
                    isMarkingComplete={completingSessionId === session?.id}
                    markCompleteError={completingSessionId === null ? markCompleteError : null}
                    onOpenManage={() => setManageSessionOpen((v) => !v)}
                  />
                  {canTeach && manageSessionOpen && (
                    <SessionManagePanel
                      key={session.id}
                      session={session}
                      classId={classId!}
                      timeZone={classTz}
                      onSaved={() => query.refetch()}
                      onClose={() => setManageSessionOpen(false)}
                    />
                  )}
                  {session.hasMeeting || session.zoomMeetingId ? (
                    <ZoomMeetingComponent
                      key={session.id}
                      classId={classId!}
                      session={session}
                      userName={user?.name || 'Student'}
                      instructorName={cls.instructor.name}
                      isEnrolled={!canTeach && enrollment?.status === 'active'}
                      thumbnail={cls.thumbnail}
                      isHost={canTeach}
                      onSessionStarted={() => query.refetch()}
                      joinEarlyMinutes={policy?.joinEarlyMinutes}
                    />
                  ) : (
                    <MeetingPanel
                      session={session}
                      canTeach={canTeach}
                      classId={classId!}
                      onZoomReady={() => query.refetch()}
                      emptyHint={
                        canTeach
                          ? 'This session has no meeting room yet. Create a Nexnoon Zoom meeting, or use your own link, then start as host.'
                          : 'The meeting room for this session isn’t ready yet. Check back closer to the start time.'
                      }
                    />
                  )}
                </>
              ) : (
                <div className="py-12 text-center">
                  <Calendar className="h-8 w-8 text-[#d5cfc4] mx-auto mb-3" />
                  <p className="text-sm text-[#6b655c]">No upcoming session has been scheduled.</p>
                  {canTeach && (
                    <Link
                      to={`/edit-class/${classId}`}
                      className="inline-block mt-4 text-sm underline text-[#c45c26]"
                    >
                      Add or reschedule sessions
                    </Link>
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ——— CERTIFICATE ——— */}
        {view === 'certificate' && (
          <section className="border border-[#e4dfd6] bg-white p-5 sm:p-7 space-y-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#6b655c]">Completion</p>
              <h2 className="font-serif text-2xl text-[#14110e] mt-1">Certificate</h2>
              <p className="text-sm text-[#6b655c] mt-1.5 max-w-2xl">
                {canTeach
                  ? 'Issue certificates when learners complete the class. Certificate copy comes from class details.'
                  : 'Your certificate appears here once the instructor marks your enrollment complete.'}
              </p>
            </div>

            <CertificatePreview
              title={cls.title}
              instructor={cls.instructor.name}
              information={
                cls.details?.certificateInfo ||
                'Complete all sessions and assignments to earn your Nexnoon certificate of completion.'
              }
            />

            {!canTeach && (
              <div className="border border-[#e4dfd6] bg-[#faf8f5] p-5">
                {certificateUrl ? (
                  <a
                    className="inline-flex items-center gap-2 text-sm font-medium text-[#c45c26] underline"
                    href={certificateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Open your certificate
                  </a>
                ) : (
                  <p className="text-sm text-[#6b655c]">
                    No certificate has been issued for this enrollment yet.
                    {enrollment && (
                      <span>
                        {' '}
                        Current progress: <strong>{enrollment.progress}%</strong> · status{' '}
                        <strong className="capitalize">{enrollment.status}</strong>.
                      </span>
                    )}
                  </p>
                )}
              </div>
            )}

            {canTeach && (
              <div>
                <h3 className="font-medium mb-3">Issue to learners</h3>
                {!learners.length ? (
                  <p className="text-sm text-[#6b655c]">No learners to certify yet.</p>
                ) : (
                  <ul className="divide-y divide-[#eee9e0] border border-[#e4dfd6]">
                    {learners.map((l) => (
                      <li
                        key={l.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                      >
                        <div>
                          <p className="font-medium">{l.name}</p>
                          <p className="text-xs text-[#8a847a]">
                            {l.progress}% · {l.status}
                          </p>
                        </div>
                        {l.certificateUrl || l.status === 'completed' ? (
                          <span className="text-emerald-700 text-xs font-medium inline-flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Issued
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={issuingId === l.id}
                            onClick={() => issueCertificate(l.id)}
                            className="bg-[#14110e] text-white px-3 py-2 text-xs disabled:opacity-50"
                          >
                            {issuingId === l.id ? 'Issuing…' : 'Issue certificate'}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        )}
      </main>
      {(isLead || myPendingInvite) && (
        <TeachingTeamModal
          open={teamModalOpen}
          onOpenChange={setTeamModalOpen}
          classId={classId!}
          classData={cls}
          currentUserId={user.id}
          isAdmin={user.role === 'admin'}
          onUpdated={(updated) => {
            setClassOverride(updated);
            query.refetch();
          }}
        />
      )}
      <Footer />
    </div>
  );
}
