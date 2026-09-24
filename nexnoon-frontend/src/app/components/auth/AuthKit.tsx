import { useEffect, useMemo, useState, type ReactNode, type InputHTMLAttributes, type Ref } from 'react';
import { Link } from 'react-router';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight, CalendarClock, Globe2, Sparkles, type LucideIcon } from 'lucide-react';
import { classService } from '@/lib/api';
import type { Class } from '@/types/api';

const DEFAULT_SEATS = 25;

type BoardCard = {
  id: string;
  title: string;
  category: string;
  instructor: string;
  language?: string;
  thumbnail?: string;
  enrolled: number;
  max: number;
  nextSession: Date | null;
  sessions: number;
};

function nextSessionOf(c: Class): Date | null {
  const now = Date.now();
  const upcoming = (c.schedule || [])
    .map((s) => new Date(s.startTime))
    .filter((d) => !Number.isNaN(d.getTime()) && d.getTime() > now)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  if (upcoming) return upcoming;
  const start = c.startDate ? new Date(c.startDate) : null;
  return start && start.getTime() > now ? start : null;
}

function describeWhen(date: Date | null, sessions: number): string {
  if (!date) return sessions ? `${sessions} live sessions` : 'Schedule announced soon';
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return `Today · ${time}`;
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow · ${time}`;
  const days = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (days < 7) return `${date.toLocaleDateString([], { weekday: 'long' })} · ${time}`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` · ${time}`;
}

function useBoardClasses() {
  const [cards, setCards] = useState<BoardCard[]>([]);
  useEffect(() => {
    let cancelled = false;
    classService
      .getClasses({ pageSize: 30 })
      .then((res) => {
        if (cancelled) return;
        const mapped = (res.data || [])
          .filter((c) => c.status === 'published')
          .map<BoardCard>((c) => ({
            id: c.id,
            title: c.title,
            category: c.category,
            instructor: c.instructor?.name || 'Nexnoon instructor',
            language: c.language,
            thumbnail: c.thumbnail,
            enrolled: c.enrolledStudents || 0,
            max: c.maxStudents || DEFAULT_SEATS,
            nextSession: nextSessionOf(c),
            sessions: c.totalSessions || c.schedule?.length || 0,
          }))
          .sort((a, b) => {
            if (a.nextSession && b.nextSession) return a.nextSession.getTime() - b.nextSession.getTime();
            if (a.nextSession) return -1;
            if (b.nextSession) return 1;
            return b.enrolled / b.max - a.enrolled / a.max;
          });
        setCards(mapped);
      })
      .catch(() => setCards([]));
    return () => {
      cancelled = true;
    };
  }, []);
  return cards;
}

function ClassTile({ card }: { card: BoardCard }) {
  const seatsLeft = Math.max(0, card.max - card.enrolled);
  const fill = card.max > 0 ? Math.min(100, Math.round((card.enrolled / card.max) * 100)) : 0;
  const almostFull = seatsLeft > 0 && seatsLeft <= 5;
  return (
    <div className="rounded-2xl border border-white/[0.12] bg-[#3a322b]/90 p-4 shadow-[0_12px_30px_-18px_rgba(0,0,0,0.6)]">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/10">
          {card.thumbnail ? (
            <img src={card.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-white/60">
              {card.title.slice(0, 1)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#e8c48a]">{card.category}</p>
          <p className="mt-0.5 line-clamp-2 text-sm font-medium leading-snug text-white">{card.title}</p>
          <p className="mt-1 truncate text-xs text-white/50">with {card.instructor}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/60">
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden />
          {describeWhen(card.nextSession, card.sessions)}
        </span>
        {card.language && (
          <span className="inline-flex items-center gap-1">
            <Globe2 className="h-3.5 w-3.5" aria-hidden />
            {card.language}
          </span>
        )}
      </div>
      <div className="mt-3">
        <div className="h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full ${almostFull ? 'bg-[#f0a35e]' : 'bg-[#7fd1b9]'}`}
            style={{ width: `${Math.max(fill, 4)}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px]">
          <span className="text-white/50">
            {card.enrolled}/{card.max} seats
          </span>
          <span className={seatsLeft === 0 ? 'text-white/40' : almostFull ? 'text-[#f0a35e]' : 'text-[#7fd1b9]'}>
            {seatsLeft === 0 ? 'Full' : almostFull ? `Only ${seatsLeft} left` : `${seatsLeft} open`}
          </span>
        </div>
      </div>
    </div>
  );
}

function MarqueeColumn({ cards, duration, reverse }: { cards: BoardCard[]; duration: number; reverse?: boolean }) {
  const reduceMotion = useReducedMotion();
  const loop = [...cards, ...cards];
  return (
    <div className="relative h-full overflow-hidden">
      <motion.div
        className="flex flex-col gap-4"
        animate={reduceMotion ? undefined : { y: reverse ? ['-50%', '0%'] : ['0%', '-50%'] }}
        transition={{ duration, ease: 'linear', repeat: Infinity }}
      >
        {(reduceMotion ? cards : loop).map((card, i) => (
          <ClassTile key={`${card.id}-${i}`} card={card} />
        ))}
      </motion.div>
    </div>
  );
}

/** Real published cohorts, scrolling in two columns. */
export function LiveClassBoard({ audience }: { audience: 'learn' | 'teach' }) {
  const cards = useBoardClasses();
  const openCohorts = cards.length;
  const openSeats = cards.reduce((sum, c) => sum + Math.max(0, c.max - c.enrolled), 0);
  const languages = useMemo(
    () => new Set(cards.map((c) => c.language).filter(Boolean) as string[]).size,
    [cards]
  );

  const left = cards.filter((_, i) => i % 2 === 0);
  const right = cards.filter((_, i) => i % 2 === 1);

  return (
    <div className="relative flex h-full flex-col">
      <div className="relative z-10 max-w-xl">
        <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/70">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7fd1b9] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#7fd1b9]" />
          </span>
          Enrolling now on Nexnoon
        </p>
        <h2 className="mt-5 font-display text-4xl leading-[1.05] tracking-tight text-white xl:text-[52px]">
          {audience === 'teach' ? (
            <>
              Lead the cohorts <span className="italic text-[#e8c48a]">learners</span> are waiting for.
            </>
          ) : (
            <>
              Real teachers. Real time. <span className="italic text-[#e8c48a]">Real seats.</span>
            </>
          )}
        </h2>
        {openCohorts > 0 && (
          <dl className="mt-7 flex flex-wrap gap-x-10 gap-y-4">
            {[
              { label: 'Open cohorts', value: openCohorts },
              { label: 'Seats available', value: openSeats },
              ...(languages > 1 ? [{ label: 'Languages', value: languages }] : []),
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="text-[11px] uppercase tracking-[0.2em] text-white/40">{stat.label}</dt>
                <dd className="mt-1 font-display text-3xl text-white">{stat.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {cards.length > 0 ? (
        <div
          className="relative mt-10 min-h-0 flex-1"
          style={{
            maskImage: 'linear-gradient(to bottom, transparent, #000 12%, #000 82%, transparent)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 12%, #000 82%, transparent)',
          }}
        >
          <div className="grid h-full grid-cols-2 gap-4">
            <MarqueeColumn cards={left.length ? left : cards} duration={Math.max(24, left.length * 7)} />
            <div className="pt-16">
              <MarqueeColumn cards={right.length ? right : cards} duration={Math.max(28, right.length * 8)} reverse />
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-10 flex flex-1 items-center">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm text-white/60">
            <Sparkles className="h-4 w-4 text-[#e8c48a]" aria-hidden />
            New cohorts open every week.
          </div>
        </div>
      )}
    </div>
  );
}

export function AuthShell({
  children,
  audience = 'learn',
  topAction,
}: {
  children: ReactNode;
  audience?: 'learn' | 'teach';
  topAction?: ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#2a241f] text-white">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[linear-gradient(160deg,#3a3129_0%,#2a241f_45%,#233036_100%)]" />
        <div className="absolute -left-40 -top-48 h-[680px] w-[680px] rounded-full bg-[#c98a4a] opacity-[0.32] blur-[140px]" />
        <div className="absolute -bottom-56 right-[-10%] h-[700px] w-[700px] rounded-full bg-[#3f7c8f] opacity-[0.35] blur-[150px]" />
        <div className="absolute left-1/2 top-1/3 h-[420px] w-[420px] rounded-full bg-[#e8c48a] opacity-[0.08] blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
            maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, #000 20%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, #000 20%, transparent 100%)',
          }}
        />
      </div>

      <header className="relative z-20 mx-auto flex w-[min(94vw,1360px)] items-center justify-between py-6">
        <Link to="/" className="group relative inline-flex" aria-label="Nexnoon home">
          <span className="text-2xl font-bold tracking-tight">Nexnoon</span>
          <span className="absolute -bottom-0.5 right-0 h-0.5 w-4 bg-white transition-all duration-300 group-hover:w-full" />
        </Link>
        <div className="flex items-center gap-3 text-sm">
          {topAction}
          <Link
            to="/"
            className="hidden items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 font-medium text-white/80 transition hover:border-white/40 hover:text-white sm:inline-flex"
          >
            Explore classes
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid w-[min(94vw,1360px)] items-stretch gap-12 pb-12 lg:pb-0 lg:min-h-[calc(100vh-88px)] lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] xl:gap-20">
        <div className="flex items-center py-6 lg:py-10">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="w-full"
          >
            {children}
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="hidden min-h-0 py-10 lg:block lg:h-[calc(100vh-88px)]"
        >
          <LiveClassBoard audience={audience} />
        </motion.div>
      </main>
    </div>
  );
}

export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[28px] bg-[#fbfaf8] p-7 text-[#14110e] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_40px_80px_-30px_rgba(0,0,0,0.55)] sm:p-9">
      {children}
    </div>
  );
}

type AuthInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon: LucideIcon;
  trailing?: ReactNode;
  labelAside?: ReactNode;
  invalid?: boolean;
  inputRef?: Ref<HTMLInputElement>;
};

export function AuthInput({ label, icon: Icon, trailing, labelAside, invalid, inputRef, id, className, ...rest }: AuthInputProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label htmlFor={id} className="text-[13px] font-medium text-[#14110e]/75">
          {label}
        </label>
        {labelAside}
      </div>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a847a]" aria-hidden />
        <input
          ref={inputRef}
          id={id}
          aria-invalid={invalid || undefined}
          className={`h-[52px] w-full rounded-2xl border bg-white pl-11 text-[15px] outline-none transition placeholder:text-[#14110e]/30 focus:ring-4 ${
            trailing ? 'pr-12' : 'pr-4'
          } ${
            invalid
              ? 'border-red-300 focus:border-red-400 focus:ring-red-500/10'
              : 'border-[#e4ddd2] focus:border-[#14110e] focus:ring-[#14110e]/[0.06]'
          } ${className || ''}`}
          {...rest}
        />
        {trailing && <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div>}
      </div>
    </div>
  );
}

export function EmailSuggestion({ suggestion, onAccept }: { suggestion: string | null; onAccept: (email: string) => void }) {
  if (!suggestion) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-2 text-[13px] text-[#14110e]/60"
    >
      Did you mean{' '}
      <button
        type="button"
        onClick={() => onAccept(suggestion)}
        className="font-medium text-[#14110e] underline decoration-[#e8c48a] decoration-2 underline-offset-4 hover:decoration-[#14110e]"
      >
        {suggestion}
      </button>
      ?
    </motion.p>
  );
}

export function PrimaryButton({
  children,
  loading,
  loadingLabel,
  disabled,
  type = 'submit',
  onClick,
}: {
  children: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  type?: 'submit' | 'button';
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className="group relative flex h-[52px] w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-[#14110e] text-[15px] font-medium text-white shadow-[0_14px_30px_-14px_rgba(20,17,14,0.8)] transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      {loading ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
          {loadingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function FormNotice({ tone, icon: Icon, children }: { tone: 'error' | 'info'; icon: LucideIcon; children: ReactNode }) {
  const styles =
    tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-[#ebe3d4] bg-[#f6f1e8] text-[#14110e]/75';
  return (
    <motion.div
      role={tone === 'error' ? 'alert' : 'status'}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-[13px] leading-relaxed ${styles}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </motion.div>
  );
}
