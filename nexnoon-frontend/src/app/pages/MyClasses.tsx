import BrandLoader from '@/app/components/BrandLoader';
import { useState, useEffect } from 'react';
import { Play, Clock, CheckCircle, Calendar, Users, TrendingUp, Edit } from 'lucide-react';
import { useNavigate } from 'react-router';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { useAuth } from '@/contexts/AuthContext';
import { classService } from '@/lib/api';
import { ENV } from '@/config/env';
import { classDetailUrl } from '@/lib/url';
import type { Class } from '@/types/api';
import type { Enrollment } from '@/types/api';

type EnrolledCard = {
  id: string | number;
  title: string;
  instructor: string;
  progress: number;
  nextSession: string;
  thumbnail: string;
};

type TeachingCard = {
  id: string | number;
  title: string;
  students: number;
  revenue: string;
  nextSession: string;
  thumbnail: string;
  status: string;
};

type CompletedCard = {
  id: string | number;
  title: string;
  instructor: string;
  completedDate: string;
  certificate: boolean;
  thumbnail: string;
};

type UpcomingCard = {
  id: string | number;
  title: string;
  instructor: string;
  startDate: string;
  startTime: string;
  thumbnail: string;
};

function formatNextSession(c: Class) {
  const session = c.schedule?.find(s => new Date(s.endTime).getTime() > Date.now() && s.status !== 'cancelled');
  return session ? new Date(session.startTime).toLocaleString() : c.startDate ? new Date(c.startDate).toLocaleString() : 'Not scheduled';
}

export default function MyClasses() {
  const [activeTab, setActiveTab] = useState<'enrolled' | 'completed' | 'upcoming'>('enrolled');
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [enrolledClasses, setEnrolledClasses] = useState<EnrolledCard[]>([]);
  const [teachingClasses, setTeachingClasses] = useState<TeachingCard[]>([]);
  const [completedClasses, setCompletedClasses] = useState<CompletedCard[]>([]);
  const [upcomingClasses, setUpcomingClasses] = useState<UpcomingCard[]>([]);

  const isInstructor = user?.role === 'instructor';
  const useRealData = !ENV.ENABLE_DEMO_MODE && isAuthenticated;

  useEffect(() => {
    if (!useRealData) { setEnrolledClasses([]); setTeachingClasses([]); setCompletedClasses([]); setUpcomingClasses([]); return; }

    setLoading(true);
    if (isInstructor) {
      classService
        .getMyClasses({ pageSize: 100 })
        .then((res) => {
          const list = (res.data || []).map((c: Class): TeachingCard => ({
            id: c.id,
            title: c.title,
            students: c.enrolledStudents ?? 0,
            revenue: 'See earnings',
            nextSession: formatNextSession(c),
            thumbnail: c.thumbnail || 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400',
            status: c.status || 'active',
          }));
          setTeachingClasses(list);
          setEnrolledClasses([]);
          setCompletedClasses([]);
          setUpcomingClasses([]);
        })
        .catch(() => {
          setTeachingClasses([]);
          setEnrolledClasses([]);
        })
        .finally(() => setLoading(false));
    } else {
      classService
        .getUserEnrollments({ pageSize: 100 })
        .then(async (res) => {
          const enrollments = res.data || [];
          if (enrollments.length === 0) {
            setEnrolledClasses([]);
            setCompletedClasses([]);
            setUpcomingClasses([]);
            setLoading(false);
            return;
          }
          const classes = await Promise.all(
            enrollments.map((e: Enrollment) =>
              classService.getClass(e.classId).catch(() => null)
            )
          );
          const now = new Date();
          const enrolled: EnrolledCard[] = [];
          const completed: CompletedCard[] = [];
          const upcoming: UpcomingCard[] = [];

          enrollments.forEach((e: Enrollment, i: number) => {
            const c = classes[i];
            if (!c) return;
            const instructorName = typeof c.instructor === 'object' && c.instructor?.name ? c.instructor.name : 'Instructor';
            const thumb = c.thumbnail || 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400';
            const nextSession = formatNextSession(c);
            const startDate = c.startDate ? new Date(c.startDate) : null;

            if (e.status === 'completed') {
              completed.push({
                id: c.id,
                title: c.title,
                instructor: instructorName,
                completedDate: e.completedAt ? new Date(e.completedAt).toLocaleDateString() : '—',
                certificate: !!e.certificateUrl,
                thumbnail: thumb,
              });
            } else if (e.status === 'active') {
              if (startDate && startDate > now) {
                upcoming.push({
                  id: c.id,
                  title: c.title,
                  instructor: instructorName,
                  startDate: c.startDate ? new Date(c.startDate).toLocaleDateString() : '—',
                  startTime: c.schedule?.[0] ? new Date(c.schedule[0].startTime).toLocaleTimeString(undefined, { timeStyle: 'short' }) : '—',
                  thumbnail: thumb,
                });
              } else {
                enrolled.push({
                  id: c.id,
                  title: c.title,
                  instructor: instructorName,
                  progress: e.progress ?? 0,
                  nextSession,
                  thumbnail: thumb,
                });
              }
            }
          });

          setEnrolledClasses(enrolled);
          setCompletedClasses(completed);
          setUpcomingClasses(upcoming);
        })
        .catch(() => {
          setEnrolledClasses([]);
          setCompletedClasses([]);
          setUpcomingClasses([]);
        })
        .finally(() => setLoading(false));
    }
  }, [useRealData, isInstructor, user?.id]);

  const displayEnrolled = enrolledClasses;
  const displayTeaching = teachingClasses;
  const displayCompleted = completedClasses;
  const displayUpcoming = upcomingClasses;

  return (
    <div className="min-h-screen bg-white">
      <Header variant="light" />
      
      <main className="py-12">
        <div className="w-[90vw] mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {user?.role === 'instructor' ? 'My Teaching Classes' : 'My Learning'}
            </h1>
            <p className="text-gray-600">
              {user?.role === 'instructor' 
                ? 'Manage your classes and track student progress' 
                : 'Track your progress and continue learning'}
            </p>
            {!useRealData && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  Sign in to see your classes.
                </p>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 mb-8">
            <nav className="flex gap-8">
              <button
                onClick={() => setActiveTab('enrolled')}
                className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'enrolled'
                    ? 'border-black text-black'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {isInstructor ? `Active (${displayTeaching.length})` : `Enrolled (${displayEnrolled.length})`}
              </button>
              <button
                onClick={() => setActiveTab('upcoming')}
                className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'upcoming'
                    ? 'border-black text-black'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Upcoming ({displayUpcoming.length})
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'completed'
                    ? 'border-black text-black'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Completed ({displayCompleted.length})
              </button>
            </nav>
          </div>

          {loading ? (
            <BrandLoader />
          ) : (
          <>
          {/* Enrolled Classes */}
          {activeTab === 'enrolled' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {(isInstructor ? displayTeaching : displayEnrolled).map((cls) => (
                <div
                  key={cls.id}
                  onClick={() => navigate(`/classroom/${cls.id}`)}
                  className="bg-white border border-gray-300 rounded-lg overflow-hidden hover:shadow-lg hover:border-gray-400 transition-all cursor-pointer group relative"
                >
                  <div className="relative h-48 overflow-hidden">
                    <ImageWithFallback
                      src={cls.thumbnail}
                      alt={cls.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    
                    {/* Edit Button for Nexnoon Experts */}
                    {isInstructor && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/edit-class/${cls.id}`);
                        }}
                        className="absolute top-3 right-3 p-2 bg-white hover:bg-black hover:text-white transition-colors rounded-lg border border-gray-300 shadow-sm"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    )}
                    
                    {/* Play/View Overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <button 
                        onClick={() => navigate(`/classroom/${cls.id}`)}
                        className="p-3 bg-white rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-all transform scale-75 group-hover:scale-100"
                      >
                        {isInstructor ? (
                          <Users className="h-5 w-5 text-black" />
                        ) : (
                          <Play className="h-5 w-5 text-black" fill="black" />
                        )}
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-white">
                    <h3 className="font-bold text-base text-black mb-2 line-clamp-2 min-h-[3rem]">
                      {cls.title}
                    </h3>
                    
                    {!isInstructor && (
                      <p className="text-xs text-gray-600 mb-3">{(cls as any).instructor}</p>
                    )}
                    
                    {isInstructor ? (
                      <>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="bg-black text-white p-2 text-center rounded-lg">
                            <div className="text-lg font-bold">{(cls as any).students}</div>
                            <div className="text-xs">Students</div>
                          </div>
                          <div className="bg-gray-100 border border-gray-300 p-2 text-center rounded-lg">
                            <div className="text-lg font-bold text-black">{(cls as any).revenue}</div>
                            <div className="text-xs text-black">Revenue</div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="text-gray-600 font-medium">Progress</span>
                          <span className="font-bold text-black">{(cls as any).progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-black h-full transition-all rounded-full"
                            style={{ width: `${(cls as any).progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center text-xs text-gray-600 pt-2 border-t border-gray-200">
                      <Calendar className="h-3 w-3 mr-1" />
                      <span className="truncate">Next: {(cls as any).nextSession}</span>
                    </div>
                    
                    {isInstructor && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/students-management');
                        }}
                        className="mt-3 w-full py-2 bg-gray-100 hover:bg-black hover:text-white border border-gray-300 rounded-lg transition-colors text-xs font-bold"
                      >
                        <Users className="h-3 w-3 inline mr-1" />
                        MANAGE STUDENTS
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Upcoming Classes */}
          {activeTab === 'upcoming' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {displayUpcoming.map((cls) => (
                <div
                  key={cls.id}
                  onClick={() => navigate(classDetailUrl(String(cls.id), cls.title))}
                  className="bg-white border border-gray-300 rounded-lg overflow-hidden hover:shadow-lg hover:border-gray-400 transition-all cursor-pointer group"
                >
                  <div className="relative h-48 overflow-hidden">
                    <ImageWithFallback
                      src={cls.thumbnail}
                      alt={cls.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute top-3 left-3 px-3 py-1 bg-white border border-gray-300 rounded-lg shadow-sm">
                      <span className="text-xs font-bold text-black">UPCOMING</span>
                    </div>
                  </div>
                  <div className="p-4 bg-white">
                    <h3 className="font-bold text-base text-black mb-2 line-clamp-2 min-h-[3rem]">
                      {cls.title}
                    </h3>
                    <p className="text-xs text-gray-600 mb-3">{cls.instructor}</p>
                    
                    <div className="bg-gray-100 border border-gray-300 rounded-lg p-2 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Clock className="h-3 w-3" />
                        <span className="text-xs font-bold text-black">STARTS</span>
                      </div>
                      <div className="text-xs text-black font-medium">{cls.startDate}</div>
                      <div className="text-xs text-gray-600">{cls.startTime}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Completed Classes */}
          {activeTab === 'completed' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {displayCompleted.map((cls) => (
                <div
                  key={cls.id}
                  className="bg-white border border-gray-300 rounded-lg overflow-hidden hover:shadow-lg hover:border-gray-400 transition-all group"
                >
                  <div className="relative h-48 overflow-hidden">
                    <ImageWithFallback
                      src={cls.thumbnail}
                      alt={cls.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute top-3 right-3 p-2 bg-black rounded-lg shadow-sm">
                      <CheckCircle className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <div className="p-4 bg-white">
                    <h3 className="font-bold text-base text-black mb-2 line-clamp-2 min-h-[3rem]">
                      {cls.title}
                    </h3>
                    <p className="text-xs text-gray-600 mb-3">{cls.instructor}</p>
                    
                    <div className="mb-3 pb-3 border-b border-gray-200">
                      <div className="text-xs text-gray-600">Completed on</div>
                      <div className="text-xs font-bold text-black">{cls.completedDate}</div>
                    </div>

                    {cls.certificate && (
                      <button 
                        onClick={() => navigate(`/certificate/${cls.id}`)}
                        className="w-full py-2 bg-black text-white hover:bg-gray-800 rounded-lg transition-colors text-xs font-bold"
                      >
                        VIEW CERTIFICATE
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          </>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}