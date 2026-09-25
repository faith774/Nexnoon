import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, Hourglass, Lock, RotateCcw, ShieldCheck, Users } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import { toast } from 'sonner';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import BrandLoader from '@/app/components/BrandLoader';
import { Avatar, btn, Field, inputCls } from '@/app/components/studio/ui';
import { useAuth } from '@/contexts/AuthContext';
import { classService, enrollmentService, formatMoney, getErrorMessage, type EnrollmentStatus } from '@/lib/api';
import { useTimeFormat } from '@/lib/timezone';
import { ENV } from '@/config/env';
import type { Class } from '@/types/api';

const stripePromise = ENV.STRIPE_PUBLISHABLE_KEY ? loadStripe(ENV.STRIPE_PUBLISHABLE_KEY) : null;

const cardElementOptions = {
  style: {
    base: { fontSize: '16px', color: '#14110e', fontFamily: 'inherit', '::placeholder': { color: '#8a847a' } },
    invalid: { color: '#be123c' },
  },
};

function hoursLeft(iso?: string) {
  if (!iso) return '';
  const mins = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return `${h} h ${mins % 60} min`;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f6f4f0] text-[#14110e]">
      <Header variant="light" />
      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6">{children}</main>
      <Footer />
    </div>
  );
}

function Notice({ tone = 'stone', icon, title, children }: { tone?: 'stone' | 'clay' | 'green' | 'amber'; icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  const tones = {
    stone: 'border-[#e4dfd6] bg-white',
    clay: 'border-[#f0d3c1] bg-[#fbeee6]',
    green: 'border-emerald-200 bg-emerald-50/70',
    amber: 'border-amber-200 bg-amber-50/80',
  };
  return (
    <div className={`flex gap-3 border p-4 ${tones[tone]}`}>
      <span className="mt-0.5 shrink-0 text-[#c45c26]">{icon}</span>
      <div className="min-w-0 text-sm">
        <p className="font-medium text-[#14110e]">{title}</p>
        {children ? <div className="mt-1 text-[#6b655c]">{children}</div> : null}
      </div>
    </div>
  );
}

function Summary({ cls, status }: { cls: Class; status: EnrollmentStatus }) {
  const t = useTimeFormat();
  const sessions = (cls.schedule || []).filter((s) => s.status !== 'cancelled');
  const first = sessions[0];
  const perSession = first ? Math.round((new Date(first.endTime).getTime() - new Date(first.startTime).getTime()) / 60000) : 0;
  const instructor = typeof cls.instructor === 'object' ? cls.instructor : null;
  const free = cls.price <= 0;

  return (
    <aside className="border border-[#e4dfd6] bg-white lg:sticky lg:top-24">
      {cls.thumbnail ? <img src={cls.thumbnail} alt="" className="aspect-[16/9] w-full object-cover" /> : <div className="aspect-[16/9] w-full bg-gradient-to-br from-[#fbeee6] via-[#f6f4f0] to-[#efe9df]" />}
      <div className="space-y-5 p-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#8a847a]">{cls.category}{cls.language ? ` · ${cls.language}` : ''}</p>
          <h2 className="mt-1 font-serif text-xl leading-snug tracking-tight">{cls.title}</h2>
          {instructor?.name ? (
            <div className="mt-3 flex items-center gap-2.5 text-sm text-[#6b655c]">
              <Avatar name={instructor.name} src={instructor.avatar} size={28} />
              with <span className="text-[#14110e]">{instructor.name}</span>
            </div>
          ) : null}
        </div>
        <ul className="space-y-2.5 border-t border-[#eee9e0] pt-4 text-sm text-[#6b655c]">
          <li className="flex items-center gap-2.5"><CalendarDays className="h-4 w-4 text-[#b5aea3]" />{sessions.length || cls.totalSessions} live session{(sessions.length || cls.totalSessions) === 1 ? '' : 's'}{perSession ? ` · ${perSession} min each` : ''}</li>
          {first ? <li className="flex items-center gap-2.5"><Clock className="h-4 w-4 text-[#b5aea3]" />Starts {t.dayTime(first.startTime)}</li> : null}
          <li className="flex items-center gap-2.5"><Users className="h-4 w-4 text-[#b5aea3]" />{status.seatsLeft > 0 ? `${status.seatsLeft} of ${status.seatCap} seats left` : 'Class is full'}</li>
        </ul>
        <div className="flex items-baseline justify-between border-t border-[#eee9e0] pt-4">
          <span className="text-sm text-[#6b655c]">Total</span>
          <span className="font-serif text-2xl tracking-tight">{free ? 'Free' : formatMoney(cls.price, status.currency)}</span>
        </div>
        {!free ? (
          <p className="flex gap-2 text-xs leading-relaxed text-[#8a847a]">
            <RotateCcw className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Full refund if you leave within {status.refundWindowDays} day{status.refundWindowDays === 1 ? '' : 's'} of paying and before the first session. After that you can still leave, without a refund.
          </p>
        ) : null}
      </div>
    </aside>
  );
}

function Checkout({ cls, status, reload }: { cls: Class; status: EnrollmentStatus; reload: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const stripe = useStripe();
  const elements = useElements();
  const [name, setName] = useState(user?.name || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const t = useTimeFormat();

  const offer = status.waitlist?.status === 'offered' ? status.waitlist : null;
  const needsCard = cls.price > 0 && !status.alreadyPaid;

  const done = useCallback(
    (message: string) => {
      toast.success(message);
      navigate(`/enrollment-success/${cls.id}`, { replace: true });
    },
    [cls.id, navigate]
  );

  async function enroll() {
    setBusy(true);
    setError('');
    try {
      let paymentMethodId: string | undefined;
      if (needsCard) {
        const card = elements?.getElement(CardElement);
        if (!stripe || !card) throw new Error('Card payments are not available right now. Please try again shortly.');
        const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
          type: 'card',
          card,
          billing_details: { name: name.trim() || undefined, email: user?.email },
        });
        if (pmError || !paymentMethod) throw new Error(pmError?.message || 'We could not read that card.');
        paymentMethodId = paymentMethod.id;
      }

      let result = await enrollmentService.enroll(cls.id, paymentMethodId);
      if (result.kind === 'requires_action') {
        if (!stripe) throw new Error('Your bank needs to confirm this payment, but card checks are unavailable.');
        const { error: actionError } = await stripe.handleNextAction({ clientSecret: result.clientSecret });
        if (actionError) throw new Error(actionError.message || 'The bank check was not completed. No payment was taken.');
        result = await enrollmentService.confirm(result.paymentIntentId);
      }
      if (result.kind === 'enrolled') done(result.message);
    } catch (err) {
      const msg = err instanceof Error && !(err as any).isAxiosError ? err.message : getErrorMessage(err);
      setError(msg);
      reload();
    } finally {
      setBusy(false);
    }
  }

  const label = cls.price <= 0 ? 'Join this class — free' : status.alreadyPaid ? 'Rejoin class' : `Pay ${formatMoney(cls.price, status.currency)} and enroll`;

  return (
    <section className="border border-[#e4dfd6] bg-white">
      <header className="border-b border-[#eee9e0] px-5 py-4 md:px-6">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#8a847a]">Step 1 of 1</p>
        <h2 className="mt-1 font-serif text-2xl tracking-tight">{needsCard ? 'Payment details' : 'Confirm your seat'}</h2>
      </header>
      <div className="space-y-5 p-5 md:p-6">
        {offer ? (
          <Notice tone="clay" icon={<Hourglass className="h-4 w-4" />} title="A seat is held for you">
            Claim it within {hoursLeft(offer.offerExpiresAt)} (until {t.dayTime(offer.offerExpiresAt)}). After that it goes to the next person on the waitlist.
          </Notice>
        ) : null}
        {status.alreadyPaid && cls.price > 0 ? (
          <Notice tone="green" icon={<CheckCircle2 className="h-4 w-4" />} title="You've already paid for this class">
            You left without a refund earlier, so you can rejoin at no extra cost.
          </Notice>
        ) : null}

        {needsCard ? (
          <>
            <Field label="Name on card">
              <input className={inputCls} value={name} autoComplete="cc-name" onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            </Field>
            <Field label="Card">
              <div className="border border-[#d5cfc4] bg-white px-3 py-3 focus-within:border-[#c45c26] focus-within:ring-2 focus-within:ring-[#c45c26]/15">
                <CardElement options={cardElementOptions} />
              </div>
            </Field>
          </>
        ) : (
          <p className="text-sm text-[#6b655c]">
            You'll get a confirmation email, and the class appears on your dashboard with every session in your time zone.
          </p>
        )}

        {error ? <p role="alert" className="border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">{error}</p> : null}

        <button type="button" className={`${btn.accent} w-full py-3.5 text-base`} disabled={busy || (needsCard && !name.trim())} onClick={() => void enroll()}>
          {needsCard ? <Lock className="h-4 w-4" /> : null}
          {busy ? 'Working…' : label}
        </button>
        {needsCard ? (
          <p className="flex items-center justify-center gap-1.5 text-xs text-[#8a847a]">
            <ShieldCheck className="h-3.5 w-3.5" /> Secured by Stripe. Your bank may ask you to confirm.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function Waitlist({ cls, status, reload }: { cls: Class; status: EnrollmentStatus; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const waiting = status.waitlist?.status === 'waiting';

  async function act() {
    setBusy(true);
    try {
      if (waiting) toast.success(await enrollmentService.leaveWaitlist(cls.id));
      else toast.success((await enrollmentService.joinWaitlist(cls.id)).message);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border border-[#e4dfd6] bg-white">
      <header className="border-b border-[#eee9e0] px-5 py-4 md:px-6">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#8a847a]">This class is full</p>
        <h2 className="mt-1 font-serif text-2xl tracking-tight">{waiting ? `You're number ${status.waitlist?.position ?? '—'} on the waitlist` : 'Join the waitlist'}</h2>
      </header>
      <div className="space-y-5 p-5 md:p-6">
        <ol className="space-y-3 text-sm text-[#6b655c]">
          {[
            'When a seat opens, the first person in line gets it.',
            `We hold it for ${status.waitlistClaimHours} hours and tell you by email and in the app.`,
            'Claim it here to enroll. If you miss it, the seat moves to the next person.',
          ].map((line, i) => (
            <li key={line} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-[#fbeee6] text-xs font-medium text-[#9a4518]">{i + 1}</span>
              {line}
            </li>
          ))}
        </ol>
        <button type="button" className={`${waiting ? btn.secondary : btn.accent} w-full py-3`} disabled={busy} onClick={() => void act()}>
          {busy ? 'Working…' : waiting ? 'Leave the waitlist' : 'Join the waitlist'}
        </button>
        <p className="text-center text-xs text-[#8a847a]">Joining is free. You only pay when you claim a seat.</p>
      </div>
    </section>
  );
}

function StateCard({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  return (
    <section className="border border-[#e4dfd6] bg-white p-6 md:p-8">
      <h2 className="font-serif text-2xl tracking-tight">{title}</h2>
      <p className="mt-2 text-sm text-[#6b655c]">{body}</p>
      <div className="mt-6 flex flex-wrap gap-2">{action}</div>
    </section>
  );
}

export default function Payment() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [cls, setCls] = useState<Class | null>(null);
  const [status, setStatus] = useState<EnrollmentStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login', { replace: true, state: { from: { pathname: `/payment/${id}` } } });
    }
  }, [authLoading, isAuthenticated, id, navigate]);

  const reload = useCallback(() => {
    enrollmentService.status(id).then(setStatus).catch((err) => setLoadError(getErrorMessage(err)));
  }, [id]);

  useEffect(() => {
    if (!id || authLoading || !isAuthenticated) return;
    let cancelled = false;
    Promise.all([classService.getClass(id), enrollmentService.status(id)])
      .then(([c, s]) => {
        if (cancelled) return;
        setCls(c);
        setStatus(s);
      })
      .catch((err) => !cancelled && setLoadError(getErrorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [id, authLoading, isAuthenticated]);

  const body = useMemo(() => {
    if (!cls || !status) return null;
    const enrolled = status.enrollment && status.enrollment.status !== 'dropped';
    if (enrolled) {
      return (
        <StateCard
          title="You're already in this class"
          body={status.enrollment!.status === 'completed' ? 'You completed this class. Your certificate is on your dashboard.' : 'Your seat is confirmed. Sessions and materials are in your classroom.'}
          action={
            <>
              <Link to={`/classroom/${cls.id}`} className={btn.accent}>Open classroom</Link>
              <Link to="/my-classes" className={btn.secondary}>My dashboard</Link>
            </>
          }
        />
      );
    }
    if (status.teaches) {
      return <StateCard title="You teach this class" body="Instructors can't enroll in their own classes." action={<Link to={`/classroom/${cls.id}`} className={btn.accent}>Open classroom</Link>} />;
    }
    if (!status.open) {
      return <StateCard title="Enrollment is closed" body={status.closedReason || 'This class is not taking new learners.'} action={<Link to="/browse" className={btn.accent}>Find another class</Link>} />;
    }
    if (status.full) return <Waitlist cls={cls} status={status} reload={reload} />;
    if (cls.price > 0 && !status.alreadyPaid && !stripePromise) {
      return <StateCard title="Card payments are offline" body="We can't take payments right now. Please try again later or contact support." action={<Link to={`/class/${cls.id}`} className={btn.secondary}>Back to class</Link>} />;
    }
    return <Checkout cls={cls} status={status} reload={reload} />;
  }, [cls, status, reload]);

  if (loadError && !cls) {
    return (
      <Shell>
        <StateCard title="We couldn't open checkout" body={loadError} action={<Link to="/browse" className={btn.accent}>Browse classes</Link>} />
      </Shell>
    );
  }
  if (!cls || !status) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f4f0]">
        <BrandLoader />
      </div>
    );
  }

  return (
    <Shell>
      <Link to={`/class/${cls.id}`} className="mb-6 inline-flex items-center gap-1.5 text-sm text-[#6b655c] hover:text-[#14110e]">
        <ArrowLeft className="h-4 w-4" /> Back to class
      </Link>
      <h1 className="mb-8 font-serif text-3xl tracking-tight md:text-4xl">Reserve your seat</h1>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <Elements stripe={stripePromise}>{body}</Elements>
        <Summary cls={cls} status={status} />
      </div>
    </Shell>
  );
}
