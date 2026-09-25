import { useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Paperclip, Send } from 'lucide-react';
import type { AssignmentAnswer, Class } from '@/types/api';
import { getErrorMessage, submitAssignmentAnswer } from '@/lib/api';
import FileAttachment from './FileAttachment';

type Assignment = NonNullable<Class['assignments']>[number];
type Filter = 'todo' | 'submitted' | 'graded' | 'all';

function deadlineBadge(dueDate?: string): { label: string; className: string } | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const diffDays = Math.round((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const formatted = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  if (diffDays < 0) return { label: `Overdue · was due ${formatted}`, className: 'text-rose-800 bg-rose-50' };
  if (diffDays === 0) return { label: `Due today · ${formatted}`, className: 'text-amber-800 bg-amber-50' };
  if (diffDays <= 3) return { label: `Due in ${diffDays} day${diffDays === 1 ? '' : 's'} · ${formatted}`, className: 'text-amber-800 bg-amber-50' };
  return { label: `Due ${formatted}`, className: 'text-[#6b655c] bg-[#f6f4f0]' };
}

function statusOf(submission?: AssignmentAnswer): Exclude<Filter, 'all' | 'todo'> | 'todo' {
  if (submission?.grade) return 'graded';
  if (submission) return 'submitted';
  return 'todo';
}

function AssignmentCard({ classId, assignment, submission, onChanged }: {
  classId: string;
  assignment: Assignment;
  submission?: AssignmentAnswer;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(submission?.content || '');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const badge = deadlineBadge(assignment.dueDate);
  const state = statusOf(submission);

  const handleSubmit = async () => {
    if (!content.trim() && !file) {
      setError('Write an answer or attach a file');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await submitAssignmentAnswer(classId, assignment.id, { content: content.trim(), file });
      setEditing(false);
      setFile(null);
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="border border-[#e4dfd6] bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eee9e0] px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h3 className="font-serif text-lg leading-snug tracking-tight text-[#14110e]">{assignment.title}</h3>
          {assignment.description ? <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#3d3933]">{assignment.description}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {state === 'graded' ? (
            <span className="bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">Graded</span>
          ) : state === 'submitted' ? (
            <span className="bg-[#f6f4f0] px-2 py-0.5 text-xs font-medium text-[#6b655c]">Awaiting grade</span>
          ) : (
            <span className="bg-[#fbeee6] px-2 py-0.5 text-xs font-medium text-[#9a4518]">To do</span>
          )}
          {badge ? <span className={`whitespace-nowrap px-2 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span> : null}
        </div>
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-5">
        {assignment.attachmentUrl ? (
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-[#8a847a]">From your instructor</p>
            <FileAttachment url={assignment.attachmentUrl} />
          </div>
        ) : null}

        {submission?.grade && !editing ? (
          <div className="flex flex-wrap items-start gap-4 border border-[#f0d3c1] bg-[#fbeee6] p-4">
            <div className="text-center">
              <p className="font-serif text-3xl leading-none text-[#14110e]">
                {submission.grade.score}
                <span className="text-sm text-[#8a847a]">/{submission.grade.maxScore}</span>
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[#9a4518]">
                {Math.round((submission.grade.score / submission.grade.maxScore) * 100)}%
              </p>
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium text-[#14110e]">
                Graded{submission.grade.gradedByName ? ` by ${submission.grade.gradedByName}` : ''} · {new Date(submission.grade.gradedAt).toLocaleDateString()}
              </p>
              {submission.grade.feedback ? (
                <p className="mt-1 whitespace-pre-line text-[#3d3933]">{submission.grade.feedback}</p>
              ) : (
                <p className="mt-1 text-[#8a847a]">No written feedback.</p>
              )}
            </div>
          </div>
        ) : null}

        {submission && !editing ? (
          <div className="border border-emerald-100 bg-emerald-50 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-emerald-800">
              <CheckCircle2 className="h-4 w-4" /> Submitted {new Date(submission.submittedAt).toLocaleString()}
            </p>
            {submission.content ? <p className="mb-2 whitespace-pre-line text-sm text-[#3d3933]">{submission.content}</p> : null}
            {submission.attachmentUrl ? <FileAttachment url={submission.attachmentUrl} /> : null}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-3 text-xs font-medium text-[#6b655c] underline hover:text-[#14110e]"
            >
              {submission.grade ? 'Resubmit (your instructor will grade it again)' : 'Update submission'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-[#8a847a]">Your answer</span>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your answer…"
                rows={5}
                className="w-full border border-[#e4dfd6] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#14110e]"
              />
            </label>
            <label className="flex cursor-pointer items-center gap-2 border border-dashed border-[#d5cfc4] bg-[#faf8f5] px-3 py-3 text-sm text-[#6b655c] hover:border-[#14110e]">
              <Paperclip className="h-4 w-4 shrink-0 text-[#c45c26]" />
              <span className="min-w-0 flex-1 truncate">{file ? file.name : 'Attach a file (optional)'}</span>
              <input type="file" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="inline-flex items-center gap-1.5 bg-[#14110e] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {saving ? 'Submitting…' : submission ? 'Save changes' : 'Submit answer'}
              </button>
              {submission ? (
                <button type="button" onClick={() => { setEditing(false); setFile(null); setError(null); }} className="px-2 text-sm text-[#6b655c] hover:text-[#14110e]">
                  Cancel
                </button>
              ) : null}
            </div>
            {error ? <p className="text-xs text-rose-700">{error}</p> : null}
          </div>
        )}
      </div>
    </article>
  );
}

/** Student-facing assignment list: deadlines, instructor files, and an inline answer form. */
export default function StudentAssignments({ classId, assignments, submissions, onChanged }: {
  classId: string;
  assignments: Assignment[];
  submissions: AssignmentAnswer[];
  onChanged: () => void;
}) {
  const [filter, setFilter] = useState<Filter>('todo');
  const byId = useMemo(() => new Map(submissions.map((s) => [s.assignmentId, s])), [submissions]);
  const counts = useMemo(() => {
    const base = { todo: 0, submitted: 0, graded: 0, all: assignments.length };
    for (const a of assignments) base[statusOf(byId.get(a.id))] += 1;
    return base;
  }, [assignments, byId]);
  const list = assignments.filter((a) => filter === 'all' || statusOf(byId.get(a.id)) === filter);

  if (!assignments.length) {
    return (
      <p className="border border-dashed border-[#ddd6ca] py-10 text-center text-sm text-[#6b655c]">
        No assignments have been added by the instructor.
      </p>
    );
  }

  const chips: { id: Filter; label: string }[] = [
    { id: 'todo', label: 'To do' },
    { id: 'submitted', label: 'Awaiting grade' },
    { id: 'graded', label: 'Graded' },
    { id: 'all', label: 'All' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter assignments">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            role="tab"
            aria-selected={filter === chip.id}
            onClick={() => setFilter(chip.id)}
            className={`px-3 py-1.5 text-xs transition-colors ${
              filter === chip.id ? 'bg-[#14110e] text-white' : 'border border-[#e4dfd6] bg-white text-[#6b655c] hover:border-[#14110e]/40'
            }`}
          >
            {chip.label}
            <span className={`ml-1.5 tabular-nums ${filter === chip.id ? 'text-white/70' : 'text-[#b5aea3]'}`}>{counts[chip.id]}</span>
          </button>
        ))}
      </div>
      {list.length ? (
        <div className="space-y-4">
          {list.map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              classId={classId}
              assignment={assignment}
              submission={byId.get(assignment.id)}
              onChanged={onChanged}
            />
          ))}
        </div>
      ) : (
        <p className="border border-dashed border-[#ddd6ca] py-10 text-center text-sm text-[#6b655c]">
          {filter === 'todo' ? "You're all caught up on this class." : 'Nothing in this list yet.'}
        </p>
      )}
    </div>
  );
}
