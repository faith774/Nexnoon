import { useRef, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { apiClient, getErrorMessage, uploadFile } from '@/lib/api';
import FileAttachment from './FileAttachment';

type Assignment = { title: string; description?: string; dueDate?: string; attachmentUrl?: string };

/** Instructor-only assignment manager: add (with an optional attachment upload) or delete an assignment. */
export default function ManageAssignments({ classId, assignments, onChanged }: {
  classId: string;
  assignments: Assignment[];
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

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDueDate('');
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
      await apiClient.patch(`/classes/${classId}`, { assignments: assignments.filter((_, i) => i !== index) });
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setRemovingIndex(null);
    }
  };

  return (
    <div className="mb-6 border border-gray-200 rounded-xl p-4">
      <h3 className="text-sm font-bold text-gray-900 mb-3">Assignments</h3>

      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <input
          type="text"
          placeholder="Assignment title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm sm:col-span-2"
        />
        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm sm:col-span-2"
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
        <input
          ref={fileInputRef}
          type="file"
          onChange={(e) => setAttachment(e.target.files?.[0] || null)}
          className="text-sm"
        />
      </div>

      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

      <button
        type="button"
        onClick={handleAdd}
        disabled={saving}
        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-black text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-4"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        {saving ? 'Saving…' : 'Add assignment'}
      </button>

      {assignments.length === 0 ? (
        <p className="text-sm text-gray-500">No assignments yet.</p>
      ) : (
        <div className="space-y-3">
          {assignments.map((a, index) => (
            <article key={index} className="border border-gray-100 bg-gray-50 rounded-lg p-3">
              <div className="flex items-start justify-between gap-3 mb-1">
                <p className="font-medium text-gray-900 text-sm">{a.title}</p>
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  disabled={removingIndex === index}
                  className="text-gray-400 hover:text-red-600 disabled:opacity-50 flex-shrink-0"
                  aria-label="Delete assignment"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {a.description && <p className="text-sm text-gray-600 mb-1">{a.description}</p>}
              {a.dueDate && <p className="text-xs text-gray-500 mb-2">Due {new Date(a.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>}
              {a.attachmentUrl && <FileAttachment url={a.attachmentUrl} />}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
