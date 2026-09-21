import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, Calendar, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBackendData } from '@/hooks/useBackendData';
import { apiClient, getErrorMessage } from '@/lib/api';
import { classDetailUrl } from '@/lib/url';
import type { AssignmentAnswer, Class, ClassSchedule, Enrollment } from '@/types/api';
import Header from './Header';
import Footer from './Footer';
import BackendState from './BackendState';
import ZoomMeetingComponent from './ZoomMeetingComponent';
import ManageMaterials from './ManageMaterials';
import ManageAssignments from './ManageAssignments';
import StudentAssignments from './StudentAssignments';
import FileAttachment from './FileAttachment';

type Workspace = { class: Class; sessions: ClassSchedule[]; enrollment: Enrollment | null; canTeach: boolean; mySubmissions: AssignmentAnswer[] };
type View = 'classroom' | 'materials' | 'assignments' | 'recording' | 'live' | 'waiting' | 'certificate';

const heroFallback = 'https://images.unsplash.com/photo-1572044162444-ad60f128bdea?w=1080';
const date = (value?: string) => value ? new Date(value).toLocaleString() : 'Not scheduled';
const safeUrl = (value?: string) => {
  try { const url = new URL(value || ''); return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined; } catch { return undefined; }
};

const statusBadge: Record<ClassSchedule['status'], string> = {
  live: 'bg-red-100 text-red-700',
  scheduled: 'bg-blue-100 text-blue-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-gray-100 text-gray-400',
};

const navTabs: [string, string][] = [
  ['classroom', 'Overview'],
  ['materials', 'Materials'],
  ['assignments', 'Assignments'],
  ['waiting-room', 'Next session'],
  ['certificate', 'Certificate'],
];

const activeRouteByView: Record<View, string> = {
  classroom: 'classroom', materials: 'materials', assignments: 'assignments',
  waiting: 'waiting-room', live: 'waiting-room', recording: 'waiting-room', certificate: 'certificate',
};

/** Compact, session-specific header shown above the embedded live-class meeting. */
function LiveClassHeader({ classId, courseTitle, instructorName, session, canTeach, onMarkComplete, isMarkingComplete, markCompleteError }: {
  classId: string; courseTitle: string; instructorName: string; session?: ClassSchedule;
  /** Instructor/admin actions below are only ever shown for the class's own owner. */
  canTeach?: boolean;
  onMarkComplete?: (sessionId: string) => void;
  isMarkingComplete?: boolean;
  markCompleteError?: string | null;
}) {
  // The meeting.ended webhook normally does this automatically the moment Zoom
  // reports the meeting stopped - this button is only a fallback for when that
  // hasn't happened yet (webhook not configured, or the instructor ended the
  // call some other way) and the session would otherwise sit as "live" forever.
  const canMarkComplete = canTeach && session && session.status !== 'completed' && session.status !== 'cancelled';

  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
      <div className="min-w-0">
        <Link
          to={classDetailUrl(classId, courseTitle)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to class
        </Link>
        <h2 className="text-lg font-bold text-gray-900 truncate">{session?.title || 'Live Classroom'}</h2>
        <p className="text-sm text-gray-500 truncate">{courseTitle} &middot; {instructorName}</p>
      </div>
      {session && (
        <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-1.5 flex-shrink-0">
          {session.status === 'live' ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse motion-reduce:animate-none" /> LIVE NOW
            </span>
          ) : (
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${statusBadge[session.status]}`}>{session.status}</span>
          )}
          <p className="text-sm text-gray-500 flex items-center gap-1.5 whitespace-nowrap">
            <Calendar className="h-3.5 w-3.5" /> {date(session.startTime)}
          </p>
          {canMarkComplete && (
            <button
              onClick={() => onMarkComplete?.(session.id)}
              disabled={isMarkingComplete}
              className="text-xs font-medium text-gray-500 hover:text-gray-900 underline disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isMarkingComplete ? 'Marking complete…' : 'Mark session complete'}
            </button>
          )}
          {markCompleteError && <p className="text-xs text-red-600 max-w-[220px] text-right">{markCompleteError}</p>}
        </div>
      )}
    </div>
  );
}

export default function BackendClassroom({ view }: { view: View }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const classId = id || params.get('classId');
  const { user, isLoading: authLoading } = useAuth();
  const [now, setNow] = useState(Date.now());
  const [completingSessionId, setCompletingSessionId] = useState<string | null>(null);
  const [markCompleteError, setMarkCompleteError] = useState<string | null>(null);
  // Poll while this page is open so a status change the instructor triggers
  // (starting/ending the live session) or a new session they add shows up for
  // whoever else is looking at this class, without a manual reload. 15s keeps
  // "in sync" feeling prompt without hammering the API; React Query pauses this
  // automatically whenever the tab isn't focused.
  const query = useBackendData<Workspace>(`/data/class/${classId || 'missing'}`, false, { refetchInterval: 15_000 });
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const title = { classroom: 'Classroom', materials: 'Course Materials', assignments: 'Assignments', recording: 'Class Recording', live: 'Live Session', waiting: 'Waiting Room', certificate: 'Certificate' }[view];
  if (authLoading) return <BackendState title={title} loading message="Loading Nexnoon" />;
  if (!user) return <BackendState title={title} message="Sign in to access your classes." />;
  if (!classId) return <BackendState title={title} message="Select a class from My Classes to continue." />;
  if (query.isError) return <BackendState title={title} message="Unable to open this class. Check your connection and make sure you are enrolled or teaching it." retry={() => query.refetch()} />;
  if (!query.data) return <BackendState title={title} loading message="Loading Nexnoon" />;
  const { class: cls, sessions, enrollment, canTeach, mySubmissions } = query.data;
  const requested = params.get('sessionId');
  const session = requested ? sessions.find(s => s.id === requested) : view === 'recording'
    ? sessions.find(s => s.recordingUrl)
    : sessions.find(s => s.status === 'live') || sessions.find(s => s.status !== 'cancelled' && new Date(s.endTime).getTime() > now);
  const recordingUrl = safeUrl(session?.recordingUrl);
  const certificateUrl = enrollment?.status === 'completed' ? safeUrl(enrollment.certificateUrl) : undefined;
  const activeRoute = activeRouteByView[view];

  const handleMarkComplete = async (sessionId: string) => {
    setCompletingSessionId(sessionId);
    setMarkCompleteError(null);
    try {
      await apiClient.post(`/classes/${classId}/schedule/${sessionId}/complete`);
      await query.refetch();
    } catch (err) {
      setMarkCompleteError(getErrorMessage(err));
    } finally {
      setCompletingSessionId(null);
    }
  };

  return <div className="min-h-screen flex flex-col bg-gray-50"><Header />

    {/* Hero: compact banner */}
    <div
      className="relative py-8 sm:py-12 overflow-hidden"
      style={{ backgroundImage: `url(${cls.thumbnail || heroFallback})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-black/75 via-black/60 to-black/50" />
      <div className="relative z-10 w-[90vw] max-w-6xl mx-auto">
        <Link to="/my-classes" className="inline-flex items-center gap-2 text-white/80 hover:text-white text-xs mb-2 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to My Classes
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="px-2.5 py-0.5 bg-[#889dd1]/30 backdrop-blur-sm border border-white/20 text-white text-xs rounded-full flex-shrink-0">
              {cls.category}
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-white truncate">{cls.title}</h1>
            <p className="text-white/70 text-sm whitespace-nowrap hidden sm:block">{cls.instructor.name} &middot; {cls.totalSessions} sessions</p>
          </div>
          {enrollment && (
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-3 py-1.5 flex-shrink-0">
              <p className="text-sm font-bold text-white">{enrollment.progress}% <span className="text-white/60 font-normal capitalize text-xs">&middot; {enrollment.status}</span></p>
            </div>
          )}
        </div>
      </div>
    </div>

    <main className="flex-1 w-[90vw] max-w-6xl mx-auto pb-10">
      {/* Nav */}
      <nav className="flex flex-wrap gap-1.5 bg-white rounded-2xl shadow-lg border border-gray-100 p-2 -mt-6 sticky top-16 z-40 mb-6">
        {navTabs.map(([route, label]) => (
          <Link
            key={route}
            to={`/${route}/${classId}`}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              activeRoute === route ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {label}
          </Link>
        ))}
        {canTeach && (
          <Link to={`/edit-class/${classId}`} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
            Edit class
          </Link>
        )}
      </nav>

      <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 sm:p-8">
        {view === 'classroom' && <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Meeting */}
            <div className="lg:col-span-2 min-w-0">
              <LiveClassHeader
                classId={classId!}
                courseTitle={cls.title}
                instructorName={cls.instructor.name}
                session={session}
                canTeach={canTeach}
                onMarkComplete={handleMarkComplete}
                isMarkingComplete={completingSessionId === session?.id}
                markCompleteError={completingSessionId === null ? markCompleteError : null}
              />
              {session?.zoomMeetingId ? (
                <ZoomMeetingComponent
                  key={session.id}
                  classId={classId!}
                  session={session}
                  userName={user?.name || 'Student'}
                  instructorName={cls.instructor.name}
                  isEnrolled={!canTeach && enrollment?.status === 'active'}
                  thumbnail={cls.thumbnail}
                  isHost={canTeach}
                  onSessionStarted={() => query.refetch()}
                />
              ) : (
                <div className="rounded-2xl border border-gray-800 bg-gradient-to-b from-gray-900 to-black p-10 text-center">
                  <p className="text-white/60 text-sm">
                    {session ? 'The instructor has not provided a meeting link for this session yet.' : 'No upcoming session has been scheduled.'}
                  </p>
                </div>
              )}
            </div>

            {/* Course content sidebar */}
            <aside className="lg:col-span-1 min-w-0">
              <div className="border border-gray-200 rounded-2xl overflow-hidden sticky top-6">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <h2 className="text-sm font-bold text-gray-900">Course Content</h2>
                  <p className="text-xs text-gray-500">{sessions.length} session{sessions.length === 1 ? '' : 's'}</p>
                </div>
                <div className="lg:max-h-[520px] lg:overflow-y-auto divide-y divide-gray-100">
                  {!sessions.length && <p className="text-sm text-gray-500 p-4">No sessions have been scheduled yet.</p>}
                  {sessions.map(s => {
                    const isActive = session?.id === s.id;
                    // "Completed" for a student is per-student: a session is marked
                    // attended (server-side) the moment this student successfully
                    // joins it. Instructors don't "attend" their own class, so for
                    // them this falls back to the class-wide session status instead -
                    // a session that's run its course shows as done for the teacher
                    // too, not just a plain unfilled circle forever.
                    const isDone = canTeach ? s.status === 'completed' : !!enrollment?.attendedSessions?.includes(s.id);
                    return (
                      <div key={s.id} className={`px-4 py-3 transition-colors ${isActive ? 'bg-[#889dd1]/10' : 'hover:bg-gray-50'}`}>
                        <Link to={`/classroom/${classId}?sessionId=${s.id}`} className="flex items-start gap-3">
                          <span className="mt-0.5 flex-shrink-0 w-5 h-5 flex items-center justify-center">
                            {isDone ? (
                              <CheckCircle2 className="h-5 w-5 text-[#889dd1]" />
                            ) : s.status === 'live' ? (
                              <span className="relative flex h-3 w-3" aria-hidden="true">
                                <span className="animate-ping motion-reduce:hidden absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600" />
                              </span>
                            ) : (
                              <span className={`block w-4 h-4 rounded-full border-2 ${s.status === 'cancelled' ? 'border-gray-200' : 'border-gray-300'}`} />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={`block text-sm font-medium truncate ${isActive ? 'text-[#5a6bab]' : s.status === 'cancelled' ? 'text-gray-400' : 'text-gray-900'}`}>
                              {s.title}
                            </span>
                            <span className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                              <Calendar className="h-3 w-3" /> {date(s.startTime)}
                            </span>
                          </span>
                        </Link>
                        {safeUrl(s.recordingUrl) && (
                          <Link to={`/recorded-class/${classId}?sessionId=${s.id}`} className="inline-block text-xs text-[#889dd1] hover:underline mt-1.5 ml-8">
                            Watch recording
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </aside>
          </div>

          <div className="border-t border-gray-100 pt-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">About this class</h2>
            <p className="whitespace-pre-line text-gray-600">{cls.description}</p>
          </div>
        </>}
        {view === 'materials' && <>
          {canTeach ? (
            <ManageMaterials classId={classId!} materials={cls.materials || []} onChanged={() => query.refetch()} />
          ) : !cls.materials?.length ? (
            <p>No materials have been added by the instructor.</p>
          ) : (
            <div className="space-y-2">{cls.materials.map((item, index) => <FileAttachment key={index} url={item} />)}</div>
          )}
        </>}
        {view === 'assignments' && <>
          {canTeach ? (
            <ManageAssignments classId={classId!} assignments={cls.assignments || []} onChanged={() => query.refetch()} />
          ) : (
            <StudentAssignments classId={classId!} assignments={cls.assignments || []} submissions={mySubmissions} onChanged={() => query.refetch()} />
          )}
        </>}
        {view === 'recording' && <>{recordingUrl ? <><h3 className="font-bold mb-4">{session?.title}</h3><video className="w-full rounded-lg bg-black" controls src={recordingUrl} /><a className="underline block mt-4" href={recordingUrl} target="_blank" rel="noopener noreferrer">Open recording</a></> : <p>No recording is available for this session yet.</p>}</>}
        {(view === 'live' || view === 'waiting') && <>{session ? (
          <>
            <LiveClassHeader
              classId={classId!}
              courseTitle={cls.title}
              instructorName={cls.instructor.name}
              session={session}
              canTeach={canTeach}
              onMarkComplete={handleMarkComplete}
              isMarkingComplete={completingSessionId === session?.id}
              markCompleteError={completingSessionId === null ? markCompleteError : null}
            />
            {session.zoomMeetingId ? (
              <ZoomMeetingComponent
                key={session.id}
                classId={classId!}
                session={session}
                userName={user?.name || 'Student'}
                instructorName={cls.instructor.name}
                isEnrolled={!canTeach && enrollment?.status === 'active'}
                thumbnail={cls.thumbnail}
                isHost={canTeach}
                onSessionStarted={() => query.refetch()}
              />
            ) : <p>The instructor has not provided a meeting link yet.</p>}
          </>
        ) : <p>No upcoming session has been scheduled.</p>}</>}
        {view === 'certificate' && <>{certificateUrl ? <a className="underline flex items-center gap-2" href={certificateUrl} target="_blank" rel="noopener noreferrer"><CheckCircle2 className="h-4 w-4" />Open your certificate</a> : <p>No certificate has been issued for this enrollment yet.</p>}</>}
      </section>
    </main><Footer /></div>;
}
