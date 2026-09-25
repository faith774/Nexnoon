import app from './app';
import { connectDB } from './config/db';
import { ENV } from './config/env';
import { startSessionReminders } from './utils/reminders';
import { backfillClassTimeZones } from './utils/backfill';
import { startWaitlistSweeper } from './utils/seats';

function validateEnv() {
  if (ENV.NODE_ENV !== 'production') return;
  const missing: string[] = [];
  if (!ENV.JWT_ACCESS_SECRET || ENV.JWT_ACCESS_SECRET === 'change-me-access')
    missing.push('JWT_ACCESS_SECRET');
  if (!ENV.JWT_REFRESH_SECRET || ENV.JWT_REFRESH_SECRET === 'change-me-refresh')
    missing.push('JWT_REFRESH_SECRET');
  if (!ENV.MONGODB_URI || ENV.MONGODB_URI.includes('localhost'))
    missing.push('MONGODB_URI (use Atlas or production DB)');
  if (!ENV.FRONTEND_URL || ENV.FRONTEND_URL.includes('localhost'))
    missing.push('FRONTEND_URL (use production frontend URL)');
  if (missing.length > 0) {
    console.error('Production env validation failed. Set in .env:', missing.join(', '));
    process.exit(1);
  }
}

const start = async () => {
  try {
    validateEnv();
    await connectDB();
    await backfillClassTimeZones()
      .then((n) => n && console.log(`Assigned a time zone to ${n} older class${n === 1 ? '' : 'es'}`))
      .catch((error) => console.error('Class time zone backfill failed:', error instanceof Error ? error.message : error));
    startSessionReminders();
    startWaitlistSweeper();
    app.listen(ENV.PORT, () => {
      console.log(`Nexnon API running on http://localhost:${ENV.PORT}`);
      console.log(`  Health: http://localhost:${ENV.PORT}/health`);
      console.log(`  API v1: http://localhost:${ENV.PORT}/v1`);
    });
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
};

start();


