import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { ClassModel } from '../models/Class';
import {
  DEFAULT_MAX_CLASS_SEATS,
  getPlatformSettings,
  PlatformSettingsModel,
  PLATFORM_SETTINGS_KEY,
} from '../models/PlatformSettings';

const router = Router();

const updateSchema = z.object({
  maxClassSeats: z
    .number({ required_error: 'maxClassSeats is required' })
    .int('maxClassSeats must be a whole number')
    .min(1, 'maxClassSeats must be at least 1')
    .max(500, 'maxClassSeats cannot exceed 500'),
});

/** Public: learners/instructors need the current seat cap for UI. */
router.get('/platform', async (_req, res) => {
  const settings = await getPlatformSettings();
  return res.json({
    success: true,
    data: {
      maxClassSeats: settings.maxClassSeats,
      updatedAt: settings.updatedAt,
    },
  });
});

/** Admin-only update of platform-wide class capacity. */
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

  const settings = await PlatformSettingsModel.findOneAndUpdate(
    { key: PLATFORM_SETTINGS_KEY },
    {
      $set: { maxClassSeats: parsed.data.maxClassSeats },
      $setOnInsert: { key: PLATFORM_SETTINGS_KEY },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  await ClassModel.updateMany({}, { $set: { maxStudents: parsed.data.maxClassSeats } });

  return res.json({
    success: true,
    data: {
      maxClassSeats: settings?.maxClassSeats ?? DEFAULT_MAX_CLASS_SEATS,
      updatedAt: settings?.updatedAt,
    },
    message: `Platform class capacity set to ${parsed.data.maxClassSeats} seats`,
  });
});

export default router;
