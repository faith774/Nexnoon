import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Camera,
  Check,
  CheckCircle2,
  Circle,
  Globe2,
  Link2,
  Linkedin,
  Loader2,
  PartyPopper,
  Plus,
  Sparkles,
  UserRound,
  Video,
  X,
} from 'lucide-react';
import Header from '@/app/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { authService, courseService, getErrorMessage } from '@/lib/api';
import type { Course } from '@/types/api';
import {
  applicationProgress,
  BIO_MIN,
  EXPERIENCE_MIN,
  type InstructorApplicationFields,
} from '@/lib/instructor-application';

const LANGUAGE_SUGGESTIONS = ['English', 'French', 'Spanish', 'Arabic', 'Portuguese', 'Yoruba', 'Hausa', 'Igbo', 'Swahili', 'German'];
const AVATAR_SIZE = 320;

type FormState = {
  avatar: string;
  headline: string;
  bio: string;
  expertise: string[];
  languages: string[];
  requestedCourseIds: string[];
  yearsExperience: string;
  teachingExperience: string;
  linkedinUrl: string;
  portfolioUrl: string;
  sampleVideoUrl: string;
};

/** Downscales an image to a square JPEG data URL so avatars stay small. */
function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = AVATAR_SIZE;
      canvas.height = AVATAR_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Could not process image'));
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image'));
    };
    img.src = url;
  });
}

function isLink(v: string) {
  return !v || /^https?:\/\/\S+\.\S+/i.test(v.trim());
}

function Section({
  id,
  icon: Icon,
  title,
  description,
  done,
  children,
}: {
  id: string;
  icon: typeof UserRound;
  title: string;
  description: string;
  done: boolean;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 rounded-3xl border border-[#e8e2d8] bg-white p-6 sm:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f3efe8] text-[#14110e]">
            <Icon className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[#14110e]">{title}</h2>
            <p className="mt-0.5 text-sm leading-relaxed text-[#6b655c]">{description}</p>
          </div>
        </div>
        {done && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
            <Check className="h-3 w-3" strokeWidth={3} /> Done
          </span>
        )}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Label({ htmlFor, children, aside }: { htmlFor?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-[#14110e]/80">
        {children}
      </label>
      {aside}
    </div>
  );
}

const inputClass =
  'w-full rounded-2xl border border-[#e4ddd2] bg-[#fdfcfa] px-4 text-[15px] text-[#14110e] outline-none transition placeholder:text-[#14110e]/30 focus:border-[#14110e] focus:bg-white focus:ring-4 focus:ring-[#14110e]/[0.06]';

function Counter({ value, min, max }: { value: number; min?: number; max?: number }) {
  const reached = min ? value >= min : true;
  return (
    <span className={`text-[12px] tabular-nums ${reached ? 'text-emerald-700' : 'text-[#8a847a]'}`}>
      {min && !reached ? `${value}/${min} min` : max ? `${value}/${max}` : value}
    </span>
  );
}

function TagInput({
  id,
  tags,
  onChange,
  placeholder,
  suggestions = [],
  max = 12,
}: {
  id: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
  suggestions?: string[];
  max?: number;
}) {
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const value = raw.trim().replace(/,$/, '');
    if (!value || tags.length >= max) return;
    if (tags.some((t) => t.toLowerCase() === value.toLowerCase())) return;
    onChange([...tags, value]);
    setDraft('');
  };
  const remaining = suggestions.filter((s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase())).slice(0, 8);
  return (
    <div>
      <div className="flex min-h-[52px] flex-wrap items-center gap-2 rounded-2xl border border-[#e4ddd2] bg-[#fdfcfa] px-3 py-2 transition focus-within:border-[#14110e] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#14110e]/[0.06]">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-[#14110e] py-1 pl-3 pr-1.5 text-[13px] text-white">
            {tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-white/20"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(',')) add(v);
            else setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add(draft);
            } else if (e.key === 'Backspace' && !draft && tags.length) {
              onChange(tags.slice(0, -1));
            }
          }}
          onBlur={() => add(draft)}
          placeholder={tags.length ? '' : placeholder}
          className="min-w-[140px] flex-1 bg-transparent py-1.5 text-[15px] outline-none placeholder:text-[#14110e]/30"
        />
      </div>
      {remaining.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {remaining.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#d6cec1] px-2.5 py-1 text-[12px] text-[#6b655c] transition hover:border-[#14110e] hover:text-[#14110e]"
            >
              <Plus className="h-3 w-3" /> {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProgressRing({ percent }: { percent: number }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-24 w-24">
      <svg viewBox="0 0 96 96" className="h-24 w-24 -rotate-90">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#efe9df" strokeWidth="8" />
        <motion.circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke={percent === 100 ? '#059669' : '#14110e'}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c - (percent / 100) * c }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl leading-none text-[#14110e]">{percent}%</span>
      </div>
    </div>
  );
}

export default function InstructorApplication() {
  const { user, isLoading, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const welcome = params.get('welcome') === '1';
  const fileRef = useRef<HTMLInputElement>(null);

  const [courses, setCourses] = useState<Course[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [saved, setSaved] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const [photoError, setPhotoError] = useState('');

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate('/login', { replace: true, state: { from: { pathname: '/instructor/application' } } });
    } else if (user.role !== 'instructor') {
      navigate('/profile', { replace: true });
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    courseService.getCatalog().then(setCourses).catch(() => setCourses([]));
  }, []);

  useEffect(() => {
    if (!user || form) return;
    const initial: FormState = {
      avatar: user.avatar || '',
      headline: user.headline || '',
      bio: user.bio || '',
      expertise: user.expertise || [],
      languages: user.languages || [],
      requestedCourseIds: user.requestedCourseIds || [],
      yearsExperience: typeof user.yearsExperience === 'number' ? String(user.yearsExperience) : '',
      teachingExperience: user.teachingExperience || '',
      linkedinUrl: user.linkedinUrl || '',
      portfolioUrl: user.portfolioUrl || '',
      sampleVideoUrl: user.sampleVideoUrl || '',
    };
    setForm(initial);
    setSaved(initial);
  }, [user, form]);

  const fields: InstructorApplicationFields = useMemo(
    () =>
      form
        ? {
            ...form,
            yearsExperience: form.yearsExperience === '' ? null : Number(form.yearsExperience),
          }
        : {},
    [form]
  );
  const progress = applicationProgress(fields);
  const dirty = form && saved ? JSON.stringify(form) !== JSON.stringify(saved) : false;
  const expertiseSuggestions = useMemo(
    () => Array.from(new Set(courses.map((c) => c.category).filter(Boolean) as string[])),
    [courses]
  );

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (isLoading || !user || !form) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f3ee]">
        <Loader2 className="h-6 w-6 animate-spin text-[#6b655c]" />
      </div>
    );
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));
  const status = user.instructorStatus || 'pending';
  const approved = status === 'approved';

  const linkErrors = {
    linkedinUrl: !isLink(form.linkedinUrl),
    portfolioUrl: !isLink(form.portfolioUrl),
    sampleVideoUrl: !isLink(form.sampleVideoUrl),
  };
  const yearsInvalid = form.yearsExperience !== '' && (Number(form.yearsExperience) < 0 || Number(form.yearsExperience) > 60);
  const blocked = Object.values(linkErrors).some(Boolean) || yearsInvalid;

  const handlePhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoError('');
    if (!file.type.startsWith('image/')) {
      setPhotoError('Choose an image file (JPG or PNG).');
      return;
    }
    try {
      set('avatar', await resizeImage(file));
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : 'Could not use that image');
    }
  };

  const save = async () => {
    if (blocked) return;
    setSaving(true);
    setError('');
    try {
      await authService.updateProfile({
        avatar: form.avatar || undefined,
        headline: form.headline.trim(),
        bio: form.bio.trim(),
        expertise: form.expertise,
        languages: form.languages,
        requestedCourseIds: form.requestedCourseIds,
        yearsExperience: form.yearsExperience === '' ? null : Number(form.yearsExperience),
        teachingExperience: form.teachingExperience.trim(),
        linkedinUrl: form.linkedinUrl.trim(),
        portfolioUrl: form.portfolioUrl.trim(),
        sampleVideoUrl: form.sampleVideoUrl.trim(),
      });
      await refreshUser();
      setSaved(form);
      setSavedAt(new Date());
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const sectionFor: Record<string, string> = {
    photo: 'identity',
    headline: 'identity',
    bio: 'about',
    expertise: 'skills',
    languages: 'skills',
    courses: 'courses',
    experience: 'experience',
    links: 'links',
    video: 'links',
  };
  const doneById = Object.fromEntries(progress.items.map((i) => [i.id, i.done]));

  return (
    <div className="min-h-screen bg-[#f6f3ee] text-[#14110e]">
      <Header variant="light" />

      <div className="mx-auto w-[min(94vw,1180px)] pb-32 pt-8 sm:pt-12">
        <AnimatePresence>
          {welcome && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 flex items-start gap-4 overflow-hidden rounded-3xl bg-[#14110e] p-6 text-white sm:p-7"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                <PartyPopper className="h-5 w-5 text-[#e8c48a]" aria-hidden />
              </span>
              <div>
                <p className="text-lg font-semibold">Your instructor account is created, {user.name.split(' ')[0]}.</p>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/70">
                  Before the Nexnoon team reviews your application, complete your teaching profile below. Reviewers
                  see exactly what you add here — complete profiles get reviewed faster and approved more often.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#b7793a]">
              {approved ? 'Teaching profile' : 'Instructor application'}
            </p>
            <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-[44px]">
              {approved ? 'Keep your profile sharp' : 'Strengthen your application'}
            </h1>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[#6b655c]">
              {approved
                ? 'Learners see this on your classes and public profile.'
                : 'Everything here is shared with the Nexnoon admin team when they review you for approval and course certification.'}
            </p>
          </div>
          {!approved && (
            <Link
              to="/instructor/pending-approval"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#ddd5c8] bg-white px-4 py-2 text-sm font-medium text-[#14110e]/75 transition hover:border-[#14110e]/40 hover:text-[#14110e]"
            >
              View application status <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-3xl border border-[#e8e2d8] bg-white p-6">
              <div className="flex items-center gap-4">
                <ProgressRing percent={progress.percent} />
                <div>
                  <p className="text-sm font-semibold">
                    {progress.ready ? 'Ready for review' : `${progress.requiredTotal - progress.requiredDone} required left`}
                  </p>
                  <p className="mt-0.5 text-[13px] leading-snug text-[#6b655c]">
                    {progress.ready
                      ? progress.done === progress.total
                        ? 'Everything is complete.'
                        : 'Add a sample video to stand out.'
                      : 'Complete these so admins can approve you.'}
                  </p>
                </div>
              </div>
              <ul className="mt-6 space-y-1">
                {progress.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => scrollTo(sectionFor[item.id])}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] transition hover:bg-[#f6f3ee]"
                    >
                      {item.done ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-[#cfc6b8]" aria-hidden />
                      )}
                      <span className={item.done ? 'text-[#14110e]/55 line-through decoration-[#14110e]/20' : 'font-medium'}>
                        {item.label}
                      </span>
                      {!item.required && (
                        <span className="ml-auto rounded-full bg-[#f3efe8] px-2 py-0.5 text-[10px] font-medium text-[#8a847a]">
                          Bonus
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-[#ebe3d4] bg-[#fbf7f0] p-4 text-[13px] leading-relaxed text-[#6b655c]">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#b7793a]" aria-hidden />
              Your LinkedIn, experience and requested courses are only visible to the Nexnoon team, not learners.
            </div>
          </aside>

          <div className="space-y-6">
            <Section
              id="identity"
              icon={UserRound}
              title="How you’ll appear"
              description="Your photo and headline show on class pages and in the admin review."
              done={doneById.photo && doneById.headline}
            >
              <div className="flex flex-wrap items-center gap-5">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-full border border-[#e4ddd2] bg-[#f3efe8]"
                  aria-label="Upload profile photo"
                >
                  {form.avatar ? (
                    <img src={form.avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-2xl font-semibold text-[#14110e]/40">
                      {user.name.slice(0, 1)}
                    </span>
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition group-hover:opacity-100">
                    <Camera className="h-5 w-5" />
                  </span>
                </button>
                <div>
                  <p className="text-sm font-medium">{user.name}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="rounded-full bg-[#14110e] px-4 py-2 text-[13px] font-medium text-white hover:bg-black"
                    >
                      {form.avatar ? 'Change photo' : 'Upload photo'}
                    </button>
                    {form.avatar && (
                      <button
                        type="button"
                        onClick={() => set('avatar', '')}
                        className="rounded-full border border-[#e4ddd2] px-4 py-2 text-[13px] font-medium text-[#14110e]/70 hover:border-[#14110e]/40"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-[12px] text-[#8a847a]">Any size — we crop and compress it for you.</p>
                  {photoError && <p className="mt-1 text-[12px] text-red-600">{photoError}</p>}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    void handlePhoto(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </div>
              <div>
                <Label htmlFor="headline" aside={<Counter value={form.headline.length} max={160} />}>
                  Teaching headline
                </Label>
                <input
                  id="headline"
                  maxLength={160}
                  value={form.headline}
                  onChange={(e) => set('headline', e.target.value)}
                  placeholder="Senior data analyst teaching Excel, SQL and dashboards"
                  className={`${inputClass} h-[52px]`}
                />
              </div>
            </Section>

            <Section
              id="about"
              icon={BookOpen}
              title="About you"
              description="Your background, what you’ve built or achieved, and how you like to teach."
              done={doneById.bio}
            >
              <div>
                <Label htmlFor="bio" aside={<Counter value={form.bio.trim().length} min={BIO_MIN} />}>
                  Bio
                </Label>
                <textarea
                  id="bio"
                  rows={6}
                  maxLength={4000}
                  value={form.bio}
                  onChange={(e) => set('bio', e.target.value)}
                  placeholder="I’ve spent 8 years as a data analyst at… I teach by building real projects with learners, one concept at a time…"
                  className={`${inputClass} resize-y py-3.5 leading-relaxed`}
                />
              </div>
            </Section>

            <Section
              id="skills"
              icon={Globe2}
              title="Expertise and languages"
              description="Type and press Enter, or tap a suggestion."
              done={doneById.expertise && doneById.languages}
            >
              <div>
                <Label htmlFor="expertise">What you can teach</Label>
                <TagInput
                  id="expertise"
                  tags={form.expertise}
                  onChange={(t) => set('expertise', t)}
                  placeholder="e.g. Excel, Public speaking, React"
                  suggestions={expertiseSuggestions}
                  max={20}
                />
              </div>
              <div>
                <Label htmlFor="languages">Languages you can teach in</Label>
                <TagInput
                  id="languages"
                  tags={form.languages}
                  onChange={(t) => set('languages', t)}
                  placeholder="e.g. English"
                  suggestions={LANGUAGE_SUGGESTIONS}
                />
              </div>
            </Section>

            <Section
              id="courses"
              icon={Briefcase}
              title="Courses you want to teach"
              description="Nexnoon certifies instructors per official course. Choose the ones you’re ready to lead."
              done={doneById.courses}
            >
              {courses.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[#ddd5c8] p-5 text-sm text-[#6b655c]">
                  No official courses are published yet. You can come back and pick courses once they’re live.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {courses.map((c) => {
                    const selected = form.requestedCourseIds.includes(c.id);
                    const langs = (c.languageOfferings || []).filter((l) => l.status !== 'inactive').map((l) => l.label);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          set(
                            'requestedCourseIds',
                            selected
                              ? form.requestedCourseIds.filter((id) => id !== c.id)
                              : [...form.requestedCourseIds, c.id].slice(0, 10)
                          )
                        }
                        className={`relative rounded-2xl border p-4 text-left transition ${
                          selected
                            ? 'border-[#14110e] bg-[#14110e] text-white shadow-[0_14px_30px_-18px_rgba(20,17,14,0.7)]'
                            : 'border-[#e4ddd2] bg-[#fdfcfa] hover:border-[#14110e]/40'
                        }`}
                      >
                        <span
                          className={`absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border ${
                            selected ? 'border-white bg-white text-[#14110e]' : 'border-[#d6cec1]'
                          }`}
                        >
                          {selected && <Check className="h-3 w-3" strokeWidth={3} />}
                        </span>
                        {c.category && (
                          <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${selected ? 'text-[#e8c48a]' : 'text-[#b7793a]'}`}>
                            {c.category}
                          </p>
                        )}
                        <p className="mt-1 pr-6 text-[15px] font-semibold leading-snug">{c.title}</p>
                        {langs.length > 0 && (
                          <p className={`mt-2 text-[12px] ${selected ? 'text-white/60' : 'text-[#8a847a]'}`}>
                            Taught in {langs.join(', ')}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </Section>

            <Section
              id="experience"
              icon={Briefcase}
              title="Teaching experience"
              description="Help reviewers understand your track record."
              done={doneById.experience}
            >
              <div className="grid gap-5 sm:grid-cols-[180px_minmax(0,1fr)]">
                <div>
                  <Label htmlFor="years">Years of experience</Label>
                  <input
                    id="years"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={60}
                    value={form.yearsExperience}
                    onChange={(e) => set('yearsExperience', e.target.value)}
                    placeholder="e.g. 5"
                    className={`${inputClass} h-[52px] ${yearsInvalid ? 'border-red-300' : ''}`}
                  />
                  {yearsInvalid && <p className="mt-1.5 text-[12px] text-red-600">Enter 0–60.</p>}
                </div>
                <div>
                  <Label
                    htmlFor="teachingExperience"
                    aside={<Counter value={form.teachingExperience.trim().length} min={EXPERIENCE_MIN} />}
                  >
                    Where and whom you’ve taught
                  </Label>
                  <textarea
                    id="teachingExperience"
                    rows={4}
                    maxLength={3000}
                    value={form.teachingExperience}
                    onChange={(e) => set('teachingExperience', e.target.value)}
                    placeholder="Bootcamps, universities, corporate training, mentoring, YouTube… Class sizes, formats, results."
                    className={`${inputClass} resize-y py-3.5 leading-relaxed`}
                  />
                </div>
              </div>
            </Section>

            <Section
              id="links"
              icon={Link2}
              title="Links reviewers can check"
              description="At least one of LinkedIn or portfolio. A sample lesson video makes the strongest case."
              done={doneById.links}
            >
              {(
                [
                  { key: 'linkedinUrl', label: 'LinkedIn profile', icon: Linkedin, placeholder: 'https://linkedin.com/in/your-name' },
                  { key: 'portfolioUrl', label: 'Portfolio or website', icon: Link2, placeholder: 'https://your-site.com or GitHub, Behance…' },
                  { key: 'sampleVideoUrl', label: 'Sample lesson video (bonus)', icon: Video, placeholder: 'https://youtube.com/… or Loom, Google Drive' },
                ] as const
              ).map(({ key, label, icon: Icon, placeholder }) => (
                <div key={key}>
                  <Label htmlFor={key}>{label}</Label>
                  <div className="relative">
                    <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a847a]" aria-hidden />
                    <input
                      id={key}
                      type="url"
                      inputMode="url"
                      value={form[key]}
                      onChange={(e) => set(key, e.target.value)}
                      placeholder={placeholder}
                      className={`${inputClass} h-[52px] pl-11 ${linkErrors[key] ? 'border-red-300 focus:border-red-400' : ''}`}
                    />
                  </div>
                  {linkErrors[key] && <p className="mt-1.5 text-[12px] text-red-600">Enter a full link starting with https://</p>}
                </div>
              ))}
            </Section>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e8e2d8] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex w-[min(94vw,1180px)] flex-wrap items-center justify-between gap-3 py-3.5">
          <div className="text-[13px] text-[#6b655c]">
            {error ? (
              <span className="text-red-600">{error}</span>
            ) : dirty ? (
              <span className="inline-flex items-center gap-2 font-medium text-[#b7793a]">
                <span className="h-2 w-2 rounded-full bg-[#e0a458]" /> Unsaved changes
              </span>
            ) : savedAt ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> Saved — the admin team sees your latest details
              </span>
            ) : (
              <span>
                {progress.requiredDone}/{progress.requiredTotal} required complete
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!approved && !dirty && progress.ready && (
              <Link
                to="/instructor/pending-approval"
                className="rounded-full border border-[#e4ddd2] px-5 py-2.5 text-sm font-medium text-[#14110e]/75 hover:border-[#14110e]/40"
              >
                Done
              </Link>
            )}
            <button
              type="button"
              onClick={() => void save()}
              disabled={!dirty || saving || blocked}
              className="inline-flex items-center gap-2 rounded-full bg-[#14110e] px-6 py-2.5 text-sm font-medium text-white shadow-[0_10px_24px_-12px_rgba(20,17,14,0.7)] transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Saving…' : 'Save application'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
