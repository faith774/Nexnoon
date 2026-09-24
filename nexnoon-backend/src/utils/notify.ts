import { EnrollmentModel } from '../models/Enrollment';
import { NotificationModel } from '../models/Notification';
import { User, emailPrefsOf } from '../models/User';
import {
  buildClassUpdateEmail,
  buildSessionScheduledEmail,
  sendEmailSafe,
} from './email';
import { formatWhen, pickTimeZone } from './time';

/**
 * Fans out a "class started" notification to every actively-enrolled student.
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
  ).catch((error) =>
    console.error(
      'Failed to notify students of class start:',
      error instanceof Error ? error.message : error
    )
  );
}

async function learnerContacts(classId: string) {
  const enrollments = await EnrollmentModel.find({ classId, status: 'active' })
    .populate('userId', 'fullName email timezone emailPrefs')
    .lean();
  return enrollments
    .map((e: any) => ({
      userId: String(e.userId?._id || e.userId || ''),
      name: e.userId?.fullName || 'Learner',
      email: e.userId?.email as string | undefined,
      timezone: e.userId?.timezone as string | undefined,
      scheduleUpdates: emailPrefsOf(e.userId).scheduleUpdates,
    }))
    .filter((c) => c.userId);
}

/** In-app + email when a session is added or rescheduled. Times are written in each learner's own zone. */
export async function notifyLearnersSessionChange(params: {
  classId: string;
  classTitle: string;
  sessionId: string;
  sessionTitle: string;
  startTime: Date | string;
  classTimeZone?: string | null;
  isUpdate?: boolean;
}): Promise<void> {
  const learners = await learnerContacts(params.classId);
  if (!learners.length) return;

  const whenFor = (l: { timezone?: string }) => formatWhen(params.startTime, pickTimeZone(l.timezone, params.classTimeZone));
  const title = params.isUpdate ? 'Session rescheduled' : 'New session added';
  const messageFor = (when: string) =>
    params.isUpdate
      ? `${params.sessionTitle} in ${params.classTitle} was moved to ${when}.`
      : `${params.sessionTitle} was added to ${params.classTitle} — ${when}.`;

  await NotificationModel.insertMany(
    learners.map((l) => ({
      userId: l.userId,
      type: 'class' as const,
      title,
      message: messageFor(whenFor(l)),
      actionUrl: `/classroom/${params.classId}?sessionId=${params.sessionId}`,
    }))
  ).catch((error) =>
    console.error(
      'Failed to notify learners of session change:',
      error instanceof Error ? error.message : error
    )
  );

  await Promise.all(
    learners
      .filter((l) => l.email && l.scheduleUpdates)
      .map((l) =>
        sendEmailSafe(
          l.email!,
          `${title}: ${params.classTitle}`,
          buildSessionScheduledEmail({
            learnerName: l.name,
            classTitle: params.classTitle,
            sessionTitle: params.sessionTitle,
            when: whenFor(l),
            classId: params.classId,
            sessionId: params.sessionId,
            isUpdate: params.isUpdate,
          })
        )
      )
  );
}

/**
 * In-app + email fan-out to every actively-enrolled learner for class-level changes
 * (class cancelled, session cancelled, instructor changed).
 */
export async function notifyLearnersClassUpdate(params: {
  classId: string;
  classTitle: string;
  title: string;
  message: string;
  actionUrl?: string;
  email?: boolean;
}): Promise<number> {
  const learners = await learnerContacts(params.classId);
  if (!learners.length) return 0;
  const actionUrl = params.actionUrl ?? `/classroom/${params.classId}`;

  await NotificationModel.insertMany(
    learners.map((l) => ({
      userId: l.userId,
      type: 'class' as const,
      title: params.title,
      message: params.message,
      actionUrl,
    }))
  ).catch((error) =>
    console.error('Failed to notify learners of class update:', error instanceof Error ? error.message : error)
  );

  if (params.email !== false) {
    await Promise.all(
      learners
        .filter((l) => l.email)
        .map((l) =>
          sendEmailSafe(
            l.email!,
            `${params.title}: ${params.classTitle}`,
            buildClassUpdateEmail({
              learnerName: l.name,
              heading: params.title,
              body: params.message,
              actionUrl,
            })
          )
        )
    );
  }
  return learners.length;
}

export async function notifyUserInApp(params: {
  userId: string;
  title: string;
  message: string;
  type?: 'class' | 'system' | 'payment';
  actionUrl?: string;
}) {
  await NotificationModel.create({
    userId: params.userId,
    type: params.type || 'system',
    title: params.title,
    message: params.message,
    read: false,
    actionUrl: params.actionUrl,
  }).catch(() => {});
}

export async function getUserEmail(userId: string) {
  const user = await User.findById(userId).select('fullName email').lean();
  return user
    ? { email: user.email, name: user.fullName }
    : null;
}
