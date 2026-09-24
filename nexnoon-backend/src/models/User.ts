import mongoose, { Document, Schema, Types } from 'mongoose';

export type UserRole = 'student' | 'instructor' | 'admin';
export type InstructorStatus = 'none' | 'pending' | 'approved' | 'rejected' | 'suspended';

/** PRD §7 lifecycle stages. `instructorStatus` stays the teach/no-teach gate; this tracks where they are. */
export type LifecycleStage =
  | 'applied'
  | 'review'
  | 'interview'
  | 'training'
  | 'certified'
  | 'active'
  | 'improvement'
  | 'suspended'
  | 'removed'
  | 'rejected';

export type CertificationStatus = 'active' | 'suspended' | 'revoked';

/** Teaching permission triple: this instructor × this course × this language offering. */
export interface ICertification {
  _id: Types.ObjectId;
  courseId: Types.ObjectId;
  /** Missing = legacy course-level permission covering every language. */
  languageOfferingId?: Types.ObjectId;
  status: CertificationStatus;
  certifiedAt: Date;
  expiresAt?: Date;
  note?: string;
  certifiedBy?: Types.ObjectId;
}

export interface ILifecycle {
  stage?: LifecycleStage;
  interview?: { scheduledAt?: Date; result?: 'pass' | 'fail'; notes?: string; decidedAt?: Date };
  trainingCompletedAt?: Date;
  improvementPlan?: { notes?: string; startedAt?: Date; dueAt?: Date };
  renewedAt?: Date;
  reviewDueAt?: Date;
  history: { stage: LifecycleStage; action: string; note?: string; at: Date; by?: Types.ObjectId; byName?: string }[];
}

export interface IUser extends Document {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  fullName: string;
  avatar?: string;
  role: UserRole;
  /**
   * Instructor application lifecycle.
   * - none: not an instructor applicant (students/admins)
   * - pending: signed up as instructor, waiting for admin approval
   * - approved: can create/teach classes
   * - rejected: application denied
   * - suspended: previously approved, temporarily blocked from teaching
   */
  instructorStatus: InstructorStatus;
  /** Manual admin quality input (0–100). Used in platform quality score. */
  adminEvaluation: number;
  /** Short teaching headline shown on public profile. */
  headline?: string;
  /** Longer bio for public instructor profile. */
  bio?: string;
  /** Languages the instructor can teach in. */
  languages: string[];
  /** Topic / skill tags. */
  expertise: string[];
  /** Courses this instructor is certified / approved to teach (closed supply). Derived from active `certifications`. */
  approvedCourseIds: Types.ObjectId[];
  certifications: ICertification[];
  lifecycle?: ILifecycle;
  /** Stripe Connect Express account used to pay this instructor out. */
  payout?: {
    stripeAccountId?: string;
    country?: string;
    detailsSubmitted?: boolean;
    payoutsEnabled?: boolean;
    requirementsDue?: string[];
    updatedAt?: Date;
  };
  /** Instructor application: courses the applicant wants to be certified for. */
  requestedCourseIds: Types.ObjectId[];
  /** Instructor application: years of teaching or professional experience. */
  yearsExperience?: number;
  /** Instructor application: where/whom they have taught and how they teach. */
  teachingExperience?: string;
  linkedinUrl?: string;
  /** Portfolio, personal site, GitHub, published work, etc. */
  portfolioUrl?: string;
  /** Short intro or sample-lesson video (YouTube, Loom, Drive…). */
  sampleVideoUrl?: string;
  /** Last time the applicant edited their application details. */
  applicationUpdatedAt?: Date;
  /** Learner preferred delivery language (preference, not geo-locked). */
  preferredLanguage?: string;
  /** IANA timezone for scheduling hints, e.g. Africa/Lagos */
  timezone?: string;
  isEmailVerified: boolean;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  emailVerificationToken?: string;
  /** Zoom user (on the company Zoom account) this instructor's meetings are hosted under. */
  zoomUserId?: string;
  zoomEmail?: string;
  zoomHostEnabled: boolean;
  /** Which optional emails this person wants. In-app notifications and cancellation emails always go out. */
  emailPrefs?: { sessionReminders?: ReminderEmailPref; scheduleUpdates?: boolean };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    fullName: { type: String, required: true },
    avatar: { type: String },
    role: { type: String, enum: ['student', 'instructor', 'admin'], default: 'student' },
    instructorStatus: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected', 'suspended'],
      default: 'none',
    },
    adminEvaluation: { type: Number, default: 70, min: 0, max: 100 },
    headline: { type: String, maxlength: 160 },
    bio: { type: String, maxlength: 4000 },
    languages: { type: [String], default: [] },
    expertise: { type: [String], default: [] },
    approvedCourseIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Course' }], default: [] },
    certifications: {
      type: [
        {
          courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
          languageOfferingId: { type: Schema.Types.ObjectId },
          status: { type: String, enum: ['active', 'suspended', 'revoked'], default: 'active' },
          certifiedAt: { type: Date, default: Date.now },
          expiresAt: { type: Date },
          note: { type: String, maxlength: 1000 },
          certifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        },
      ],
      default: [],
    },
    lifecycle: {
      stage: {
        type: String,
        enum: ['applied', 'review', 'interview', 'training', 'certified', 'active', 'improvement', 'suspended', 'removed', 'rejected'],
      },
      interview: {
        scheduledAt: Date,
        result: { type: String, enum: ['pass', 'fail'] },
        notes: { type: String, maxlength: 3000 },
        decidedAt: Date,
      },
      trainingCompletedAt: Date,
      improvementPlan: { notes: { type: String, maxlength: 3000 }, startedAt: Date, dueAt: Date },
      renewedAt: Date,
      reviewDueAt: Date,
      history: {
        type: [
          {
            stage: String,
            action: String,
            note: { type: String, maxlength: 3000 },
            at: { type: Date, default: Date.now },
            by: { type: Schema.Types.ObjectId, ref: 'User' },
            byName: String,
          },
        ],
        default: [],
      },
    },
    payout: {
      stripeAccountId: { type: String, index: true, sparse: true },
      country: { type: String, maxlength: 2 },
      detailsSubmitted: Boolean,
      payoutsEnabled: Boolean,
      requirementsDue: { type: [String], default: undefined },
      updatedAt: Date,
    },
    requestedCourseIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Course' }], default: [] },
    yearsExperience: { type: Number, min: 0, max: 60 },
    teachingExperience: { type: String, maxlength: 3000 },
    linkedinUrl: { type: String, maxlength: 300 },
    portfolioUrl: { type: String, maxlength: 300 },
    sampleVideoUrl: { type: String, maxlength: 300 },
    applicationUpdatedAt: { type: Date },
    preferredLanguage: { type: String, maxlength: 80 },
    timezone: { type: String, maxlength: 80 },
    isEmailVerified: { type: Boolean, default: false },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    emailVerificationToken: { type: String },
    zoomUserId: { type: String },
    zoomEmail: { type: String },
    zoomHostEnabled: { type: Boolean, default: false },
    emailPrefs: {
      sessionReminders: { type: String, enum: ['all', 'key', 'none'] },
      scheduleUpdates: { type: Boolean },
      _id: false,
    },
  },
  { timestamps: true }
);

/** `key` = the day before, ~10 minutes before, and at start. */
export type ReminderEmailPref = 'all' | 'key' | 'none';

export function emailPrefsOf(user: { emailPrefs?: IUser['emailPrefs'] } | null | undefined) {
  return {
    sessionReminders: (user?.emailPrefs?.sessionReminders || 'all') as ReminderEmailPref,
    scheduleUpdates: user?.emailPrefs?.scheduleUpdates !== false,
  };
}

export const User = mongoose.model<IUser>('User', UserSchema);

/** Instructor application details (visible to the applicant and admins, not the public). */
export function toInstructorApplication(user: IUser | Record<string, any>) {
  return {
    requestedCourseIds: ((user as any).requestedCourseIds || []).map((id: unknown) => String(id)),
    yearsExperience: typeof user.yearsExperience === 'number' ? user.yearsExperience : null,
    teachingExperience: user.teachingExperience || '',
    linkedinUrl: user.linkedinUrl || '',
    portfolioUrl: user.portfolioUrl || '',
    sampleVideoUrl: user.sampleVideoUrl || '',
    applicationUpdatedAt: user.applicationUpdatedAt || null,
  };
}

/** Safe public user payload for auth responses. */
export function toPublicUser(user: IUser) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: user.fullName,
    avatar: user.avatar,
    role: user.role,
    instructorStatus: user.instructorStatus || 'none',
    headline: user.headline || '',
    bio: user.bio || '',
    languages: user.languages || [],
    expertise: user.expertise || [],
    approvedCourseIds: (user.approvedCourseIds || []).map((id) => String(id)),
    ...toInstructorApplication(user),
    preferredLanguage: user.preferredLanguage || '',
    timezone: user.timezone || '',
    emailPrefs: emailPrefsOf(user),
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/** Public instructor card (no email). */
export function toInstructorPublicProfile(user: IUser | Record<string, any>) {
  const id = (user as any).id || String((user as any)._id);
  return {
    id,
    fullName: user.fullName,
    avatar: user.avatar || '',
    headline: user.headline || '',
    bio: user.bio || '',
    languages: user.languages || [],
    expertise: user.expertise || [],
    instructorStatus: user.instructorStatus || 'none',
    role: user.role,
    createdAt: user.createdAt,
  };
}
