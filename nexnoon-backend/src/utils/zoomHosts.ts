import { ClassModel, ClassScheduleModel } from '../models/Class';
import { User } from '../models/User';
import { createZoomMeeting, deleteZoomMeeting } from './zoom';

/**
 * Which Zoom user hosts an instructor's meetings: their own mapped account, or the shared
 * platform user ("me") for instructors without a mapping. `zoomHostUserId` is what
 * conflict detection groups by, so it's always populated.
 */
export async function resolveInstructorZoomHost(instructorId: string): Promise<{ hostIdentifier?: string; zoomHostUserId: string }> {
  const instructor = await User.findById(instructorId);
  if (instructor?.zoomHostEnabled && (instructor.zoomUserId || instructor.zoomEmail)) {
    const identifier = instructor.zoomUserId || instructor.zoomEmail!;
    return { hostIdentifier: identifier, zoomHostUserId: identifier };
  }
  // Documented fallback for pre-existing data: the shared platform Zoom user.
  return { hostIdentifier: undefined, zoomHostUserId: 'shared:me' };
}

export type RehostResult = { moved: number; failed: number; skipped: number };

/**
 * Moves the Zoom meetings of a class's upcoming, not-yet-started sessions to the lead
 * instructor's current Zoom host. Zoom can't reassign a meeting's owner, so each one is
 * recreated under the new host and the old meeting deleted. Learners never hold the old
 * link (they get join details on demand), so nothing breaks for them. Live sessions and
 * sessions using the instructor's own meeting link are left alone. If creating the new
 * meeting fails, the old one is kept so the session still works.
 */
export async function rehostClassMeetings(classId: string): Promise<RehostResult> {
  const result: RehostResult = { moved: 0, failed: 0, skipped: 0 };
  const cls = await ClassModel.findById(classId).select('title timezone instructor').lean();
  if (!cls) return result;
  const { hostIdentifier, zoomHostUserId } = await resolveInstructorZoomHost(String(cls.instructor.id));

  const sessions = await ClassScheduleModel.find({
    classId: cls._id,
    status: 'scheduled',
    startTime: { $gt: new Date() },
    zoomMeetingId: { $exists: true, $nin: [null, ''] },
    $or: [{ meetingUrl: { $exists: false } }, { meetingUrl: null }, { meetingUrl: '' }],
  });

  for (const session of sessions) {
    if ((session.zoomHostUserId || 'shared:me') === zoomHostUserId) {
      result.skipped++;
      continue;
    }
    try {
      const zoom = await createZoomMeeting({
        topic: `${cls.title} - ${session.title}`,
        startTime: new Date(session.startTime).toISOString(),
        durationMinutes: (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60000,
        hostIdentifier,
        timezone: cls.timezone || undefined,
      });
      if (!zoom.id) {
        result.failed++;
        continue;
      }
      const oldMeetingId = session.zoomMeetingId;
      session.zoomLink = zoom.join_url || undefined;
      session.zoomMeetingId = String(zoom.id);
      session.zoomPasscode = zoom.password;
      session.zoomHostUserId = zoomHostUserId;
      session.meetingCreationStatus = 'ready';
      await session.save();
      await deleteZoomMeeting(oldMeetingId);
      result.moved++;
    } catch (error) {
      result.failed++;
      console.error('Failed to move Zoom meeting to the new host:', error instanceof Error ? error.message : error);
    }
  }
  return result;
}

/** Rehosts every class an instructor leads (after their Zoom host mapping changes). */
export async function rehostInstructorMeetings(instructorId: string): Promise<RehostResult> {
  const classes = await ClassModel.find({ 'instructor.id': instructorId, cancelledAt: { $exists: false } }).select('_id').lean();
  const total: RehostResult = { moved: 0, failed: 0, skipped: 0 };
  for (const c of classes) {
    const r = await rehostClassMeetings(String(c._id));
    total.moved += r.moved;
    total.failed += r.failed;
    total.skipped += r.skipped;
  }
  return total;
}
