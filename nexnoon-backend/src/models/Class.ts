import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IClassSchedule extends Document {
  classId: Types.ObjectId;
  /** Stable curriculum module id (`details.curriculum[].id`). Optional for legacy/unassigned sessions. */
  moduleId?: string;
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
  /**
   * Instructor-provided meeting link (Google Meet, Teams, a personal Zoom room…). When set it replaces the
   * platform Zoom meeting for this session; learners only receive it through the join endpoint, inside the join window.
   */
  meetingUrl?: string;
  /** When each reminder went out, so the reminder job never sends one twice. */
  remindersSent?: Record<string, Date>;
}

export interface IClass extends Document {
  details?: {
    overview?: string;
    instructorTitle?: string;
    instructorBio?: string;
    instructorImage?: string;
    previewVideoUrl?: string;
    curriculumIntro?: string;
    certificateInfo?: string;
    outcomes?: string[];
    curriculum?: { id?: string; title: string; topics: string[]; project: string }[];
    faqs?: { question: string; answer: string }[];
  };
  title: string;
  description: string;
  category: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  price: number;
  currency: string;
  language?: string;
  /** Canonical course this class delivers (PRD: Course → Language → Class). */
  courseId?: Types.ObjectId;
  /** Language offering subdocument id under the course. */
  languageOfferingId?: Types.ObjectId;
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
  /**
   * Teaching team: class creator is always `lead`.
   * Lead can invite up to 2 support instructors (PRD: 1 lead + up to 2 support).
   */
  teachingTeam: {
    userId: Types.ObjectId;
    name: string;
    email: string;
    role: 'lead' | 'support';
    status: 'pending' | 'accepted' | 'declined' | 'removed';
    invitedAt: Date;
    respondedAt?: Date;
  }[];
  thumbnail?: string;
  duration: number;
  totalSessions: number;
  enrolledStudents: number;
  /** Seats reserved for waitlisted learners holding an open offer. */
  heldSeats?: number;
  rating: number;
  reviewsCount: number;
  isLive: boolean;
  startDate?: Date;
  endDate?: Date;
  /** IANA timezone the class is scheduled in (e.g. "Europe/Madrid"); learners see times converted to theirs. */
  timezone?: string;
  status: 'draft' | 'published' | 'archived';
  /** Set when an admin cancels the class; status becomes `archived`. */
  cancelledAt?: Date;
  cancellationReason?: string;
  /**
   * Free classes need admin sign-off (anti off-platform payment). Absent on paid
   * classes and on free classes created before this rule existed.
   */
  freeApproval?: {
    status: 'pending' | 'approved' | 'rejected';
    requestedAt?: Date;
    /** Status the instructor wanted; restored when approved. */
    requestedStatus?: 'draft' | 'published';
    decidedAt?: Date;
    decidedBy?: Types.ObjectId;
    note?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const DetailsSchema = new Schema({
  overview: String, instructorTitle: String, instructorBio: String, instructorImage: String,
  previewVideoUrl: String, curriculumIntro: String, certificateInfo: String, outcomes: [String],
  curriculum: [{ id: String, title: String, topics: [String], project: String }],
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
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', index: true },
    languageOfferingId: { type: Schema.Types.ObjectId, index: true },
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
    teachingTeam: {
      type: [
        {
          userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
          name: { type: String, required: true },
          email: { type: String, required: true },
          role: { type: String, enum: ['lead', 'support'], required: true },
          status: {
            type: String,
            enum: ['pending', 'accepted', 'declined', 'removed'],
            default: 'accepted',
          },
          invitedAt: { type: Date, default: Date.now },
          respondedAt: { type: Date },
        },
      ],
      default: [],
    },
    thumbnail: { type: String },
    duration: { type: Number, required: true },
    totalSessions: { type: Number, required: true },
    enrolledStudents: { type: Number, default: 0 },
    heldSeats: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    reviewsCount: { type: Number, default: 0 },
    isLive: { type: Boolean, default: true },
    startDate: { type: Date },
    endDate: { type: Date },
    timezone: { type: String },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
    cancelledAt: { type: Date },
    cancellationReason: { type: String, maxlength: 1000 },
    freeApproval: {
      type: {
        status: { type: String, enum: ['pending', 'approved', 'rejected'], required: true },
        requestedAt: Date,
        requestedStatus: { type: String, enum: ['draft', 'published'] },
        decidedAt: Date,
        decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        note: { type: String, maxlength: 1000 },
      },
      _id: false,
    },
  },
  { timestamps: true }
);

const ClassScheduleSchema = new Schema<IClassSchedule>(
  {
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true },
    moduleId: { type: String, index: true },
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
    meetingUrl: { type: String },
    /** Reminder key ("day", "m30", "m5", "start"…) → when it was claimed. */
    remindersSent: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

ClassScheduleSchema.index({ status: 1, startTime: 1 });

// Atomic double-submit guard: the same (class, session number) can only exist once,
// so a resubmitted "add session" request cannot create a second Zoom meeting for it
// (see the idempotent claim/create/finalize flow in class.routes.ts).
ClassScheduleSchema.index({ classId: 1, sessionNumber: 1 }, { unique: true });
ClassScheduleSchema.index({ classId: 1, moduleId: 1 });

export const ClassModel = mongoose.model<IClass>('Class', ClassSchema);
export const ClassScheduleModel = mongoose.model<IClassSchedule>(
  'ClassSchedule',
  ClassScheduleSchema
);


