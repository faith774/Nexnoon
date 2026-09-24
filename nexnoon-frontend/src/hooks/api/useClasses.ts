import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { classService } from '@/lib/api';
import type {
  RequestParams,
  CreateClassRequest,
  UpdateClassRequest,
  ClassSchedule,
  EnrollmentRequest,
  CreateReviewRequest,
} from '@/types/api';
import { getErrorMessage } from '@/lib/api';
import { toast } from 'sonner';

// Query Keys
export const CLASS_KEYS = {
  all: ['classes'] as const,
  lists: () => [...CLASS_KEYS.all, 'list'] as const,
  list: (params?: RequestParams) => [...CLASS_KEYS.lists(), params] as const,
  details: () => [...CLASS_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...CLASS_KEYS.details(), id] as const,
  schedule: (id: string) => [...CLASS_KEYS.detail(id), 'schedule'] as const,
  enrollments: (id: string) => [...CLASS_KEYS.detail(id), 'enrollments'] as const,
  reviews: (id: string) => [...CLASS_KEYS.detail(id), 'reviews'] as const,
  myClasses: () => [...CLASS_KEYS.all, 'my'] as const,
  myEnrollments: () => [...CLASS_KEYS.all, 'enrollments', 'my'] as const,
};

/**
 * Get classes with pagination and filters
 */
export function useClasses(params?: RequestParams) {
  return useQuery({
    queryKey: CLASS_KEYS.list(params),
    queryFn: () => classService.getClasses(params),
  });
}

/**
 * Get single class by ID
 */
export function useClass(classId: string) {
  return useQuery({
    queryKey: CLASS_KEYS.detail(classId),
    queryFn: () => classService.getClass(classId),
    enabled: !!classId,
  });
}

/**
 * Get class schedule
 */
export function useClassSchedule(classId: string) {
  return useQuery({
    queryKey: CLASS_KEYS.schedule(classId),
    queryFn: () => classService.getClassSchedule(classId),
    enabled: !!classId,
  });
}

/**
 * Get my classes (instructor)
 */
export function useMyClasses(params?: RequestParams) {
  return useQuery({
    queryKey: CLASS_KEYS.myClasses(),
    queryFn: () => classService.getMyClasses(params),
  });
}

/**
 * Get my enrollments (student)
 */
export function useMyEnrollments(params?: RequestParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: CLASS_KEYS.myEnrollments(),
    queryFn: () => classService.getUserEnrollments(params),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Search classes
 */
export function useSearchClasses(query: string, params?: RequestParams) {
  return useQuery({
    queryKey: [...CLASS_KEYS.lists(), 'search', query, params],
    queryFn: () => classService.searchClasses(query, params),
    enabled: query.length > 0,
  });
}

/**
 * Get classes by category
 */
export function useClassesByCategory(category: string, params?: RequestParams) {
  return useQuery({
    queryKey: [...CLASS_KEYS.lists(), 'category', category, params],
    queryFn: () => classService.getClassesByCategory(category, params),
    enabled: !!category,
  });
}

/**
 * Get class reviews
 */
export function useClassReviews(classId: string, params?: RequestParams) {
  return useQuery({
    queryKey: CLASS_KEYS.reviews(classId),
    queryFn: () => classService.getClassReviews(classId, params),
    enabled: !!classId,
  });
}

/**
 * Create class mutation
 */
export function useCreateClass() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateClassRequest) => classService.createClass(data),
    onSuccess: () => {
      // Invalidate my classes list
      queryClient.invalidateQueries({ queryKey: CLASS_KEYS.myClasses() });
      
      toast.success('Class created successfully!');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/**
 * Update class mutation
 */
export function useUpdateClass(classId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: UpdateClassRequest) => classService.updateClass(classId, data),
    onSuccess: () => {
      // Invalidate class details and my classes list
      queryClient.invalidateQueries({ queryKey: CLASS_KEYS.detail(classId) });
      queryClient.invalidateQueries({ queryKey: CLASS_KEYS.myClasses() });
      
      toast.success('Class updated successfully!');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/**
 * Delete class mutation
 */
export function useDeleteClass() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (classId: string) => classService.deleteClass(classId),
    onSuccess: () => {
      // Invalidate my classes list
      queryClient.invalidateQueries({ queryKey: CLASS_KEYS.myClasses() });
      
      toast.success('Class deleted successfully');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/**
 * Request class deletion mutation
 */
export function useRequestClassDeletion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ classId, reason }: { classId: string; reason: string }) =>
      classService.requestDeletion(classId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLASS_KEYS.myClasses() });
      
      toast.success('Deletion request submitted. Admin will review it.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/**
 * Add session mutation
 */
export function useAddSession(classId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (session: Omit<ClassSchedule, 'id' | 'classId'>) =>
      classService.addSession(classId, {
        sessionNumber: session.sessionNumber,
        title: session.title,
        description: session.description,
        startTime: session.startTime,
        endTime: session.endTime,
        status: session.status || 'scheduled',
        moduleId: session.moduleId,
        ...(session.meetingUrl ? { meetingUrl: session.meetingUrl } : {}),
      }),
    onSuccess: (data, _vars, _ctx) => {
      queryClient.invalidateQueries({ queryKey: CLASS_KEYS.schedule(classId) });
      queryClient.invalidateQueries({ queryKey: CLASS_KEYS.detail(classId) });
      queryClient.invalidateQueries({ queryKey: CLASS_KEYS.myClasses() });
      toast.success('Session saved');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/**
 * Update session mutation
 */
export function useUpdateSession(classId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ sessionId, data }: { sessionId: string; data: Partial<ClassSchedule> }) =>
      classService.updateSession(classId, sessionId, {
        title: data.title,
        description: data.description,
        startTime: data.startTime,
        endTime: data.endTime,
        moduleId: data.moduleId,
        status: data.status,
        meetingUrl: data.meetingUrl,
        recordingUrl: data.recordingUrl,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLASS_KEYS.schedule(classId) });
      queryClient.invalidateQueries({ queryKey: CLASS_KEYS.detail(classId) });
      toast.success('Session updated');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/** Create (or retry creating) the platform Zoom meeting for a session. */
export function useEnsureZoomMeeting(classId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => classService.ensureZoomMeeting(classId, sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLASS_KEYS.schedule(classId) });
      toast.success('Zoom meeting ready');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/**
 * Delete session mutation
 */
export function useDeleteSession(classId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (sessionId: string) => classService.deleteSession(classId, sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLASS_KEYS.schedule(classId) });
      queryClient.invalidateQueries({ queryKey: CLASS_KEYS.detail(classId) });
      queryClient.invalidateQueries({ queryKey: CLASS_KEYS.myClasses() });
      toast.success('Session removed');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/**
 * Enroll in class mutation
 */
export function useEnrollInClass() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: EnrollmentRequest) => classService.enrollInClass(data),
    onSuccess: (_, variables) => {
      // Invalidate my enrollments and class details
      queryClient.invalidateQueries({ queryKey: CLASS_KEYS.myEnrollments() });
      queryClient.invalidateQueries({ queryKey: CLASS_KEYS.detail(variables.classId) });
      
      toast.success('Successfully enrolled in class!');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/**
 * Drop class mutation
 */
export function useDropClass() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (enrollmentId: string) => classService.dropClass(enrollmentId),
    onSuccess: () => {
      // Invalidate my enrollments
      queryClient.invalidateQueries({ queryKey: CLASS_KEYS.myEnrollments() });
      
      toast.success('Successfully dropped class');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/**
 * Create review mutation
 */
export function useCreateReview() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateReviewRequest) => classService.createReview(data),
    onSuccess: (_, variables) => {
      // Invalidate class reviews and details
      queryClient.invalidateQueries({ queryKey: CLASS_KEYS.reviews(variables.classId) });
      queryClient.invalidateQueries({ queryKey: CLASS_KEYS.detail(variables.classId) });
      
      toast.success('Review submitted successfully!');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/**
 * Update review mutation
 */
export function useUpdateReview(classId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ reviewId, data }: { reviewId: string; data: Partial<CreateReviewRequest> }) =>
      classService.updateReview(reviewId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLASS_KEYS.reviews(classId) });
      queryClient.invalidateQueries({ queryKey: CLASS_KEYS.detail(classId) });
      
      toast.success('Review updated successfully');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/**
 * Delete review mutation
 */
export function useDeleteReview(classId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (reviewId: string) => classService.deleteReview(reviewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLASS_KEYS.reviews(classId) });
      queryClient.invalidateQueries({ queryKey: CLASS_KEYS.detail(classId) });
      
      toast.success('Review deleted successfully');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}
