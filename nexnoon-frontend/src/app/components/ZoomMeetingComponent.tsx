import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { AlertCircle, CheckCircle2, Clock, Maximize2, Minimize2, Video } from 'lucide-react';
import { apiClient } from '@/lib/api';
import type { ClassSchedule } from '@/types/api';
import type ZoomMtgEmbeddedDefault from '@zoom/meetingsdk/embedded';

interface ZoomMeetingComponentProps {
  classId: string;
  session: ClassSchedule;
  userName: string;
  /** Shown in the pre-join card when available. Purely presentational. */
  instructorName?: string;
  /** Shows an enrollment confirmation line in the pre-join card when true. */
  isEnrolled?: boolean;
  /** Class thumbnail shown behind the pre-join/waiting card. Purely presentational. */
  thumbnail?: string;
  /** The assigned instructor (or admin) - shows the native "Start Class as Host" action. */
  isHost?: boolean;
  /** Called after the host successfully starts the session, so the caller can refetch and pick up the new 'live' status. */
  onSessionStarted?: () => void;
}

type EmbeddedZoomClient = ReturnType<typeof ZoomMtgEmbeddedDefault.createClient>;

type JoinState = 'waiting' | 'loading' | 'ready' | 'error';
// 'too-early' = before our own 15-minute join window (schedule-based).
// 'waiting-for-host' = the join window is open and credentials were issued, but
// Zoom itself reports the meeting hasn't been started by the host yet - a normal,
// expected state (waiting_room + join_before_host:false), not a failure.
type ErrorReason = 'too-early' | 'waiting-for-host' | 'not-enrolled' | 'unauthenticated' | 'cancelled' | 'missing-meeting' | 'sdk-config' | 'init-failed' | 'network' | 'meeting-ended' | 'meeting-locked';

export default function ZoomMeetingComponent({ classId, session, userName, instructorName, isEnrolled, thumbnail, isHost, onSessionStarted }: ZoomMeetingComponentProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<EmbeddedZoomClient | null>(null);
  const clientInitializedRef = useRef(false);
  const [state, setState] = useState<JoinState>('waiting');
  const [error, setError] = useState<ErrorReason | null>(null);
  const [countdown, setCountdown] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hostAccessState, setHostAccessState] = useState<'idle' | 'loading' | 'error'>('idle');

  // Keeps join eligibility in sync with the session's real lifecycle status
  // (polled from the backend - see BackendClassroom's refetchInterval) as well
  // as elapsed time, every second. Previously this only ran once on mount and
  // never re-evaluated, so a student who kept the tab open could get stuck on a
  // stale "starts in 15 minutes" message, or - worse - keep seeing the "Join
  // Class" button and enrollment confirmation for a session that had already
  // ended, with nothing stopping them from trying to join it again.
  //
  // Once already connected (state === 'ready'), this defers entirely to Zoom's
  // own connection-change event instead of forcing the UI away mid-meeting just
  // because a poll happened to land while the backend's status hadn't caught up
  // yet.
  useEffect(() => {
    if (state === 'ready') return;

    // Terminal states end the "can I join" story outright - the calm
    // "Class Ended" card (reusing 'meeting-ended') for a normal completion, the
    // more direct 'cancelled' card when the instructor cancelled it. Neither
    // should ever show a Join button or the "you're enrolled" line again.
    if (session.status === 'completed') {
      setCountdown('');
      setError('meeting-ended');
      setState('error');
      return;
    }
    if (session.status === 'cancelled') {
      setCountdown('');
      setError('cancelled');
      setState('error');
      return;
    }

    // `session.status === 'live'` (set the moment the instructor actually starts
    // the meeting - see the meeting.started webhook) always wins over the local
    // countdown estimate below, same as the backend's own join-window check: a
    // teacher who starts early must let students in immediately, not leave them
    // staring at a "starts in N hours" countdown until the originally scheduled time.
    if (session.status === 'live') {
      setCountdown('');
      setError(prev => (prev === 'too-early' ? null : prev));
      return;
    }

    const evaluate = () => {
      const now = Date.now();
      const startTime = new Date(session.startTime).getTime();
      const timeUntilStart = startTime - now;
      const fifteenMinutes = 15 * 60 * 1000;

      if (timeUntilStart > fifteenMinutes) {
        const hours = Math.floor(timeUntilStart / (1000 * 60 * 60));
        const minutes = Math.floor((timeUntilStart % (1000 * 60 * 60)) / (1000 * 60));
        setCountdown(`Starts in ${hours}h ${minutes}m`);
      } else if (timeUntilStart > 0) {
        const minutes = Math.floor(timeUntilStart / (1000 * 60));
        const seconds = Math.floor((timeUntilStart % (1000 * 60)) / 1000);
        setCountdown(`Ready to join in ${minutes}m ${seconds}s`);
      } else {
        setCountdown('');
      }

      setError(prev => {
        if (prev === 'too-early' && timeUntilStart <= fifteenMinutes) return null;
        if (prev === null && timeUntilStart > fifteenMinutes && state === 'waiting') return 'too-early';
        return prev;
      });
    };

    evaluate();
    const timer = setInterval(evaluate, 1000);
    return () => clearInterval(timer);
  }, [session.startTime, session.status, state]);

  // Leave the meeting and free the SDK's media resources if the student navigates
  // away (e.g. back to My Classes) while still connected.
  useEffect(() => {
    return () => {
      if (clientRef.current && clientInitializedRef.current) {
        clientRef.current.leaveMeeting().catch(() => {});
      }
    };
  }, []);

  // Component View sizes its video canvas to the pixel dimensions given at init.
  // Keep it filling the wrapper (instead of Zoom's small default floating widget)
  // by re-measuring whenever the wrapper resizes - including entering/exiting fullscreen.
  useEffect(() => {
    if (state !== 'ready' || !wrapperRef.current) return;
    const wrapper = wrapperRef.current;
    const resize = () => {
      const rect = wrapper.getBoundingClientRect();
      clientRef.current?.updateVideoOptions({
        viewSizes: { default: { width: Math.round(rect.width), height: Math.round(rect.height) } },
      });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [state]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(document.fullscreenElement === wrapperRef.current);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const handleToggleFullscreen = () => {
    if (!wrapperRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      wrapperRef.current.requestFullscreen().catch(() => {});
    }
  };

  const handleStartAsHost = async () => {
    setHostAccessState('loading');
    try {
      const response = await apiClient.post(`/classes/${classId}/sessions/${session.id}/host-access`, {});
      const startUrl = response.data?.data?.startUrl;
      if (!startUrl) {
        setHostAccessState('error');
        return;
      }
      window.open(startUrl, '_blank', 'noopener,noreferrer');
      setHostAccessState('idle');

      // Flips the session to 'live' in the backend right away (and notifies
      // enrolled students) instead of waiting on Zoom's meeting.started webhook,
      // which is async and never fires at all without real Zoom credentials
      // configured. A failure here shouldn't block the host, who already has
      // their start link - it just means students' join gates open a bit late,
      // once the webhook (if any) or the next status poll catches up.
      apiClient.post(`/classes/${classId}/schedule/${session.id}/start`, {})
        .then(() => onSessionStarted?.())
        .catch((err) => console.error('Failed to mark session live:', err));
    } catch (err) {
      console.error('Failed to get host start link:', err);
      setHostAccessState('error');
    }
  };

  const handleJoinMeeting = async () => {
    setState('loading');
    setError(null);

    try {
      // Request credentials from backend (apiClient attaches the auth token and
      // retries once with a refreshed token on 401, same as every other API call).
      const response = await apiClient.post(
        `/classes/${classId}/sessions/${session.id}/join-credentials`,
        {}
      );

      if (!response.data.success) {
        const message = response.data.message || 'Unable to join meeting';
        if (message.includes('not started')) {
          // Backend-enforced schedule window, not a failure - show the friendly
          // countdown card instead of the generic error card.
          setError('too-early');
          setState('waiting');
          return;
        } else if (message.includes('not enrolled')) {
          setError('not-enrolled');
        } else if (message.includes('cancelled') || message.includes('completed') || message.includes('already ended') || message.includes('join window')) {
          setError('cancelled');
        } else if (message.includes('not available')) {
          setError('missing-meeting');
        } else if (message.includes('not configured')) {
          setError('sdk-config');
        } else {
          setError('network');
        }
        setState('error');
        return;
      }

      const { signature, meetingNumber, passWord, userName: displayName, userEmail } = response.data.data;

      if (!containerRef.current || !wrapperRef.current) {
        setError('init-failed');
        setState('error');
        return;
      }

      try {
        // Load the Zoom Meeting SDK's Component View on demand so it never bloats
        // routes that don't join a meeting. Component View renders inside the
        // container we give it, instead of Client View's full-page takeover.
        const { default: ZoomMtgEmbedded } = await import('@zoom/meetingsdk/embedded');

        if (!clientRef.current) {
          clientRef.current = ZoomMtgEmbedded.createClient();
        }
        const client = clientRef.current;

        if (!clientInitializedRef.current) {
          // Without an explicit size, Component View renders as a small draggable
          // floating widget instead of filling the space we give it - size it to
          // the wrapper up front (the ResizeObserver effect keeps it in sync after).
          const rect = wrapperRef.current.getBoundingClientRect();
          await client.init({
            zoomAppRoot: containerRef.current,
            language: 'en-US',
            patchJsMedia: true,
            customize: {
              video: {
                isResizable: false,
                popper: { disableDraggable: true },
                viewSizes: { default: { width: Math.round(rect.width), height: Math.round(rect.height) } },
              },
            },
          });
          // Detect the host ending the meeting (or the connection closing) while
          // already joined, so the UI can leave the embedded view instead of
          // freezing on Zoom's own internal state.
          client.on('connection-change', (payload: { state?: string }) => {
            if (payload?.state === 'Closed') {
              setError('meeting-ended');
              setState('error');
            }
          });
          clientInitializedRef.current = true;
        }

        await client.join({
          signature,
          meetingNumber,
          password: passWord,
          userName: displayName || userName,
          userEmail: userEmail || '',
        });

        setState('ready');
      } catch (sdkError: any) {
        console.error('Zoom SDK error:', sdkError?.type, sdkError?.reason, sdkError);
        const reason = typeof sdkError?.reason === 'string' ? sdkError.reason.toLowerCase() : '';
        if (reason.includes('ended')) {
          setError('meeting-ended');
          setState('error');
        } else if (reason.includes('not started')) {
          // Credentials were valid (the schedule window is open) - Zoom is just
          // reporting the host hasn't pressed Start yet. Expected, not a failure:
          // show the friendly waiting card, not the generic error card.
          setError('waiting-for-host');
          setState('waiting');
        } else if (reason.includes('locked')) {
          setError('meeting-locked');
          setState('error');
        } else {
          setError('init-failed');
          setState('error');
        }
      }
    } catch (err: any) {
      console.error('Request failed:', err);
      if (err.response?.status === 401) {
        setError('unauthenticated');
      } else if (err.response?.status === 409) {
        const message = err.response.data?.message || '';
        if (message.includes('not started')) {
          setError('too-early');
          setState('waiting');
          return;
        } else if (message.includes('cancelled') || message.includes('completed') || message.includes('already ended') || message.includes('join window')) {
          setError('cancelled');
        } else {
          setError('missing-meeting');
        }
      } else if (err.response?.status === 403) {
        setError('not-enrolled');
      } else if (err.response?.status === 400 || err.response?.status === 404) {
        setError('missing-meeting');
      } else if (err.response?.status === 503) {
        setError('sdk-config');
      } else {
        setError('network');
      }
      setState('error');
    }
  };

  const errorMessages: Record<ErrorReason, string> = {
    'too-early': `This session starts at ${new Date(session.startTime).toLocaleString()}. You can join up to 15 minutes early.`,
    'waiting-for-host': "Your instructor hasn't started the class yet. You'll be let in automatically as soon as they do.",
    'not-enrolled': 'You are not enrolled in this class. Please enroll first to join the live session.',
    'unauthenticated': 'Your session has expired. Please sign in again to join this class.',
    'cancelled': `This session has been ${session.status}. Unable to join.`,
    'missing-meeting': 'The instructor has not set up a meeting for this session yet.',
    'sdk-config': 'Zoom is not configured. Please contact support.',
    'init-failed': 'Failed to initialize Zoom. Please check your connection and try again.',
    'network': 'Network error. Please check your connection and try again.',
    'meeting-ended': 'This meeting has ended.',
    'meeting-locked': 'The host has locked this meeting. Please contact your instructor.',
  };

  return (
    <div className="space-y-3">
      {/* A single self-contained "meeting room" card - dark themed like a real video
          call lobby. The zoomAppRoot container is always mounted at real, non-zero
          dimensions (a hidden/zero-size container makes Zoom's SDK fail with an opaque
          init error); everything else here is an overlay on top of it until join()
          succeeds, at which point the overlay is removed and the real video shows through. */}
      <div
        ref={wrapperRef}
        role="region"
        aria-label="Live classroom"
        className={`relative w-full rounded-2xl overflow-hidden border border-gray-800 bg-gradient-to-b from-gray-900 to-black ${isFullscreen ? 'h-screen' : ''}`}
        style={isFullscreen ? undefined : { minHeight: 480 }}
      >
        <div ref={containerRef} className="absolute inset-0" />

        {state === 'waiting' && (
          // Opaque background: the SDK can leave a partial "waiting" panel of its own
          // mounted in the zoomAppRoot container beneath this; without an opaque fill
          // here, that stray SDK content shows through around our centered message.
          // Title/instructor/date are intentionally omitted here - the LiveClassHeader
          // right above this card already shows them; this card only adds what's new.
          <div className="absolute inset-0 z-10 overflow-hidden">
            {error && thumbnail && (
              <img src={thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" />
            )}
            <div className={`absolute inset-0 ${error ? 'bg-gray-900/85' : 'bg-gray-900'}`} />
            <div className="relative h-full flex flex-col items-center justify-center text-center px-6 overflow-y-auto py-8">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 flex-shrink-0 ${error ? 'bg-blue-500/20 border border-blue-400/30' : 'bg-white/10 border border-white/20'}`}>
                {error ? <Clock className="h-7 w-7 text-blue-300" /> : <Video className="h-7 w-7 text-white" />}
              </div>

              {error === 'too-early' && (
                <>
                  {countdown && <p className="text-3xl font-mono font-bold text-white mb-2" role="status" aria-live="polite">{countdown}</p>}
                  <p className="text-white/60 text-sm max-w-sm">You can join up to 15 minutes before this session starts.</p>
                </>
              )}

              {error === 'waiting-for-host' && (
                <>
                  <p className="text-white font-semibold mb-1">Waiting for your instructor&hellip;</p>
                  <p className="text-white/60 text-sm max-w-sm">{errorMessages['waiting-for-host']}</p>
                  <button
                    onClick={handleJoinMeeting}
                    className="mt-4 text-sm font-medium text-white/80 underline hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded"
                  >
                    Try again
                  </button>
                </>
              )}

              {!error && (
                <>
                  {isEnrolled && (
                    <p className="flex items-center gap-1.5 text-xs text-emerald-400 mb-4">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> You&apos;re enrolled and ready to join
                    </p>
                  )}
                  <button
                    onClick={handleJoinMeeting}
                    className="inline-flex items-center gap-2 bg-[#889dd1] hover:bg-[#7086c4] text-white px-8 py-3 rounded-full font-semibold shadow-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
                  >
                    <Video className="h-4 w-4" aria-hidden="true" /> Join Class
                  </button>
                  {countdown && <p className="text-white/40 text-xs mt-3" aria-hidden="true">{countdown}</p>}
                </>
              )}

              {isHost && (
                <div className="mt-5 pt-5 border-t border-white/10 w-full max-w-xs">
                  <button
                    onClick={handleStartAsHost}
                    disabled={hostAccessState === 'loading'}
                    className="w-full inline-flex items-center justify-center gap-2 bg-white hover:bg-gray-100 text-gray-900 px-6 py-2.5 rounded-full font-semibold shadow-lg transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
                  >
                    {hostAccessState === 'loading' ? 'Getting your host link…' : 'Start Class as Host'}
                  </button>
                  {hostAccessState === 'error' && (
                    <p className="text-red-300 text-xs mt-2">Couldn&apos;t get your host link. Please try again.</p>
                  )}
                  <p className="text-white/35 text-xs mt-2">Opens Zoom in a new tab so you can start and control the meeting. Students can&apos;t join until you do.</p>
                </div>
              )}

              {!error && (
                <div className="mt-5 max-w-xs space-y-1">
                  <p className="text-white/35 text-xs">Your browser may ask for camera and microphone access when you join.</p>
                  <p className="text-white/35 text-xs">Only enrolled students can join, and only during the scheduled session window.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {state === 'loading' && (
          <div className="absolute inset-0 z-10 bg-gray-900 flex flex-col items-center justify-center gap-3" role="status" aria-live="polite">
            <div className="animate-spin motion-reduce:animate-none h-8 w-8 border-2 border-white/30 border-t-white rounded-full" aria-hidden="true" />
            <span className="text-white/70 text-sm">Securely preparing your classroom&hellip;</span>
          </div>
        )}

        {state === 'error' && error === 'meeting-ended' && (
          <div className="absolute inset-0 z-10 bg-gray-900 flex flex-col items-center justify-center text-center px-6" role="status" aria-live="polite">
            <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mb-4">
              <Video className="h-7 w-7 text-white/70" aria-hidden="true" />
            </div>
            <p className="text-white font-bold text-lg mb-1">Class Ended</p>
            <p className="text-white/60 text-sm max-w-sm mb-5">{errorMessages['meeting-ended']}</p>
            <Link
              to={`/classroom/${classId}`}
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-6 py-2.5 rounded-full font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
            >
              Return to Class
            </Link>
          </div>
        )}

        {state === 'error' && error && error !== 'meeting-ended' && (
          <div className="absolute inset-0 z-10 bg-gray-900 flex flex-col items-center justify-center text-center px-6" role="alert" aria-live="polite">
            <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-400/30 flex items-center justify-center mb-4">
              <AlertCircle className="h-7 w-7 text-red-300" aria-hidden="true" />
            </div>
            <p className="text-white font-bold text-lg mb-1">Unable to Join</p>
            <p className="text-white/60 text-sm max-w-sm mb-4">{errorMessages[error]}</p>
            <button
              onClick={() => {
                setState('waiting');
                setError(null);
              }}
              className="text-sm font-medium text-white/80 underline hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded"
            >
              Try Again
            </button>
          </div>
        )}

        {state === 'ready' && (
          <button
            onClick={handleToggleFullscreen}
            className="absolute top-3 right-3 z-10 p-2 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            title={isFullscreen ? 'Exit fullscreen' : 'Expand to fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        )}
      </div>

      {state === 'ready' && (
        <p className="text-xs text-gray-500 text-center">
          Meeting controls (mute, video, chat, leave) are available inside the meeting above.
        </p>
      )}
    </div>
  );
}
