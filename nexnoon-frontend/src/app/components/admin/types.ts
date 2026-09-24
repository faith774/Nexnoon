import type { Class } from '@/types/api';

export type Account = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  instructorStatus?: string;
  zoomEmail?: string;
  zoomHostEnabled?: boolean;
  createdAt: string;
  enrollmentCount?: number;
  adminEvaluation?: number;
  approvedCourseIds?: string[];
  avatar?: string;
  headline?: string;
  bio?: string;
  languages?: string[];
  expertise?: string[];
  timezone?: string;
  isEmailVerified?: boolean;
  requestedCourseIds?: string[];
  yearsExperience?: number | null;
  teachingExperience?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  sampleVideoUrl?: string;
  applicationUpdatedAt?: string | null;
  certifications?: Certification[];
  lifecycle?: Lifecycle;
};

export type LifecycleStage =
  | 'applied'
  | 'review'
  | 'interview'
  | 'training'
  | 'certified'
  | 'active'
  | 'improvement'
  | 'suspended'
  | 'removed'
  | 'rejected';

export type Certification = {
  id: string;
  courseId: string;
  /** null = legacy grant covering every language of the course. */
  languageOfferingId: string | null;
  status: 'active' | 'suspended' | 'revoked' | 'expired';
  certifiedAt: string;
  expiresAt: string | null;
  note: string;
};

export type Lifecycle = {
  stage: LifecycleStage | null;
  interview: { scheduledAt?: string; result?: 'pass' | 'fail'; notes?: string; decidedAt?: string } | null;
  trainingCompletedAt: string | null;
  improvementPlan: { notes?: string; startedAt?: string; dueAt?: string } | null;
  renewedAt: string | null;
  reviewDueAt: string | null;
  history: { stage: string; action: string; note?: string; at: string; byName?: string }[];
};

export type Incident = {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'investigating' | 'resolved' | 'dismissed';
  title: string;
  description: string;
  resolution: string;
  classId: string | null;
  classTitle: string | null;
  instructorId: string | null;
  instructorName: string | null;
  learnerId: string | null;
  learnerName: string | null;
  reportedByName: string;
  reporterRole: string;
  occurredAt: string;
  resolvedAt: string | null;
  createdAt: string;
};

export type ModeratedReview = {
  id: string;
  classId: string;
  classTitle: string;
  instructorId: string;
  instructorName: string;
  userId: string;
  userName: string;
  userEmail: string;
  rating: number;
  comment: string;
  status: 'visible' | 'flagged' | 'hidden';
  moderationNote: string;
  moderatedAt: string | null;
  createdAt: string;
};

export type Payment = {
  id: string;
  classId: string;
  classTitle?: string;
  student?: string;
  userId?: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
};

export type QualityWeights = {
  learnerRating: number;
  completion: number;
  attendance: number;
  feedback: number;
  adminEvaluation: number;
};

export type InstructorStat = {
  id: string;
  fullName: string;
  email: string;
  instructorStatus: string;
  adminEvaluation?: number;
  classesTaught: number;
  publishedClasses: number;
  classIds?: string[];
  totalStudents: number;
  totalEarnings: number;
  avgRating: number;
  reviewsCount: number;
  completionRate: number;
  attendanceRate: number;
  qualityScore: number;
  assignmentCount?: number;
  createdAt: string;
  lifecycleStage?: LifecycleStage | null;
  reviewDueAt?: string | null;
  improvementDueAt?: string | null;
  activeCertifications?: number;
  classesLed?: number;
  satisfaction?: number;
  feedbackCount?: number;
  completionBasis?: 'finished_cohorts' | 'progress';
  heldSessions?: number;
  dropoutRate?: number;
  dropped?: number;
  incidentsTotal?: number;
  incidentsOpen?: number;
  incidentsHighOpen?: number;
};

export type ClassOp = {
  id: string;
  title: string;
  status: string;
  category: string;
  enrolledStudents: number;
  maxStudents: number;
  fillRate: number;
  seatsLeft: number;
  price: number;
  currency: string;
  thumbnail?: string;
  instructorName?: string;
  instructorId?: string;
  teachingTeamCount: number;
  assignmentCount?: number;
  submissionCount?: number;
  sessionCount?: number;
  nextSessionTitle?: string | null;
  nextSessionStart?: string | null;
  timezone?: string | null;
  cancelledAt?: string | null;
  freeApproval?: { status: 'pending' | 'approved' | 'rejected'; requestedAt: string | null; note: string } | null;
  createdAt: string;
};

export type EnrollmentRow = {
  id: string;
  userId: string;
  learnerName: string;
  learnerEmail: string;
  classId: string;
  classTitle: string;
  instructorName: string;
  instructorId: string;
  status: string;
  progress: number;
  enrolledAt: string;
  certificateUrl?: string | null;
};

export type AssignmentOp = {
  id: string;
  classId: string;
  classTitle: string;
  instructorName: string;
  instructorId: string;
  title: string;
  description: string;
  dueDate?: string | null;
  submissionCount: number;
  enrolledStudents: number;
};

export type ActivityItem = {
  id: string;
  category: string;
  action: string;
  message: string;
  createdAt: string;
  actorName?: string;
};

export type Course = {
  id: string;
  title: string;
  slug: string;
  description: string;
  outcomes: string[];
  curriculumTemplate?: { id: string; title: string; description?: string }[];
  officialPreviewUrl?: string;
  certificateNotes?: string;
  category?: string;
  languageOfferings?: { id: string; code: string; label: string; status: string }[];
  pricing?: { minPrice: number | null; maxPrice: number | null };
  status: 'draft' | 'published' | 'archived' | string;
  createdAt: string;
  updatedAt: string;
};

export type PlatformSettings = {
  maxClassSeats: number;
  qualityWeights?: QualityWeights;
  platformFeePercent?: number;
  refundWindowDays?: number;
  minPayout?: number;
  payoutFeePercent?: number;
  payoutFeeFixed?: number;
};

export type AdminSummary = {
  totalUsers: number;
  totalLearners: number;
  totalInstructors: number;
  pendingInstructors: number;
  pendingPayouts?: number;
  urgentIncidents?: number;
  suspendedInstructors?: number;
  totalClasses: number;
  publishedClasses: number;
  totalEnrollments?: number;
  totalAssignments?: number;
  totalSubmissions?: number;
  platformGmv: number;
  avgFillRate?: number;
  nearFullClasses?: number;
  lowFillClasses?: number;
  totalCourses?: number;
  publishedCourses?: number;
};

export type AdminData = {
  classes: Class[];
  payments: Payment[];
  users?: Account[];
  instructorStats?: InstructorStat[];
  classOps?: ClassOp[];
  courses?: Course[];
  enrollments?: EnrollmentRow[];
  assignmentOps?: AssignmentOp[];
  activity?: ActivityItem[];
  summary?: AdminSummary;
  settings?: PlatformSettings;
};

export type AdminTab =
  | 'overview'
  | 'kpis'
  | 'reviews'
  | 'payouts'
  | 'instructors'
  | 'courses'
  | 'quality'
  | 'classes'
  | 'learners'
  | 'assignments'
  | 'activity'
  | 'settings';

export type Flash = { type: 'ok' | 'err'; text: string };

/** One-shot hints passed when jumping between tabs (e.g. "open classes filtered to near-full"). */
export type AdminIntent = {
  instructorFilter?: 'all' | 'pending' | 'approved' | 'rejected' | 'suspended';
  classFill?: 'all' | 'near-full' | 'low-fill';
  classStatus?: 'free-approval';
  openClassId?: string;
  openCourseId?: string;
  openLearnerId?: string;
};
