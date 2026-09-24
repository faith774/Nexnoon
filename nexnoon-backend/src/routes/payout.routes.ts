import { Router } from 'express';
import { z } from 'zod';
import { ENV } from '../config/env';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { logActivity } from '../models/ActivityLog';
import { ClassModel } from '../models/Class';
import { EarningModel } from '../models/Earning';
import { NotificationModel } from '../models/Notification';
import { PayoutModel } from '../models/Payout';
import { getPlatformSettings } from '../models/PlatformSettings';
import { User } from '../models/User';
import { balancesFor, payoutFee, syncEarnings } from '../utils/earnings';
import { connectSnapshot, getStripe, round2 } from '../utils/stripe';

/** Instructor-facing earnings, Stripe Connect onboarding and payout requests. */
const router = Router();
router.use(requireAuth, requireRole('instructor'));

const frontend = () => ENV.FRONTEND_URL.replace(/\/+$/, '');

async function refreshConnect(userId: string) {
  const stripe = getStripe();
  const user = await User.findById(userId);
  if (!stripe || !user?.payout?.stripeAccountId) return user;
  const account = await stripe.accounts.retrieve(user.payout.stripeAccountId);
  user.payout = connectSnapshot(account);
  await user.save();
  return user;
}

router.get('/me', async (req: AuthRequest, res) => {
  await syncEarnings();
  const [user, settings, balances, earnings, payouts] = await Promise.all([
    User.findById(req.user!.id).select('payout').lean(),
    getPlatformSettings(),
    balancesFor(req.user!.id),
    EarningModel.find({ instructorId: req.user!.id }).sort({ createdAt: -1 }).limit(300).lean(),
    PayoutModel.find({ instructorId: req.user!.id }).sort({ requestedAt: -1 }).limit(100).lean(),
  ]);
  const titles = new Map(
    (await ClassModel.find({ _id: { $in: [...new Set(earnings.map((e) => String(e.classId)))] } }).select('title').lean()).map((c) => [String(c._id), c.title])
  );
  const stripe = getStripe();

  return res.json({
    success: true,
    data: {
      connect: {
        stripeReady: !!stripe,
        connected: !!user?.payout?.stripeAccountId,
        detailsSubmitted: !!user?.payout?.detailsSubmitted,
        payoutsEnabled: !!user?.payout?.payoutsEnabled,
        requirementsDue: user?.payout?.requirementsDue || [],
        country: user?.payout?.country || null,
      },
      rules: {
        platformFeePercent: settings.platformFeePercent ?? 20,
        refundWindowDays: settings.refundWindowDays ?? 7,
        minPayout: settings.minPayout ?? 20,
        payoutFeePercent: settings.payoutFeePercent ?? 0.25,
        payoutFeeFixed: settings.payoutFeeFixed ?? 0.25,
      },
      balances: balances.get(req.user!.id) || [],
      earnings: earnings.map((e) => ({
        id: String(e._id),
        kind: e.kind,
        classId: String(e.classId),
        classTitle: titles.get(String(e.classId)) || 'Deleted class',
        currency: e.currency,
        gross: e.gross,
        platformFee: e.platformFee,
        amount: e.amount,
        status: e.status,
        availableAt: e.availableAt || null,
        holdReason: e.holdReason || '',
        createdAt: e.createdAt,
      })),
      payouts: payouts.map((p) => ({
        id: String(p._id),
        currency: p.currency,
        amount: p.amount,
        fee: p.fee,
        net: p.net,
        status: p.status,
        method: p.method || null,
        reference: p.reference || '',
        note: p.note || '',
        failureReason: p.failureReason || '',
        requestedAt: p.requestedAt,
        decidedAt: p.decidedAt || null,
      })),
    },
  });
});

router.post('/connect/onboard', rateLimit({ windowMs: 60_000, max: 10, keyPrefix: 'connect-onboard' }), async (req: AuthRequest, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ success: false, message: 'Stripe payouts are not configured yet. Nexnoon will pay you manually for now.' });
  const parsed = z.object({ country: z.string().length(2).optional() }).safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Use a two-letter country code, e.g. NG, US, ES' });

  const user = await User.findById(req.user!.id);
  if (!user) return res.status(404).json({ success: false, message: 'Account not found' });
  if (user.instructorStatus !== 'approved') return res.status(403).json({ success: false, message: 'Only certified instructors can set up payouts' });

  try {
    let accountId = user.payout?.stripeAccountId;
    if (!accountId) {
      const platform = await stripe.accounts.retrieve();
      const country = (parsed.data.country || platform.country || 'US').toUpperCase();
      const crossBorder = !!platform.country && country !== platform.country;
      const account = await stripe.accounts.create({
        type: 'express',
        country,
        email: user.email,
        business_type: 'individual',
        capabilities: { transfers: { requested: true } },
        ...(crossBorder ? { tos_acceptance: { service_agreement: 'recipient' } } : {}),
        metadata: { nexnoonUserId: String(user._id) },
      });
      user.payout = connectSnapshot(account);
      await user.save();
      accountId = account.id;
    }
    const link = await stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      refresh_url: `${frontend()}/earnings?connect=refresh`,
      return_url: `${frontend()}/earnings?connect=return`,
    });
    return res.json({ success: true, data: { url: link.url } });
  } catch (err: any) {
    console.error('Stripe Connect onboarding failed:', err?.message);
    return res.status(502).json({ success: false, message: err?.message || 'Could not start Stripe onboarding' });
  }
});

router.post('/connect/refresh', async (req: AuthRequest, res) => {
  try {
    const user = await refreshConnect(req.user!.id);
    return res.json({ success: true, data: { payoutsEnabled: !!user?.payout?.payoutsEnabled }, message: user?.payout?.payoutsEnabled ? 'Payouts are enabled' : 'Stripe still needs a few details' });
  } catch (err: any) {
    return res.status(502).json({ success: false, message: err?.message || 'Could not reach Stripe' });
  }
});

router.post('/connect/dashboard', async (req: AuthRequest, res) => {
  const stripe = getStripe();
  const user = await User.findById(req.user!.id).select('payout');
  if (!stripe || !user?.payout?.stripeAccountId) return res.status(409).json({ success: false, message: 'Set up payouts first' });
  try {
    const link = await stripe.accounts.createLoginLink(user.payout.stripeAccountId);
    return res.json({ success: true, data: { url: link.url } });
  } catch (err: any) {
    return res.status(502).json({ success: false, message: err?.message || 'Could not open the Stripe dashboard' });
  }
});

router.post('/request', rateLimit({ windowMs: 60_000, max: 5, keyPrefix: 'payout-request' }), async (req: AuthRequest, res) => {
  const parsed = z.object({ currency: z.string().length(3) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Pick a currency' });
  const currency = parsed.data.currency.toLowerCase();
  const instructorId = req.user!.id;

  const user = await User.findById(instructorId).select('fullName instructorStatus payout');
  if (!user || user.instructorStatus !== 'approved') {
    return res.status(403).json({ success: false, message: 'Your teaching account is not active. Contact support about your balance.' });
  }
  if (await PayoutModel.exists({ instructorId, currency, status: { $in: ['requested', 'processing'] } })) {
    return res.status(409).json({ success: false, message: 'You already have a payout request waiting for review.' });
  }

  const stripe = getStripe();
  if (stripe) {
    const fresh = await refreshConnect(instructorId).catch(() => user);
    if (!fresh?.payout?.payoutsEnabled) {
      return res.status(409).json({ success: false, message: 'Finish setting up payouts with Stripe before requesting a payout.' });
    }
  }

  await syncEarnings();
  const settings = await getPlatformSettings();
  const rows = await EarningModel.find({ instructorId, currency, status: 'available' }).select('_id amount');
  const amount = round2(rows.reduce((s, r) => s + r.amount, 0));
  const min = settings.minPayout ?? 20;
  if (amount < min) {
    return res.status(409).json({ success: false, message: `The minimum payout is ${min} ${currency.toUpperCase()}. Available now: ${amount.toFixed(2)}.` });
  }
  const fee = payoutFee(amount, settings);
  const net = round2(amount - fee);

  const ids = rows.map((r) => r._id);
  const payout = await PayoutModel.create({
    instructorId,
    currency,
    amount,
    fee,
    net,
    status: 'requested',
    method: stripe ? 'stripe' : 'manual',
    earningIds: ids,
    requestedAt: new Date(),
  });
  const claimed = await EarningModel.updateMany({ _id: { $in: ids }, status: 'available' }, { $set: { status: 'requested', payoutId: payout._id } });
  if (claimed.modifiedCount !== ids.length) {
    await EarningModel.updateMany({ payoutId: payout._id }, { $set: { status: 'available' }, $unset: { payoutId: '' } });
    await payout.deleteOne();
    return res.status(409).json({ success: false, message: 'Your balance just changed. Please try again.' });
  }

  await logActivity({
    category: 'payment',
    action: 'payout_requested',
    message: `${user.fullName} requested a payout of ${net.toFixed(2)} ${currency.toUpperCase()}`,
    actorId: instructorId,
    actorName: user.fullName,
    actorRole: 'instructor',
    targetUserId: instructorId,
  });
  const admins = await User.find({ role: 'admin' }).select('_id').lean();
  await NotificationModel.insertMany(
    admins.map((a) => ({
      userId: a._id,
      type: 'payment',
      title: 'Payout requested',
      message: `${user.fullName} requested ${net.toFixed(2)} ${currency.toUpperCase()}.`,
      read: false,
      actionUrl: '/admin/dashboard?tab=payouts',
    }))
  ).catch(() => {});

  return res.status(201).json({
    success: true,
    data: { id: String(payout._id), amount, fee, net },
    message: `Payout of ${net.toFixed(2)} ${currency.toUpperCase()} requested. You’ll be notified when it’s sent.`,
  });
});

export default router;
