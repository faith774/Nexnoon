import { useState } from 'react';
import { AlertTriangle, BadgeCheck, CalendarClock, Check, History, Video } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { useAdmin, useAdminAction } from './context';
import { ApplicantPanel } from './Panels';
import type { Account, Certification, InstructorStat, LifecycleStage } from './types';
import {
  DetailGrid,
  Drawer,
  EmptyBlock,
  Field,
  Modal,
  Panel,
  Pill,
  SectionLabel,
  SegmentedTabs,
  StatTile,
  btn,
  fmtDate,
  fmtDateTime,
  inputCls,
  scoreToneOf,
  statusToneOf,
  useSticky,
  type Tone,
} from './ui';

/* ------------------------------------------------------------------ */
/* Stage metadata                                                      */
/* ------------------------------------------------------------------ */

export const STAGE_LABEL: Record<LifecycleStage, string> = {
  applied: 'Applied',
  review: 'In review',
  interview: 'Interview',
  training: 'Training',
  certified: 'Certified',
  active: 'Active',
  improvement: 'Improvement plan',
  suspended: 'Suspended',
  removed: 'Removed',
  rejected: 'Rejected',
};

export const STAGE_TONE: Record<LifecycleStage, Tone> = {
  applied: 'amber',
  review: 'amber',
  interview: 'blue',
  training: 'blue',
  certified: 'green',
  active: 'green',
  improvement: 'orange',
  suspended: 'orange',
  removed: 'rose',
  rejected: 'rose',
};

export const stageOf = (u: Account): LifecycleStage =>
  u.lifecycle?.stage ||
  (u.instructorStatus === 'approved' ? 'active' : u.instructorStatus === 'suspended' ? 'suspended' : u.instructorStatus === 'rejected' ? 'rejected' : 'applied');

const PIPELINE: { id: LifecycleStage; label: string }[] = [
  { id: 'applied', label: 'Apply' },
  { id: 'review', label: 'Review' },
  { id: 'interview', label: 'Interview' },
  { id: 'training', label: 'Train' },
  { id: 'certified', label: 'Certify' },
  { id: 'active', label: 'Teach' },
];

export type LifecycleAction =
  | 'start_review'
  | 'schedule_interview'
  | 'interview_pass'
  | 'interview_fail'
  | 'complete_training'
  | 'certify'
  | 'renew'
  | 'improve'
  | 'complete_improvement'
  | 'suspend'
  | 'reinstate'
  | 'remove';

const ACTION_META: Record<
  LifecycleAction,
  { label: string; tone: 'primary' | 'secondary' | 'danger'; note?: 'required' | 'optional'; date?: 'datetime' | 'date'; dateLabel?: string; help: string }
> = {
  start_review: { label: 'Start review', tone: 'secondary', note: 'optional', help: 'Move the application into your review queue.' },
  schedule_interview: {
    label: 'Schedule interview',
    tone: 'primary',
    note: 'optional',
    date: 'datetime',
    dateLabel: 'Interview time (your timezone)',
    help: 'The applicant gets an in-app notification and email with the time.',
  },
  interview_pass: { label: 'Interview passed', tone: 'primary', note: 'optional', help: 'Records the assessment result. Next: training.' },
  interview_fail: { label: 'Reject', tone: 'danger', note: 'required', help: 'Rejects the application. The applicant is emailed.' },
  complete_training: { label: 'Training complete', tone: 'primary', note: 'optional', help: 'Confirms the instructor finished Nexnoon methods & curriculum training.' },
  certify: {
    label: 'Certify to teach',
    tone: 'primary',
    note: 'optional',
    date: 'date',
    dateLabel: 'Next performance review (default: 12 months)',
    help: 'Grants teaching access. You still choose which course × language pairs they can teach.',
  },
  renew: {
    label: 'Renew',
    tone: 'primary',
    note: 'optional',
    date: 'date',
    dateLabel: 'Next review due (default: 12 months)',
    help: 'Keep them on the roster and close any improvement plan.',
  },
  improve: {
    label: 'Improvement plan',
    tone: 'secondary',
    note: 'required',
    date: 'date',
    dateLabel: 'Review by (default: 30 days)',
    help: 'They keep teaching while working on the points you write here. They are notified.',
  },
  complete_improvement: { label: 'Close improvement plan', tone: 'primary', note: 'optional', help: 'Marks the plan as met.' },
  suspend: { label: 'Suspend', tone: 'danger', note: 'required', help: 'Blocks teaching until reinstated. Certifications are kept.' },
  reinstate: { label: 'Reinstate', tone: 'primary', note: 'optional', help: 'Restores teaching access.' },
  remove: {
    label: 'Remove from roster',
    tone: 'danger',
    note: 'required',
    help: 'Revokes all course certifications and teaching access. Classes they lead must be reassigned.',
  },
};

function actionsFor(u: Account): LifecycleAction[] {
  const stage = stageOf(u);
  const lc = u.lifecycle;
  const status = u.instructorStatus;
  if (status === 'pending') {
    const out: LifecycleAction[] = [];
    if (stage === 'applied') out.push('start_review');
    if (lc?.interview?.result !== 'pass') out.push('schedule_interview', 'interview_pass');
    if (lc?.interview?.result === 'pass' && !lc.trainingCompletedAt) out.push('complete_training');
    if (lc?.interview?.result === 'pass' && lc.trainingCompletedAt) out.push('certify');
    out.push('interview_fail');
    return out;
  }
  if (status === 'approved') return [...(stage === 'improvement' ? (['complete_improvement'] as LifecycleAction[]) : []), 'renew', 'improve', 'suspend', 'remove'];
  if (status === 'suspended' && stage !== 'removed') return ['reinstate', 'remove'];
  return [];
}

/* ------------------------------------------------------------------ */
/* Lifecycle action modal                                              */
/* ------------------------------------------------------------------ */

export function LifecycleActionModal({ user, action, onClose }: { user: Account | null; action: LifecycleAction | null; onClose: () => void }) {
  const run = useAdminAction();
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  const k = user && action ? `${user.id}:${action}` : null;
  if (k !== key) {
    setKey(k);
    setNote('');
    setDate('');
  }
  const shown = useSticky(user && action ? { user, action } : null);
  const meta = shown ? ACTION_META[shown.action] : null;

  async function submit() {
    if (!shown || !meta) return;
    if (meta.note === 'required' && !note.trim()) return;
    if (shown.action === 'schedule_interview' && !date) return;
    const iso = date ? new Date(meta.date === 'date' ? `${date}T12:00:00` : date).toISOString() : undefined;
    setBusy(true);
    const res = await run(() => apiClient.post(`/admin/instructors/${shown.user.id}/lifecycle`, { action: shown.action, note: note.trim() || undefined, date: iso }));
    setBusy(false);
    if (res) onClose();
  }

  const danger = meta?.tone === 'danger';
  return (
    <Modal
      open={!!user && !!action}
      onClose={onClose}
      size="sm"
      eyebrow={shown?.user.fullName}
      title={meta?.label || ''}
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={danger ? `${btn.danger} border-rose-600 bg-rose-600 text-white hover:bg-rose-700` : btn.primary}
            disabled={busy || (meta?.note === 'required' && !note.trim()) || (shown?.action === 'schedule_interview' && !date)}
            onClick={() => void submit()}
          >
            {busy ? 'Saving…' : meta?.label}
          </button>
        </>
      }
    >
      {meta ? (
        <div className="space-y-4">
          <p className="text-sm text-[#5c6b7a]">{meta.help}</p>
          {meta.date ? (
            <Field label={meta.dateLabel || 'Date'}>
              <input className={inputCls} type={meta.date === 'datetime' ? 'datetime-local' : 'date'} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          ) : null}
          {meta.note ? (
            <Field label={meta.note === 'required' ? 'Note (shared with the instructor)' : 'Note (optional)'}>
              <textarea className={`${inputCls} min-h-[96px]`} maxLength={3000} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Drawer                                                              */
/* ------------------------------------------------------------------ */

type Tab = 'lifecycle' | 'certifications' | 'performance' | 'application';

export function InstructorDrawer({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const { data, flash, goTo } = useAdmin();
  const [tab, setTab] = useState<Tab>('lifecycle');
  const [action, setAction] = useState<LifecycleAction | null>(null);
  const [lastId, setLastId] = useState(userId);
  if (userId !== lastId) {
    setLastId(userId);
    if (userId) setTab('lifecycle');
  }
  const shownId = useSticky(userId);
  const user = (data.users || []).find((u) => u.id === shownId);
  const stats = (data.instructorStats || []).find((s) => s.id === shownId);
  const stage = user ? stageOf(user) : null;

  return (
    <>
      <Drawer
        open={!!userId && !!user}
        onClose={onClose}
        width="max-w-3xl"
        eyebrow="Instructor"
        title={user?.fullName}
        subtitle={
          user && stage ? (
            <span className="flex flex-wrap items-center gap-2">
              <Pill tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</Pill>
              <span>{user.email}</span>
            </span>
          ) : null
        }
        headerExtra={
          <div className="mt-4">
            <SegmentedTabs
              value={tab}
              onChange={setTab}
              tabs={[
                { id: 'lifecycle', label: 'Lifecycle' },
                { id: 'certifications', label: 'Certifications', count: (user?.certifications || []).filter((c) => c.status === 'active').length },
                { id: 'performance', label: 'Performance' },
                { id: 'application', label: 'Application' },
              ]}
            />
          </div>
        }
      >
        {user ? (
          <div className="space-y-5">
            {tab === 'lifecycle' && <LifecycleTab user={user} onAction={setAction} />}
            {tab === 'certifications' && <CertificationsTab user={user} />}
            {tab === 'performance' && <PerformanceTab stats={stats} onOpenQuality={() => { onClose(); goTo('quality'); }} />}
            {tab === 'application' && <ApplicantPanel account={user} courses={data.courses || []} onFlash={flash} />}
          </div>
        ) : null}
      </Drawer>
      <LifecycleActionModal user={action ? user || null : null} action={action} onClose={() => setAction(null)} />
    </>
  );
}

function LifecycleTab({ user, onAction }: { user: Account; onAction: (a: LifecycleAction) => void }) {
  const stage = stageOf(user);
  const lc = user.lifecycle;
  const reached = PIPELINE.findIndex((p) => p.id === (stage === 'improvement' ? 'active' : stage));
  const offTrack = ['suspended', 'removed', 'rejected'].includes(stage);
  const actions = actionsFor(user);
  const reviewOverdue = lc?.reviewDueAt && new Date(lc.reviewDueAt).getTime() < Date.now();

  return (
    <>
      <Panel bodyClassName="p-5">
        <ol className="flex flex-wrap items-center gap-y-3">
          {PIPELINE.map((p, i) => {
            const done = !offTrack && reached >= i;
            return (
              <li key={p.id} className="flex items-center">
                <span
                  className={`flex h-7 items-center gap-1.5 px-2.5 text-xs font-medium ${
                    done ? 'bg-[#0b1220] text-white' : 'border border-[#d0dae6] bg-white text-[#7a8898]'
                  }`}
                >
                  {done ? <Check className="h-3 w-3" /> : <span className="tabular-nums">{i + 1}</span>}
                  {p.label}
                </span>
                {i < PIPELINE.length - 1 ? <span className={`mx-1 h-px w-4 ${done ? 'bg-[#0b1220]' : 'bg-[#d0dae6]'}`} /> : null}
              </li>
            );
          })}
        </ol>
        {offTrack ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-rose-800">
            <AlertTriangle className="h-4 w-4" /> {STAGE_LABEL[stage]}. This instructor cannot teach.
          </p>
        ) : null}
        {stage === 'improvement' && lc?.improvementPlan ? (
          <div className="mt-4 border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
            <p className="font-medium">Improvement plan · review by {fmtDate(lc.improvementPlan.dueAt)}</p>
            <p className="mt-1 whitespace-pre-line">{lc.improvementPlan.notes}</p>
          </div>
        ) : null}
        <div className="mt-5">
          <DetailGrid
            cols={3}
            items={[
              {
                label: 'Interview',
                value: lc?.interview?.result
                  ? `${lc.interview.result === 'pass' ? 'Passed' : 'Failed'} · ${fmtDate(lc.interview.decidedAt)}`
                  : lc?.interview?.scheduledAt
                    ? `Scheduled ${fmtDateTime(lc.interview.scheduledAt)}`
                    : '—',
              },
              { label: 'Training', value: lc?.trainingCompletedAt ? `Completed ${fmtDate(lc.trainingCompletedAt)}` : '—' },
              {
                label: 'Next review',
                value: lc?.reviewDueAt ? (
                  <span className={reviewOverdue ? 'text-rose-700' : ''}>
                    {fmtDate(lc.reviewDueAt)}
                    {reviewOverdue ? ' · overdue' : ''}
                  </span>
                ) : (
                  '—'
                ),
              },
            ]}
          />
        </div>
        {actions.length ? (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-[#e4ebf2] pt-4">
            {actions.map((a) => {
              const meta = ACTION_META[a];
              return (
                <button key={a} type="button" className={btn[meta.tone]} onClick={() => onAction(a)}>
                  {a === 'schedule_interview' ? <CalendarClock className="h-3.5 w-3.5" /> : a === 'certify' ? <BadgeCheck className="h-3.5 w-3.5" /> : null}
                  {meta.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </Panel>

      <ZoomHostPanel user={user} />

      <Panel bodyClassName="p-5">
        <SectionLabel>
          <span className="inline-flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" /> History
          </span>
        </SectionLabel>
        {lc?.history?.length ? (
          <ol className="mt-3 space-y-3">
            {lc.history.map((h, i) => (
              <li key={i} className="border-l-2 border-[#d0dae6] pl-3 text-sm">
                <p className="text-[#0b1220]">
                  <span className="font-medium capitalize">{h.action.replace(/_/g, ' ')}</span>
                  <span className="text-[#7a8898]"> · {fmtDateTime(h.at)}{h.byName ? ` · ${h.byName}` : ''}</span>
                </p>
                {h.note ? <p className="mt-0.5 whitespace-pre-line text-[#5c6b7a]">{h.note}</p> : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-[#7a8898]">No lifecycle events recorded yet.</p>
        )}
      </Panel>
    </>
  );
}

function ZoomHostPanel({ user }: { user: Account }) {
  const run = useAdminAction();
  const [email, setEmail] = useState(user.zoomEmail || '');
  const [enabled, setEnabled] = useState(!!user.zoomHostEnabled);
  const [busy, setBusy] = useState(false);
  const dirty = email.trim().toLowerCase() !== (user.zoomEmail || '') || enabled !== !!user.zoomHostEnabled;

  async function save() {
    setBusy(true);
    await run(() => apiClient.patch(`/admin/instructors/${user.id}/zoom-host`, { zoomEmail: email.trim(), zoomHostEnabled: enabled }));
    setBusy(false);
  }

  return (
    <Panel bodyClassName="p-5">
      <SectionLabel>
        <span className="inline-flex items-center gap-1.5">
          <Video className="h-3.5 w-3.5" /> Zoom host
        </span>
      </SectionLabel>
      <p className="mt-2 max-w-xl text-sm text-[#5c6b7a]">
        {user.zoomHostEnabled
          ? `New meetings are hosted under ${user.zoomEmail}, so this instructor's classes can run at the same time as others'.`
          : 'Meetings use the shared Nexnoon Zoom user, which can only host one meeting at a time across all instructors. Map a licensed Zoom user from your account to lift that limit.'}
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Field label="Zoom account email">
          <input className={`${inputCls} w-72`} type="email" value={email} placeholder="name@yourzoomaccount.com" onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <label className="flex h-10 items-center gap-2 text-sm text-[#0b1220]">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Host their meetings under this user
        </label>
        <button type="button" className={btn.primary} disabled={!dirty || busy} onClick={save}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
      <p className="mt-2 text-xs text-[#7a8898]">Applies to meetings created from now on. Existing sessions keep their current host.</p>
    </Panel>
  );
}

const CERT_TONE: Record<Certification['status'], Tone> = { active: 'green', expired: 'amber', suspended: 'orange', revoked: 'slate' };

function CertificationsTab({ user }: { user: Account }) {
  const { data } = useAdmin();
  const run = useAdminAction();
  const [busy, setBusy] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState('');
  const courses = (data.courses || []).filter((c) => c.status !== 'archived');
  const certs = user.certifications || [];
  const canGrant = user.instructorStatus === 'approved';

  async function grant(courseId: string, languageOfferingIds: string[]) {
    const key = `${courseId}:${languageOfferingIds.join(',')}`;
    setBusy(key);
    await run(() =>
      apiClient.post(`/admin/instructors/${user.id}/certifications`, {
        courseId,
        languageOfferingIds,
        expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
      })
    );
    setBusy(null);
  }

  async function setStatus(cert: Certification, status: 'active' | 'suspended' | 'revoked', label: string) {
    if (status !== 'active' && !window.confirm(`${label}? ${user.fullName} can no longer be assigned to these classes.`)) return;
    setBusy(cert.id);
    await run(() => apiClient.patch(`/admin/instructors/${user.id}/certifications/${cert.id}`, { status }));
    setBusy(null);
  }

  if (!courses.length) return <EmptyBlock text="Create a course first." />;

  return (
    <>
      {!canGrant ? (
        <div className="flex gap-2 border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Certify this instructor in the Lifecycle tab before granting course permissions.
        </div>
      ) : (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="max-w-md text-sm text-[#5c6b7a]">
            Teaching permission is <strong className="font-medium text-[#0b1220]">instructor × course × language</strong>. They can only lead or support classes
            matching an active certification.
          </p>
          <Field label="New grants expire (optional)">
            <input className={`${inputCls} w-44`} type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </Field>
        </div>
      )}

      <Panel bodyClassName="">
        <ul className="divide-y divide-[#eef2f7]">
          {courses.map((course) => {
            const offerings = (course.languageOfferings || []).filter((o) => o.status !== 'inactive');
            const courseCerts = certs.filter((c) => c.courseId === course.id);
            const legacy = courseCerts.find((c) => !c.languageOfferingId && c.status !== 'revoked');
            const slots = offerings.length ? offerings.map((o) => ({ id: o.id, label: o.label })) : [{ id: '', label: 'All sessions (no languages yet)' }];
            return (
              <li key={course.id} className="px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-[#0b1220]">{course.title}</p>
                  {course.status !== 'published' ? <Pill tone="slate">{course.status}</Pill> : null}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {legacy ? (
                    <span className="inline-flex items-center gap-1.5 border border-[#d0dae6] bg-[#f7f9fc] px-2.5 py-1 text-xs">
                      <Pill tone={CERT_TONE[legacy.status]}>{legacy.status}</Pill>
                      All languages (legacy)
                      {legacy.status === 'active' ? (
                        <button type="button" disabled={busy === legacy.id} className="text-rose-700 hover:underline" onClick={() => void setStatus(legacy, 'revoked', 'Revoke')}>
                          revoke
                        </button>
                      ) : null}
                    </span>
                  ) : null}
                  {slots.map((slot) => {
                    const cert = courseCerts.find((c) => (c.languageOfferingId || '') === slot.id && (slot.id || !legacy));
                    const active = cert?.status === 'active';
                    const key = `${course.id}:${slot.id}`;
                    return (
                      <div
                        key={slot.id || 'course'}
                        className={`flex items-center gap-2 border px-2.5 py-1.5 text-xs ${active ? 'border-emerald-300 bg-emerald-50' : 'border-[#d0dae6] bg-white'}`}
                      >
                        <span className="font-medium text-[#0b1220]">{slot.label}</span>
                        {cert ? <Pill tone={CERT_TONE[cert.status]}>{cert.status}</Pill> : null}
                        {cert?.expiresAt ? <span className="text-[#7a8898]">until {fmtDate(cert.expiresAt)}</span> : null}
                        {active ? (
                          <>
                            <button type="button" disabled={busy === cert!.id} className="text-orange-700 hover:underline" onClick={() => void setStatus(cert!, 'suspended', 'Suspend this certification')}>
                              suspend
                            </button>
                            <button type="button" disabled={busy === cert!.id} className="text-rose-700 hover:underline" onClick={() => void setStatus(cert!, 'revoked', 'Revoke this certification')}>
                              revoke
                            </button>
                          </>
                        ) : canGrant ? (
                          <button
                            type="button"
                            disabled={busy === key}
                            className="font-medium text-[#3a5f8a] hover:underline"
                            onClick={() => void grant(course.id, slot.id ? [slot.id] : [])}
                          >
                            {cert ? 'reactivate' : 'certify'}
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>
    </>
  );
}

function PerformanceTab({ stats, onOpenQuality }: { stats?: InstructorStat; onOpenQuality: () => void }) {
  if (!stats) return <EmptyBlock text="No performance data yet." />;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Quality score" value={<Pill tone={scoreToneOf(stats.qualityScore)} className="text-base">{stats.qualityScore}</Pill>} />
        <StatTile label="Rating" value={stats.reviewsCount ? `${stats.avgRating.toFixed(1)}★` : '—'} hint={`${stats.reviewsCount} reviews`} />
        <StatTile label="Attendance" value={`${stats.attendanceRate}%`} hint={`${stats.heldSessions ?? 0} sessions held`} />
        <StatTile label="Completion" value={`${stats.completionRate}%`} hint={stats.completionBasis === 'progress' ? 'avg progress so far' : 'finished cohorts'} />
        <StatTile label="Dropout" value={`${stats.dropoutRate ?? 0}%`} hint={`${stats.dropped ?? 0} dropped`} tone={(stats.dropoutRate ?? 0) > 20 ? 'warn' : undefined} />
        <StatTile label="Satisfaction" value={stats.reviewsCount ? `${stats.satisfaction ?? 0}%` : '—'} hint={`${stats.feedbackCount ?? 0} written`} />
        <StatTile label="Open incidents" value={stats.incidentsOpen ?? 0} hint={`${stats.incidentsTotal ?? 0} total`} tone={(stats.incidentsOpen ?? 0) > 0 ? 'warn' : undefined} />
        <StatTile label="Classes" value={stats.classesTaught} hint={`${stats.classesLed ?? 0} as lead`} />
      </div>
      <button type="button" className={btn.link} onClick={onOpenQuality}>
        Open quality dashboard
      </button>
      <p className="text-xs text-[#7a8898]">
        Status: <Pill tone={statusToneOf(stats.instructorStatus)}>{stats.instructorStatus}</Pill>
      </p>
    </>
  );
}
