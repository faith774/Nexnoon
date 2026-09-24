import { useState } from 'react';
import { Activity, Gauge, Percent, Scale } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { useAdmin, useAdminAction } from './context';
import { IntegrationsReadinessCard, ZoomIntegrationCard } from './Panels';
import type { QualityWeights } from './types';
import { EmptyBlock, ExportButton, Field, FilterChips, Pagination, Panel, Pill, btn, fmtDateTime, inputCls, matches, usePagination } from './ui';

export const DEFAULT_WEIGHTS: QualityWeights = {
  learnerRating: 40,
  completion: 20,
  attendance: 15,
  feedback: 15,
  adminEvaluation: 10,
};

/* ------------------------------------------------------------------ */
/* Activity                                                            */
/* ------------------------------------------------------------------ */

const CATEGORIES = ['all', 'instructor', 'learner', 'enrollment', 'assignment', 'payment', 'course', 'class', 'settings', 'system'] as const;
type Category = (typeof CATEGORIES)[number];

export function ActivitySection() {
  const { data, search } = useAdmin();
  const [category, setCategory] = useState<Category>('all');
  const all = data.activity || [];
  const rows = all
    .filter((a) => category === 'all' || a.category === category)
    .filter((a) => matches(search, a.message, a.actorName, a.action));
  const pager = usePagination(rows, 20, `${category}|${search}`);
  const present = CATEGORIES.filter((c) => c === 'all' || all.some((a) => a.category === c));

  return (
    <Panel
      title="Platform activity"
      subtitle="Approvals, enrollments, payments, assignments and admin actions."
      icon={<Activity className="h-4 w-4" />}
      actions={
        <ExportButton
          filename="activity"
          rows={() =>
            rows.map((a) => ({ time: fmtDateTime(a.createdAt), category: a.category, action: a.action, message: a.message, actor: a.actorName || '' }))
          }
        />
      }
      bodyClassName=""
    >
      <div className="border-b border-[#e4ebf2] px-5 py-3 md:px-6">
        <FilterChips
          label="Category"
          value={category}
          onChange={setCategory}
          options={present.map((c) => ({
            id: c,
            label: c === 'all' ? 'All' : c,
            count: c === 'all' ? all.length : all.filter((a) => a.category === c).length,
          }))}
        />
      </div>
      {!rows.length ? (
        <div className="p-5 md:p-6">
          <EmptyBlock text="No activity events yet." />
        </div>
      ) : (
        <>
          <ol className="divide-y divide-[#eef2f7]">
            {pager.pageItems.map((item) => (
              <li key={item.id} className="flex gap-4 px-5 py-3.5 text-sm md:px-6">
                <div className="w-24 shrink-0">
                  <Pill tone="blue">{item.category}</Pill>
                  <p className="mt-1 text-[11px] text-[#8a96a5]">{item.action}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[#0b1220]">{item.message}</p>
                  <p className="mt-0.5 text-xs text-[#8a96a5]">
                    {fmtDateTime(item.createdAt)}
                    {item.actorName ? ` · ${item.actorName}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <Pagination {...pager} noun="events" sizes={[20, 50, 100]} />
        </>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

const WEIGHT_FIELDS = [
  ['learnerRating', 'Learner rating'],
  ['completion', 'Completion'],
  ['attendance', 'Attendance'],
  ['feedback', 'Feedback'],
  ['adminEvaluation', 'Admin eval'],
] as const;

const PAYOUT_FIELDS = [
  { key: 'refundWindowDays', label: 'Hold period (days)', fallback: 7, step: '1', max: 60 },
  { key: 'minPayout', label: 'Minimum payout ($)', fallback: 20, step: '1', max: 10000 },
  { key: 'payoutFeePercent', label: 'Payout fee (%)', fallback: 0.25, step: '0.01', max: 10 },
  { key: 'payoutFeeFixed', label: 'Fixed fee ($)', fallback: 0.25, step: '0.01', max: 50 },
] as const;

type PayoutKey = (typeof PAYOUT_FIELDS)[number]['key'];

function PayoutRulesForm() {
  const { data, flash } = useAdmin();
  const run = useAdminAction();
  const [draft, setDraft] = useState<Partial<Record<PayoutKey, string>>>({});
  const [saving, setSaving] = useState(false);
  const current = (k: PayoutKey, fallback: number) => data.settings?.[k] ?? fallback;
  const dirty = Object.values(draft).some((v) => v !== undefined && v !== '');

  async function save() {
    const body: Partial<Record<PayoutKey, number>> = {};
    for (const f of PAYOUT_FIELDS) {
      const raw = draft[f.key];
      if (raw === undefined || raw === '') continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0 || value > f.max) {
        flash({ type: 'err', text: `${f.label} must be between 0 and ${f.max}.` });
        return;
      }
      body[f.key] = value;
    }
    setSaving(true);
    const res = await run(() => apiClient.patch('/settings/platform', body));
    setSaving(false);
    if (res) setDraft({});
  }

  return (
    <div className="mt-6 border-t border-[#e4ebf2] pt-5">
      <p className="text-sm font-medium text-[#0b1220]">Instructor payouts</p>
      <p className="mb-4 mt-1 text-sm leading-relaxed text-[#5c6b7a]">
        Earnings unlock once the class ends plus the hold period, so refunds can still be issued. The payout fee is taken from the instructor’s payout to
        cover transfer costs.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {PAYOUT_FIELDS.map((f) => (
          <Field key={f.key} label={f.label}>
            <input
              type="number"
              min={0}
              max={f.max}
              step={f.step}
              className={inputCls}
              placeholder={String(current(f.key, f.fallback))}
              value={draft[f.key] ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
            />
          </Field>
        ))}
      </div>
      <button type="button" className={`${btn.primary} mt-3`} disabled={saving || !dirty} onClick={() => void save()}>
        {saving ? 'Saving…' : 'Save payout rules'}
      </button>
    </div>
  );
}

export function SettingsSection() {
  const { data, seatCap, flash } = useAdmin();
  const run = useAdminAction();
  const [seats, setSeats] = useState('');
  const [weights, setWeights] = useState<QualityWeights | null>(null);
  const [saving, setSaving] = useState<'seats' | 'weights' | 'fee' | null>(null);
  const [fee, setFee] = useState('');
  const feePct = data.settings?.platformFeePercent ?? 20;
  const w = weights || data.settings?.qualityWeights || DEFAULT_WEIGHTS;
  const sum = w.learnerRating + w.completion + w.attendance + w.feedback + w.adminEvaluation;

  async function saveFee() {
    const value = Number(fee);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      flash({ type: 'err', text: 'Commission must be between 0 and 100.' });
      return;
    }
    setSaving('fee');
    const res = await run(() => apiClient.patch('/settings/platform', { platformFeePercent: value }));
    setSaving(null);
    if (res) setFee('');
  }

  async function saveSeats() {
    const value = Number(seats || seatCap);
    if (!Number.isInteger(value) || value < 1 || value > 500) {
      flash({ type: 'err', text: 'Enter a whole number between 1 and 500.' });
      return;
    }
    setSaving('seats');
    const res = await run(() => apiClient.patch('/settings/platform', { maxClassSeats: value }));
    setSaving(null);
    if (res) setSeats('');
  }

  async function saveWeights() {
    if (sum !== 100) {
      flash({ type: 'err', text: `Weights must add up to 100 (currently ${sum}).` });
      return;
    }
    setSaving('weights');
    const res = await run(() => apiClient.patch('/settings/platform', { qualityWeights: w }));
    setSaving(null);
    if (res) setWeights(null);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <IntegrationsReadinessCard />
        <ZoomIntegrationCard />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Panel title="Class capacity" subtitle="Global seat limit for every class" icon={<Gauge className="h-4 w-4" />}>
          <p className="mb-4 text-sm leading-relaxed text-[#5c6b7a]">
            Enrollment is blocked once a class reaches this number. Current limit:{' '}
            <strong className="text-[#0b1220]">{seatCap}</strong> seats.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Max seats">
              <input
                type="number"
                min={1}
                max={500}
                className={`${inputCls} w-36`}
                placeholder={String(seatCap)}
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
              />
            </Field>
            <button type="button" className={btn.primary} disabled={saving === 'seats'} onClick={() => void saveSeats()}>
              {saving === 'seats' ? 'Saving…' : 'Save capacity'}
            </button>
          </div>

          <div className="mt-6 border-t border-[#e4ebf2] pt-5">
            <p className="flex items-center gap-2 text-sm font-medium text-[#0b1220]">
              <Percent className="h-4 w-4 text-[#3a5f8a]" /> Platform commission
            </p>
            <p className="mb-4 mt-1 text-sm leading-relaxed text-[#5c6b7a]">
              Nexnoon&apos;s share of each paid enrollment, deducted before the rest is credited to the instructor. Changes apply to new
              enrollments only. Current:{' '}
              <strong className="text-[#0b1220]">{feePct}%</strong>.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Commission %">
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={`${inputCls} w-36`}
                  placeholder={String(feePct)}
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                />
              </Field>
              <button type="button" className={btn.primary} disabled={saving === 'fee' || fee === ''} onClick={() => void saveFee()}>
                {saving === 'fee' ? 'Saving…' : 'Save commission'}
              </button>
            </div>
          </div>

          <PayoutRulesForm />
        </Panel>

        <Panel title="Quality score weights" subtitle="Used for the instructor quality board" icon={<Scale className="h-4 w-4" />}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {WEIGHT_FIELDS.map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={inputCls}
                  value={w[key]}
                  onChange={(e) => setWeights({ ...w, [key]: Number(e.target.value) })}
                />
              </Field>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className={`text-sm ${sum === 100 ? 'text-emerald-700' : 'text-rose-700'}`}>
              Total {sum} / 100{sum === 100 ? ' ✓' : ''}
            </p>
            <div className="flex gap-2">
              {weights ? (
                <button type="button" className={btn.secondary} onClick={() => setWeights(null)}>
                  Reset
                </button>
              ) : null}
              <button type="button" className={btn.primary} disabled={saving === 'weights'} onClick={() => void saveWeights()}>
                {saving === 'weights' ? 'Saving…' : 'Save weights'}
              </button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
