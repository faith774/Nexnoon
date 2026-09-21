import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IClassSchedule extends Document {
  classId: Types.ObjectId;
  sessionNumber: number;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  zoomLink?: string;
  zoomMeetingId?: string;
  zoomPasscode?: string;
  /**
   * @deprecated No longer written. A Zoom start_url is a sensitive host credential
   * (it embeds an authorization token) that Zoom expires ~2 hours after the
   * meeting was *created* - not from the class's scheduled time - so a value
   * stored here at creation time cannot be trusted as valid host authorization by
   * the time an instructor actually starts the class. The host-access route
   * (POST /classes/:classId/sessions/:sessionId/host-access) always fetches a
   * fresh one via Zoom's Retrieve-a-Meeting API instead. This field is kept only
   * so any value written by a pre-correction deployment doesn't break reads of
   * older documents; it is never read as a source of truth. `select: false` keeps
   * it out of ordinary queries as defense in depth.
   */
  zoomStartUrl?: string;
  /** Zoom user (company account) this meeting was created under - used for host-conflict checks. */
  zoomHostUserId?: string;
  /** Tracks the Zoom meeting-creation call itself, independent of session lifecycle below. */
  meetingCreationStatus: 'pending' | 'creating' | 'ready' | 'failed' | 'skipped';
  /**
   * Session lifecycle, driven by Zoom webhooks (see zoom-webhook.routes.ts):
   * scheduled -> live (meeting.started) -> completed (meeting.ended), or
   * scheduled -> cancelled (instructor action). There is no separate "ended"
   * limbo state between live and completed - the moment Zoom reports the
   * meeting stopped, the session is done, for both the instructor and every
   * student, with nothing further to finalize.
   */
  status: 'scheduled' | 'live' | 'completed' | 'cancelled';
  recordingUrl?: string;
}

export interface IClass extends Document {
  details?: { overview?: string; instructorTitle?: string; instructorBio?: string; instructorImage?: string; previewVideoUrl?: string; curriculumIntro?: string; certificateInfo?: string; outcomes?: string[]; curriculum?: { title: string; topics: string[]; project: string }[]; faqs?: { question: string; answer: string }[] };
  title: string;
  description: string;
  category: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  price: number;
  currency: string;
  language?: string;
  maxStudents?: number;
  learningOutcomes: string[];
  prerequisites: string[];
  materials: string[];
  assignments: { title: string; description?: string; dueDate?: Date; attachmentUrl?: string }[];
  instructor: {
    id: Types.ObjectId;
    name: string;
    avatar?: string;
    bio?: string;
    rating?: number;
  };
  thumbnail?: string;
  duration: number;
  totalSessions: number;
  enrolledStudents: number;
  rating: number;
  reviewsCount: number;
  isLive: boolean;
  startDate?: Date;
  endDate?: Date;
  status: 'draft' | 'published' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

const DetailsSchema = new Schema({
  overview: String, instructorTitle: String, instructorBio: String, instructorImage: String,
  previewVideoUrl: String, curriculumIntro: String, certificateInfo: String, outcomes: [String],
  curriculum: [{ title: String, topics: [String], project: String }],
  faqs: [{ question: String, answer: String }],
}, { _id: false });

const ClassSchema = new Schema<IClass>(
  {
    details: { type: DetailsSchema },
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    level: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], required: true },
    price: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    language: { type: String },
    maxStudents: { type: Number },
    learningOutcomes: { type: [String], default: [] },
    prerequisites: { type: [String], default: [] },
    materials: { type: [String], default: [] },
    assignments: { type: [{ title: String, description: String, dueDate: Date, attachmentUrl: String }], default: [] },
    instructor: {
      id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      name: { type: String, required: true },
      avatar: { type: String },
      bio: { type: String },
      rating: { type: Number, default: 0 },
    },
    thumbnail: { type: String },
    duration: { type: Number, required: true },
    totalSessions: { type: Number, required: true },
    enrolledStudents: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    reviewsCount: { type: Number, default: 0 },
    isLive: { type: Boolean, default: true },
    startDate: { type: Date },
    endDate: { type: Date },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
  },
  { timestamps: true }
);

const ClassScheduleSchema = new Schema<IClassSchedule>(
  {
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true },
    sessionNumber: { type: Number, required: true },
    title: { type: String, required: true },
    description: { type: String },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    zoomLink: { type: String },
    zoomMeetingId: { type: String },
    zoomPasscode: { type: String },
    zoomStartUrl: { type: String, select: false },
    zoomHostUserId: { type: String },
    meetingCreationStatus: {
      type: String,
      enum: ['pending', 'creating', 'ready', 'failed', 'skipped'],
      default: 'pending',
    },
    status: {
      type: String,
      enum: ['scheduled', 'live', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    recordingUrl: { type: String },
  },
  { timestamps: true }
);

// Atomic double-submit guard: the same (class, session number) can only exist once,
// so a resubmitted "add session" request cannot create a second Zoom meeting for it
// (see the idempotent claim/create/finalize flow in class.routes.ts).
ClassScheduleSchema.index({ classId: 1, sessionNumber: 1 }, { unique: true });

export const ClassModel = mongoose.model<IClass>('Class', ClassSchema);
export const ClassScheduleModel = mongoose.model<IClassSchedule>(
  'ClassSchedule',
  ClassScheduleSchema
);


