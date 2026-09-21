export interface ClassDetails {
  overview?: string;
  instructorTitle?: string;
  instructorBio?: string;
  instructorImage?: string;
  previewVideoUrl?: string;
  curriculumIntro?: string;
  certificateInfo?: string;
  outcomes?: string[];
  curriculum?: { title: string; topics: string[]; project: string }[];
  faqs?: { question: string; answer: string }[];
}

// Core API Types

export interface APIResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: APIError[];
}

export interface APIError {
  field?: string;
  message: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface RequestParams {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
  filters?: Record<string, any>;
}

// User & Authentication Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  avatar?: string;
  role: 'student' | 'instructor' | 'admin';
  instructorStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: 'student' | 'instructor';
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
}

// Class/Course Types
export interface Class {
  details?: ClassDetails;
  language?: string;
  maxStudents?: number;
  learningOutcomes?: string[];
  prerequisites?: string[];
  materials?: string[];
  assignments?: { id: string; title: string; description?: string; dueDate?: string; attachmentUrl?: string }[];
  id: string;
  title: string;
  description: string;
  category: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  price: number;
  currency: string;
  instructor: {
    id: string;
    name: string;
    avatar?: string;
    bio?: string;
    rating?: number;
  };
  thumbnail?: string;
  duration: number; // in minutes
  totalSessions: number;
  enrolledStudents: number;
  rating: number;
  reviewsCount: number;
  isLive: boolean;
  startDate?: string;
  endDate?: string;
  schedule?: ClassSchedule[];
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface ClassSchedule {
  id: string;
  classId: string;
  sessionNumber: number;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  zoomLink?: string;
  zoomMeetingId?: string;
  zoomPasscode?: string;
  status: 'scheduled' | 'live' | 'completed' | 'cancelled';
  recordingUrl?: string;
}

/** A student's answer to one of a class's embedded `assignments` entries. */
export interface AssignmentAnswer {
  id: string;
  classId: string;
  assignmentId: string;
  userId: string;
  content?: string;
  attachmentUrl?: string;
  submittedAt: string;
}

export interface CreateClassRequest {
  details?: ClassDetails;
  thumbnail?: string;
  language?: string;
  maxStudents?: number;
  learningOutcomes?: string[];
  prerequisites?: string[];
  materials?: string[];
  status?: 'draft' | 'published' | 'archived';
  title: string;
  description: string;
  category: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  price: number;
  duration: number;
  totalSessions: number;
  startDate?: string;
  schedule?: (Omit<ClassSchedule, 'id' | 'classId' | 'status'> & { status?: ClassSchedule['status'] })[];
}

export interface UpdateClassRequest extends Partial<CreateClassRequest> {
  status?: 'draft' | 'published' | 'archived';
}

// Enrollment Types
export interface Enrollment {
  id: string;
  classId: string;
  userId: string;
  status: 'active' | 'completed' | 'dropped';
  progress: number;
  /** Session IDs this student has attended (recorded when they successfully join). */
  attendedSessions?: string[];
  enrolledAt: string;
  completedAt?: string;
  certificateUrl?: string;
}

export interface EnrollmentRequest {
  classId: string;
  paymentMethodId?: string;
}

// Payment Types
export interface Payment {
  id: string;
  userId: string;
  classId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentMethod: string;
  transactionId?: string;
  createdAt: string;
}

export interface PaymentRequest {
  classId: string;
  paymentMethodId: string;
  amount: number;
  currency: string;
}

// Notification Types
export type NotificationType = 'class' | 'payment' | 'achievement' | 'message' | 'system';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  actionUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// Material Types
export interface Material {
  id: string;
  classId: string;
  sessionId?: string;
  title: string;
  description?: string;
  type: 'pdf' | 'video' | 'document' | 'link' | 'code';
  url: string;
  size?: number;
  uploadedAt: string;
}

export interface CreateMaterialRequest {
  classId: string;
  sessionId?: string;
  title: string;
  description?: string;
  type: Material['type'];
  file?: File;
  url?: string;
}

// Assignment Types
export interface Assignment {
  id: string;
  classId: string;
  sessionId?: string;
  title: string;
  description: string;
  dueDate: string;
  maxPoints: number;
  status: 'draft' | 'published';
  createdAt: string;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  userId: string;
  content: string;
  attachments?: string[];
  submittedAt: string;
  grade?: number;
  feedback?: string;
  gradedAt?: string;
}

export interface CreateAssignmentRequest {
  classId: string;
  sessionId?: string;
  title: string;
  description: string;
  dueDate: string;
  maxPoints: number;
}

export interface SubmitAssignmentRequest {
  assignmentId: string;
  content: string;
  attachments?: File[];
}

export interface GradeAssignmentRequest {
  submissionId: string;
  grade: number;
  feedback?: string;
}

// Review/Rating Types
export interface Review {
  id: string;
  classId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  comment?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReviewRequest {
  classId: string;
  rating: number;
  comment?: string;
}

export interface MarkNotificationReadRequest {
  notificationId: string;
}

// Analytics Types
export interface InstructorAnalytics {
  totalEarnings: number;
  totalStudents: number;
  totalClasses: number;
  averageRating: number;
  earnings: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    thisYear: number;
  };
  recentEnrollments: number;
  activeClasses: number;
}

export interface StudentAnalytics {
  enrolledClasses: number;
  completedClasses: number;
  inProgressClasses: number;
  totalLearningHours: number;
  certificatesEarned: number;
  averageProgress: number;
}

export interface AdminAnalytics {
  totalUsers: number;
  totalClasses: number;
  totalRevenue: number;
  activeStudents: number;
  activeInstructors: number;
  recentSignups: number;
  platformGrowth: {
    users: number;
    classes: number;
    revenue: number;
  };
}

// Admin Types
export interface PendingDeletion {
  id: string;
  classId: string;
  className: string;
  instructorId: string;
  instructorName: string;
  reason: string;
  requestedAt: string;
  studentCount: number;
  revenueImpact: number;
  status: 'pending' | 'approved' | 'denied';
}

export interface ApproveDeletionRequest {
  deletionId: string;
  approved: boolean;
  adminNotes?: string;
}

// Chat/Discussion Types
export interface Message {
  id: string;
  classId: string;
  sessionId?: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  attachments?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface SendMessageRequest {
  classId: string;
  sessionId?: string;
  content: string;
  attachments?: File[];
}

// Certificate Types
export interface Certificate {
  id: string;
  userId: string;
  classId: string;
  className: string;
  instructorName: string;
  issuedAt: string;
  certificateUrl: string;
  verificationCode: string;
}
