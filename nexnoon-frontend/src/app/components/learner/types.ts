export type ClassState = 'upcoming' | 'in_progress' | 'finished' | 'completed' | 'cancelled' | 'left';
export type AttendanceMark = 'present' | 'late' | 'absent' | 'excused' | 'missed';
export type AssignmentState = 'due' | 'overdue' | 'submitted' | 'graded';

export interface LearnerSession {
  id: string;
  classId: string;
  classTitle: string;
  title: string;
  sessionNumber: number;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'live' | 'completed' | 'cancelled';
  instructor: string;
  thumbnail: string;
}

export interface PastSession extends LearnerSession {
  attendance: AttendanceMark;
  hasRecording: boolean;
}

export interface LearnerClass {
  id: string;
  enrollmentId: string;
  title: string;
  category: string;
  language: string;
  thumbnail: string;
  instructor: { id: string; name: string; avatar: string };
  state: ClassState;
  enrollmentStatus: 'active' | 'completed' | 'dropped';
  progress: number;
  attended: number;
  held: number;
  totalSessions: number;
  nextSession: { id: string; title: string; startTime: string; endTime: string; status: string } | null;
  firstSessionAt: string | null;
  lastSessionAt: string | null;
  assignments: { total: number; submitted: number; graded: number; averageScore: number | null; open: number };
  certificateId: string | null;
  enrolledAt: string;
  completedAt: string | null;
  droppedAt: string | null;
  cancellationReason: string | null;
  canReview: boolean;
  review: { id: string; rating: number; comment: string } | null;
  payment: { status: string; amount: number; currency: string } | null;
}

export interface LearnerAssignment {
  id: string;
  classId: string;
  classTitle: string;
  title: string;
  description: string;
  dueDate: string | null;
  hasAttachment: boolean;
  status: AssignmentState;
  submittedAt: string | null;
  grade: { score: number; maxScore: number; feedback: string; gradedAt: string | null } | null;
}

export interface LearnerCertificate {
  certificateId: string;
  classId: string;
  classTitle: string;
  instructor: string;
  thumbnail: string;
  completedAt: string | null;
}

export interface LearnerPayment {
  id: string;
  classId: string;
  classTitle: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  createdAt: string;
  refundableUntil: string | null;
}

export interface LearnerWaitlist {
  classId: string;
  classTitle: string;
  thumbnail: string;
  instructor: string;
  startDate: string | null;
  status: 'waiting' | 'offered';
  position: number | null;
  joinedAt: string;
  offerExpiresAt: string | null;
}

export interface LearnerData {
  profile: { name: string; firstName: string; timezone: string };
  policy: { joinEarlyMinutes: number; refundWindowDays: number };
  summary: {
    inProgress: number;
    upcoming: number;
    completed: number;
    finished: number;
    certificates: number;
    assignmentsDue: number;
    overdue: number;
    hoursLearned: number;
    attendanceRate: number | null;
    sessionsThisWeek: number;
  };
  nextUp: LearnerSession | null;
  classes: LearnerClass[];
  upcomingSessions: LearnerSession[];
  pastSessions: PastSession[];
  assignments: LearnerAssignment[];
  certificates: LearnerCertificate[];
  payments: LearnerPayment[];
  waitlist: LearnerWaitlist[];
}

export type LearnerTab = 'overview' | 'schedule' | 'classes' | 'assignments' | 'certificates' | 'payments';
