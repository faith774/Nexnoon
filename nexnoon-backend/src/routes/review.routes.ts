import { Router } from 'express';
import { z } from 'zod';
import { ReviewModel } from '../models/Review';
import { ClassModel } from '../models/Class';
import { User } from '../models/User';
import { EnrollmentModel } from '../models/Enrollment';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { recomputeClassRating } from '../utils/reviews';

const router = Router();

const createReviewSchema = z.object({
  classId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
});

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
  const review = await ReviewModel.findById(req.params.id);
  if (!review) {
    return res.status(404).json({ success: false, message: 'Review not found' });
  }
  if (String(review.userId) !== req.user!.id) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const { rating, comment } = req.body as { rating?: number; comment?: string };
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


