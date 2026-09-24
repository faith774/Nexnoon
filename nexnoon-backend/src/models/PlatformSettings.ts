import mongoose, { Document, Schema } from 'mongoose';

/** Singleton platform config. Always use key "default". */
export const PLATFORM_SETTINGS_KEY = 'default';
export const DEFAULT_MAX_CLASS_SEATS = 25;

export const DEFAULT_QUALITY_WEIGHTS = {
  learnerRating: 40,
  completion: 20,
  attendance: 15,
  feedback: 15,
  adminEvaluation: 10,
};

export interface IPlatformSettings extends Document {
  key: string;
  /** Global seat cap applied to every class enrollment. Editable by admin. */
  maxClassSeats: number;
  /** Configurable instructor quality score weights (must sum to 100). */
  qualityWeights: {
    learnerRating: number;
    completion: number;
    attendance: number;
    feedback: number;
    adminEvaluation: number;
  };
  /** Nexnoon's share of each paid enrollment (%), taken when the earning is recorded. */
  platformFeePercent: number;
  /** Days after a class ends before instructor earnings become withdrawable. */
  refundWindowDays: number;
  /** Smallest payout an instructor can request (in the payout currency). */
  minPayout: number;
  /** Transfer fee charged to the instructor per payout: percent + fixed. */
  payoutFeePercent: number;
  payoutFeeFixed: number;
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
    qualityWeights: {
      type: {
        learnerRating: { type: Number, default: 40 },
        completion: { type: Number, default: 20 },
        attendance: { type: Number, default: 15 },
        feedback: { type: Number, default: 15 },
        adminEvaluation: { type: Number, default: 10 },
      },
      default: () => ({ ...DEFAULT_QUALITY_WEIGHTS }),
    },
    platformFeePercent: { type: Number, default: 20, min: 0, max: 100 },
    refundWindowDays: { type: Number, default: 7, min: 0, max: 90 },
    minPayout: { type: Number, default: 20, min: 0 },
    payoutFeePercent: { type: Number, default: 0.25, min: 0, max: 10 },
    payoutFeeFixed: { type: Number, default: 0.25, min: 0, max: 50 },
  },
  { timestamps: true }
);

export const PlatformSettingsModel = mongoose.model<IPlatformSettings>(
  'PlatformSettings',
  PlatformSettingsSchema
);

export async function getPlatformSettings(): Promise<IPlatformSettings> {
  const existing = await PlatformSettingsModel.findOne({ key: PLATFORM_SETTINGS_KEY });
  if (existing) {
    if (!existing.qualityWeights) {
      existing.qualityWeights = { ...DEFAULT_QUALITY_WEIGHTS } as any;
      await existing.save();
    }
    return existing;
  }
  return PlatformSettingsModel.create({
    key: PLATFORM_SETTINGS_KEY,
    maxClassSeats: DEFAULT_MAX_CLASS_SEATS,
    qualityWeights: { ...DEFAULT_QUALITY_WEIGHTS },
  });
}

export async function getMaxClassSeats(): Promise<number> {
  const settings = await getPlatformSettings();
  return settings.maxClassSeats;
}

export function computeQualityScore(input: {
  learnerRating: number; // 0-5
  completionRate: number; // 0-100
  attendanceRate: number; // 0-100
  feedbackScore: number; // 0-100
  adminEvaluation: number; // 0-100
  weights?: typeof DEFAULT_QUALITY_WEIGHTS;
}) {
  const w = input.weights || DEFAULT_QUALITY_WEIGHTS;
  const ratingPct = (Math.min(5, Math.max(0, input.learnerRating)) / 5) * 100;
  return Math.round(
    (ratingPct * w.learnerRating +
      input.completionRate * w.completion +
      input.attendanceRate * w.attendance +
      input.feedbackScore * w.feedback +
      input.adminEvaluation * w.adminEvaluation) /
      100
  );
}
