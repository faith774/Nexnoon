import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { ReviewModel } from '../models/Review';
import { ClassModel } from '../models/Class';
import { User } from '../models/User';
import { EnrollmentModel } from '../models/Enrollment';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { recomputeClassRating } from '../utils/reviews';
import { classTimeline } from '../utils/seats';

const router = Router();

const createReviewSchema = z.object({
  classId: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});

const updateReviewSchema = z
  .object({
    rating: z.number().int().min(1).max(5).optional(),
    comment: z.string().trim().max(2000).optional(),
  })
  .refine((v) => v.rating !== undefined || v.comment !== undefined, 'Nothing to update');

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  const parsed = createReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }

  const { classId, rating, comment } = parsed.data;
  if (!isValidObjectId(classId)) return res.status(400).json({ success: false, message: 'Invalid class ID' });

  const cls = await ClassModel.findById(classId);
  if (!cls) {
    return res.status(404).json({ success: false, message: 'Class not found' });
  }

  const enrolled = await EnrollmentModel.findOne({
    classId,
    userId: req.user!.id,
    status: { $in: ['active', 'completed'] },
  });
  if (!enrolled) {
    return res.status(403).json({ success: false, message: 'Only enrolled learners can leave a review' });
  }
  if (enrolled.status !== 'completed' && !(await classTimeline(cls)).ended) {
    return res.status(409).json({ success: false, message: 'You can review this class once it has finished.' });
  }

  const existing = await ReviewModel.findOne({ classId, userId: req.user!.id });
  if (existing) {
    return res.status(409).json({ success: false, message: 'You already reviewed this class' });
  }

  const user = await User.findById(req.user!.id).select('fullName avatar').lean();

  const review = await ReviewModel.create({
    classId,
    userId: req.user!.id,
    userName: user?.fullName || 'Learner',
    userAvatar: user?.avatar,
    rating,
    comment,
  });

  await recomputeClassRating(cls._id);

  return res.status(201).json({
    success: true,
    data: review,
    message: 'Review created',
  });
});

router.patch('/:id', requireAuth, async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid review ID' });
  const review = await ReviewModel.findById(req.params.id);
  if (!review) {
    return res.status(404).json({ success: false, message: 'Review not found' });
  }
  if (String(review.userId) !== req.user!.id) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const parsed = updateReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid review' });
  }
  const { rating, comment } = parsed.data;
  if (rating !== undefined) review.rating = rating;
  if (comment !== undefined) review.comment = comment;
  await review.save();
  await recomputeClassRating(review.classId);

  return res.json({
    success: true,
    data: review,
    message: 'Review updated',
  });
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid review ID' });
  const review = await ReviewModel.findById(req.params.id);
  if (!review) {
    return res.status(404).json({ success: false, message: 'Review not found' });
  }
  if (String(review.userId) !== req.user!.id) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  await review.deleteOne();
  await recomputeClassRating(review.classId);

  return res.json({
    success: true,
    data: null,
    message: 'Review deleted',
  });
});

export default router;


