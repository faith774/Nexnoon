import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  Check,
  Crown,
  Loader2,
  Search,
  UserMinus,
  UserPlus,
  Users,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { classService, getErrorMessage } from '@/lib/api';
import apiClient from '@/lib/api/client';
import type { Class } from '@/types/api';

export type PendingInvite = {
  email: string;
  fullName?: string;
  id?: string;
};

type InstructorOption = {
  id: string;
  fullName: string;
  email: string;
  avatar?: string;
  headline?: string;
  bio?: string;
  languages?: string[];
  expertise?: string[];
  profileReady?: boolean;
};

type Props = {
  /** When set, invites hit the API immediately. */
  classId?: string;
  classData?: Class | null;
  onClassUpdated?: (cls: Class) => void;
  /** Create-flow: queue invites until class exists. */
  pendingInvites?: PendingInvite[];
  onPendingInvitesChange?: (invites: PendingInvite[]) => void;
};

/**
 * Teaching team picker — lead is the class creator; support instructors are
 * selected from approved Nexnoon instructor portfolios (max 2).
 */
export default function TeachingTeamPanel({
  classId,
  classData,
  onClassUpdated,
  pendingInvites = [],
  onPendingInvitesChange,
}: Props) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<InstructorOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const leadName = classData?.instructor?.name || user?.name || 'You';
  const leadId = classData?.instructor?.id || user?.id;
  const leadAvatar = classData?.instructor?.avatar || user?.avatar;
  const leadHeadline =
    (classData?.instructor as { headline?: string } | undefined)?.headline ||
    user?.headline ||
    '';

  const team = useMemo(() => {
    if (classData?.teachingTeam?.length) {
      return classData.teachingTeam.filter((m) => m.status !== 'removed');
    }
    return [
      {
        userId: leadId || '',
        name: leadName,
        email: user?.email || '',
        role: 'lead' as const,
        status: 'accepted' as const,
      },
    ];
  }, [classData?.teachingTeam, leadId, leadName, user?.email]);

  const teamUserIds = useMemo(
    () =>
      team
        .filter((m) => m.status !== 'declined')
        .map((m) => String(m.userId))
        .join(','),
    [team]
  );
  const pendingEmailsKey = useMemo(
    () => pendingInvites.map((p) => p.email.toLowerCase()).join(','),
    [pendingInvites]
  );

  const supportActive = team.filter(
    (m) => m.role === 'support' && m.status !== 'declined'
  );
  const seatsLeft = Math.max(0, 2 - supportActive.length - (classId ? 0 : pendingInvites.length));

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiClient.get('/data/instructors', { params: { q } });
        if (cancelled) return;
        const list = (res.data?.data || []) as InstructorOption[];
        const blockedIds = new Set(teamUserIds.split(',').filter(Boolean));
        const blockedEmails = new Set(pendingEmailsKey.split(',').filter(Boolean));
        setResults(
          list.filter((i) => {
            if (i.id === leadId) return false;
            if (blockedIds.has(i.id)) return false;
            if (blockedEmails.has(i.email.toLowerCase())) return false;
            return true;
          })
        );
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query, leadId, teamUserIds, pendingEmailsKey]);

  async function inviteInstructor(opt: InstructorOption) {
    setError(null);
    setMessage(null);
    if (seatsLeft <= 0) {
      setError('A class can have at most 2 support instructors.');
      return;
    }

    if (!classId) {
      onPendingInvitesChange?.([
        ...pendingInvites,
        { email: opt.email, fullName: opt.fullName, id: opt.id },
      ]);
      setQuery('');
      setResults([]);
      setMessage(`${opt.fullName} will be invited when you publish.`);
      return;
    }

    setBusyEmail(opt.email);
    try {
      const updated = await classService.inviteInstructor(classId, opt.email);
      onClassUpdated?.(updated);
      setQuery('');
      setResults([]);
      setMessage(`Invite sent to ${opt.fullName}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyEmail(null);
    }
  }

  async function removeSupport(userId: string) {
    if (!classId) return;
    setBusyEmail(userId);
    setError(null);
    try {
      const updated = await classService.removeSupport(classId, userId);
      onClassUpdated?.(updated);
      setMessage('Support instructor removed');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyEmail(null);
    }
  }

  function removePending(email: string) {
    onPendingInvitesChange?.(pendingInvites.filter((p) => p.email !== email));
  }

  const profileGaps: string[] = [];
  if (user?.role === 'instructor') {
    if (!user.avatar) profileGaps.push('photo');
    if (!user.headline) profileGaps.push('headline');
    if (!user.bio) profileGaps.push('bio');
    if (!(user.languages || []).length) profileGaps.push('languages');
    if (!(user.expertise || []).length) profileGaps.push('expertise');
  }

  return (
    <div className="space-y-4 border border-[#eee9e0] bg-[#faf8f5]/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#6b655c] inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Teaching team
          </p>
          <h3 className="font-serif text-lg text-[#14110e] mt-1">Instructors on this class</h3>
          <p className="text-sm text-[#6b655c] mt-1 max-w-xl leading-relaxed">
            Bios, photos, and expertise come from each instructor’s portfolio — not from this form.
            You are the <strong className="text-[#3d3933]">lead</strong>. Invite up to{' '}
            <strong className="text-[#3d3933]">2 support</strong> instructors.
          </p>
        </div>
        {leadId && (
          <Link
            to={`/instructors/${leadId}`}
            className="text-xs font-medium text-[#c45c26] hover:underline inline-flex items-center gap-1"
          >
            View your public profile
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>

      {profileGaps.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Complete your teaching portfolio before learners see a strong profile:{' '}
          <strong>{profileGaps.join(', ')}</strong>.{' '}
          <Link to="/profile" className="underline font-medium">
            Update profile
          </Link>
        </div>
      )}

      <ul className="space-y-2">
        {/* Lead */}
        <li className="flex gap-3 border border-[#e4dfd6] bg-white p-3.5">
          <Avatar name={leadName} src={leadAvatar} />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-[#14110e] flex flex-wrap items-center gap-2">
              {leadName}
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide bg-[#14110e] text-white px-1.5 py-0.5">
                <Crown className="h-3 w-3" /> Lead
              </span>
            </p>
            {leadHeadline ? (
              <p className="text-xs text-[#6b655c] mt-0.5 line-clamp-1">{leadHeadline}</p>
            ) : (
              <p className="text-xs text-[#8a847a] mt-0.5">Add a headline on your profile</p>
            )}
          </div>
        </li>

        {/* Existing support */}
        {team
          .filter((m) => m.role === 'support')
          .map((m) => (
            <li
              key={String(m.userId)}
              className="flex gap-3 border border-[#e4dfd6] bg-white p-3.5"
            >
              <Avatar name={m.name} src={(m as { avatar?: string }).avatar} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[#14110e] flex flex-wrap items-center gap-2">
                  {m.name}
                  <span className="text-[10px] uppercase tracking-wide bg-[#c45c26] text-white px-1.5 py-0.5">
                    Support
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-[#6b655c]">
                    {m.status}
                  </span>
                </p>
                <p className="text-xs text-[#6b655c] mt-0.5">{m.email}</p>
              </div>
              {classId && m.status !== 'declined' && (
                <button
                  type="button"
                  disabled={busyEmail === String(m.userId)}
                  onClick={() => void removeSupport(String(m.userId))}
                  className="self-center inline-flex items-center gap-1 text-xs text-rose-700 border border-rose-200 px-2.5 py-1.5 hover:bg-rose-50 disabled:opacity-50"
                >
                  <UserMinus className="h-3.5 w-3.5" />
                  Remove
                </button>
              )}
            </li>
          ))}

        {/* Pending (create flow) */}
        {!classId &&
          pendingInvites.map((p) => (
            <li key={p.email} className="flex gap-3 border border-dashed border-[#d5cfc4] bg-white p-3.5">
              <Avatar name={p.fullName || p.email} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[#14110e]">
                  {p.fullName || p.email}
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-800 bg-amber-50 px-1.5 py-0.5">
                    Invite on publish
                  </span>
                </p>
                <p className="text-xs text-[#6b655c] mt-0.5">{p.email}</p>
              </div>
              <button
                type="button"
                onClick={() => removePending(p.email)}
                className="self-center text-xs text-[#6b655c] hover:text-rose-700"
              >
                Remove
              </button>
            </li>
          ))}
      </ul>

      {seatsLeft > 0 ? (
        <div className="space-y-2">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-[#6b655c]">
            Add support instructor ({seatsLeft} seat{seatsLeft === 1 ? '' : 's'} left)
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8a847a]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search approved instructors by name or email…"
              className="w-full h-11 border border-[#d5cfc4] bg-white pl-10 pr-3 text-sm outline-none focus:border-[#14110e]"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-[#8a847a]" />
            )}
          </div>
          {results.length > 0 && (
            <ul className="border border-[#eee9e0] bg-white max-h-56 overflow-y-auto divide-y divide-[#f0ebe3]">
              {results.map((opt) => (
                <li key={opt.id} className="flex gap-3 p-3 items-center hover:bg-[#faf8f5]">
                  <Avatar name={opt.fullName} src={opt.avatar} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{opt.fullName}</p>
                    <p className="text-xs text-[#6b655c] truncate">
                      {opt.headline || opt.email}
                      {opt.profileReady === false && (
                        <span className="text-amber-700"> · profile incomplete</span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyEmail === opt.email}
                    onClick={() => void inviteInstructor(opt)}
                    className="shrink-0 inline-flex items-center gap-1.5 bg-[#14110e] text-white px-3 py-2 text-xs hover:bg-black/85 disabled:opacity-50"
                  >
                    {busyEmail === opt.email ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UserPlus className="h-3.5 w-3.5" />
                    )}
                    Invite
                  </button>
                </li>
              ))}
            </ul>
          )}
          {query.trim().length >= 2 && !searching && results.length === 0 && (
            <p className="text-xs text-[#8a847a]">
              No approved instructors matched. They must register and be admin-approved first.
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-[#6b655c] flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-emerald-700" />
          Support seats are full (max 2).
        </p>
      )}

      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-rose-700">{error}</p>}
    </div>
  );
}

function Avatar({ name, src }: { name: string; src?: string }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  if (src) {
    return <img src={src} alt="" className="h-11 w-11 object-cover shrink-0 bg-[#eee9e0]" />;
  }
  return (
    <div className="h-11 w-11 shrink-0 bg-[#14110e] text-white text-xs font-semibold flex items-center justify-center">
      {initials || '?'}
    </div>
  );
}
