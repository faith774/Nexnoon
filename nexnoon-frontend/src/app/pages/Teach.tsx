import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Check,
  ChevronDown,
  ClipboardList,
  FileText,
  Languages,
  Radio,
  ShieldCheck,
  Users,
  Video,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { useAuth } from '@/contexts/AuthContext';

function instructorTeachDestination(status?: string) {
  if (status === 'approved') return '/instructor/dashboard';
  if (status === 'pending' || status === 'rejected' || status === 'suspended') {
    return '/instructor/pending-approval';
  }
  return null;
}

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1649920442906-3c8ef428fb6e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1200';
const STUDIO_IMAGE =
  'https://images.unsplash.com/photo-1764720573370-5008f1ccc9fa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1200';

const stats = [
  { value: '25', label: 'Seats max per cohort' },
  { value: '3', label: 'Lead + 2 support instructors' },
  { value: 'Live', label: 'Every session on Zoom' },
  { value: '100%', label: 'Instructors reviewed before teaching' },
];

const features = [
  {
    icon: BadgeCheck,
    title: 'Teach official courses',
    description: 'Deliver Nexnoon courses you’re certified for. A closed network, not an open marketplace.',
  },
  {
    icon: Video,
    title: 'Live, not recorded',
    description: 'Host scheduled sessions with screen share and materials, and facilitate your cohort in real time.',
  },
  {
    icon: Users,
    title: 'Small cohorts',
    description: 'Classes cap at 25 seats, so every learner gets seen, heard, and helped.',
  },
  {
    icon: Languages,
    title: 'Teach in your language',
    description: 'Courses are offered in several languages. Get certified for the ones you teach best.',
  },
  {
    icon: BarChart3,
    title: 'Quality you can see',
    description: 'Ratings, attendance, and completion feed your instructor quality score in the studio.',
  },
  {
    icon: ShieldCheck,
    title: 'Operations handled',
    description: 'Enrollments, Zoom hosting, and admin support are run by the platform, so you can focus on teaching.',
  },
];

const steps = [
  {
    title: 'Apply to teach',
    description: 'Create your instructor profile. Our admins review every application before approving you into the network.',
  },
  {
    title: 'Get certified',
    description: 'Once approved, you’re certified for specific courses and languages. That’s what you’ll teach.',
  },
  {
    title: 'Host live cohorts',
    description: 'Open a class under a course and language, add up to two support instructors, and go live.',
  },
];

const toolkit = [
  { icon: Radio, label: 'Live Zoom sessions with attendance tracking' },
  { icon: FileText, label: 'Official course templates, materials, and previews' },
  { icon: ClipboardList, label: 'Assignments, grading, and certificates' },
  { icon: Users, label: 'A teaching team of a lead plus up to 2 support' },
  { icon: BarChart3, label: 'Performance insights in your studio' },
];

const faqs = [
  {
    q: 'Can anyone teach on Nexnoon?',
    a: 'Nexnoon is a closed instructor network. Anyone can apply, and every application is reviewed by an admin before you can teach.',
  },
  {
    q: 'Do I create my own courses?',
    a: 'No. You teach official Nexnoon courses. After approval you’re certified for specific courses and languages, and you run live classes under them.',
  },
  {
    q: 'How big are the classes?',
    a: 'Each class is capped at 25 learners, so sessions stay interactive.',
  },
  {
    q: 'Can I teach with other instructors?',
    a: 'Yes. Every class has a lead instructor and can add up to two support instructors.',
  },
  {
    q: 'What happens after I apply?',
    a: 'Your application shows as pending while an admin reviews it. You’ll get access to your instructor studio as soon as you’re approved.',
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#e4dfd6]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-6 py-5 text-left"
      >
        <span className="font-serif text-lg text-[#14110e]">{q}</span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-[#8a847a] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? <p className="-mt-1 pb-5 pr-10 text-[15px] leading-relaxed text-[#5c574f]">{a}</p> : null}
    </div>
  );
}

export default function Teach() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading || !isAuthenticated || user?.role !== 'instructor') return;
    const dest = instructorTeachDestination(user.instructorStatus);
    if (dest) navigate(dest, { replace: true });
  }, [isLoading, isAuthenticated, user?.role, user?.instructorStatus, navigate]);

  const goStartTeaching = () => {
    if (isAuthenticated && user?.role === 'instructor') {
      const dest = instructorTeachDestination(user.instructorStatus);
      navigate(dest || '/signup?role=instructor');
      return;
    }
    navigate('/signup?role=instructor');
  };

  return (
    <div className="min-h-screen bg-white text-[#14110e]">
      <Header variant="light" />

      <main>
        <section className="relative overflow-hidden bg-[#14110e] text-white">
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                'radial-gradient(ellipse 70% 60% at 0% 0%, rgba(136,157,209,0.45), transparent 55%), radial-gradient(ellipse 50% 50% at 100% 100%, rgba(196,92,38,0.22), transparent 55%)',
            }}
          />
          <div className="relative mx-auto grid w-[90vw] items-center gap-12 py-16 md:py-24 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
                Teach on Nexnoon
              </p>
              <h1 className="font-serif text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Teach live, to small cohorts,{' '}
                <span className="italic text-[#c8d2ea]">on a curated network.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-white/65 sm:text-lg">
                Join Nexnoon’s closed instructor network. Deliver official courses in live cohorts,
                with real quality standards instead of marketplace freelancing.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={goStartTeaching}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#14110e] transition hover:bg-[#c8d2ea]"
                >
                  Apply to teach
                  <ArrowRight className="h-4 w-4" />
                </button>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/60"
                >
                  How it works
                </a>
              </div>
            </div>

            <div className="relative">
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl">
                <ImageWithFallback src={HERO_IMAGE} alt="Instructor teaching a live class" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              </div>
              <div className="absolute -bottom-5 left-5 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-[#14110e] shadow-xl">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#c45c26] opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#c45c26]" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Live cohort in session</p>
                  <p className="text-xs text-[#8a847a]">18 of 25 learners joined</p>
                </div>
              </div>
              <div className="absolute -top-4 right-5 hidden rounded-2xl bg-white/95 px-4 py-3 text-[#14110e] shadow-xl sm:block">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a847a]">Certified for</p>
                <p className="mt-0.5 text-sm font-semibold">English &amp; French cohorts</p>
              </div>
            </div>
          </div>

          <div className="relative border-t border-white/10">
            <dl className="mx-auto grid w-[90vw] grid-cols-2 md:grid-cols-4">
              {stats.map((s, i) => (
                <div
                  key={s.label}
                  className={`py-6 md:py-8 ${i % 2 === 1 ? 'pl-6' : ''} ${i > 0 ? 'md:border-l md:border-white/10 md:pl-8' : ''}`}
                >
                  <dt className="font-serif text-3xl md:text-4xl">{s.value}</dt>
                  <dd className="mt-1 text-xs text-white/55 md:text-sm">{s.label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="bg-white py-20 md:py-24">
          <div className="mx-auto grid w-[90vw] gap-12 lg:grid-cols-[340px_1fr]">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8a847a]">Why Nexnoon</p>
              <h2 className="font-serif text-3xl leading-tight tracking-tight md:text-4xl">
                Built for instructors who care about outcomes.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-[#5c574f]">
                You bring the teaching. We bring the courses, the learners, and the operations behind every live class.
              </p>
            </div>
            <div className="grid gap-px overflow-hidden rounded-3xl border border-[#ebe6de] bg-[#ebe6de] sm:grid-cols-2">
              {features.map((f) => (
                <div key={f.title} className="group bg-white p-7 transition-colors hover:bg-[#faf9f6]">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#f3f1ec] text-[#14110e] transition-colors group-hover:bg-[#14110e] group-hover:text-white">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-serif text-xl">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#5c574f]">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-20 bg-[#f7f5f1] py-20 md:py-24">
          <div className="mx-auto w-[90vw]">
            <div className="mb-14 max-w-2xl">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8a847a]">How it works</p>
              <h2 className="font-serif text-3xl tracking-tight md:text-4xl">From application to your first live class</h2>
            </div>
            <div className="relative">
              <div aria-hidden className="absolute left-5 right-5 top-5 hidden h-px bg-[#d9d3c8] md:block" />
              <ol className="relative grid gap-10 md:grid-cols-3 md:gap-8">
                {steps.map((step, i) => (
                  <li key={step.title} className="relative">
                    <div className="relative z-10 mb-6 flex h-10 w-10 items-center justify-center rounded-full bg-[#14110e] font-serif text-base text-white ring-8 ring-[#f7f5f1]">
                      {i + 1}
                    </div>
                    <h3 className="font-serif text-2xl">{step.title}</h3>
                    <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-[#5c574f]">{step.description}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="bg-white py-20 md:py-24">
          <div className="mx-auto grid w-[90vw] items-center gap-12 md:grid-cols-2 lg:gap-20">
            <div className="relative">
              <div className="aspect-[4/5] overflow-hidden rounded-3xl sm:aspect-[4/3] md:aspect-[4/5]">
                <ImageWithFallback src={STUDIO_IMAGE} alt="Instructor studio" className="h-full w-full object-cover" />
              </div>
              <div className="absolute bottom-5 left-5 right-5 rounded-2xl bg-white/95 p-4 shadow-xl backdrop-blur sm:left-auto sm:w-64">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a847a]">Quality score</p>
                <div className="mt-1 flex items-end justify-between">
                  <p className="font-serif text-3xl">4.8</p>
                  <p className="text-xs text-[#8a847a]">96% attendance</p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eee9e0]">
                  <div className="h-full w-[92%] rounded-full bg-[#14110e]" />
                </div>
              </div>
            </div>
            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8a847a]">Your studio</p>
              <h2 className="font-serif text-3xl tracking-tight md:text-4xl">Everything you need to run a great cohort</h2>
              <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-[#5c574f]">
                One place to schedule sessions, share materials, grade work, and see how your classes are going.
              </p>
              <ul className="mt-8 divide-y divide-[#ebe6de] border-y border-[#ebe6de]">
                {toolkit.map((item) => (
                  <li key={item.label} className="flex items-center gap-4 py-4">
                    <item.icon className="h-5 w-5 shrink-0 text-[#8a847a]" />
                    <span className="text-[15px] text-[#2b2722]">{item.label}</span>
                    <Check className="ml-auto h-4 w-4 shrink-0 text-[#14110e]" />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="bg-[#f7f5f1] py-20 md:py-24">
          <div className="mx-auto grid w-[90vw] gap-10 lg:grid-cols-[340px_1fr]">
            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8a847a]">Questions</p>
              <h2 className="font-serif text-3xl tracking-tight md:text-4xl">Before you apply</h2>
            </div>
            <div className="border-t border-[#e4dfd6]">
              {faqs.map((f) => (
                <FaqItem key={f.q} q={f.q} a={f.a} />
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-16 md:py-20">
          <div className="mx-auto w-[90vw]">
            <div className="relative overflow-hidden rounded-3xl bg-[#14110e] px-8 py-14 text-white md:px-16 md:py-16">
              <div
                className="pointer-events-none absolute inset-0 opacity-50"
                style={{
                  backgroundImage:
                    'radial-gradient(ellipse 60% 80% at 100% 0%, rgba(136,157,209,0.45), transparent 55%)',
                }}
              />
              <div className="relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
                <div className="max-w-xl">
                  <h2 className="font-serif text-3xl leading-tight tracking-tight md:text-4xl">
                    Ready to teach your first cohort?
                  </h2>
                  <p className="mt-3 text-white/60">
                    Apply in a few minutes. We’ll review your profile and get you certified for the courses you teach best.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={goStartTeaching}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-[#14110e] transition hover:bg-[#c8d2ea]"
                >
                  Apply to teach
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
