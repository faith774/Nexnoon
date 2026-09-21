import apiClient from '../client';
import type {
  APIResponse,
  PaginatedResponse,
  Notification,
  RequestParams,
} from '@/types/api';

export const notificationService = {
  /**
   * Get current user's notifications
   */
  async getMyNotifications(params?: RequestParams & { unread?: boolean }): Promise<PaginatedResponse<Notification>> {
    const response = await apiClient.get<APIResponse<PaginatedResponse<Notification>>>(
      '/notifications',
      { params }
    );
    return response.data.data;
  },

  /**
   * Mark a notification as read
   */
  async markAsRead(id: string): Promise<Notification> {
    const response = await apiClient.patch<APIResponse<Notification>>(
      `/notifications/${id}/read`
    );
    return response.data.data;
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<{ updatedCount: number }> {
    const response = await apiClient.patch<APIResponse<{ updatedCount: number }>>(
      '/notifications/read-all'
    );
    return response.data.data;
  },

  /**
   * Delete a notification
   */
  async deleteNotification(id: string): Promise<void> {
    await apiClient.delete(`/notifications/${id}`);
  },
};
