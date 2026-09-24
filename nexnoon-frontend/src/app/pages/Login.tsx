import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, ArrowRight, Clock, Eye, EyeOff, Lock, Mail, Sparkles, X } from 'lucide-react';
import { useAuth, type AuthError } from '@/contexts/AuthContext';
import { adminPortalHref } from '@/lib/portal';
import {
  forgetRememberedAccount,
  getRememberedAccount,
  initials,
  isValidEmail,
  rememberAccount,
  suggestEmail,
  timeOfDayGreeting,
} from '@/lib/auth-ux';
import { AuthCard, AuthInput, AuthShell, EmailSuggestion, FormNotice, PrimaryButton } from '@/app/components/auth/AuthKit';

type Step = 'email' | 'password';

function contextFor(path: string): string | null {
  if (path.startsWith('/payment') || path.startsWith('/enroll')) return 'Log in to finish enrolling in your class.';
  if (path.startsWith('/class/') || path.startsWith('/courses/')) return 'Log in to continue to the class you were viewing.';
  if (path.startsWith('/classroom') || path.startsWith('/live-session') || path.startsWith('/waiting-room'))
    return 'Log in to join your live session.';
  return null;
}

export default function Login() {
  const remembered = useMemo(() => getRememberedAccount(), []);
  const [savedAccount, setSavedAccount] = useState(remembered);
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [adminPortalRequired, setAdminPortalRequired] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();

  const fromState = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
  const from = fromState?.pathname ? `${fromState.pathname}${fromState.search || ''}` : '/';
  const contextMessage = contextFor(fromState?.pathname || '');
  const sessionExpired = params.get('session') === 'expired';

  const suggestion = useMemo(() => suggestEmail(email), [email]);
  const emailInvalid = emailTouched && email.length > 0 && !isValidEmail(email);
  const displayName = savedAccount && savedAccount.email === email ? savedAccount.name : undefined;
  const firstName = displayName?.split(' ')[0];

  const goToPassword = (value: string) => {
    setEmail(value);
    setError('');
    setStep('password');
    setTimeout(() => passwordRef.current?.focus(), 250);
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailTouched(true);
    if (!isValidEmail(email)) return;
    goToPassword(email.trim());
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAdminPortalRequired(false);
    setIsLoading(true);

    try {
      await login(email.trim(), password);
      const stored = localStorage.getItem('user');
      const loggedIn = stored ? JSON.parse(stored) : null;
      if (loggedIn?.email) {
        rememberAccount({ email: loggedIn.email, name: loggedIn.name, avatar: loggedIn.avatar });
      }
      if (loggedIn?.role === 'instructor') {
        if (
          loggedIn.instructorStatus === 'pending' ||
          loggedIn.instructorStatus === 'rejected' ||
          loggedIn.instructorStatus === 'suspended'
        ) {
          navigate('/instructor/pending-approval', { replace: true });
        } else {
          navigate('/instructor/dashboard', { replace: true });
        }
      } else {
        // Learners land on learning home unless they were sent somewhere specific.
        navigate(from && from !== '/' ? from : '/my-classes', { replace: true });
      }
    } catch (err) {
      setAdminPortalRequired((err as AuthError)?.code === 'ADMIN_PORTAL_REQUIRED');
      setError(err instanceof Error ? err.message : 'Login failed');
      setPassword('');
      passwordRef.current?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const trackCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(e.getModifierState?.('CapsLock') ?? false);
  };

  const removeSavedAccount = () => {
    forgetRememberedAccount();
    setSavedAccount(null);
  };

  const slide = {
    initial: { opacity: 0, x: 24 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -24 },
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
  };

  return (
    <AuthShell
      topAction={
        <span className="hidden text-white/60 md:inline">
          New here?{' '}
          <Link to="/signup" state={location.state} className="font-medium text-white hover:underline">
            Create an account
          </Link>
        </span>
      }
    >
      <AuthCard>
        <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#b7793a]">
          {firstName ? `${timeOfDayGreeting()}, ${firstName}` : timeOfDayGreeting()}
        </p>
        <h1 className="mt-3 font-display text-[34px] leading-[1.1] tracking-tight">
          {step === 'email' ? 'Log in to Nexnoon' : 'Enter your password'}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[#14110e]/60">
          {step === 'email'
            ? 'Your live classes, materials and assignments are waiting.'
            : 'One more step and you’re back in class.'}
        </p>

        <div className="mt-6 space-y-3 empty:hidden">
          {contextMessage && !error && (
            <FormNotice tone="info" icon={Sparkles}>
              {contextMessage}
            </FormNotice>
          )}
          {sessionExpired && !error && (
            <FormNotice tone="info" icon={Clock}>
              Your session expired. Log in again to pick up where you left off.
            </FormNotice>
          )}
          {error && (
            <FormNotice tone="error" icon={AlertCircle}>
              {error}
              {adminPortalRequired && (
                <>
                  {' '}
                  <a href={adminPortalHref('/admin/login')} className="font-medium underline underline-offset-2">
                    Go to admin sign in
                  </a>
                </>
              )}
            </FormNotice>
          )}
        </div>

        <div className="mt-6">
          <AnimatePresence mode="wait" initial={false}>
            {step === 'email' ? (
              <motion.div key="email" {...slide}>
                {savedAccount && (
                  <div className="mb-6">
                    <div className="group relative flex items-center gap-3 rounded-2xl border border-[#e4ddd2] bg-white p-3 pr-11 transition hover:border-[#14110e]/40">
                      <button
                        type="button"
                        onClick={() => goToPassword(savedAccount.email)}
                        className="absolute inset-0 rounded-2xl"
                        aria-label={`Continue as ${savedAccount.name || savedAccount.email}`}
                      />
                      {savedAccount.avatar ? (
                        <img src={savedAccount.avatar} alt="" className="h-11 w-11 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#14110e] text-sm font-semibold text-white">
                          {initials(savedAccount.name || savedAccount.email)}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium">
                          Continue as {savedAccount.name?.split(' ')[0] || savedAccount.email.split('@')[0]}
                        </p>
                        <p className="truncate text-[13px] text-[#14110e]/55">{savedAccount.email}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-[#14110e]/40 transition group-hover:translate-x-0.5 group-hover:text-[#14110e]" aria-hidden />
                      <button
                        type="button"
                        onClick={removeSavedAccount}
                        className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full text-[#14110e]/35 hover:bg-[#f3efe8] hover:text-[#14110e]"
                        aria-label="Forget this account on this device"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-[#14110e]/35">
                      <span className="h-px flex-1 bg-[#ebe6de]" />
                      or use another email
                      <span className="h-px flex-1 bg-[#ebe6de]" />
                    </div>
                  </div>
                )}

                <form onSubmit={handleEmailSubmit} noValidate className="space-y-5">
                  <div>
                    <AuthInput
                      id="email"
                      label="Email address"
                      icon={Mail}
                      type="email"
                      inputMode="email"
                      autoComplete="username"
                      autoFocus={!savedAccount}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onBlur={() => setEmailTouched(true)}
                      placeholder="you@example.com"
                      invalid={emailInvalid}
                    />
                    {emailInvalid ? (
                      <p className="mt-2 text-[13px] text-red-600">Enter a valid email address.</p>
                    ) : (
                      <EmailSuggestion suggestion={suggestion} onAccept={setEmail} />
                    )}
                  </div>
                  <PrimaryButton disabled={!email}>
                    Continue
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </PrimaryButton>
                </form>
              </motion.div>
            ) : (
              <motion.div key="password" {...slide}>
                <div className="mb-5 flex items-center gap-3 rounded-2xl bg-[#f3efe8] p-2.5 pr-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#14110e] text-xs font-semibold text-white">
                    {initials(displayName || email)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{email}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('email');
                      setPassword('');
                      setError('');
                    }}
                    className="rounded-full px-3 py-1 text-[13px] font-medium text-[#14110e]/70 hover:bg-white hover:text-[#14110e]"
                  >
                    Change
                  </button>
                </div>

                <form onSubmit={handlePasswordSubmit} className="space-y-5">
                  <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
                  <div>
                    <AuthInput
                      id="password"
                      label="Password"
                      icon={Lock}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={trackCapsLock}
                      onKeyUp={trackCapsLock}
                      onBlur={() => setCapsLock(false)}
                      placeholder="Enter your password"
                      required
                      inputRef={passwordRef}
                      labelAside={
                        <Link to="/forgot-password" className="text-[13px] font-medium text-[#14110e]/55 hover:text-[#14110e] hover:underline">
                          Forgot password?
                        </Link>
                      }
                      trailing={
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="flex h-9 w-9 items-center justify-center rounded-xl text-[#8a847a] transition hover:bg-[#f3efe8] hover:text-[#14110e]"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      }
                    />
                    {capsLock && <p className="mt-2 text-[13px] font-medium text-amber-700">Caps Lock is on.</p>}
                  </div>
                  <PrimaryButton loading={isLoading} loadingLabel="Logging in…" disabled={!password}>
                    Log in
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </PrimaryButton>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-8 text-center text-[14px] text-[#14110e]/60">
          New to Nexnoon?{' '}
          <Link to="/signup" state={location.state} className="font-medium text-[#14110e] underline-offset-4 hover:underline">
            Create an account
          </Link>
        </p>
      </AuthCard>

      <p className="mt-6 text-center text-[13px] text-white/45">
        Teaching on Nexnoon? Instructors log in here too.
      </p>
    </AuthShell>
  );
}
