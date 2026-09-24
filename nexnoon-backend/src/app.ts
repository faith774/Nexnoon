import express from 'express';
import 'express-async-errors';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { ENV } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import classRoutes from './routes/class.routes';
import courseRoutes from './routes/course.routes';
import enrollmentRoutes from './routes/enrollment.routes';
import notificationRoutes from './routes/notification.routes';
import reviewRoutes from './routes/review.routes';
import dataRoutes from './routes/data.routes';
import contactRoutes from './routes/contact.routes';
import zoomWebhookRoutes from './routes/zoom-webhook.routes';
import settingsRoutes from './routes/settings.routes';
import stripeWebhookRoutes from './routes/stripe-webhook.routes';
import adminRoutes from './routes/admin.routes';
import payoutRoutes from './routes/payout.routes';
import reportRoutes from './routes/report.routes';
import mongoose from 'mongoose';

const app = express();

// CORS: allow the public site and the admin portal (production-safe)
const isProd = ENV.NODE_ENV === 'production';
const allowedOrigins = [ENV.FRONTEND_URL, ENV.ADMIN_URL]
  .filter(Boolean)
  .map((origin) => origin.replace(/\/+$/, ''));
app.use(
  cors({
    origin: isProd ? allowedOrigins : true, // true = reflect request origin in dev
    credentials: true,
  })
);
app.use(helmet());
// Captures the exact bytes Zoom signed, alongside normal JSON parsing, so the
// webhook route can verify its HMAC signature without a second body-parsing pass
// (which would otherwise break JSON parsing for every other route).
app.use(
  express.json({
    limit: '5mb',
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  })
);
app.use(morgan(isProd ? 'combined' : 'dev'));

// Health check (no /v1 prefix for load balancers)
app.get('/health', (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({ success: connected, data: { status: connected ? 'ok' : 'database unavailable' } });
});

// API v1 (versioned for production)
app.use('/v1/auth', authRoutes);
app.use('/v1/classes', classRoutes);
app.use('/v1/courses', courseRoutes);
app.use('/v1/enrollments', enrollmentRoutes);
app.use('/v1/notifications', notificationRoutes);
app.use('/v1/reviews', reviewRoutes);
app.use('/v1/data', dataRoutes);
app.use('/v1/contact', contactRoutes);
app.use('/v1/zoom/webhook', zoomWebhookRoutes);
app.use('/v1/stripe/webhook', stripeWebhookRoutes);
app.use('/v1/settings', settingsRoutes);
app.use('/v1/admin', adminRoutes);
app.use('/v1/payouts', payoutRoutes);
app.use('/v1/reports', reportRoutes);

app.use(errorHandler);

export default app;


