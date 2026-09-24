import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, CalendarClock, ChevronDown, ClipboardList, FileText, Paperclip, Search } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { useAdmin, useAdminAction } from './context';
import type { AssignmentOp } from './types';
import {
  Avatar,
  EmptyBlock,
  ExportButton,
  FilterChips,
  inputCls,
  Modal,
  Pagination,
  Panel,
  Pill,
  ProgressBar,
  SectionLabel,
  StatTile,
  btn,
  fmtDate,
  fmtDateTime,
  matches,
  relativeDue,
  usePagination,
  useSticky,
  type Tone,
} from './ui';

type DueFilter = 'all' | 'open' | 'past' | 'none';

const isPast = (a: AssignmentOp) => !!a.dueDate && new Date(a.dueDate).getTime() < Date.now();
const rate = (a: AssignmentOp) => (a.enrolledStudents ? Math.round((a.submissionCount / a.enrolledStudents) * 100) : 0);

export default function AssignmentsSection() {
  const { data, search } = useAdmin();
  const [filter, setFilter] = useState<DueFilter>('all');
  const [open, setOpen] = useState<AssignmentOp | null>(null);

  const all = [...(data.assignmentOps || [])].sort((a, b) => {
    const ad = a.dueDate ? new Date(a.dueDate).getTime() : 0;
    const bd = b.dueDate ? new Date(b.dueDate).getTime() : 0;
    return bd - ad;
  });
  const counts = {
    all: all.length,
    open: all.filter((a) => a.dueDate && !isPast(a)).length,
    past: all.filter(isPast).length,
    none: all.filter((a) => !a.dueDate).length,
  };
  const rows = all
    .filter((a) =>
      filter === 'open' ? a.dueDate && !isPast(a) : filter === 'past' ? isPast(a) : filter === 'none' ? !a.dueDate : true
    )
    .filter((a) => matches(search, a.title, a.classTitle, a.instructorName, a.description));
  const pager = usePagination(rows, 10, `${filter}|${search}`);

  const totalSubs = all.reduce((s, a) => s + a.submissionCount, 0);
  const withRoster = all.filter((a) => a.enrolledStudents > 0);
  const avgRate = withRoster.length ? Math.round(withRoster.reduce((s, a) => s + rate(a), 0) / withRoster.length) : 0;
  const needsAttention = all.filter((a) => isPast(a) && a.submissionCount < a.enrolledStudents).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Assignments" value={all.length} hint={`${counts.open} open now`} />
        <StatTile label="Submissions" value={totalSubs} hint="Across every class" />
        <StatTile label="Avg submission rate" value={`${avgRate}%`} hint="Of enrolled learners" tone={avgRate >= 70 ? 'good' : undefined} />
        <StatTile
          label="Closed with missing work"
          value={needsAttention}
          hint="Past due, not everyone submitted"
          tone={needsAttention ? 'warn' : undefined}
          onClick={needsAttention ? () => setFilter('past') : undefined}
        />
      </div>

      <Panel
        title="Assignments"
        subtitle="Work tutors have posted across all classes. Open one to see, grade and export every learner’s submission."
        icon={<ClipboardList className="h-4 w-4" />}
        actions={
          <ExportButton
            filename="assignments"
            rows={() =>
              rows.map((a) => ({
                assignment: a.title,
                class: a.classTitle,
                instructor: a.instructorName || '',
                due: a.dueDate ? fmtDateTime(a.dueDate) : '',
                enrolled: a.enrolledStudents,
                submitted: a.submissionCount,
                submission_rate_pct: rate(a),
              }))
            }
          />
        }
        bodyClassName=""
      >
        <div className="border-b border-[#e4ebf2] px-5 py-3 md:px-6">
          <FilterChips
            label="Due date"
            value={filter}
            onChange={setFilter}
            options={[
              { id: 'all', label: 'All', count: counts.all },
              { id: 'open', label: 'Open', count: counts.open },
              { id: 'past', label: 'Past due', count: counts.past },
              { id: 'none', label: 'No due date', count: counts.none },
            ]}
          />
        </div>

        {!rows.length ? (
          <div className="p-5 md:p-6">
            <EmptyBlock text={all.length ? 'No assignments match this filter.' : 'No assignments posted yet.'} />
          </div>
        ) : (
          <>
            <div className="grid gap-px bg-[#e4ebf2] md:grid-cols-2">
              {pager.pageItems.map((a) => (
                <AssignmentCard key={`${a.classId}-${a.id}`} a={a} onOpen={() => setOpen(a)} />
              ))}
              {pager.pageItems.length % 2 === 1 ? <div className="hidden bg-white md:block" /> : null}
            </div>
            <Pagination {...pager} noun="assignments" />
          </>
        )}
      </Panel>

      <AssignmentDetailsModal assignment={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function dueTone(a: { dueDate?: string | null }): Tone {
  if (!a.dueDate) return 'slate';
  const diff = new Date(a.dueDate).getTime() - Date.now();
  if (diff < 0) return 'rose';
  if (diff < 3 * 86400000) return 'amber';
  return 'blue';
}

function AssignmentCard({ a, onOpen }: { a: AssignmentOp; onOpen: () => void }) {
  const pct = rate(a);
  return (
    <article className="flex flex-col bg-white p-5 transition-colors hover:bg-[#fbfcfe]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-[#6a7a8c]">
            {a.classTitle}
            {a.instructorName ? ` · ${a.instructorName}` : ''}
          </p>
          <h4 className="mt-1 font-medium leading-snug text-[#0b1220]">{a.title}</h4>
        </div>
        <Pill tone={dueTone(a)}>
          <CalendarClock className="h-3 w-3" />
          {relativeDue(a.dueDate)}
        </Pill>
      </div>
      <p className="mt-2 line-clamp-3 min-h-[3.75rem] text-sm leading-relaxed text-[#5c6b7a]">
        {a.description || <span className="text-[#9aa7b5]">No instructions written.</span>}
      </p>
      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-xs text-[#5c6b7a]">
          <span>
            <strong className="font-medium text-[#0b1220]">{a.submissionCount}</strong> of {a.enrolledStudents} submitted
          </span>
          <span>{pct}%</span>
        </div>
        <ProgressBar value={pct} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#eef2f7] pt-3">
        <span className="text-xs text-[#7a8898]">{a.dueDate ? `Due ${fmtDate(a.dueDate)}` : 'Open-ended'}</span>
        <button type="button" onClick={onOpen} className={btn.link}>
          More details <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Details modal                                                       */
/* ------------------------------------------------------------------ */

type Submission = {
  id: string;
  content: string;
  attachmentUrl: string;
  submittedAt: string;
  updatedAt: string;
  late: boolean;
  grade: { score: number; maxScore: number; feedback: string; gradedAt: string; gradedByName: string } | null;
};
type RosterRow = {
  userId: string;
  name: string;
  email: string;
  avatar: string;
  enrolledAt: string | null;
  enrolled: boolean;
  progress: number;
  submission: Submission | null;
};
type AssignmentDetails = {
  assignment: { id: string; title: string; description: string; dueDate: string | null; attachmentUrl: string };
  class: { id: string; title: string; status: string; thumbnail: string; instructorName: string };
  roster: RosterRow[];
  stats: {
    enrolled: number;
    submitted: number;
    onTime: number;
    late: number;
    missing: number;
    isPastDue: boolean;
    graded: number;
    avgScorePct: number | null;
  };
};

function GradeForm({ classId, assignmentId, submission, onSaved }: { classId: string; assignmentId: string; submission: Submission; onSaved: () => void }) {
  const run = useAdminAction();
  const [score, setScore] = useState(submission.grade ? String(submission.grade.score) : '');
  const [max, setMax] = useState(String(submission.grade?.maxScore ?? 100));
  const [feedback, setFeedback] = useState(submission.grade?.feedback || '');
  const [busy, setBusy] = useState(false);
  const s = Number(score);
  const m = Number(max);
  const valid = score !== '' && Number.isFinite(s) && Number.isFinite(m) && m > 0 && s >= 0 && s <= m;

  async function save() {
    if (!valid) return;
    setBusy(true);
    const res = await run(
      () => apiClient.put(`/classes/${classId}/assignments/${assignmentId}/submissions/${submission.id}/grade`, { score: s, maxScore: m, feedback: feedback.trim() }),
      { refresh: false }
    );
    setBusy(false);
    if (res) onSaved();
  }

  return (
    <div className="mt-4 border-t border-[#e4ebf2] pt-4">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#7a8898]">
        Grade
        {submission.grade ? (
          <span className="ml-2 normal-case tracking-normal text-[#9aa7b5]">
            last graded {fmtDateTime(submission.grade.gradedAt)}
            {submission.grade.gradedByName ? ` by ${submission.grade.gradedByName}` : ''}
          </span>
        ) : null}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-[#5c6b7a]">
          Score
          <input type="number" min={0} className={`${inputCls} mt-1 w-24`} value={score} onChange={(e) => setScore(e.target.value)} />
        </label>
        <span className="pb-2.5 text-sm text-[#7a8898]">/</span>
        <label className="text-xs text-[#5c6b7a]">
          Out of
          <input type="number" min={1} className={`${inputCls} mt-1 w-24`} value={max} onChange={(e) => setMax(e.target.value)} />
        </label>
        <label className="min-w-[220px] flex-1 text-xs text-[#5c6b7a]">
          Feedback to learner (optional)
          <input className={`${inputCls} mt-1`} maxLength={3000} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
        </label>
        <button type="button" className={btn.primary} disabled={busy || !valid} onClick={() => void save()}>
          {busy ? 'Saving…' : submission.grade ? 'Update grade' : 'Save grade'}
        </button>
      </div>
      {score !== '' && !valid ? <p className="mt-1.5 text-xs text-rose-700">Score must be between 0 and the max score.</p> : null}
    </div>
  );
}

type RosterFilter = 'all' | 'submitted' | 'late' | 'missing';

function rowStatus(r: RosterRow, pastDue: boolean): { label: string; tone: Tone } {
  if (r.submission) {
    if (!r.enrolled) return { label: 'Left class', tone: 'slate' };
    return r.submission.late ? { label: 'Late', tone: 'amber' } : { label: 'On time', tone: 'green' };
  }
  return pastDue ? { label: 'Missing', tone: 'rose' } : { label: 'Not yet', tone: 'slate' };
}

export function AssignmentDetailsModal({
  assignment: openAssignment,
  onClose,
}: {
  assignment: Pick<AssignmentOp, 'id' | 'classId' | 'title'> | null;
  onClose: () => void;
}) {
  const assignment = useSticky(openAssignment);
  const [filter, setFilter] = useState<RosterFilter>('all');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lastId, setLastId] = useState<string | null>(null);

  const id = assignment ? `${assignment.classId}:${assignment.id}` : null;
  if (id !== lastId) {
    setLastId(id);
    setFilter('all');
    setQuery('');
    setExpanded(null);
  }

  const details = useQuery<AssignmentDetails>({
    queryKey: ['admin-assignment', assignment?.classId, assignment?.id],
    queryFn: async () =>
      (await apiClient.get(`/data/admin/classes/${assignment!.classId}/assignments/${assignment!.id}`)).data.data,
    enabled: !!assignment,
    staleTime: 0,
  });

  const d = details.data;
  const pastDue = !!d?.stats.isPastDue;
  const roster = (d?.roster || [])
    .filter((r) =>
      filter === 'submitted' ? !!r.submission : filter === 'late' ? !!r.submission?.late : filter === 'missing' ? r.enrolled && !r.submission : true
    )
    .filter((r) => matches(query, r.name, r.email))
    .sort((a, b) => {
      if (!!a.submission !== !!b.submission) return a.submission ? -1 : 1;
      if (a.submission && b.submission) return new Date(b.submission.submittedAt).getTime() - new Date(a.submission.submittedAt).getTime();
      return a.name.localeCompare(b.name);
    });
  const pager = usePagination(roster, 10, `${id}|${filter}|${query}`);

  return (
    <Modal
      open={!!openAssignment}
      onClose={onClose}
      size="xl"
      eyebrow="Assignment"
      title={d?.assignment.title || assignment?.title}
      subtitle={
        d ? (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{d.class.title}</span>
            {d.class.instructorName ? <span className="text-[#7a8898]">by {d.class.instructorName}</span> : null}
            <Pill tone={dueTone(d.assignment)}>
              <CalendarClock className="h-3 w-3" />
              {d.assignment.dueDate ? `${relativeDue(d.assignment.dueDate)} · ${fmtDateTime(d.assignment.dueDate)}` : 'No due date'}
            </Pill>
          </span>
        ) : null
      }
    >
      {details.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse bg-[#eef2f7]" />
          ))}
        </div>
      ) : details.isError || !d ? (
        <EmptyBlock
          text="Couldn’t load this assignment. It may have been removed."
          action={
            <button type="button" className={btn.secondary} onClick={() => details.refetch()}>
              Try again
            </button>
          }
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <StatTile label="Enrolled" value={d.stats.enrolled} />
            <StatTile label="Submitted" value={d.stats.submitted} tone={d.stats.submitted ? 'good' : undefined} />
            <StatTile label="On time" value={d.stats.onTime} />
            <StatTile label="Late" value={d.stats.late} tone={d.stats.late ? 'warn' : undefined} />
            <StatTile
              label={pastDue ? 'Missing' : 'Not yet submitted'}
              value={d.stats.missing}
              tone={pastDue && d.stats.missing ? 'warn' : undefined}
            />
            <StatTile
              label="Graded"
              value={`${d.stats.graded ?? 0}/${d.stats.submitted}`}
              hint={d.stats.avgScorePct != null ? `avg ${d.stats.avgScorePct}%` : 'no grades yet'}
              tone={d.stats.submitted > (d.stats.graded ?? 0) ? 'warn' : undefined}
            />
          </div>

          {d.stats.enrolled > 0 ? (
            <div>
              <div className="flex h-2.5 overflow-hidden bg-[#eef2f7]">
                <div className="bg-emerald-500" style={{ width: `${(d.stats.onTime / d.stats.enrolled) * 100}%` }} />
                <div className="bg-amber-400" style={{ width: `${(d.stats.late / d.stats.enrolled) * 100}%` }} />
                <div
                  className={pastDue ? 'bg-rose-300' : 'bg-[#d0dae6]'}
                  style={{ width: `${(d.stats.missing / d.stats.enrolled) * 100}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-[#5c6b7a]">
                <Legend color="bg-emerald-500" label="On time" />
                <Legend color="bg-amber-400" label="Late" />
                <Legend color={pastDue ? 'bg-rose-300' : 'bg-[#d0dae6]'} label={pastDue ? 'Missing' : 'Waiting'} />
              </div>
            </div>
          ) : null}

          <div className="border border-[#e4ebf2] bg-[#fbfcfe] p-4">
            <SectionLabel>Instructions</SectionLabel>
            <p className="whitespace-pre-line text-sm leading-relaxed text-[#0b1220]">
              {d.assignment.description || <span className="text-[#9aa7b5]">No instructions written.</span>}
            </p>
            {d.assignment.attachmentUrl ? (
              <a href={d.assignment.attachmentUrl} target="_blank" rel="noreferrer" className={`${btn.link} mt-3`}>
                <Paperclip className="h-3.5 w-3.5" /> Assignment attachment
              </a>
            ) : null}
          </div>

          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <FilterChips
                label="Submission status"
                value={filter}
                onChange={setFilter}
                options={[
                  { id: 'all', label: 'Everyone', count: d.roster.length },
                  { id: 'submitted', label: 'Submitted', count: d.stats.submitted },
                  { id: 'late', label: 'Late', count: d.stats.late },
                  { id: 'missing', label: pastDue ? 'Missing' : 'Not yet', count: d.stats.missing },
                ]}
              />
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <label className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a96a5]" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Find a learner"
                    aria-label="Find a learner"
                    className="w-full border border-[#d0dae6] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#3a5f8a]"
                  />
                </label>
                <ExportButton
                  filename={`assignment-${d.assignment.title.slice(0, 40)}`}
                  label="CSV"
                  rows={() =>
                    d.roster.map((r) => ({
                      learner: r.name,
                      email: r.email,
                      status: rowStatus(r, pastDue).label,
                      submitted_at: r.submission ? fmtDateTime(r.submission.submittedAt) : '',
                      score: r.submission?.grade?.score ?? '',
                      max_score: r.submission?.grade?.maxScore ?? '',
                      feedback: r.submission?.grade?.feedback ?? '',
                    }))
                  }
                />
              </div>
            </div>

            {!roster.length ? (
              <EmptyBlock text={d.roster.length ? 'Nobody matches this filter.' : 'No learners are enrolled in this class yet.'} />
            ) : (
              <div className="border border-[#e4ebf2]">
                <ul className="divide-y divide-[#eef2f7]">
                  {pager.pageItems.map((r) => {
                    const st = rowStatus(r, pastDue);
                    const isOpen = expanded === r.userId && !!r.submission;
                    return (
                      <li key={r.userId}>
                        <button
                          type="button"
                          disabled={!r.submission}
                          onClick={() => setExpanded(isOpen ? null : r.userId)}
                          aria-expanded={isOpen}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors enabled:hover:bg-[#f7f9fc] disabled:cursor-default"
                        >
                          <Avatar name={r.name} src={r.avatar} size={34} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-[#0b1220]">{r.name}</p>
                            <p className="truncate text-xs text-[#7a8898]">{r.email}</p>
                          </div>
                          <div className="hidden text-right text-xs text-[#5c6b7a] sm:block">
                            {r.submission ? (
                              <>
                                <p>{fmtDateTime(r.submission.submittedAt)}</p>
                                <p className="text-[#9aa7b5]">
                                  {[r.submission.content && 'Text', r.submission.attachmentUrl && 'File'].filter(Boolean).join(' + ') ||
                                    'Empty'}
                                </p>
                              </>
                            ) : (
                              <p className="text-[#9aa7b5]">Nothing submitted</p>
                            )}
                          </div>
                          {r.submission?.grade ? (
                            <Pill tone="ink" className="justify-center tabular-nums">
                              {r.submission.grade.score}/{r.submission.grade.maxScore}
                            </Pill>
                          ) : r.submission ? (
                            <Pill tone="amber">Ungraded</Pill>
                          ) : null}
                          <Pill tone={st.tone} className="w-[72px] justify-center">
                            {st.label}
                          </Pill>
                          <ChevronDown
                            className={`h-4 w-4 shrink-0 text-[#9aa7b5] transition-transform ${isOpen ? 'rotate-180' : ''} ${
                              r.submission ? '' : 'invisible'
                            }`}
                          />
                        </button>
                        {isOpen && r.submission ? (
                          <div className="border-t border-[#eef2f7] bg-[#fbfcfe] px-4 py-4 sm:pl-[62px]">
                            <p className="mb-2 text-xs text-[#6a7a8c] sm:hidden">
                              Submitted {fmtDateTime(r.submission.submittedAt)}
                            </p>
                            {r.submission.content ? (
                              <div className="max-h-72 overflow-y-auto whitespace-pre-wrap border border-[#e4ebf2] bg-white p-3.5 text-sm leading-relaxed text-[#0b1220]">
                                {r.submission.content}
                              </div>
                            ) : (
                              <p className="text-sm text-[#9aa7b5]">No written answer.</p>
                            )}
                            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[#6a7a8c]">
                              {r.submission.attachmentUrl ? (
                                <a href={r.submission.attachmentUrl} target="_blank" rel="noreferrer" className={btn.link}>
                                  <FileText className="h-3.5 w-3.5" /> Open attached file
                                </a>
                              ) : null}
                              {r.submission.updatedAt &&
                              new Date(r.submission.updatedAt).getTime() - new Date(r.submission.submittedAt).getTime() > 60000 ? (
                                <span>Last edited {fmtDateTime(r.submission.updatedAt)}</span>
                              ) : null}
                              {r.submission.late && d.assignment.dueDate ? (
                                <span className="text-amber-800">
                                  Submitted after the {fmtDateTime(d.assignment.dueDate)} deadline
                                </span>
                              ) : null}
                            </div>
                            <GradeForm
                              key={`${r.submission.id}:${r.submission.grade?.gradedAt ?? ''}`}
                              classId={d.class.id}
                              assignmentId={d.assignment.id}
                              submission={r.submission}
                              onSaved={() => void details.refetch()}
                            />
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                <Pagination {...pager} noun="learners" />
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 ${color}`} />
      {label}
    </span>
  );
}
