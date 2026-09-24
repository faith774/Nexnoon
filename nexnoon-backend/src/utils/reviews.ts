import { Types } from 'mongoose';
import { ClassModel } from '../models/Class';
import { ReviewModel } from '../models/Review';

/** Reviews an admin has hidden never count toward public lists or ratings. */
export const PUBLIC_REVIEW_FILTER = { status: { $ne: 'hidden' } };

export async function recomputeClassRating(classId: string | Types.ObjectId) {
  const id = typeof classId === 'string' ? new Types.ObjectId(classId) : classId;
  const [stats] = await ReviewModel.aggregate([
    { $match: { classId: id, ...PUBLIC_REVIEW_FILTER } },
    { $group: { _id: '$classId', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await ClassModel.updateOne(
    { _id: id },
    { $set: { rating: stats ? Number(stats.avgRating.toFixed(2)) : 0, reviewsCount: stats?.count ?? 0 } }
  );
}
