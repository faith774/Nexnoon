import ClassDetailsEditor from '@/app/components/ClassDetailsEditor';
import type { ClassDetails } from '@/types/api';
import { useState } from 'react';
import { ArrowLeft, Upload, Plus, X, Calendar, Clock, DollarSign, Users, BookOpen, Video, FileText } from 'lucide-react';
import { useNavigate } from 'react-router';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { classService, getErrorMessage } from '@/lib/api';
import { useBackendData } from '@/hooks/useBackendData';
import { ENV } from '@/config/env';
import { toast } from 'sonner';
import type { CreateClassRequest } from '@/types/api';

export default function CreateClass() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [details, setDetails] = useState<ClassDetails>({});
  const platformSettings = useBackendData<{ maxClassSeats: number }>('/settings/platform', true);
  const platformSeats = platformSettings.data?.maxClassSeats ?? 25;

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    price: '',
    duration: '',
    language: 'English',
    level: 'beginner',
    startDate: '',
    startTime: '',
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
    for (let i = 1; i <= totalSessions; i++) {
      const sessionStart = new Date(`${startDate}T${startTime}`);
      sessionStart.setDate(sessionStart.getDate() + (i - 1) * daysBetween);
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
      schedule: buildSchedule(),
      thumbnail: thumbnail || undefined,
      language: formData.language,
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
      await classService.createClass(payload);
      toast.success('Class created successfully. Live sessions will have Zoom links when configured.');
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

  return (
    <div className="min-h-screen bg-white">
      <Header variant="light" />
      
      <main className="py-12">
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Class</h1>
            <p className="text-gray-600">Fill in the details to create your live online class</p>
            {!isAuthenticated && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Demo Mode:</strong> You're viewing the class creation form.
                </p>
              </div>
            )}
          </div>

          {/* Progress Steps */}
          <div className="mb-12">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <div key={step.number} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all ${
                        currentStep >= step.number
                          ? 'bg-[#889dd1] text-white'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {step.number}
                    </div>
                    <div className="mt-2 text-center">
                      <div className={`text-sm font-medium ${currentStep >= step.number ? 'text-gray-900' : 'text-gray-500'}`}>
                        {step.title}
                      </div>
                      <div className="text-xs text-gray-500 hidden sm:block">{step.description}</div>
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`h-1 flex-1 mx-4 rounded ${currentStep > step.number ? 'bg-[#889dd1]' : 'bg-gray-200'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Form Content */}
          <div className="bg-white border border-gray-200 rounded-xl p-8">
            {/* Step 1: Basic Info */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Class Title *
                  </label>
                  <Input
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="e.g., Advanced React Patterns & Best Practices"
                    className="text-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Class Description *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Describe what students will learn in this class..."
                    rows={6}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#889dd1] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Class Thumbnail
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#889dd1] transition-colors">
                    {thumbnail ? (
                      <div className="relative">
                        <img src={thumbnail} alt="Thumbnail preview" className="max-h-64 mx-auto rounded-lg" />
                        <button
                          onClick={() => setThumbnail(null)}
                          className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer">
                        <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 mb-2">Click to upload or drag and drop</p>
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
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Category *
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => handleInputChange('category', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#889dd1] focus:border-transparent"
                    >
                      <option value="">Select a category</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Level *
                    </label>
                    <select
                      value={formData.level}
                      onChange={(e) => handleInputChange('level', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#889dd1] focus:border-transparent"
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
                    <label className="block text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Price per Student (USD) *
                    </label>
                    <Input
                      type="number"
                      value={formData.price}
                      onChange={(e) => handleInputChange('price', e.target.value)}
                      placeholder="99"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Max Students
                    </label>
                    <Input type="number" value={platformSeats} disabled readOnly />
                    <p className="text-xs text-gray-500 mt-1">Set by platform admin for all classes.</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Start Date *
                    </label>
                    <Input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => handleInputChange('startDate', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Start Time *
                    </label>
                    <Input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => handleInputChange('startTime', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                      <Video className="h-4 w-4" />
                      Session Duration *
                    </label>
                    <select
                      value={formData.duration}
                      onChange={(e) => handleInputChange('duration', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#889dd1] focus:border-transparent"
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
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Session Frequency *
                    </label>
                    <select
                      value={formData.sessionFrequency}
                      onChange={(e) => handleInputChange('sessionFrequency', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#889dd1] focus:border-transparent"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Bi-weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Total Sessions *
                    </label>
                    <Input
                      type="number"
                      value={formData.totalSessions}
                      onChange={(e) => handleInputChange('totalSessions', e.target.value)}
                      placeholder="10"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Content */}
            {currentStep === 3 && (
              <div className="space-y-8">
                <ClassDetailsEditor value={details} onChange={value => { setDetails(value);  }} />
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    What will students learn? *
                  </label>
                  {formData.learningOutcomes.map((outcome, index) => (
                    <div key={index} className="flex gap-2 mb-3">
                      <Input
                        value={outcome}
                        onChange={(e) => handleArrayChange('learningOutcomes', index, e.target.value)}
                        placeholder="e.g., Master advanced React patterns like HOCs and Render Props"
                      />
                      {formData.learningOutcomes.length > 1 && (
                        <button
                          onClick={() => handleArrayRemove('learningOutcomes', index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <Button
                    onClick={() => handleArrayAdd('learningOutcomes')}
                    variant="outline"
                    className="w-full mt-2"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Learning Outcome
                  </Button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-4">
                    Prerequisites (Optional)
                  </label>
                  {formData.prerequisites.map((prereq, index) => (
                    <div key={index} className="flex gap-2 mb-3">
                      <Input
                        value={prereq}
                        onChange={(e) => handleArrayChange('prerequisites', index, e.target.value)}
                        placeholder="e.g., Basic understanding of JavaScript and React"
                      />
                      {formData.prerequisites.length > 1 && (
                        <button
                          onClick={() => handleArrayRemove('prerequisites', index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <Button
                    onClick={() => handleArrayAdd('prerequisites')}
                    variant="outline"
                    className="w-full mt-2"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Prerequisite
                  </Button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Required Materials (Optional)
                  </label>
                  {formData.materials.map((material, index) => (
                    <div key={index} className="flex gap-2 mb-3">
                      <Input
                        value={material}
                        onChange={(e) => handleArrayChange('materials', index, e.target.value)}
                        placeholder="e.g., Laptop with VS Code installed"
                      />
                      {formData.materials.length > 1 && (
                        <button
                          onClick={() => handleArrayRemove('materials', index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <Button
                    onClick={() => handleArrayAdd('materials')}
                    variant="outline"
                    className="w-full mt-2"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Material
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Review */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <h3 className="text-xl font-bold text-gray-900 mb-6">Review Your Class</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Title</div>
                      <div className="font-medium text-gray-900">{formData.title || 'Not provided'}</div>
                    </div>
                    
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Description</div>
                      <div className="text-gray-900">{formData.description || 'Not provided'}</div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm text-gray-500 mb-1">Category</div>
                        <div className="font-medium text-gray-900">{formData.category || 'Not selected'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500 mb-1">Level</div>
                        <div className="font-medium text-gray-900 capitalize">{formData.level}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500 mb-1">Price</div>
                        <div className="font-medium text-gray-900">${formData.price || '0'}</div>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-500 mb-1">Start Date & Time</div>
                        <div className="font-medium text-gray-900">
                          {formData.startDate || 'Not set'} at {formData.startTime || 'Not set'}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500 mb-1">Schedule</div>
                        <div className="font-medium text-gray-900 capitalize">
                          {formData.sessionFrequency}, {formData.totalSessions || '0'} sessions, {formData.duration || '0'} min each
                        </div>
                      </div>
                    </div>

                    {formData.learningOutcomes.filter(o => o).length > 0 && (
                      <div>
                        <div className="text-sm text-gray-500 mb-2">Learning Outcomes</div>
                        <ul className="list-disc list-inside space-y-1">
                          {formData.learningOutcomes.filter(o => o).map((outcome, index) => (
                            <li key={index} className="text-gray-900">{outcome}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Ready to publish?</strong> Your class will be visible to students immediately after publishing. You can always edit the details later from your dashboard.
                  </p>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-8 pt-8 border-t border-gray-200">
              <Button
                onClick={() => currentStep > 1 && setCurrentStep(currentStep - 1)}
                variant="outline"
                disabled={currentStep === 1}
              >
                Previous
              </Button>

              <div className="flex gap-3">
                <Button
                  onClick={() => navigate('/my-classes')}
                  variant="outline"
                >
                  Save as Draft
                </Button>

                {currentStep < 4 ? (
                  <Button
                    onClick={() => setCurrentStep(currentStep + 1)}
                    className="bg-black text-white hover:bg-black/90"
                  >
                    Next Step
                  </Button>
                ) : (
                  <>
                    {submitError && (
                      <p className="text-sm text-red-600 mr-2 self-center">{submitError}</p>
                    )}
                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="bg-[#889dd1] text-white hover:bg-[#7a8ec2]"
                    >
                      {isSubmitting ? 'Creating...' : 'Publish Class'}
                    </Button>
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
