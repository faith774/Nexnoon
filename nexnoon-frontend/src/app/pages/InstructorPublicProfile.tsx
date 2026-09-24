import { Link, useParams } from 'react-router';
import { BookOpen, Globe2, Sparkles, Star, Users } from 'lucide-react';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import BrandLoader from '@/app/components/BrandLoader';
import { useBackendData } from '@/hooks/useBackendData';
import { classDetailUrl } from '@/lib/url';

type PublicClass = {
  id: string;
  title: string;
  category?: string;
  enrolledStudents?: number;
  maxStudents?: number;
  price?: number;
  currency?: string;
  rating?: number;
  thumbnail?: string;
};

type PublicInstructor = {
  id: string;
  fullName: string;
  avatar?: string;
  headline?: string;
  bio?: string;
  languages?: string[];
  expertise?: string[];
  classes?: PublicClass[];
};

const money = (amount?: number, currency = 'USD') => {
  if (amount == null) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
};

export default function InstructorPublicProfile() {
  const { id } = useParams<{ id: string }>();
  const query = useBackendData<PublicInstructor>(`/data/instructors/${id}`, true);

  if (query.isLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header variant="light" />
        <main className="flex-1 flex items-center justify-center">
          <BrandLoader />
        </main>
        <Footer />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header variant="light" />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Instructor not found</h1>
            <p className="text-gray-600 mb-6">
              This instructor may not be approved yet, or the link is invalid.
            </p>
            <Link
              to="/browse"
              className="inline-flex items-center justify-center bg-[#889dd1] hover:bg-[#7a8ec2] text-white px-5 py-2.5 text-sm font-medium rounded-lg"
            >
              Browse classes
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const instructor = query.data;
  const classes = instructor.classes || [];
  const languages = instructor.languages || [];
  const expertise = instructor.expertise || [];

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Header variant="light" />

      <main>
        <section className="relative overflow-hidden border-b border-gray-100">
          <div
            className="absolute inset-0 bg-gradient-to-br from-[#eef2fa] via-white to-[#f7f8fb]"
            aria-hidden
          />
          <div
            className="absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(136,157,209,0.35) 1px, transparent 0)',
              backgroundSize: '22px 22px',
            }}
            aria-hidden
          />

          <div className="relative w-[90vw] max-w-5xl mx-auto py-14 sm:py-20">
            <div className="flex flex-col sm:flex-row gap-8 sm:items-end">
              <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-full overflow-hidden border-2 border-white shadow-lg bg-gradient-to-br from-[#889dd1] to-[#6b7fb8] flex items-center justify-center text-white text-4xl font-bold shrink-0">
                {instructor.avatar ? (
                  <img
                    src={instructor.avatar}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  (instructor.fullName || '?').charAt(0).toUpperCase()
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#889dd1] mb-2">
                  Nexnoon Expert
                </p>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-gray-900">
                  {instructor.fullName}
                </h1>
                {instructor.headline && (
                  <p className="mt-3 text-lg text-gray-600 max-w-2xl leading-relaxed">
                    {instructor.headline}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="w-[90vw] max-w-5xl mx-auto py-12 sm:py-16 space-y-12">
          {instructor.bio && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">About</h2>
              <p className="text-gray-700 leading-relaxed whitespace-pre-line max-w-3xl">
                {instructor.bio}
              </p>
            </div>
          )}

          {(languages.length > 0 || expertise.length > 0) && (
            <div className="grid sm:grid-cols-2 gap-8">
              {languages.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Globe2 className="h-4 w-4 text-[#889dd1]" />
                    <h2 className="text-lg font-semibold text-gray-900">Languages</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {languages.map((lang) => (
                      <span
                        key={lang}
                        className="px-3 py-1.5 text-sm border border-gray-200 bg-gray-50 text-gray-800"
                      >
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {expertise.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-[#889dd1]" />
                    <h2 className="text-lg font-semibold text-gray-900">Expertise</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {expertise.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1.5 text-sm border border-[#889dd1]/30 bg-[#889dd1]/10 text-[#3d4f7a]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 mb-6">
              <BookOpen className="h-5 w-5 text-[#889dd1]" />
              <h2 className="text-xl font-semibold text-gray-900">Published classes</h2>
            </div>

            {!classes.length ? (
              <p className="text-gray-500 text-sm">No published classes yet.</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {classes.map((c) => (
                  <Link
                    key={c.id}
                    to={classDetailUrl(c.id, c.title)}
                    className="group border border-gray-200 overflow-hidden hover:border-[#889dd1]/50 hover:shadow-md transition-all bg-white"
                  >
                    {c.thumbnail ? (
                      <img
                        src={c.thumbnail}
                        alt=""
                        className="w-full h-36 object-cover group-hover:scale-[1.02] transition-transform duration-300"
                      />
                    ) : (
                      <div className="h-36 bg-gradient-to-br from-[#889dd1]/30 via-[#a8b8e0]/20 to-gray-100" />
                    )}
                    <div className="p-4">
                      {c.category && (
                        <p className="text-[11px] uppercase tracking-wider text-[#889dd1] mb-1.5">
                          {c.category}
                        </p>
                      )}
                      <h3 className="font-semibold text-gray-900 leading-snug group-hover:text-[#4a5f96] transition-colors">
                        {c.title}
                      </h3>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {c.enrolledStudents ?? 0}
                          {c.maxStudents != null ? `/${c.maxStudents}` : ''} seats
                        </span>
                        {c.rating != null && c.rating > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 text-amber-500" />
                            {c.rating.toFixed(1)}
                          </span>
                        )}
                        <span className="ml-auto font-medium text-gray-800">
                          {money(c.price, c.currency)}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
