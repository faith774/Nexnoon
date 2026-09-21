import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { User, toPublicUser } from '../models/User';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { sendEmail, buildPasswordResetEmail, buildVerifyEmail } from '../utils/email';
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
  const { firstName, lastName, avatar } = req.body as {
    firstName?: string;
    lastName?: string;
    avatar?: string;
  };
  const user = await User.findById(req.user!.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (firstName || lastName) {
    user.fullName = `${user.firstName} ${user.lastName}`;
  }
  if (avatar) user.avatar = avatar;

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


