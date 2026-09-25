import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { CheckCircle2, MailWarning } from 'lucide-react';
import { authService, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { AuthCard, AuthShell, PrimaryButton } from '@/app/components/auth/AuthKit';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, refreshUser } = useAuth();
  const token = params.get('token') || '';
  const [state, setState] = useState<'checking' | 'done' | 'error'>(token ? 'checking' : 'error');
  const [error, setError] = useState(token ? '' : 'This verification link is incomplete.');
  const [resent, setResent] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    authService
      .verifyEmail(token)
      .then(async () => {
        setState('done');
        if (isAuthenticated) await refreshUser();
      })
      .catch((err) => {
        setError(getErrorMessage(err));
        setState('error');
      });
  }, [token, isAuthenticated, refreshUser]);

  const resend = async () => {
    try {
      await authService.resendVerificationEmail();
      setResent(true);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <AuthShell>
      <AuthCard>
        {state === 'checking' && (
          <div className="flex items-center gap-3 py-6" role="status">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#14110e]/20 border-t-[#14110e]" aria-hidden />
            <span className="text-[15px] text-[#14110e]/70">Confirming your email…</span>
          </div>
        )}

        {state === 'done' && (
          <>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef6ef] text-[#2f6b3a]">
              <CheckCircle2 className="h-6 w-6" aria-hidden />
            </span>
            <h1 className="mt-5 font-display text-[32px] leading-[1.1] tracking-tight">Email confirmed</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-[#14110e]/60">
              Thanks — class updates and reminders will reach you here.
            </p>
            <div className="mt-7">
              <PrimaryButton type="button" onClick={() => navigate(isAuthenticated ? '/my-classes' : '/login', { replace: true })}>
                {isAuthenticated ? 'Go to my classes' : 'Sign in'}
              </PrimaryButton>
            </div>
          </>
        )}

        {state === 'error' && (
          <>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fdf1ec] text-[#b4531f]">
              <MailWarning className="h-6 w-6" aria-hidden />
            </span>
            <h1 className="mt-5 font-display text-[32px] leading-[1.1] tracking-tight">We couldn’t confirm this link</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-[#14110e]/60">
              {/invalid/i.test(error) ? 'It may have been used already or replaced by a newer email.' : error}
            </p>
            <div className="mt-7 space-y-3">
              {isAuthenticated ? (
                <PrimaryButton type="button" onClick={resend} disabled={resent}>
                  {resent ? 'New link sent — check your inbox' : 'Send a new verification email'}
                </PrimaryButton>
              ) : (
                <PrimaryButton type="button" onClick={() => navigate('/login', { state: { from: { pathname: '/verify-email' } } })}>
                  Sign in to get a new link
                </PrimaryButton>
              )}
            </div>
          </>
        )}
      </AuthCard>
    </AuthShell>
  );
}
