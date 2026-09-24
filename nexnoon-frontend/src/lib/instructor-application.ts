export type InstructorApplicationFields = {
  avatar?: string;
  headline?: string;
  bio?: string;
  languages?: string[];
  expertise?: string[];
  timezone?: string;
  requestedCourseIds?: string[];
  yearsExperience?: number | null;
  teachingExperience?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  sampleVideoUrl?: string;
};

export type ChecklistItem = {
  id: string;
  label: string;
  hint: string;
  done: boolean;
  required: boolean;
};

export const BIO_MIN = 150;
export const EXPERIENCE_MIN = 80;

export function applicationChecklist(p: InstructorApplicationFields): ChecklistItem[] {
  return [
    {
      id: 'photo',
      label: 'Profile photo',
      hint: 'A clear, friendly headshot. Learners and reviewers trust a face.',
      done: Boolean(p.avatar),
      required: true,
    },
    {
      id: 'headline',
      label: 'Teaching headline',
      hint: 'One line on what you teach, e.g. “Senior data analyst teaching Excel & SQL”.',
      done: (p.headline || '').trim().length >= 10,
      required: true,
    },
    {
      id: 'bio',
      label: 'Bio',
      hint: `Your background and teaching style — at least ${BIO_MIN} characters.`,
      done: (p.bio || '').trim().length >= BIO_MIN,
      required: true,
    },
    {
      id: 'expertise',
      label: 'Expertise',
      hint: 'Skills and topics you can teach confidently.',
      done: (p.expertise || []).length > 0,
      required: true,
    },
    {
      id: 'languages',
      label: 'Teaching languages',
      hint: 'Every language you can deliver a full class in.',
      done: (p.languages || []).length > 0,
      required: true,
    },
    {
      id: 'courses',
      label: 'Courses you want to teach',
      hint: 'Nexnoon certifies instructors per course — pick the ones you’re ready for.',
      done: (p.requestedCourseIds || []).length > 0,
      required: true,
    },
    {
      id: 'experience',
      label: 'Teaching experience',
      hint: `Years of experience plus where and whom you’ve taught (${EXPERIENCE_MIN}+ characters).`,
      done: typeof p.yearsExperience === 'number' && (p.teachingExperience || '').trim().length >= EXPERIENCE_MIN,
      required: true,
    },
    {
      id: 'links',
      label: 'LinkedIn or portfolio',
      hint: 'A link reviewers can use to verify your work.',
      done: Boolean(p.linkedinUrl || p.portfolioUrl),
      required: true,
    },
    {
      id: 'video',
      label: 'Sample lesson video',
      hint: 'Optional but powerful: a 2–5 minute clip of you teaching (YouTube, Loom, Drive).',
      done: Boolean(p.sampleVideoUrl),
      required: false,
    },
  ];
}

export function applicationProgress(p: InstructorApplicationFields) {
  const items = applicationChecklist(p);
  const required = items.filter((i) => i.required);
  const requiredDone = required.filter((i) => i.done).length;
  const done = items.filter((i) => i.done).length;
  return {
    items,
    done,
    total: items.length,
    requiredDone,
    requiredTotal: required.length,
    percent: Math.round((done / items.length) * 100),
    ready: requiredDone === required.length,
  };
}
