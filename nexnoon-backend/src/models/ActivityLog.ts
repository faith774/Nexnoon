import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * Lightweight platform ops log for super-admin monitoring.
 * Composed events (payments, enrollments) can also appear in the activity feed
 * without being written here; this collection stores explicit admin/system actions.
 */
export type ActivityActorRole = 'admin' | 'instructor' | 'student' | 'system';
export type ActivityCategory =
  | 'instructor'
  | 'learner'
  | 'class'
  | 'enrollment'
  | 'assignment'
  | 'payment'
  | 'course'
  | 'settings'
  | 'system';

export interface IActivityLog extends Document {
  category: ActivityCategory;
  action: string;
  message: string;
  actorId?: Types.ObjectId;
  actorName?: string;
  actorRole?: ActivityActorRole;
  targetUserId?: Types.ObjectId;
  targetClassId?: Types.ObjectId;
  meta?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    category: {
      type: String,
      enum: [
        'instructor',
        'learner',
        'class',
        'enrollment',
        'assignment',
        'payment',
        'course',
        'settings',
        'system',
      ],
      required: true,
      index: true,
    },
    action: { type: String, required: true },
    message: { type: String, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    actorName: { type: String },
    actorRole: { type: String, enum: ['admin', 'instructor', 'student', 'system'] },
    targetUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    targetClassId: { type: Schema.Types.ObjectId, ref: 'Class' },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

ActivityLogSchema.index({ createdAt: -1 });

export const ActivityLogModel = mongoose.model<IActivityLog>('ActivityLog', ActivityLogSchema);

export async function logActivity(input: {
  category: ActivityCategory;
  action: string;
  message: string;
  actorId?: string;
  actorName?: string;
  actorRole?: ActivityActorRole;
  targetUserId?: string;
  targetClassId?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    await ActivityLogModel.create({
      category: input.category,
      action: input.action,
      message: input.message,
      actorId: input.actorId,
      actorName: input.actorName,
      actorRole: input.actorRole || 'system',
      targetUserId: input.targetUserId,
      targetClassId: input.targetClassId,
      meta: input.meta,
    });
  } catch (error) {
    console.error('Failed to write activity log:', error instanceof Error ? error.message : error);
  }
}
