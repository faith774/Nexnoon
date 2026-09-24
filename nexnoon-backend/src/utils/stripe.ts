import Stripe from 'stripe';
import { ENV } from '../config/env';
import { isStripeConfigured } from './integrations';

let client: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (client === undefined) client = isStripeConfigured() ? new Stripe(ENV.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' }) : null;
  return client;
}

export const toMinorUnits = (amount: number) => Math.round(amount * 100);
export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Flags we keep on the user so dashboards don't have to call Stripe on every render. */
export function connectSnapshot(account: Stripe.Account) {
  return {
    stripeAccountId: account.id,
    country: account.country || undefined,
    detailsSubmitted: !!account.details_submitted,
    payoutsEnabled: !!account.payouts_enabled,
    requirementsDue: account.requirements?.currently_due || [],
    updatedAt: new Date(),
  };
}
