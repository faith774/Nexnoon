import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * Instructor earnings ledger. One `sale` row per completed learner payment; a
 * refund either voids the sale (not yet paid out) or adds a negative `reversal`
 * that is netted from the instructor's next payout.
 */
export type EarningKind = 'sale' | 'reversal';
export type EarningStatus = 'pending' | 'available' | 'requested' | 'paid' | 'void';

export interface IEarning extends Document {
  kind: EarningKind;
  instructorId: Types.ObjectId;
  classId: Types.ObjectId;
  paymentId: Types.ObjectId;
  learnerId: Types.ObjectId;
  currency: string;
  /** What the learner paid. */
  gross: number;
  feePercent: number;
  platformFee: number;
  /** Instructor share (negative for reversals). */
  amount: number;
  status: EarningStatus;
  /** Pending sales become available after this (class end + refund window). Null = on hold. */
  availableAt?: Date | null;
  holdReason?: string;
  payoutId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const EarningSchema = new Schema<IEarning>(
  {
    kind: { type: String, enum: ['sale', 'reversal'], required: true },
    instructorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true, index: true },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', required: true },
    learnerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    currency: { type: String, required: true, lowercase: true },
    gross: { type: Number, required: true },
    feePercent: { type: Number, required: true },
    platformFee: { type: Number, required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'available', 'requested', 'paid', 'void'], default: 'pending', index: true },
    availableAt: { type: Date, default: null },
    holdReason: { type: String },
    payoutId: { type: Schema.Types.ObjectId, ref: 'Payout', index: true },
  },
  { timestamps: true }
);

EarningSchema.index({ paymentId: 1, kind: 1 }, { unique: true });

export const EarningModel = mongoose.model<IEarning>('Earning', EarningSchema);
