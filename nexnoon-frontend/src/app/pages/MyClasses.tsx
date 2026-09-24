import BrandLoader from '@/app/components/BrandLoader';
import { Navigate } from 'react-router';
import LearnerDashboard from '@/app/components/LearnerDashboard';
import { useAuth } from '@/contexts/AuthContext';

/** Learners get the LearnerDashboard; instructors manage their classes in the studio. */
export default function MyClasses() {
  const { user, isLoading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f6f4f0] flex items-center justify-center">
        <BrandLoader />
      </div>
    );
  }

  if (user?.role === 'instructor' || user?.role === 'admin') {
    return <Navigate to="/instructor/dashboard?tab=classes" replace />;
  }

  return <LearnerDashboard />;
}
