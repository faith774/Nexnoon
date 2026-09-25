import BrandLoader from '@/app/components/BrandLoader';
import { Navigate, useSearchParams } from 'react-router';
import LearnerDashboard from '@/app/components/LearnerDashboard';
import { useAuth } from '@/contexts/AuthContext';

/** Learners get the LearnerDashboard; instructors manage their classes in the studio unless they ask for their own learning view. */
export default function MyClasses() {
  const { user, isLoading: authLoading } = useAuth();
  const [params] = useSearchParams();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f6f4f0] flex items-center justify-center">
        <BrandLoader />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace state={{ from: { pathname: '/my-classes' } }} />;

  if ((user.role === 'instructor' || user.role === 'admin') && params.get('view') !== 'learning') {
    return <Navigate to="/instructor/dashboard?tab=classes" replace />;
  }

  return <LearnerDashboard />;
}
