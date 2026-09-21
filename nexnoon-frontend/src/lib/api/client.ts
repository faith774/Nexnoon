import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ENV } from '@/config/env';
import type { APIError, APIResponse, AssignmentAnswer } from '@/types/api';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: ENV.API_BASE_URL,
  timeout: ENV.API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add auth token to requests
apiClient.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('authToken');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add request timestamp for debugging
    if (ENV.ENABLE_DEMO_MODE) {
      config.headers['X-Request-Time'] = new Date().toISOString();
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors globally
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error: AxiosError<APIResponse<any>>) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
    
    // Handle 401 Unauthorized - Token expired
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Attempt to refresh token
        const refreshToken = localStorage.getItem('refreshToken');
        
        if (refreshToken) {
          const response = await axios.post(`${ENV.API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });
          
          const { token } = response.data.data;
          localStorage.setItem('authToken', token);
          
          // Retry original request with new token
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed - logout user
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login?session=expired';
        return Promise.reject(refreshError);
      }
    }
    
    // Handle other error statuses
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          console.error('Bad Request:', data);
          break;
        case 403:
          console.error('Forbidden:', data);
          break;
        case 404:
          console.error('Not Found:', data);
          break;
        case 429:
          console.error('Too Many Requests:', data);
          break;
        case 500:
          console.error('Server Error:', data);
          break;
        default:
          console.error(`API Error ${status}:`, data);
      }
    } else if (error.request) {
      // Request made but no response received
      console.error('Network Error:', error.message);
    } else {
      // Something else happened
      console.error('Error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

/**
 * Posts multipart/form-data via `fetch` rather than the shared `apiClient`
 * axios instance. Axios instances created with a default
 * `Content-Type: application/json` header (as this one is) don't reliably
 * strip that header for FormData bodies across environments, and the browser
 * refuses to fill in the multipart boundary itself once *any* Content-Type has
 * been explicitly set - so the server sees no boundary and parses no file at
 * all. `fetch` has no such default to fight: leaving Content-Type unset here
 * lets the browser generate the correct multipart boundary header.
 */
async function postMultipart(path: string, formData: FormData): Promise<any> {
  const token = localStorage.getItem('authToken');

  const response = await fetch(`${ENV.API_BASE_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw new Error(body?.message || `Request failed (${response.status})`);
  }
  return body.data;
}

export async function uploadFile(path: string, file: File): Promise<{ url: string; name: string }> {
  const formData = new FormData();
  formData.append('file', file);
  return postMultipart(path, formData);
}

/** Submits (or resubmits) a student's answer to a class assignment - a written answer, a file, or both. */
export async function submitAssignmentAnswer(
  classId: string,
  assignmentId: string,
  { content, file }: { content?: string; file?: File | null }
): Promise<AssignmentAnswer> {
  const path = `/classes/${classId}/assignments/${assignmentId}/submissions`;
  if (file) {
    const formData = new FormData();
    formData.append('file', file);
    if (content) formData.append('content', content);
    return postMultipart(path, formData);
  }
  const response = await apiClient.post(path, { content });
  return response.data.data;
}

// Helper function to extract error messages
export const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<APIResponse<any>>;
    
    // Check if error response has message
    if (axiosError.response?.data?.message) {
      return axiosError.response.data.message;
    }
    
    // Check if error response has errors array
    if (axiosError.response?.data?.errors && axiosError.response.data.errors.length > 0) {
      return axiosError.response.data.errors.map((err: APIError) => err.message).join(', ');
    }
    
    // Default axios error messages
    if (axiosError.message) {
      return axiosError.message;
    }
  }
  
  // Fallback for non-axios errors
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An unexpected error occurred';
};

export default apiClient;
