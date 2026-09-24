import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Banknote, Send, Wallet } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { useAdmin, useAdminAction } from './context';
import {
  EmptyBlock,
  ExportButton,
  Field,
  FilterChips,
  Modal,
  Pagination,
  Panel,
  Pill,
  StatTile,
  btn,
  fmtDateTime,
  inputCls,
  matches,
  money,
  usePagination,
  useSticky,
  type Tone,
} from './ui';

type PayoutRow = {
  id: string;
  instructorId: string;
  instructorName: string;
  instructorEmail: string;
  instructorStatus: string;
  payoutsEnabled: boolean;
  stripeConnected: boolean;
  currency: string;
  amount: number;
  fee: number;
  net: number;
  status: 'requested' | 'processing' | 'paid' | 'rejected' | 'failed';
  method: 'stripe' | 'manual' | null;
  reference: string;
  note: string;
  failureReason: string;
  items: number;
  requestedAt: string;
  decidedAt: string | null;
};
type BalanceRow = {
  instructorId: string;
  instructorName: string;
  instructorEmail: string;
  payoutsEnabled: boolean;
  stripeConnected: boolean;
  currency: string;
  pending: number;
  available: number;
  requested: number;
  paid: number;
};
type PayoutsData = {
  stripeReady: boolean;
  heldEarnings: number;
  totals: { currency: string; platformFee: number; gross: number }[];
  payouts: PayoutRow[];
  balances: BalanceRow[];
};

const KEY = ['admin-payouts'];
const STATUS_TONE: Record<PayoutRow['status'], Tone> = { requested: 'amber', processing: 'blue', paid: 'green', rejected: 'slate', failed: 'rose' };
type Filter = 'open' | 'paid' | 'rejected' | 'all';

const sumBy = <T,>(rows: T[], pick: (r: T) => number) => rows.reduce((s, r) => s + pick(r), 0);
const byCurrency = <T extends { currency: string }>(rows: T[], pick: (r: T) => number) => {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.currency, (m.get(r.currency) || 0) + pick(r));
  const parts = [...m].filter(([, v]) => Math.abs(v) > 0.001).map(([c, v]) => money(v, c));
  return parts.length ? parts.join(' · ') : money(0);
};

export default function PayoutsSection() {
  const { search } = useAdmin();
  const { data, isLoading, isError, refetch } = useQuery<PayoutsData>({
    queryKey: KEY,
    queryFn: async () => (await apiClient.get('/admin/payouts')).data.data,
    staleTime: 10_000,
  });
  const [filter, setFilter] = useState<Filter>('open');
  const [acting, setActing] = useState<{ payout: PayoutRow; mode: 'manual' | 'reject' } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const run = useAdminAction();
  const qc = useQueryClient();

  const payouts = data?.payouts || [];
  const inFilter = (p: PayoutRow, f: Filter) =>
    f === 'all' || (f === 'open' ? ['requested', 'failed', 'processing'].includes(p.status) : p.status === f);
  const rows = payouts.filter((p) => inFilter(p, filter)).filter((p) => matches(search, p.instructorName, p.instructorEmail, p.reference));
  const pager = usePagination(rows, 10, `${filter}|${search}`);
  const balances = (data?.balances || []).filter((b) => matches(search, b.instructorName, b.instructorEmail));
  const balPager = usePagination(balances, 10, search);

  async function sendStripe(p: PayoutRow) {
    if (!window.confirm(`Send ${money(p.net, p.currency)} to ${p.instructorName} via Stripe? This moves real money.`)) return;
    setBusy(p.id);
    await run(() => apiClient.post(`/admin/payouts/${p.id}/approve`, { method: 'stripe' }), { refresh: false });
    await qc.invalidateQueries({ queryKey: KEY });
    setBusy(null);
  }

  if (isLoading) return <div className="h-48 animate-pulse bg-white" />;
  if (isError || !data)
    return (
      <EmptyBlock
        text="Couldn’t load payouts."
        action={
          <button type="button" className={btn.secondary} onClick={() => void refetch()}>
            Try again
          </button>
        }
      />
    );

  const open = payouts.filter((p) => p.status === 'requested' || p.status === 'failed');

  return (
    <div className="space-y-5">
      {!data.stripeReady ? (
        <div className="flex gap-3 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Stripe isn’t configured on the server, so payouts are sent manually (bank, Wise or Payoneer) and recorded here with a reference. Add a Stripe secret key to
            enable Connect transfers.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Awaiting payout" value={open.length} hint={byCurrency(open, (p) => p.net)} tone={open.length ? 'warn' : undefined} onClick={() => setFilter('open')} />
        <StatTile label="Withdrawable by instructors" value={byCurrency(data.balances, (b) => b.available)} hint="Past the refund window" />
        <StatTile
          label="In refund window"
          value={byCurrency(data.balances, (b) => b.pending)}
          hint={data.heldEarnings ? `${data.heldEarnings} on hold (cancelled / unscheduled)` : 'Released after class end'}
        />
        <StatTile label="Nexnoon commission" value={byCurrency(data.totals, (t) => t.platformFee)} hint={`of ${byCurrency(data.totals, (t) => t.gross)} sales`} />
      </div>

      <Panel
        title="Payout requests"
        subtitle="Instructors request their withdrawable balance. The transfer fee is deducted from their share."
        icon={<Send className="h-4 w-4" />}
        actions={
          <ExportButton
            filename="payouts"
            rows={() =>
              rows.map((p) => ({
                requested: fmtDateTime(p.requestedAt),
                instructor: p.instructorName,
                email: p.instructorEmail,
                currency: p.currency.toUpperCase(),
                amount: p.amount,
                fee: p.fee,
                net: p.net,
                status: p.status,
                method: p.method || '',
                reference: p.reference,
                decided: p.decidedAt ? fmtDateTime(p.decidedAt) : '',
                note: p.note || p.failureReason,
              }))
            }
          />
        }
        bodyClassName=""
      >
        <div className="border-b border-[#e4ebf2] px-5 py-3 md:px-6">
          <FilterChips
            label="Status"
            value={filter}
            onChange={setFilter}
            options={(['open', 'paid', 'rejected', 'all'] as const).map((id) => ({
              id,
              label: id === 'open' ? 'Needs action' : id === 'all' ? 'All' : id,
              count: payouts.filter((p) => inFilter(p, id)).length,
            }))}
          />
        </div>
        {!rows.length ? (
          <div className="p-5 md:p-6">
            <EmptyBlock text={filter === 'open' ? 'No payout requests waiting.' : 'Nothing in this filter.'} />
          </div>
        ) : (
          <>
            <ul className="divide-y divide-[#eef2f7]">
              {pager.pageItems.map((p) => {
                const actionable = p.status === 'requested' || p.status === 'failed';
                const canStripe = data.stripeReady && p.payoutsEnabled;
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-4 px-5 py-4 md:px-6">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-[#0b1220]">
                        {p.instructorName}
                        <Pill tone={STATUS_TONE[p.status]}>{p.status}</Pill>
                        {data.stripeReady ? (
                          <Pill tone={p.payoutsEnabled ? 'green' : p.stripeConnected ? 'amber' : 'slate'}>
                            {p.payoutsEnabled ? 'Stripe ready' : p.stripeConnected ? 'Stripe incomplete' : 'No Stripe'}
                          </Pill>
                        ) : null}
                      </p>
                      <p className="text-xs text-[#7a8898]">
                        {p.instructorEmail} · requested {fmtDateTime(p.requestedAt)} · {p.items} earning{p.items === 1 ? '' : 's'}
                        {p.reference ? ` · ref ${p.reference}` : ''}
                      </p>
                      {p.failureReason ? <p className="mt-1 text-xs text-rose-700">Last attempt failed: {p.failureReason}</p> : null}
                      {p.note ? <p className="mt-1 text-xs text-[#5c6b7a]">Note: {p.note}</p> : null}
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-medium tabular-nums text-[#0b1220]">{money(p.net, p.currency)}</p>
                      <p className="text-xs tabular-nums text-[#7a8898]">
                        {money(p.amount, p.currency)} − {money(p.fee, p.currency)} fee
                      </p>
                    </div>
                    {actionable ? (
                      <div className="flex flex-wrap gap-2">
                        {canStripe ? (
                          <button type="button" className={btn.primary} disabled={busy === p.id} onClick={() => void sendStripe(p)}>
                            <Send className="h-3.5 w-3.5" /> {busy === p.id ? 'Sending…' : 'Send via Stripe'}
                          </button>
                        ) : null}
                        <button type="button" className={canStripe ? btn.secondary : btn.primary} onClick={() => setActing({ payout: p, mode: 'manual' })}>
                          <Banknote className="h-3.5 w-3.5" /> Mark paid
                        </button>
                        <button type="button" className={btn.danger} onClick={() => setActing({ payout: p, mode: 'reject' })}>
                          Decline
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <Pagination {...pager} noun="payouts" />
          </>
        )}
      </Panel>

      <Panel
        title="Instructor balances"
        subtitle="Pending = inside the refund window. Available = can be requested."
        icon={<Wallet className="h-4 w-4" />}
        actions={
          <ExportButton
            filename="instructor-balances"
            rows={() =>
              balances.map((b) => ({
                instructor: b.instructorName,
                email: b.instructorEmail,
                currency: b.currency.toUpperCase(),
                pending: b.pending,
                available: b.available,
                requested: b.requested,
                paid: b.paid,
                stripe: b.payoutsEnabled ? 'ready' : b.stripeConnected ? 'incomplete' : 'not connected',
              }))
            }
          />
        }
        bodyClassName=""
      >
        {!balances.length ? (
          <div className="p-5 md:p-6">
            <EmptyBlock text="No instructor earnings yet. They appear once learners pay for classes." />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#e4ebf2] bg-[#f7f9fc] text-[11px] uppercase tracking-wider text-[#6a7a8c]">
                    {['Instructor', 'Pending', 'Available', 'Requested', 'Paid out', 'Stripe'].map((h) => (
                      <th key={h} className="px-4 py-2.5 font-medium first:pl-5 md:first:pl-6">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {balPager.pageItems.map((b) => (
                    <tr key={`${b.instructorId}:${b.currency}`} className="border-b border-[#eef2f7] last:border-0">
                      <td className="py-3 pl-5 pr-4 md:pl-6">
                        <p className="font-medium text-[#0b1220]">{b.instructorName}</p>
                        <p className="text-xs text-[#7a8898]">{b.instructorEmail}</p>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{money(b.pending, b.currency)}</td>
                      <td className="px-4 py-3 font-medium tabular-nums">{money(b.available, b.currency)}</td>
                      <td className="px-4 py-3 tabular-nums">{money(b.requested, b.currency)}</td>
                      <td className="px-4 py-3 tabular-nums text-[#5c6b7a]">{money(b.paid, b.currency)}</td>
                      <td className="px-4 py-3">
                        <Pill tone={b.payoutsEnabled ? 'green' : b.stripeConnected ? 'amber' : 'slate'}>
                          {b.payoutsEnabled ? 'ready' : b.stripeConnected ? 'incomplete' : 'not connected'}
                        </Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination {...balPager} noun="balances" />
          </>
        )}
      </Panel>

      <p className="text-xs text-[#7a8898]">
        Totals: {sumBy(data.balances, (b) => b.paid) ? `${byCurrency(data.balances, (b) => b.paid)} paid out so far.` : 'No payouts sent yet.'} Refunds are taken back from the instructor’s next
        payout automatically.
      </p>

      <PayoutActionModal pending={acting} onClose={() => setActing(null)} onDone={() => qc.invalidateQueries({ queryKey: KEY })} />
    </div>
  );
}

function PayoutActionModal({
  pending,
  onClose,
  onDone,
}: {
  pending: { payout: PayoutRow; mode: 'manual' | 'reject' } | null;
  onClose: () => void;
  onDone: () => unknown;
}) {
  const run = useAdminAction();
  const shown = useSticky(pending);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  const k = pending ? `${pending.payout.id}:${pending.mode}` : null;
  if (k !== key) {
    setKey(k);
    setText('');
  }
  const reject = shown?.mode === 'reject';

  async function submit() {
    if (!shown || text.trim().length < 3) return;
    setBusy(true);
    const res = await run(
      () =>
        reject
          ? apiClient.post(`/admin/payouts/${shown.payout.id}/reject`, { note: text.trim() })
          : apiClient.post(`/admin/payouts/${shown.payout.id}/approve`, { method: 'manual', reference: text.trim() }),
      { refresh: false }
    );
    await onDone();
    setBusy(false);
    if (res) onClose();
  }

  return (
    <Modal
      open={!!pending}
      onClose={onClose}
      size="sm"
      eyebrow={shown ? `${shown.payout.instructorName} · ${money(shown.payout.net, shown.payout.currency)}` : undefined}
      title={reject ? 'Decline payout' : 'Record manual payout'}
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={btn.primary} disabled={busy || text.trim().length < 3} onClick={() => void submit()}>
            {busy ? 'Saving…' : reject ? 'Decline' : 'Mark as paid'}
          </button>
        </>
      }
    >
      {reject ? (
        <Field label="Reason (sent to the instructor)">
          <textarea className={`${inputCls} min-h-[90px]`} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[#5c6b7a]">
            Send {shown ? money(shown.payout.net, shown.payout.currency) : ''} yourself (bank transfer, Wise or Payoneer), then record the transfer reference here.
          </p>
          <Field label="Transfer reference">
            <input className={inputCls} maxLength={300} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. WISE-123456" />
          </Field>
        </div>
      )}
    </Modal>
  );
}
