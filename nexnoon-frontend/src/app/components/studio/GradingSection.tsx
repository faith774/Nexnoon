import { useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, Paperclip } from 'lucide-react';
import apiClient, { getErrorMessage } from '@/lib/api/client';
import { useStudio } from './context';
import type { GradingItem } from './types';
import { Avatar, EmptyBlock, Field, FilterChips, Modal, Pagination, Pill, btn, daysAgo, inputCls, matches, usePagination, useSticky } from './ui';
import { useTimeFormat } from '@/lib/timezone';

export default function GradingSection() {
  const { data, search } = useStudio();
  const [classFilter, setClassFilter] = useState('all');
  const [grading, setGrading] = useState<GradingItem | null>(null);

  const classOptions = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const g of data.gradingQueue) {
      const cur = counts.get(g.classId) || { label: g.classTitle, count: 0 };
      counts.set(g.classId, { ...cur, count: cur.count + 1 });
    }
    return [
      { id: 'all', label: 'All classes', count: data.gradingQueue.length },
      { id: 'late', label: 'Submitted late', count: data.gradingQueue.filter((g) => g.late).length },
      ...[...counts.entries()].map(([id, v]) => ({ id, label: v.label.length > 28 ? `${v.label.slice(0, 26)}…` : v.label, count: v.count })),
    ].filter((o) => o.id === 'all' || o.count > 0 || o.id === classFilter);
  }, [data.gradingQueue, classFilter]);

  const rows = data.gradingQueue.filter(
    (g) =>
      (classFilter === 'all' || (classFilter === 'late' ? g.late : g.classId === classFilter)) &&
      matches(search, g.learnerName, g.assignmentTitle, g.classTitle)
  );
  const pager = usePagination(rows, 20, `${classFilter}|${search}`);

  if (!data.gradingQueue.length) {
    return (
      <div className="flex flex-col items-center gap-3 border border-[#e4dfd6] bg-white px-6 py-14 text-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        <p className="font-serif text-xl text-[#14110e]">Nothing to grade</p>
        <p className="max-w-md text-sm text-[#6b655c]">New submissions from your learners will show up here, oldest first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <FilterChips label="Filter submissions" value={classFilter} onChange={setClassFilter} options={classOptions} />

      {rows.length ? (
        <div className="border border-[#e4dfd6] bg-white">
          <ul className="divide-y divide-[#eee9e0]">
            {pager.pageItems.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <Avatar name={g.learnerName} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[#14110e]">
                    <span className="font-medium">{g.learnerName}</span> · {g.assignmentTitle}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[#8a847a]">
                    {g.classTitle} · submitted {daysAgo(g.submittedAt)}
                  </p>
                </div>
                {g.late ? <Pill tone="amber">Late</Pill> : null}
                {g.attachmentUrl ? <Paperclip className="h-4 w-4 text-[#b5aea3]" aria-label="Has attachment" /> : null}
                <button type="button" onClick={() => setGrading(g)} className={btn.primary}>
                  Grade
                </button>
              </li>
            ))}
          </ul>
          <Pagination {...pager} noun="submissions" />
        </div>
      ) : (
        <EmptyBlock text="No submissions match this filter." />
      )}

      <GradeModal item={grading} onClose={() => setGrading(null)} />
    </div>
  );
}

export function GradeModal({ item, onClose }: { item: GradingItem | null; onClose: () => void }) {
  const t = useTimeFormat();
  const { refetch, flash } = useStudio();
  const shown = useSticky(item);
  const [score, setScore] = useState('');
  const [maxScore, setMaxScore] = useState('100');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [lastId, setLastId] = useState<string | null>(null);

  if (item && item.id !== lastId) {
    setLastId(item.id);
    setScore('');
    setMaxScore('100');
    setFeedback('');
    setErr('');
  }

  const s = Number(score);
  const m = Number(maxScore);
  const valid = score.trim() !== '' && Number.isFinite(s) && Number.isFinite(m) && m > 0 && s >= 0 && s <= m;

  async function save() {
    if (!shown || !valid) {
      setErr(m > 0 && s > m ? 'Score can’t be higher than the maximum.' : 'Enter a score between 0 and the maximum.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      await apiClient.put(`/classes/${shown.classId}/assignments/${shown.assignmentId}/submissions/${shown.id}/grade`, {
        score: s,
        maxScore: m,
        feedback: feedback.trim(),
      });
      flash({ type: 'ok', text: `Graded ${shown.learnerName}: ${s}/${m}` });
      onClose();
      await refetch();
    } catch (e) {
      setErr(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={Boolean(item)}
      onClose={onClose}
      size="lg"
      eyebrow={shown?.classTitle}
      title={shown ? `${shown.assignmentTitle}` : ''}
      subtitle={shown ? `${shown.learnerName} · submitted ${t.dateTime(shown.submittedAt)}${shown.late ? ' (late)' : ''}` : undefined}
      footer={
        <>
          <button type="button" onClick={onClose} className={btn.secondary}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving} className={btn.primary}>
            {saving ? 'Saving…' : 'Save grade'}
          </button>
        </>
      }
    >
      {shown ? (
        <div className="space-y-5">
          <div>
            <p className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-[#8a847a]">Submission</p>
            {shown.content ? (
              <div className="max-h-72 overflow-y-auto whitespace-pre-wrap border border-[#eee9e0] bg-[#faf8f5] p-4 text-sm leading-relaxed text-[#3d3933]">
                {shown.content}
              </div>
            ) : (
              <p className="text-sm text-[#8a847a]">No written answer.</p>
            )}
            {shown.attachmentUrl ? (
              <a href={shown.attachmentUrl} target="_blank" rel="noreferrer" className={`${btn.link} mt-2`}>
                <Paperclip className="h-3.5 w-3.5" /> Open attachment <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Score">
              <input type="number" min={0} inputMode="decimal" value={score} onChange={(e) => setScore(e.target.value)} className={inputCls} autoFocus />
            </Field>
            <Field label="Out of">
              <input type="number" min={1} inputMode="decimal" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Feedback" hint="The learner sees this with their grade.">
            <textarea rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} className={inputCls} placeholder="What went well, and what to work on next" />
          </Field>
          {err ? <p className="text-sm text-rose-700">{err}</p> : null}
        </div>
      ) : null}
    </Modal>
  );
}
