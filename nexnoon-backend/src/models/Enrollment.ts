import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IEnrollment extends Document {
  classId: Types.ObjectId;
  userId: Types.ObjectId;
  status: 'active' | 'completed' | 'dropped';
  progress: number;
  attendedSessions: Types.ObjectId[];
  enrolledAt: Date;
  completedAt?: Date;
  certificateUrl?: string;
}

const EnrollmentSchema = new Schema<IEnrollment>(
  {
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['active', 'completed', 'dropped'],
      default: 'active',
    },
    progress: { type: Number, default: 0 },
    attendedSessions: { type: [Schema.Types.ObjectId], ref: 'ClassSchedule', default: [] },
    enrolledAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    certificateUrl: { type: String },
  },
  { timestamps: true }
);

EnrollmentSchema.index({ classId: 1, userId: 1 }, { unique: true });

export const EnrollmentModel = mongoose.model<IEnrollment>('Enrollment', EnrollmentSchema);


