import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * Basic attendance MVP: records only what can be recorded reliably.
 * `zoomJoinedAt`/`zoomLeftAt` are filled in later by a correlated webhook event and
 * must never be set from unauthenticated/unverified input. One row per student per
 * session (upserted), so reconnects/duplicate webhooks update it instead of
 * multiplying rows.
 */
export interface IAttendanceRecord extends Document {
  classId: Types.ObjectId;
  sessionId: Types.ObjectId;
  userId: Types.ObjectId;
  enrollmentId: Types.ObjectId;
  authorizedAt: Date;
  late: boolean;
  sdkJoinedAt?: Date;
  zoomJoinedAt?: Date;
  zoomLeftAt?: Date;
  durationSeconds?: number;
}

const AttendanceRecordSchema = new Schema<IAttendanceRecord>(
  {
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'ClassSchedule', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    enrollmentId: { type: Schema.Types.ObjectId, ref: 'Enrollment', required: true },
    authorizedAt: { type: Date, required: true },
    late: { type: Boolean, default: false },
    sdkJoinedAt: { type: Date },
    zoomJoinedAt: { type: Date },
    zoomLeftAt: { type: Date },
    durationSeconds: { type: Number },
  },
  { timestamps: true }
);

AttendanceRecordSchema.index({ sessionId: 1, userId: 1 }, { unique: true });

export const AttendanceRecordModel = mongoose.model<IAttendanceRecord>(
  'AttendanceRecord',
  AttendanceRecordSchema
);
