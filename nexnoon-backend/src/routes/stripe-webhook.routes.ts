import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { ENV } from '../config/env';
import { PaymentModel } from '../models/Payment';

const router = Router();

const stripe = ENV.STRIPE_SECRET_KEY
  ? new Stripe(ENV.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
  : null;

/**
 * Stripe webhook endpoint.
 * Uses the raw request body captured in app.ts for signature verification.
 * Set STRIPE_WEBHOOK_SECRET from Dashboard → Developers → Webhooks.
 */
router.post('/', async (req: Request, res: Response) => {
  if (!stripe || !ENV.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({
      success: false,
      message: 'Stripe webhooks are not configured',
    });
  }

  const signature = req.headers['stripe-signature'];
  if (!signature || typeof signature !== 'string') {
    return res.status(400).json({ success: false, message: 'Missing Stripe signature' });
  }

  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!rawBody) {
    return res.status(400).json({ success: false, message: 'Missing raw request body' });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, ENV.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('Stripe webhook signature verification failed:', err?.message);
    return res.status(400).json({ success: false, message: 'Invalid Stripe signature' });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        await PaymentModel.findOneAndUpdate(
          { stripePaymentIntentId: intent.id },
          {
            $set: {
              status: 'completed',
              stripeChargeId:
                typeof intent.latest_charge === 'string'
                  ? intent.latest_charge
                  : intent.latest_charge?.id,
            },
          }
        );
        break;
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent;
        await PaymentModel.findOneAndUpdate(
          { stripePaymentIntentId: intent.id },
          { $set: { status: 'failed' } }
        );
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId =
          typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : charge.payment_intent?.id;
        if (paymentIntentId) {
          await PaymentModel.findOneAndUpdate(
            { stripePaymentIntentId: paymentIntentId },
            { $set: { status: 'refunded' } }
          );
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error('Stripe webhook handler error:', err);
    return res.status(500).json({ success: false, message: 'Webhook handler failed' });
  }

  return res.json({ received: true });
});

export default router;
