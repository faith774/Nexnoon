import { authService, getErrorMessage } from '@/lib/api';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, Mail } from 'lucide-react';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import { Button } from '@/app/components/ui/button';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';

export default function ForgotPassword() {
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await authService.requestPasswordReset({ email });
      setIsSubmitted(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f5f1] text-[#14110e]">
      <Header variant="light" />

      <main className="flex-1">
        <div className="grid lg:grid-cols-2 min-h-[calc(100vh-8rem)]">
          {/* Atmosphere panel */}
          <aside className="relative hidden lg:block overflow-hidden">
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=1400&q=80"
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-[#14110e]/88 via-[#14110e]/72 to-[#14110e]/55" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(136,157,209,0.28),transparent_55%)]" />
            <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
                Nexnoon Account
              </p>
              <div>
                <h2 className="font-serif text-4xl xl:text-5xl tracking-tight text-white leading-[1.08] max-w-md">
                  Reset access in a few quiet steps.
                </h2>
                <p className="mt-4 max-w-sm text-white/65 leading-relaxed">
                  Enter the email on your account and we’ll send a secure link so you can set a new
                  password and get back to class.
                </p>
              </div>
              <p className="text-sm text-white/40">Secure · Expires in 1 hour · One-time use</p>
            </div>
          </aside>

          {/* Form panel */}
          <section className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-14 xl:px-20">
            <div className="mx-auto w-full max-w-md">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm font-medium text-[#7a746a] transition-colors hover:text-[#14110e]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </Link>

              {!isSubmitted ? (
                <>
                  <div className="mt-8 mb-8">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#14110e] text-white mb-5">
                      <KeyRound className="h-5 w-5" />
                    </span>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a847a] mb-2">
                      Password reset
                    </p>
                    <h1 className="font-serif text-3xl sm:text-4xl tracking-tight leading-tight">
                      Forgot your password?
                    </h1>
                    <p className="mt-3 text-[#7a746a] leading-relaxed">
                      Enter your email and we’ll send reset instructions. No worries if it takes a
                      moment to arrive.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <label className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a847a]">
                        Email address
                      </span>
                      <div className="relative mt-2">
                        <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a948a]" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          required
                          autoComplete="email"
                          className="w-full rounded-2xl border border-[#e0dbd2] bg-white py-3.5 pl-11 pr-4 text-[15px] text-[#14110e] outline-none transition placeholder:text-[#b0a99e] focus:border-[#14110e]/35 focus:ring-2 focus:ring-[#14110e]/10"
                        />
                      </div>
                    </label>

                    {error ? (
                      <p
                        role="alert"
                        className="rounded-2xl border border-[#f0c4c0] bg-[#fef7f6] px-4 py-3 text-sm text-[#b42318]"
                      >
                        {error}
                      </p>
                    ) : null}

                    <Button
                      type="submit"
                      disabled={isLoading || !email.trim()}
                      className="h-12 w-full rounded-2xl bg-[#14110e] text-[15px] font-semibold text-white hover:bg-[#2a2520] disabled:opacity-40"
                    >
                      {isLoading ? 'Sending…' : 'Send reset instructions'}
                    </Button>
                  </form>

                  <p className="mt-6 text-center text-sm text-[#7a746a]">
                    Remember your password?{' '}
                    <Link to="/login" className="font-semibold text-[#14110e] hover:underline">
                      Sign in
                    </Link>
                  </p>
                </>
              ) : (
                <>
                  <div className="mt-8 mb-8">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef6ef] text-[#2f6b3a] mb-5">
                      <CheckCircle2 className="h-6 w-6" />
                    </span>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a847a] mb-2">
                      Email sent
                    </p>
                    <h1 className="font-serif text-3xl sm:text-4xl tracking-tight leading-tight">
                      Check your inbox
                    </h1>
                    <p className="mt-3 text-[#7a746a] leading-relaxed">
                      We sent password reset instructions to{' '}
                      <span className="font-semibold text-[#14110e]">{email}</span>.
                    </p>
                  </div>

                  <ol className="space-y-3 rounded-[1.5rem] border border-[#ebe6de] bg-white p-5">
                    {[
                      'Open the email from Nexnoon',
                      'Click the reset link (valid for 1 hour)',
                      'Choose a new password',
                      'Sign in and continue learning',
                    ].map((step, i) => (
                      <li key={step} className="flex items-start gap-3 text-sm text-[#6b655c]">
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f0ebe3] text-[11px] font-semibold text-[#14110e]">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>

                  <div className="mt-6 space-y-3">
                    <Link to="/login" className="block">
                      <Button className="h-12 w-full rounded-2xl bg-[#14110e] text-[15px] font-semibold text-white hover:bg-[#2a2520]">
                        Back to sign in
                      </Button>
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSubmitted(false);
                        setEmail('');
                        setError('');
                      }}
                      className="w-full py-2 text-sm font-medium text-[#7a746a] hover:text-[#14110e]"
                    >
                      Use a different email
                    </button>
                  </div>
                </>
              )}

              {/* Help */}
              <div className="mt-10 rounded-[1.5rem] border border-[#ebe6de] bg-white/70 p-5">
                <h3 className="text-sm font-semibold tracking-tight">Didn’t get the email?</h3>
                <ul className="mt-3 space-y-1.5 text-sm text-[#7a746a]">
                  <li>Check spam or promotions folders</li>
                  <li>Confirm the email matches your Nexnoon account</li>
                  <li>Wait a couple of minutes, then try again</li>
                </ul>
                <Link
                  to="/contact"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#14110e] hover:text-[#3a5f8a]"
                >
                  Contact support
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
