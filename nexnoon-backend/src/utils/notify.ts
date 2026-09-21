import { EnrollmentModel } from '../models/Enrollment';
import { NotificationModel } from '../models/Notification';

/**
 * Fans out a "class started" notification to every actively-enrolled student.
 * Called both from the instructor's manual start endpoint and the Zoom
 * meeting.started webhook - callers are responsible for only invoking this on
 * an actual scheduled -> live transition so students aren't notified twice.
 */
export async function notifyClassSessionStarted(params: {
  classId: string;
  classTitle: string;
  sessionId: string;
  sessionTitle: string;
}): Promise<void> {
  const { classId, classTitle, sessionId, sessionTitle } = params;
  const enrollments = await EnrollmentModel.find({ classId, status: 'active' });
  if (!enrollments.length) return;

  await NotificationModel.insertMany(
    enrollments.map((enrollment) => ({
      userId: enrollment.userId,
      type: 'class' as const,
      title: 'Class started',
      message: `${classTitle} - ${sessionTitle} has started. Join now!`,
      actionUrl: `/classroom/${classId}?sessionId=${sessionId}`,
    }))
  ).catch((error) => console.error('Failed to notify students of class start:', error instanceof Error ? error.message : error));
}
