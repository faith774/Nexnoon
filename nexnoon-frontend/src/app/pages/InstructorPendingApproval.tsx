import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle, Clock, Loader2, Mail, RefreshCw, Sparkles, XCircle } from 'lucide-react';
import { applicationProgress } from '@/lib/instructor-application';
import { useNavigate } from 'react-router';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import { Button } from '@/app/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

export default function InstructorPendingApproval() {
  const navigate = useNavigate();
  const { user, logout, refreshUser, isLoading: authLoading } = useAuth();
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const status = user?.instructorStatus || 'pending';

  const checkStatus = useCallback(async () => {
    setChecking(true);
    try {
      const next = await refreshUser();
      setLastChecked(new Date());
      if (next?.role === 'instructor' && next.instructorStatus === 'approved') {
        navigate('/instructor/dashboard', { replace: true });
      }
    } finally {
      setChecking(false);
    }
  }, [refreshUser, navigate]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { replace: true, state: { from: { pathname: '/instructor/pending-approval' } } });
      return;
    }
    if (user.role !== 'instructor') {
      navigate('/', { replace: true });
      return;
    }
    if (user.instructorStatus === 'approved') {
      navigate('/instructor/dashboard', { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Soft poll so approval shows up without a full reload.
  useEffect(() => {
    if (!user || user.role !== 'instructor') return;
    if (user.instructorStatus === 'approved') return;
    const id = window.setInterval(() => {
      void checkStatus();
    }, 20_000);
    return () => window.clearInterval(id);
  }, [user, checkStatus]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#f6f4f0] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#6b655c]" />
      </div>
    );
  }

  const application = applicationProgress(user);
  const missing = application.items.filter((i) => i.required && !i.done);
  const rejected = status === 'rejected';
  const suspended = status === 'suspended';
  const blocked = rejected || suspended;

  return (
    <div className="min-h-screen bg-[#f6f4f0] text-[#14110e] flex flex-col">
      <Header variant="light" />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl">
          <div className="border border-[#e4dfd6] bg-white p-8 sm:p-10">
            <div
              className={`inline-flex items-center justify-center h-14 w-14 mb-6 ${
                blocked ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'
              }`}
            >
              {blocked ? <XCircle className="h-7 w-7" /> : <Clock className="h-7 w-7" />}
            </div>

            <p className="text-[11px] uppercase tracking-[0.16em] text-[#6b655c] mb-2">
              Instructor application
            </p>
            <h1 className="font-serif text-3xl text-[#14110e] mb-3">
              {suspended
                ? 'Teaching privileges suspended'
                : rejected
                  ? 'Application not approved'
                  : 'Application under review'}
            </h1>
            <p className="text-sm text-[#6b655c] leading-relaxed mb-8">
              {suspended ? (
                <>
                  <strong className="text-[#14110e]">{user.name}</strong>, your instructor account is
                  suspended. You cannot create classes or host sessions until an admin restores access.
                </>
              ) : rejected ? (
                <>
                  Thanks for your interest, <strong className="text-[#14110e]">{user.name}</strong>. Your
                  instructor application was not approved at this time. You can contact support if you have
                  questions or want to re-apply later.
                </>
              ) : (
                <>
                  Thanks for applying to teach on Nexnoon,{' '}
                  <strong className="text-[#14110e]">{user.name}</strong>. An admin will review your
                  application before you can create classes or host live sessions.
                </>
              )}
            </p>

            {!blocked && (
              <div
                className={`mb-6 rounded-2xl border p-5 ${
                  application.ready ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/70'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <Sparkles
                      className={`h-4 w-4 mt-0.5 flex-shrink-0 ${application.ready ? 'text-emerald-700' : 'text-amber-800'}`}
                    />
                    <div>
                      <p className="text-sm font-semibold text-[#14110e]">
                        {application.ready ? 'Your application is complete' : 'Strengthen your application'}
                      </p>
                      <p className="text-xs text-[#6b655c] mt-0.5 leading-relaxed">
                        {application.ready
                          ? 'The admin team can see your full teaching profile. Keep it up to date while you wait.'
                          : 'Admins review your teaching profile before approving you. Complete profiles are reviewed faster.'}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 font-display text-2xl text-[#14110e] tabular-nums">{application.percent}%</span>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white">
                  <div
                    className={`h-full rounded-full transition-all ${application.ready ? 'bg-emerald-600' : 'bg-[#14110e]'}`}
                    style={{ width: `${Math.max(application.percent, 4)}%` }}
                  />
                </div>
                {missing.length > 0 && (
                  <p className="mt-3 text-xs text-[#6b655c]">
                    Missing: <span className="text-[#14110e]">{missing.map((m) => m.label.toLowerCase()).join(', ')}</span>
                  </p>
                )}
                <Button
                  type="button"
                  onClick={() => navigate('/instructor/application')}
                  className="mt-4 bg-[#14110e] text-white hover:bg-black/80 rounded-full px-5"
                >
                  {application.ready ? 'Review teaching profile' : 'Complete your teaching profile'}
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </div>
            )}

            <div className="space-y-3 mb-8">
              <div className="border border-[#eee9e0] bg-[#faf8f5] p-4 flex gap-3">
                <Mail className="h-4 w-4 text-[#6b655c] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-[#14110e]">Email updates</p>
                  <p className="text-xs text-[#6b655c] mt-0.5 leading-relaxed">
                    We’ll notify <strong className="text-[#14110e]">{user.email}</strong> when your status
                    changes. Typical review: 1–3 business days.
                  </p>
                </div>
              </div>

              {!blocked && (
                <div className="border border-[#eee9e0] bg-[#faf8f5] p-4 flex gap-3">
                  <CheckCircle className="h-4 w-4 text-[#6b655c] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-[#14110e]">After approval</p>
                    <p className="text-xs text-[#6b655c] mt-0.5 leading-relaxed">
                      You’ll unlock the instructor studio — create classes, add modules and live sessions,
                      invite support instructors, and host on Zoom.
                    </p>
                  </div>
                </div>
              )}

              {blocked && (
                <div className="border border-red-100 bg-red-50/50 p-4 flex gap-3">
                  <AlertCircle className="h-4 w-4 text-red-700 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-[#14110e]">Need help?</p>
                    <p className="text-xs text-[#6b655c] mt-0.5 leading-relaxed">
                      Contact support@nexnoon.com and include the email you signed up with.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {!blocked && (
                <Button
                  type="button"
                  onClick={() => void checkStatus()}
                  disabled={checking}
                  className="bg-[#14110e] text-white hover:bg-black/80 rounded-none"
                >
                  {checking ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  {checking ? 'Checking…' : 'Check status'}
                </Button>
              )}
              <Button
                type="button"
                onClick={() => navigate('/')}
                variant="outline"
                className="border border-[#d5cfc4] rounded-none"
              >
                Back to home
              </Button>
              <Button
                type="button"
                onClick={handleLogout}
                variant="outline"
                className="border border-[#d5cfc4] rounded-none"
              >
                Log out
              </Button>
            </div>
            {lastChecked && !rejected && (
              <p className="text-[11px] text-[#8a847a] mt-4">
                Last checked {lastChecked.toLocaleTimeString()} · Status:{' '}
                <span className="capitalize text-[#14110e]">{status}</span>
              </p>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
