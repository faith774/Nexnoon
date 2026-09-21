import { ENV } from './env';

/**
 * Single source of truth for live-class join-window timing. Backend policy is
 * authoritative; the frontend only reads these decisions to render UI state
 * (countdowns, button labels) and must never recompute joinability itself.
 */

export type SessionLifecycleStatus = 'scheduled' | 'live' | 'completed' | 'cancelled';

export type JoinDecisionCode =
  | 'too_early'
  | 'joinable'
  | 'late_joinable'
  /** The scheduled join window has closed by elapsed time. This is a computed
   *  decision, not a stored session status - a session that's genuinely still
   *  `live` per Zoom's own webhook never reaches this, no matter how long it runs. */
  | 'ended'
  | 'completed'
  | 'cancelled'
  | 'missing_meeting'
  | 'config_unavailable';

export interface JoinDecision {
  code: JoinDecisionCode;
  allowed: boolean;
  httpStatus: number;
  message: string;
}

interface SessionTimingInput {
  status: SessionLifecycleStatus;
  startTime: Date | string;
  endTime: Date | string;
  hasZoomMeeting: boolean;
}

/**
 * Evaluates whether a join request should be allowed right now. UTC-safe:
 * all comparisons use epoch milliseconds from `Date`, never local wall-clock math.
 */
export function evaluateJoinWindow(session: SessionTimingInput, now: Date = new Date()): JoinDecision {
  if (session.status === 'cancelled') {
    return { code: 'cancelled', allowed: false, httpStatus: 409, message: 'This session was cancelled' };
  }
  if (session.status === 'completed') {
    return { code: 'completed', allowed: false, httpStatus: 409, message: 'This session has already ended' };
  }
  if (!session.hasZoomMeeting) {
    return { code: 'missing_meeting', allowed: false, httpStatus: 409, message: 'Meeting not available for this session' };
  }
  // The instructor has actually started the meeting (meeting.started webhook) -
  // that's a stronger, more current signal than our own scheduled-time estimate,
  // so it always wins over the early-join-window check below. This is what lets
  // a student join the moment their teacher starts class early, instead of being
  // stuck on a "starts in N hours" countdown until the originally scheduled time.
  if (session.status === 'live') {
    return { code: 'joinable', allowed: true, httpStatus: 200, message: 'Session is live' };
  }

  const nowMs = now.getTime();
  const startMs = new Date(session.startTime).getTime();
  const endMs = new Date(session.endTime).getTime();
  const earlyWindowMs = ENV.LIVE_CLASS_JOIN_EARLY_MINUTES * 60 * 1000;
  const graceMs = ENV.LIVE_CLASS_LATE_JOIN_GRACE_MINUTES * 60 * 1000;

  if (nowMs < startMs - earlyWindowMs) {
    return { code: 'too_early', allowed: false, httpStatus: 409, message: 'Session has not started yet' };
  }
  if (nowMs > endMs + graceMs) {
    return { code: 'ended', allowed: false, httpStatus: 409, message: 'The join window for this session has closed' };
  }
  if (nowMs > endMs) {
    return { code: 'late_joinable', allowed: true, httpStatus: 200, message: 'Session is in progress' };
  }
  return { code: 'joinable', allowed: true, httpStatus: 200, message: 'Session is joinable' };
}

/** True when two [start, end) time ranges intersect. UTC-safe (epoch ms comparison). */
export function sessionsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}
