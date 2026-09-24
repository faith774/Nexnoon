import { useState } from 'react';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import type { AssignmentAnswer, Class } from '@/types/api';
import { getErrorMessage, submitAssignmentAnswer } from '@/lib/api';
import FileAttachment from './FileAttachment';

type Assignment = NonNullable<Class['assignments']>[number];

function deadlineBadge(dueDate?: string): { label: string; className: string } | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const diffDays = Math.round((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const formatted = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  if (diffDays < 0) return { label: `Overdue · was due ${formatted}`, className: 'text-red-700 bg-red-50' };
  if (diffDays === 0) return { label: `Due today · ${formatted}`, className: 'text-amber-700 bg-amber-50' };
  if (diffDays <= 3) return { label: `Due in ${diffDays} day${diffDays === 1 ? '' : 's'} · ${formatted}`, className: 'text-amber-700 bg-amber-50' };
  return { label: `Due ${formatted}`, className: 'text-gray-600 bg-gray-100' };
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
    <article className="border border-[#e4dfd6] bg-white p-4 mb-4">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
        <h3 className="font-medium text-[#14110e]">{assignment.title}</h3>
        {badge && <span className={`text-xs font-medium px-2 py-0.5 whitespace-nowrap ${badge.className}`}>{badge.label}</span>}
      </div>
      {assignment.description && <p className="text-sm text-[#3d3933] mb-3">{assignment.description}</p>}
      {assignment.attachmentUrl && <div className="mb-3"><FileAttachment url={assignment.attachmentUrl} /></div>}

      {submission && !editing ? (
        <div className="bg-emerald-50 border border-emerald-100 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-800 mb-1">
            <CheckCircle2 className="h-4 w-4" /> Submitted {new Date(submission.submittedAt).toLocaleString()}
          </p>
          {submission.content && <p className="text-sm text-[#3d3933] whitespace-pre-line mb-2">{submission.content}</p>}
          {submission.attachmentUrl && <FileAttachment url={submission.attachmentUrl} />}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-[#6b655c] hover:text-[#14110e] underline mt-2"
          >
            Update submission
          </button>
        </div>
      ) : (
        <div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your answer…"
            rows={3}
            className="w-full border border-[#e4dfd6] px-3 py-2 text-sm mb-2 outline-none focus:border-[#14110e]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-xs flex-1 min-w-0"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 bg-[#14110e] text-white hover:bg-black/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {saving ? 'Submitting…' : submission ? 'Save changes' : 'Submit answer'}
            </button>
            {submission && (
              <button type="button" onClick={() => setEditing(false)} className="text-xs text-[#6b655c] hover:text-[#14110e]">
                Cancel
              </button>
            )}
          </div>
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </div>
      )}
    </article>
  );
}

/** Student-facing assignment list: clear deadlines, a downloadable attachment, and an inline answer/submit form. */
export default function StudentAssignments({ classId, assignments, submissions, onChanged }: {
  classId: string;
  assignments: Assignment[];
  submissions: AssignmentAnswer[];
  onChanged: () => void;
}) {
  if (!assignments.length) {
    return (
      <p className="text-sm text-[#6b655c] py-8 text-center border border-dashed border-[#ddd6ca]">
        No assignments have been added by the instructor.
      </p>
    );
  }

  return (
    <>
      {assignments.map((assignment) => (
        <AssignmentCard
          key={assignment.id}
          classId={classId}
          assignment={assignment}
          submission={submissions.find((s) => s.assignmentId === assignment.id)}
          onChanged={onChanged}
        />
      ))}
    </>
  );
}
