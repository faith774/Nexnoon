import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowUpRight, Banknote, CheckCircle2, Clock, Loader2, ShieldCheck, Wallet } from 'lucide-react';
import apiClient, { getErrorMessage } from '@/lib/api/client';

type Balance = { currency: string; pending: number; available: number; requested: number; paid: number };
type EarningRow = {
  id: string;
  kind: 'sale' | 'reversal';
  classId: string;
  classTitle: string;
  currency: string;
  gross: number;
  platformFee: number;
  amount: number;
  status: 'pending' | 'available' | 'requested' | 'paid' | 'void';
  availableAt: string | null;
  holdReason: string;
  createdAt: string;
};
type PayoutRow = {
  id: string;
  currency: string;
  amount: number;
  fee: number;
  net: number;
  status: 'requested' | 'processing' | 'paid' | 'rejected' | 'failed';
  method: 'stripe' | 'manual' | null;
  reference: string;
  note: string;
  failureReason: string;
  requestedAt: string;
  decidedAt: string | null;
};
type PayoutData = {
  connect: {
    stripeReady: boolean;
    connected: boolean;
    detailsSubmitted: boolean;
    payoutsEnabled: boolean;
    requirementsDue: string[];
    country: string | null;
  };
  rules: { platformFeePercent: number; refundWindowDays: number; minPayout: number; payoutFeePercent: number; payoutFeeFixed: number };
  balances: Balance[];
  earnings: EarningRow[];
  payouts: PayoutRow[];
};

const QUERY_KEY = ['instructor-payouts'];

const fmt = (amount: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase() }).format(amount || 0);
const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-[#f6efe4] text-[#8a5a1f]',
  available: 'bg-emerald-50 text-emerald-800',
  requested: 'bg-sky-50 text-sky-800',
  processing: 'bg-sky-50 text-sky-800',
  paid: 'bg-[#efece6] text-[#4a453d]',
  void: 'bg-[#efece6] text-[#8a847a] line-through',
  rejected: 'bg-rose-50 text-rose-800',
  failed: 'bg-rose-50 text-rose-800',
};

function StatusChip({ status }: { status: string }) {
  return <span className={`inline-block px-2 py-0.5 text-[11px] uppercase tracking-wide ${STATUS_STYLE[status] || ''}`}>{status}</span>;
}

export default function InstructorPayouts() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState<Balance | null>(null);

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => (await apiClient.get('/payouts/me')).data.data as PayoutData,
  });

  const connectParam = params.get('connect');
  useEffect(() => {
    if (!connectParam) return;
    const next = new URLSearchParams(params);
    next.delete('connect');
    setParams(next, { replace: true });
    if (connectParam === 'refresh') {
      void startOnboarding();
      return;
    }
    void (async () => {
      try {
        const res = await apiClient.post('/payouts/connect/refresh');
        setMsg({ ok: !!res.data?.data?.payoutsEnabled, text: res.data?.message || 'Stripe status updated' });
      } catch (err) {
        setMsg({ ok: false, text: getErrorMessage(err) });
      }
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectParam]);

  async function startOnboarding() {
    setBusy('onboard');
    setMsg(null);
    try {
      const res = await apiClient.post('/payouts/connect/onboard', {});
      window.location.href = res.data.data.url;
    } catch (err) {
      setMsg({ ok: false, text: getErrorMessage(err) });
      setBusy(null);
    }
  }

  async function openDashboard() {
    setBusy('dashboard');
    try {
      const res = await apiClient.post('/payouts/connect/dashboard');
      window.open(res.data.data.url, '_blank', 'noopener');
    } catch (err) {
      setMsg({ ok: false, text: getErrorMessage(err) });
    }
    setBusy(null);
  }

  async function requestPayout(currency: string) {
    setBusy(`request-${currency}`);
    setMsg(null);
    try {
      const res = await apiClient.post('/payouts/request', { currency });
      setMsg({ ok: true, text: res.data?.message || 'Payout requested' });
      setConfirming(null);
    } catch (err) {
      setMsg({ ok: false, text: getErrorMessage(err) });
    }
    setBusy(null);
    void qc.invalidateQueries({ queryKey: QUERY_KEY });
  }

  if (query.isLoading) {
    return (
      <section className="flex items-center gap-2 border border-[#e4dfd6] bg-white p-5 text-sm text-[#6b655c]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your balance…
      </section>
    );
  }
  if (query.isError || !query.data) {
    return (
      <section className="border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
        Couldn’t load your earnings. {getErrorMessage(query.error)}
      </section>
    );
  }

  const { connect, rules, balances, earnings, payouts } = query.data;
  const openRequest = (currency: string) => payouts.some((p) => p.currency === currency && (p.status === 'requested' || p.status === 'processing'));
  const needsStripe = connect.stripeReady && !connect.payoutsEnabled;
  const feeFor = (amount: number) =>
    amount <= 0 ? 0 : Math.round((amount * (rules.payoutFeePercent / 100) + rules.payoutFeeFixed) * 100) / 100;
  const shownBalances = balances.length ? balances : [{ currency: 'usd', pending: 0, available: 0, requested: 0, paid: 0 }];

  return (
    <div className="space-y-6">
      {msg && (
        <p className={`border px-4 py-3 text-sm ${msg.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
          {msg.text}
        </p>
      )}

      {/* Payout account */}
      <section className="border border-[#e4dfd6] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-3">
            <Wallet className="mt-1 h-5 w-5 text-[#c45c26]" />
            <div>
              <h2 className="font-serif text-xl">Payout account</h2>
              {!connect.stripeReady ? (
                <p className="mt-1 max-w-xl text-sm text-[#6b655c]">
                  Request a payout when your balance is available and the Nexnoon team will send it to you directly. Automatic bank payouts are coming soon.
                </p>
              ) : connect.payoutsEnabled ? (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" /> Connected with Stripe — payouts go straight to your bank.
                </p>
              ) : connect.connected ? (
                <p className="mt-1 max-w-xl text-sm text-[#8a5a1f]">
                  Stripe still needs a few details before we can pay you
                  {connect.requirementsDue.length ? ` (${connect.requirementsDue.length} item${connect.requirementsDue.length > 1 ? 's' : ''} outstanding)` : ''}.
                </p>
              ) : (
                <p className="mt-1 max-w-xl text-sm text-[#6b655c]">
                  Connect a bank account through Stripe to get paid. It takes about five minutes and Stripe handles identity checks securely — Nexnoon never sees
                  your bank details.
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {needsStripe && (
              <button
                type="button"
                disabled={busy === 'onboard'}
                onClick={() => void startOnboarding()}
                className="inline-flex items-center gap-2 bg-[#14110e] px-4 py-2.5 text-sm text-white disabled:opacity-50"
              >
                {busy === 'onboard' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
                {connect.connected ? 'Finish Stripe setup' : 'Connect with Stripe'}
              </button>
            )}
            {connect.connected && connect.stripeReady && (
              <button
                type="button"
                disabled={busy === 'dashboard'}
                onClick={() => void openDashboard()}
                className="inline-flex items-center gap-2 border border-[#d5cfc4] px-4 py-2.5 text-sm disabled:opacity-50"
              >
                Stripe dashboard <ArrowUpRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Balances */}
      {shownBalances.map((b) => {
        const fee = feeFor(b.available);
        const canRequest = b.available >= rules.minPayout && !openRequest(b.currency) && !needsStripe;
        return (
          <section key={b.currency} className="border border-[#e4dfd6] bg-white p-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="border border-[#eee9e0] bg-[#faf7f2] p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#6b655c]">Available</p>
                <p className="mt-2 font-serif text-2xl text-[#14110e]">{fmt(b.available, b.currency)}</p>
                <p className="mt-1 text-xs text-[#8a847a]">Ready to withdraw</p>
              </div>
              <div className="border border-[#eee9e0] p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#6b655c]">Pending</p>
                <p className="mt-2 font-serif text-2xl text-[#14110e]">{fmt(b.pending, b.currency)}</p>
                <p className="mt-1 text-xs text-[#8a847a]">Unlocks {rules.refundWindowDays} days after the class ends</p>
              </div>
              <div className="border border-[#eee9e0] p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#6b655c]">In review</p>
                <p className="mt-2 font-serif text-2xl text-[#14110e]">{fmt(b.requested, b.currency)}</p>
                <p className="mt-1 text-xs text-[#8a847a]">Requested payouts</p>
              </div>
              <div className="border border-[#eee9e0] p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#6b655c]">Paid out</p>
                <p className="mt-2 font-serif text-2xl text-[#14110e]">{fmt(b.paid, b.currency)}</p>
                <p className="mt-1 text-xs text-[#8a847a]">All time</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[#6b655c]">
                {openRequest(b.currency)
                  ? 'A payout request is being reviewed. You’ll get a notification when it’s sent.'
                  : b.available < rules.minPayout
                    ? `You can request a payout once ${fmt(rules.minPayout, b.currency)} is available.`
                    : needsStripe
                      ? 'Connect Stripe above to withdraw.'
                      : `You’ll receive ${fmt(b.available - fee, b.currency)} after a ${fmt(fee, b.currency)} transfer fee.`}
              </p>
              <button
                type="button"
                disabled={!canRequest}
                onClick={() => setConfirming(b)}
                className="inline-flex items-center gap-2 bg-[#c45c26] px-4 py-2.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Banknote className="h-4 w-4" /> Request payout
              </button>
            </div>
            {confirming?.currency === b.currency && (
              <div className="mt-4 border border-[#eadfcf] bg-[#fff8f0] p-4 text-sm">
                <p className="font-medium">Request {fmt(b.available, b.currency)}?</p>
                <p className="mt-1 text-[#6b655c]">
                  Transfer fee {fmt(fee, b.currency)} ({rules.payoutFeePercent}% + {fmt(rules.payoutFeeFixed, b.currency)}). You’ll receive{' '}
                  <strong className="text-[#14110e]">{fmt(b.available - fee, b.currency)}</strong>. Nexnoon reviews requests, usually within 2 business days.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={busy === `request-${b.currency}`}
                    onClick={() => void requestPayout(b.currency)}
                    className="bg-[#14110e] px-3 py-2 text-sm text-white disabled:opacity-50"
                  >
                    {busy === `request-${b.currency}` ? 'Requesting…' : 'Confirm request'}
                  </button>
                  <button type="button" onClick={() => setConfirming(null)} className="border border-[#d5cfc4] px-3 py-2 text-sm">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>
        );
      })}

      {/* How it works */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="border border-[#e4dfd6] bg-white p-5 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <Clock className="h-4 w-4 text-[#c45c26]" /> How you get paid
          </p>
          <ul className="mt-3 space-y-2 text-[#6b655c]">
            <li>Learners pay Nexnoon securely at enrollment. You earn the class price minus the {rules.platformFeePercent}% platform commission.</li>
            <li>Each sale unlocks {rules.refundWindowDays} days after the class’s last session, so refunds can be handled fairly.</li>
            <li>
              Withdraw once you have {fmt(rules.minPayout, 'usd')} available. A {rules.payoutFeePercent}% + {fmt(rules.payoutFeeFixed, 'usd')} transfer fee
              applies per payout.
            </li>
            <li>If a learner is refunded after you’ve been paid, it’s deducted from your next payout.</li>
          </ul>
        </div>
        <div className="border border-[#eadfcf] bg-[#fff8f0] p-5 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <ShieldCheck className="h-4 w-4 text-[#c45c26]" /> Keep payments on Nexnoon
          </p>
          <p className="mt-3 text-[#6b655c]">
            Never ask learners to pay you directly — including for “free” classes. Off-platform payments leave learners unprotected and break the Instructor
            Agreement. Learners can report it, and accounts that collect payments outside Nexnoon are suspended and forfeit unpaid earnings.
          </p>
        </div>
      </section>

      {/* Payout history */}
      <section className="border border-[#e4dfd6] bg-white">
        <h2 className="border-b border-[#eee9e0] px-5 py-4 font-serif text-xl">Payout history</h2>
        {payouts.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[#8a847a]">No payouts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#faf7f2] text-left text-[11px] uppercase tracking-[0.12em] text-[#6b655c]">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Requested</th>
                  <th className="px-5 py-2.5 font-medium">Amount</th>
                  <th className="px-5 py-2.5 font-medium">Fee</th>
                  <th className="px-5 py-2.5 font-medium">You receive</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id} className="border-t border-[#eee9e0]">
                    <td className="px-5 py-3">{fmtDate(p.requestedAt)}</td>
                    <td className="px-5 py-3">{fmt(p.amount, p.currency)}</td>
                    <td className="px-5 py-3 text-[#6b655c]">{fmt(p.fee, p.currency)}</td>
                    <td className="px-5 py-3 font-medium">{fmt(p.net, p.currency)}</td>
                    <td className="px-5 py-3">
                      <StatusChip status={p.status} />
                    </td>
                    <td className="px-5 py-3 text-[#6b655c]">
                      {p.status === 'paid'
                        ? `Sent ${fmtDate(p.decidedAt)}${p.method === 'manual' && p.reference ? ` · ref ${p.reference}` : ''}`
                        : p.status === 'rejected'
                          ? p.note || 'Declined'
                          : p.status === 'failed'
                            ? 'Transfer failed — we’re looking into it'
                            : 'Awaiting review'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Earnings ledger */}
      <section className="border border-[#e4dfd6] bg-white">
        <h2 className="border-b border-[#eee9e0] px-5 py-4 font-serif text-xl">Earnings by enrollment</h2>
        {earnings.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[#8a847a]">Earnings appear here as learners enroll in your paid classes.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#faf7f2] text-left text-[11px] uppercase tracking-[0.12em] text-[#6b655c]">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-5 py-2.5 font-medium">Class</th>
                  <th className="px-5 py-2.5 font-medium">Paid by learner</th>
                  <th className="px-5 py-2.5 font-medium">Commission</th>
                  <th className="px-5 py-2.5 font-medium">Your earnings</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {earnings.map((e) => (
                  <tr key={e.id} className="border-t border-[#eee9e0]">
                    <td className="px-5 py-3">{fmtDate(e.createdAt)}</td>
                    <td className="px-5 py-3">
                      {e.classTitle}
                      {e.kind === 'reversal' && <span className="ml-2 text-xs text-rose-700">Refund</span>}
                    </td>
                    <td className="px-5 py-3 text-[#6b655c]">{e.kind === 'sale' ? fmt(e.gross, e.currency) : '—'}</td>
                    <td className="px-5 py-3 text-[#6b655c]">{e.kind === 'sale' ? fmt(e.platformFee, e.currency) : '—'}</td>
                    <td className={`px-5 py-3 font-medium ${e.amount < 0 ? 'text-rose-700' : ''}`}>{fmt(e.amount, e.currency)}</td>
                    <td className="px-5 py-3">
                      <StatusChip status={e.status} />
                      {e.status === 'pending' && (
                        <p className="mt-1 text-xs text-[#8a847a]">
                          {e.availableAt ? `Unlocks ${fmtDate(e.availableAt)}` : e.holdReason || 'On hold'}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {connect.stripeReady && connect.requirementsDue.length > 0 && (
        <p className="flex items-center gap-2 text-xs text-[#8a5a1f]">
          <AlertTriangle className="h-3.5 w-3.5" /> Stripe is asking for more information. Use “Finish Stripe setup” to complete it.
        </p>
      )}
    </div>
  );
}
