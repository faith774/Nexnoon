import { Router, Request } from 'express';
import { ClassModel, ClassScheduleModel } from '../models/Class';
import { ZoomWebhookEventModel } from '../models/ZoomWebhookEvent';
import { AttendanceRecordModel } from '../models/AttendanceRecord';
import { EnrollmentModel } from '../models/Enrollment';
import { User } from '../models/User';
import { verifyZoomWebhookSignature, hashZoomWebhookValidationToken } from '../utils/zoom';
import { notifyClassSessionStarted } from '../utils/notify';
import { rateLimit } from '../middleware/rateLimit';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

const router = Router();

// Zoom sends every webhook delivery (across every meeting/class on the account,
// including retries and the periodic endpoint.url_validation re-check) from a
// small set of shared Zoom infrastructure IPs, and this middleware keys by IP
// when there's no authenticated user - so the ceiling must stay high enough that
// normal multi-class traffic and Zoom's own retries are never mistaken for abuse.
// This only guards against gross flooding, not normal volume.
router.use(rateLimit({ windowMs: 60_000, max: 300, keyPrefix: 'zoom-webhook' }));

router.post('/', async (req: RawBodyRequest, res) => {
  const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
  const signatureHeader = req.headers['x-zm-signature'] as string | undefined;
  const timestampHeader = req.headers['x-zm-request-timestamp'] as string | undefined;

  const event = req.body?.event as string | undefined;

  // Zoom's one-time endpoint-URL validation handshake does not carry a signature.
  if (event === 'endpoint.url_validation') {
    const plainToken = req.body?.payload?.plainToken;
    if (typeof plainToken !== 'string' || !plainToken) {
      return res.status(400).json({ success: false, message: 'Missing plainToken' });
    }
    return res.status(200).json({
      plainToken,
      encryptedToken: hashZoomWebhookValidationToken(plainToken),
    });
  }

  const validSignature = verifyZoomWebhookSignature({ rawBody, signatureHeader, timestampHeader });
  if (!validSignature) {
    return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
  }

  if (!event) {
    return res.status(400).json({ success: false, message: 'Malformed webhook payload' });
  }

  const trackingId = req.headers['x-zm-trackingid'] as string | undefined;
  const objectRef = req.body?.payload?.object?.uuid || req.body?.payload?.object?.id || '';
  const eventId = trackingId || `${event}:${req.body?.event_ts ?? ''}:${objectRef}`;

  // Idempotent processing: a duplicate delivery of an already-processed event is a
  // safe no-op 200, so Zoom stops retrying it instead of us reapplying the effect.
  try {
    await ZoomWebhookEventModel.create({ eventId, eventType: event });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(200).json({ success: true, data: null, message: 'Already processed' });
    }
    throw error;
  }

  const meetingId = req.body?.payload?.object?.id != null ? String(req.body.payload.object.id) : undefined;

  try {
    switch (event) {
      case 'meeting.started': {
        if (!meetingId) break;
        // Only a genuine scheduled -> live transition should notify students -
        // an instructor who already used the manual "Start Class as Host" flow
        // (class.routes.ts's /start endpoint) has already flipped this to 'live'
        // and notified them, so this webhook delivery is just Zoom confirming
        // what already happened and must not re-notify.
        const session = await ClassScheduleModel.findOneAndUpdate(
          { zoomMeetingId: meetingId, status: 'scheduled' },
          { $set: { status: 'live' } }
        );
        if (session) {
          const cls = await ClassModel.findById(session.classId);
          if (cls) {
            await notifyClassSessionStarted({
              classId: String(session.classId),
              classTitle: cls.title,
              sessionId: session.id,
              sessionTitle: session.title,
            });
          }
        }
        break;
      }
      case 'meeting.ended': {
        if (!meetingId) break;
        // Goes straight to 'completed' - there's no separate finalization step in
        // this MVP, so the moment Zoom reports the meeting stopped, the session is
        // done for the instructor and every student alike.
        await ClassScheduleModel.updateOne(
          { zoomMeetingId: meetingId, status: { $in: ['scheduled', 'live'] } },
          { $set: { status: 'completed' } }
        );
        break;
      }
      case 'meeting.participant_joined':
      case 'meeting.participant_left': {
        if (!meetingId) break;
        const participantEmail = req.body?.payload?.object?.participant?.email as string | undefined;
        // Only correlate when Zoom gives us a verified participant email that matches
        // an authenticated Nexnoon user with an active enrollment in this session's
        // class. Anything else is left unmatched rather than guessed.
        if (!participantEmail) break;
        const session = await ClassScheduleModel.findOne({ zoomMeetingId: meetingId });
        if (!session) break;

        const user = await User.findOne({ email: participantEmail.toLowerCase() });
        if (!user) break;
        const enrollment = await EnrollmentModel.findOne({ classId: session.classId, userId: user.id });
        if (!enrollment) break;

        const record = await AttendanceRecordModel.findOne({ sessionId: session.id, userId: user.id });
        if (!record) break; // no authorized-join row yet - don't fabricate attendance

        const eventTimestamp = req.body?.payload?.object?.participant?.join_time
          || req.body?.payload?.object?.participant?.leave_time
          || new Date().toISOString();

        if (event === 'meeting.participant_joined' && !record.zoomJoinedAt) {
          record.zoomJoinedAt = new Date(eventTimestamp);
        } else if (event === 'meeting.participant_left') {
          record.zoomLeftAt = new Date(eventTimestamp);
          if (record.zoomJoinedAt) {
            record.durationSeconds = Math.max(
              0,
              Math.round((record.zoomLeftAt.getTime() - record.zoomJoinedAt.getTime()) / 1000)
            );
          }
        }
        await record.save();
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error(`Zoom webhook handling failed for event type ${event}:`, error instanceof Error ? error.message : error);
  }

  return res.status(200).json({ success: true, data: null });
});

export default router;
