import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, getErrorMessage } from '@/lib/api';
import type { User as ApiUser } from '@/types/api';

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'student' | 'instructor' | 'admin';
  instructorStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  isEmailVerified?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, role: 'student' | 'instructor') => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
        const normalized: User = {
          id: apiUser.id,
          email: apiUser.email,
          name: apiUser.fullName || `${apiUser.firstName} ${apiUser.lastName}`.trim() || apiUser.email,
          avatar: apiUser.avatar,
          role: apiUser.role,
          instructorStatus: apiUser.instructorStatus || 'none',
          isEmailVerified: apiUser.isEmailVerified,
        };
        setUser(normalized);
        localStorage.setItem('user', JSON.stringify(normalized));
      } catch (error) {
        console.error('Auth check failed:', error);
        // If token is invalid, clear it
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

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await authService.login({ email, password });

      // Store tokens for apiClient interceptor
      localStorage.setItem('authToken', result.token);
      localStorage.setItem('refreshToken', result.refreshToken);

      const apiUser = result.user as ApiUser;
      const normalized: User = {
        id: apiUser.id,
        email: apiUser.email,
        name: apiUser.fullName || `${apiUser.firstName} ${apiUser.lastName}`.trim() || apiUser.email,
        avatar: apiUser.avatar,
        role: apiUser.role,
        instructorStatus: apiUser.instructorStatus || 'none',
        isEmailVerified: apiUser.isEmailVerified,
      };

      setUser(normalized);
      localStorage.setItem('user', JSON.stringify(normalized));
    } catch (error) {
      console.error('Login failed:', error);
      throw new Error(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

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

      // Store tokens for apiClient interceptor
      localStorage.setItem('authToken', result.token);
      localStorage.setItem('refreshToken', result.refreshToken);

      const apiUser = result.user as ApiUser;
      const normalized: User = {
        id: apiUser.id,
        email: apiUser.email,
        name: apiUser.fullName || `${apiUser.firstName} ${apiUser.lastName}`.trim() || apiUser.email,
        avatar: apiUser.avatar,
        role: apiUser.role,
        instructorStatus: apiUser.instructorStatus || 'none',
        isEmailVerified: apiUser.isEmailVerified,
      };

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
    // Best-effort API logout; ignore errors
    authService.logout().catch(() => {
      /* ignore */
    });
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
  };

  const updateProfile = async (data: Partial<User>) => {
    setIsLoading(true);
    try {
      if (!user) return;

      const payload: Partial<ApiUser> = { ...data } as Partial<ApiUser>;
      if ('name' in data && data.name !== undefined) {
        const parts = String(data.name).trim().split(/\s+/);
        payload.firstName = parts[0] || '';
        payload.lastName = parts.slice(1).join(' ') || payload.firstName;
      }

      const updatedApiUser = await authService.updateProfile(payload);
      const normalized: User = {
        id: updatedApiUser.id,
        email: updatedApiUser.email,
        name:
          updatedApiUser.fullName ||
          `${updatedApiUser.firstName} ${updatedApiUser.lastName}`.trim() ||
          updatedApiUser.email,
        avatar: updatedApiUser.avatar,
        role: updatedApiUser.role,
        instructorStatus: updatedApiUser.instructorStatus || 'none',
        isEmailVerified: updatedApiUser.isEmailVerified,
      };

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
        signup,
        logout,
        updateProfile
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