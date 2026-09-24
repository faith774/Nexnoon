import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarPlus, Clock, Crown, RefreshCw, UserMinus, UserPlus, Video, XCircle } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { allTimeZones, browserTimeZone, isoToZonedInput, tzOffsetMs, zonedInputToIso } from '@/lib/timezone';
import type { Class, ClassSchedule } from '@/types/api';
import { useAdmin, useAdminAction } from './context';
import type { Account, ClassOp, Course } from './types';
import { Avatar, EmptyBlock, Field, Modal, Panel, Pill, SectionLabel, btn, inputCls, money, statusToneOf } from './ui';

/* ------------------------------------------------------------------ */
/* Timezone helpers                                                    */
/* ------------------------------------------------------------------ */

export { browserTimeZone, zonedInputToIso, isoToZonedInput };

function addDaysToInput(value: string, days: number) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return value;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + days, +m[4], +m[5])).toISOString().slice(0, 16);
}

export function fmtInZone(iso: string, tz: string) {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: tz,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

const addMinutes = (iso: string, minutes: number) => new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();

/* ------------------------------------------------------------------ */
/* Instructor eligibility                                              */
/* ------------------------------------------------------------------ */

function approvedInstructors(users: Account[] | undefined) {
  return (users || [])
    .filter((u) => u.role === 'instructor' && u.instructorStatus === 'approved')
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

const isCertified = (u: Account, courseId?: string) => !courseId || (u.approvedCourseIds || []).includes(courseId);

/* ------------------------------------------------------------------ */
/* Create class                                                        */
/* ------------------------------------------------------------------ */

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'] as const;

const emptyForm = () => ({
  courseId: '',
  languageOfferingId: '',
  leadInstructorId: '',
  title: '',
  titleTouched: false,
  level: 'Beginner' as (typeof LEVELS)[number],
  price: '0',
  duration: '60',
  timezone: browserTimeZone(),
  status: 'draft' as 'draft' | 'published',
  firstSession: '',
  sessionCount: '8',
  intervalDays: '7',
});

function courseCurriculum(course: Course | undefined) {
  return (course?.curriculumTemplate || []).map((m) => ({
    id: m.id,
    title: m.title,
    topics: m.description ? [m.description] : [],
    project: '',
  }));
}

export function CreateClassModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (classId: string) => void;
}) {
  const { data, flash, goTo } = useAdmin();
  const run = useAdminAction();
  const [form, setForm] = useState(emptyForm);
  const [wasOpen, setWasOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const zones = useMemo(allTimeZones, []);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setForm(emptyForm());
  }

  const courses = (data.courses || []).filter((c) => c.status === 'published');
  const course = courses.find((c) => c.id === form.courseId);
  const offerings = (course?.languageOfferings || []).filter((o) => o.status !== 'inactive');
  const offering = offerings.find((o) => o.id === form.languageOfferingId);
  const instructors = approvedInstructors(data.users);
  const certified = instructors.filter((u) => isCertified(u, form.courseId));
  const curriculum = courseCurriculum(course);

  const autoTitle = course ? `${course.title}${offering ? ` (${offering.label})` : ''}` : '';
  const title = form.titleTouched ? form.title : autoTitle;

  const duration = Number(form.duration);
  const count = form.firstSession ? Math.max(0, Math.min(60, Number(form.sessionCount) || 0)) : 0;
  const interval = Math.max(1, Number(form.intervalDays) || 7);
  const sessions = Array.from({ length: count }, (_, i) => {
    const startTime = zonedInputToIso(addDaysToInput(form.firstSession, i * interval), form.timezone);
    return startTime
      ? {
          sessionNumber: i + 1,
          title: curriculum[i]?.title || `Session ${i + 1}`,
          startTime,
          endTime: addMinutes(startTime, duration || 60),
        }
      : null;
  }).filter((s): s is NonNullable<typeof s> => !!s);

  const set = <K extends keyof ReturnType<typeof emptyForm>>(key: K, value: ReturnType<typeof emptyForm>[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function submit() {
    if (!course) return flash({ type: 'err', text: 'Choose the course this class delivers.' });
    if (offerings.length && !offering) return flash({ type: 'err', text: 'Choose a language.' });
    if (!form.leadInstructorId) return flash({ type: 'err', text: 'Choose a lead instructor.' });
    if (!title.trim()) return flash({ type: 'err', text: 'Give the class a title.' });
    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) return flash({ type: 'err', text: 'Price must be 0 or more.' });
    if (!Number.isFinite(duration) || duration < 15 || duration > 600) {
      return flash({ type: 'err', text: 'Session length must be between 15 and 600 minutes.' });
    }
    if (sessions.length && new Date(sessions[0].startTime).getTime() <= Date.now()) {
      return flash({ type: 'err', text: 'The first session must be in the future.' });
    }

    const previewVideoUrl = course.officialPreviewUrl?.startsWith('https://') ? course.officialPreviewUrl : undefined;
    const payload = {
      title: title.trim(),
      description: course.description?.trim() || title.trim(),
      category: course.category || 'General',
      level: form.level,
      price,
      courseId: course.id,
      languageOfferingId: offering?.id,
      leadInstructorId: form.leadInstructorId,
      duration,
      totalSessions: sessions.length,
      timezone: form.timezone,
      status: form.status,
      startDate: sessions[0]?.startTime,
      endDate: sessions[sessions.length - 1]?.endTime,
      learningOutcomes: course.outcomes || [],
      details: {
        outcomes: course.outcomes || [],
        curriculum,
        ...(previewVideoUrl ? { previewVideoUrl } : {}),
        ...(course.certificateNotes ? { certificateInfo: course.certificateNotes } : {}),
      },
      schedule: sessions.length ? sessions : undefined,
    };

    setBusy(true);
    const res = await run(() => apiClient.post('/classes', payload), { success: 'Class created' });
    setBusy(false);
    const id = (res as { data?: { data?: { id?: string } } } | undefined)?.data?.data?.id;
    if (id) {
      onClose();
      onCreated(id);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      eyebrow="Schedule a cohort"
      title="New class"
      subtitle="Classes deliver a Nexnoon course in one language, led by a certified instructor."
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={btn.primary} disabled={busy} onClick={() => void submit()}>
            {busy ? 'Creating…' : form.status === 'published' ? 'Create & publish' : 'Create as draft'}
          </button>
        </>
      }
    >
      {!courses.length ? (
        <EmptyBlock
          text="Publish a course first. Every class must deliver a published course."
          action={
            <button type="button" className={btn.primary} onClick={() => { onClose(); goTo('courses'); }}>
              Go to courses
            </button>
          }
        />
      ) : (
        <div className="space-y-6">
          <section className="space-y-4">
            <SectionLabel>What & who</SectionLabel>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Course">
                <select
                  className={inputCls}
                  value={form.courseId}
                  onChange={(e) => setForm((f) => ({ ...f, courseId: e.target.value, languageOfferingId: '', leadInstructorId: '' }))}
                >
                  <option value="">Select course…</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Language" hint={course && !offerings.length ? 'This course has no language offerings yet.' : undefined}>
                <select
                  className={inputCls}
                  value={form.languageOfferingId}
                  disabled={!offerings.length}
                  onChange={(e) => set('languageOfferingId', e.target.value)}
                >
                  <option value="">{offerings.length ? 'Select language…' : '—'}</option>
                  {offerings.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Lead instructor"
                className="sm:col-span-2"
                hint={
                  course && !certified.length ? (
                    <span>
                      No approved instructor is certified for this course.{' '}
                      <button type="button" className="text-[#3a5f8a] hover:underline" onClick={() => { onClose(); goTo('instructors'); }}>
                        Certify one
                      </button>
                    </span>
                  ) : (
                    'Only instructors certified for the course can lead it.'
                  )
                }
              >
                <select
                  className={inputCls}
                  value={form.leadInstructorId}
                  disabled={!course}
                  onChange={(e) => set('leadInstructorId', e.target.value)}
                >
                  <option value="">{course ? 'Select instructor…' : 'Choose a course first'}</option>
                  {instructors.map((u) => {
                    const ok = isCertified(u, form.courseId);
                    return (
                      <option key={u.id} value={u.id} disabled={!ok}>
                        {u.fullName} · {u.email}
                        {ok ? '' : ' · not certified'}
                      </option>
                    );
                  })}
                </select>
              </Field>
            </div>
          </section>

          <section className="space-y-4">
            <SectionLabel>Class details</SectionLabel>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" className="sm:col-span-2">
                <input
                  className={inputCls}
                  value={title}
                  placeholder="e.g. Product Design Foundations (English)"
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value, titleTouched: true }))}
                />
              </Field>
              <Field label="Level">
                <select className={inputCls} value={form.level} onChange={(e) => set('level', e.target.value as (typeof LEVELS)[number])}>
                  {LEVELS.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </Field>
              <Field label="Price (USD)" hint={Number(form.price) > 0 ? money(Number(form.price)) : 'Free'}>
                <input className={inputCls} type="number" min={0} step="1" value={form.price} onChange={(e) => set('price', e.target.value)} />
              </Field>
              <Field label="Timezone" hint="All session times below are in this timezone.">
                <select className={inputCls} value={form.timezone} onChange={(e) => set('timezone', e.target.value)}>
                  {zones.map((z) => (
                    <option key={z}>{z}</option>
                  ))}
                </select>
              </Field>
              <Field label="Visibility">
                <select className={inputCls} value={form.status} onChange={(e) => set('status', e.target.value as 'draft' | 'published')}>
                  <option value="draft">Draft (hidden)</option>
                  <option value="published">Published (open for enrollment)</option>
                </select>
              </Field>
            </div>
          </section>

          <section className="space-y-4">
            <SectionLabel aside={<span className="text-xs text-[#7a8898]">Optional; you can add sessions later</span>}>Schedule</SectionLabel>
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="First session" className="sm:col-span-2">
                <input className={inputCls} type="datetime-local" value={form.firstSession} onChange={(e) => set('firstSession', e.target.value)} />
              </Field>
              <Field label="Length (min)">
                <input className={inputCls} type="number" min={15} max={600} step={15} value={form.duration} onChange={(e) => set('duration', e.target.value)} />
              </Field>
              <Field label="Sessions">
                <input
                  className={inputCls}
                  type="number"
                  min={1}
                  max={60}
                  value={form.sessionCount}
                  disabled={!form.firstSession}
                  onChange={(e) => set('sessionCount', e.target.value)}
                />
              </Field>
              <Field label="Repeat every" className="sm:col-span-2">
                <select className={inputCls} value={form.intervalDays} disabled={!form.firstSession} onChange={(e) => set('intervalDays', e.target.value)}>
                  <option value="1">Day</option>
                  <option value="2">2 days</option>
                  <option value="3">3 days</option>
                  <option value="7">Week</option>
                  <option value="14">2 weeks</option>
                </select>
              </Field>
            </div>
            {sessions.length ? (
              <ol className="max-h-56 divide-y divide-[#eef2f7] overflow-y-auto border border-[#e4ebf2] bg-[#f7f9fc] text-sm">
                {sessions.map((s) => (
                  <li key={s.sessionNumber} className="flex items-center gap-3 px-3 py-2">
                    <span className="w-6 text-right text-xs tabular-nums text-[#7a8898]">{s.sessionNumber}</span>
                    <span className="min-w-0 flex-1 truncate text-[#0b1220]">{s.title}</span>
                    <span className="shrink-0 text-xs text-[#5c6b7a]">{fmtInZone(s.startTime, form.timezone)}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </section>
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Teaching team                                                       */
/* ------------------------------------------------------------------ */

export function TeachingTeamPanel({ cls }: { cls: Class }) {
  const { data } = useAdmin();
  const run = useAdminAction();
  const [mode, setMode] = useState<'lead' | 'support' | null>(null);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const cancelled = !!cls.cancelledAt;

  const team = (cls.teachingTeam || []).filter((m) => m.status === 'accepted' || m.status === 'pending');
  const lead = team.find((m) => m.role === 'lead');
  const support = team.filter((m) => m.role === 'support');
  const onTeam = new Set([String(cls.instructor.id), ...team.map((m) => m.userId)]);
  const candidates = approvedInstructors(data.users).filter((u) => !onTeam.has(u.id) || (mode === 'lead' && support.some((s) => s.userId === u.id)));

  function openPicker(next: 'lead' | 'support') {
    setMode((m) => (m === next ? null : next));
    setPick('');
  }

  async function assign() {
    if (!pick || !mode) return;
    setBusy(mode);
    const res = await run(() => apiClient.post(`/classes/${cls.id}/${mode}`, { userId: pick }));
    setBusy(null);
    if (res) setMode(null);
  }

  async function remove(userId: string, name: string) {
    if (!window.confirm(`Remove ${name} from the teaching team?`)) return;
    setBusy(userId);
    await run(() => apiClient.post(`/classes/${cls.id}/instructors/remove`, { userId }), { success: `${name} removed` });
    setBusy(null);
  }

  return (
    <Panel bodyClassName="p-5">
      <SectionLabel
        aside={
          cancelled ? null : (
            <div className="flex gap-3">
              <button type="button" className={btn.link} onClick={() => openPicker('lead')}>
                <Crown className="h-3.5 w-3.5" /> Change lead
              </button>
              <button type="button" className={btn.link} disabled={support.length >= 2} onClick={() => openPicker('support')}>
                <UserPlus className="h-3.5 w-3.5" /> Add support
              </button>
            </div>
          )
        }
      >
        Teaching team
      </SectionLabel>

      <ul className="mt-3 space-y-2.5">
        <li className="flex items-center gap-3">
          <Avatar name={lead?.name || cls.instructor.name} src={lead?.avatar || cls.instructor.avatar} size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-[#0b1220]">{lead?.name || cls.instructor.name}</p>
            <p className="truncate text-xs text-[#7a8898]">{lead?.email || 'Lead instructor'}</p>
          </div>
          <Pill tone="ink">lead</Pill>
        </li>
        {support.map((m) => (
          <li key={m.userId} className="flex items-center gap-3">
            <Avatar name={m.name} src={m.avatar} size={32} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-[#0b1220]">{m.name}</p>
              <p className="truncate text-xs text-[#7a8898]">{m.email}</p>
            </div>
            <Pill tone="blue">support</Pill>
            {m.status === 'pending' ? <Pill tone="amber">invited</Pill> : null}
            {!cancelled && (
              <button
                type="button"
                disabled={busy === m.userId}
                onClick={() => void remove(m.userId, m.name)}
                className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                <UserMinus className="h-3.5 w-3.5" /> Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      {!support.length ? <p className="mt-2 text-xs text-[#7a8898]">No support instructors. A class can have up to 2.</p> : null}

      {mode ? (
        <div className="mt-4 border border-[#c9d6e6] bg-[#eef3f9] p-4">
          <p className="mb-2 text-sm font-medium text-[#0b1220]">
            {mode === 'lead' ? 'Assign a new lead instructor' : 'Add a support instructor'}
          </p>
          <p className="mb-3 text-xs text-[#5c6b7a]">
            {mode === 'lead'
              ? 'The current lead is removed from the class. Upcoming sessions must not clash with the new lead’s schedule. Learners are notified.'
              : 'Support instructors are added straight away and get an in-app notification.'}
            {cls.courseId ? ' Only instructors certified for this course can be picked.' : ''}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select className={inputCls} value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Select instructor…</option>
              {candidates.map((u) => {
                const ok = isCertified(u, cls.courseId);
                return (
                  <option key={u.id} value={u.id} disabled={!ok}>
                    {u.fullName} · {u.email}
                    {ok ? '' : ' · not certified'}
                  </option>
                );
              })}
            </select>
            <div className="flex shrink-0 gap-2">
              <button type="button" className={btn.secondary} onClick={() => setMode(null)}>
                Cancel
              </button>
              <button type="button" className={btn.primary} disabled={!pick || !!busy} onClick={() => void assign()}>
                {busy ? 'Saving…' : mode === 'lead' ? 'Make lead' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

const durationMin = (s: ClassSchedule) => Math.round((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60_000);

export function SessionsPanel({ cls }: { cls: Class }) {
  const qc = useQueryClient();
  const run = useAdminAction();
  const tz = cls.timezone || browserTimeZone();
  const localTz = browserTimeZone();
  const cancelled = !!cls.cancelledAt;
  const key = ['admin-class-schedule', cls.id];

  const schedule = useQuery<ClassSchedule[]>({
    queryKey: key,
    queryFn: async () => (await apiClient.get(`/classes/${cls.id}/schedule`)).data.data,
    staleTime: 0,
  });
  const sessions = [...(schedule.data || [])].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const nextNumber = Math.max(0, ...(schedule.data || []).map((s) => s.sessionNumber)) + 1;

  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit] = useState({ start: '', minutes: '60' });
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: '', start: '', minutes: String(cls.duration || 60) });
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: key });

  function startEdit(s: ClassSchedule) {
    setEditing(s.id);
    setEdit({ start: isoToZonedInput(s.startTime, tz), minutes: String(durationMin(s)) });
  }

  async function reschedule(s: ClassSchedule) {
    const startTime = zonedInputToIso(edit.start, tz);
    const minutes = Number(edit.minutes);
    if (!startTime || !minutes || minutes < 15) return;
    setBusy(s.id);
    const res = await run(() => apiClient.patch(`/classes/${cls.id}/schedule/${s.id}`, { startTime, endTime: addMinutes(startTime, minutes) }));
    setBusy(null);
    if (res) {
      setEditing(null);
      await refresh();
    }
  }

  async function cancelSession(s: ClassSchedule) {
    if (!window.confirm(`Cancel "${s.title}"? Enrolled learners will be notified.`)) return;
    setBusy(s.id);
    await run(() => apiClient.patch(`/classes/${cls.id}/schedule/${s.id}`, { status: 'cancelled' }), { success: 'Session cancelled' });
    setBusy(null);
    await refresh();
  }

  async function addSession() {
    const startTime = zonedInputToIso(draft.start, tz);
    const minutes = Number(draft.minutes);
    if (!startTime || !minutes || minutes < 15) return;
    setBusy('new');
    const res = await run(() =>
      apiClient.post(`/classes/${cls.id}/schedule`, {
        sessionNumber: nextNumber,
        title: draft.title.trim() || `Session ${nextNumber}`,
        startTime,
        endTime: addMinutes(startTime, minutes),
      })
    );
    setBusy(null);
    if (res) {
      setAdding(false);
      setDraft({ title: '', start: '', minutes: String(cls.duration || 60) });
      await refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#5c6b7a]">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" /> Times in <strong className="font-medium text-[#0b1220]">{tz}</strong>
          {!cls.timezone ? ' (class has no timezone; using yours)' : ''}
        </span>
        <div className="flex gap-2">
          <button type="button" className={btn.secondary} onClick={() => void refresh()} aria-label="Reload sessions">
            <RefreshCw className={`h-3.5 w-3.5 ${schedule.isFetching ? 'animate-spin' : ''}`} />
          </button>
          {!cancelled && (
            <button type="button" className={btn.primary} onClick={() => setAdding((v) => !v)}>
              <CalendarPlus className="h-3.5 w-3.5" /> Add session
            </button>
          )}
        </div>
      </div>

      {adding ? (
        <Panel bodyClassName="p-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Title" className="sm:col-span-2">
              <input className={inputCls} value={draft.title} placeholder={`Session ${nextNumber}`} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </Field>
            <Field label={`Start (${tz})`}>
              <input className={inputCls} type="datetime-local" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
            </Field>
            <Field label="Length (min)">
              <input className={inputCls} type="number" min={15} step={15} value={draft.minutes} onChange={(e) => setDraft({ ...draft, minutes: e.target.value })} />
            </Field>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" className={btn.secondary} onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button type="button" className={btn.primary} disabled={!draft.start || busy === 'new'} onClick={() => void addSession()}>
              {busy === 'new' ? 'Scheduling…' : 'Schedule & notify learners'}
            </button>
          </div>
        </Panel>
      ) : null}

      <Panel bodyClassName="">
        {schedule.isLoading ? (
          <p className="p-5 text-sm text-[#5c6b7a]">Loading sessions…</p>
        ) : schedule.isError ? (
          <p className="p-5 text-sm text-rose-700">Couldn’t load sessions.</p>
        ) : !sessions.length ? (
          <div className="p-5">
            <EmptyBlock text="No sessions scheduled yet." />
          </div>
        ) : (
          <ul className="divide-y divide-[#eef2f7]">
            {sessions.map((s) => {
              const future = new Date(s.startTime).getTime() > Date.now();
              const editable = !cancelled && s.status === 'scheduled' && future;
              return (
                <li key={s.id} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-right text-xs tabular-nums text-[#7a8898]">{s.sessionNumber}</span>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-medium ${s.status === 'cancelled' ? 'text-[#9aa7b5] line-through' : 'text-[#0b1220]'}`}>{s.title}</p>
                      <p className="text-xs text-[#5c6b7a]">
                        {fmtInZone(s.startTime, tz)} · {durationMin(s)} min
                        {tz !== localTz ? <span className="text-[#9aa7b5]"> · {fmtInZone(s.startTime, localTz)} your time</span> : null}
                      </p>
                    </div>
                    {s.meetingCreationStatus === 'failed' ? (
                      <span title="Zoom meeting could not be created" className="text-amber-600">
                        <Video className="h-4 w-4" />
                      </span>
                    ) : null}
                    <Pill tone={s.status === 'cancelled' ? 'rose' : statusToneOf(s.status)}>{s.status}</Pill>
                    {editable && (
                      <div className="flex gap-1">
                        <button type="button" className="px-2 py-1.5 text-xs text-[#3a5f8a] hover:bg-[#eef3f9]" onClick={() => (editing === s.id ? setEditing(null) : startEdit(s))}>
                          Reschedule
                        </button>
                        <button
                          type="button"
                          disabled={busy === s.id}
                          className="px-2 py-1.5 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                          onClick={() => void cancelSession(s)}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  {editing === s.id ? (
                    <div className="mt-3 flex flex-col gap-2 border border-[#c9d6e6] bg-[#eef3f9] p-3 sm:flex-row sm:items-end">
                      <Field label={`New start (${tz})`} className="flex-1">
                        <input className={inputCls} type="datetime-local" value={edit.start} onChange={(e) => setEdit({ ...edit, start: e.target.value })} />
                      </Field>
                      <Field label="Length (min)" className="sm:w-32">
                        <input className={inputCls} type="number" min={15} step={15} value={edit.minutes} onChange={(e) => setEdit({ ...edit, minutes: e.target.value })} />
                      </Field>
                      <div className="flex gap-2">
                        <button type="button" className={btn.secondary} onClick={() => setEditing(null)}>
                          Close
                        </button>
                        <button type="button" className={btn.primary} disabled={busy === s.id} onClick={() => void reschedule(s)}>
                          {busy === s.id ? 'Saving…' : 'Save & notify'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cancel class                                                        */
/* ------------------------------------------------------------------ */

export function CancelClassModal({ open, onClose, op }: { open: boolean; onClose: () => void; op?: ClassOp }) {
  const { data } = useAdmin();
  const run = useAdminAction();
  const [reason, setReason] = useState('');
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setReason('');
      setNotify(true);
    }
  }

  const paid = op ? data.payments.filter((p) => p.classId === op.id && p.status === 'completed') : [];
  const paidTotal = paid.reduce((s, p) => s + p.amount, 0);

  async function submit() {
    if (!op || reason.trim().length < 3) return;
    setBusy(true);
    const res = await run(() => apiClient.post(`/classes/${op.id}/cancel`, { reason: reason.trim(), notifyLearners: notify }));
    setBusy(false);
    if (res) onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      eyebrow="Cancel class"
      title={op?.title || 'Cancel class'}
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose}>
            Keep class
          </button>
          <button
            type="button"
            className={`${btn.danger} border-rose-600 bg-rose-600 text-white hover:bg-rose-700`}
            disabled={busy || reason.trim().length < 3}
            onClick={() => void submit()}
          >
            <XCircle className="h-4 w-4" /> {busy ? 'Cancelling…' : 'Cancel class'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-3 border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            <p>The class is archived and every upcoming session is cancelled. This can’t be undone.</p>
            <p>
              {op?.enrolledStudents ?? 0} enrolled learner{op?.enrolledStudents === 1 ? '' : 's'} and the teaching team will be told.
            </p>
            {paid.length ? (
              <p className="font-medium">
                {paid.length} paid enrollment{paid.length === 1 ? '' : 's'} ({money(paidTotal, op?.currency)}). Refunds are not automatic; issue them in Stripe.
              </p>
            ) : null}
          </div>
        </div>
        <Field label="Reason (shared with learners)">
          <textarea
            className={`${inputCls} min-h-[96px]`}
            value={reason}
            maxLength={1000}
            placeholder="e.g. The instructor is unavailable and we couldn’t find a replacement in time."
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-[#0b1220]">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          Email and notify enrolled learners
        </label>
      </div>
    </Modal>
  );
}
