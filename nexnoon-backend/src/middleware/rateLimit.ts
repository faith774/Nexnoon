import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

/**
 * Minimal in-memory fixed-window rate limiter. No new dependency is pulled in for
 * this - the app has a single process per environment (see server.ts), so an
 * in-memory window is sufficient for the bounded MVP scope this guards
 * (meeting creation, host-access, join-credentials, webhook delivery).
 */
const hits = new Map<string, { count: number; resetAt: number }>();

// Bound memory: drop expired entries periodically instead of growing forever.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of hits) {
    if (entry.resetAt <= now) hits.delete(key);
  }
}, 60_000).unref();

export function rateLimit(options: { windowMs: number; max: number; keyPrefix: string }) {
  const { windowMs, max, keyPrefix } = options;
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const identity = req.user?.id || req.ip || 'anonymous';
    const key = `${keyPrefix}:${identity}`;
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= max) {
      const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ success: false, message: 'Too many requests, please try again shortly' });
    }

    entry.count += 1;
    return next();
  };
}
