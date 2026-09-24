import { useState, useEffect, useRef } from 'react';
import { TimeZoneSelect } from '@/app/components/TimeZonePicker';
import EmailPreferences from '@/app/components/EmailPreferences';
import { browserTimeZone, rememberViewerTimeZone } from '@/lib/timezone';
import {
  Camera,
  Mail,
  User as UserIcon,
  Edit2,
  Save,
  BookOpen,
  Users,
  DollarSign,
  Link2,
  AlertCircle,
  ArrowUpRight,
  Star,
  Award,
  Clock,
  Globe2,
  Sparkles,
  X,
  Shield,
  LayoutDashboard,
  UserPlus,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { classService, getErrorMessage } from '@/lib/api';
import { ENV } from '@/config/env';

const useRealData = !ENV.ENABLE_DEMO_MODE;
const MAX_AVATAR_BYTES = 180_000;

const fieldClass =
  'w-full h-11 px-3.5 border border-[#d5cfc4] bg-white text-sm text-[#14110e] outline-none transition-colors placeholder:text-[#9a948a] focus:border-[#14110e] disabled:bg-[#f3f0ea] disabled:text-[#6b655c]';
const labelClass = 'block text-[11px] uppercase tracking-[0.14em] text-[#6b655c] mb-1.5 font-medium';

function parseCommaTags(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function statusBadge(status?: string) {
  switch (status) {
    case 'approved':
      return {
        label: 'Approved',
        className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        to: '/instructor/dashboard',
      };
    case 'rejected':
      return {
        label: 'Rejected',
        className: 'bg-rose-50 text-rose-800 border-rose-200',
        to: '/instructor/pending-approval',
      };
    case 'suspended':
      return {
        label: 'Suspended',
        className: 'bg-amber-50 text-amber-900 border-amber-200',
        to: '/instructor/pending-approval',
      };
    case 'pending':
    default:
      return {
        label: 'Pending review',
        className: 'bg-amber-50 text-amber-900 border-amber-200',
        to: '/instructor/pending-approval',
      };
  }
}

export default function Profile() {
  const { user, isAuthenticated, updateProfile, logout } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentUser = user;
  const isAdmin = currentUser?.role === 'admin';
  const isInstructor = currentUser?.role === 'instructor';
  const isLearner = !isAdmin && !isInstructor;

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    headline: '',
    bio: '',
    languages: '',
    expertise: '',
    avatar: '',
    preferredLanguage: '',
    timezone: '',
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
    totalUsers?: number;
    totalInstructors?: number;
    pendingInstructors?: number;
    totalClasses?: number;
  }>({});

  useEffect(() => {
    if (!useRealData || !isAuthenticated || !user) return;
    if (user.role === 'admin') {
      import('@/lib/api/client')
        .then(({ default: apiClient }) => apiClient.get('/data/admin'))
        .then((res) => {
          const summary = res.data?.data?.summary;
          setStats({
            totalUsers: summary?.totalUsers,
            totalInstructors: summary?.totalInstructors,
            pendingInstructors: summary?.pendingInstructors,
            totalClasses: summary?.totalClasses,
          });
        })
        .catch(() => setStats({}));
    } else if (user.role === 'instructor') {
      classService
        .getMyClasses({ pageSize: 100 })
        .then((res) => {
          const classes = res.data || [];
          const totalStudents = classes.reduce((sum, c) => sum + (c.enrolledStudents || 0), 0);
          setStats({
            activeClasses: res.pagination?.totalItems ?? classes.length,
            totalStudents,
            totalEarnings: '—',
            avgRating: classes.length
              ? (classes.reduce((s, c) => s + (c.rating || 0), 0) / classes.length).toFixed(1) + '★'
              : '—',
          });
        })
        .catch(() => setStats({}));
    } else {
      classService
        .getUserEnrollments({ pageSize: 100 })
        .then(async (res) => {
          const enrollments = res.data || [];
          const completed = enrollments.filter((e) => e.status === 'completed').length;
          let hoursLearned: number | undefined;
          try {
            const { default: apiClient } = await import('@/lib/api/client');
            const dash = await apiClient.get('/data/learner');
            hoursLearned = dash.data?.data?.summary?.hoursLearned;
          } catch {
            hoursLearned = undefined;
          }
          setStats({
            enrolledClasses: res.pagination?.totalItems ?? enrollments.length,
            completed,
            hoursLearned,
            certificates: enrollments.filter((e) => e.status === 'completed' && e.certificateUrl)
              .length,
          });
        })
        .catch(() => setStats({}));
    }
  }, [useRealData, isAuthenticated, user?.id, user?.role]);

  useEffect(() => {
    if (currentUser && !isEditing) {
      setFormData({
        name: currentUser.name || '',
        email: currentUser.email || '',
        headline: currentUser.headline || '',
        bio: currentUser.bio || '',
        languages: (currentUser.languages || []).join(', '),
        expertise: (currentUser.expertise || []).join(', '),
        avatar: currentUser.avatar || '',
        preferredLanguage: currentUser.preferredLanguage || '',
        timezone: currentUser.timezone || '',
      });
    }
  }, [
    currentUser?.id,
    currentUser?.name,
    currentUser?.email,
    currentUser?.headline,
    currentUser?.bio,
    currentUser?.languages,
    currentUser?.expertise,
    currentUser?.avatar,
    currentUser?.preferredLanguage,
    currentUser?.timezone,
    isEditing,
  ]);

  const handleAvatarFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError('Image is too large. Use a small image under ~180KB, or paste an image URL.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (dataUrl.length > MAX_AVATAR_BYTES * 1.4) {
        setError('Encoded image is too large. Try a smaller photo or use a URL.');
        return;
      }
      setFormData((prev) => ({ ...prev, avatar: dataUrl }));
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (isAuthenticated) {
        if (isInstructor) {
          await updateProfile({
            name: formData.name,
            headline: formData.headline.trim(),
            bio: formData.bio.trim(),
            languages: parseCommaTags(formData.languages),
            expertise: parseCommaTags(formData.expertise),
            avatar: formData.avatar.trim() || undefined,
            timezone: formData.timezone || undefined,
          });
        } else {
          await updateProfile({
            name: formData.name,
            avatar: formData.avatar.trim() || undefined,
            preferredLanguage: formData.preferredLanguage.trim() || undefined,
            timezone: formData.timezone || undefined,
          });
        }
        if (formData.timezone) rememberViewerTimeZone(formData.timezone);
      }
      setIsEditing(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    if (isAuthenticated) logout();
    navigate('/');
  };

  if (useRealData && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#f3f0ea] flex flex-col">
        <Header variant="light" />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md border border-[#ddd6ca] bg-white/80 px-8 py-12">
            <h1 className="font-serif text-2xl tracking-tight text-[#14110e] mb-2">
              Sign in to view your profile
            </h1>
            <p className="text-sm text-[#6b655c] mb-6">
              You need an account to manage your Nexnoon profile.
            </p>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="h-10 px-5 bg-[#14110e] text-white text-sm hover:bg-black/85"
            >
              Sign in
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const badge = isInstructor ? statusBadge(currentUser?.instructorStatus) : null;
  const avatarSrc = isEditing ? formData.avatar : currentUser?.avatar;
  const profileGaps: string[] = [];
  if (isInstructor && !isEditing) {
    if (!currentUser?.avatar) profileGaps.push('photo');
    if (!currentUser?.headline) profileGaps.push('headline');
    if (!currentUser?.bio) profileGaps.push('bio');
    if (!(currentUser?.languages || []).length) profileGaps.push('languages');
    if (!(currentUser?.expertise || []).length) profileGaps.push('expertise');
  }

  const instructorStats = [
    {
      label: 'Active classes',
      value: useRealData ? (stats.activeClasses ?? '—') : '5',
      icon: BookOpen,
    },
    {
      label: 'Learners',
      value: useRealData ? (stats.totalStudents ?? '—') : '342',
      icon: Users,
    },
    {
      label: 'Earnings',
      value: useRealData ? (stats.totalEarnings ?? '—') : '$8.5K',
      icon: DollarSign,
    },
    {
      label: 'Avg rating',
      value: useRealData ? (stats.avgRating ?? '—') : '4.9★',
      icon: Star,
    },
  ];

  const learnerStats = [
    {
      label: 'Enrolled',
      value: useRealData ? (stats.enrolledClasses ?? '—') : '2',
      icon: BookOpen,
    },
    {
      label: 'Completed',
      value: useRealData ? (stats.completed ?? '—') : '1',
      icon: Award,
    },
    {
      label: 'Hours',
      value: useRealData ? (stats.hoursLearned ?? '—') : '12',
      icon: Clock,
    },
    {
      label: 'Certificates',
      value: useRealData ? (stats.certificates ?? '—') : '1',
      icon: Award,
    },
  ];

  const adminStats = [
    {
      label: 'Users',
      value: useRealData ? (stats.totalUsers ?? '—') : '—',
      icon: Users,
    },
    {
      label: 'Instructors',
      value: useRealData ? (stats.totalInstructors ?? '—') : '—',
      icon: UserPlus,
    },
    {
      label: 'Pending',
      value: useRealData ? (stats.pendingInstructors ?? '—') : '—',
      icon: AlertCircle,
    },
    {
      label: 'Classes',
      value: useRealData ? (stats.totalClasses ?? '—') : '—',
      icon: BookOpen,
    },
  ];

  const roleMeta = isAdmin
    ? {
        eyebrow: 'Platform admin',
        badge: 'Super admin',
        BadgeIcon: Shield,
        statsEyebrow: 'Platform',
        statsTitle: 'Ops overview',
        accent: 'from-[#3a5f8a] via-[#889dd1] to-[#14110e]',
        glow: 'bg-[#889dd1]/15',
        iconTone: 'text-[#3a5f8a]',
      }
    : isInstructor
      ? {
          eyebrow: 'Instructor portfolio',
          badge: 'Instructor',
          BadgeIcon: Users,
          statsEyebrow: 'Studio',
          statsTitle: 'Teaching stats',
          accent: 'from-[#c45c26] via-[#8a6a4a] to-[#3a5f8a]',
          glow: 'bg-[#c45c26]/10',
          iconTone: 'text-[#c45c26]',
        }
      : {
          eyebrow: 'Learner profile',
          badge: 'Learner',
          BadgeIcon: BookOpen,
          statsEyebrow: 'Learning',
          statsTitle: 'Learning stats',
          accent: 'from-[#c45c26] via-[#8a6a4a] to-[#3a5f8a]',
          glow: 'bg-[#c45c26]/10',
          iconTone: 'text-[#c45c26]',
        };

  const displayedStats = isAdmin ? adminStats : isInstructor ? instructorStats : learnerStats;

  return (
    <div className="min-h-screen flex flex-col bg-[#f3f0ea] text-[#14110e]">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_15%_-8%,#e8dcc8_0%,transparent_55%),radial-gradient(ellipse_50%_40%_at_90%_0%,#d9e2ec_0%,transparent_50%),linear-gradient(180deg,#efeae2_0%,#f6f4f0_55%,#efeae2_100%)]" />
      </div>

      <Header variant="light" />

      <main className="flex-1 py-8 md:py-11">
        <div className="w-[min(94vw,920px)] mx-auto space-y-5">
          {/* Hero */}
          <section className="relative overflow-hidden border border-[#ddd6ca]/90 bg-white/80 backdrop-blur-sm">
            <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${roleMeta.accent}`} />
            <div className={`absolute -right-10 -top-10 h-40 w-40 rounded-full ${roleMeta.glow} blur-3xl`} />

            <div className="relative p-6 md:p-8">
              <div className="flex flex-col sm:flex-row sm:items-start gap-5 md:gap-7">
                <div className="relative shrink-0">
                  <div className="h-28 w-28 border border-[#d5cfc4] bg-[#14110e] text-white text-3xl font-serif flex items-center justify-center overflow-hidden">
                    {avatarSrc ? (
                      <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (currentUser?.name || '?').charAt(0).toUpperCase()
                    )}
                  </div>
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className={`absolute -bottom-2 -right-2 h-9 w-9 text-white flex items-center justify-center ${
                        isAdmin ? 'bg-[#3a5f8a] hover:bg-[#2f4f73]' : 'bg-[#c45c26] hover:bg-[#a84c1e]'
                      }`}
                      aria-label="Upload avatar"
                    >
                      <Camera className="h-4 w-4" />
                    </button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleAvatarFile(e.target.files?.[0])}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-[#6b655c] mb-2">
                    {roleMeta.eyebrow}
                  </p>

                  {isEditing ? (
                    <div className="space-y-3 max-w-lg">
                      <div>
                        <label className={labelClass}>Full name</label>
                        <Input
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className={`${fieldClass} !h-12 text-lg font-medium`}
                          placeholder="Your name"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Email</label>
                        <Input value={formData.email} type="email" disabled className={fieldClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Photo URL (optional)</label>
                        <Input
                          value={formData.avatar}
                          onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                          className={fieldClass}
                          placeholder="https://… or upload with the camera"
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <h1 className="font-serif text-3xl md:text-4xl tracking-tight leading-tight">
                        {currentUser?.name}
                      </h1>
                      {isInstructor && currentUser?.headline ? (
                        <p className="mt-1.5 text-[#c45c26] font-medium">{currentUser.headline}</p>
                      ) : null}
                      <p className="mt-1.5 text-sm text-[#6b655c] flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        {currentUser?.email}
                      </p>
                    </>
                  )}

                  {!isEditing && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 border border-[#d5cfc4] bg-[#faf8f5] px-2.5 py-1 text-xs font-medium text-[#3d3933]">
                        <roleMeta.BadgeIcon className={`h-3.5 w-3.5 ${roleMeta.iconTone}`} />
                        {roleMeta.badge}
                      </span>
                      {badge && (
                        <Link
                          to={badge.to}
                          className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs font-medium ${badge.className}`}
                        >
                          <AlertCircle className="h-3.5 w-3.5" />
                          {badge.label}
                          <ArrowUpRight className="h-3 w-3 opacity-70" />
                        </Link>
                      )}
                      {isInstructor && currentUser?.instructorStatus === 'approved' && (
                        <Link
                          to={`/instructors/${currentUser.id}`}
                          className="inline-flex items-center gap-1.5 border border-[#d5cfc4] bg-white px-2.5 py-1 text-xs font-medium text-[#3d3933] hover:border-[#14110e]"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          Public profile
                        </Link>
                      )}
                      {isAdmin && (
                        <Link
                          to="/admin/dashboard"
                          className="inline-flex items-center gap-1.5 border border-[#d5cfc4] bg-white px-2.5 py-1 text-xs font-medium text-[#3d3933] hover:border-[#14110e]"
                        >
                          <LayoutDashboard className="h-3.5 w-3.5" />
                          Admin console
                        </Link>
                      )}
                    </div>
                  )}
                </div>

                <div className="sm:ml-auto shrink-0 flex flex-wrap gap-2">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={saving}
                        className="h-10 px-4 inline-flex items-center gap-2 bg-[#14110e] text-white text-sm hover:bg-black/85 disabled:opacity-50"
                      >
                        <Save className="h-4 w-4" />
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditing(false);
                          setError(null);
                        }}
                        className="h-10 px-4 inline-flex items-center gap-2 border border-[#d5cfc4] bg-white text-sm hover:border-[#14110e]"
                      >
                        <X className="h-4 w-4" />
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="h-10 px-4 inline-flex items-center gap-2 border border-[#d5cfc4] bg-white text-sm hover:border-[#14110e]"
                    >
                      <Edit2 className="h-4 w-4" />
                      Edit profile
                    </button>
                  )}
                </div>
              </div>

              {error && (
                <p className="mt-4 text-sm text-rose-700 border border-rose-200 bg-rose-50 px-3 py-2">
                  {error}
                </p>
              )}

              {profileGaps.length > 0 && (
                <div className="mt-5 flex items-start gap-3 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Complete your teaching portfolio</p>
                    <p className="text-amber-900/80 mt-0.5">
                      Still missing: {profileGaps.join(', ')}. Learners see this on class pages.
                    </p>
                    {currentUser?.instructorStatus !== 'approved' && (
                      <button
                        type="button"
                        onClick={() => navigate('/instructor/application')}
                        className="mt-2 mr-4 text-xs font-medium underline underline-offset-2"
                      >
                        Open teaching application
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="mt-2 text-xs font-medium underline underline-offset-2"
                    >
                      Finish profile
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {isLearner && isEditing && (
            <section className="border border-[#ddd6ca]/90 bg-white/85 p-6 md:p-7 space-y-5">
              <div>
                <h2 className="font-serif text-xl tracking-tight">Learning preferences</h2>
                <p className="text-sm text-[#6b655c] mt-1">
                  Used to recommend language and schedule — never locks you to a location.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Preferred language</label>
                  <Input
                    value={formData.preferredLanguage}
                    onChange={(e) =>
                      setFormData({ ...formData, preferredLanguage: e.target.value })
                    }
                    className={fieldClass}
                    placeholder="e.g. English"
                  />
                </div>
                <div>
                  <label className={labelClass}>Time zone</label>
                  <TimeZoneSelect
                    value={formData.timezone || browserTimeZone()}
                    onChange={(tz) => setFormData({ ...formData, timezone: tz })}
                    className={fieldClass}
                  />
                  <p className="mt-1.5 text-xs text-[#6b655c]">Class times and reminder emails use this zone.</p>
                </div>
              </div>
            </section>
          )}

          {isInstructor && isEditing && (
            <section className="border border-[#ddd6ca]/90 bg-white/85 p-6 md:p-7 space-y-3">
              <div>
                <h2 className="font-serif text-xl tracking-tight">Time zone</h2>
                <p className="text-sm text-[#6b655c] mt-1">
                  New classes are scheduled in this zone by default, and your schedule and reminder emails use it.
                </p>
              </div>
              <TimeZoneSelect
                value={formData.timezone || browserTimeZone()}
                onChange={(tz) => setFormData({ ...formData, timezone: tz })}
                className={fieldClass}
              />
            </section>
          )}

          {isAuthenticated && (isLearner || isInstructor) && <EmailPreferences teaching={isInstructor} />}

          {isInstructor && isEditing && (
            <section className="border border-[#ddd6ca]/90 bg-white/85 p-6 md:p-7 space-y-5">
              <div>
                <h2 className="font-serif text-xl tracking-tight">Teaching portfolio</h2>
                <p className="text-sm text-[#6b655c] mt-1">
                  This is what learners and leads see when you’re on a class.
                </p>
              </div>
              <div>
                <label className={labelClass}>Headline</label>
                <Input
                  value={formData.headline}
                  onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                  className={fieldClass}
                  placeholder="e.g. Product designer & live critique coach"
                  maxLength={160}
                />
              </div>
              <div>
                <label className={labelClass}>Biography</label>
                <Textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Tell learners about your background and teaching style…"
                  rows={5}
                  className={`${fieldClass} !h-auto py-3 min-h-[120px] resize-y`}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Languages</label>
                  <Input
                    value={formData.languages}
                    onChange={(e) => setFormData({ ...formData, languages: e.target.value })}
                    className={fieldClass}
                    placeholder="English, Spanish, French"
                  />
                  <p className="text-[11px] text-[#8a847a] mt-1.5">Comma-separated</p>
                </div>
                <div>
                  <label className={labelClass}>Expertise</label>
                  <Input
                    value={formData.expertise}
                    onChange={(e) => setFormData({ ...formData, expertise: e.target.value })}
                    className={fieldClass}
                    placeholder="UX design, Figma, Product strategy"
                  />
                  <p className="text-[11px] text-[#8a847a] mt-1.5">Comma-separated</p>
                </div>
              </div>
            </section>
          )}

          {isInstructor &&
            !isEditing &&
            (currentUser?.bio ||
              (currentUser?.languages || []).length > 0 ||
              (currentUser?.expertise || []).length > 0) && (
              <section className="border border-[#ddd6ca]/90 bg-white/85 p-6 md:p-7 space-y-5">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[#6b655c]">About</p>
                  <h2 className="font-serif text-xl tracking-tight mt-1">Teaching story</h2>
                </div>
                {currentUser?.bio && (
                  <p className="text-[#3d3933] leading-relaxed whitespace-pre-line text-[15px]">
                    {currentUser.bio}
                  </p>
                )}
                {(currentUser?.languages || []).length > 0 && (
                  <div>
                    <p className={`${labelClass} inline-flex items-center gap-1.5`}>
                      <Globe2 className="h-3.5 w-3.5" />
                      Languages
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {currentUser!.languages!.map((lang) => (
                        <span
                          key={lang}
                          className="border border-[#d5cfc4] bg-[#faf8f5] px-2.5 py-1 text-sm text-[#3d3933]"
                        >
                          {lang}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {(currentUser?.expertise || []).length > 0 && (
                  <div>
                    <p className={`${labelClass} inline-flex items-center gap-1.5`}>
                      <Sparkles className="h-3.5 w-3.5" />
                      Expertise
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {currentUser!.expertise!.map((tag) => (
                        <span
                          key={tag}
                          className="border border-[#e8dcc8] bg-[#faf8f5] px-2.5 py-1 text-sm text-[#c45c26]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

          {/* Stats + account */}
          <div className="grid md:grid-cols-5 gap-5">
            <section className="md:col-span-3 border border-[#ddd6ca]/90 bg-white/85 p-6">
              <div className="flex items-end justify-between gap-3 mb-5">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[#6b655c]">
                    {roleMeta.statsEyebrow}
                  </p>
                  <h2 className="font-serif text-xl tracking-tight mt-1">
                    {roleMeta.statsTitle}
                  </h2>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {displayedStats.map((s) => (
                  <div
                    key={s.label}
                    className="border border-[#eee9e0] bg-[#faf8f5]/70 px-4 py-4"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-[#8a847a] mb-2">
                      <s.icon className={`h-3.5 w-3.5 ${roleMeta.iconTone}`} />
                      {s.label}
                    </div>
                    <p className="font-serif text-2xl tracking-tight tabular-nums">{s.value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="md:col-span-2 border border-[#ddd6ca]/90 bg-white/85 p-6">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#6b655c]">Account</p>
              <h2 className="font-serif text-xl tracking-tight mt-1 mb-5">Details</h2>
              <dl className="space-y-4">
                <div className="flex gap-3">
                  <UserIcon className="h-4 w-4 text-[#8a847a] mt-0.5 shrink-0" />
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.12em] text-[#8a847a]">Name</dt>
                    <dd className="text-sm font-medium mt-0.5">{currentUser?.name}</dd>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Mail className="h-4 w-4 text-[#8a847a] mt-0.5 shrink-0" />
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.12em] text-[#8a847a]">Email</dt>
                    <dd className="text-sm font-medium mt-0.5 break-all">{currentUser?.email}</dd>
                  </div>
                </div>
                <div className="flex gap-3">
                  {isAdmin ? (
                    <Shield className="h-4 w-4 text-[#8a847a] mt-0.5 shrink-0" />
                  ) : isInstructor ? (
                    <Users className="h-4 w-4 text-[#8a847a] mt-0.5 shrink-0" />
                  ) : (
                    <BookOpen className="h-4 w-4 text-[#8a847a] mt-0.5 shrink-0" />
                  )}
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.12em] text-[#8a847a]">Role</dt>
                    <dd className="text-sm font-medium mt-0.5">
                      {isAdmin ? 'Super admin' : isInstructor ? 'Instructor' : 'Learner'}
                    </dd>
                  </div>
                </div>
              </dl>
            </section>
          </div>

          {/* Quick actions */}
          {isAdmin && (
            <section className="border border-[#ddd6ca]/90 bg-white/85 p-6">
              <div className="mb-5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#6b655c]">Shortcuts</p>
                <h2 className="font-serif text-xl tracking-tight mt-1">Platform controls</h2>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  {
                    label: 'Admin dashboard',
                    hint: 'Monitor users, classes, activity',
                    icon: LayoutDashboard,
                    onClick: () => navigate('/admin/dashboard'),
                  },
                  {
                    label: 'Instructor review',
                    hint: 'Approve or suspend tutors',
                    icon: UserPlus,
                    onClick: () => navigate('/admin/dashboard'),
                  },
                  {
                    label: 'Account settings',
                    hint: 'Name, password, security',
                    icon: Shield,
                    onClick: () => navigate('/settings'),
                  },
                ].map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={a.onClick}
                    className="group text-left border border-[#eee9e0] bg-[#faf8f5]/50 p-4 hover:border-[#889dd1]/60 hover:bg-white transition-colors"
                  >
                    <a.icon className="h-5 w-5 text-[#3a5f8a] mb-3" />
                    <p className="font-medium text-[#14110e] group-hover:underline underline-offset-2">
                      {a.label}
                    </p>
                    <p className="text-xs text-[#6b655c] mt-1">{a.hint}</p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {isInstructor && (
            <section className="border border-[#ddd6ca]/90 bg-white/85 p-6">
              <div className="mb-5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#6b655c]">Shortcuts</p>
                <h2 className="font-serif text-xl tracking-tight mt-1">Quick actions</h2>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  {
                    label: 'Create class',
                    hint: 'Start a new live cohort',
                    icon: Users,
                    onClick: () =>
                      navigate(
                        currentUser?.instructorStatus === 'approved'
                          ? '/create-class'
                          : '/instructor/pending-approval'
                      ),
                  },
                  {
                    label: 'My classes',
                    hint: 'Lead & support roster',
                    icon: BookOpen,
                    onClick: () => navigate('/my-classes'),
                  },
                  {
                    label: 'Instructor studio',
                    hint: 'Dashboard & earnings',
                    icon: DollarSign,
                    onClick: () =>
                      navigate(
                        currentUser?.instructorStatus === 'approved'
                          ? '/instructor/dashboard'
                          : '/instructor/pending-approval'
                      ),
                  },
                ].map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={a.onClick}
                    className="group text-left border border-[#eee9e0] bg-[#faf8f5]/50 p-4 hover:border-[#c45c26]/50 hover:bg-white transition-colors"
                  >
                    <a.icon className="h-5 w-5 text-[#c45c26] mb-3" />
                    <p className="font-medium text-[#14110e] group-hover:underline underline-offset-2">
                      {a.label}
                    </p>
                    <p className="text-xs text-[#6b655c] mt-1">{a.hint}</p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {isLearner && (
            <section className="border border-[#ddd6ca]/90 bg-white/85 p-6">
              <div className="mb-5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#6b655c]">Shortcuts</p>
                <h2 className="font-serif text-xl tracking-tight mt-1">Continue learning</h2>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/my-classes')}
                  className="group text-left border border-[#eee9e0] bg-[#faf8f5]/50 p-4 hover:border-[#c45c26]/50 transition-colors"
                >
                  <BookOpen className="h-5 w-5 text-[#c45c26] mb-3" />
                  <p className="font-medium group-hover:underline underline-offset-2">My classes</p>
                  <p className="text-xs text-[#6b655c] mt-1">Sessions, assignments, progress</p>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/browse')}
                  className="group text-left border border-[#eee9e0] bg-[#faf8f5]/50 p-4 hover:border-[#c45c26]/50 transition-colors"
                >
                  <Sparkles className="h-5 w-5 text-[#c45c26] mb-3" />
                  <p className="font-medium group-hover:underline underline-offset-2">
                    Browse classes
                  </p>
                  <p className="text-xs text-[#6b655c] mt-1">Find your next live cohort</p>
                </button>
              </div>
            </section>
          )}

          {/* Settings */}
          <section className="border border-[#ddd6ca]/90 bg-white/85 p-6">
            <div className="mb-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#6b655c]">Settings</p>
              <h2 className="font-serif text-xl tracking-tight mt-1">Account</h2>
            </div>
            <div className="divide-y divide-[#eee9e0] border border-[#eee9e0]">
              <button
                type="button"
                onClick={() =>
                  navigate(
                    isAdmin
                      ? '/admin/dashboard'
                      : isInstructor
                        ? '/my-classes'
                        : '/my-classes'
                  )
                }
                className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-[#faf8f5] transition-colors"
              >
                <span className="text-sm font-medium">
                  {isAdmin
                    ? 'Admin dashboard'
                    : isInstructor
                      ? 'Manage classes'
                      : 'My classes'}
                </span>
                <ArrowUpRight className="h-4 w-4 text-[#8a847a]" />
              </button>
              <button
                type="button"
                onClick={() => navigate('/settings')}
                className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-[#faf8f5] transition-colors"
              >
                <span className="text-sm font-medium">Preferences</span>
                <ArrowUpRight className="h-4 w-4 text-[#8a847a]" />
              </button>
              <button
                type="button"
                onClick={() => navigate('/change-password')}
                className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-[#faf8f5] transition-colors"
              >
                <span className="text-sm font-medium">Change password</span>
                <ArrowUpRight className="h-4 w-4 text-[#8a847a]" />
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-between px-4 py-3.5 text-left text-rose-700 hover:bg-rose-50 transition-colors"
              >
                <span className="text-sm font-medium">Log out</span>
                <ArrowUpRight className="h-4 w-4 opacity-60" />
              </button>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
