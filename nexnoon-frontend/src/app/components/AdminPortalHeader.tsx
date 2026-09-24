import { Link, useNavigate } from 'react-router';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { publicSiteHref } from '@/lib/portal';

export default function AdminPortalHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-50 bg-[#0b1220] text-white">
      <div className="w-[min(92vw,1400px)] mx-auto flex h-14 items-center justify-between gap-4">
        <Link to="/admin/dashboard" className="flex items-center gap-2">
          <span className="font-display text-lg tracking-tight">Nexnoon</span>
          <span className="text-[10px] uppercase tracking-[0.24em] text-white/60 border border-white/20 px-2 py-0.5">
            Admin
          </span>
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <a href={publicSiteHref('/')} className="text-white/70 hover:text-white">
            View site
          </a>
          {user && (
            <>
              <span className="hidden sm:inline text-white/60">{user.email}</span>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 text-white/80 hover:text-white"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                Sign out
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
