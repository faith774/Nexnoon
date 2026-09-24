import { useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { motion } from 'motion/react';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { publicSiteHref } from '@/lib/portal';

const highlights = [
  {
    icon: UserCheck,
    title: 'Certify instructors',
    body: 'Review applications, approve teachers per course, and keep quality scores honest.',
  },
  {
    icon: BookOpen,
    title: 'Curate the catalogue',
    body: 'Publish official courses, add language offerings, and set platform-wide seat caps.',
  },
  {
    icon: Activity,
    title: 'Watch every cohort',
    body: 'See fill rates, enrollments, payments and activity across the platform in one place.',
  },
];

function Wordmark({ tone }: { tone: 'light' | 'dark' }) {
  const text = tone === 'light' ? 'text-white' : 'text-[#0b1220]';
  const bar = tone === 'light' ? 'bg-white' : 'bg-[#0b1220]';
  const pill =
    tone === 'light'
      ? 'text-white/70 border-white/20 bg-white/5'
      : 'text-[#5a6b7d] border-[#d0dae6] bg-white/70';
  return (
    <div className="flex items-center gap-3">
      <span className="group relative inline-flex">
        <span className={`text-2xl font-bold tracking-tight ${text}`}>Nexnoon</span>
        <span className={`absolute -bottom-0.5 right-0 h-0.5 w-4 ${bar} transition-all duration-300 group-hover:w-full`} />
      </span>
      <span className={`text-[10px] font-semibold uppercase tracking-[0.24em] border px-2 py-0.5 ${pill}`}>
        Admin
      </span>
    </div>
  );
}

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { user, isLoading, adminLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();

  const fromPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
  const destination =
    fromPath && fromPath.startsWith('/admin') && fromPath !== '/admin/login' ? fromPath : '/admin/dashboard';

  if (!isLoading && user?.role === 'admin') {
    return <Navigate to={destination} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await adminLogin(email.trim(), password);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  };

  const trackCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(e.getModifierState?.('CapsLock') ?? false);
  };

  const sessionExpired = params.get('session') === 'expired' && !error;

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-[#0b1220] font-[family-name:var(--font-sans)] overflow-x-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-[#0b1220] px-12 py-10 xl:px-16">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full bg-[#2d4a73] opacity-50 blur-[120px]" />
          <div className="absolute bottom-[-180px] right-[-120px] h-[460px] w-[460px] rounded-full bg-[#1f6f6a] opacity-30 blur-[120px]" />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
              backgroundSize: '56px 56px',
              maskImage: 'radial-gradient(ellipse 80% 70% at 30% 40%, #000 30%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 30% 40%, #000 30%, transparent 100%)',
            }}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative"
        >
          <Wordmark tone="light" />
        </motion.div>

        <div className="relative max-w-lg">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8fb3dc] mb-5"
          >
            Platform control
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-display text-[44px] xl:text-5xl leading-[1.08] tracking-tight text-white"
          >
            The control room for every{' '}
            <span className="italic text-[#b9d3f0]">live classroom</span> on Nexnoon.
          </motion.h1>

          <ul className="mt-12 space-y-6">
            {highlights.map(({ icon: Icon, title, body }, i) => (
              <motion.li
                key={title}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.25 + i * 0.1 }}
                className="flex gap-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-[#b9d3f0]">
                  <Icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <div>
                  <p className="font-medium text-white">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-white/55">{body}</p>
                </div>
              </motion.li>
            ))}
          </ul>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="relative flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/45"
        >
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-[#7fd1b9]" aria-hidden />
            Admin-only, role-verified sign in
          </span>
          <span className="inline-flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            Sessions expire automatically
          </span>
        </motion.div>
      </aside>

      <section className="relative flex min-h-screen flex-col">
        <div className="pointer-events-none absolute inset-0 -z-0 overflow-hidden" aria-hidden>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_80%_-5%,#dbe6f3_0%,transparent_60%)]" />
        </div>

        <header className="relative flex items-center justify-between px-6 py-6 sm:px-10">
          <div className="lg:hidden">
            <Wordmark tone="dark" />
          </div>
          <a
            href={publicSiteHref('/')}
            className="ml-auto inline-flex items-center gap-2 rounded-full border border-[#d0dae6] bg-white/80 px-4 py-2 text-sm font-medium text-[#3d4b5c] shadow-sm transition hover:border-[#0b1220]/30 hover:text-[#0b1220]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to Nexnoon
          </a>
        </header>

        <main className="relative flex flex-1 items-center justify-center px-5 pb-16 sm:px-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="w-full max-w-[420px]"
          >
            <div className="rounded-2xl border border-[#dde4ee] bg-white p-8 shadow-[0_1px_2px_rgba(11,18,32,0.04),0_24px_48px_-24px_rgba(11,18,32,0.18)] sm:p-10">
              <span className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0b1220] text-white shadow-[0_8px_20px_-8px_rgba(11,18,32,0.6)]">
                <ShieldCheck className="h-6 w-6" aria-hidden />
              </span>
              <h2 className="font-display text-3xl tracking-tight">Welcome back</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#5c6b7a]">
                Sign in with your Nexnoon administrator account to manage the platform.
              </p>

              {sessionExpired && (
                <div
                  role="status"
                  className="mt-6 flex items-start gap-2.5 rounded-xl border border-[#d0dae6] bg-[#f4f6f9] px-3.5 py-3 text-sm text-[#3d4b5c]"
                >
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#5a6b7d]" aria-hidden />
                  Your admin session expired. Sign in again to continue.
                </div>
              )}
              {error && (
                <motion.div
                  role="alert"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {error}
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                <div>
                  <label htmlFor="admin-email" className="mb-2 block text-sm font-medium text-[#3d4b5c]">
                    Admin email
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8593a3]" aria-hidden />
                    <input
                      id="admin-email"
                      type="email"
                      autoComplete="username"
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@nexnoon.com"
                      required
                      className="h-12 w-full rounded-xl border border-[#d0dae6] bg-[#fbfcfd] pl-10 pr-3 text-sm outline-none transition placeholder:text-[#a3aebb] focus:border-[#0b1220] focus:bg-white focus:ring-4 focus:ring-[#0b1220]/[0.06]"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor="admin-password" className="block text-sm font-medium text-[#3d4b5c]">
                      Password
                    </label>
                    <a
                      href={publicSiteHref('/forgot-password')}
                      className="text-xs font-medium text-[#3a5f8a] hover:text-[#0b1220] hover:underline"
                    >
                      Forgot password?
                    </a>
                  </div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8593a3]" aria-hidden />
                    <input
                      id="admin-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={trackCapsLock}
                      onKeyUp={trackCapsLock}
                      onBlur={() => setCapsLock(false)}
                      placeholder="Enter your password"
                      required
                      className="h-12 w-full rounded-xl border border-[#d0dae6] bg-[#fbfcfd] pl-10 pr-11 text-sm outline-none transition placeholder:text-[#a3aebb] focus:border-[#0b1220] focus:bg-white focus:ring-4 focus:ring-[#0b1220]/[0.06]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#8593a3] transition hover:bg-[#eef2f7] hover:text-[#0b1220]"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {capsLock && (
                    <p className="mt-2 text-xs font-medium text-amber-700">Caps Lock is on.</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-[#0b1220] text-sm font-medium text-white shadow-[0_10px_24px_-12px_rgba(11,18,32,0.7)] transition hover:bg-[#1a2438] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Signing in…
                    </>
                  ) : (
                    <>
                      Sign in to admin
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-[#a3aebb]">
                <span className="h-px flex-1 bg-[#e6ebf2]" />
                Not an admin?
                <span className="h-px flex-1 bg-[#e6ebf2]" />
              </div>
              <p className="mt-4 text-center text-sm text-[#5c6b7a]">
                Learners and instructors{' '}
                <a href={publicSiteHref('/login')} className="font-medium text-[#0b1220] underline-offset-4 hover:underline">
                  sign in on Nexnoon
                </a>
              </p>
            </div>

            <p className="mt-6 text-center text-xs text-[#8593a3]">
              Restricted area · Repeated failed attempts are temporarily locked.
            </p>
          </motion.div>
        </main>
      </section>
    </div>
  );
}
