import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  KeyRound,
  LogOut,
  Shield,
  UserRound,
} from 'lucide-react';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import BackendState from '@/app/components/BackendState';
import { Button } from '@/app/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

function roleLabel(role: string) {
  if (role === 'student') return 'Learner';
  if (role === 'instructor') return 'Instructor';
  if (role === 'admin') return 'Admin';
  return role;
}

export default function Settings() {
  const { user, isLoading, updateProfile, logout } = useAuth();
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user?.name || '');
  }, [user?.name]);

  if (isLoading && !user) {
    return <BackendState title="Settings" loading message="Loading Nexnoon" />;
  }
  if (!user) {
    return <BackendState title="Settings" message="Sign in to manage your account." />;
  }

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await updateProfile({ name: name.trim() });
      setMessage('Your account has been updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const dirty = name.trim() !== (user.name || '').trim();
  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || user.email.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f5f1] text-[#14110e]">
      <Header variant="light" />

      <main className="flex-1 pb-16">
        <section className="border-b border-[#ebe6de] bg-gradient-to-b from-white to-[#f7f5f1]">
          <div className="w-[90vw] max-w-3xl mx-auto pt-10 md:pt-14 pb-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a847a] mb-3">
              Account
            </p>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="font-serif text-4xl md:text-[2.75rem] tracking-tight leading-none">
                  Settings
                </h1>
                <p className="mt-3 text-[#7a746a] max-w-md leading-relaxed">
                  Update how you appear on Nexnoon and manage sign-in, alerts, and profile details.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-2xl bg-[#14110e] text-white font-serif text-xl flex items-center justify-center overflow-hidden">
                  {user.avatar ? (
                    <img src={user.avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold tracking-tight truncate">{user.name}</p>
                  <p className="text-sm text-[#8a847a] truncate">{user.email}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="w-[90vw] max-w-3xl mx-auto pt-8 space-y-6">
          {/* Profile name */}
          <form
            onSubmit={save}
            className="rounded-[1.75rem] border border-[#ebe6de] bg-white overflow-hidden"
          >
            <div className="border-b border-[#ebe6de] px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0ebe3] text-[#5c564e]">
                  <UserRound className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                </span>
                <div>
                  <h2 className="font-serif text-xl tracking-tight">Display name</h2>
                  <p className="text-sm text-[#8a847a]">Shown on your profile and in classrooms.</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-6 space-y-5">
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a847a]">
                  Full name
                </span>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-2 block w-full rounded-2xl border border-[#e0dbd2] bg-[#faf9f6] px-4 py-3 text-[15px] text-[#14110e] outline-none transition focus:border-[#14110e]/40 focus:bg-white focus:ring-2 focus:ring-[#14110e]/10"
                  placeholder="Your name"
                  autoComplete="name"
                />
              </label>

              {message ? (
                <p
                  role="status"
                  className="flex items-center gap-2 rounded-2xl bg-[#eef6ef] px-4 py-3 text-sm text-[#2f6b3a]"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {message}
                </p>
              ) : null}
              {error ? (
                <p role="alert" className="rounded-2xl bg-[#fef2f2] px-4 py-3 text-sm text-[#b42318]">
                  {error}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button
                  type="submit"
                  disabled={saving || !name.trim() || !dirty}
                  className="h-11 rounded-2xl bg-[#14110e] px-6 text-white hover:bg-[#2a2520] disabled:opacity-40"
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
                {dirty ? (
                  <button
                    type="button"
                    onClick={() => {
                      setName(user.name || '');
                      setMessage('');
                      setError('');
                    }}
                    className="text-sm font-medium text-[#7a746a] hover:text-[#14110e]"
                  >
                    Discard
                  </button>
                ) : null}
              </div>
            </div>
          </form>

          {/* Account details */}
          <section className="rounded-[1.75rem] border border-[#ebe6de] bg-white overflow-hidden">
            <div className="border-b border-[#ebe6de] px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0ebe3] text-[#5c564e]">
                  <Shield className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                </span>
                <div>
                  <h2 className="font-serif text-xl tracking-tight">Account details</h2>
                  <p className="text-sm text-[#8a847a]">Read-only identity for this login.</p>
                </div>
              </div>
            </div>
            <dl className="divide-y divide-[#ebe6de]">
              <div className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <dt className="text-sm text-[#8a847a]">Email</dt>
                <dd className="text-[15px] font-medium tracking-tight">{user.email}</dd>
              </div>
              <div className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <dt className="text-sm text-[#8a847a]">Role</dt>
                <dd>
                  <span className="inline-flex rounded-full bg-[#f0ebe3] px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-[#5c564e]">
                    {roleLabel(user.role)}
                  </span>
                </dd>
              </div>
              <div className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <dt className="text-sm text-[#8a847a]">Email verification</dt>
                <dd className="text-[15px] font-medium tracking-tight">
                  {user.isEmailVerified ? (
                    <span className="inline-flex items-center gap-1.5 text-[#2f6b3a]">
                      <CheckCircle2 className="h-4 w-4" />
                      Verified
                    </span>
                  ) : (
                    <span className="text-[#8a6a2f]">Pending verification</span>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          {/* Quick links */}
          <section className="rounded-[1.75rem] border border-[#ebe6de] bg-white overflow-hidden">
            <div className="border-b border-[#ebe6de] px-6 py-5">
              <h2 className="font-serif text-xl tracking-tight">More settings</h2>
              <p className="mt-1 text-sm text-[#8a847a]">Jump to profile, alerts, and security.</p>
            </div>
            <ul className="divide-y divide-[#ebe6de]">
              {(
                [
                  {
                    to: '/profile',
                    icon: UserRound,
                    title: 'Public profile',
                    hint: 'Bio, photo, and teaching portfolio',
                  },
                  {
                    to: '/notifications',
                    icon: Bell,
                    title: 'Notifications',
                    hint: 'Class reminders and account updates',
                  },
                  {
                    to: '/change-password',
                    icon: KeyRound,
                    title: 'Change password',
                    hint: 'Update your password while signed in',
                  },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className="group flex items-center gap-4 px-6 py-4 transition-colors hover:bg-[#faf9f6]"
                    >
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f0ebe3] text-[#5c564e]">
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold tracking-tight">
                          {item.title}
                        </span>
                        <span className="block text-sm text-[#8a847a]">{item.hint}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 text-[#c4bdb2] transition-transform group-hover:translate-x-0.5 group-hover:text-[#889dd1]" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Sign out */}
          <section className="rounded-[1.75rem] border border-[#ebe6de] bg-white px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight">Sign out</h2>
              <p className="mt-1 text-sm text-[#8a847a]">
                End this session on this device. You can sign back in anytime.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={logout}
              className="h-11 rounded-2xl border-[#f0c4c0] bg-[#fef7f6] px-5 text-[#b42318] hover:bg-[#fdecea] hover:text-[#912018]"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
