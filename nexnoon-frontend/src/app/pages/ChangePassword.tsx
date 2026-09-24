import { authService, getErrorMessage } from '@/lib/api';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Lock, Shield } from 'lucide-react';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import BackendState from '@/app/components/BackendState';
import { Button } from '@/app/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

export default function ChangePassword() {
  const { user, isLoading: authLoading } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  if (authLoading && !user) {
    return <BackendState title="Change password" loading message="Loading Nexnoon" />;
  }
  if (!user) {
    return (
      <BackendState
        title="Change password"
        message="Sign in to change your password. If you forgot it, use Reset password from the login page."
      />
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (currentPassword === newPassword) {
      setError('New password must be different from your current password.');
      return;
    }

    setSaving(true);
    try {
      await authService.changePassword({ currentPassword, newPassword });
      setSuccess('Your password has been updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f5f1] text-[#14110e]">
      <Header variant="light" />

      <main className="flex-1 pb-16">
        <section className="border-b border-[#ebe6de] bg-gradient-to-b from-white to-[#f7f5f1]">
          <div className="w-[90vw] max-w-lg mx-auto pt-10 md:pt-14 pb-8">
            <Link
              to="/settings"
              className="inline-flex items-center gap-2 text-sm font-medium text-[#7a746a] transition-colors hover:text-[#14110e]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to settings
            </Link>
            <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a847a] mb-2">
              Security
            </p>
            <h1 className="font-serif text-4xl tracking-tight leading-none">Change password</h1>
            <p className="mt-3 text-[#7a746a] leading-relaxed max-w-md">
              Enter your current password, then choose a new one. This is for signed-in accounts—not
              the forgot-password flow.
            </p>
          </div>
        </section>

        <div className="w-[90vw] max-w-lg mx-auto pt-8">
          <form
            onSubmit={handleSubmit}
            className="rounded-[1.75rem] border border-[#ebe6de] bg-white overflow-hidden"
          >
            <div className="border-b border-[#ebe6de] px-6 py-5 flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0ebe3] text-[#5c564e]">
                <Shield className="h-[18px] w-[18px]" />
              </span>
              <div>
                <h2 className="font-serif text-xl tracking-tight">Update password</h2>
                <p className="text-sm text-[#8a847a]">Signed in as {user.email}</p>
              </div>
            </div>

            <div className="px-6 py-6 space-y-5">
              <PasswordField
                label="Current password"
                value={currentPassword}
                onChange={setCurrentPassword}
                show={showCurrent}
                onToggle={() => setShowCurrent((v) => !v)}
                autoComplete="current-password"
              />
              <PasswordField
                label="New password"
                value={newPassword}
                onChange={setNewPassword}
                show={showNew}
                onToggle={() => setShowNew((v) => !v)}
                autoComplete="new-password"
                hint="At least 6 characters"
              />
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a847a]">
                  Confirm new password
                </span>
                <div className="relative mt-2">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a948a]" />
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="w-full rounded-2xl border border-[#e0dbd2] bg-[#faf9f6] py-3.5 pl-11 pr-4 text-[15px] outline-none transition focus:border-[#14110e]/35 focus:bg-white focus:ring-2 focus:ring-[#14110e]/10"
                  />
                </div>
              </label>

              {error ? (
                <p
                  role="alert"
                  className="rounded-2xl border border-[#f0c4c0] bg-[#fef7f6] px-4 py-3 text-sm text-[#b42318]"
                >
                  {error}
                </p>
              ) : null}
              {success ? (
                <p
                  role="status"
                  className="flex items-center gap-2 rounded-2xl bg-[#eef6ef] px-4 py-3 text-sm text-[#2f6b3a]"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {success}
                </p>
              ) : null}

              <Button
                type="submit"
                disabled={
                  saving || !currentPassword || !newPassword || !confirmPassword
                }
                className="h-12 w-full rounded-2xl bg-[#14110e] text-[15px] font-semibold text-white hover:bg-[#2a2520] disabled:opacity-40"
              >
                {saving ? 'Updating…' : 'Update password'}
              </Button>
            </div>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggle,
  autoComplete,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  autoComplete: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a847a]">
        {label}
      </span>
      <div className="relative mt-2">
        <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a948a]" />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          autoComplete={autoComplete}
          className="w-full rounded-2xl border border-[#e0dbd2] bg-[#faf9f6] py-3.5 pl-11 pr-12 text-[15px] outline-none transition focus:border-[#14110e]/35 focus:bg-white focus:ring-2 focus:ring-[#14110e]/10"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#9a948a] hover:text-[#14110e]"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint ? <p className="mt-1.5 text-xs text-[#9a948a]">{hint}</p> : null}
    </label>
  );
}
