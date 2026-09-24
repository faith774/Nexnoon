import { Router } from 'express';
import { isValidTimeZone } from '../utils/time';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { isValidObjectId } from 'mongoose';
import { User, toPublicUser, emailPrefsOf, type ReminderEmailPref } from '../models/User';
import { CourseModel } from '../models/Course';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { sendEmail, buildPasswordResetEmail, buildVerifyEmail, buildWelcomeInstructorPendingEmail, sendEmailSafe } from '../utils/email';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['student', 'instructor']).optional(),
});

router.post('/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }

  const { email, password, firstName, lastName, role } = parsed.data;

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(400).json({
      success: false,
      message: 'Email already registered',
    });
  }

  const hashed = await bcrypt.hash(password, 10);
  const fullName = `${firstName} ${lastName}`;
  const emailVerificationToken = crypto.randomBytes(32).toString('hex');
  const resolvedRole = role || 'student';

  const user = await User.create({
    email,
    password: hashed,
    firstName,
    lastName,
    fullName,
    role: resolvedRole,
    instructorStatus: resolvedRole === 'instructor' ? 'pending' : 'none',
    emailVerificationToken,
  });

  const token = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  let emailSent = false;
  try {
    await sendEmail(user.email, 'Verify your Nexnoon email', buildVerifyEmail(emailVerificationToken));
    emailSent = true;
    if (resolvedRole === 'instructor') {
      await sendEmailSafe(
        user.email,
        'Instructor application received',
        buildWelcomeInstructorPendingEmail(user.fullName)
      );
    }
  } catch (err) {
    console.error('Verification email failed (user still created):', err);
  }

  return res.status(201).json({
    success: true,
    data: {
      user: toPublicUser(user),
      token,
      refreshToken,
      emailSent,
    },
    message: emailSent ? 'Account created successfully' : 'Account created. Verification email could not be sent (check email provider quota).',
  });
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }

  const { email, password } = parsed.data;
  const user = await User.findOne({ email });

  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  if (user.role === 'admin') {
    return res.status(403).json({
      success: false,
      code: 'ADMIN_PORTAL_REQUIRED',
      message: 'Nexnoon admin accounts sign in through the admin portal.',
    });
  }

  const token = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  return res.json({
    success: true,
    data: {
      user: toPublicUser(user),
      token,
      refreshToken,
    },
    message: 'Login successful',
  });
});

const ADMIN_LOGIN_MAX_FAILURES = 5;
const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const adminLoginFailures = new Map<string, { count: number; firstAt: number }>();

function adminLoginKey(ip: string | undefined, email: string) {
  return `${ip || 'unknown'}|${email.toLowerCase()}`;
}

function isAdminLoginLocked(key: string) {
  const entry = adminLoginFailures.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > ADMIN_LOGIN_WINDOW_MS) {
    adminLoginFailures.delete(key);
    return false;
  }
  return entry.count >= ADMIN_LOGIN_MAX_FAILURES;
}

function recordAdminLoginFailure(key: string) {
  const entry = adminLoginFailures.get(key);
  if (!entry || Date.now() - entry.firstAt > ADMIN_LOGIN_WINDOW_MS) {
    adminLoginFailures.set(key, { count: 1, firstAt: Date.now() });
  } else {
    entry.count += 1;
  }
}

/** Admin portal sign-in. Only accepts admin accounts; everyone else gets a generic failure. */
router.post('/admin/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }

  const { email, password } = parsed.data;
  const key = adminLoginKey(req.ip, email);
  if (isAdminLoginLocked(key)) {
    return res.status(429).json({
      success: false,
      message: 'Too many failed attempts. Try again in 15 minutes.',
    });
  }

  const user = await User.findOne({ email });
  const match = user ? await bcrypt.compare(password, user.password) : false;
  if (!user || !match || user.role !== 'admin') {
    recordAdminLoginFailure(key);
    return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
  }

  adminLoginFailures.delete(key);
  const token = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  return res.json({
    success: true,
    data: {
      user: toPublicUser(user),
      token,
      refreshToken,
    },
    message: 'Admin login successful',
  });
});

router.post('/logout', (_req, res) => {
  // Stateless JWT - frontend just drops tokens
  return res.json({ success: true, data: null, message: 'Logged out' });
});

router.post('/refresh', async (req, res) => {
  const refreshToken = req.body.refreshToken as string | undefined;
  if (!refreshToken) {
    return res.status(400).json({ success: false, message: 'Missing refresh token' });
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    const user = await User.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    const newAccessToken = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user);
    return res.json({
      success: true,
      data: {
        user: toPublicUser(user),
        token: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
});

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const user = await User.findById(req.user!.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  return res.json({
    success: true,
    data: toPublicUser(user),
  });
});

router.patch('/profile', requireAuth, async (req: AuthRequest, res) => {
  const body = req.body as {
    firstName?: string;
    lastName?: string;
    avatar?: string;
    headline?: string;
    bio?: string;
    languages?: string[];
    expertise?: string[];
    preferredLanguage?: string;
    timezone?: string;
    emailPrefs?: { sessionReminders?: ReminderEmailPref; scheduleUpdates?: boolean } | null;
    yearsExperience?: number | string | null;
    teachingExperience?: string;
    linkedinUrl?: string;
    portfolioUrl?: string;
    sampleVideoUrl?: string;
    requestedCourseIds?: string[];
  };
  const user = await User.findById(req.user!.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const isInstructor = user.role === 'instructor';
  let applicationTouched = false;

  if (isInstructor && body.yearsExperience !== undefined) {
    if (body.yearsExperience === null || body.yearsExperience === '') {
      user.yearsExperience = undefined;
    } else {
      const v = Number(body.yearsExperience);
      if (!Number.isFinite(v) || v < 0 || v > 60) {
        return res.status(400).json({ success: false, message: 'yearsExperience must be between 0 and 60' });
      }
      user.yearsExperience = Math.round(v);
    }
    applicationTouched = true;
  }
  if (isInstructor && body.teachingExperience !== undefined) {
    const v = String(body.teachingExperience).trim();
    if (v.length > 3000) {
      return res.status(400).json({ success: false, message: 'teachingExperience must be ≤3000 characters' });
    }
    user.teachingExperience = v || undefined;
    applicationTouched = true;
  }
  for (const field of ['linkedinUrl', 'portfolioUrl', 'sampleVideoUrl'] as const) {
    if (!isInstructor || body[field] === undefined) continue;
    const v = String(body[field]).trim();
    if (v && (!/^https?:\/\/\S+\.\S+/i.test(v) || v.length > 300)) {
      return res.status(400).json({ success: false, message: `${field} must be a valid http(s) link` });
    }
    user[field] = v || undefined;
    applicationTouched = true;
  }
  if (isInstructor && body.requestedCourseIds !== undefined) {
    if (!Array.isArray(body.requestedCourseIds)) {
      return res.status(400).json({ success: false, message: 'requestedCourseIds must be an array' });
    }
    const ids = body.requestedCourseIds.map(String).filter((id) => isValidObjectId(id)).slice(0, 10);
    const found = await CourseModel.find({ _id: { $in: ids }, status: 'published' }).select('_id').lean();
    user.requestedCourseIds = found.map((c) => c._id) as any;
    applicationTouched = true;
  }

  if (body.firstName !== undefined) {
    const v = String(body.firstName).trim();
    if (v.length < 1 || v.length > 80) {
      return res.status(400).json({ success: false, message: 'firstName must be 1–80 characters' });
    }
    user.firstName = v;
  }
  if (body.lastName !== undefined) {
    const v = String(body.lastName).trim();
    if (v.length < 1 || v.length > 80) {
      return res.status(400).json({ success: false, message: 'lastName must be 1–80 characters' });
    }
    user.lastName = v;
  }
  if (body.firstName !== undefined || body.lastName !== undefined) {
    user.fullName = `${user.firstName} ${user.lastName}`.trim();
  }
  if (body.avatar !== undefined) {
    const v = String(body.avatar).trim();
    if (v && !/^https?:\/\//i.test(v) && !v.startsWith('data:image/')) {
      return res.status(400).json({ success: false, message: 'avatar must be an image URL or data URI' });
    }
    if (v.length > 2_000_000) {
      return res.status(400).json({ success: false, message: 'avatar is too large' });
    }
    user.avatar = v || undefined;
  }
  if (body.headline !== undefined) {
    const v = String(body.headline).trim();
    if (v.length > 160) {
      return res.status(400).json({ success: false, message: 'headline must be ≤160 characters' });
    }
    user.headline = v;
  }
  if (body.bio !== undefined) {
    const v = String(body.bio).trim();
    if (v.length > 4000) {
      return res.status(400).json({ success: false, message: 'bio must be ≤4000 characters' });
    }
    user.bio = v;
  }
  if (body.languages !== undefined) {
    if (!Array.isArray(body.languages)) {
      return res.status(400).json({ success: false, message: 'languages must be an array' });
    }
    user.languages = body.languages
      .map((l) => String(l).trim())
      .filter(Boolean)
      .slice(0, 12);
  }
  if (body.expertise !== undefined) {
    if (!Array.isArray(body.expertise)) {
      return res.status(400).json({ success: false, message: 'expertise must be an array' });
    }
    user.expertise = body.expertise
      .map((l) => String(l).trim())
      .filter(Boolean)
      .slice(0, 20);
  }
  if (body.preferredLanguage !== undefined) {
    const v = String(body.preferredLanguage).trim().slice(0, 80);
    user.preferredLanguage = v || undefined;
  }
  if (body.timezone !== undefined) {
    const v = String(body.timezone).trim().slice(0, 80);
    if (v && !isValidTimeZone(v)) {
      return res.status(400).json({ success: false, message: 'Unknown time zone' });
    }
    user.timezone = v || undefined;
  }
  if (body.emailPrefs !== undefined) {
    const prefs = body.emailPrefs || {};
    const current = emailPrefsOf(user);
    if (prefs.sessionReminders !== undefined && !['all', 'key', 'none'].includes(prefs.sessionReminders)) {
      return res.status(400).json({ success: false, message: 'Reminder emails must be all, key or none' });
    }
    user.emailPrefs = {
      sessionReminders: prefs.sessionReminders ?? current.sessionReminders,
      scheduleUpdates: prefs.scheduleUpdates === undefined ? current.scheduleUpdates : Boolean(prefs.scheduleUpdates),
    };
  }

  if (
    isInstructor &&
    (applicationTouched ||
      ['avatar', 'headline', 'bio', 'languages', 'expertise'].some((k) => (body as Record<string, unknown>)[k] !== undefined))
  ) {
    user.applicationUpdatedAt = new Date();
  }

  await user.save();

  return res.json({
    success: true,
    data: toPublicUser(user),
    message: 'Profile updated successfully',
  });
});

router.post('/password/reset', async (req, res) => {
  const email = req.body.email as string | undefined;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.json({ success: true, data: null, message: 'If the email exists, a reset link was sent' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = token;
  user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  try {
    await sendEmail(user.email, 'Reset your Nexnoon password', buildPasswordResetEmail(token));
    return res.json({
      success: true,
      data: null,
      message: 'Password reset email sent',
    });
  } catch (err) {
    console.error('Password reset email failed:', err);
    return res.json({
      success: true,
      data: null,
      message: 'If that email exists, we could not send the reset link right now. Try again later or contact support.',
    });
  }
});

router.post('/password/reset/confirm', async (req, res) => {
  const token = req.body.token as string | undefined;
  const newPassword = req.body.newPassword as string | undefined;
  if (!token || !newPassword) {
    return res.status(400).json({ success: false, message: 'Invalid request' });
  }

  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: new Date() },
  });

  if (!user) {
    return res.status(400).json({ success: false, message: 'Token is invalid or expired' });
  }

  user.password = await bcrypt.hash(newPassword, 10);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  return res.json({
    success: true,
    data: null,
    message: 'Password reset successfully',
  });
});

/** Logged-in users change password with their current password (not email reset). */
router.post('/password/change', requireAuth, async (req: AuthRequest, res) => {
  const currentPassword = req.body.currentPassword as string | undefined;
  const newPassword = req.body.newPassword as string | undefined;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Current password and new password are required',
    });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 6 characters',
    });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({
      success: false,
      message: 'New password must be different from your current password',
    });
  }

  const user = await User.findById(req.user!.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const match = await bcrypt.compare(currentPassword, user.password);
  if (!match) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect' });
  }

  user.password = await bcrypt.hash(newPassword, 10);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  return res.json({
    success: true,
    data: null,
    message: 'Password changed successfully',
  });
});

router.post('/verify-email', async (req, res) => {
  const token = req.body.token as string | undefined;
  if (!token) {
    return res.status(400).json({ success: false, message: 'Token is required' });
  }

  const user = await User.findOne({ emailVerificationToken: token });
  if (!user) {
    return res.status(400).json({ success: false, message: 'Invalid token' });
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  await user.save();

  return res.json({
    success: true,
    data: null,
    message: 'Email verified successfully',
  });
});

router.post('/verify-email/resend', requireAuth, async (req: AuthRequest, res) => {
  const user = await User.findById(req.user!.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  if (user.isEmailVerified) {
    return res.status(400).json({ success: false, message: 'Email already verified' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  user.emailVerificationToken = token;
  await user.save();

  try {
    await sendEmail(user.email, 'Verify your Nexnoon email', buildVerifyEmail(token));
    return res.json({
      success: true,
      data: null,
      message: 'Verification email sent',
    });
  } catch (err) {
    console.error('Resend verification email failed:', err);
    return res.status(503).json({
      success: false,
      message: 'Verification email could not be sent right now. Try again later or contact support.',
    });
  }
});

export default router;


