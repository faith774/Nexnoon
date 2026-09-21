import mongoose, { Document, Schema } from 'mongoose';

export type UserRole = 'student' | 'instructor' | 'admin';
export type InstructorStatus = 'none' | 'pending' | 'approved' | 'rejected';

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
   */
  instructorStatus: InstructorStatus;
  isEmailVerified: boolean;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  emailVerificationToken?: string;
  /** Zoom user (on the company Zoom account) this instructor's meetings are hosted under. */
  zoomUserId?: string;
  zoomEmail?: string;
  zoomHostEnabled: boolean;
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
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none',
    },
    isEmailVerified: { type: Boolean, default: false },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    emailVerificationToken: { type: String },
    zoomUserId: { type: String },
    zoomEmail: { type: String },
    zoomHostEnabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);

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
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
