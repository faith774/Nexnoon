import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { Modal, btn, inputCls } from './ui';
import { apiClient, getErrorMessage } from '@/lib/api';
import type { LearnerClass } from './types';

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

export default function ReviewModal({ cls, onClose, onSaved }: { cls: LearnerClass | null; onClose: () => void; onSaved: () => void }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const existing = cls?.review || null;

  useEffect(() => {
    setRating(cls?.review?.rating || 0);
    setComment(cls?.review?.comment || '');
    setError('');
  }, [cls]);

  async function save() {
    if (!cls || !rating) return;
    setBusy(true);
    setError('');
    try {
      if (existing) await apiClient.patch(`/reviews/${existing.id}`, { rating, comment: comment.trim() });
      else await apiClient.post('/reviews', { classId: cls.id, rating, comment: comment.trim() || undefined });
      toast.success(existing ? 'Review updated' : 'Thanks for your review');
      onSaved();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing) return;
    setBusy(true);
    try {
      await apiClient.delete(`/reviews/${existing.id}`);
      toast.success('Review deleted');
      onSaved();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const shown = hover || rating;

  return (
    <Modal
      open={!!cls}
      onClose={onClose}
      size="sm"
      eyebrow={existing ? 'Edit your review' : 'Review this class'}
      title={cls?.title || ''}
      subtitle={cls ? `with ${cls.instructor.name}` : undefined}
      footer={
        <>
          {existing ? (
            <button type="button" className={`${btn.danger} mr-auto`} disabled={busy} onClick={() => void remove()}>
              Delete
            </button>
          ) : null}
          <button type="button" className={btn.secondary} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={btn.accent} disabled={!rating || busy} onClick={() => void save()}>
            {busy ? 'Saving…' : existing ? 'Save changes' : 'Post review'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <div role="radiogroup" aria-label="Rating" className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n === 1 ? '' : 's'}`}
                onMouseEnter={() => setHover(n)}
                onClick={() => setRating(n)}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star className={`h-8 w-8 ${n <= shown ? 'fill-[#c45c26] text-[#c45c26]' : 'text-[#d5cfc4]'}`} />
              </button>
            ))}
            <span className="ml-2 text-sm text-[#6b655c]">{LABELS[shown] || 'Tap to rate'}</span>
          </div>
        </div>
        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.14em] text-[#6b655c]">What stood out? (optional)</span>
          <textarea
            className={`${inputCls} mt-1.5 min-h-[110px]`}
            maxLength={2000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="The pace, the instructor, what you can do now that you couldn't before…"
          />
        </label>
        <p className="text-xs text-[#8a847a]">Your name and review appear on the class page.</p>
        {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">{error}</p> : null}
      </div>
    </Modal>
  );
}
