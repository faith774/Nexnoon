import ClassDetailsEditor from '@/app/components/ClassDetailsEditor';
import PriceHint, { priceRangeMessage } from '@/app/components/PriceHint';
import type { ClassDetails } from '@/types/api';
import { useState, useEffect } from 'react';
import { ArrowLeft, Upload, Plus, X, Calendar, Clock, DollarSign, Users, BookOpen, Video, FileText } from 'lucide-react';
import { useNavigate } from 'react-router';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import { Input } from '@/app/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { classService, courseService, getErrorMessage, uploadFile } from '@/lib/api';
import { useBackendData } from '@/hooks/useBackendData';
import { ENV } from '@/config/env';
import { toast } from 'sonner';
import type { Course, CreateClassRequest } from '@/types/api';
import { TimeZoneSelect } from '@/app/components/TimeZonePicker';
import { LocalTimeHint } from '@/app/components/SessionScheduleEditor';
import { browserTimeZone, isValidTimeZone, tzLabel, zonedInputToIso } from '@/lib/timezone';

export default function CreateClass() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [details, setDetails] = useState<ClassDetails>({});
  const [pendingPreviewVideo, setPendingPreviewVideo] = useState<File | null>(null);
  const [pendingInvites, setPendingInvites] = useState<
    { email: string; fullName?: string; id?: string }[]
  >([]);
  const platformSettings = useBackendData<{ maxClassSeats: number }>('/settings/platform', true);
  const platformSeats = platformSettings.data?.maxClassSeats ?? 25;
  const [catalog, setCatalog] = useState<Course[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate('/login', { replace: true, state: { from: { pathname: '/create-class' } } });
      return;
    }
    if (user.role === 'admin') return;
    if (user.role !== 'instructor' || user.instructorStatus !== 'approved') {
      navigate('/instructor/pending-approval', { replace: true });
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  useEffect(() => {
    courseService
      .list()
      .then((courses) => {
        const published = courses.filter((c) => c.status === 'published');
        const approved = user?.approvedCourseIds || [];
        if (user?.role === 'instructor' && approved.length > 0) {
          setCatalog(published.filter((c) => approved.includes(c.id)));
        } else {
          setCatalog(published);
        }
      })
      .catch(() => setCatalog([]));
  }, [user?.approvedCourseIds, user?.role]);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    price: '',
    duration: '',
    language: 'English',
    courseId: '',
    languageOfferingId: '',
    level: 'beginner',
    startDate: '',
    startTime: '',
    timezone: isValidTimeZone(user?.timezone) ? user!.timezone! : browserTimeZone(),
    sessionFrequency: 'weekly',
    totalSessions: '',
    learningOutcomes: [''],
    prerequisites: [''],
    materials: [''],
  });

  const [thumbnail, setThumbnail] = useState<string | null>(null);

  const categories = [
    'Development',
    'Design',
    'Marketing',
    'Business',
    'Photography',
    'Music',
    'Health & Wellness',
    'Languages',
    'Data Science',
    'Personal Development',
  ];

  const handleInputChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleArrayAdd = (field: 'learningOutcomes' | 'prerequisites' | 'materials') => {
    setFormData({ ...formData, [field]: [...formData[field], ''] });
  };

  const handleArrayRemove = (field: 'learningOutcomes' | 'prerequisites' | 'materials', index: number) => {
    const newArray = formData[field].filter((_, i) => i !== index);
    setFormData({ ...formData, [field]: newArray });
  };

  const handleArrayChange = (field: 'learningOutcomes' | 'prerequisites' | 'materials', index: number, value: string) => {
    const newArray = [...formData[field]];
    newArray[index] = value;
    setFormData({ ...formData, [field]: newArray });
  };

  const handleThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnail(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  function buildSchedule(): CreateClassRequest['schedule'] {
    const totalSessions = Math.max(1, parseInt(String(formData.totalSessions), 10) || 1);
    const durationMin = Math.max(30, parseInt(String(formData.duration), 10) || 60);
    const startDate = formData.startDate || new Date().toISOString().slice(0, 10);
    const startTime = formData.startTime || '10:00';
    const daysBetween =
      formData.sessionFrequency === 'daily'
        ? 1
        : formData.sessionFrequency === 'biweekly'
          ? 14
          : formData.sessionFrequency === 'monthly'
            ? 30
            : 7;

    const schedule: NonNullable<CreateClassRequest['schedule']> = [];
    const [y, m, d] = startDate.split('-').map(Number);
    for (let i = 1; i <= totalSessions; i++) {
      // Step the calendar date, then resolve that wall-clock time in the class zone (keeps the hour across DST).
      const day = new Date(Date.UTC(y, m - 1, d + (i - 1) * daysBetween)).toISOString().slice(0, 10);
      const sessionStart = new Date(zonedInputToIso(`${day}T${startTime}`, formData.timezone) || `${day}T${startTime}Z`);
      const sessionEnd = new Date(sessionStart.getTime() + durationMin * 60 * 1000);
      schedule.push({
        sessionNumber: i,
        title: `Session ${i}: ${formData.title}`.slice(0, 80),
        description: formData.learningOutcomes[0] || undefined,
        startTime: sessionStart.toISOString(),
        endTime: sessionEnd.toISOString(),
      });
    }
    return schedule;
  }

  const handleSubmit = async () => {
    if (!formData.title?.trim() || !formData.description?.trim() || !formData.category) {
      toast.error('Please fill in title, description, and category.');
      return;
    }
    const price = parseFloat(String(formData.price));
    if (Number.isNaN(price) || price < 0) {
      toast.error('Please enter a valid price.');
      return;
    }
    const rangeError = priceRangeMessage(catalog.find((c) => c.id === formData.courseId), price);
    if (rangeError) {
      toast.error(rangeError);
      return;
    }
    const duration = parseInt(String(formData.duration), 10) || 60;
    const totalSessions = Math.max(1, parseInt(String(formData.totalSessions), 10) || 1);
    const levelMap = {
      beginner: 'Beginner' as const,
      intermediate: 'Intermediate' as const,
      advanced: 'Advanced' as const,
      all: 'Beginner' as const,
    };
    const level = levelMap[formData.level as keyof typeof levelMap] ?? 'Beginner';

    const payload: CreateClassRequest = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      details,
      category: formData.category,
      level,
      price,
      duration,
      totalSessions,
      startDate: formData.startDate ? new Date(formData.startDate).toISOString() : undefined,
      timezone: formData.timezone,
      schedule: buildSchedule(),
      thumbnail: thumbnail || undefined,
      language: formData.language,
      courseId: formData.courseId || undefined,
      languageOfferingId: formData.languageOfferingId || undefined,
      learningOutcomes: formData.learningOutcomes.filter(Boolean),
      prerequisites: formData.prerequisites.filter(Boolean),
      materials: formData.materials.filter(Boolean),
      status: 'published',
    };

    if (ENV.ENABLE_DEMO_MODE && !localStorage.getItem('authToken')) {
      toast.info('Demo mode: sign in as an instructor to create real classes.');
      navigate('/my-classes');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    try {
      const created = await classService.createClass(payload);
      if (pendingInvites.length && created?.id) {
        for (const invite of pendingInvites) {
          try {
            await classService.inviteInstructor(created.id, invite.email);
          } catch (inviteErr) {
            toast.error(
              `Class created, but invite to ${invite.fullName || invite.email} failed: ${getErrorMessage(inviteErr)}`
            );
          }
        }
      }
      if (pendingPreviewVideo && created?.id) {
        try {
          const uploaded = await uploadFile(`/classes/${created.id}/uploads`, pendingPreviewVideo);
          await classService.updateClass(created.id, {
            details: { ...details, previewVideoUrl: uploaded.url },
          });
        } catch (uploadErr) {
          toast.error(`Class created, but preview video upload failed: ${getErrorMessage(uploadErr)}`);
          navigate('/my-classes');
          return;
        }
      }
      if (price === 0 && user?.role !== 'admin') {
        toast.info('Class saved as a draft. Free classes go live once Nexnoon approves them — we’ll notify you.');
      } else {
        toast.success('Class created successfully. Live sessions will have Zoom links when configured.');
      }
      navigate('/my-classes');
    } catch (err) {
      const msg = getErrorMessage(err);
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { number: 1, title: 'Basic Info', description: 'Class title and description' },
    { number: 2, title: 'Details', description: 'Category, price, and schedule' },
    { number: 3, title: 'Content', description: 'Learning outcomes and materials' },
    { number: 4, title: 'Review', description: 'Review and publish' },
  ];

  const fieldClass =
    'w-full h-11 px-3.5 border border-[#d5cfc4] bg-white text-sm text-[#14110e] outline-none transition-colors placeholder:text-[#9a948a] focus:border-[#14110e] focus:ring-1 focus:ring-[#14110e]/15 disabled:bg-[#f3f0ea] disabled:text-[#6b655c]';
  const labelClass =
    'block text-[11px] uppercase tracking-[0.14em] text-[#6b655c] mb-2 font-medium';
  const sectionTitleClass = 'font-serif text-lg tracking-tight text-[#14110e]';

  const schedulePreview = (() => {
    const total = Math.max(0, parseInt(String(formData.totalSessions), 10) || 0);
    const mins = parseInt(String(formData.duration), 10) || 0;
    if (!total || !mins || !formData.startDate) return null;
    const freq =
      formData.sessionFrequency === 'daily'
        ? 'daily'
        : formData.sessionFrequency === 'biweekly'
          ? 'every 2 weeks'
          : formData.sessionFrequency === 'monthly'
            ? 'monthly'
            : 'weekly';
    return `${total} session${total === 1 ? '' : 's'} · ${mins} min · ${freq} from ${formData.startDate}${
      formData.startTime ? ` at ${formData.startTime} ${tzLabel(formData.timezone)}` : ''
    }`;
  })();

  return (
    <div className="min-h-screen flex flex-col bg-[#f3f0ea] text-[#14110e]">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_12%_-8%,#e8dcc8_0%,transparent_55%),linear-gradient(180deg,#efeae2_0%,#f6f4f0_55%,#efeae2_100%)]" />
      </div>

      <Header variant="light" />

      <main className="flex-1 py-8 md:py-11">
        <div className="w-[min(94vw,920px)] mx-auto">
          <div className="mb-8">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 text-sm text-[#6b655c] hover:text-[#14110e] mb-4 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#6b655c] mb-2">
              Instructor studio
            </p>
            <h1 className="font-serif text-3xl md:text-4xl tracking-tight leading-tight">
              Create a live class
            </h1>
            <p className="text-[#5c5348] mt-2 max-w-xl text-sm leading-relaxed">
              Set the offering, schedule, and content. Learners enroll in this class — seats are capped
              by the platform.
            </p>
          </div>

          {/* Steps */}
          <nav className="mb-8 border border-[#ddd6ca]/90 bg-white/80 backdrop-blur-sm p-4 md:p-5">
            <ol className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {steps.map((step) => {
                const active = currentStep === step.number;
                const done = currentStep > step.number;
                return (
                  <li key={step.number}>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(step.number)}
                      className={`w-full text-left px-3 py-3 border transition-colors ${
                        active
                          ? 'border-[#14110e] bg-[#14110e] text-white'
                          : done
                            ? 'border-[#c45c26]/40 bg-[#faf8f5] text-[#14110e]'
                            : 'border-[#eee9e0] bg-white text-[#6b655c] hover:border-[#d5cfc4]'
                      }`}
                    >
                      <span className="text-[10px] uppercase tracking-[0.16em] opacity-70">
                        Step {step.number}
                      </span>
                      <p className="font-medium text-sm mt-1">{step.title}</p>
                      <p className={`text-[11px] mt-0.5 ${active ? 'text-white/70' : 'text-[#8a847a]'}`}>
                        {step.description}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="border border-[#ddd6ca]/90 bg-white/85 backdrop-blur-sm">
            {/* Step 1 */}
            {currentStep === 1 && (
              <div className="p-6 md:p-8 space-y-7">
                <div>
                  <h2 className={sectionTitleClass}>Basic info</h2>
                  <p className="text-sm text-[#6b655c] mt-1">
                    Link to an official course, then set the live cohort details.
                  </p>
                </div>

                {catalog.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Official course</label>
                      <select
                        className={fieldClass}
                        value={formData.courseId}
                        onChange={(e) => {
                          const courseId = e.target.value;
                          const course = catalog.find((c) => c.id === courseId);
                          setFormData((prev) => ({
                            ...prev,
                            courseId,
                            languageOfferingId: '',
                            language: prev.language,
                            category: course?.category || prev.category,
                            title: prev.title || course?.title || '',
                            description: prev.description || course?.description || '',
                          }));
                        }}
                      >
                        <option value="">Select a course…</option>
                        {catalog.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Language offering</label>
                      <select
                        className={fieldClass}
                        value={formData.languageOfferingId}
                        disabled={!formData.courseId}
                        onChange={(e) => {
                          const languageOfferingId = e.target.value;
                          const course = catalog.find((c) => c.id === formData.courseId);
                          const offering = course?.languageOfferings?.find(
                            (o) => o.id === languageOfferingId
                          );
                          setFormData((prev) => ({
                            ...prev,
                            languageOfferingId,
                            language: offering?.label || prev.language,
                          }));
                        }}
                      >
                        <option value="">Select language…</option>
                        {(
                          catalog.find((c) => c.id === formData.courseId)?.languageOfferings || []
                        )
                          .filter((o) => o.status !== 'inactive')
                          .map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.label}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[#8a847a] border border-dashed border-[#ddd6ca] bg-[#faf8f5] px-4 py-3">
                    No published courses yet — create a free-standing class, or ask an admin to publish
                    a course and certify you to teach it.
                  </p>
                )}

                <div>
                  <label className={labelClass}>Class title *</label>
                  <Input
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="e.g., Advanced React Patterns"
                    className={`${fieldClass} !h-12 text-base font-medium`}
                  />
                </div>

                <div>
                  <label className={labelClass}>Description *</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="What will learners get from joining this live class?"
                    rows={5}
                    className={`${fieldClass} !h-auto py-3 resize-y min-h-[8rem]`}
                  />
                </div>

                <div>
                  <label className={labelClass}>Thumbnail</label>
                  <div className="border border-dashed border-[#d5cfc4] bg-[#faf8f5]/80 p-6 text-center hover:border-[#c45c26]/50 transition-colors">
                    {thumbnail ? (
                      <div className="relative inline-block max-w-full">
                        <img
                          src={thumbnail}
                          alt="Thumbnail preview"
                          className="max-h-56 mx-auto object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setThumbnail(null)}
                          className="absolute top-2 right-2 p-1.5 bg-[#14110e] text-white hover:bg-black/80"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block">
                        <Upload className="h-8 w-8 text-[#c45c26] mx-auto mb-3" />
                        <p className="text-sm text-[#3d3933] mb-1">Upload a cover image</p>
                        <p className="text-xs text-[#8a847a]">PNG or JPG · landscape works best</p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleThumbnailUpload}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2 — Details (polished) */}
            {currentStep === 2 && (
              <div className="p-6 md:p-8 space-y-8">
                <div>
                  <h2 className={sectionTitleClass}>Class details</h2>
                  <p className="text-sm text-[#6b655c] mt-1">
                    Who it’s for, what it costs, and when live sessions run.
                  </p>
                </div>

                {/* Offering */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#eee9e0]">
                    <BookOpen className="h-4 w-4 text-[#c45c26]" />
                    <h3 className="text-sm font-medium text-[#14110e]">Offering</h3>
                  </div>
                  <div className="grid md:grid-cols-2 gap-5">
                    <div>
                      <label className={labelClass}>Category *</label>
                      <select
                        value={formData.category}
                        onChange={(e) => handleInputChange('category', e.target.value)}
                        className={fieldClass}
                      >
                        <option value="">Select a category</option>
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Level *</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            ['beginner', 'Beginner'],
                            ['intermediate', 'Intermediate'],
                            ['advanced', 'Advanced'],
                            ['all', 'All levels'],
                          ] as const
                        ).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => handleInputChange('level', value)}
                            className={`h-11 px-3 text-sm border transition-colors ${
                              formData.level === value
                                ? 'border-[#14110e] bg-[#14110e] text-white'
                                : 'border-[#d5cfc4] bg-white text-[#3d3933] hover:border-[#14110e]/40'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Pricing */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#eee9e0]">
                    <DollarSign className="h-4 w-4 text-[#c45c26]" />
                    <h3 className="text-sm font-medium text-[#14110e]">Pricing & capacity</h3>
                  </div>
                  <div className="grid md:grid-cols-2 gap-5">
                    <div>
                      <label className={labelClass}>Price per learner (USD) *</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[#8a847a]">
                          $
                        </span>
                        <Input
                          type="number"
                          min={0}
                          step="1"
                          value={formData.price}
                          onChange={(e) => handleInputChange('price', e.target.value)}
                          placeholder="99"
                          className={`${fieldClass} !pl-8`}
                        />
                      </div>
                      <PriceHint course={catalog.find((c) => c.id === formData.courseId)} price={formData.price} />
                    </div>
                    <div>
                      <label className={labelClass}>
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          Max learners
                        </span>
                      </label>
                      <div className="h-11 px-3.5 border border-[#eee9e0] bg-[#f3f0ea] flex items-center justify-between">
                        <span className="text-sm font-medium tabular-nums">{platformSeats}</span>
                        <span className="text-[10px] uppercase tracking-[0.12em] text-[#8a847a]">
                          Platform cap
                        </span>
                      </div>
                      <p className="text-xs text-[#8a847a] mt-1.5 leading-relaxed">
                        Seat limit is set by Nexnoon admin for every class (closed supply).
                      </p>
                    </div>
                  </div>
                </section>

                {/* Schedule */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#eee9e0]">
                    <Calendar className="h-4 w-4 text-[#c45c26]" />
                    <h3 className="text-sm font-medium text-[#14110e]">Live schedule</h3>
                  </div>
                  <div className="grid md:grid-cols-3 gap-5">
                    <div>
                      <label className={labelClass}>Start date *</label>
                      <Input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => handleInputChange('startDate', e.target.value)}
                        className={fieldClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Start time *</label>
                      <Input
                        type="time"
                        value={formData.startTime}
                        onChange={(e) => handleInputChange('startTime', e.target.value)}
                        className={fieldClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        <span className="inline-flex items-center gap-1.5">
                          <Video className="h-3.5 w-3.5" />
                          Session length *
                        </span>
                      </label>
                      <select
                        value={formData.duration}
                        onChange={(e) => handleInputChange('duration', e.target.value)}
                        className={fieldClass}
                      >
                        <option value="">Select length</option>
                        <option value="30">30 minutes</option>
                        <option value="60">1 hour</option>
                        <option value="90">1.5 hours</option>
                        <option value="120">2 hours</option>
                        <option value="180">3 hours</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Class time zone *</label>
                    <TimeZoneSelect
                      value={formData.timezone}
                      onChange={(tz) => handleInputChange('timezone', tz)}
                      className={fieldClass}
                    />
                    <p className="mt-1.5 text-xs text-[#6b655c]">
                      The start date and time above are in this zone. Learners anywhere see sessions converted to their own time.
                    </p>
                    <LocalTimeHint date={formData.startDate} time={formData.startTime} timeZone={formData.timezone} />
                  </div>

                  <div className="grid md:grid-cols-2 gap-5">
                    <div>
                      <label className={labelClass}>How often *</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            ['daily', 'Daily'],
                            ['weekly', 'Weekly'],
                            ['biweekly', 'Bi-weekly'],
                            ['monthly', 'Monthly'],
                          ] as const
                        ).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => handleInputChange('sessionFrequency', value)}
                            className={`h-11 px-3 text-sm border transition-colors ${
                              formData.sessionFrequency === value
                                ? 'border-[#14110e] bg-[#14110e] text-white'
                                : 'border-[#d5cfc4] bg-white text-[#3d3933] hover:border-[#14110e]/40'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Total sessions *</label>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={formData.totalSessions}
                        onChange={(e) => handleInputChange('totalSessions', e.target.value)}
                        placeholder="e.g. 8"
                        className={fieldClass}
                      />
                      <p className="text-xs text-[#8a847a] mt-1.5">
                        We’ll generate a draft session calendar you can refine after publish.
                      </p>
                    </div>
                  </div>

                  {schedulePreview && (
                    <div className="flex items-start gap-3 border border-[#e8dcc8] bg-[#faf8f5] px-4 py-3.5">
                      <Clock className="h-4 w-4 text-[#c45c26] mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-[#8a847a]">
                          Schedule preview
                        </p>
                        <p className="text-sm text-[#14110e] mt-1 font-medium">{schedulePreview}</p>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* Step 3 */}
            {currentStep === 3 && (
              <div className="p-6 md:p-8 space-y-8">
                <div>
                  <h2 className={sectionTitleClass}>Content</h2>
                  <p className="text-sm text-[#6b655c] mt-1">
                    Outcomes, materials, and the long-form class page.
                  </p>
                </div>

                <ClassDetailsEditor
                  value={details}
                  onChange={(value) => {
                    setDetails(value);
                  }}
                  onPreviewVideoFileChange={setPendingPreviewVideo}
                  pendingInvites={pendingInvites}
                  onPendingInvitesChange={setPendingInvites}
                />

                <div>
                  <label className={`${labelClass} !normal-case !tracking-normal !text-sm !mb-3 flex items-center gap-2`}>
                    <BookOpen className="h-4 w-4 text-[#c45c26]" />
                    What will learners learn? *
                  </label>
                  {formData.learningOutcomes.map((outcome, index) => (
                    <div key={index} className="flex gap-2 mb-2.5">
                      <Input
                        value={outcome}
                        onChange={(e) =>
                          handleArrayChange('learningOutcomes', index, e.target.value)
                        }
                        placeholder="e.g., Build and ship a live project with feedback"
                        className={fieldClass}
                      />
                      {formData.learningOutcomes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleArrayRemove('learningOutcomes', index)}
                          className="h-11 w-11 shrink-0 border border-[#d5cfc4] text-[#8a847a] hover:border-rose-300 hover:text-rose-700 transition-colors inline-flex items-center justify-center"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleArrayAdd('learningOutcomes')}
                    className="w-full h-11 border border-dashed border-[#d5cfc4] text-sm text-[#3d3933] hover:border-[#14110e] hover:bg-[#faf8f5] transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add learning outcome
                  </button>
                </div>

                <div>
                  <label className={`${labelClass} !normal-case !tracking-normal !text-sm !mb-3`}>
                    Prerequisites (optional)
                  </label>
                  {formData.prerequisites.map((prereq, index) => (
                    <div key={index} className="flex gap-2 mb-2.5">
                      <Input
                        value={prereq}
                        onChange={(e) =>
                          handleArrayChange('prerequisites', index, e.target.value)
                        }
                        placeholder="e.g., Comfortable with JavaScript basics"
                        className={fieldClass}
                      />
                      {formData.prerequisites.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleArrayRemove('prerequisites', index)}
                          className="h-11 w-11 shrink-0 border border-[#d5cfc4] text-[#8a847a] hover:border-rose-300 hover:text-rose-700 transition-colors inline-flex items-center justify-center"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleArrayAdd('prerequisites')}
                    className="w-full h-11 border border-dashed border-[#d5cfc4] text-sm text-[#3d3933] hover:border-[#14110e] hover:bg-[#faf8f5] transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add prerequisite
                  </button>
                </div>

                <div>
                  <label className={`${labelClass} !normal-case !tracking-normal !text-sm !mb-3 flex items-center gap-2`}>
                    <FileText className="h-4 w-4 text-[#c45c26]" />
                    Required materials (optional)
                  </label>
                  {formData.materials.map((material, index) => (
                    <div key={index} className="flex gap-2 mb-2.5">
                      <Input
                        value={material}
                        onChange={(e) => handleArrayChange('materials', index, e.target.value)}
                        placeholder="e.g., Laptop with VS Code installed"
                        className={fieldClass}
                      />
                      {formData.materials.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleArrayRemove('materials', index)}
                          className="h-11 w-11 shrink-0 border border-[#d5cfc4] text-[#8a847a] hover:border-rose-300 hover:text-rose-700 transition-colors inline-flex items-center justify-center"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleArrayAdd('materials')}
                    className="w-full h-11 border border-dashed border-[#d5cfc4] text-sm text-[#3d3933] hover:border-[#14110e] hover:bg-[#faf8f5] transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add material
                  </button>
                </div>
              </div>
            )}

            {/* Step 4 */}
            {currentStep === 4 && (
              <div className="p-6 md:p-8 space-y-6">
                <div>
                  <h2 className={sectionTitleClass}>Review & publish</h2>
                  <p className="text-sm text-[#6b655c] mt-1">
                    Confirm the details before this class goes live for enrollment.
                  </p>
                </div>

                <div className="border border-[#eee9e0] bg-[#faf8f5]/70 divide-y divide-[#eee9e0]">
                  <div className="p-5 grid sm:grid-cols-[7rem_1fr] gap-2 sm:gap-4">
                    <span className="text-[11px] uppercase tracking-[0.14em] text-[#8a847a]">Title</span>
                    <span className="font-medium">{formData.title || '—'}</span>
                  </div>
                  <div className="p-5 grid sm:grid-cols-[7rem_1fr] gap-2 sm:gap-4">
                    <span className="text-[11px] uppercase tracking-[0.14em] text-[#8a847a]">
                      Description
                    </span>
                    <span className="text-sm text-[#3d3933] leading-relaxed">
                      {formData.description || '—'}
                    </span>
                  </div>
                  <div className="p-5 grid sm:grid-cols-3 gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[#8a847a] mb-1">
                        Category
                      </p>
                      <p className="font-medium">{formData.category || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[#8a847a] mb-1">
                        Level
                      </p>
                      <p className="font-medium capitalize">{formData.level}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[#8a847a] mb-1">
                        Price
                      </p>
                      <p className="font-medium">${formData.price || '0'}</p>
                    </div>
                  </div>
                  <div className="p-5 grid sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[#8a847a] mb-1">
                        First session
                      </p>
                      <p className="font-medium">
                        {formData.startDate || '—'}
                        {formData.startTime ? ` · ${formData.startTime} (${tzLabel(formData.timezone)})` : ''}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[#8a847a] mb-1">
                        Cadence
                      </p>
                      <p className="font-medium capitalize">
                        {formData.sessionFrequency} · {formData.totalSessions || '0'} sessions ·{' '}
                        {formData.duration || '0'} min
                      </p>
                    </div>
                  </div>
                  {formData.learningOutcomes.filter((o) => o).length > 0 && (
                    <div className="p-5">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[#8a847a] mb-2">
                        Outcomes
                      </p>
                      <ul className="space-y-1.5">
                        {formData.learningOutcomes
                          .filter((o) => o)
                          .map((outcome, index) => (
                            <li key={index} className="text-sm text-[#3d3933] flex gap-2">
                              <span className="text-[#c45c26]">·</span>
                              {outcome}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="border border-[#e8dcc8] bg-[#faf8f5] px-4 py-3.5 text-sm text-[#3d3933] leading-relaxed">
                  <strong className="text-[#14110e]">Ready to publish?</strong> The class becomes
                  visible for enrollment. You can still edit schedule and content from your studio.
                </div>
              </div>
            )}

            {/* Footer actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 md:px-8 py-5 border-t border-[#eee9e0] bg-[#faf8f5]/50">
              <button
                type="button"
                onClick={() => currentStep > 1 && setCurrentStep(currentStep - 1)}
                disabled={currentStep === 1}
                className="h-10 px-4 text-sm border border-[#d5cfc4] bg-white disabled:opacity-40 hover:border-[#14110e] transition-colors"
              >
                Previous
              </button>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/my-classes')}
                  className="h-10 px-4 text-sm border border-[#d5cfc4] bg-white hover:border-[#14110e] transition-colors"
                >
                  Cancel
                </button>

                {currentStep < 4 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(currentStep + 1)}
                    className="h-10 px-5 text-sm font-medium bg-[#14110e] text-white hover:bg-black/85 transition-colors"
                  >
                    Next step
                  </button>
                ) : (
                  <>
                    {submitError && (
                      <p className="text-sm text-rose-700 self-center mr-1">{submitError}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleSubmit()}
                      disabled={isSubmitting}
                      className="h-10 px-5 text-sm font-medium bg-[#c45c26] text-white hover:bg-[#a84c1e] disabled:opacity-50 transition-colors"
                    >
                      {isSubmitting ? 'Publishing…' : 'Publish class'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
