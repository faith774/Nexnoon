import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authService } from '@/lib/api';
import type {
  LoginRequest,
  SignupRequest,
  PasswordResetRequest,
  PasswordResetConfirm,
  User,
} from '@/types/api';
import { getErrorMessage } from '@/lib/api';
import { toast } from 'sonner';

// Query Keys
export const AUTH_KEYS = {
  currentUser: ['auth', 'currentUser'] as const,
};

/**
 * Get current user
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: AUTH_KEYS.currentUser,
    queryFn: () => authService.getCurrentUser(),
    retry: false,
  });
}

/**
 * Login mutation
 */
export function useLogin() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (credentials: LoginRequest) => authService.login(credentials),
    onSuccess: (data) => {
      // Store tokens
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('refreshToken', data.refreshToken);
      
      // Update user cache
      queryClient.setQueryData(AUTH_KEYS.currentUser, data.user);
      
      toast.success('Login successful!');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/**
 * Signup mutation
 */
export function useSignup() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: SignupRequest) => authService.signup(data),
    onSuccess: (data) => {
      // Store tokens
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('refreshToken', data.refreshToken);
      
      // Update user cache
      queryClient.setQueryData(AUTH_KEYS.currentUser, data.user);
      
      toast.success('Account created successfully!');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/**
 * Logout mutation
 */
export function useLogout() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      // Clear all queries
      queryClient.clear();
      
      toast.success('Logged out successfully');
    },
    onError: (error) => {
      // Even if API call fails, clear local storage and cache
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      queryClient.clear();
      
      console.error('Logout error:', error);
    },
  });
}

/**
 * Update profile mutation
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Partial<User>) => authService.updateProfile(data),
    onSuccess: (data) => {
      // Update user cache
      queryClient.setQueryData(AUTH_KEYS.currentUser, data);
      
      toast.success('Profile updated successfully');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/**
 * Request password reset mutation
 */
export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (data: PasswordResetRequest) => authService.requestPasswordReset(data),
    onSuccess: () => {
      toast.success('Password reset email sent. Please check your inbox.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/**
 * Confirm password reset mutation
 */
export function useConfirmPasswordReset() {
  return useMutation({
    mutationFn: (data: PasswordResetConfirm) => authService.confirmPasswordReset(data),
    onSuccess: () => {
      toast.success('Password reset successful! You can now login with your new password.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/**
 * Verify email mutation
 */
export function useVerifyEmail() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (token: string) => authService.verifyEmail(token),
    onSuccess: () => {
      // Invalidate current user to refetch updated verification status
      queryClient.invalidateQueries({ queryKey: AUTH_KEYS.currentUser });
      
      toast.success('Email verified successfully!');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/**
 * Resend verification email mutation
 */
export function useResendVerificationEmail() {
  return useMutation({
    mutationFn: () => authService.resendVerificationEmail(),
    onSuccess: () => {
      toast.success('Verification email sent. Please check your inbox.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}
