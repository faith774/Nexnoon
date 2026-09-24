/**
 * Shapes a (normalized, plain) session for whoever is looking at it.
 *
 * Learners never receive join credentials (Zoom link, meeting id, passcode, external meeting link) in list/detail
 * responses: they get them from the join endpoint, which enforces enrollment and the join window. They do get
 * `hasMeeting` / `meetingProvider` so the UI knows a room exists.
 */
export function sessionForViewer<T extends Record<string, any>>(session: T, canTeach: boolean) {
  const {
    zoomStartUrl: _startUrl,
    zoomHostUserId: _host,
    remindersSent: _reminders,
    zoomLink,
    zoomMeetingId,
    zoomPasscode,
    meetingUrl,
    meetingCreationStatus,
    recordingUrl,
    ...rest
  } = session;
  const meetingProvider: 'external' | 'zoom' | null = meetingUrl ? 'external' : zoomMeetingId ? 'zoom' : null;
  const base = {
    ...rest,
    hasMeeting: meetingProvider !== null,
    hasZoomMeeting: Boolean(zoomMeetingId),
    meetingProvider,
    // Recordings are only meant for people in the class; only completed sessions expose them to learners.
    recordingUrl: canTeach || rest.status === 'completed' ? recordingUrl : undefined,
  };
  if (!canTeach) return base;
  return {
    ...base,
    zoomLink,
    zoomMeetingId,
    zoomPasscode,
    meetingUrl,
    meetingCreationStatus: meetingCreationStatus || (zoomMeetingId ? 'ready' : 'skipped'),
  };
}
