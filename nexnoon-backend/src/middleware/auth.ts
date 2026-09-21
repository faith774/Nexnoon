import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JwtPayload } from '../utils/jwt';
import { User, UserRole } from '../models/User';

export interface AuthRequest extends Request {
  user?: { id: string; role: UserRole };
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const token = header.split(' ')[1];

  try {
    const payload = verifyAccessToken(token) as JwtPayload;
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

export const requireRole = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    next();
  };
};

/** Instructors must be admin-approved before creating or teaching classes. Admins always pass. */
export const requireApprovedInstructor = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  if (req.user.role === 'admin') return next();
  if (req.user.role !== 'instructor') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const user = await User.findById(req.user.id).select('instructorStatus');
  if (!user) {
    return res.status(401).json({ success: false, message: 'Account not found' });
  }
  if (user.instructorStatus !== 'approved') {
    return res.status(403).json({
      success: false,
      message:
        user.instructorStatus === 'pending'
          ? 'Your instructor application is still under review'
          : 'Your instructor application was not approved',
      data: { instructorStatus: user.instructorStatus || 'none' },
    });
  }
  return next();
};
