import { Types } from 'mongoose';
import { ClassModel, ClassScheduleModel } from '../models/Class';
import { EarningModel } from '../models/Earning';
import { PaymentModel } from '../models/Payment';
import { getPlatformSettings } from '../models/PlatformSettings';
import { round2 } from './stripe';

const DAY = 86400000;

/** Concurrent syncs may race on the unique (paymentId, kind) index; the loser is a no-op. */
async function ignoreDuplicate(op: PromiseLike<unknown>) {
  try {
    await op;
  } catch (e: any) {
    if (e?.code !== 11000) throw e;
  }
}

/** When a class's earnings can be released: last session / end date + refund window. Null = hold. */
async function releaseDates(classIds: string[], refundDays: number) {
  const [classes, lastSessions] = await Promise.all([
    ClassModel.find({ _id: { $in: classIds } }).select('endDate cancelledAt instructor').lean(),
    ClassScheduleModel.aggregate<{ _id: Types.ObjectId; end: Date }>([
      { $match: { classId: { $in: classIds.map((id) => new Types.ObjectId(id)) }, status: { $ne: 'cancelled' } } },
      { $group: { _id: '$classId', end: { $max: '$endTime' } } },
    ]),
  ]);
  const lastEnd = new Map(lastSessions.map((s) => [String(s._id), s.end]));
  const out = new Map<string, { at: Date | null; hold?: string; instructorId?: string }>();
  for (const c of classes) {
    const id = String(c._id);
    if (c.cancelledAt) {
      out.set(id, { at: null, hold: 'Class cancelled — waiting for refund decision', instructorId: String(c.instructor?.id) });
      continue;
    }
    const ends = [lastEnd.get(id), c.endDate].filter(Boolean).map((d) => new Date(d as Date).getTime());
    const end = ends.length ? Math.max(...ends) : null;
    out.set(id, {
      at: end ? new Date(end + refundDays * DAY) : null,
      hold: end ? undefined : 'No sessions scheduled yet',
      instructorId: String(c.instructor?.id),
    });
  }
  return out;
}

/**
 * Idempotently reconciles the ledger with payments:
 * 1. completed payments → `sale` earnings (instructor = class lead at sync time),
 * 2. refunded payments → void unpaid sales / add negative reversals for paid ones,
 * 3. pending sales → available once class end + refund window has passed.
 */
export async function syncEarnings() {
  const settings = await getPlatformSettings();
  const feePct = settings.platformFeePercent ?? 20;
  const refundDays = settings.refundWindowDays ?? 7;
  const now = Date.now();

  // 1. New sales
  const recorded = await EarningModel.distinct('paymentId', { kind: 'sale' });
  const fresh = await PaymentModel.find({ status: 'completed', paymentMethod: { $ne: 'demo' }, _id: { $nin: recorded } }).lean();
  if (fresh.length) {
    const dates = await releaseDates([...new Set(fresh.map((p) => String(p.classId)))], refundDays);
    for (const p of fresh) {
      const d = dates.get(String(p.classId));
      if (!d?.instructorId) continue;
      const platformFee = round2(p.amount * (feePct / 100));
      await ignoreDuplicate(EarningModel.updateOne(
        { paymentId: p._id, kind: 'sale' },
        {
          $setOnInsert: {
            instructorId: d.instructorId,
            classId: p.classId,
            learnerId: p.userId,
            currency: (p.currency || 'usd').toLowerCase(),
            gross: p.amount,
            feePercent: feePct,
            platformFee,
            amount: round2(p.amount - platformFee),
            status: 'pending',
            availableAt: d.at,
            holdReason: d.hold,
          },
        },
        { upsert: true }
      ));
    }
  }

  // 2. Refunds
  const refundedIds = await PaymentModel.distinct('_id', { status: 'refunded' });
  if (refundedIds.length) {
    const sales = await EarningModel.find({ kind: 'sale', paymentId: { $in: refundedIds }, status: { $ne: 'void' } });
    for (const sale of sales) {
      if (sale.status === 'pending' || sale.status === 'available') {
        sale.status = 'void';
        sale.holdReason = 'Refunded';
        await sale.save();
        continue;
      }
      // Already requested or paid out: claw back from the next payout.
      await ignoreDuplicate(EarningModel.updateOne(
        { paymentId: sale.paymentId, kind: 'reversal' },
        {
          $setOnInsert: {
            instructorId: sale.instructorId,
            classId: sale.classId,
            learnerId: sale.learnerId,
            currency: sale.currency,
            gross: -sale.gross,
            feePercent: sale.feePercent,
            platformFee: -sale.platformFee,
            amount: -sale.amount,
            status: 'available',
            availableAt: new Date(),
            holdReason: 'Refund after payout',
          },
        },
        { upsert: true }
      ));
    }
  }

  // 3. Release
  const pending = await EarningModel.find({ status: 'pending', kind: 'sale' });
  if (pending.length) {
    const dates = await releaseDates([...new Set(pending.map((e) => String(e.classId)))], refundDays);
    for (const e of pending) {
      const d = dates.get(String(e.classId));
      const at = d ? d.at : null;
      const release = !!at && at.getTime() <= now;
      const changed = release || String(e.availableAt ?? '') !== String(at ?? '') || e.holdReason !== d?.hold;
      if (!changed) continue;
      e.availableAt = at;
      e.holdReason = release ? undefined : d?.hold;
      if (release) e.status = 'available';
      await e.save();
    }
  }
}

export type BalanceRow = { currency: string; pending: number; available: number; requested: number; paid: number };

/** Per-currency balances for one instructor (or all when omitted). */
export async function balancesFor(instructorId?: string) {
  const match: Record<string, unknown> = { status: { $ne: 'void' } };
  if (instructorId) match.instructorId = new Types.ObjectId(instructorId);
  const rows = await EarningModel.aggregate<{ _id: { instructorId: Types.ObjectId; currency: string; status: string }; total: number }>([
    { $match: match },
    { $group: { _id: { instructorId: '$instructorId', currency: '$currency', status: '$status' }, total: { $sum: '$amount' } } },
  ]);
  const byInstructor = new Map<string, Map<string, BalanceRow>>();
  for (const r of rows) {
    const iid = String(r._id.instructorId);
    if (!byInstructor.has(iid)) byInstructor.set(iid, new Map());
    const cur = byInstructor.get(iid)!;
    if (!cur.has(r._id.currency)) cur.set(r._id.currency, { currency: r._id.currency, pending: 0, available: 0, requested: 0, paid: 0 });
    const row = cur.get(r._id.currency)!;
    const k = r._id.status as keyof Omit<BalanceRow, 'currency'>;
    if (k in row) row[k] = round2(row[k] + r.total);
  }
  return new Map([...byInstructor].map(([k, v]) => [k, [...v.values()]]));
}

export function payoutFee(amount: number, settings: { payoutFeePercent?: number; payoutFeeFixed?: number }) {
  if (amount <= 0) return 0;
  return round2(amount * ((settings.payoutFeePercent ?? 0.25) / 100) + (settings.payoutFeeFixed ?? 0.25));
}
