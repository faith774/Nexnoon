import axios from 'axios';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';

const REQUEST_TIMEOUT_MS = 8000;

interface CreateZoomMeetingInput {
  topic: string;
  startTime: string;
  durationMinutes: number;
  /**
   * Zoom user ID or email to host this meeting under (an instructor's mapped Zoom
   * user). Falls back to the Server-to-Server OAuth app's own user ("me") when not
   * provided, preserving pre-existing sessions created before per-instructor mapping.
   */
  hostIdentifier?: string;
  /** IANA zone Zoom shows the meeting in (invites, meeting list). The start instant itself is UTC. */
  timezone?: string;
}

/** Zoom rejects fractional or out-of-range durations. */
const zoomDuration = (minutes: number) => Math.min(24 * 60, Math.max(15, Math.round(minutes || 60)));

export interface ZoomMeeting {
  join_url: string;
  id: string | number;
  password?: string;
  start_url?: string;
  host_id?: string;
}

/**
 * Fetches a Server-to-Server OAuth access token for the platform's shared Zoom
 * account. Returns null when Zoom is not configured (demo mode).
 */
export const getZoomAccessToken = async (): Promise<string | null> => {
  const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } = ENV;

  if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
    return null;
  }

  // Reject placeholder values from .env.example so "configured" checks stay honest.
  if (
    ZOOM_ACCOUNT_ID.startsWith('your_') ||
    ZOOM_CLIENT_ID.startsWith('your_') ||
    ZOOM_CLIENT_SECRET.startsWith('your_')
  ) {
    return null;
  }

  const tokenResponse = await axios.post(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}`,
    undefined,
    {
      auth: {
        username: ZOOM_CLIENT_ID,
        password: ZOOM_CLIENT_SECRET,
      },
      timeout: REQUEST_TIMEOUT_MS,
    }
  );

  return tokenResponse.data.access_token as string;
};

/** Safe status flags for admin / instructor diagnostics (no secrets). */
export function getZoomIntegrationStatus() {
  const meetings =
    Boolean(ENV.ZOOM_ACCOUNT_ID && ENV.ZOOM_CLIENT_ID && ENV.ZOOM_CLIENT_SECRET) &&
    !ENV.ZOOM_ACCOUNT_ID.startsWith('your_') &&
    !ENV.ZOOM_CLIENT_ID.startsWith('your_') &&
    !ENV.ZOOM_CLIENT_SECRET.startsWith('your_');

  const meetingSdk =
    Boolean(ENV.ZOOM_MEETING_SDK_CLIENT_ID && ENV.ZOOM_MEETING_SDK_CLIENT_SECRET) &&
    !ENV.ZOOM_MEETING_SDK_CLIENT_ID.startsWith('your_') &&
    !ENV.ZOOM_MEETING_SDK_CLIENT_SECRET.startsWith('your_');

  const webhooks = Boolean(ENV.ZOOM_WEBHOOK_SECRET_TOKEN);

  return {
    meetings: {
      configured: meetings,
      purpose: 'Create/update Zoom meetings and host start links',
    },
    policy: {
      joinEarlyMinutes: ENV.LIVE_CLASS_JOIN_EARLY_MINUTES,
      lateJoinGraceMinutes: ENV.LIVE_CLASS_LATE_JOIN_GRACE_MINUTES,
      hostEarlyMinutes: ENV.LIVE_CLASS_HOST_EARLY_MINUTES,
      waitingRoom: ENV.ZOOM_WAITING_ROOM,
      autoRecording: ENV.ZOOM_AUTO_RECORDING,
    },
    meetingSdk: {
      configured: meetingSdk,
      purpose: 'Sign in-browser learner join tokens',
    },
    webhooks: {
      configured: webhooks,
      purpose: 'Auto mark sessions live/completed from Zoom events',
      endpointPath: '/v1/zoom/webhook',
    },
    readyForTutors: meetings,
    readyForLearners: meetings && meetingSdk,
  };
}

/**
 * Lightweight Zoom integration.
 * If Zoom env vars are missing, this returns empty meeting details so the rest
 * of the app can still function in development/demo mode.
 *
 * Meeting settings only use fields documented in the Zoom Meetings API "Create a
 * meeting" reference: waiting_room, join_before_host, mute_upon_entry,
 * participant_video, host_video, approval_type. Restricting participant screen
 * share is not a meeting-create field in that API - it's an account/group-level
 * "who can share screen" policy or an in-meeting host control - so it is not set
 * here; hosts control it live via Zoom's native controls.
 */
export const createZoomMeeting = async (
  input: CreateZoomMeetingInput
): Promise<ZoomMeeting> => {
  const accessToken = await getZoomAccessToken();

  if (!accessToken) {
    // No fabricated meeting details when Zoom is not configured.
    return {
      join_url: '',
      id: '',
      password: '',
    };
  }

  const hostPathSegment = input.hostIdentifier ? encodeURIComponent(input.hostIdentifier) : 'me';

  const meetingResponse = await axios.post<ZoomMeeting>(
    `https://api.zoom.us/v2/users/${hostPathSegment}/meetings`,
    {
      topic: input.topic,
      type: 2, // scheduled
      start_time: input.startTime,
      duration: zoomDuration(input.durationMinutes),
      ...(input.timezone ? { timezone: input.timezone } : {}),
      settings: {
        waiting_room: ENV.ZOOM_WAITING_ROOM,
        join_before_host: false,
        mute_upon_entry: true,
        participant_video: false,
        host_video: true,
        approval_type: 0,
        auto_recording: ENV.ZOOM_AUTO_RECORDING,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: REQUEST_TIMEOUT_MS,
    }
  );

  return meetingResponse.data;
};

/**
 * Updates a previously-created meeting's scheduled time on Zoom's side (e.g. when
 * an instructor reschedules a session), so Zoom's own record (calendar invite,
 * meeting list) matches. A no-op in demo mode. Does not affect our own join-window
 * check, which reads the session's stored start/end time directly.
 */
export const updateZoomMeeting = async (
  meetingId: string,
  input: { startTime: string; durationMinutes: number; timezone?: string; topic?: string }
): Promise<void> => {
  const accessToken = await getZoomAccessToken();
  if (!accessToken) return;

  await axios.patch(
    `https://api.zoom.us/v2/meetings/${meetingId}`,
    {
      start_time: input.startTime,
      duration: zoomDuration(input.durationMinutes),
      ...(input.timezone ? { timezone: input.timezone } : {}),
      ...(input.topic ? { topic: input.topic } : {}),
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: REQUEST_TIMEOUT_MS,
    }
  );
};

/**
 * Looks up a user in the platform Zoom account, so admins can only map instructors to real, licensed hosts.
 * Returns `undefined` when Zoom isn't configured (nothing to check against) and `null` when the user doesn't exist.
 */
export const lookupZoomUser = async (
  emailOrId: string
): Promise<{ id: string; email: string; licensed: boolean } | null | undefined> => {
  const accessToken = await getZoomAccessToken().catch(() => null);
  if (!accessToken) return undefined;
  try {
    const { data } = await axios.get<{ id: string; email: string; type: number }>(
      `https://api.zoom.us/v2/users/${encodeURIComponent(emailOrId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, timeout: REQUEST_TIMEOUT_MS }
    );
    return { id: data.id, email: data.email, licensed: data.type !== 1 };
  } catch (error) {
    if (axios.isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 400)) return null;
    throw error;
  }
};

/**
 * Deletes a meeting on Zoom when its session is deleted or cancelled, so hosts' Zoom calendars stay clean.
 * Never throws: a meeting that is already gone (404) counts as success; other failures return false.
 */
export const deleteZoomMeeting = async (meetingId: string | undefined | null): Promise<boolean> => {
  if (!meetingId) return true;
  try {
    const accessToken = await getZoomAccessToken();
    if (!accessToken) return true;
    await axios.delete(`https://api.zoom.us/v2/meetings/${meetingId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { schedule_for_reminder: false },
      timeout: REQUEST_TIMEOUT_MS,
    });
    return true;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return true;
    console.error(`Zoom meeting ${meetingId} could not be deleted:`, error instanceof Error ? error.message : 'unknown error');
    return false;
  }
};

/**
 * Fetches a FRESH start_url for an existing meeting via Zoom's official
 * Retrieve-a-Meeting endpoint (GET /meetings/{meetingId}). This is the safest
 * (and only) supported Zoom API flow for this Server-to-Server OAuth integration
 * to obtain current host authorization - there is no separate ZAK/OBF token
 * lookup here, and none should be added, per Zoom's own guidance.
 *
 * Per Zoom's documented behavior, a start_url embeds a host-authorization token
 * (functionally the same sensitive credential class as a ZAK) that expires
 * roughly 2 hours after the *meeting was created* - not from its scheduled start
 * time - so a value captured at creation time cannot be trusted hours or days
 * later. Each call to this endpoint returns a newly-valid start_url, which is why
 * the host-access route calls this on every request instead of ever reading a
 * previously stored value.
 *
 * Never logs the response body or the URL itself. Returns null in demo mode or on
 * any Zoom API failure so callers can fail safely (a generic 503, never the raw
 * Zoom error) - callers should log only `error` here, never the return value.
 */
export const getZoomMeetingStartUrl = async (meetingId: string): Promise<string | null> => {
  // The access-token fetch is inside this same try/catch (not called before it) -
  // any failure here is a Zoom API failure like any other and must be swallowed
  // into a safe `null`, not left to propagate to the global error handler, which
  // logs the raw error object (an AxiosError's `.config`/`.response` can carry the
  // OAuth Basic-auth request header and Zoom's raw response body).
  try {
    const accessToken = await getZoomAccessToken();
    if (!accessToken) return null;

    const response = await axios.get<{ start_url?: string }>(
      `https://api.zoom.us/v2/meetings/${meetingId}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, timeout: REQUEST_TIMEOUT_MS }
    );
    return response.data.start_url || null;
  } catch (error) {
    // Safe operational log only - never the Zoom response body (which could
    // itself echo back sensitive request/response details).
    console.error(
      `Zoom API call failed while refreshing host start_url for meeting ${meetingId}:`,
      error instanceof Error ? error.message : 'unknown error'
    );
    return null;
  }
};

export interface ZoomMeetingSDKSignatureInput {
  meetingNumber: string | number;
  /**
   * Participant role only (0). Embedded host role (1) / ZAK-based host joining is
   * intentionally not supported - instructors host through Zoom's native start-URL
   * experience (see the host-access route), not the Meeting SDK.
   */
  role?: 0;
}

export const generateZoomMeetingSDKSignature = (
  input: ZoomMeetingSDKSignatureInput
): string => {
  const { ZOOM_MEETING_SDK_CLIENT_ID, ZOOM_MEETING_SDK_CLIENT_SECRET } = ENV;

  if (!ZOOM_MEETING_SDK_CLIENT_ID || !ZOOM_MEETING_SDK_CLIENT_SECRET) {
    throw new Error('Zoom Meeting SDK credentials not configured');
  }

  // Back-date iat slightly so small clock skew with Zoom doesn't reject a fresh token.
  const timestamp = Math.floor(Date.now() / 1000) - 30;
  const expirationTime = timestamp + 2 * 60 * 60;

  const payload = {
    appKey: ZOOM_MEETING_SDK_CLIENT_ID,
    sdkKey: ZOOM_MEETING_SDK_CLIENT_ID,
    mn: input.meetingNumber.toString(),
    role: 0,
    iat: timestamp,
    exp: expirationTime,
    tokenExp: expirationTime,
  };

  return jwt.sign(payload, ZOOM_MEETING_SDK_CLIENT_SECRET, { algorithm: 'HS256' });
};

const WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

/**
 * Verifies a Zoom webhook delivery per Zoom's documented signature scheme:
 * HMAC-SHA256 over `v0:{timestamp}:{rawBody}` using the webhook secret token,
 * compared as `v0={hex}`. Also rejects stale timestamps (replay protection).
 */
export const verifyZoomWebhookSignature = (params: {
  rawBody: string;
  signatureHeader: string | undefined;
  timestampHeader: string | undefined;
}): boolean => {
  const { rawBody, signatureHeader, timestampHeader } = params;
  if (!ENV.ZOOM_WEBHOOK_SECRET_TOKEN || !signatureHeader || !timestampHeader) return false;

  const timestampSeconds = Number(timestampHeader);
  if (!Number.isFinite(timestampSeconds)) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS) return false;

  const message = `v0:${timestampHeader}:${rawBody}`;
  const expected = `v0=${crypto
    .createHmac('sha256', ENV.ZOOM_WEBHOOK_SECRET_TOKEN)
    .update(message)
    .digest('hex')}`;

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signatureHeader);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
};

/**
 * Zoom's endpoint-URL-validation challenge: HMAC-SHA256 of the plainToken using
 * the webhook secret token, returned so Zoom can confirm this endpoint controls it.
 */
export const hashZoomWebhookValidationToken = (plainToken: string): string => {
  return crypto.createHmac('sha256', ENV.ZOOM_WEBHOOK_SECRET_TOKEN).update(plainToken).digest('hex');
};
