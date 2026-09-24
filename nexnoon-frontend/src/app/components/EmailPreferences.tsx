import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { getErrorMessage } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { EmailPrefs } from '@/types/api';

const DEFAULTS: EmailPrefs = { sessionReminders: 'all', scheduleUpdates: true };

const REMINDER_OPTIONS: { value: EmailPrefs['sessionReminders']; label: string; hint: string }[] = [
  { value: 'all', label: 'All reminders', hint: 'The day before, then 30, 20, 10 and 5 minutes before, and when it starts.' },
  { value: 'key', label: 'Key reminders only', hint: 'The day before, about 10 minutes before, and when it starts.' },
  { value: 'none', label: 'No reminder emails', hint: 'You’ll still see reminders in your Nexnoon notifications.' },
];

/** Saves on change — no Edit/Save round trip. */
export default function EmailPreferences({ teaching = false }: { teaching?: boolean }) {
  const { user, refreshUser } = useAuth();
  const [prefs, setPrefs] = useState<EmailPrefs>(user?.emailPrefs || DEFAULTS);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (user?.emailPrefs) setPrefs(user.emailPrefs);
  }, [user?.emailPrefs?.sessionReminders, user?.emailPrefs?.scheduleUpdates]);

  // Emails link to /profile#email-preferences; the section renders after data loads, so scroll once it exists.
  useEffect(() => {
    if (window.location.hash === '#email-preferences') sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const save = async (next: EmailPrefs) => {
    const previous = prefs;
    setPrefs(next);
    setStatus('saving');
    setError(null);
    try {
      await apiClient.patch('/auth/profile', { emailPrefs: next });
      await refreshUser();
      setStatus('saved');
      window.setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      setPrefs(previous);
      setStatus('idle');
      setError(getErrorMessage(err));
    }
  };

  return (
    <section
      id="email-preferences"
      ref={sectionRef}
      className="scroll-mt-24 border border-[#ddd6ca]/90 bg-white/85 p-6 md:p-7 space-y-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl tracking-tight">Email notifications</h2>
          <p className="text-sm text-[#6b655c] mt-1">
            {teaching
              ? 'Choose which emails you get about the sessions you teach.'
              : 'Choose which emails you get about your classes.'}{' '}
            Cancellations are always emailed.
          </p>
        </div>
        <span className="text-xs text-[#6b655c] min-h-[1rem]" aria-live="polite">
          {status === 'saving' ? 'Saving…' : status === 'saved' ? (
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <Check className="h-3.5 w-3.5" aria-hidden="true" /> Saved
            </span>
          ) : null}
        </span>
      </div>

      <fieldset className="space-y-2">
        <legend className="block text-xs uppercase tracking-[0.14em] text-[#6b655c] mb-2">Session reminders</legend>
        {REMINDER_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`flex cursor-pointer gap-3 border px-4 py-3 transition-colors ${
              prefs.sessionReminders === opt.value ? 'border-[#14110e] bg-[#faf8f5]' : 'border-[#e4dfd6] hover:border-[#c9c2b6]'
            }`}
          >
            <input
              type="radio"
              name="sessionReminders"
              value={opt.value}
              checked={prefs.sessionReminders === opt.value}
              disabled={status === 'saving'}
              onChange={() => void save({ ...prefs, sessionReminders: opt.value })}
              className="mt-1 accent-[#c45c26]"
            />
            <span>
              <span className="block text-sm font-medium text-[#14110e]">{opt.label}</span>
              <span className="block text-xs text-[#6b655c] mt-0.5">{opt.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {!teaching && (
        <label className="flex cursor-pointer items-start gap-3 border border-[#e4dfd6] px-4 py-3 hover:border-[#c9c2b6]">
          <input
            type="checkbox"
            checked={prefs.scheduleUpdates}
            disabled={status === 'saving'}
            onChange={(e) => void save({ ...prefs, scheduleUpdates: e.target.checked })}
            className="mt-1 accent-[#c45c26]"
          />
          <span>
            <span className="block text-sm font-medium text-[#14110e]">Schedule changes</span>
            <span className="block text-xs text-[#6b655c] mt-0.5">Email me when a session is added or moved.</span>
          </span>
        </label>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
