import ClassDetailsEditor from '@/app/components/ClassDetailsEditor';
import { TimeZoneSelect } from '@/app/components/TimeZonePicker';
import { browserTimeZone, isValidTimeZone } from '@/lib/timezone';
import PriceHint, { priceRangeMessage } from '@/app/components/PriceHint';
import type { Class, ClassDetails, Course } from '@/types/api';
import { classService, courseService, getErrorMessage } from '@/lib/api';
import BackendState from '@/app/components/BackendState';
import { useState, useEffect } from 'react';
import {
  ArrowLeft, Upload, Plus, X, Calendar, Clock, DollarSign, Users, BookOpen, Video,
  FileText, Trash2, Save,
} from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useBackendData } from '@/hooks/useBackendData';
import { useUpdateClass, useClassSchedule } from '@/hooks/api/useClasses';

const fieldLabel = 'block text-xs uppercase tracking-[0.14em] text-[#6b655c] mb-1.5';
const fieldControl =
  'w-full border border-[#e4dfd6] bg-white px-3 py-2.5 text-sm text-[#14110e] outline-none focus:border-[#14110e] disabled:opacity-60 disabled:bg-[#faf8f5]';

/** Compact list editor for outcomes / prerequisites / materials. */
function ArrayEditor({
  label,
  hint,
  icon,
  required,
  items,
  placeholder,
  onChange,
  onAdd,
  onRemove,
  addLabel,
  minItems = 0,
}: {
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  required?: boolean;
  items: string[];
  placeholder: string;
  onChange: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  addLabel: string;
  minItems?: number;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className={`${fieldLabel} inline-flex items-center gap-1.5`}>
          {icon}
          {label}
          {required && <span className="text-[#c45c26] normal-case tracking-normal">*</span>}
        </p>
        {hint && <p className="text-xs text-[#6b655c] -mt-0.5 mb-1">{hint}</p>}
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex gap-2 items-center">
            <span className="text-xs tabular-nums text-[#a39c92] w-5 flex-shrink-0 text-right">
              {index + 1}
            </span>
            <Input
              value={item}
              onChange={(e) => onChange(index, e.target.value)}
              placeholder={placeholder}
              className={fieldControl}
            />
            {items.length > minItems && (
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="p-2 border border-[#e4dfd6] text-[#6b655c] hover:text-red-700 hover:border-red-200 flex-shrink-0"
                aria-label="Remove"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#14110e] border border-[#d5cfc4] bg-white px-3 py-2 hover:border-[#14110e]"
      >
        <Plus className="h-4 w-4" />
        {addLabel}
      </button>
    </div>
  );
}

export default function EditClass() {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const adminMode = user?.role === 'admin' || location.pathname.startsWith('/admin');
  const backHref = adminMode ? `/admin/dashboard?tab=classes&class=${id}` : `/classroom/${id}`;
  const doneHref = adminMode ? `/admin/dashboard?tab=classes&class=${id}` : '/my-classes';
  const updateClass = useUpdateClass(id || '');
  const { data: sessions } = useClassSchedule(id || '');
  const platformSettings = useBackendData<{ maxClassSeats: number }>('/settings/platform', true);
  const platformSeats = platformSettings.data?.maxClassSeats ?? 25;
  const [currentStep, setCurrentStep] = useState(1);
  const [details, setDetails] = useState<ClassDetails>({});
  const [classData, setClassData] = useState<Class | null>(null);
  const [course, setCourse] = useState<Course | undefined>();
  useEffect(() => {
    if (!classData?.courseId) return;
    courseService
      .getCatalog()
      .then((list) => setCourse(list.find((c) => c.id === classData.courseId)))
      .catch(() => setCourse(undefined));
  }, [classData?.courseId]);

  const existingClass = {
    title: '', description: '', category: '', price: '0', duration: '60',
    language: '', level: 'beginner', startDate: '', startTime: '', timezone: browserTimeZone(),
    sessionFrequency: 'weekly', totalSessions: '1', learningOutcomes: [] as string[],
    prerequisites: [] as string[], materials: [] as string[], thumbnail: '',
  };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!id) { setError('Select a class to edit.'); setLoading(false); return; }
    classService.getClass(id).then(c => {
      const onTeam = c.instructor.id === user?.id
        || (c.teachingTeam || []).some((m) => String(m.userId) === user?.id && (m.status === 'accepted' || m.status === 'pending'))
        || user?.role === 'admin';
      if (!onTeam) throw new Error('You can only edit classes you teach.');
      setClassData(c);
      setFormData({ ...existingClass, title: c.title, description: c.description,
        category: c.category, price: String(c.price), duration: String(c.duration),
        language: c.language || '',
        level: c.level.toLowerCase(), totalSessions: String(c.totalSessions),
        startDate: c.startDate?.slice(0,10) || '',
        timezone: isValidTimeZone(c.timezone) ? c.timezone : isValidTimeZone(user?.timezone) ? user!.timezone! : browserTimeZone(),
        learningOutcomes: c.learningOutcomes || [],
        prerequisites: c.prerequisites || [], materials: c.materials || [], thumbnail: c.thumbnail || '' });
      setThumbnail(c.thumbnail || null);
      setDetails(c.details || {});
    }).catch(err => setError(getErrorMessage(err))).finally(() => setLoading(false));
  }, [id, user?.id]);

  // Form state
  const [formData, setFormData] = useState(existingClass);
  const [thumbnail, setThumbnail] = useState<string | null>(existingClass.thumbnail);
  const [hasChanges, setHasChanges] = useState(false);

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
    setHasChanges(true);
  };

  const handleArrayAdd = (field: 'learningOutcomes' | 'prerequisites' | 'materials') => {
    setFormData({ ...formData, [field]: [...formData[field], ''] });
    setHasChanges(true);
  };

  const handleArrayRemove = (field: 'learningOutcomes' | 'prerequisites' | 'materials', index: number) => {
    const newArray = formData[field].filter((_, i) => i !== index);
    setFormData({ ...formData, [field]: newArray });
    setHasChanges(true);
  };

  const handleArrayChange = (field: 'learningOutcomes' | 'prerequisites' | 'materials', index: number, value: string) => {
    const newArray = [...formData[field]];
    newArray[index] = value;
    setFormData({ ...formData, [field]: newArray });
    setHasChanges(true);
  };

  const handleThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnail(reader.result as string);
        setHasChanges(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!id) return;
    const rangeError = priceRangeMessage(course, formData.price);
    if (rangeError) { setError(rangeError); return; }
    setSaving(true); setError('');
    try {
      await updateClass.mutateAsync({
        details,
        title: formData.title, description: formData.description, category: formData.category,
        price: Number(formData.price), duration: Number(formData.duration),
        totalSessions: Number(formData.totalSessions),
        level: (formData.level.charAt(0).toUpperCase() + formData.level.slice(1)) as 'Beginner' | 'Intermediate' | 'Advanced',
        language: formData.language,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : undefined,
        timezone: formData.timezone,
        learningOutcomes: formData.learningOutcomes.filter(Boolean),
        prerequisites: formData.prerequisites.filter(Boolean), materials: formData.materials.filter(Boolean),
        thumbnail: thumbnail || '',
      });
      setHasChanges(false); navigate(doneHref);
    } catch (err) { setError(getErrorMessage(err)); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!id || !confirm('Delete this class? This cannot be undone.')) return;
    try { await classService.deleteClass(id); navigate(adminMode ? '/admin/dashboard?tab=classes' : '/my-classes'); }
    catch (err) { setError(getErrorMessage(err)); }
  };

  const steps = [
    { number: 1, title: 'Basic Info', description: 'Class title and description' },
    { number: 2, title: 'Details', description: 'Category, price, and schedule' },
    { number: 3, title: 'Content', description: 'Learning outcomes and materials' },
  ];

  if (loading) return <BackendState title="Edit Class" loading message="Loading Nexnoon" />;
  if (!formData.title && error) {
    return (
      <BackendState
        title="Edit Class"
        message={error}
        {...(adminMode ? { actionLabel: 'Back to admin · Classes', actionTo: backHref } : {})}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f4f0] text-[#1a1a1a]">
      {!adminMode && <Header variant="light" />}
      
      <main className="py-10 md:py-12">
        {error && (
          <p role="alert" className="text-red-600 w-[min(92vw,1000px)] mx-auto mb-4 text-sm border border-red-200 bg-red-50 px-4 py-2.5">
            {error}
          </p>
        )}
        <div className="w-[min(92vw,1000px)] mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => navigate(backHref)}
              className="flex items-center text-[#6b655c] hover:text-[#14110e] mb-4 transition-colors text-sm"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {adminMode ? 'Back to admin · Classes' : 'Back to classroom'}
            </button>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#6b655c] mb-1">
                  {adminMode ? 'Admin · editing on behalf of the instructor' : 'Lead instructor'}
                </p>
                <h1 className="font-serif text-3xl tracking-tight text-[#14110e] mb-2">Edit class</h1>
                <p className="text-[#6b655c] text-sm max-w-lg">
                  Update curriculum, schedule, and class materials.
                </p>
              </div>
              <Button
                onClick={handleDelete}
                variant="outline"
                className="border border-red-300 text-red-700 hover:bg-red-50 rounded-none"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete class
              </Button>
            </div>
            {!isAuthenticated && (
              <div className="mt-4 p-4 bg-white border border-[#e4dfd6] text-sm text-[#3d3933]">
                <strong>Demo mode:</strong> You&apos;re viewing the class edit form.
              </div>
            )}
            {hasChanges && (
              <div className="mt-4 p-4 bg-[#fff8f0] border border-[#eadfcf] text-sm text-[#5c4030]">
                <strong>Unsaved changes</strong> — don&apos;t forget to save.
              </div>
            )}
          </div>

          {/* Tab Navigation */}
          <div className="mb-6 border-b border-[#ddd6ca]">
            <div className="flex gap-6 overflow-x-auto">
              {steps.map((step) => (
                <button
                  key={step.number}
                  onClick={() => setCurrentStep(step.number)}
                  className={`pb-3 text-sm whitespace-nowrap transition-colors ${
                    currentStep === step.number
                      ? 'border-b-2 border-[#14110e] text-[#14110e] font-medium'
                      : 'text-[#6b655c] hover:text-[#14110e]'
                  }`}
                >
                  {step.title}
                </button>
              ))}
            </div>
          </div>

          {/* Form Content */}
          <div className="bg-white border border-[#e4dfd6] p-6 sm:p-8">
            {/* Step 1: Basic Info */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-black mb-2">
                    CLASS TITLE *
                  </label>
                  <Input
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="e.g., Advanced React Patterns & Best Practices"
                    className="text-lg border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-black mb-2">
                    CLASS DESCRIPTION *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Describe what students will learn in this class..."
                    rows={6}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-black mb-2">
                    CLASS THUMBNAIL
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 transition-colors">
                    {thumbnail ? (
                      <div className="relative">
                        <img src={thumbnail} alt="Thumbnail preview" className="max-h-64 mx-auto rounded-lg" />
                        <button
                          onClick={() => {
                            setThumbnail(null);
                            setHasChanges(true);
                          }}
                          className="absolute top-2 right-2 p-2 bg-black text-white hover:bg-gray-800 rounded-lg"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer">
                        <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 mb-2 font-bold">UPLOAD NEW IMAGE</p>
                        <p className="text-sm text-gray-500">PNG, JPG up to 10MB</p>
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

            {/* Step 2: Details */}
            {currentStep === 2 && (
              <div className="space-y-8">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[#6b655c]">Pricing &amp; level</p>
                  <h2 className="font-serif text-xl text-[#14110e] mt-1 mb-4">Class details</h2>
                  <div className="grid md:grid-cols-2 gap-4">
                    <label className="flex flex-col">
                      <span className={fieldLabel}>Category *</span>
                      <select
                        value={formData.category}
                        onChange={(e) => handleInputChange('category', e.target.value)}
                        className={fieldControl}
                      >
                        <option value="">Select a category</option>
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col">
                      <span className={fieldLabel}>Level *</span>
                      <select
                        value={formData.level}
                        onChange={(e) => handleInputChange('level', e.target.value)}
                        className={fieldControl}
                      >
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                        <option value="all">All Levels</option>
                      </select>
                    </label>
                    <label className="flex flex-col">
                      <span className={`${fieldLabel} inline-flex items-center gap-1.5`}>
                        <DollarSign className="h-3.5 w-3.5" /> Price per learner (USD) *
                      </span>
                      <Input
                        type="number"
                        value={formData.price}
                        onChange={(e) => handleInputChange('price', e.target.value)}
                        placeholder="99"
                        className={fieldControl}
                      />
                      <PriceHint course={course} price={formData.price} />
                    </label>
                    <label className="flex flex-col">
                      <span className={`${fieldLabel} inline-flex items-center gap-1.5`}>
                        <Users className="h-3.5 w-3.5" /> Max learners
                      </span>
                      <Input
                        type="number"
                        value={platformSeats}
                        disabled
                        readOnly
                        className={fieldControl}
                      />
                      <span className="text-[11px] text-[#8a847a] mt-1">Set by platform admin for all classes.</span>
                    </label>
                  </div>
                </div>

                <div className="border-t border-[#eee9e0] pt-8">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[#6b655c]">Defaults</p>
                  <h2 className="font-serif text-xl text-[#14110e] mt-1 mb-1">Session defaults</h2>
                  <p className="text-sm text-[#6b655c] mb-4">
                    Used when generating new sessions. Existing sessions below keep their own times.
                  </p>
                  <div className="grid md:grid-cols-3 gap-4">
                    <label className="flex flex-col">
                      <span className={`${fieldLabel} inline-flex items-center gap-1.5`}>
                        <Calendar className="h-3.5 w-3.5" /> Class start date
                      </span>
                      <Input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => handleInputChange('startDate', e.target.value)}
                        className={fieldControl}
                      />
                    </label>
                    <label className="flex flex-col">
                      <span className={`${fieldLabel} inline-flex items-center gap-1.5`}>
                        <Clock className="h-3.5 w-3.5" /> Default start time
                      </span>
                      <Input
                        type="time"
                        value={formData.startTime}
                        onChange={(e) => handleInputChange('startTime', e.target.value)}
                        className={fieldControl}
                      />
                    </label>
                    <label className="flex flex-col">
                      <span className={`${fieldLabel} inline-flex items-center gap-1.5`}>
                        <Video className="h-3.5 w-3.5" /> Default duration
                      </span>
                      <select
                        value={formData.duration}
                        onChange={(e) => handleInputChange('duration', e.target.value)}
                        className={fieldControl}
                      >
                        <option value="">Select</option>
                        <option value="30">30 minutes</option>
                        <option value="60">1 hour</option>
                        <option value="90">1.5 hours</option>
                        <option value="120">2 hours</option>
                        <option value="180">3 hours</option>
                      </select>
                    </label>
                    <label className="flex flex-col">
                      <span className={fieldLabel}>Session frequency</span>
                      <select
                        value={formData.sessionFrequency}
                        onChange={(e) => handleInputChange('sessionFrequency', e.target.value)}
                        className={fieldControl}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Bi-weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </label>
                    <label className="flex flex-col">
                      <span className={fieldLabel}>Planned total sessions</span>
                      <Input
                        type="number"
                        value={formData.totalSessions}
                        onChange={(e) => handleInputChange('totalSessions', e.target.value)}
                        placeholder="10"
                        className={fieldControl}
                      />
                    </label>
                    <label className="flex flex-col md:col-span-3">
                      <span className={fieldLabel}>Class time zone</span>
                      <TimeZoneSelect
                        value={formData.timezone}
                        onChange={(tz) => handleInputChange('timezone', tz)}
                        className={fieldControl}
                      />
                      <span className="mt-1.5 text-xs text-[#6b655c]">
                        You schedule sessions in this zone; learners see each session in their own local time. Changing it keeps existing sessions at the same moment.
                      </span>
                    </label>
                  </div>
                </div>

                <div className="border-t border-[#eee9e0] pt-8">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[#6b655c]">Live sessions</p>
                  <h2 className="font-serif text-xl text-[#14110e] mt-1 mb-1">Scheduled under modules</h2>
                  <p className="text-sm text-[#6b655c] max-w-2xl leading-relaxed">
                    Open the <button type="button" onClick={() => setCurrentStep(3)} className="underline underline-offset-2 text-[#14110e] font-medium">Content</button> tab,
                    expand a module, and add live Zoom sessions there — zero, one, or many per module.
                    {sessions?.length ? (
                      <span className="block mt-2 text-[#14110e]">
                        {sessions.length} live session{sessions.length === 1 ? '' : 's'} on this class so far.
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>
            )}

            {/* Step 3: Content */}
            {currentStep === 3 && (
              <div className="space-y-8">
                <ClassDetailsEditor
                  value={details}
                  onChange={(value) => { setDetails(value); setHasChanges(true); }}
                  classId={id}
                  classData={classData}
                  onClassUpdated={setClassData}
                  sessions={sessions || []}
                  defaultDurationMinutes={Number(formData.duration) || 60}
                  timeZone={formData.timezone}
                />
                <div className="border-t border-[#eee9e0] pt-8 space-y-8">
                  <ArrayEditor
                    label="What will students learn?"
                    required
                    icon={<BookOpen className="h-3.5 w-3.5" />}
                    hint="Shown as checkmarks on the public class page."
                    items={formData.learningOutcomes}
                    placeholder="e.g., Practice clear greetings and introductions"
                    onChange={(index, value) => handleArrayChange('learningOutcomes', index, value)}
                    onAdd={() => handleArrayAdd('learningOutcomes')}
                    onRemove={(index) => handleArrayRemove('learningOutcomes', index)}
                    addLabel="Add learning outcome"
                    minItems={1}
                  />

                  <ArrayEditor
                    label="Prerequisites"
                    hint="Optional. What learners should know before joining."
                    items={formData.prerequisites}
                    placeholder="e.g., No previous experience required"
                    onChange={(index, value) => handleArrayChange('prerequisites', index, value)}
                    onAdd={() => handleArrayAdd('prerequisites')}
                    onRemove={(index) => handleArrayRemove('prerequisites', index)}
                    addLabel="Add prerequisite"
                  />

                  <ArrayEditor
                    label="Required materials"
                    icon={<FileText className="h-3.5 w-3.5" />}
                    hint="Optional. Tools or prep learners need."
                    items={formData.materials}
                    placeholder="e.g., Notebook or document for exercises"
                    onChange={(index, value) => handleArrayChange('materials', index, value)}
                    onAdd={() => handleArrayAdd('materials')}
                    onRemove={(index) => handleArrayRemove('materials', index)}
                    addLabel="Add material"
                  />
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#eee9e0]">
              <Button
                onClick={() => navigate(backHref)}
                variant="outline"
                className="border border-[#d5cfc4] rounded-none"
              >
                Cancel
              </Button>

              <Button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className="bg-[#c45c26] text-white hover:bg-[#a84c1e] rounded-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        </div>
      </main>
      
      {!adminMode && <Footer />}
    </div>
  );
}