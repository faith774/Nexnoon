import { useState, useEffect } from 'react';
import { Camera, Mail, User as UserIcon, Edit2, Save, BookOpen, Users, DollarSign, Award, Clock, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';

import { classService } from '@/lib/api';
import { ENV } from '@/config/env';

const useRealData = !ENV.ENABLE_DEMO_MODE;

export default function Profile() {
  const { user, isAuthenticated, updateProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);

  const currentUser = user;

  const [formData, setFormData] = useState({
    name: currentUser?.name || '',
    email: currentUser?.email || '',
  });

  const [stats, setStats] = useState<{
    activeClasses?: number;
    totalStudents?: number;
    totalEarnings?: string;
    avgRating?: string;
    enrolledClasses?: number;
    completed?: number;
    hoursLearned?: number;
    certificates?: number;
  }>({});


  useEffect(() => {
    if (!useRealData || !isAuthenticated || !user) return;
    const isInstructor = user.role === 'instructor';
    if (isInstructor) {
      classService.getMyClasses({ pageSize: 100 })
        .then((res) => {
          const classes = res.data || [];
          const totalStudents = classes.reduce((sum, c) => sum + (c.enrolledStudents || 0), 0);
          setStats({
            activeClasses: res.pagination?.totalItems ?? classes.length,
            totalStudents,
            totalEarnings: '—',
            avgRating: classes.length ? (classes.reduce((s, c) => s + (c.rating || 0), 0) / classes.length).toFixed(1) + '★' : '—',
          });
        })
        .catch(() => setStats({}));
    } else {
      classService.getUserEnrollments({ pageSize: 100 })
        .then((res) => {
          const enrollments = res.data || [];
          const completed = enrollments.filter((e) => e.status === 'completed').length;
          setStats({
            enrolledClasses: res.pagination?.totalItems ?? enrollments.length,
            completed,
            hoursLearned: undefined,
            certificates: enrollments.filter(e => e.status === 'completed' && e.certificateUrl).length,
          });
        })
        .catch(() => setStats({}));
    }
  }, [useRealData, isAuthenticated, user?.id, user?.role]);

  useEffect(() => {
    if (currentUser && !isEditing) {
      setFormData({ name: currentUser.name || '', email: currentUser.email || '' });
    }
  }, [currentUser?.id, currentUser?.name, currentUser?.email, isEditing]);

  const handleSave = async () => {
    try {
      if (isAuthenticated) {
        await updateProfile({ name: formData.name });
      }
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  const handleLogout = () => {
    if (isAuthenticated) {
      logout();
    }
    navigate('/');
  };

  const isInstructor = currentUser?.role === 'instructor';

  if (useRealData && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header variant="light" />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Sign in to view your profile</h1>
            <p className="text-gray-600 mb-6">You need to be logged in to see your profile and stats.</p>
            <Button onClick={() => navigate('/login')} className="bg-[#889dd1] hover:bg-[#7a8ec2] text-white">
              Sign in
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header variant="light" />
      
      <main className="py-12">
        <div className="w-[90vw] max-w-4xl mx-auto">
          {/* Profile Header */}
          <div className="bg-white border border-gray-200 rounded-xl p-8 mb-8">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="relative">
                <div className={`w-24 h-24 bg-gradient-to-br ${
                  isInstructor ? 'from-[#889dd1] to-[#7a8ec2]' : 'from-[#889dd1] to-gray-400'
                } rounded-full flex items-center justify-center text-white text-3xl font-bold`}>
                  {currentUser?.name.charAt(0).toUpperCase()}
                </div>
                <button className="absolute bottom-0 right-0 p-2 bg-black text-white rounded-full hover:bg-black/90 transition-colors">
                  <Camera className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1">
                {isEditing ? (
                  <div className="space-y-4">
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="text-2xl font-bold"
                      placeholder="Your Name"
                    />
                    <Input
                      value={formData.email}
                      type="email"
                      placeholder="email@example.com"
                      disabled
                    />
                  </div>
                ) : (
                  <>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">{currentUser?.name}</h1>
                    <p className="text-gray-600">{currentUser?.email}</p>
                    <div className="mt-2">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        isInstructor 
                          ? 'bg-[#889dd1]/10 text-[#889dd1]' 
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {isInstructor ? (
                          <>
                            <Users className="h-4 w-4 mr-1" />
                            Nexnoon Expert
                          </>
                        ) : (
                          <>
                            <BookOpen className="h-4 w-4 mr-1" />
                            Student
                          </>
                        )}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div>
                {isEditing ? (
                  <div className="flex gap-2">
                    <Button onClick={handleSave} className="bg-black text-white hover:bg-black/90">
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button onClick={() => setIsEditing(true)} variant="outline">
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Stats Grid - Different for Students vs Nexnoon Experts */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Personal Information</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <UserIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <div className="text-sm text-gray-500">Full Name</div>
                    <div className="font-medium text-gray-900">{currentUser?.name}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <div className="text-sm text-gray-500">Email</div>
                    <div className="font-medium text-gray-900">{currentUser?.email}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  {isInstructor ? (
                    <Users className="h-5 w-5 text-gray-400 mt-0.5" />
                  ) : (
                    <BookOpen className="h-5 w-5 text-gray-400 mt-0.5" />
                  )}
                  <div>
                    <div className="text-sm text-gray-500">Account Type</div>
                    <div className="font-medium text-gray-900">
                      {isInstructor ? 'Nexnoon Expert' : 'Student'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {isInstructor ? (
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Teaching Stats</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#889dd1]/5 rounded-lg p-4 border border-[#889dd1]/20">
                    <div className="text-3xl font-bold text-gray-900 mb-1">{useRealData ? (stats.activeClasses ?? '—') : '5'}</div>
                    <div className="text-sm text-gray-600">Active Classes</div>
                  </div>
                  <div className="bg-[#889dd1]/5 rounded-lg p-4 border border-[#889dd1]/20">
                    <div className="text-3xl font-bold text-gray-900 mb-1">{useRealData ? (stats.totalStudents ?? '—') : '342'}</div>
                    <div className="text-sm text-gray-600">Total Students</div>
                  </div>
                  <div className="bg-[#889dd1]/5 rounded-lg p-4 border border-[#889dd1]/20">
                    <div className="text-3xl font-bold text-gray-900 mb-1">{useRealData ? (stats.totalEarnings ?? '—') : '$8.5K'}</div>
                    <div className="text-sm text-gray-600">Total Earnings</div>
                  </div>
                  <div className="bg-[#889dd1]/5 rounded-lg p-4 border border-[#889dd1]/20">
                    <div className="text-3xl font-bold text-gray-900 mb-1">{useRealData ? (stats.avgRating ?? '—') : '4.9★'}</div>
                    <div className="text-sm text-gray-600">Avg Rating</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Learning Stats</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-3xl font-bold text-gray-900 mb-1">{useRealData ? (stats.enrolledClasses ?? '—') : '2'}</div>
                    <div className="text-sm text-gray-600">Enrolled Classes</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-3xl font-bold text-gray-900 mb-1">{useRealData ? (stats.completed ?? '—') : '1'}</div>
                    <div className="text-sm text-gray-600">Completed</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-3xl font-bold text-gray-900 mb-1">{useRealData ? (stats.hoursLearned ?? '—') : '12'}</div>
                    <div className="text-sm text-gray-600">Hours Learned</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-3xl font-bold text-gray-900 mb-1">{useRealData ? (stats.certificates ?? '—') : '1'}</div>
                    <div className="text-sm text-gray-600">Certificates</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Nexnoon Expert-specific Quick Actions */}
          {isInstructor && (
            <div className="mt-8 bg-gradient-to-br from-[#889dd1]/5 to-white border border-[#889dd1]/20 rounded-xl p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Quick Actions</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <button
                  onClick={() => navigate('/create-class')}
                  className="flex flex-col items-center justify-center p-6 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-all"
                >
                  <Users className="h-8 w-8 text-[#889dd1] mb-2" />
                  <span className="font-medium text-gray-900">Create Class</span>
                </button>
                <button
                  onClick={() => navigate('/my-classes')}
                  className="flex flex-col items-center justify-center p-6 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-all"
                >
                  <BookOpen className="h-8 w-8 text-[#889dd1] mb-2" />
                  <span className="font-medium text-gray-900">My Classes</span>
                </button>
                <button
                  onClick={() => navigate('/instructor/dashboard')}
                  className="flex flex-col items-center justify-center p-6 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-all"
                >
                  <DollarSign className="h-8 w-8 text-[#889dd1] mb-2" />
                  <span className="font-medium text-gray-900">Earnings</span>
                </button>
              </div>
            </div>
          )}

          {/* Settings Links */}
          <div className="mt-8 bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Account Settings</h2>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/my-classes')}
                className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span className="font-medium text-gray-900">
                  {isInstructor ? 'Manage Classes' : 'My Classes'}
                </span>
                <span className="text-gray-400">→</span>
              </button>
              <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-between p-4 bg-red-50 rounded-lg hover:bg-red-100 transition-colors text-red-600"
              >
                <span className="font-medium">Log Out</span>
                <span className="text-red-400">→</span>
              </button>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
      
    </div>
  );
}