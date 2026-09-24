import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  Clock3,
  GraduationCap,
  LifeBuoy,
  MessageCircle,
  Search,
  Settings2,
  Video,
  Wallet,
} from 'lucide-react';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import { Button } from '@/app/components/ui/button';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';

const categories = [
  {
    id: 'getting-started',
    icon: GraduationCap,
    title: 'Getting Started',
    description: 'Create your account, set up your profile, and take your first class.',
    articles: 12,
    image:
      'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'live-classes',
    icon: Video,
    title: 'Live Classes',
    description: 'Join sessions, use the classroom, and catch up with recordings.',
    articles: 8,
    image:
      'https://images.unsplash.com/photo-1588196749767-a8fc7c60c447?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'payments',
    icon: Wallet,
    title: 'Payments & Billing',
    description: 'Enrollments, receipts, refunds, and subscription management.',
    articles: 6,
    image:
      'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'account',
    icon: Settings2,
    title: 'Account Settings',
    description: 'Preferences, notifications, privacy, and security controls.',
    articles: 10,
    image:
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=80',
  },
];

const faqs = [
  {
    question: 'How do I join a live class?',
    answer:
      'Open My Classes, select your class and click Join Class. You can join from a few minutes before the start time; if your instructor hasn’t started yet, we’ll let you in automatically as soon as they do. Times are shown in your own time zone.',
  },
  {
    question: 'Can I watch recordings of missed classes?',
    answer:
      'When your instructor records a session, the recording appears on that session in your classroom once it has finished, so you can catch up at your own pace.',
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'We accept major cards (Visa, Mastercard, American Express) and other methods enabled in your region. Payments are processed securely through our payment partners.',
  },
  {
    question: 'How do I get a refund?',
    answer:
      'You can request a refund within 14 days of purchase if you have attended no more than two live sessions. Go to Settings → Billing and choose Request Refund.',
  },
  {
    question: 'Can I download course materials?',
    answer:
      'When instructors share files, you will find them in Materials inside the classroom—PDFs, slides, links, and other resources.',
  },
  {
    question: 'How do I earn a certificate?',
    answer:
      'Complete required assignments, attend at least 80% of live sessions, and meet the passing criteria. Certificates are issued automatically when you qualify.',
  },
  {
    question: 'What if I have technical issues during a live class?',
    answer:
      'Refresh your browser and confirm a stable connection. If issues continue, leave and rejoin the session, then contact support if you still need help.',
  },
  {
    question: 'Can I become an instructor on Nexnoon?',
    answer:
      'Yes. Choose Teach in the navigation to apply. We review applications within a few business days and will guide you through approval and class setup.',
  },
];

const popularArticles = [
  { title: 'How to Set Up Your Profile', category: 'Getting Started', time: '3 min read' },
  { title: 'Troubleshooting Video Connection Issues', category: 'Technical', time: '5 min read' },
  { title: 'Understanding the Classroom Layout', category: 'Live Classes', time: '4 min read' },
  { title: 'Managing Your Subscriptions', category: 'Billing', time: '2 min read' },
  { title: 'How to Submit Assignments', category: 'Classes', time: '3 min read' },
];

export default function Help() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const [activeCategory, setActiveCategory] = useState(categories[0].id);

  const q = searchQuery.trim().toLowerCase();

  const filteredFaqs = useMemo(() => {
    if (!q) return faqs;
    return faqs.filter(
      (f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)
    );
  }, [q]);

  const filteredArticles = useMemo(() => {
    if (!q) return popularArticles;
    return popularArticles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) || a.category.toLowerCase().includes(q)
    );
  }, [q]);

  const activeTopic = categories.find((c) => c.id === activeCategory) || categories[0];

  return (
    <div className="min-h-screen bg-[#f7f5f1] text-[#14110e]">
      <Header variant="light" />

      <main>
        {/* Help hero */}
        <section className="relative min-h-[52vh] flex items-end overflow-hidden">
          <div className="absolute inset-0">
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1800&q=80"
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#14110e] via-[#14110e]/75 to-[#14110e]/35" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(136,157,209,0.28),transparent_55%)]" />
          </div>

          <div className="relative w-[90vw] max-w-5xl mx-auto pt-28 pb-14 md:pb-16">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55 mb-4">
              Nexnoon Help Center
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl md:text-[3.4rem] tracking-tight text-white leading-[1.05] max-w-3xl">
              How can we help?
            </h1>
            <p className="mt-4 text-base md:text-lg text-white/70 max-w-xl leading-relaxed">
              Guides for learners and instructors—search articles, browse topics, or jump into FAQs.
            </p>

            <form
              className="mt-8 max-w-2xl"
              onSubmit={(e) => e.preventDefault()}
              role="search"
            >
              <label htmlFor="help-search" className="sr-only">
                Search help articles
              </label>
              <div className="relative flex items-center rounded-2xl bg-white shadow-[0_20px_50px_-28px_rgba(0,0,0,0.55)] ring-1 ring-black/5">
                <Search className="absolute left-4 h-5 w-5 text-[#8a847a]" />
                <input
                  id="help-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search classes, billing, certificates…"
                  className="w-full rounded-2xl bg-transparent py-4 pl-12 pr-28 text-[15px] text-[#14110e] placeholder:text-[#9a948a] outline-none"
                />
                <span className="absolute right-2 hidden sm:inline-flex items-center rounded-xl bg-[#14110e] px-3 py-2 text-xs font-medium text-white/90">
                  Enter
                </span>
              </div>
            </form>
          </div>
        </section>

        <div className="w-[90vw] max-w-6xl mx-auto py-12 md:py-16 space-y-16 md:space-y-20">
          {/* Topics */}
          <section>
            <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a847a] mb-2">
                  Browse by topic
                </p>
                <h2 className="font-serif text-3xl tracking-tight">Help topics</h2>
              </div>
              <p className="text-sm text-[#7a746a] max-w-sm">
                Pick a topic to focus the guides below—or keep browsing everything.
              </p>
            </div>

            <div className="grid lg:grid-cols-12 gap-6 lg:gap-8">
              <div className="lg:col-span-5 space-y-2">
                {categories.map((category) => {
                  const Icon = category.icon;
                  const active = activeCategory === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setActiveCategory(category.id)}
                      className={`w-full flex items-start gap-3 rounded-2xl px-4 py-3.5 text-left transition-all duration-200 ${
                        active
                          ? 'bg-[#14110e] text-white shadow-lg'
                          : 'bg-white/70 text-[#14110e] hover:bg-white border border-[#ebe6de]'
                      }`}
                    >
                      <span
                        className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          active ? 'bg-white/12 text-white' : 'bg-[#f0ebe3] text-[#5c564e]'
                        }`}
                      >
                        <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-semibold tracking-tight">{category.title}</span>
                          <span
                            className={`text-[11px] tabular-nums ${
                              active ? 'text-white/55' : 'text-[#9a948a]'
                            }`}
                          >
                            {category.articles}
                          </span>
                        </span>
                        <span
                          className={`mt-1 block text-sm leading-snug ${
                            active ? 'text-white/65' : 'text-[#7a746a]'
                          }`}
                        >
                          {category.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="lg:col-span-7 relative min-h-[280px] overflow-hidden rounded-[1.75rem]">
                <ImageWithFallback
                  src={activeTopic.image}
                  alt={activeTopic.title}
                  className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#14110e]/90 via-[#14110e]/35 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50 mb-2">
                    {activeTopic.articles} articles
                  </p>
                  <h3 className="font-serif text-2xl sm:text-3xl text-white tracking-tight">
                    {activeTopic.title}
                  </h3>
                  <p className="mt-2 text-sm text-white/70 max-w-md leading-relaxed">
                    {activeTopic.description}
                  </p>
                  <button
                    type="button"
                    className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#14110e] hover:bg-white/90 transition-colors"
                  >
                    View articles
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Popular + FAQ */}
          <section className="grid lg:grid-cols-12 gap-10 lg:gap-12">
            <div className="lg:col-span-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a847a] mb-2">
                Quick reads
              </p>
              <h2 className="font-serif text-3xl tracking-tight mb-6">Popular articles</h2>

              {filteredArticles.length === 0 ? (
                <p className="text-sm text-[#7a746a]">No articles match “{searchQuery}”.</p>
              ) : (
                <ul className="divide-y divide-[#ebe6de] border-y border-[#ebe6de]">
                  {filteredArticles.map((article) => (
                    <li key={article.title}>
                      <button
                        type="button"
                        className="group flex w-full items-start gap-3 py-4 text-left transition-colors hover:bg-white/60"
                      >
                        <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-[#889dd1]" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-semibold tracking-tight text-[#14110e] group-hover:text-[#3a5f8a] transition-colors">
                            {article.title}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#8a847a]">
                            <span>{article.category}</span>
                            <span aria-hidden>•</span>
                            <span className="inline-flex items-center gap-1">
                              <Clock3 className="h-3 w-3" />
                              {article.time}
                            </span>
                          </span>
                        </span>
                        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#cfc8bc] transition-transform group-hover:translate-x-0.5 group-hover:text-[#889dd1]" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="lg:col-span-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a847a] mb-2">
                Common questions
              </p>
              <h2 className="font-serif text-3xl tracking-tight mb-6">FAQs</h2>

              {filteredFaqs.length === 0 ? (
                <p className="text-sm text-[#7a746a]">No FAQs match “{searchQuery}”.</p>
              ) : (
                <div className="space-y-2.5">
                  {filteredFaqs.map((faq, index) => {
                    const open = expandedFaq === index;
                    return (
                      <div
                        key={faq.question}
                        className={`rounded-2xl border transition-colors ${
                          open
                            ? 'border-[#14110e]/15 bg-white shadow-[0_12px_40px_-28px_rgba(20,17,14,0.35)]'
                            : 'border-[#ebe6de] bg-white/50 hover:bg-white'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedFaq(open ? null : index)}
                          aria-expanded={open}
                          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                        >
                          <span className="text-[15px] font-semibold tracking-tight text-[#14110e] pr-2">
                            {faq.question}
                          </span>
                          <span
                            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
                              open ? 'bg-[#14110e] text-white' : 'bg-[#f0ebe3] text-[#6b655c]'
                            }`}
                          >
                            <ChevronDown
                              className={`h-4 w-4 transition-transform duration-200 ${
                                open ? 'rotate-180' : ''
                              }`}
                            />
                          </span>
                        </button>
                        <div
                          className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                            open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                          }`}
                        >
                          <div className="overflow-hidden">
                            <p className="px-5 pb-5 text-sm leading-relaxed text-[#6b655c]">
                              {faq.answer}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Contact */}
          <section className="relative overflow-hidden rounded-[2rem]">
            <div className="absolute inset-0">
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1600&q=80"
                alt=""
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-[#14110e]/88" />
            </div>
            <div className="relative grid md:grid-cols-[1.2fr_0.8fr] gap-8 p-8 sm:p-10 md:p-12">
              <div>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white mb-5">
                  <LifeBuoy className="h-5 w-5" />
                </span>
                <h2 className="font-serif text-3xl sm:text-4xl tracking-tight text-white">
                  Still need a hand?
                </h2>
                <p className="mt-3 text-white/65 max-w-md leading-relaxed">
                  Reach the Nexnoon support team for enrollment, classroom, or billing questions.
                  We usually reply within one business day.
                </p>
              </div>
              <div className="flex flex-col justify-end gap-3 sm:flex-row md:flex-col md:items-stretch">
                <Link to="/contact" className="w-full sm:w-auto md:w-full">
                  <Button className="h-12 w-full rounded-2xl bg-white text-[#14110e] hover:bg-white/90 font-semibold">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Contact support
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  className="h-12 w-full rounded-2xl border-white/25 bg-transparent text-white hover:bg-white/10 font-medium"
                >
                  Start live chat
                </Button>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
