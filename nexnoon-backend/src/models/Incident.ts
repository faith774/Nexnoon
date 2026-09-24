import mongoose, { Document, Schema, Types } from 'mongoose';

export const INCIDENT_TYPES = [
  'instructor_no_show',
  'late_start',
  'technical',
  'conduct',
  'curriculum_drift',
  'off_platform_payment',
  'learner_complaint',
  'other',
] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];
export type IncidentSeverity = 'low' | 'medium' | 'high';
export type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'dismissed';

/** Quality incidents logged against a class / instructor (PRD §11, trust & safety NFR). */
export interface IIncident extends Document {
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description?: string;
  resolution?: string;
  classId?: Types.ObjectId;
  sessionId?: Types.ObjectId;
  instructorId?: Types.ObjectId;
  learnerId?: Types.ObjectId;
  occurredAt: Date;
  reportedBy?: Types.ObjectId;
  reportedByName?: string;
  reporterRole?: 'admin' | 'instructor' | 'student';
  resolvedAt?: Date;
  resolvedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const IncidentSchema = new Schema<IIncident>(
  {
    type: { type: String, enum: INCIDENT_TYPES, required: true },
    severity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    status: { type: String, enum: ['open', 'investigating', 'resolved', 'dismissed'], default: 'open', index: true },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, maxlength: 5000 },
    resolution: { type: String, maxlength: 5000 },
    classId: { type: Schema.Types.ObjectId, ref: 'Class', index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'ClassSchedule' },
    instructorId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    learnerId: { type: Schema.Types.ObjectId, ref: 'User' },
    occurredAt: { type: Date, default: Date.now },
    reportedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reportedByName: { type: String },
    reporterRole: { type: String, enum: ['admin', 'instructor', 'student'] },
    resolvedAt: { type: Date },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

IncidentSchema.index({ createdAt: -1 });

export const IncidentModel = mongoose.model<IIncident>('Incident', IncidentSchema);
