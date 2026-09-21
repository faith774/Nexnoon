import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * A student's answer to one of a class's `assignments` array entries.
 * Assignments live embedded on the Class document (not their own collection),
 * so `assignmentId` here is that subdocument's `_id` rather than a ref - there
 * is nothing else to populate against.
 */
export interface IAssignmentSubmission extends Document {
  classId: Types.ObjectId;
  assignmentId: string;
  userId: Types.ObjectId;
  content?: string;
  attachmentUrl?: string;
  submittedAt: Date;
}

const AssignmentSubmissionSchema = new Schema<IAssignmentSubmission>(
  {
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true },
    assignmentId: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String },
    attachmentUrl: { type: String },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One submission per student per assignment - resubmitting overwrites in place
// instead of piling up duplicates.
AssignmentSubmissionSchema.index({ assignmentId: 1, userId: 1 }, { unique: true });

export const AssignmentSubmissionModel = mongoose.model<IAssignmentSubmission>(
  'AssignmentSubmission',
  AssignmentSubmissionSchema
);
