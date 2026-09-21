import { Router } from 'express';
import { z } from 'zod';
import { ReviewModel } from '../models/Review';
import { ClassModel } from '../models/Class';
import { requireAuth, AuthRequest } from '../middleware/auth';

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

  const review = await ReviewModel.create({
    classId,
    userId: req.user!.id,
    userName: 'Student', // resolve from user profile in production
    rating,
    comment,
  });

  const stats = await ReviewModel.aggregate([
    { $match: { classId: cls._id } },
    {
      $group: {
        _id: '$classId',
        avgRating: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);

  if (stats[0]) {
    cls.rating = stats[0].avgRating;
    cls.reviewsCount = stats[0].count;
    await cls.save();
  }

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

  return res.json({
    success: true,
    data: null,
    message: 'Review deleted',
  });
});

export default router;


