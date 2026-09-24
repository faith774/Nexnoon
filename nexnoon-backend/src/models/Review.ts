import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IReview extends Document {
  classId: Types.ObjectId;
  userId: Types.ObjectId;
  userName: string;
  userAvatar?: string;
  rating: number;
  comment?: string;
  /** Moderation: hidden reviews are excluded from public lists and ratings. */
  status: 'visible' | 'flagged' | 'hidden';
  moderationNote?: string;
  moderatedAt?: Date;
  moderatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    userAvatar: { type: String },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String },
    status: { type: String, enum: ['visible', 'flagged', 'hidden'], default: 'visible', index: true },
    moderationNote: { type: String, maxlength: 1000 },
    moderatedAt: { type: Date },
    moderatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const ReviewModel = mongoose.model<IReview>('Review', ReviewSchema);


