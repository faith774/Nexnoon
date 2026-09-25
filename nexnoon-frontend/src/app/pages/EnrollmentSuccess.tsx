import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowRight, CalendarDays, CheckCircle2, Clock, LayoutDashboard, Mail, Video } from 'lucide-react';
import confetti from 'canvas-confetti';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import BrandLoader from '@/app/components/BrandLoader';
import { btn } from '@/app/components/studio/ui';
import { classService, enrollmentService, type EnrollmentStatus } from '@/lib/api';
import { useTimeFormat } from '@/lib/timezone';
import { classDetailUrl } from '@/lib/url';
import type { Class } from '@/types/api';

export default function EnrollmentSuccess() {
  const { id } = useParams();
  const fmt = useTimeFormat();
  const [cls, setCls] = useState<Class | null>(null);
  const [seat, setSeat] = useState<EnrollmentStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    Promise.all([
      classService.getClass(id).catch(() => null),
      enrollmentService.status(id).catch(() => null),
    ])
      .then(([c, s]) => {
        setCls(c);
        setSeat(s);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const enrolled = seat?.enrollment?.status === 'active' || seat?.enrollment?.status === 'completed';

  useEffect(() => {
    if (!enrolled) return;
    const end = Date.now() + 2200;
    const colors = ['#c45c26', '#14110e', '#e9b48f'];
    const frame = () => {
      confetti({ particleCount: 2, angle: 60, spread: 55, origin: { x: 0 }, colors });
      confetti({ particleCount: 2, angle: 120, spread: 55, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, [enrolled]);

  const nextSession = useMemo(() => {
    const now = Date.now();
    return (cls?.schedule || [])
      .filter((s) => new Date(s.endTime).getTime() > now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];
  }, [cls]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f4f0]">
        <BrandLoader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f4f0] text-[#14110e]">
      <Header variant="light" />
      <main className="mx-auto w-full max-w-2xl px-4 pb-20 pt-10 sm:px-6">
        {!cls || !enrolled ? (
          <div className="border border-[#e4dfd6] bg-white p-8 text-center">
            <h1 className="font-serif text-2xl tracking-tight">We couldn't confirm this enrollment</h1>
            <p className="mt-2 text-sm text-[#6b655c]">
              If you just paid, give it a moment and check your classes. Nothing is charged twice.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Link to="/my-classes" className={btn.primary}>Go to my classes</Link>
              {id ? <Link to={classDetailUrl(id, cls?.title)} className={btn.secondary}>Back to class</Link> : null}
            </div>
          </div>
        ) : (
          <div className="border border-[#e4dfd6] bg-white">
            <div className="border-b border-[#eee9e0] bg-[#fbeee6] px-6 py-8 text-center sm:px-10">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm">
                <CheckCircle2 className="h-8 w-8" />
              </span>
              <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-[#c45c26]">You're enrolled</p>
              <h1 className="mt-1 font-serif text-3xl tracking-tight">{cls.title}</h1>
              <p className="mt-1 text-sm text-[#6b655c]">with {cls.instructor?.name || 'your instructor'}</p>
            </div>

            <div className="grid gap-px bg-[#eee9e0] sm:grid-cols-2">
              <div className="bg-white p-5">
                <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[#8a847a]">
                  <CalendarDays className="h-3.5 w-3.5" /> First live session
                </p>
                <p className="mt-1.5 text-sm font-medium">
                  {nextSession ? fmt.dayTime(nextSession.startTime) : 'Schedule coming soon'}
                </p>
                {nextSession ? <p className="text-xs text-[#8a847a]">Your time zone: {fmt.tz}</p> : null}
              </div>
              <div className="bg-white p-5">
                <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[#8a847a]">
                  <Clock className="h-3.5 w-3.5" /> Length
                </p>
                <p className="mt-1.5 text-sm font-medium">
                  {cls.totalSessions} live session{cls.totalSessions === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            <div className="space-y-4 p-6 sm:p-8">
              <h2 className="font-serif text-lg tracking-tight">What happens next</h2>
              <ol className="space-y-3">
                {[
                  { icon: <Mail className="h-4 w-4" />, title: 'Confirmation email', text: 'We sent your receipt and class details to your inbox.' },
                  { icon: <LayoutDashboard className="h-4 w-4" />, title: 'Everything lives in My classes', text: 'Your schedule, materials, assignments and certificate are all in one place.' },
                  {
                    icon: <Video className="h-4 w-4" />,
                    title: 'Join from your dashboard',
                    text: "The Join button opens shortly before each session starts. We'll email you a reminder too.",
                  },
                ].map((s) => (
                  <li key={s.title} className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#fbeee6] text-[#c45c26]">{s.icon}</span>
                    <div>
                      <p className="text-sm font-medium">{s.title}</p>
                      <p className="text-sm text-[#6b655c]">{s.text}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                <Link to="/my-classes" className={`${btn.primary} flex-1 py-3`}>
                  Go to my classes <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to={`/classroom/${cls.id}`} className={`${btn.secondary} flex-1 py-3`}>
                  Open classroom
                </Link>
              </div>
              {seat?.refundWindowDays && seat.price > 0 ? (
                <p className="text-center text-xs text-[#8a847a]">
                  Changed your mind? You can leave for a full refund within {seat.refundWindowDays} days, as long as the first session hasn't started.
                </p>
              ) : null}
            </div>
          </div>
        )}
        <p className="mt-6 text-center text-sm text-[#6b655c]">
          Questions? <a href="mailto:support@nexnoon.com" className="font-medium text-[#c45c26] hover:underline">support@nexnoon.com</a>
        </p>
      </main>
      <Footer />
    </div>
  );
}
