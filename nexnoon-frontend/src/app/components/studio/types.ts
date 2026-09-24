import type { Class } from '@/types/api';

export type StudioTab = 'today' | 'classes' | 'schedule' | 'grading' | 'learners' | 'performance' | 'earnings';
export type ClassPanel = 'overview' | 'sessions' | 'roster' | 'attendance' | 'assignments';
export type TeamRole = 'lead' | 'support' | 'invited';

export type StudioClass = Class & {
  myRole: TeamRole;
  courseTitle: string | null;
  languageLabel: string | null;
  freeApproval?: { status: 'pending' | 'approved' | 'rejected'; note?: string; decidedAt?: string } | null;
  assignments?: { id: string; title: string; description?: string; dueDate?: string; attachmentUrl?: string }[];
  ops: {
    enrolled: number;
    maxStudents: number;
    seatsLeft: number;
    fillRate: number;
    sessionsTotal: number;
    sessionsHeld: number;
    nextSessionAt: string | null;
    lastSessionAt: string | null;
    attendanceRate: number;
    completionRate: number;
    dropped: number;
    ungraded: number;
    attendanceGaps: number;
    avgRating: number | null;
    reviewsCount: number;
  };
};

export type StudioSession = {
  id: string;
  classId: string;
  classTitle: string;
  classTimeZone: string | null;
  sessionNumber?: number;
  title: string;
  startTime: string;
  endTime: string;
  status: string;
  held: boolean;
  expected: number;
  attended: number | null;
  needsAttendance: boolean;
};

export type GradingItem = {
  id: string;
  classId: string;
  classTitle: string;
  assignmentId: string;
  assignmentTitle: string;
  dueDate: string | null;
  learnerId: string;
  learnerName: string;
  content: string;
  attachmentUrl: string;
  submittedAt: string;
  late: boolean;
};

export type StudioLearner = {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatar: string;
  classId: string;
  classTitle: string;
  status: 'active' | 'completed' | 'dropped';
  progress: number;
  enrolledAt: string;
  attendanceRate: number | null;
  sessionsAttended: number;
  sessionsHeld: number;
  lastSeenAt: string | null;
  assignmentsTotal: number;
  submitted: number;
  avgGrade: number | null;
};

export type StudioReview = {
  id: string;
  classId: string;
  classTitle: string;
  learnerName: string;
  rating: number;
  comment: string;
  status: string;
  createdAt: string;
};

export type Certification = {
  id: string;
  courseId: string;
  courseTitle: string;
  languageLabel: string | null;
  status: 'active' | 'expired' | 'suspended' | 'revoked';
  certifiedAt: string | null;
  expiresAt: string | null;
  note: string;
};

export type QualityWeights = {
  learnerRating: number;
  completion: number;
  attendance: number;
  feedback: number;
  adminEvaluation: number;
};

export type Performance = {
  qualityScore: number;
  avgRating: number;
  reviewsCount: number;
  satisfaction: number;
  feedbackCount: number;
  completionRate: number;
  completionBasis: 'finished_cohorts' | 'progress';
  attendanceRate: number;
  heldSessions: number;
  dropoutRate: number;
  dropped: number;
  adminEvaluation: number;
  classesTaught: number;
  classesLed: number;
  publishedClasses: number;
  totalStudents: number;
  incidentsOpen: number;
  weights: QualityWeights;
};

export type StudioData = {
  me: {
    id: string;
    fullName: string;
    email: string;
    avatar: string;
    instructorStatus: string;
    lifecycleStage: string | null;
    reviewDueAt: string | null;
    renewedAt: string | null;
    improvementPlan: { notes?: string; startedAt?: string; dueAt?: string } | null;
    memberSince: string;
  };
  classes: StudioClass[];
  sessions: StudioSession[];
  nextSession: StudioSession | null;
  gradingQueue: GradingItem[];
  attendanceGaps: StudioSession[];
  learners: StudioLearner[];
  reviews: StudioReview[];
  certifications: Certification[];
  invites: { classId: string; title: string; leadName: string; startDate: string | null }[];
  performance: Performance;
  actions: {
    ungraded: number;
    attendanceGaps: number;
    invites: number;
    freePending: number;
    freeRejected: number;
    drafts: number;
    publishedWithoutSessions: number;
    certsExpiring: number;
    reviewDueSoon: boolean;
  };
  settings: { maxClassSeats: number };
};

export type Flash = { type: 'ok' | 'err'; text: string };
