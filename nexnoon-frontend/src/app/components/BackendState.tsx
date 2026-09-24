import BrandLoader from './BrandLoader';
import { Link } from 'react-router';
import Header from './Header';
import Footer from './Footer';

export default function BackendState({
  title,
  message,
  retry,
  loading = false,
  actionLabel,
  actionTo,
}: {
  title: string;
  message: string;
  loading?: boolean;
  retry?: () => void;
  actionLabel?: string;
  actionTo?: string;
}) {
  const isAdmin = title === 'Platform control';

  return (
    <div
      className={`min-h-screen flex flex-col ${
        isAdmin
          ? 'bg-[#edf1f6] text-[#0b1220] font-[family-name:var(--font-sans)]'
          : 'bg-gray-50'
      }`}
    >
      {isAdmin && (
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_10%_-10%,#c5d4e8_0%,transparent_55%),linear-gradient(180deg,#e8eef5_0%,#f4f6f9_100%)]" />
        </div>
      )}
      <Header />
      <main className="flex-1 w-[min(92vw,720px)] mx-auto py-14 md:py-20">
        {loading ? (
          <BrandLoader label={message} />
        ) : (
          <div
            className={
              isAdmin
                ? 'border border-[#d0dae6]/90 bg-white/85 backdrop-blur-sm px-7 py-8'
                : ''
            }
          >
            {isAdmin && (
              <p className="text-[11px] uppercase tracking-[0.24em] text-[#5a6b7d] mb-3">Nexnoon</p>
            )}
            <h1
              className={
                isAdmin
                  ? 'font-display text-3xl md:text-4xl tracking-tight text-[#0b1220] mb-3'
                  : 'text-3xl font-bold mb-4'
              }
            >
              {title}
            </h1>
            <p role="status" className={`mb-7 leading-relaxed ${isAdmin ? 'text-[#5c6b7a]' : 'text-gray-600'}`}>
              {message}
            </p>
            <div className="flex flex-wrap gap-3 items-center">
              {retry && (
                <button
                  className={
                    isAdmin
                      ? 'bg-[#0b1220] text-white px-5 py-2.5 text-sm hover:bg-[#1a2438]'
                      : 'bg-black text-white rounded-lg px-5 py-2'
                  }
                  onClick={retry}
                >
                  Try again
                </button>
              )}
              {actionLabel && actionTo && (
                <Link
                  to={actionTo}
                  className={
                    isAdmin
                      ? 'inline-flex bg-[#0b1220] text-white px-5 py-2.5 text-sm hover:bg-[#1a2438]'
                      : 'inline-flex bg-[#14110e] text-white px-5 py-2 text-sm hover:bg-black/80'
                  }
                >
                  {actionLabel}
                </Link>
              )}
              {!actionTo?.startsWith('/admin') && (
                <Link
                  to="/my-classes"
                  className={`underline text-sm ${isAdmin ? 'text-[#3a5f8a]' : ''}`}
                >
                  My Classes
                </Link>
              )}
              <Link to="/login" className={`underline text-sm ${isAdmin ? 'text-[#3a5f8a]' : ''}`}>
                Sign in
              </Link>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
