import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  Mail,
  Mic2,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  isValidEmail,
  passwordChecks,
  passwordStrength,
  rememberAccount,
  suggestEmail,
} from '@/lib/auth-ux';
import { AuthCard, AuthInput, AuthShell, EmailSuggestion, FormNotice, PrimaryButton } from '@/app/components/auth/AuthKit';

type Role = 'student' | 'instructor';
type Step = 'role' | 'details';

const roleOptions: {
  id: Role;
  icon: typeof GraduationCap;
  title: string;
  tagline: string;
  steps: string[];
}[] = [
  {
    id: 'student',
    icon: GraduationCap,
    title: 'I want to learn',
    tagline: 'Join live cohorts taught by certified instructors.',
    steps: ['Pick a course and your language', 'Reserve a seat in a live cohort', 'Learn, submit work, earn your certificate'],
  },
  {
    id: 'instructor',
    icon: Mic2,
    title: 'I want to teach',
    tagline: 'Apply to lead official Nexnoon courses.',
    steps: ['Create your account and complete your teaching profile', 'Nexnoon reviews and certifies you per course', 'Get assigned cohorts and start teaching'],
  },
];

const strengthColors = ['bg-[#e4ddd2]', 'bg-red-400', 'bg-amber-400', 'bg-[#7fb8a4]', 'bg-emerald-500'];

export default function Signup() {
  const [params] = useSearchParams();
  const presetRole: Role | null = params.get('role') === 'instructor' ? 'instructor' : params.get('role') === 'student' ? 'student' : null;

  const [step, setStep] = useState<Step>(presetRole ? 'details' : 'role');
  const [role, setRole] = useState<Role>(presetRole || 'student');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromState = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
  const from = fromState?.pathname ? `${fromState.pathname}${fromState.search || ''}` : '';

  const suggestion = useMemo(() => suggestEmail(email), [email]);
  const checks = useMemo(() => passwordChecks(password, email, name), [password, email, name]);
  const strength = passwordStrength(checks, password);
  const firstName = name.trim().split(/\s+/)[0];

  const show = (field: string) => submitted || touched[field];
  const nameError = name.trim().length < 2 ? 'Enter your full name.' : '';
  const emailError = !isValidEmail(email) ? 'Enter a valid email address.' : '';
  const passwordError = password.length < 8 ? 'Use at least 8 characters.' : strength.score < 2 ? 'Make your password a little stronger.' : '';
  const termsError = !agreedToTerms ? 'Please accept the Terms and Privacy Policy.' : '';
  const canSubmit = !nameError && !emailError && !passwordError && !termsError;

  const selected = roleOptions.find((r) => r.id === role)!;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setError('');
    if (!canSubmit) return;

    setIsLoading(true);
    try {
      await signup(email.trim(), password, name.trim(), role);
      rememberAccount({ email: email.trim(), name: name.trim() });
      if (role === 'instructor') {
        navigate('/instructor/application?welcome=1');
      } else {
        navigate(from || '/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setIsLoading(false);
    }
  };

  const slide = {
    initial: { opacity: 0, x: 24 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -24 },
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
  };

  return (
    <AuthShell
      audience={role === 'instructor' ? 'teach' : 'learn'}
      topAction={
        <span className="hidden text-white/60 md:inline">
          Have an account?{' '}
          <Link to="/login" state={location.state} className="font-medium text-white hover:underline">
            Log in
          </Link>
        </span>
      }
    >
      <AuthCard>
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#b7793a]">
            Step {step === 'role' ? 1 : 2} of 2
          </p>
          <div className="flex gap-1.5" aria-hidden>
            <span className="h-1.5 w-8 rounded-full bg-[#14110e]" />
            <span className={`h-1.5 w-8 rounded-full transition-colors ${step === 'details' ? 'bg-[#14110e]' : 'bg-[#e4ddd2]'}`} />
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {step === 'role' ? (
            <motion.div key="role" {...slide}>
              <h1 className="mt-3 font-display text-[34px] leading-[1.1] tracking-tight">How will you use Nexnoon?</h1>
              <p className="mt-2 text-[15px] leading-relaxed text-[#14110e]/60">
                Choose a path. You can explore every class either way.
              </p>

              <div role="radiogroup" aria-label="Account type" className="mt-7 space-y-3">
                {roleOptions.map((option) => {
                  const active = role === option.id;
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setRole(option.id)}
                      onDoubleClick={() => {
                        setRole(option.id);
                        setStep('details');
                      }}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        active
                          ? 'border-[#14110e] bg-white shadow-[0_12px_30px_-18px_rgba(20,17,14,0.5)]'
                          : 'border-[#e4ddd2] bg-white/60 hover:border-[#14110e]/35'
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <span
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition ${
                            active ? 'bg-[#14110e] text-white' : 'bg-[#f3efe8] text-[#14110e]/70'
                          }`}
                        >
                          <Icon className="h-5 w-5" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[16px] font-semibold">{option.title}</p>
                            <span
                              className={`flex h-5 w-5 items-center justify-center rounded-full border transition ${
                                active ? 'border-[#14110e] bg-[#14110e] text-white' : 'border-[#d6cec1]'
                              }`}
                            >
                              {active && <Check className="h-3 w-3" strokeWidth={3} />}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[13px] text-[#14110e]/60">{option.tagline}</p>
                          <AnimatePresence initial={false}>
                            {active && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25 }}
                                className="overflow-hidden"
                              >
                                <ol className="mt-3 space-y-1.5 border-t border-[#ebe6de] pt-3">
                                  {option.steps.map((s, i) => (
                                    <li key={s} className="flex items-center gap-2.5 text-[13px] text-[#14110e]/75">
                                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f3efe8] text-[11px] font-semibold">
                                        {i + 1}
                                      </span>
                                      {s}
                                    </li>
                                  ))}
                                </ol>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-7">
                <PrimaryButton type="button" onClick={() => setStep('details')}>
                  {role === 'instructor' ? 'Continue to application' : 'Continue as a learner'}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </PrimaryButton>
              </div>
            </motion.div>
          ) : (
            <motion.div key="details" {...slide}>
              <button
                type="button"
                onClick={() => setStep('role')}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#f3efe8] py-1.5 pl-2 pr-3 text-[13px] font-medium text-[#14110e]/75 transition hover:bg-[#ebe4d8] hover:text-[#14110e]"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                <selected.icon className="h-3.5 w-3.5" aria-hidden />
                {role === 'instructor' ? 'Teaching application' : 'Learner account'}
                <span className="text-[#14110e]/40">· change</span>
              </button>

              <h1 className="mt-4 font-display text-[34px] leading-[1.1] tracking-tight">
                {firstName.length >= 2 ? `Nice to meet you, ${firstName}.` : role === 'instructor' ? 'Apply to teach' : 'Create your account'}
              </h1>
              <p className="mt-2 text-[15px] leading-relaxed text-[#14110e]/60">
                {role === 'instructor'
                  ? 'Your application goes to the Nexnoon team. We certify instructors per course before they teach.'
                  : 'Takes less than a minute. We’ll email you a link to verify your address.'}
              </p>

              {error && (
                <div className="mt-6">
                  <FormNotice tone="error" icon={AlertCircle}>
                    {error}
                    {/already registered/i.test(error) && (
                      <>
                        {' '}
                        <Link to="/login" className="font-medium underline underline-offset-2">
                          Log in instead
                        </Link>
                      </>
                    )}
                  </FormNotice>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
                <div>
                  <AuthInput
                    id="name"
                    label="Full name"
                    icon={UserIcon}
                    autoComplete="name"
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                    placeholder="Ada Okafor"
                    invalid={show('name') && !!nameError}
                  />
                  {show('name') && nameError && <p className="mt-2 text-[13px] text-red-600">{nameError}</p>}
                </div>

                <div>
                  <AuthInput
                    id="email"
                    label="Email address"
                    icon={Mail}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                    placeholder="you@example.com"
                    invalid={show('email') && !!emailError}
                  />
                  {show('email') && emailError ? (
                    <p className="mt-2 text-[13px] text-red-600">{emailError}</p>
                  ) : (
                    <EmailSuggestion suggestion={suggestion} onAccept={setEmail} />
                  )}
                </div>

                <div>
                  <AuthInput
                    id="password"
                    label="Create a password"
                    icon={Lock}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                    placeholder="At least 8 characters"
                    invalid={show('password') && !!passwordError}
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

                  <AnimatePresence initial={false}>
                    {password.length > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-3">
                          <div className="flex items-center gap-3">
                            <div className="flex flex-1 gap-1.5" aria-hidden>
                              {[1, 2, 3, 4].map((i) => (
                                <span
                                  key={i}
                                  className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                                    strength.score >= i ? strengthColors[strength.score] : 'bg-[#e4ddd2]'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="w-16 text-right text-[12px] font-medium text-[#14110e]/70" aria-live="polite">
                              {strength.label}
                            </span>
                          </div>
                          <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                            {checks.map((c) => (
                              <li
                                key={c.id}
                                className={`flex items-center gap-2 text-[12px] transition-colors ${
                                  c.met ? 'text-emerald-700' : 'text-[#14110e]/50'
                                }`}
                              >
                                <span
                                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition ${
                                    c.met ? 'bg-emerald-600 text-white' : 'border border-[#d6cec1]'
                                  }`}
                                >
                                  {c.met && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
                                </span>
                                {c.label}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {show('password') && passwordError && password.length === 0 && (
                    <p className="mt-2 text-[13px] text-red-600">{passwordError}</p>
                  )}
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-2xl p-1 text-[13px] leading-relaxed text-[#14110e]/65">
                  <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="peer absolute inset-0 cursor-pointer appearance-none rounded-md border border-[#d6cec1] bg-white transition checked:border-[#14110e] checked:bg-[#14110e] focus-visible:ring-4 focus-visible:ring-[#14110e]/10"
                    />
                    <Check className="pointer-events-none relative h-3 w-3 text-white opacity-0 peer-checked:opacity-100" strokeWidth={3.5} />
                  </span>
                  <span>
                    I agree to the{' '}
                    <Link to="/terms" className="font-medium text-[#14110e] underline-offset-4 hover:underline">
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link to="/privacy" className="font-medium text-[#14110e] underline-offset-4 hover:underline">
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>
                {submitted && termsError && <p className="-mt-3 text-[13px] text-red-600">{termsError}</p>}

                <PrimaryButton loading={isLoading} loadingLabel={role === 'instructor' ? 'Submitting…' : 'Creating account…'}>
                  {role === 'instructor' ? 'Submit application' : 'Create account'}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </PrimaryButton>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="mt-8 text-center text-[14px] text-[#14110e]/60">
          Already have an account?{' '}
          <Link to="/login" state={location.state} className="font-medium text-[#14110e] underline-offset-4 hover:underline">
            Log in
          </Link>
        </p>
      </AuthCard>
    </AuthShell>
  );
}
