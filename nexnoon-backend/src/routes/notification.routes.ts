import { Router } from 'express';
import { NotificationModel } from '../models/Notification';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Math.min(Number(req.query.pageSize || 50), 100);
  const unreadOnly = req.query.unread === 'true';

  const query: { userId: string; read?: boolean } = { userId: req.user!.id };
  if (unreadOnly) query.read = false;

  const [items, totalItems] = await Promise.all([
    NotificationModel.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    NotificationModel.countDocuments(query),
  ]);

  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  const data = items.map((doc: any) => ({
    id: doc._id.toString(),
    userId: doc.userId?.toString(),
    type: doc.type,
    title: doc.title,
    message: doc.message,
    read: doc.read,
    actionUrl: doc.actionUrl,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }));

  return res.json({
    success: true,
    data: {
      data,
      pagination: {
        page,
        pageSize,
        totalPages,
        totalItems,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    },
  });
});

router.patch('/read-all', requireAuth, async (req: AuthRequest, res) => {
  const result = await NotificationModel.updateMany(
    { userId: req.user!.id, read: false },
    { $set: { read: true } }
  );
  return res.json({
    success: true,
    data: { updatedCount: result.modifiedCount },
    message: 'All marked as read',
  });
});

router.patch('/:id/read', requireAuth, async (req: AuthRequest, res) => {
  const doc = await NotificationModel.findById(req.params.id);
  if (!doc) {
    return res.status(404).json({ success: false, message: 'Notification not found' });
  }
  if (String(doc.userId) !== req.user!.id) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  doc.read = true;
  await doc.save();

  return res.json({
    success: true,
    data: {
      id: doc._id.toString(),
      userId: doc.userId?.toString(),
      type: doc.type,
      title: doc.title,
      message: doc.message,
      read: doc.read,
      actionUrl: doc.actionUrl,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    },
    message: 'Marked as read',
  });
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  const doc = await NotificationModel.findById(req.params.id);
  if (!doc) {
    return res.status(404).json({ success: false, message: 'Notification not found' });
  }
  if (String(doc.userId) !== req.user!.id) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  await NotificationModel.findByIdAndDelete(req.params.id);
  return res.json({
    success: true,
    data: null,
    message: 'Notification deleted',
  });
});

export default router;
