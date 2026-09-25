import { Router } from 'express';
import { WaitlistModel } from '../models/Waitlist';
import { offerNextSeats } from '../utils/seats';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { ClassModel } from '../models/Class';
import {
  DEFAULT_MAX_CLASS_SEATS,
  DEFAULT_QUALITY_WEIGHTS,
  getPlatformSettings,
  PlatformSettingsModel,
  PLATFORM_SETTINGS_KEY,
} from '../models/PlatformSettings';
import { getZoomIntegrationStatus } from '../utils/zoom';
import { getIntegrationsStatus } from '../utils/integrations';

const router = Router();

const qualityWeightsSchema = z.object({
  learnerRating: z.number().min(0).max(100),
  completion: z.number().min(0).max(100),
  attendance: z.number().min(0).max(100),
  feedback: z.number().min(0).max(100),
  adminEvaluation: z.number().min(0).max(100),
}).refine(
  (w) => w.learnerRating + w.completion + w.attendance + w.feedback + w.adminEvaluation === 100,
  { message: 'Quality weights must sum to 100' }
);

const updateSchema = z.object({
  maxClassSeats: z
    .number()
    .int('maxClassSeats must be a whole number')
    .min(1, 'maxClassSeats must be at least 1')
    .max(500, 'maxClassSeats cannot exceed 500')
    .optional(),
  qualityWeights: qualityWeightsSchema.optional(),
  platformFeePercent: z.number().min(0).max(100).optional(),
  refundWindowDays: z.number().int().min(0).max(90).optional(),
  minPayout: z.number().min(0).max(100000).optional(),
  payoutFeePercent: z.number().min(0).max(10).optional(),
  payoutFeeFixed: z.number().min(0).max(50).optional(),
}).refine((d) => Object.values(d).some((v) => v !== undefined), {
  message: 'Provide at least one setting to update',
});

const PAYOUT_KEYS = ['platformFeePercent', 'refundWindowDays', 'minPayout', 'payoutFeePercent', 'payoutFeeFixed'] as const;

/** Public: learners/instructors need the current seat cap for UI. */
router.get('/platform', async (_req, res) => {
  const settings = await getPlatformSettings();
  return res.json({
    success: true,
    data: {
      maxClassSeats: settings.maxClassSeats,
      refundWindowDays: settings.refundWindowDays ?? 7,
      updatedAt: settings.updatedAt,
    },
  });
});

/**
 * Zoom integration readiness (no secrets). Instructors use this to know why
 * "Meeting credentials are not ready" appears; admins use it to verify env setup.
 */
router.get('/zoom', requireAuth, requireRole('instructor', 'admin'), async (_req, res) => {
  return res.json({
    success: true,
    data: getZoomIntegrationStatus(),
  });
});

/**
 * Full integrations readiness (Stripe + Email + Zoom). Admin only. No secrets.
 */
router.get('/integrations', requireAuth, requireRole('admin'), async (_req, res) => {
  return res.json({
    success: true,
    data: getIntegrationsStatus(),
  });
});

/** Admin-only update of platform-wide settings. */
router.patch('/platform', requireAuth, requireRole('admin'), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: parsed.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      })),
    });
  }

  const $set: Record<string, unknown> = {};
  if (parsed.data.maxClassSeats !== undefined) $set.maxClassSeats = parsed.data.maxClassSeats;
  if (parsed.data.qualityWeights) $set.qualityWeights = parsed.data.qualityWeights;
  for (const key of PAYOUT_KEYS) if (parsed.data[key] !== undefined) $set[key] = parsed.data[key];

  const settings = await PlatformSettingsModel.findOneAndUpdate(
    { key: PLATFORM_SETTINGS_KEY },
    {
      $set,
      $setOnInsert: { key: PLATFORM_SETTINGS_KEY },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  if (parsed.data.maxClassSeats !== undefined) {
    await ClassModel.updateMany({}, { $set: { maxStudents: parsed.data.maxClassSeats } });
    const waiting = await WaitlistModel.distinct('classId', { status: 'waiting' });
    for (const classId of waiting) await offerNextSeats(String(classId)).catch(() => {});
  }

  return res.json({
    success: true,
    data: {
      maxClassSeats: settings?.maxClassSeats ?? DEFAULT_MAX_CLASS_SEATS,
      qualityWeights: settings?.qualityWeights ?? DEFAULT_QUALITY_WEIGHTS,
      platformFeePercent: settings?.platformFeePercent ?? 20,
      refundWindowDays: settings?.refundWindowDays ?? 7,
      minPayout: settings?.minPayout ?? 20,
      payoutFeePercent: settings?.payoutFeePercent ?? 0.25,
      payoutFeeFixed: settings?.payoutFeeFixed ?? 0.25,
      updatedAt: settings?.updatedAt,
    },
    message: 'Platform settings updated',
  });
});

export default router;
