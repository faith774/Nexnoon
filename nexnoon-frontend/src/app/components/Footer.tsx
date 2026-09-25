import { ArrowRight, Facebook, Instagram, Linkedin, Twitter } from 'lucide-react';
import { Link } from 'react-router';

const columns: { title: string; links: { to: string; label: string }[] }[] = [
  {
    title: 'Learn',
    links: [
      { to: '/browse', label: 'Browse classes' },
      { to: '/categories', label: 'Categories' },
      { to: '/search', label: 'Search' },
      { to: '/my-classes', label: 'My classes' },
    ],
  },
  {
    title: 'Teach',
    links: [
      { to: '/teach', label: 'Teach on Nexnoon' },
      { to: '/signup?role=instructor', label: 'Apply as instructor' },
    ],
  },
  {
    title: 'Company',
    links: [
      { to: '/about', label: 'About' },
      { to: '/help', label: 'Help centre' },
      { to: '/contact', label: 'Contact support' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { to: '/terms', label: 'Terms' },
      { to: '/privacy', label: 'Privacy' },
    ],
  },
];

const socials = [
  { icon: Facebook, label: 'Facebook' },
  { icon: Twitter, label: 'Twitter' },
  { icon: Instagram, label: 'Instagram' },
  { icon: Linkedin, label: 'LinkedIn' },
];

export default function Footer() {
  return (
    <footer className="site-footer relative overflow-hidden bg-[#14110e] text-white/70">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: 'radial-gradient(ellipse 50% 60% at 100% 0%, rgba(136,157,209,0.28), transparent 60%)',
        }}
      />
      <div className="relative mx-auto w-[90vw]">
        <div className="grid gap-12 py-14 md:py-16 lg:grid-cols-[1.2fr_2fr] lg:gap-16">
          <div className="max-w-sm">
            <Link to="/" className="inline-flex text-2xl font-bold tracking-tight text-white">
              Nexnoon<span className="text-[#889dd1]">.</span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-white/55">
              Live online classes taught by certified instructors in small cohorts. Learn, grow, and reach your goals in real time.
            </p>
            <Link
              to="/browse"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#14110e] transition-colors hover:bg-[#c8d2ea]"
            >
              Find a class
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
            {columns.map((col) => (
              <div key={col.title}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">{col.title}</p>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.to}>
                      <Link to={link.to} className="text-sm text-white/70 transition-colors hover:text-white">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col-reverse items-start justify-between gap-4 border-t border-white/10 py-6 text-xs text-white/45 sm:flex-row sm:items-center">
          <p>&copy; {new Date().getFullYear()} Nexnoon. All rights reserved.</p>
          <div className="flex items-center gap-2">
            {socials.map(({ icon: Icon, label }) => (
              <a
                key={label}
                href="#"
                aria-label={label}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/60 transition-colors hover:border-white/40 hover:text-white"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
