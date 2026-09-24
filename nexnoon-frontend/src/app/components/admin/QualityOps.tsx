import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertOctagon, BarChart3, Eye, EyeOff, Flag, Plus, Star, Target, Trash2 } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { useAdmin, useAdminAction } from './context';
import { DEFAULT_WEIGHTS } from './PlatformSections';
import { LifecycleActionModal, STAGE_LABEL, STAGE_TONE, type LifecycleAction } from './InstructorOps';
import type { Incident, InstructorStat, ModeratedReview } from './types';
import {
  EmptyBlock,
  ExportButton,
  Field,
  FilterChips,
  Modal,
  Pagination,
  Panel,
  Pill,
  SectionLabel,
  SegmentedTabs,
  StatTile,
  btn,
  fmtDate,
  fmtDateTime,
  inputCls,
  matches,
  money,
  scoreToneOf,
  useSticky,
  usePagination,
  type Tone,
} from './ui';

/* ------------------------------------------------------------------ */
/* Quality dashboard                                                   */
/* ------------------------------------------------------------------ */

type QualityFilter = 'all' | 'risk' | 'review' | 'improvement';

const atRisk = (r: InstructorStat) =>
  (r.reviewsCount > 0 && r.qualityScore < 60) || (r.incidentsHighOpen ?? 0) > 0 || (r.dropoutRate ?? 0) >= 25 || (r.heldSessions ? r.attendanceRate < 60 : false);
const reviewDue = (r: InstructorStat) => !!r.reviewDueAt && new Date(r.reviewDueAt).getTime() < Date.now() + 30 * 86400000;

export function QualitySection() {
  const [tab, setTab] = useState<'scoreboard' | 'incidents'>('scoreboard');
  const incidents = useIncidents();
  const openCount = (incidents.data || []).filter((i) => i.status === 'open' || i.status === 'investigating').length;
  return (
    <div className="space-y-5">
      <SegmentedTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'scoreboard', label: 'Instructor scoreboard' },
          { id: 'incidents', label: 'Incidents', count: openCount },
        ]}
      />
      {tab === 'scoreboard' ? <Scoreboard /> : <IncidentsPanel />}
    </div>
  );
}

function Scoreboard() {
  const { data, search, flash } = useAdmin();
  const run = useAdminAction();
  const [filter, setFilter] = useState<QualityFilter>('all');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<{ userId: string; action: LifecycleAction } | null>(null);
  const w = data.settings?.qualityWeights || DEFAULT_WEIGHTS;
  const all = data.instructorStats || [];
  const inFilter = (r: InstructorStat, f: QualityFilter) =>
    f === 'all' || (f === 'risk' && atRisk(r)) || (f === 'review' && reviewDue(r)) || (f === 'improvement' && r.lifecycleStage === 'improvement');
  const rows = all
    .filter((r) => inFilter(r, filter))
    .filter((r) => matches(search, r.fullName, r.email))
    .sort((a, b) => b.qualityScore - a.qualityScore);
  const pager = usePagination(rows, 10, `${filter}|${search}`);
  const pendingUser = pending ? (data.users || []).find((u) => u.id === pending.userId) || null : null;

  const rated = all.filter((r) => r.reviewsCount > 0);
  const avg = (vals: number[]) => (vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0);
  const withSessions = all.filter((r) => (r.heldSessions ?? 0) > 0);

  async function save(id: string, raw: string) {
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      flash({ type: 'err', text: 'Admin evaluation must be a number from 0 to 100.' });
      return;
    }
    setBusy(id);
    const res = await run(() => apiClient.patch(`/data/admin/instructors/${id}/evaluation`, { adminEvaluation: value }));
    setBusy(null);
    if (res)
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Avg quality score" value={avg(all.filter((r) => r.classesTaught > 0).map((r) => r.qualityScore)) || '—'} />
        <StatTile label="Avg rating" value={rated.length ? `${(rated.reduce((s, r) => s + r.avgRating, 0) / rated.length).toFixed(1)}★` : '—'} />
        <StatTile label="Attendance" value={withSessions.length ? `${avg(withSessions.map((r) => r.attendanceRate))}%` : '—'} />
        <StatTile label="Dropout" value={`${avg(all.filter((r) => r.totalStudents > 0).map((r) => r.dropoutRate ?? 0))}%`} />
        <StatTile label="At risk" value={all.filter(atRisk).length} tone={all.some(atRisk) ? 'warn' : undefined} onClick={() => setFilter('risk')} />
      </div>

      <Panel
        title="Instructor quality"
        subtitle={`Score = rating ${w.learnerRating}% · completion ${w.completion}% · attendance ${w.attendance}% · feedback ${w.feedback}% · admin ${w.adminEvaluation}%. Open incidents reduce it.`}
        icon={<Star className="h-4 w-4" />}
        actions={
          <ExportButton
            filename="instructor-quality"
            rows={() =>
              rows.map((r) => ({
                instructor: r.fullName,
                email: r.email,
                stage: r.lifecycleStage ? STAGE_LABEL[r.lifecycleStage] : r.instructorStatus,
                quality_score: r.qualityScore,
                admin_evaluation: r.adminEvaluation ?? '',
                avg_rating: r.avgRating,
                reviews: r.reviewsCount,
                satisfaction_pct: r.satisfaction ?? '',
                written_feedback: r.feedbackCount ?? '',
                completion_pct: r.completionRate,
                attendance_pct: r.attendanceRate,
                sessions_held: r.heldSessions ?? '',
                dropout_pct: r.dropoutRate ?? '',
                dropped: r.dropped ?? '',
                incidents_open: r.incidentsOpen ?? 0,
                incidents_total: r.incidentsTotal ?? 0,
                classes: r.classesTaught,
                students: r.totalStudents,
                earnings: r.totalEarnings,
                next_review: r.reviewDueAt ? fmtDate(r.reviewDueAt) : '',
              }))
            }
          />
        }
        bodyClassName=""
      >
        <div className="border-b border-[#e4ebf2] px-5 py-3 md:px-6">
          <FilterChips
            label="Show"
            value={filter}
            onChange={setFilter}
            options={[
              { id: 'all', label: 'All', count: all.length },
              { id: 'risk', label: 'At risk', count: all.filter(atRisk).length },
              { id: 'review', label: 'Review due (30d)', count: all.filter(reviewDue).length },
              { id: 'improvement', label: 'On improvement plan', count: all.filter((r) => r.lifecycleStage === 'improvement').length },
            ]}
          />
        </div>
        {!rows.length ? (
          <div className="p-5 md:p-6">
            <EmptyBlock text={all.length ? 'Nobody in this filter.' : 'No instructors yet.'} />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#e4ebf2] bg-[#f7f9fc] text-[11px] uppercase tracking-wider text-[#6a7a8c]">
                    {['#', 'Instructor', 'Score', 'Admin eval', 'Rating', 'Feedback', 'Completion', 'Attendance', 'Dropout', 'Incidents', 'Classes', 'Actions'].map((h) => (
                      <th key={h} className="px-3 py-2.5 font-medium first:pl-5 md:first:pl-6">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pager.pageItems.map((row, i) => {
                    const current = typeof row.adminEvaluation === 'number' ? row.adminEvaluation : 70;
                    const draft = drafts[row.id] ?? String(current);
                    const dirty = Number(draft) !== current;
                    const stage = row.lifecycleStage;
                    const canAct = row.instructorStatus === 'approved';
                    return (
                      <tr key={row.id} className="border-b border-[#eef2f7] align-top last:border-0 hover:bg-[#f7f9fc]/80">
                        <td className="py-3 pl-5 pr-2 text-xs tabular-nums text-[#9aa7b5] md:pl-6">{pager.start + i + 1}</td>
                        <td className="px-3 py-3">
                          <p className="font-medium text-[#0b1220]">{row.fullName}</p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[#7a8898]">
                            {stage ? <Pill tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</Pill> : null}
                            {row.reviewDueAt ? <span className={reviewDue(row) ? 'text-rose-700' : ''}>review {fmtDate(row.reviewDueAt)}</span> : null}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <Pill tone={scoreToneOf(row.qualityScore)} className="text-xs">
                            {row.qualityScore}
                          </Pill>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              aria-label={`Admin evaluation for ${row.fullName}`}
                              className="w-[4.25rem] border border-[#d0dae6] bg-white px-2 py-1.5 text-sm outline-none focus:border-[#3a5f8a]"
                              value={draft}
                              onChange={(e) => setDrafts((p) => ({ ...p, [row.id]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && dirty) void save(row.id, draft);
                              }}
                            />
                            {dirty ? (
                              <button
                                type="button"
                                disabled={busy === row.id}
                                className="border border-[#0b1220] bg-[#0b1220] px-2 py-1.5 text-xs text-white disabled:opacity-50"
                                onClick={() => void save(row.id, draft)}
                              >
                                {busy === row.id ? '…' : 'Save'}
                              </button>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {row.reviewsCount ? row.avgRating.toFixed(1) : '—'} <span className="text-[#7a8898]">({row.reviewsCount})</span>
                        </td>
                        <td className="px-3 py-3">
                          {row.reviewsCount ? `${row.satisfaction ?? 0}% happy` : '—'}
                          <p className="text-xs text-[#7a8898]">{row.feedbackCount ?? 0} written</p>
                        </td>
                        <td className="px-3 py-3" title={row.completionBasis === 'progress' ? 'Average progress (no finished cohort yet)' : 'Finished cohorts'}>
                          {row.completionRate}%
                          {row.completionBasis === 'progress' ? <p className="text-xs text-[#7a8898]">in progress</p> : null}
                        </td>
                        <td className="px-3 py-3">
                          {row.heldSessions ? `${row.attendanceRate}%` : '—'}
                          <p className="text-xs text-[#7a8898]">{row.heldSessions ?? 0} sessions</p>
                        </td>
                        <td className={`px-3 py-3 ${(row.dropoutRate ?? 0) >= 25 ? 'text-rose-700' : ''}`}>
                          {row.dropoutRate ?? 0}%<p className="text-xs text-[#7a8898]">{row.dropped ?? 0} dropped</p>
                        </td>
                        <td className="px-3 py-3">
                          {(row.incidentsOpen ?? 0) > 0 ? (
                            <Pill tone={(row.incidentsHighOpen ?? 0) > 0 ? 'rose' : 'amber'}>{row.incidentsOpen} open</Pill>
                          ) : (
                            <span className="text-[#7a8898]">{row.incidentsTotal ? `${row.incidentsTotal} closed` : 'None'}</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {row.classesTaught} <span className="text-[#7a8898]">({row.publishedClasses} live)</span>
                          <p className="text-xs text-[#7a8898]">{money(row.totalEarnings)}</p>
                        </td>
                        <td className="px-3 py-3">
                          {canAct ? (
                            <div className="flex flex-wrap gap-1.5">
                              <button type="button" className="border border-emerald-200 px-2 py-1 text-xs text-emerald-800 hover:bg-emerald-50" onClick={() => setPending({ userId: row.id, action: 'renew' })}>
                                Renew
                              </button>
                              <button type="button" className="border border-orange-200 px-2 py-1 text-xs text-orange-900 hover:bg-orange-50" onClick={() => setPending({ userId: row.id, action: 'improve' })}>
                                Improve
                              </button>
                              <button type="button" className="border border-rose-200 px-2 py-1 text-xs text-rose-800 hover:bg-rose-50" onClick={() => setPending({ userId: row.id, action: 'remove' })}>
                                Remove
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-[#7a8898]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination {...pager} noun="instructors" />
          </>
        )}
      </Panel>
      <LifecycleActionModal user={pendingUser} action={pending?.action ?? null} onClose={() => setPending(null)} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Incidents                                                           */
/* ------------------------------------------------------------------ */

const INCIDENT_TYPE_LABEL: Record<string, string> = {
  instructor_no_show: 'Instructor no-show',
  late_start: 'Late start',
  technical: 'Technical issue',
  conduct: 'Conduct',
  curriculum_drift: 'Off-curriculum teaching',
  off_platform_payment: 'Off-platform payment',
  learner_complaint: 'Learner complaint',
  other: 'Other',
};
const SEVERITY_TONE: Record<Incident['severity'], Tone> = { low: 'slate', medium: 'amber', high: 'rose' };
const INCIDENT_STATUS_TONE: Record<Incident['status'], Tone> = { open: 'rose', investigating: 'amber', resolved: 'green', dismissed: 'slate' };
const INCIDENTS_KEY = ['admin-incidents'];

function useIncidents() {
  return useQuery<Incident[]>({ queryKey: INCIDENTS_KEY, queryFn: async () => (await apiClient.get('/admin/incidents')).data.data, staleTime: 15_000 });
}

function IncidentsPanel() {
  const { search } = useAdmin();
  const { data: incidents = [], isLoading } = useIncidents();
  const [status, setStatus] = useState<'active' | Incident['status'] | 'all'>('active');
  const [creating, setCreating] = useState(false);
  const [closing, setClosing] = useState<{ incident: Incident; status: 'resolved' | 'dismissed' } | null>(null);
  const qc = useQueryClient();
  const run = useAdminAction();

  const inStatus = (i: Incident, s: typeof status) => s === 'all' || (s === 'active' ? i.status === 'open' || i.status === 'investigating' : i.status === s);
  const rows = incidents.filter((i) => inStatus(i, status)).filter((i) => matches(search, i.title, i.instructorName, i.classTitle, i.learnerName, i.type));
  const pager = usePagination(rows, 10, `${status}|${search}`);

  async function update(i: Incident, body: Record<string, unknown>) {
    const res = await run(() => apiClient.patch(`/admin/incidents/${i.id}`, body));
    await qc.invalidateQueries({ queryKey: INCIDENTS_KEY });
    return res;
  }

  return (
    <Panel
      title="Incidents"
      subtitle="No-shows, conduct, off-curriculum teaching, off-platform payment requests and learner complaints. Open incidents lower the instructor's quality score."
      icon={<AlertOctagon className="h-4 w-4" />}
      actions={
        <div className="flex flex-wrap gap-2">
          <ExportButton
            filename="incidents"
            rows={() =>
              rows.map((i) => ({
                occurred: fmtDateTime(i.occurredAt),
                type: INCIDENT_TYPE_LABEL[i.type] || i.type,
                severity: i.severity,
                status: i.status,
                title: i.title,
                description: i.description,
                instructor: i.instructorName || '',
                class: i.classTitle || '',
                learner: i.learnerName || '',
                reported_by: i.reportedByName,
                resolution: i.resolution,
                resolved: i.resolvedAt ? fmtDateTime(i.resolvedAt) : '',
              }))
            }
          />
          <button type="button" className={btn.primary} onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Log incident
          </button>
        </div>
      }
      bodyClassName=""
    >
      <div className="border-b border-[#e4ebf2] px-5 py-3 md:px-6">
        <FilterChips
          label="Status"
          value={status}
          onChange={setStatus}
          options={(['active', 'open', 'investigating', 'resolved', 'dismissed', 'all'] as const).map((id) => ({
            id,
            label: id === 'active' ? 'Needs action' : id === 'all' ? 'All' : id,
            count: incidents.filter((i) => inStatus(i, id)).length,
          }))}
        />
      </div>
      {isLoading ? (
        <p className="p-6 text-sm text-[#7a8898]">Loading incidents…</p>
      ) : !rows.length ? (
        <div className="p-5 md:p-6">
          <EmptyBlock text={incidents.length ? 'No incidents in this filter.' : 'No incidents logged. Use "Log incident" when something goes wrong in a class.'} />
        </div>
      ) : (
        <>
          <ul className="divide-y divide-[#eef2f7]">
            {pager.pageItems.map((i) => (
              <li key={i.id} className="px-5 py-4 md:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-[#0b1220]">
                      <Pill tone={SEVERITY_TONE[i.severity]}>{i.severity}</Pill>
                      <Pill tone={INCIDENT_STATUS_TONE[i.status]}>{i.status}</Pill>
                      {i.title}
                    </p>
                    <p className="mt-1 text-xs text-[#7a8898]">
                      {INCIDENT_TYPE_LABEL[i.type] || i.type} · {fmtDateTime(i.occurredAt)}
                      {i.instructorName ? ` · Instructor: ${i.instructorName}` : ''}
                      {i.classTitle ? ` · Class: ${i.classTitle}` : ''}
                      {i.learnerName ? ` · Learner: ${i.learnerName}` : ''}
                      {` · Reported by ${i.reportedByName || i.reporterRole}`}
                    </p>
                    {i.description ? <p className="mt-2 whitespace-pre-line text-sm text-[#3d4b5c]">{i.description}</p> : null}
                    {i.resolution ? (
                      <p className="mt-2 border-l-2 border-emerald-300 pl-3 text-sm text-[#3d4b5c]">
                        <span className="font-medium">Resolution:</span> {i.resolution}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {i.status === 'open' ? (
                      <button type="button" className={btn.secondary} onClick={() => void update(i, { status: 'investigating' })}>
                        Investigate
                      </button>
                    ) : null}
                    {i.status === 'open' || i.status === 'investigating' ? (
                      <>
                        <button type="button" className={btn.primary} onClick={() => setClosing({ incident: i, status: 'resolved' })}>
                          Resolve
                        </button>
                        <button type="button" className={btn.secondary} onClick={() => setClosing({ incident: i, status: 'dismissed' })}>
                          Dismiss
                        </button>
                      </>
                    ) : (
                      <button type="button" className={btn.link} onClick={() => void update(i, { status: 'open' })}>
                        Reopen
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <Pagination {...pager} noun="incidents" />
        </>
      )}
      <CreateIncidentModal open={creating} onClose={() => setCreating(false)} />
      <CloseIncidentModal pending={closing} onClose={() => setClosing(null)} onSubmit={update} />
    </Panel>
  );
}

function CreateIncidentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, classOps } = useAdmin();
  const run = useAdminAction();
  const qc = useQueryClient();
  const blank = { type: 'instructor_no_show', severity: 'medium', title: '', description: '', classId: '', instructorId: '', learnerId: '', occurredAt: '' };
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setForm(blank);
  }
  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const instructors = (data.users || []).filter((u) => u.role === 'instructor' && u.instructorStatus !== 'rejected');
  const learners = form.classId
    ? (data.enrollments || []).filter((e) => e.classId === form.classId)
    : [];

  async function submit() {
    if (form.title.trim().length < 3) return;
    setBusy(true);
    const res = await run(() =>
      apiClient.post('/admin/incidents', {
        ...form,
        classId: form.classId || undefined,
        instructorId: form.instructorId || undefined,
        learnerId: form.learnerId || undefined,
        occurredAt: form.occurredAt ? new Date(form.occurredAt).toISOString() : undefined,
      })
    );
    await qc.invalidateQueries({ queryKey: INCIDENTS_KEY });
    setBusy(false);
    if (res) onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log incident"
      eyebrow="Quality"
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={btn.primary} disabled={busy || form.title.trim().length < 3} onClick={() => void submit()}>
            {busy ? 'Saving…' : 'Log incident'}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type">
          <select className={inputCls} value={form.type} onChange={set('type')}>
            {Object.entries(INCIDENT_TYPE_LABEL).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Severity">
          <select className={inputCls} value={form.severity} onChange={set('severity')}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </Field>
        <Field label="Summary" className="sm:col-span-2">
          <input className={inputCls} maxLength={200} value={form.title} onChange={set('title')} placeholder="e.g. Instructor did not join session 4" />
        </Field>
        <Field label="Class (optional)">
          <select className={inputCls} value={form.classId} onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value, learnerId: '' }))}>
            <option value="">—</option>
            {classOps.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Instructor" hint={form.classId && !form.instructorId ? 'Defaults to the class lead' : undefined}>
          <select className={inputCls} value={form.instructorId} onChange={set('instructorId')}>
            <option value="">{form.classId ? 'Class lead' : '—'}</option>
            {instructors.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </select>
        </Field>
        {learners.length ? (
          <Field label="Learner involved (optional)">
            <select className={inputCls} value={form.learnerId} onChange={set('learnerId')}>
              <option value="">—</option>
              {learners.map((e) => (
                <option key={e.userId} value={e.userId}>
                  {e.learnerName}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label="When (optional)">
          <input className={inputCls} type="datetime-local" value={form.occurredAt} onChange={set('occurredAt')} />
        </Field>
        <Field label="Details" className="sm:col-span-2">
          <textarea className={`${inputCls} min-h-[100px]`} maxLength={5000} value={form.description} onChange={set('description')} />
        </Field>
      </div>
    </Modal>
  );
}

function CloseIncidentModal({
  pending,
  onClose,
  onSubmit,
}: {
  pending: { incident: Incident; status: 'resolved' | 'dismissed' } | null;
  onClose: () => void;
  onSubmit: (i: Incident, body: Record<string, unknown>) => Promise<unknown>;
}) {
  const shown = useSticky(pending);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  const id = pending ? `${pending.incident.id}:${pending.status}` : null;
  if (id !== lastId) {
    setLastId(id);
    if (pending) setNote(pending.incident.resolution || '');
  }
  const verb = shown?.status === 'dismissed' ? 'Dismiss' : 'Resolve';
  return (
    <Modal
      open={!!pending}
      onClose={onClose}
      size="sm"
      title={`${verb} incident`}
      eyebrow={shown?.incident.title}
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={btn.primary}
            disabled={busy || !note.trim()}
            onClick={async () => {
              if (!shown) return;
              setBusy(true);
              const res = await onSubmit(shown.incident, { status: shown.status, resolution: note.trim() });
              setBusy(false);
              if (res) onClose();
            }}
          >
            {busy ? 'Saving…' : verb}
          </button>
        </>
      }
    >
      <Field label={shown?.status === 'dismissed' ? 'Why is this being dismissed?' : 'What was done?'}>
        <textarea className={`${inputCls} min-h-[100px]`} maxLength={5000} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Review moderation                                                   */
/* ------------------------------------------------------------------ */

const REVIEWS_KEY = ['admin-reviews'];
const REVIEW_TONE: Record<ModeratedReview['status'], Tone> = { visible: 'green', flagged: 'amber', hidden: 'slate' };

export function ReviewsSection() {
  const { search } = useAdmin();
  const run = useAdminAction();
  const qc = useQueryClient();
  const { data: reviews = [], isLoading } = useQuery<ModeratedReview[]>({
    queryKey: REVIEWS_KEY,
    queryFn: async () => (await apiClient.get('/admin/reviews')).data.data,
    staleTime: 15_000,
  });
  const [status, setStatus] = useState<'all' | ModeratedReview['status'] | 'low'>('all');
  const [hiding, setHiding] = useState<ModeratedReview | null>(null);
  const [note, setNote] = useState('');

  const inStatus = (r: ModeratedReview, s: typeof status) => s === 'all' || (s === 'low' ? r.rating <= 2 : r.status === s);
  const rows = reviews.filter((r) => inStatus(r, status)).filter((r) => matches(search, r.comment, r.userName, r.classTitle, r.instructorName));
  const pager = usePagination(rows, 10, `${status}|${search}`);

  async function moderate(r: ModeratedReview, next: ModeratedReview['status'], moderationNote?: string) {
    const res = await run(() => apiClient.patch(`/admin/reviews/${r.id}`, { status: next, note: moderationNote }));
    await qc.invalidateQueries({ queryKey: REVIEWS_KEY });
    return res;
  }

  async function remove(r: ModeratedReview) {
    if (!window.confirm(`Delete this ${r.rating}★ review by ${r.userName}? This can't be undone. Prefer "Hide" to keep an audit trail.`)) return;
    await run(() => apiClient.delete(`/admin/reviews/${r.id}`));
    await qc.invalidateQueries({ queryKey: REVIEWS_KEY });
  }

  return (
    <Panel
      title="Reviews"
      subtitle="Hidden reviews are excluded from public pages and from class and instructor ratings."
      icon={<Star className="h-4 w-4" />}
      actions={
        <ExportButton
          filename="reviews"
          rows={() =>
            rows.map((r) => ({
              date: fmtDate(r.createdAt),
              class: r.classTitle,
              instructor: r.instructorName,
              learner: r.userName,
              learner_email: r.userEmail,
              rating: r.rating,
              comment: r.comment,
              status: r.status,
              moderation_note: r.moderationNote,
            }))
          }
        />
      }
      bodyClassName=""
    >
      <div className="border-b border-[#e4ebf2] px-5 py-3 md:px-6">
        <FilterChips
          label="Show"
          value={status}
          onChange={setStatus}
          options={(['all', 'low', 'flagged', 'hidden', 'visible'] as const).map((id) => ({
            id,
            label: id === 'low' ? '1–2 stars' : id === 'all' ? 'All' : id,
            count: reviews.filter((r) => inStatus(r, id)).length,
          }))}
        />
      </div>
      {isLoading ? (
        <p className="p-6 text-sm text-[#7a8898]">Loading reviews…</p>
      ) : !rows.length ? (
        <div className="p-5 md:p-6">
          <EmptyBlock text={reviews.length ? 'No reviews in this filter.' : 'No reviews yet.'} />
        </div>
      ) : (
        <>
          <ul className="divide-y divide-[#eef2f7]">
            {pager.pageItems.map((r) => (
              <li key={r.id} className={`px-5 py-4 md:px-6 ${r.status === 'hidden' ? 'opacity-70' : ''}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium tracking-wide text-amber-600" aria-label={`${r.rating} stars`}>
                        {'★'.repeat(r.rating)}
                        <span className="text-[#d0dae6]">{'★'.repeat(5 - r.rating)}</span>
                      </span>
                      <Pill tone={REVIEW_TONE[r.status]}>{r.status}</Pill>
                      <span className="text-[#7a8898]">
                        {r.userName} · {r.classTitle}
                        {r.instructorName ? ` · ${r.instructorName}` : ''} · {fmtDate(r.createdAt)}
                      </span>
                    </p>
                    <p className="mt-1.5 whitespace-pre-line text-sm text-[#0b1220]">{r.comment || <span className="italic text-[#9aa7b5]">No comment</span>}</p>
                    {r.moderationNote ? <p className="mt-1.5 text-xs text-[#7a8898]">Moderation note: {r.moderationNote}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {r.status !== 'flagged' && r.status !== 'hidden' ? (
                      <button type="button" className={btn.secondary} onClick={() => void moderate(r, 'flagged')}>
                        <Flag className="h-3.5 w-3.5" /> Flag
                      </button>
                    ) : null}
                    {r.status !== 'hidden' ? (
                      <button
                        type="button"
                        className={btn.secondary}
                        onClick={() => {
                          setNote('');
                          setHiding(r);
                        }}
                      >
                        <EyeOff className="h-3.5 w-3.5" /> Hide
                      </button>
                    ) : null}
                    {r.status !== 'visible' ? (
                      <button type="button" className={btn.secondary} onClick={() => void moderate(r, 'visible')}>
                        <Eye className="h-3.5 w-3.5" /> Restore
                      </button>
                    ) : null}
                    <button type="button" className={btn.danger} onClick={() => void remove(r)} aria-label="Delete review">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <Pagination {...pager} noun="reviews" />
        </>
      )}
      <Modal
        open={!!hiding}
        onClose={() => setHiding(null)}
        size="sm"
        title="Hide review"
        eyebrow={hiding ? `${hiding.userName} · ${hiding.rating}★` : undefined}
        footer={
          <>
            <button type="button" className={btn.secondary} onClick={() => setHiding(null)}>
              Cancel
            </button>
            <button
              type="button"
              className={btn.primary}
              disabled={!note.trim()}
              onClick={async () => {
                if (!hiding) return;
                const res = await moderate(hiding, 'hidden', note.trim());
                if (res) setHiding(null);
              }}
            >
              Hide review
            </button>
          </>
        }
      >
        <Field label="Reason (internal)">
          <textarea className={`${inputCls} min-h-[90px]`} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Abusive language / spam / not about this class" />
        </Field>
      </Modal>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* KPI dashboard                                                       */
/* ------------------------------------------------------------------ */

type KpiResponse = {
  window: { days: number; from: string | null; to: string };
  northStar: { successfulLearners: number; activeClasses: number; perActiveClass: number };
  kpis: Record<string, number>;
  funnel: { stage: string; value: number }[];
  series: { period: string; enrollments: number; gmv: number; sessions: number }[];
  courses: { courseId: string; title: string; classes: number; enrollments: number; gmv: number }[];
};

const PERIODS = [
  { id: '30', label: '30 days' },
  { id: '90', label: '90 days' },
  { id: '365', label: '12 months' },
  { id: '0', label: 'All time' },
] as const;

export function KpiSection() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['id']>('30');
  const [metric, setMetric] = useState<'enrollments' | 'gmv' | 'sessions'>('enrollments');
  const { data, isLoading, isError } = useQuery<KpiResponse>({
    queryKey: ['admin-kpis', period],
    queryFn: async () => (await apiClient.get('/admin/kpis', { params: { days: period } })).data.data,
    staleTime: 30_000,
  });
  const k = data?.kpis || {};
  const periodLabel = PERIODS.find((p) => p.id === period)!.label;

  function exportRows() {
    if (!data) return [];
    const base = Object.entries(data.kpis).map(([metricName, value]) => ({ section: 'kpi', metric: metricName, value, period: periodLabel }));
    return [
      { section: 'north_star', metric: 'successful_learners', value: data.northStar.successfulLearners, period: periodLabel },
      { section: 'north_star', metric: 'active_classes', value: data.northStar.activeClasses, period: periodLabel },
      { section: 'north_star', metric: 'successful_learners_per_active_class', value: data.northStar.perActiveClass, period: periodLabel },
      ...base,
      ...data.funnel.map((f) => ({ section: 'funnel', metric: f.stage, value: f.value, period: periodLabel })),
      ...data.series.flatMap((s) => [
        { section: 'series', metric: `enrollments ${s.period}`, value: s.enrollments, period: periodLabel },
        { section: 'series', metric: `gmv ${s.period}`, value: s.gmv, period: periodLabel },
        { section: 'series', metric: `sessions ${s.period}`, value: s.sessions, period: periodLabel },
      ]),
      ...data.courses.flatMap((c) => [
        { section: 'course', metric: `${c.title} · classes`, value: c.classes, period: periodLabel },
        { section: 'course', metric: `${c.title} · enrollments`, value: c.enrollments, period: periodLabel },
        { section: 'course', metric: `${c.title} · gmv`, value: c.gmv, period: periodLabel },
      ]),
    ];
  }

  const funnelTop = data?.funnel[0]?.value || 0;
  const seriesMax = Math.max(1, ...(data?.series || []).map((s) => s[metric]));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs value={period} onChange={setPeriod} tabs={PERIODS.map((p) => ({ id: p.id, label: p.label }))} />
        <ExportButton filename={`kpis-${period === '0' ? 'all-time' : `${period}d`}`} rows={exportRows} />
      </div>

      {isError ? (
        <EmptyBlock text="Could not load KPIs. Try again in a moment." />
      ) : isLoading || !data ? (
        <p className="text-sm text-[#7a8898]">Loading KPIs…</p>
      ) : (
        <>
          <Panel bodyClassName="p-5 md:p-6">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex h-12 w-12 items-center justify-center bg-[#0b1220] text-white">
                <Target className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <SectionLabel>North star · successful learners per active class</SectionLabel>
                <p className="mt-1 font-serif text-4xl text-[#0b1220]">{data.northStar.perActiveClass}</p>
                <p className="mt-1 text-sm text-[#5c6b7a]">
                  {data.northStar.successfulLearners} learners completed without a low rating across {data.northStar.activeClasses} active classes ({periodLabel.toLowerCase()}).
                </p>
              </div>
            </div>
          </Panel>

          <div>
            <SectionLabel>Growth &amp; conversion</SectionLabel>
            <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatTile label="Enrollments" value={k.enrollments} hint={`${k.paidEnrollments} paid · ${k.freeEnrollments} free`} />
              <StatTile label="Checkout conversion" value={`${k.enrollmentConversion}%`} hint={`${k.paymentAttempts} payment attempts`} />
              <StatTile label="Avg fill rate" value={`${k.fillRate}%`} hint="published classes" />
              <StatTile label="Repeat learners" value={`${k.repeatEnrollment}%`} hint="2+ classes" />
            </div>
          </div>

          <div>
            <SectionLabel>Learning outcomes</SectionLabel>
            <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatTile label="Attendance" value={`${k.attendanceRate}%`} hint={`${k.sessionsHeld} sessions held`} tone={k.sessionsHeld && k.attendanceRate < 70 ? 'warn' : undefined} />
              <StatTile label="Completion" value={`${k.completionRate}%`} />
              <StatTile label="Dropout" value={`${k.dropoutRate}%`} tone={k.dropoutRate >= 20 ? 'warn' : undefined} />
              <StatTile label="Satisfaction" value={k.reviews ? `${k.satisfaction}%` : '—'} hint={k.reviews ? `${k.avgRating}★ avg · ${k.reviews} reviews` : 'no reviews'} />
            </div>
          </div>

          <div>
            <SectionLabel>Supply &amp; unit economics</SectionLabel>
            <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatTile label="Instructor utilization" value={`${k.instructorUtilization}%`} hint={`${k.teachingInstructors} of ${k.certifiedInstructors} certified teaching`} />
              <StatTile label="GMV" value={money(k.gmv)} hint={k.refunded ? `${money(k.refunded)} refunded` : `${money(k.revenuePerClass)} per paid class`} />
              <StatTile label={`Platform revenue (${k.platformFeePercent}%)`} value={money(k.estPlatformRevenue)} hint="estimated commission" />
              <StatTile
                label="Contribution margin"
                value={money(k.estContributionMargin)}
                hint={`after ~${money(k.estProcessingFees)} card fees`}
                tone={k.estContributionMargin < 0 ? 'warn' : undefined}
              />
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Panel title="Learner funnel" icon={<BarChart3 className="h-4 w-4" />}>
              <ul className="space-y-3">
                {data.funnel.map((f, i) => {
                  const pct = funnelTop ? Math.round((f.value / funnelTop) * 100) : 0;
                  const prev = i > 0 ? data.funnel[i - 1].value : 0;
                  return (
                    <li key={f.stage}>
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="text-[#0b1220]">{f.stage}</span>
                        <span className="tabular-nums text-[#5c6b7a]">
                          {f.value}
                          {i > 0 && prev ? <span className="ml-2 text-xs text-[#9aa7b5]">{Math.round((f.value / prev) * 100)}% of previous</span> : null}
                        </span>
                      </div>
                      <div className="mt-1 h-2.5 bg-[#eef2f7]">
                        <div className="h-full bg-[#3a5f8a]" style={{ width: `${Math.max(pct, f.value ? 2 : 0)}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Panel>

            <Panel
              title="Trend"
              subtitle={data.window.days && data.window.days <= 120 ? 'Weekly' : 'Monthly'}
              icon={<BarChart3 className="h-4 w-4" />}
              actions={
                <SegmentedTabs
                  value={metric}
                  onChange={setMetric}
                  tabs={[
                    { id: 'enrollments', label: 'Enrollments' },
                    { id: 'gmv', label: 'GMV' },
                    { id: 'sessions', label: 'Sessions' },
                  ]}
                />
              }
            >
              {!data.series.length ? (
                <EmptyBlock text="No activity in this period." />
              ) : (
                <div className="flex h-44 items-end gap-1.5" role="img" aria-label={`${metric} per period`}>
                  {data.series.map((s) => (
                    <div key={s.period} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${s.period}: ${metric === 'gmv' ? money(s.gmv) : s[metric]}`}>
                      <span className="text-[10px] tabular-nums text-[#7a8898] opacity-0 transition-opacity group-hover:opacity-100">
                        {metric === 'gmv' ? Math.round(s.gmv) : s[metric]}
                      </span>
                      <div className="w-full bg-[#3a5f8a] transition-colors group-hover:bg-[#0b1220]" style={{ height: `${Math.max((s[metric] / seriesMax) * 100, s[metric] ? 3 : 0)}%` }} />
                      <span className="w-full truncate text-center text-[9px] text-[#9aa7b5]">{s.period.slice(5)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <Panel title="By course" bodyClassName="">
            {!data.courses.length ? (
              <div className="p-5">
                <EmptyBlock text="No courses yet." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#e4ebf2] bg-[#f7f9fc] text-[11px] uppercase tracking-wider text-[#6a7a8c]">
                      {['Course', 'Classes (all time)', `Enrollments (${periodLabel})`, `GMV (${periodLabel})`].map((h) => (
                        <th key={h} className="px-4 py-2.5 font-medium first:pl-5 md:first:pl-6">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.courses.map((c) => (
                      <tr key={c.courseId} className="border-b border-[#eef2f7] last:border-0">
                        <td className="py-3 pl-5 pr-4 font-medium text-[#0b1220] md:pl-6">{c.title}</td>
                        <td className="px-4 py-3 tabular-nums">{c.classes}</td>
                        <td className="px-4 py-3 tabular-nums">{c.enrollments}</td>
                        <td className="px-4 py-3 tabular-nums">{money(c.gmv)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
          <p className="text-xs text-[#7a8898]">
            Platform revenue and card fees are estimates (commission % from Settings, card fees at 2.9% + 30¢). Demo payments are excluded.
          </p>
        </>
      )}
    </div>
  );
}
