import ClassDetailsEditor from '@/app/components/ClassDetailsEditor';
import type { ClassDetails, ClassSchedule } from '@/types/api';
import { classService, getErrorMessage } from '@/lib/api';
import BackendState from '@/app/components/BackendState';
import { useState, useEffect } from 'react';
import { ArrowLeft, Upload, Plus, X, Calendar, Clock, DollarSign, Users, BookOpen, Video, FileText, Trash2, Save } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useBackendData } from '@/hooks/useBackendData';
import { useUpdateClass, useClassSchedule, useUpdateSession } from '@/hooks/api/useClasses';

/** Splits an ISO timestamp into separate local date/time strings for <input> fields. */
function splitDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

const sessionStatusBadge: Record<ClassSchedule['status'], string> = {
  live: 'bg-red-100 text-red-700',
  scheduled: 'bg-blue-100 text-blue-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-gray-100 text-gray-400',
};

/** One session's row in the reschedule list: edits its date/time while keeping its duration. */
function SessionScheduleRow({ classId, session }: { classId: string; session: ClassSchedule }) {
  const updateSession = useUpdateSession(classId);
  const initial = splitDateTime(session.startTime);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const editable = session.status === 'scheduled';
  const changed = date !== initial.date || time !== initial.time;

  const handleSave = async () => {
    const newStart = new Date(`${date}T${time}`);
    if (Number.isNaN(newStart.getTime())) return;
    const durationMs = new Date(session.endTime).getTime() - new Date(session.startTime).getTime();
    const newEnd = new Date(newStart.getTime() + durationMs);
    await updateSession.mutateAsync({
      sessionId: session.id,
      data: { startTime: newStart.toISOString(), endTime: newEnd.toISOString() },
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 border border-gray-200 rounded-lg p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-900 truncate">{session.title}</p>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${sessionStatusBadge[session.status]}`}>
            {session.status}
          </span>
        </div>
      </div>
      <Input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        disabled={!editable}
        aria-label={`${session.title} date`}
        className="w-auto border-gray-300 rounded-lg disabled:opacity-50"
      />
      <Input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        disabled={!editable}
        aria-label={`${session.title} time`}
        className="w-auto border-gray-300 rounded-lg disabled:opacity-50"
      />
      <Button
        onClick={handleSave}
        disabled={!editable || !changed || updateSession.isPending}
        size="sm"
        className="bg-black text-white hover:bg-gray-800 rounded-lg disabled:opacity-50"
      >
        {updateSession.isPending ? 'Saving...' : 'Save'}
      </Button>
    </div>
  );
}

export default function EditClass() {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const updateClass = useUpdateClass(id || '');
  const { data: sessions } = useClassSchedule(id || '');
  const platformSettings = useBackendData<{ maxClassSeats: number }>('/settings/platform', true);
  const platformSeats = platformSettings.data?.maxClassSeats ?? 25;
  const [currentStep, setCurrentStep] = useState(1);
  const [details, setDetails] = useState<ClassDetails>({});

  const existingClass = {
    title: '', description: '', category: '', price: '0', duration: '60',
    language: '', level: 'beginner', startDate: '', startTime: '',
    sessionFrequency: 'weekly', totalSessions: '1', learningOutcomes: [] as string[],
    prerequisites: [] as string[], materials: [] as string[], thumbnail: '',
  };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!id) { setError('Select a class to edit.'); setLoading(false); return; }
    classService.getClass(id).then(c => {
      if (c.instructor.id !== user?.id && user?.role !== 'admin') throw new Error('You can only edit your own classes.');
      setFormData({ ...existingClass, title: c.title, description: c.description,
        category: c.category, price: String(c.price), duration: String(c.duration),
        language: c.language || '',
        level: c.level.toLowerCase(), totalSessions: String(c.totalSessions),
        startDate: c.startDate?.slice(0,10) || '', learningOutcomes: c.learningOutcomes || [],
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
        learningOutcomes: formData.learningOutcomes.filter(Boolean),
        prerequisites: formData.prerequisites.filter(Boolean), materials: formData.materials.filter(Boolean),
        thumbnail: thumbnail || '',
      });
      setHasChanges(false); navigate('/my-classes');
    } catch (err) { setError(getErrorMessage(err)); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!id || !confirm('Delete this class? This cannot be undone.')) return;
    try { await classService.deleteClass(id); navigate('/my-classes'); }
    catch (err) { setError(getErrorMessage(err)); }
  };

  const steps = [
    { number: 1, title: 'Basic Info', description: 'Class title and description' },
    { number: 2, title: 'Details', description: 'Category, price, and schedule' },
    { number: 3, title: 'Content', description: 'Learning outcomes and materials' },
  ];

  if (loading) return <BackendState title="Edit Class" loading message="Loading Nexnoon" />;
  if (!formData.title && error) return <BackendState title="Edit Class" message={error} />;

  return (
    <div className="min-h-screen bg-white">
      <Header variant="light" />
      
      <main className="py-12">
        {error && <p role="alert" className="text-red-600 w-[90vw] mx-auto">{error}</p>}
        <div className="w-[90vw] max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back
            </button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Edit Class</h1>
                <p className="text-gray-600">Update your class details and settings</p>
              </div>
              <Button
                onClick={handleDelete}
                variant="outline"
                className="text-red-600 border-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Class
              </Button>
            </div>
            {!isAuthenticated && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Demo Mode:</strong> You're viewing the class edit form.
                </p>
              </div>
            )}
            {hasChanges && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Unsaved Changes:</strong> You have unsaved changes. Don't forget to save!
                </p>
              </div>
            )}
          </div>

          {/* Tab Navigation */}
          <div className="mb-8 border-b-2 border-gray-200">
            <div className="flex gap-8">
              {steps.map((step) => (
                <button
                  key={step.number}
                  onClick={() => setCurrentStep(step.number)}
                  className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    currentStep === step.number
                      ? 'border-black text-black'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {step.title}
                </button>
              ))}
            </div>
          </div>

          {/* Form Content */}
          <div className="bg-white border border-gray-300 rounded-xl p-8 shadow-sm">
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
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-black mb-2">
                      CATEGORY *
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => handleInputChange('category', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-black rounded-none focus:outline-none focus:ring-4 focus:ring-black/10"
                    >
                      <option value="">Select a category</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-black mb-2">
                      LEVEL *
                    </label>
                    <select
                      value={formData.level}
                      onChange={(e) => handleInputChange('level', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-black rounded-none focus:outline-none focus:ring-4 focus:ring-black/10"
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                      <option value="all">All Levels</option>
                    </select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-black mb-2 flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      PRICE PER STUDENT (USD) *
                    </label>
                    <Input
                      type="number"
                      value={formData.price}
                      onChange={(e) => handleInputChange('price', e.target.value)}
                      placeholder="99"
                      className="border-2 border-black rounded-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-black mb-2 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      MAX STUDENTS
                    </label>
                    <Input
                      type="number"
                      value={platformSeats}
                      disabled
                      readOnly
                      className="border-2 border-black rounded-none opacity-70"
                    />
                    <p className="text-xs text-gray-500 mt-1">Set by platform admin for all classes.</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-black mb-2 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      START DATE *
                    </label>
                    <Input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => handleInputChange('startDate', e.target.value)}
                      className="border-2 border-black rounded-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-black mb-2 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      START TIME *
                    </label>
                    <Input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => handleInputChange('startTime', e.target.value)}
                      className="border-2 border-black rounded-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-black mb-2 flex items-center gap-2">
                      <Video className="h-4 w-4" />
                      SESSION DURATION *
                    </label>
                    <select
                      value={formData.duration}
                      onChange={(e) => handleInputChange('duration', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-black rounded-none focus:outline-none focus:ring-4 focus:ring-black/10"
                    >
                      <option value="">Select</option>
                      <option value="30">30 minutes</option>
                      <option value="60">1 hour</option>
                      <option value="90">1.5 hours</option>
                      <option value="120">2 hours</option>
                      <option value="180">3 hours</option>
                    </select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-black mb-2">
                      SESSION FREQUENCY *
                    </label>
                    <select
                      value={formData.sessionFrequency}
                      onChange={(e) => handleInputChange('sessionFrequency', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-black rounded-none focus:outline-none focus:ring-4 focus:ring-black/10"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Bi-weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-black mb-2">
                      TOTAL SESSIONS *
                    </label>
                    <Input
                      type="number"
                      value={formData.totalSessions}
                      onChange={(e) => handleInputChange('totalSessions', e.target.value)}
                      placeholder="10"
                      className="border-2 border-black rounded-none"
                    />
                  </div>
                </div>

                {!!sessions?.length && (
                  <div className="pt-6 border-t border-gray-200">
                    <label className="block text-sm font-bold text-black mb-1">
                      SESSION SCHEDULE
                    </label>
                    <p className="text-sm text-gray-500 mb-4">
                      Reschedule an upcoming session. Its duration stays the same; only the start date and time change.
                    </p>
                    <div className="space-y-3">
                      {sessions.map((s) => (
                        <SessionScheduleRow key={s.id} classId={id!} session={s} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Content */}
            {currentStep === 3 && (
              <div className="space-y-8">
                <ClassDetailsEditor value={details} onChange={value => { setDetails(value); setHasChanges(true); }} />
                <div>
                  <label className="block text-sm font-bold text-black mb-4 flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    WHAT WILL STUDENTS LEARN? *
                  </label>
                  {formData.learningOutcomes.map((outcome, index) => (
                    <div key={index} className="flex gap-2 mb-3">
                      <Input
                        value={outcome}
                        onChange={(e) => handleArrayChange('learningOutcomes', index, e.target.value)}
                        placeholder="e.g., Master advanced React patterns like HOCs and Render Props"
                        className="border-2 border-black rounded-none"
                      />
                      {formData.learningOutcomes.length > 1 && (
                        <button
                          onClick={() => handleArrayRemove('learningOutcomes', index)}
                          className="p-2 bg-black text-white hover:bg-gray-800 border-2 border-black transition-colors"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <Button
                    onClick={() => handleArrayAdd('learningOutcomes')}
                    className="w-full mt-2 bg-white text-black border-2 border-black rounded-none hover:bg-black hover:text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Learning Outcome
                  </Button>
                </div>

                <div>
                  <label className="block text-sm font-bold text-black mb-4">
                    PREREQUISITES (OPTIONAL)
                  </label>
                  {formData.prerequisites.map((prereq, index) => (
                    <div key={index} className="flex gap-2 mb-3">
                      <Input
                        value={prereq}
                        onChange={(e) => handleArrayChange('prerequisites', index, e.target.value)}
                        placeholder="e.g., Basic understanding of JavaScript and React"
                        className="border-2 border-black rounded-none"
                      />
                      {formData.prerequisites.length > 1 && (
                        <button
                          onClick={() => handleArrayRemove('prerequisites', index)}
                          className="p-2 bg-black text-white hover:bg-gray-800 border-2 border-black transition-colors"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <Button
                    onClick={() => handleArrayAdd('prerequisites')}
                    className="w-full mt-2 bg-white text-black border-2 border-black rounded-none hover:bg-black hover:text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Prerequisite
                  </Button>
                </div>

                <div>
                  <label className="block text-sm font-bold text-black mb-4 flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    REQUIRED MATERIALS (OPTIONAL)
                  </label>
                  {formData.materials.map((material, index) => (
                    <div key={index} className="flex gap-2 mb-3">
                      <Input
                        value={material}
                        onChange={(e) => handleArrayChange('materials', index, e.target.value)}
                        placeholder="e.g., Laptop with VS Code installed"
                        className="border-2 border-black rounded-none"
                      />
                      {formData.materials.length > 1 && (
                        <button
                          onClick={() => handleArrayRemove('materials', index)}
                          className="p-2 bg-black text-white hover:bg-gray-800 border-2 border-black transition-colors"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <Button
                    onClick={() => handleArrayAdd('materials')}
                    className="w-full mt-2 bg-white text-black border-2 border-black rounded-none hover:bg-black hover:text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Material
                  </Button>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="flex items-center justify-between mt-8 pt-8 border-t-2 border-black">
              <Button
                onClick={() => navigate('/my-classes')}
                variant="outline"
                className="border-2 border-black rounded-none"
              >
                Cancel
              </Button>

              <Button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className="bg-black text-white hover:bg-gray-800 rounded-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}