import apiClient from '../client';
import type {
  APIResponse,
  AuthResponse,
  LoginRequest,
  SignupRequest,
  PasswordResetRequest,
  PasswordResetConfirm,
  User,
} from '@/types/api';

export const authService = {
  /**
   * Login user
   */
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await apiClient.post<APIResponse<AuthResponse>>(
      '/auth/login',
      credentials
    );
    return response.data.data;
  },

  /**
   * Admin portal login (admin accounts only)
   */
  async adminLogin(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await apiClient.post<APIResponse<AuthResponse>>(
      '/auth/admin/login',
      credentials
    );
    return response.data.data;
  },

  /**
   * Register new user
   */
  async signup(data: SignupRequest): Promise<AuthResponse> {
    const response = await apiClient.post<APIResponse<AuthResponse>>(
      '/auth/signup',
      data
    );
    return response.data.data;
  },

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
  },

  /**
   * Get current user profile
   */
  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<APIResponse<User>>('/auth/me');
    return response.data.data;
  },

  /**
   * Update user profile
   */
  async updateProfile(data: Partial<User>): Promise<User> {
    const response = await apiClient.patch<APIResponse<User>>('/auth/profile', data);
    return response.data.data;
  },

  /**
   * Request password reset
   */
  async requestPasswordReset(data: PasswordResetRequest): Promise<void> {
    await apiClient.post('/auth/password/reset', data);
  },

  /**
   * Confirm password reset
   */
  async confirmPasswordReset(data: PasswordResetConfirm): Promise<void> {
    await apiClient.post('/auth/password/reset/confirm', data);
  },

  /**
   * Change password while authenticated (requires current password)
   */
  async changePassword(data: {
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    await apiClient.post('/auth/password/change', data);
  },

  /**
   * Refresh authentication token
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    const response = await apiClient.post<APIResponse<AuthResponse>>(
      '/auth/refresh',
      { refreshToken }
    );
    return response.data.data;
  },

  /**
   * Verify email
   */
  async verifyEmail(token: string): Promise<void> {
    await apiClient.post('/auth/verify-email', { token });
  },

  /**
   * Resend verification email
   */
  async resendVerificationEmail(): Promise<void> {
    await apiClient.post('/auth/verify-email/resend');
  },
};
