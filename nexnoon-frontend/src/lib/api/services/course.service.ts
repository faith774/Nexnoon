import apiClient from '../client';
import type {
  APIResponse,
  Course,
  CourseMarketplacePage,
  LanguageOffering,
} from '@/types/api';

export type CourseUpsertPayload = {
  title: string;
  description: string;
  outcomes?: string[];
  curriculumTemplate?: { id: string; title: string; description?: string }[];
  officialPreviewUrl?: string;
  certificateNotes?: string;
  category?: string;
  status?: 'draft' | 'published' | 'archived';
  slug?: string;
  languageOfferings?: Omit<LanguageOffering, 'id'>[];
};

export const courseService = {
  async getCatalog(): Promise<Course[]> {
    const response = await apiClient.get<APIResponse<Course[]>>('/courses/catalog');
    return response.data.data || [];
  },

  async getBySlug(slug: string, language?: string): Promise<CourseMarketplacePage> {
    const response = await apiClient.get<APIResponse<CourseMarketplacePage>>(
      `/courses/by-slug/${encodeURIComponent(slug)}`,
      { params: language ? { language } : undefined }
    );
    return response.data.data;
  },

  async list(): Promise<Course[]> {
    const response = await apiClient.get<APIResponse<Course[]>>('/courses');
    return response.data.data || [];
  },

  async create(payload: CourseUpsertPayload): Promise<Course> {
    const response = await apiClient.post<APIResponse<Course>>('/courses', payload);
    return response.data.data;
  },

  async update(id: string, payload: Partial<CourseUpsertPayload>): Promise<Course> {
    const response = await apiClient.patch<APIResponse<Course>>(`/courses/${id}`, payload);
    return response.data.data;
  },

  async archive(id: string): Promise<Course> {
    const response = await apiClient.post<APIResponse<Course>>(`/courses/${id}/archive`);
    return response.data.data;
  },

  async addLanguage(
    courseId: string,
    offering: { code: string; label: string; status?: 'active' | 'inactive' }
  ): Promise<Course> {
    const response = await apiClient.post<APIResponse<Course>>(
      `/courses/${courseId}/languages`,
      offering
    );
    return response.data.data;
  },

  async updateLanguage(
    courseId: string,
    offeringId: string,
    offering: Partial<{ code: string; label: string; status: 'active' | 'inactive' }>
  ): Promise<Course> {
    const response = await apiClient.patch<APIResponse<Course>>(
      `/courses/${courseId}/languages/${offeringId}`,
      offering
    );
    return response.data.data;
  },
};
