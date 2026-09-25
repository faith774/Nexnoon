import mongoose, { Document, Schema, Types } from 'mongoose';

export type WaitlistStatus = 'waiting' | 'offered' | 'claimed' | 'expired' | 'left' | 'closed';

export interface IWaitlistEntry extends Document {
  classId: Types.ObjectId;
  userId: Types.ObjectId;
  status: WaitlistStatus;
  joinedAt: Date;
  offeredAt?: Date;
  offerExpiresAt?: Date;
  resolvedAt?: Date;
}

const WaitlistSchema = new Schema<IWaitlistEntry>(
  {
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['waiting', 'offered', 'claimed', 'expired', 'left', 'closed'],
      default: 'waiting',
    },
    joinedAt: { type: Date, default: Date.now },
    offeredAt: { type: Date },
    offerExpiresAt: { type: Date },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

WaitlistSchema.index({ classId: 1, userId: 1 }, { unique: true });
WaitlistSchema.index({ classId: 1, status: 1, joinedAt: 1 });
WaitlistSchema.index({ status: 1, offerExpiresAt: 1 });

export const WaitlistModel = mongoose.model<IWaitlistEntry>('Waitlist', WaitlistSchema);
