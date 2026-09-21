import apiClient from '../client';
import type {
  APIResponse,
  PaginatedResponse,
  RequestParams,
  Class,
  CreateClassRequest,
  UpdateClassRequest,
  ClassSchedule,
  Enrollment,
  EnrollmentRequest,
  Review,
  CreateReviewRequest,
} from '@/types/api';

export const classService = {
  /**
   * Get all classes with pagination and filters
   */
  async getClasses(params?: RequestParams): Promise<PaginatedResponse<Class>> {
    const response = await apiClient.get<APIResponse<PaginatedResponse<Class>>>(
      '/classes',
      { params }
    );
    return response.data.data;
  },

  /**
   * Get single class by ID
   */
  async getClass(classId: string): Promise<Class> {
    if (!classId || classId === 'undefined' || classId === 'null') {
      return Promise.reject(new Error('Invalid class ID'));
    }
    const response = await apiClient.get<APIResponse<Class>>(`/classes/${classId}`);
    return response.data.data;
  },

  /**
   * Create new class (instructor only)
   */
  async createClass(data: CreateClassRequest): Promise<Class> {
    const response = await apiClient.post<APIResponse<Class>>('/classes', data);
    return response.data.data;
  },

  /**
   * Update class (instructor only)
   */
  async updateClass(classId: string, data: UpdateClassRequest): Promise<Class> {
    const response = await apiClient.patch<APIResponse<Class>>(
      `/classes/${classId}`,
      data
    );
    return response.data.data;
  },

  /**
   * Delete class (instructor/admin only)
   */
  async deleteClass(classId: string): Promise<void> {
    await apiClient.delete(`/classes/${classId}`);
  },

  /**
   * Request class deletion (instructor only)
   */
  async requestDeletion(classId: string, reason: string): Promise<void> {
    await apiClient.post(`/classes/${classId}/deletion-request`, { reason });
  },

  /**
   * Get class schedule/sessions
   */
  async getClassSchedule(classId: string): Promise<ClassSchedule[]> {
    const response = await apiClient.get<APIResponse<ClassSchedule[]>>(
      `/classes/${classId}/schedule`
    );
    return response.data.data;
  },

  /**
   * Add session to class schedule
   */
  async addSession(
    classId: string,
    session: Omit<ClassSchedule, 'id' | 'classId'>
  ): Promise<ClassSchedule> {
    const response = await apiClient.post<APIResponse<ClassSchedule>>(
      `/classes/${classId}/schedule`,
      session
    );
    return response.data.data;
  },

  /**
   * Update session
   */
  async updateSession(
    classId: string,
    sessionId: string,
    data: Partial<ClassSchedule>
  ): Promise<ClassSchedule> {
    const response = await apiClient.patch<APIResponse<ClassSchedule>>(
      `/classes/${classId}/schedule/${sessionId}`,
      data
    );
    return response.data.data;
  },

  /**
   * Delete session
   */
  async deleteSession(classId: string, sessionId: string): Promise<void> {
    await apiClient.delete(`/classes/${classId}/schedule/${sessionId}`);
  },

  /**
   * Enroll in class
   */
  async enrollInClass(data: EnrollmentRequest): Promise<Enrollment> {
    const response = await apiClient.post<APIResponse<Enrollment>>(
      '/enrollments',
      data
    );
    return response.data.data;
  },

  /**
   * Get user's enrollments
   */
  async getUserEnrollments(params?: RequestParams): Promise<PaginatedResponse<Enrollment>> {
    const response = await apiClient.get<APIResponse<PaginatedResponse<Enrollment>>>(
      '/enrollments/my',
      { params }
    );
    return response.data.data;
  },

  /**
   * Get class enrollments (instructor only)
   */
  async getClassEnrollments(
    classId: string,
    params?: RequestParams
  ): Promise<PaginatedResponse<Enrollment>> {
    const response = await apiClient.get<APIResponse<PaginatedResponse<Enrollment>>>(
      `/classes/${classId}/enrollments`,
      { params }
    );
    return response.data.data;
  },

  /**
   * Drop class (unenroll)
   */
  async dropClass(enrollmentId: string): Promise<void> {
    await apiClient.delete(`/enrollments/${enrollmentId}`);
  },

  /**
   * Get class reviews
   */
  async getClassReviews(
    classId: string,
    params?: RequestParams
  ): Promise<PaginatedResponse<Review>> {
    const response = await apiClient.get<APIResponse<PaginatedResponse<Review>>>(
      `/classes/${classId}/reviews`,
      { params }
    );
    return response.data.data;
  },

  /**
   * Create class review
   */
  async createReview(data: CreateReviewRequest): Promise<Review> {
    const response = await apiClient.post<APIResponse<Review>>('/reviews', data);
    return response.data.data;
  },

  /**
   * Update review
   */
  async updateReview(reviewId: string, data: Partial<CreateReviewRequest>): Promise<Review> {
    const response = await apiClient.patch<APIResponse<Review>>(
      `/reviews/${reviewId}`,
      data
    );
    return response.data.data;
  },

  /**
   * Delete review
   */
  async deleteReview(reviewId: string): Promise<void> {
    await apiClient.delete(`/reviews/${reviewId}`);
  },

  /**
   * Search classes
   */
  async searchClasses(query: string, params?: RequestParams): Promise<PaginatedResponse<Class>> {
    const response = await apiClient.get<APIResponse<PaginatedResponse<Class>>>(
      '/classes/search',
      { params: { ...params, q: query } }
    );
    return response.data.data;
  },

  /**
   * Get classes by category
   */
  async getClassesByCategory(
    category: string,
    params?: RequestParams
  ): Promise<PaginatedResponse<Class>> {
    const response = await apiClient.get<APIResponse<PaginatedResponse<Class>>>(
      `/classes/category/${category}`,
      { params }
    );
    return response.data.data;
  },

  /**
   * Get instructor's classes
   */
  async getInstructorClasses(
    instructorId: string,
    params?: RequestParams
  ): Promise<PaginatedResponse<Class>> {
    const response = await apiClient.get<APIResponse<PaginatedResponse<Class>>>(
      `/instructors/${instructorId}/classes`,
      { params }
    );
    return response.data.data;
  },

  /**
   * Get my classes (instructor)
   */
  async getMyClasses(params?: RequestParams): Promise<PaginatedResponse<Class>> {
    const response = await apiClient.get<APIResponse<PaginatedResponse<Class>>>(
      '/classes/my',
      { params }
    );
    return response.data.data;
  },
};
