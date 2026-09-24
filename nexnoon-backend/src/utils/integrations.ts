import { ENV } from '../config/env';
import { getZoomIntegrationStatus } from './zoom';

/** True when a value is empty or still the .env.example placeholder. */
export function isEnvPlaceholder(value: string | undefined | null): boolean {
  if (!value || !String(value).trim()) return true;
  const s = String(value).trim();
  return (
    /^your[_-]/i.test(s) ||
    /your_/i.test(s) ||
    /change-this|change-me/i.test(s) ||
    /example\.com/i.test(s) ||
    /sk_test_your|sk_live_your|pk_test_your|pk_live_your|whsec_your/i.test(s) ||
    /your-brevo|your_cloudinary|your-super-secret/i.test(s)
  );
}

export function isStripeConfigured(): boolean {
  const key = ENV.STRIPE_SECRET_KEY;
  if (isEnvPlaceholder(key)) return false;
  return key.startsWith('sk_test_') || key.startsWith('sk_live_');
}

export function isStripeWebhookConfigured(): boolean {
  const secret = ENV.STRIPE_WEBHOOK_SECRET;
  if (isEnvPlaceholder(secret)) return false;
  return secret.startsWith('whsec_');
}

export function isEmailConfiguredHonest(): boolean {
  return (
    !isEnvPlaceholder(ENV.SMTP_HOST) &&
    !isEnvPlaceholder(ENV.SMTP_USER) &&
    !isEnvPlaceholder(ENV.SMTP_PASS)
  );
}

/**
 * Safe readiness report for admin / smoke scripts — never includes secrets.
 */
export function getIntegrationsStatus() {
  const zoom = getZoomIntegrationStatus();
  const stripeKey = ENV.STRIPE_SECRET_KEY || '';
  const stripeMode = !isStripeConfigured()
    ? 'missing'
    : stripeKey.startsWith('sk_live_')
      ? 'live'
      : stripeKey.startsWith('sk_test_')
        ? 'test'
        : 'unknown';

  return {
    readyForSoftLaunch:
      isStripeConfigured() &&
      zoom.meetings.configured &&
      zoom.meetingSdk.configured &&
      isEmailConfiguredHonest(),
    stripe: {
      configured: isStripeConfigured(),
      mode: stripeMode,
      webhookConfigured: isStripeWebhookConfigured(),
      purpose: 'Paid enrollments + refunds when a class fills mid-payment',
    },
    email: {
      configured: isEmailConfiguredHonest(),
      host: isEnvPlaceholder(ENV.SMTP_HOST) ? null : ENV.SMTP_HOST,
      purpose: 'Enrollment confirmations, instructor decisions, password reset',
    },
    zoom,
    docs: {
      zoom: 'docs/ZOOM_INTEGRATION.md',
      envExample: 'nexnoon-backend/.env.example',
    },
  };
}
