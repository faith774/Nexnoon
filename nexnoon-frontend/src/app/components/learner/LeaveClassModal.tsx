import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Modal, btn } from './ui';
import { enrollmentService, formatMoney, getErrorMessage, type LeaveTerms } from '@/lib/api';
import { useTimeFormat } from '@/lib/timezone';
import type { LearnerClass } from './types';

export default function LeaveClassModal({ cls, onClose, onLeft }: { cls: LearnerClass | null; onClose: () => void; onLeft: () => void }) {
  const t = useTimeFormat();
  const [terms, setTerms] = useState<LeaveTerms | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    setTerms(null);
    setError('');
    setConfirmText('');
    if (!cls) return;
    enrollmentService.leaveTerms(cls.enrollmentId).then(setTerms).catch((err) => setError(getErrorMessage(err)));
  }, [cls]);

  async function leave() {
    if (!cls) return;
    setBusy(true);
    try {
      const result = await enrollmentService.leave(cls.enrollmentId);
      toast.success(result.message);
      onLeft();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const ready = !!terms && confirmText.trim().toLowerCase() === 'leave';

  return (
    <Modal
      open={!!cls}
      onClose={onClose}
      size="sm"
      eyebrow="Leave class"
      title={cls?.title || ''}
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose}>
            Stay enrolled
          </button>
          <button type="button" className={`${btn.danger} border-rose-600 bg-rose-600 text-white hover:bg-rose-700`} disabled={!ready || busy} onClick={() => void leave()}>
            {busy ? 'Leaving…' : terms?.refundable ? `Leave and refund ${formatMoney(terms.amount, terms.currency)}` : 'Leave class'}
          </button>
        </>
      }
    >
      {!terms && !error ? <p className="text-sm text-[#6b655c]">Checking your refund options…</p> : null}
      {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">{error}</p> : null}
      {terms ? (
        <div className="space-y-4 text-sm">
          {terms.refundable ? (
            <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-emerald-900">
              <RotateCcw className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                You'll get a <strong>full refund of {formatMoney(terms.amount, terms.currency)}</strong> to your card, usually within 5–10 business days.
                {terms.refundDeadline ? ` This option ends ${t.dayTime(terms.refundDeadline)}.` : ''}
              </p>
            </div>
          ) : terms.paid ? (
            <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                The refund window has closed (refunds are available for {terms.windowDays} day{terms.windowDays === 1 ? '' : 's'} after paying and before the first session). You can still leave, but <strong>you won't be refunded</strong>. If you rejoin later while seats are open, you won't pay again.
              </p>
            </div>
          ) : (
            <div className="flex gap-3 rounded-xl border border-[#e4dfd6] bg-[#faf8f5] p-3.5 text-[#3d3933]">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#c45c26]" />
              <p>This is a free class, so there's nothing to refund.</p>
            </div>
          )}
          <ul className="list-disc space-y-1 pl-5 text-[#6b655c]">
            <li>You'll lose access to the classroom, sessions and materials.</li>
            <li>Your seat goes to the next person on the waitlist.</li>
          </ul>
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.14em] text-[#6b655c]">Type “leave” to confirm</span>
            <input
              className="mt-1.5 w-full rounded-xl border border-[#d5cfc4] bg-white px-3 py-2.5 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
            />
          </label>
        </div>
      ) : null}
    </Modal>
  );
}
