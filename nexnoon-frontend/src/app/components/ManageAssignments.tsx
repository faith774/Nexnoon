import { useRef, useState } from 'react';
import { Loader2, Plus, Trash2, ClipboardList } from 'lucide-react';
import { apiClient, getErrorMessage, uploadFile } from '@/lib/api';
import FileAttachment from './FileAttachment';

type Assignment = {
  id?: string;
  title: string;
  description?: string;
  dueDate?: string;
  attachmentUrl?: string;
};

/** Instructor-only assignment manager: add (with an optional attachment upload) or delete an assignment. */
export default function ManageAssignments({
  classId,
  assignments,
  submissionStats = [],
  onChanged,
}: {
  classId: string;
  assignments: Assignment[];
  submissionStats?: { assignmentId: string; count: number }[];
  onChanged: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDueDate('');
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowForm(false);
  };

  const handleAdd = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let attachmentUrl: string | undefined;
      if (attachment) {
        attachmentUrl = (await uploadFile(`/classes/${classId}/uploads`, attachment)).url;
      }
      const newAssignment: Assignment = {
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        attachmentUrl,
      };
      await apiClient.patch(`/classes/${classId}`, { assignments: [...assignments, newAssignment] });
      resetForm();
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (index: number) => {
    setRemovingIndex(index);
    setError(null);
    try {
      await apiClient.patch(`/classes/${classId}`, {
        assignments: assignments.filter((_, i) => i !== index),
      });
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setRemovingIndex(null);
    }
  };

  const countFor = (a: Assignment) => {
    if (!a.id) return 0;
    return submissionStats.find((s) => s.assignmentId === a.id)?.count || 0;
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <p className="text-sm text-[#6b655c]">
          {assignments.length} assignment{assignments.length === 1 ? '' : 's'}
        </p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 bg-[#c45c26] text-white hover:bg-[#a84c1e] transition-colors"
        >
          <Plus className="h-4 w-4" />
          {showForm ? 'Cancel' : 'New assignment'}
        </button>
      </div>

      {showForm && (
        <div className="border border-[#e4dfd6] bg-[#faf8f5] p-5 mb-6 space-y-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#6b655c]">Create assignment</p>
          <input
            type="text"
            placeholder="Assignment title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-[#e4dfd6] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#14110e]"
          />
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border border-[#e4dfd6] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#14110e]"
          />
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[#6b655c]">Due date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="border border-[#e4dfd6] bg-white px-3 py-2.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[#6b655c]">Attachment</span>
              <input
                ref={fileInputRef}
                type="file"
                onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                className="text-sm file:mr-3 file:border-0 file:bg-[#14110e] file:text-white file:px-3 file:py-1.5 file:text-xs"
              />
            </label>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={handleAdd}
            disabled={saving}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 bg-[#14110e] text-white hover:bg-black/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Publish assignment'}
          </button>
        </div>
      )}

      {error && !showForm && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {assignments.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-[#ddd6ca]">
          <ClipboardList className="h-8 w-8 text-[#d5cfc4] mx-auto mb-3" />
          <p className="text-sm text-[#6b655c]">No assignments yet. Create the first one for your learners.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((a, index) => (
            <article key={a.id || index} className="border border-[#e4dfd6] bg-white p-4">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="min-w-0">
                  <p className="font-medium text-[#14110e]">{a.title}</p>
                  <p className="text-xs text-[#8a847a] mt-1">
                    {countFor(a)} submission{countFor(a) === 1 ? '' : 's'}
                    {a.dueDate
                      ? ` · Due ${new Date(a.dueDate).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}`
                      : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  disabled={removingIndex === index}
                  className="text-[#8a847a] hover:text-red-600 disabled:opacity-50 flex-shrink-0 p-1"
                  aria-label="Delete assignment"
                >
                  {removingIndex === index ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
              {a.description && <p className="text-sm text-[#3d3933] mt-2 mb-2">{a.description}</p>}
              {a.attachmentUrl && <FileAttachment url={a.attachmentUrl} />}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
