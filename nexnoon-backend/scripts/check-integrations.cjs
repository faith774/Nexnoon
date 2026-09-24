/**
 * Print Stripe / Email / Zoom readiness without leaking secrets.
 * Usage: node scripts/check-integrations.cjs
 */
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

function isPlaceholder(value) {
  if (!value || !String(value).trim()) return true;
  const s = String(value).trim();
  return (
    /^your[_-]/i.test(s) ||
    /your_/i.test(s) ||
    /change-this|change-me/i.test(s) ||
    /example\.com/i.test(s) ||
    /sk_test_your|sk_live_your|pk_test_your|whsec_your/i.test(s) ||
    /your-brevo|your_cloudinary|your-super-secret/i.test(s)
  );
}

function row(label, ok, detail) {
  console.log(`${ok ? 'OK ' : '-- '} ${label}${detail ? ` — ${detail}` : ''}`);
}

const e = process.env;
const stripe = e.STRIPE_SECRET_KEY || '';
const stripeOk = !isPlaceholder(stripe) && (stripe.startsWith('sk_test_') || stripe.startsWith('sk_live_'));
const emailOk =
  !isPlaceholder(e.SMTP_HOST) && !isPlaceholder(e.SMTP_USER) && !isPlaceholder(e.SMTP_PASS);
const zoomMeetings =
  !isPlaceholder(e.ZOOM_ACCOUNT_ID) &&
  !isPlaceholder(e.ZOOM_CLIENT_ID) &&
  !isPlaceholder(e.ZOOM_CLIENT_SECRET);
const zoomSdk =
  !isPlaceholder(e.ZOOM_MEETING_SDK_CLIENT_ID) &&
  !isPlaceholder(e.ZOOM_MEETING_SDK_CLIENT_SECRET);

console.log('\nNexnoon integrations readiness\n');
row(
  'Stripe secret',
  stripeOk,
  stripeOk ? (stripe.startsWith('sk_live_') ? 'live' : 'test') : 'set sk_test_… or sk_live_… in .env'
);
row('Stripe webhook', !isPlaceholder(e.STRIPE_WEBHOOK_SECRET) && String(e.STRIPE_WEBHOOK_SECRET).startsWith('whsec_'));
row('Email SMTP', emailOk, emailOk ? e.SMTP_HOST : 'host + user + pass required');
row('Zoom meetings (S2S)', zoomMeetings, 'ZOOM_ACCOUNT_ID / CLIENT_ID / CLIENT_SECRET');
row('Zoom Meeting SDK', zoomSdk, 'learner in-browser join');
row('Zoom webhooks', !isPlaceholder(e.ZOOM_WEBHOOK_SECRET_TOKEN));
row('MongoDB', !isPlaceholder(e.MONGODB_URI));
row('Frontend URL', !isPlaceholder(e.FRONTEND_URL), e.FRONTEND_URL || '');

const ready = stripeOk && emailOk && zoomMeetings && zoomSdk;
console.log(`\nSoft-launch ready: ${ready ? 'YES' : 'NO'}`);
if (!ready) {
  console.log('Fill missing keys in nexnoon-backend/.env (see .env.example + docs/ZOOM_INTEGRATION.md).');
  console.log('Frontend also needs VITE_STRIPE_PUBLISHABLE_KEY in nexnoon-frontend/.env for paid checkout.\n');
  process.exitCode = 1;
} else {
  console.log('Next: npm run smoke:e2e  (with API running)\n');
}
