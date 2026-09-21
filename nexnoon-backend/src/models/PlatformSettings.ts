import mongoose, { Document, Schema } from 'mongoose';

/** Singleton platform config. Always use key "default". */
export const PLATFORM_SETTINGS_KEY = 'default';
export const DEFAULT_MAX_CLASS_SEATS = 25;

export interface IPlatformSettings extends Document {
  key: string;
  /** Global seat cap applied to every class enrollment. Editable by admin. */
  maxClassSeats: number;
  updatedAt: Date;
  createdAt: Date;
}

const PlatformSettingsSchema = new Schema<IPlatformSettings>(
  {
    key: { type: String, required: true, unique: true, default: PLATFORM_SETTINGS_KEY },
    maxClassSeats: {
      type: Number,
      required: true,
      default: DEFAULT_MAX_CLASS_SEATS,
      min: 1,
      max: 500,
    },
  },
  { timestamps: true }
);

export const PlatformSettingsModel = mongoose.model<IPlatformSettings>(
  'PlatformSettings',
  PlatformSettingsSchema
);

export async function getPlatformSettings(): Promise<IPlatformSettings> {
  const existing = await PlatformSettingsModel.findOne({ key: PLATFORM_SETTINGS_KEY });
  if (existing) return existing;
  return PlatformSettingsModel.create({
    key: PLATFORM_SETTINGS_KEY,
    maxClassSeats: DEFAULT_MAX_CLASS_SEATS,
  });
}

export async function getMaxClassSeats(): Promise<number> {
  const settings = await getPlatformSettings();
  return settings.maxClassSeats;
}
