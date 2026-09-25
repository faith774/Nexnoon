import { Types } from 'mongoose';
import { ClassModel, ClassScheduleModel, IClass } from '../models/Class';
import { EnrollmentModel } from '../models/Enrollment';
import { PaymentModel, IPayment } from '../models/Payment';
import { WaitlistModel, IWaitlistEntry } from '../models/Waitlist';
import { getMaxClassSeats, getPlatformSettings } from '../models/PlatformSettings';
import { User } from '../models/User';
import { buildClassUpdateEmail, sendEmailSafe } from './email';
import { notifyUserInApp } from './notify';
import { formatWhen, pickTimeZone } from './time';
import { freeClassBlocked } from './pricing';
import { getStripe } from './stripe';
import { syncEarnings } from './earnings';

export const WAITLIST_CLAIM_MS = 24 * 60 * 60 * 1000;
const SWEEP_MS = 60_000;

type ClassLike = Pick<IClass, 'status' | 'price' | 'freeApproval' | 'startDate' | 'endDate' | 'cancelledAt'> & { _id: unknown };

/** Seats taken by enrollments plus seats held for waitlist offers must stay below the cap. */
const hasFreeSeat = (cap: number) => ({
  $expr: { $lt: [{ $add: ['$enrolledStudents', { $ifNull: ['$heldSeats', 0] }] }, cap] },
});

export function freeSeats(cls: { enrolledStudents?: number; heldSeats?: number }, cap: number) {
  return Math.max(0, cap - (cls.enrolledStudents || 0) - (cls.heldSeats || 0));
}

export async function classTimeline(cls: ClassLike) {
  const sessions = await ClassScheduleModel.find({ classId: cls._id, status: { $ne: 'cancelled' } })
    .select('startTime endTime status')
    .sort({ startTime: 1 })
    .lean();
  const now = Date.now();
  const firstStart: Date | undefined = sessions[0]?.startTime ?? cls.startDate ?? undefined;
  const hasUpcoming = sessions.some((s) => s.status === 'live' || new Date(s.endTime || s.startTime).getTime() > now);
  const ended = sessions.length ? !hasUpcoming : !!(cls.endDate && new Date(cls.endDate).getTime() < now);
  return {
    firstStart,
    started: !!firstStart && new Date(firstStart).getTime() <= now,
    ended,
    totalSessions: sessions.length,
  };
}

/** Why a class can't take new learners right now, or null when it can. */
export async function enrollmentBlock(cls: ClassLike): Promise<string | null> {
  if (cls.cancelledAt) return 'This class was cancelled.';
  if (cls.status !== 'published' || freeClassBlocked(cls)) return 'This class is not open for enrollment.';
  if ((await classTimeline(cls)).ended) return 'This class has already finished.';
  return null;
}

export async function activeOfferFor(classId: string, userId: string) {
  return WaitlistModel.findOne({ classId, userId, status: 'offered', offerExpiresAt: { $gt: new Date() } });
}

/**
 * Takes a seat for the learner. A learner holding a waitlist offer uses their held seat;
 * everyone else needs a seat that isn't held for someone else.
 */
export async function reserveSeat(classId: string, userId: string) {
  const cap = await getMaxClassSeats();
  const offer = await WaitlistModel.findOneAndUpdate(
    { classId, userId, status: 'offered', offerExpiresAt: { $gt: new Date() } },
    { $set: { status: 'claimed', resolvedAt: new Date() } }
  );
  if (offer) {
    const fromHold = await ClassModel.findOneAndUpdate(
      { _id: classId, status: 'published', heldSeats: { $gt: 0 } },
      { $inc: { enrolledStudents: 1, heldSeats: -1 }, $set: { maxStudents: cap } },
      { new: true }
    );
    if (fromHold) return { cls: fromHold, cap };
  }
  const cls = await ClassModel.findOneAndUpdate(
    { _id: classId, status: 'published', ...hasFreeSeat(cap) },
    { $inc: { enrolledStudents: 1 }, $set: { maxStudents: cap } },
    { new: true }
  );
  if (cls) {
    await WaitlistModel.updateOne(
      { classId, userId, status: { $in: ['waiting', 'offered'] } },
      { $set: { status: 'claimed', resolvedAt: new Date() } }
    );
  }
  return { cls, cap };
}

export async function releaseSeat(classId: string) {
  await ClassModel.updateOne({ _id: classId, enrolledStudents: { $gt: 0 } }, { $inc: { enrolledStudents: -1 } });
  offerNextSeats(classId).catch((e) => console.error('Waitlist offer failed:', e));
}

async function contact(userId: unknown) {
  return User.findById(userId).select('fullName email timezone').lean();
}

async function sendOffer(entry: IWaitlistEntry, cls: { id?: string; _id: unknown; title: string; timezone?: string }) {
  const classId = String(cls._id);
  const user = await contact(entry.userId);
  const until = formatWhen(entry.offerExpiresAt!, pickTimeZone(user?.timezone, cls.timezone));
  const message = `A seat opened in ${cls.title}. It's held for you until ${until}. After that it goes to the next person on the waitlist.`;
  await notifyUserInApp({
    userId: String(entry.userId),
    type: 'class',
    title: 'A seat opened for you',
    message,
    actionUrl: `/payment/${classId}`,
  });
  if (user?.email) {
    await sendEmailSafe(
      user.email,
      `A seat opened: ${cls.title}`,
      buildClassUpdateEmail({
        learnerName: user.fullName,
        heading: 'A seat opened for you',
        body: message,
        actionUrl: `/payment/${classId}`,
        actionLabel: 'Claim my seat',
      })
    ).catch(() => {});
  }
}

/** Hands free seats to the waitlist, oldest entry first. Each offer holds a seat for 24 hours. */
export async function offerNextSeats(classId: string) {
  const cap = await getMaxClassSeats();
  for (let guard = 0; guard < 100; guard += 1) {
    const cls = await ClassModel.findById(classId).select('title status timezone price freeApproval startDate endDate cancelledAt');
    if (!cls) return;
    if (await enrollmentBlock(cls)) {
      await closeWaitlist(classId);
      return;
    }
    const next = await WaitlistModel.findOne({ classId, status: 'waiting' }).sort({ joinedAt: 1 });
    if (!next) return;
    if (await EnrollmentModel.exists({ classId, userId: next.userId, status: { $in: ['active', 'completed'] } })) {
      await WaitlistModel.updateOne({ _id: next._id }, { $set: { status: 'claimed', resolvedAt: new Date() } });
      continue;
    }
    const held = await ClassModel.findOneAndUpdate(
      { _id: classId, status: 'published', ...hasFreeSeat(cap) },
      { $inc: { heldSeats: 1 } }
    );
    if (!held) return;
    const now = new Date();
    const offered = await WaitlistModel.findOneAndUpdate(
      { _id: next._id, status: 'waiting' },
      { $set: { status: 'offered', offeredAt: now, offerExpiresAt: new Date(now.getTime() + WAITLIST_CLAIM_MS) } },
      { new: true }
    );
    if (!offered) {
      await ClassModel.updateOne({ _id: classId, heldSeats: { $gt: 0 } }, { $inc: { heldSeats: -1 } });
      continue;
    }
    await sendOffer(offered, cls).catch((e) => console.error('Waitlist offer notice failed:', e));
  }
}

/** Gives up an offer (declined, expired or left) and passes the seat on. */
export async function releaseOffer(entryId: Types.ObjectId | string, status: 'expired' | 'left') {
  const entry = await WaitlistModel.findOneAndUpdate(
    { _id: entryId, status: 'offered' },
    { $set: { status, resolvedAt: new Date() } },
    { new: true }
  );
  if (!entry) return null;
  await ClassModel.updateOne({ _id: entry.classId, heldSeats: { $gt: 0 } }, { $inc: { heldSeats: -1 } });
  await offerNextSeats(String(entry.classId));
  return entry;
}

export async function closeWaitlist(classId: string) {
  await WaitlistModel.updateMany(
    { classId, status: { $in: ['waiting', 'offered'] } },
    { $set: { status: 'closed', resolvedAt: new Date() } }
  );
  await ClassModel.updateOne({ _id: classId }, { $set: { heldSeats: 0 } });
}

export async function waitlistPosition(entry: IWaitlistEntry) {
  if (entry.status !== 'waiting') return null;
  const ahead = await WaitlistModel.countDocuments({
    classId: entry.classId,
    status: 'waiting',
    joinedAt: { $lt: entry.joinedAt },
  });
  return ahead + 1;
}

async function sweepExpiredOffers() {
  const expired = await WaitlistModel.find({ status: 'offered', offerExpiresAt: { $lte: new Date() } })
    .select('_id userId classId')
    .limit(200)
    .lean();
  for (const e of expired) {
    const released = await releaseOffer(e._id, 'expired');
    if (!released) continue;
    const cls = await ClassModel.findById(e.classId).select('title').lean();
    await notifyUserInApp({
      userId: String(e.userId),
      type: 'class',
      title: 'Seat offer expired',
      message: `The seat held for you in ${cls?.title || 'a class'} was passed on. You can join the waitlist again from the class page.`,
      actionUrl: `/class/${e.classId}`,
    });
  }
}

export function startWaitlistSweeper() {
  const tick = () => sweepExpiredOffers().catch((e) => console.error('Waitlist sweep failed:', e));
  tick();
  return setInterval(tick, SWEEP_MS);
}

/* ------------------------------------------------------------------ */
/* Refunds                                                             */
/* ------------------------------------------------------------------ */

export async function refundPayment(payment: IPayment, reason: string) {
  if (payment.status !== 'completed') throw new Error(`Only completed payments can be refunded (this one is ${payment.status})`);
  if (payment.stripePaymentIntentId) {
    const stripe = getStripe();
    if (!stripe) throw new Error('Stripe is not configured, so this card payment cannot be refunded.');
    await stripe.refunds.create(
      { payment_intent: payment.stripePaymentIntentId, metadata: { reason } },
      { idempotencyKey: `refund-${payment.id}` }
    );
  }
  payment.status = 'refunded';
  await payment.save();
  syncEarnings().catch((e) => console.error('Earnings sync failed:', e));
}

/** What happens to the learner's money if they leave now. */
export async function leaveTerms(userId: string, cls: ClassLike) {
  const payment = await PaymentModel.findOne({ userId, classId: cls._id, status: 'completed' }).sort({ createdAt: -1 });
  const settings = await getPlatformSettings();
  const windowDays = settings.refundWindowDays ?? 7;
  const { firstStart } = await classTimeline(cls);
  if (!payment || payment.amount <= 0) {
    return { payment: null, refundable: false, amount: 0, currency: 'usd', refundDeadline: null as Date | null, windowDays };
  }
  const windowEnd = new Date(new Date(payment.createdAt).getTime() + windowDays * 86_400_000);
  const refundDeadline = firstStart && new Date(firstStart) < windowEnd ? new Date(firstStart) : windowEnd;
  return {
    payment,
    refundable: Date.now() < refundDeadline.getTime(),
    amount: payment.amount,
    currency: payment.currency,
    refundDeadline,
    windowDays,
  };
}

/** Mongo filter that hides classes whose last live session is over (falls back to endDate when unscheduled). */
export async function notEndedFilter(now = new Date()) {
  const rows: { _id: Types.ObjectId; lastEnd: Date }[] = await ClassScheduleModel.aggregate([
    { $match: { status: { $ne: 'cancelled' } } },
    { $group: { _id: '$classId', lastEnd: { $max: '$endTime' } } },
  ]);
  const ended = rows.filter((r) => new Date(r.lastEnd) <= now).map((r) => r._id);
  const scheduled = rows.map((r) => r._id);
  return {
    _id: { $nin: ended },
    $or: [{ _id: { $in: scheduled } }, { endDate: { $exists: false } }, { endDate: null }, { endDate: { $gt: now } }],
  };
}
