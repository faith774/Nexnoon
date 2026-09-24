import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, getErrorCode, getErrorMessage } from '@/lib/api';
import type { User as ApiUser, EmailPrefs } from '@/types/api';

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'student' | 'instructor' | 'admin';
  instructorStatus?: 'none' | 'pending' | 'approved' | 'rejected' | 'suspended';
  headline?: string;
  bio?: string;
  languages?: string[];
  expertise?: string[];
  approvedCourseIds?: string[];
  preferredLanguage?: string;
  timezone?: string;
  emailPrefs?: EmailPrefs;
  isEmailVerified?: boolean;
  requestedCourseIds?: string[];
  yearsExperience?: number | null;
  teachingExperience?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  sampleVideoUrl?: string;
  applicationUpdatedAt?: string | null;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Admin portal sign-in; rejects non-admin accounts. */
  adminLogin: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, role: 'student' | 'instructor') => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
  /** Re-fetch /auth/me so instructorStatus updates after admin approval. */
  refreshUser: () => Promise<User | null>;
}

export type AuthError = Error & { code?: string };

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeFromApi(apiUser: ApiUser): User {
  return {
    id: apiUser.id,
    email: apiUser.email,
    name: apiUser.fullName || `${apiUser.firstName} ${apiUser.lastName}`.trim() || apiUser.email,
    avatar: apiUser.avatar,
    role: apiUser.role,
    instructorStatus: apiUser.instructorStatus || 'none',
    headline: apiUser.headline || '',
    bio: apiUser.bio || '',
    languages: apiUser.languages || [],
    expertise: apiUser.expertise || [],
    approvedCourseIds: apiUser.approvedCourseIds || [],
    preferredLanguage: apiUser.preferredLanguage || '',
    timezone: apiUser.timezone || '',
    emailPrefs: apiUser.emailPrefs,
    isEmailVerified: apiUser.isEmailVerified,
    requestedCourseIds: apiUser.requestedCourseIds || [],
    yearsExperience: typeof apiUser.yearsExperience === 'number' ? apiUser.yearsExperience : null,
    teachingExperience: apiUser.teachingExperience || '',
    linkedinUrl: apiUser.linkedinUrl || '',
    portfolioUrl: apiUser.portfolioUrl || '',
    sampleVideoUrl: apiUser.sampleVideoUrl || '',
    applicationUpdatedAt: apiUser.applicationUpdatedAt || null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          localStorage.removeItem('user');
          setUser(null);
          return;
        }

        const apiUser = await authService.getCurrentUser();
        const normalized = normalizeFromApi(apiUser);
        setUser(normalized);
        localStorage.setItem('user', JSON.stringify(normalized));
      } catch (error) {
        console.error('Auth check failed:', error);
        const status = (error as { response?: { status?: number } })?.response?.status;
        const cached = localStorage.getItem('user');
        if ((status === undefined || status >= 500) && cached) {
          try {
            setUser(JSON.parse(cached) as User);
            return;
          } catch {
            /* fall through to sign-out */
          }
        }
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const startSession = async (request: () => ReturnType<typeof authService.login>) => {
    setIsLoading(true);
    try {
      const result = await request();

      localStorage.setItem('authToken', result.token);
      localStorage.setItem('refreshToken', result.refreshToken);

      const normalized = normalizeFromApi(result.user as ApiUser);
      setUser(normalized);
      localStorage.setItem('user', JSON.stringify(normalized));
    } catch (error) {
      console.error('Login failed:', error);
      const wrapped = new Error(getErrorMessage(error)) as AuthError;
      wrapped.code = getErrorCode(error);
      throw wrapped;
    } finally {
      setIsLoading(false);
    }
  };

  const login = (email: string, password: string) =>
    startSession(() => authService.login({ email, password }));

  const adminLogin = (email: string, password: string) =>
    startSession(() => authService.adminLogin({ email, password }));

  const signup = async (email: string, password: string, name: string, role: 'student' | 'instructor') => {
    setIsLoading(true);
    try {
      const [firstName, ...rest] = name.trim().split(' ');
      const lastName = rest.join(' ') || firstName;

      const result = await authService.signup({
        email,
        password,
        firstName,
        lastName,
        role,
      });

      localStorage.setItem('authToken', result.token);
      localStorage.setItem('refreshToken', result.refreshToken);

      const normalized = normalizeFromApi(result.user as ApiUser);
      setUser(normalized);
      localStorage.setItem('user', JSON.stringify(normalized));
    } catch (error) {
      console.error('Signup failed:', error);
      throw new Error(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    authService.logout().catch(() => {
      /* ignore */
    });
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
  };

  const refreshUser = async (): Promise<User | null> => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      setUser(null);
      return null;
    }
    try {
      const apiUser = await authService.getCurrentUser();
      const normalized = normalizeFromApi(apiUser);
      setUser(normalized);
      localStorage.setItem('user', JSON.stringify(normalized));
      return normalized;
    } catch {
      return user;
    }
  };

  const updateProfile = async (data: Partial<User>) => {
    setIsLoading(true);
    try {
      if (!user) return;

      const payload: Partial<ApiUser> = {};

      if ('name' in data && data.name !== undefined) {
        const parts = String(data.name).trim().split(/\s+/).filter(Boolean);
        payload.firstName = parts[0] || '';
        payload.lastName = parts.slice(1).join(' ') || payload.firstName;
      }

      if ('headline' in data && data.headline !== undefined) payload.headline = data.headline;
      if ('bio' in data && data.bio !== undefined) payload.bio = data.bio;
      if ('languages' in data && data.languages !== undefined) payload.languages = data.languages;
      if ('expertise' in data && data.expertise !== undefined) payload.expertise = data.expertise;
      if ('avatar' in data && data.avatar !== undefined) payload.avatar = data.avatar;
      if ('preferredLanguage' in data && data.preferredLanguage !== undefined) {
        payload.preferredLanguage = data.preferredLanguage;
      }
      if ('timezone' in data && data.timezone !== undefined) payload.timezone = data.timezone;
      if ('emailPrefs' in data && data.emailPrefs !== undefined) payload.emailPrefs = data.emailPrefs;

      const updatedApiUser = await authService.updateProfile(payload);
      const normalized = normalizeFromApi(updatedApiUser);

      setUser(normalized);
      localStorage.setItem('user', JSON.stringify(normalized));
    } catch (error) {
      console.error('Profile update failed:', error);
      throw new Error(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        adminLogin,
        signup,
        logout,
        updateProfile,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
