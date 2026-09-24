import mongoose, { Document, Schema, Types } from 'mongoose';

export type PayoutStatus = 'requested' | 'processing' | 'paid' | 'rejected' | 'failed';

export interface IPayout extends Document {
  instructorId: Types.ObjectId;
  currency: string;
  /** Sum of the ledger rows in this payout (before fee). */
  amount: number;
  /** Transfer fee deducted from the instructor share. */
  fee: number;
  /** What the instructor receives. */
  net: number;
  status: PayoutStatus;
  method?: 'stripe' | 'manual';
  stripeTransferId?: string;
  /** Bank / Wise / Payoneer reference for manual payouts. */
  reference?: string;
  earningIds: Types.ObjectId[];
  requestedAt: Date;
  decidedAt?: Date;
  decidedBy?: Types.ObjectId;
  note?: string;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PayoutSchema = new Schema<IPayout>(
  {
    instructorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    currency: { type: String, required: true, lowercase: true },
    amount: { type: Number, required: true },
    fee: { type: Number, required: true },
    net: { type: Number, required: true },
    status: { type: String, enum: ['requested', 'processing', 'paid', 'rejected', 'failed'], default: 'requested', index: true },
    method: { type: String, enum: ['stripe', 'manual'] },
    stripeTransferId: { type: String },
    reference: { type: String, maxlength: 300 },
    earningIds: [{ type: Schema.Types.ObjectId, ref: 'Earning' }],
    requestedAt: { type: Date, default: Date.now },
    decidedAt: { type: Date },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, maxlength: 2000 },
    failureReason: { type: String, maxlength: 1000 },
  },
  { timestamps: true }
);

export const PayoutModel = mongoose.model<IPayout>('Payout', PayoutSchema);
