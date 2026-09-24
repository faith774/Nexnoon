// Export API client
export { default as apiClient, getErrorMessage, getErrorCode, uploadFile, submitAssignmentAnswer } from './client';

// Export all services
export { authService } from './services/auth.service';
export { classService } from './services/class.service';
export { courseService } from './services/course.service';
export { notificationService } from './services/notification.service';

// Re-export types for convenience
export type * from '@/types/api';
