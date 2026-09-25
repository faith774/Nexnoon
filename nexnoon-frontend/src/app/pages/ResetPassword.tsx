import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock } from 'lucide-react';
import { authService, getErrorMessage } from '@/lib/api';
import { AuthCard, AuthInput, AuthShell, FormNotice, PrimaryButton } from '@/app/components/auth/AuthKit';

const MIN_LENGTH = 8;

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== password;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_LENGTH || password !== confirm) return;
    setLoading(true);
    setError('');
    try {
      await authService.confirmPasswordReset({ token, newPassword: password });
      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <AuthCard>
        {!token ? (
          <>
            <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#b7793a]">Password reset</p>
            <h1 className="mt-3 font-display text-[32px] leading-[1.1] tracking-tight">This link is incomplete</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-[#14110e]/60">
              Open the link from your email again, or ask for a new one.
            </p>
            <div className="mt-7">
              <PrimaryButton type="button" onClick={() => navigate('/forgot-password')}>
                Send a new reset link
              </PrimaryButton>
            </div>
          </>
        ) : done ? (
          <>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef6ef] text-[#2f6b3a]">
              <CheckCircle2 className="h-6 w-6" aria-hidden />
            </span>
            <h1 className="mt-5 font-display text-[32px] leading-[1.1] tracking-tight">Password updated</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-[#14110e]/60">
              You can sign in with your new password now.
            </p>
            <div className="mt-7">
              <PrimaryButton type="button" onClick={() => navigate('/login', { replace: true })}>
                Sign in
              </PrimaryButton>
            </div>
          </>
        ) : (
          <>
            <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#b7793a]">Password reset</p>
            <h1 className="mt-3 font-display text-[32px] leading-[1.1] tracking-tight">Choose a new password</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-[#14110e]/60">
              Use at least {MIN_LENGTH} characters. You’ll sign in with it from now on.
            </p>

            <form onSubmit={submit} className="mt-7 space-y-4">
              <AuthInput
                id="new-password"
                label="New password"
                icon={Lock}
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                invalid={tooShort}
                required
                autoFocus
                trailing={
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="rounded-xl p-2 text-[#8a847a] hover:text-[#14110e]"
                    aria-label={show ? 'Hide password' : 'Show password'}
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
              {tooShort && <p className="-mt-2 text-[13px] text-red-600">At least {MIN_LENGTH} characters.</p>}
              <AuthInput
                id="confirm-password"
                label="Confirm new password"
                icon={Lock}
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                invalid={mismatch}
                required
              />
              {mismatch && <p className="-mt-2 text-[13px] text-red-600">The passwords don’t match.</p>}

              {error && (
                <FormNotice tone="error" icon={AlertCircle}>
                  {error}
                  {/expired|invalid/i.test(error) && (
                    <>
                      {' '}
                      <Link to="/forgot-password" className="font-medium underline">
                        Send a new link
                      </Link>
                    </>
                  )}
                </FormNotice>
              )}

              <PrimaryButton
                loading={loading}
                loadingLabel="Saving…"
                disabled={password.length < MIN_LENGTH || password !== confirm}
              >
                Save new password
              </PrimaryButton>
            </form>
          </>
        )}
      </AuthCard>
    </AuthShell>
  );
}
