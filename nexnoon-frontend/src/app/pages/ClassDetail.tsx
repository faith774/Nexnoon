import { CertificatePreview } from '@/app/components/CertificatePreview';
import { useParams, useNavigate } from 'react-router';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Calendar, Clock, Users, Play, CheckCircle2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import LiveClasses from '@/app/components/LiveClasses';
import BackendState from '@/app/components/BackendState';
import { CountdownTimer } from '@/app/components/CountdownTimer';
import { classService } from '@/lib/api';
import { useBackendData } from '@/hooks/useBackendData';
import { classDetailUrl, slugify } from '@/lib/url';
import { useAuth } from '@/contexts/AuthContext';
import { useMyEnrollments } from '@/hooks/api/useClasses';
import type { Class, Review } from '@/types/api';
const heroBackground = "https://images.unsplash.com/photo-1572044162444-ad60f128bdea?w=1080";
export default function ClassDetail() {
  const { id, titleSlug } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { data: myEnrollments } = useMyEnrollments({ pageSize: 100 }, { enabled: isAuthenticated });
  const platformSettings = useBackendData<{ maxClassSeats: number }>('/settings/platform', true);
  const [apiClass, setApiClass] = useState<Class | null>(null);
  const [error, setError] = useState('');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewError, setReviewError] = useState(false);
  useEffect(() => { let active = true; setReviews([]); setReviewError(false); if (id) classService.getClassReviews(id, { pageSize: 100 }).then(r => { if (active) setReviews(r.data); }).catch(() => { if (active) setReviewError(true); }); return () => { active = false; }; }, [id]);
  const [isCardFixed, setIsCardFixed] = useState(true);
  const relatedCoursesRef = useRef<HTMLDivElement>(null);
  const videoCardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true; setApiClass(null); setError(''); window.scrollTo(0, 0);
    if (!id) { setError('Select a class to view its details.'); return; }
    classService.getClass(id).then(c => { if (active) setApiClass(c); }).catch(() => { if (active) setError('Unable to load this class. Please try again.'); });
    return () => { active = false; };
  }, [id]);
  useEffect(() => { if (id && apiClass && slugify(apiClass.title) !== titleSlug) navigate(classDetailUrl(id, apiClass.title), { replace: true }); }, [id, apiClass, titleSlug, navigate]);
  useEffect(() => {
    const update = () => setIsCardFixed(!relatedCoursesRef.current || relatedCoursesRef.current.getBoundingClientRect().top > window.innerHeight);
    window.addEventListener('scroll', update, { passive: true }); update();
    return () => window.removeEventListener('scroll', update);
  }, [apiClass]);
  if (error) return <BackendState title="Class Details" message={error} />;
  if (!apiClass) return <BackendState title="Class Details" loading message="Loading Nexnoon" />;
  const details = apiClass.details || {};
  // Capacity comes from admin platform settings (synced onto class.maxStudents).
  const seatCapacity = apiClass.maxStudents || platformSettings.data?.maxClassSeats || 25;
  const classData = { ...apiClass, students: seatCapacity, duration: apiClass.totalSessions, durationBase: 'Sessions', format: apiClass.isLive ? 'Live' : 'Online', startDate: apiClass.startDate || apiClass.schedule?.[0]?.startTime || '', instructor: { ...apiClass.instructor, title: details.instructorTitle || 'Nexnoon Expert', bio: details.instructorBio || apiClass.instructor.bio || 'The instructor has not added a biography yet.', image: details.instructorImage || apiClass.instructor.avatar || '' } };
  const modules = details.curriculum?.length ? details.curriculum : (apiClass.schedule || []).map(s => ({ title: s.title, topics: s.description ? [s.description] : [new Date(s.startTime).toLocaleString()], project: 'Project details to be provided by the instructor.' }));
  const paymentId = apiClass.id;
  const activeEnrollment = myEnrollments?.data.find(e => e.classId === apiClass.id && e.status !== 'dropped');
  const isOwnClass = !!user && user.id === apiClass.instructor.id;
  const formatPrice = (price: number) => price === 0 ? 'Free' : new Intl.NumberFormat(undefined, { style: 'currency', currency: apiClass.currency || 'USD' }).format(price);
  const formatDate = (value: string) => value ? new Date(value).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : 'To be announced';
    return (
      <div className="min-h-screen bg-white">
        <Header />

        {/* Hero Section with Video Card */}
        <div
          className="pt-8 pb-10 min-h-[58vh] flex items-center relative overflow-hidden"
          style={{
            backgroundImage: `url(${apiClass.thumbnail || heroBackground})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-black/75 via-black/60 to-black/45" />

          <div className="w-[90vw] mx-auto py-6 relative z-10">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 text-white/70 hover:text-white transition-colors mb-5 text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to courses
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10 items-start">
              <div className="lg:col-span-2 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 mb-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] font-medium tracking-wide text-white/90 uppercase">Live Online Class</span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-semibold text-white mb-3 leading-snug tracking-tight">
                  {classData.title}
                </h1>

                <p className="text-sm text-white/75 mb-5 leading-relaxed line-clamp-3">
                  {classData.description}
                </p>

                <div className="flex flex-wrap items-center gap-2 mb-6">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 px-3 py-1.5">
                    <Users className="h-3.5 w-3.5 text-white/70" />
                    <span className="text-xs text-white/90">{classData.students?.toLocaleString()} seats</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 px-3 py-1.5">
                    <Clock className="h-3.5 w-3.5 text-white/70" />
                    <span className="text-xs text-white/90">{classData.duration} {classData.durationBase}</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 px-3 py-1.5">
                    <Calendar className="h-3.5 w-3.5 text-white/70" />
                    <span className="text-xs text-white/90">Starts {formatDate(classData.startDate)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-white/95 flex items-center justify-center border border-white/20 shadow-sm overflow-hidden">
                    {classData.instructor.image ? (
                      <img src={classData.instructor.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-semibold text-gray-900">{classData.instructor.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-white/55 leading-none mb-1">Nexnoon Expert</p>
                    <p className="text-sm text-white font-medium truncate">{classData.instructor.name}</p>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-1">
                <div
                  ref={videoCardRef}
                  className={`transition-all duration-300 ${
                    isCardFixed
                      ? 'lg:fixed lg:top-28 lg:w-[320px] lg:right-[5vw] z-20'
                      : 'relative'
                  }`}
                >
                  <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-black/5">
                    <div className="relative aspect-video bg-gradient-to-br from-gray-900 to-gray-800 max-h-[180px]">
                      {details.previewVideoUrl ? (
                        <video controls preload="metadata" poster={apiClass.thumbnail} src={details.previewVideoUrl} className="w-full h-full object-cover" />
                      ) : apiClass.thumbnail ? (
                        <img src={apiClass.thumbnail} alt={apiClass.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="h-full flex items-center justify-center text-white text-sm font-medium tracking-wide">Nexnoon</div>
                      )}
                    </div>

                    <div className="p-4">
                      <div className="flex items-baseline gap-1.5 mb-3">
                        <span className="text-xl font-semibold text-gray-900 tracking-tight">
                          {formatPrice(classData.price)}
                        </span>
                        {classData.price > 0 && (
                          <span className="text-[11px] text-gray-400 font-medium uppercase">{apiClass.currency}</span>
                        )}
                      </div>

                      {isOwnClass ? (
                        <Button
                          onClick={() => navigate(`/edit-class/${apiClass.id}`)}
                          className="w-full bg-gray-900 hover:bg-gray-800 text-white h-10 rounded-lg text-sm font-medium mb-3"
                        >
                          Manage This Class
                        </Button>
                      ) : activeEnrollment ? (
                        <Button
                          onClick={() => navigate(`/classroom/${apiClass.id}`)}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-10 rounded-lg text-sm font-medium mb-3"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1.5" />
                          Go to Classroom
                        </Button>
                      ) : (
                        <Button
                          onClick={() => navigate(`/payment/${paymentId}`)}
                          className="w-full bg-gray-900 hover:bg-gray-800 text-white h-10 rounded-lg text-sm font-medium mb-3"
                        >
                          Enroll Now
                        </Button>
                      )}

                      <div className="border-t border-gray-100 pt-3 mt-1">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Class details</p>
                        <div className="grid grid-cols-1 gap-1.5">
                          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-2.5 py-2">
                            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                              <Clock className="h-3 w-3 text-[#889dd1]" />
                              Duration
                            </span>
                            <span className="text-xs font-semibold text-gray-900">{classData.duration} {classData.durationBase}</span>
                          </div>
                          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-2.5 py-2">
                            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                              <Play className="h-3 w-3 text-[#889dd1]" />
                              Format
                            </span>
                            <span className="text-xs font-semibold text-gray-900">Live Online</span>
                          </div>
                          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-2.5 py-2">
                            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                              <Calendar className="h-3 w-3 text-[#889dd1]" />
                              Starts
                            </span>
                            <span className="text-xs font-semibold text-gray-900">{formatDate(classData.startDate).split(',')[0]}</span>
                          </div>
                          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-2.5 py-2">
                            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                              <Users className="h-3 w-3 text-[#889dd1]" />
                              Capacity
                            </span>
                            <span className="text-xs font-semibold text-gray-900">{seatCapacity} seats</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="w-[90vw] mx-auto py-10 sm:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-12">
            <div className="lg:col-span-2 space-y-10 sm:space-y-12">

              <section>
                <h2 className="text-lg font-semibold text-gray-900 tracking-tight mb-4">What you'll learn</h2>
                {!apiClass.learningOutcomes?.length ? (
                  <p className="text-sm text-gray-500">Learning details will be provided by the instructor.</p>
                ) : (
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                    {(apiClass.learningOutcomes || []).map((item, index) => (
                      <li key={index} className="flex items-start gap-2.5">
                        <CheckCircle2 className="h-4 w-4 text-gray-900 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-700 leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {classData.startDate && new Date(classData.startDate).getTime() > Date.now() && (
                <section>
                  <CountdownTimer targetDate={classData.startDate} />
                </section>
              )}

              <section className="border-t border-gray-100 pt-10">
                <div className="flex flex-wrap items-baseline gap-3 mb-3">
                  <h2 className="text-lg font-semibold text-gray-900 tracking-tight">Course overview</h2>
                  <span className="text-xs text-gray-400">{classData.duration} {classData.durationBase.toLowerCase()} · Live</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line max-w-3xl">
                  {details.overview || apiClass.description}
                </p>
              </section>

              <section className="border-t border-gray-100 pt-10">
                <div className="mb-5">
                  <h2 className="text-lg font-semibold text-gray-900 tracking-tight mb-1">Course structure</h2>
                  <p className="text-sm text-gray-500">
                    {details.curriculumIntro || "Explore the course curriculum and projects"}
                  </p>
                </div>

                {!modules.length ? (
                  <p className="text-sm text-gray-500">The instructor has not added the curriculum yet.</p>
                ) : (
                  <div className="space-y-3">
                    {modules.map((module, index) => (
                      <article key={index} className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
                        <div className="flex items-start gap-3 mb-3">
                          <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-900 text-[11px] font-semibold text-white">
                            {index + 1}
                          </span>
                          <h3 className="text-sm font-semibold text-gray-900 leading-snug">{module.title}</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:pl-9">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Topics</p>
                            <ul className="space-y-1.5">
                              {module.topics.map((topic, i) => (
                                <li key={i} className="text-sm text-gray-600 leading-relaxed flex gap-2">
                                  <span className="text-gray-300 mt-1.5">•</span>
                                  <span>{topic}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Project</p>
                            <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg border border-gray-100 px-3 py-2.5">
                              {module.project}
                            </p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="border-t border-gray-100 pt-10">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-4">Your instructor</p>
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {classData.instructor.image ? (
                      <img src={classData.instructor.image} alt={classData.instructor.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-lg font-semibold text-gray-700">{classData.instructor.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-gray-900">{classData.instructor.name}</h3>
                    <p className="text-xs text-gray-500 mb-2">{classData.instructor.title}</p>
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                      {classData.instructor.bio}
                    </p>
                  </div>
                </div>
              </section>

              <section className="border-t border-gray-100 pt-10">
                <h2 className="text-lg font-semibold text-gray-900 tracking-tight mb-4">Class information</h2>
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">Level</dt>
                    <dd className="text-sm font-medium text-gray-900">{apiClass.level}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">Language</dt>
                    <dd className="text-sm font-medium text-gray-900">{apiClass.language || "TBA"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">Duration</dt>
                    <dd className="text-sm font-medium text-gray-900">{apiClass.duration} min</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">Class size</dt>
                    <dd className="text-sm font-medium text-gray-900">Up to {seatCapacity}</dd>
                  </div>
                </dl>

                {!!apiClass.schedule?.length && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Session schedule</h3>
                    <div className="space-y-2">
                      {apiClass.schedule.map((session) => (
                        <div key={session.id} className="rounded-lg border border-gray-200 px-3.5 py-3">
                          <p className="text-sm font-medium text-gray-900">{session.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {new Date(session.startTime).toLocaleString()} – {new Date(session.endTime).toLocaleTimeString()}
                          </p>
                          {session.description && (
                            <p className="text-sm text-gray-600 mt-2 whitespace-pre-line leading-relaxed">{session.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {!!apiClass.prerequisites?.length && (
                <section className="border-t border-gray-100 pt-10">
                  <h2 className="text-lg font-semibold text-gray-900 tracking-tight mb-2">Prerequisites</h2>
                  <p className="text-sm text-gray-500 mb-4">Before enrolling, make sure you have:</p>
                  <ul className="space-y-2">
                    {(apiClass.prerequisites || []).map((prereq, index) => (
                      <li key={index} className="flex items-start gap-2.5">
                        <CheckCircle2 className="h-4 w-4 text-gray-900 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-700 leading-relaxed">{prereq}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {!!(details.outcomes || apiClass.learningOutcomes)?.length && (
                <section className="border-t border-gray-100 pt-10">
                  <h2 className="text-lg font-semibold text-gray-900 tracking-tight mb-4">
                    By the end of this course
                  </h2>
                  <ol className="space-y-2.5">
                    {(details.outcomes || apiClass.learningOutcomes || []).map((outcome, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-700">
                          {index + 1}
                        </span>
                        <span className="text-sm text-gray-700 leading-relaxed">{outcome}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              <section className="border-t border-gray-100 pt-10">
                <CertificatePreview
                  title={apiClass.title}
                  instructor={apiClass.instructor.name}
                  information={details.certificateInfo || undefined}
                />
              </section>

              <section className="border-t border-gray-100 pt-10">
                <h2 className="text-lg font-semibold text-gray-900 tracking-tight mb-4">Student reviews</h2>
                {reviewError ? (
                  <p className="text-sm text-gray-500">Reviews could not be loaded.</p>
                ) : !reviews.length ? (
                  <p className="text-sm text-gray-500">No student reviews yet.</p>
                ) : (
                  <div className="space-y-3">
                    {reviews.map((review) => (
                      <article key={review.id} className="rounded-xl border border-gray-200 p-4">
                        <div className="flex items-center gap-3 mb-2">
                          {review.userAvatar && (
                            <img src={review.userAvatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                          )}
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900">{review.userName}</h3>
                            <p className="text-xs text-gray-500">
                              {new Date(review.createdAt).toLocaleDateString()} · {review.rating} / 5
                            </p>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{review.comment}</p>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="border-t border-gray-100 pt-10">
                <h2 className="text-lg font-semibold text-gray-900 tracking-tight mb-4">Frequently asked questions</h2>
                {!details.faqs?.length ? (
                  <p className="text-sm text-gray-500">The instructor has not added FAQs yet.</p>
                ) : (
                  <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                    {(details.faqs || []).map((faq, index) => (
                      <div key={index} className="px-4 py-4 bg-white">
                        <h3 className="text-sm font-semibold text-gray-900 mb-1.5">{faq.question}</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">{faq.answer}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <div className="lg:col-span-1" />
          </div>
        </div>

        {/* Related Courses */}
        <div ref={relatedCoursesRef} className="bg-white border-t border-gray-100 py-12">
          <LiveClasses
            title="Related courses"
            subtitle="Continue your learning journey"
            limit={4}
          />
        </div>

        <Footer />
      </div>
    );
}
