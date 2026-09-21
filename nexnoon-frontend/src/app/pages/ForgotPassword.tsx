import { authService, getErrorMessage } from '@/lib/api';
import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';

export default function ForgotPassword() {
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setError('');
    try { await authService.requestPasswordReset({ email }); setIsSubmitted(true); }
    catch (err) { setError(getErrorMessage(err)); }
    finally { setIsLoading(false); }

  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <Header variant="light" />
      
      <main className="py-12">
        <div className="w-[90vw] max-w-md mx-auto">
          {error && <p role="alert" className="text-red-600 mb-4">{error}</p>}
          <Link
            to="/login"
            className="flex items-center text-gray-600 hover:text-black mb-8 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Login
          </Link>

          <div className="bg-white border border-gray-300 rounded-2xl shadow-lg p-8">
            {!isSubmitted ? (
              <>
                {/* Header */}
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail className="h-8 w-8 text-white" />
                  </div>
                  <h1 className="text-2xl font-bold text-black mb-2">
                    Forgot Password?
                  </h1>
                  <p className="text-gray-600">
                    No worries! Enter your email and we'll send you reset instructions.
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-black mb-2">
                      EMAIL ADDRESS
                    </label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      className="rounded-lg border-gray-300"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-black text-white hover:bg-gray-800 rounded-lg py-6"
                  >
                    {isLoading ? 'Sending...' : 'Send Reset Instructions'}
                  </Button>

                  <div className="text-center text-sm text-gray-600">
                    Remember your password?{' '}
                    <Link to="/login" className="text-black font-bold hover:underline">
                      Sign in
                    </Link>
                  </div>
                </form>
              </>
            ) : (
              <>
                {/* Success State */}
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <h1 className="text-2xl font-bold text-black mb-2">
                    Check Your Email
                  </h1>
                  <p className="text-gray-600 mb-6">
                    We've sent password reset instructions to
                    <br />
                    <span className="font-bold text-black">{email}</span>
                  </p>

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 text-left">
                    <h3 className="font-bold text-sm text-black mb-2">What to do next:</h3>
                    <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                      <li>Check your email inbox</li>
                      <li>Click the reset link (valid for 1 hour)</li>
                      <li>Create a new password</li>
                      <li>Sign in with your new password</li>
                    </ol>
                  </div>

                  <Button
                    onClick={() => {
                      setIsSubmitted(false);
                      setEmail('');
                    }}
                    variant="outline"
                    className="w-full border-gray-300 rounded-lg mb-3"
                  >
                    Try Another Email
                  </Button>

                  <Link to="/login">
                    <Button className="w-full bg-black text-white hover:bg-gray-800 rounded-lg">
                      Back to Login
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* Help Section */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 className="font-bold text-black mb-2">Didn't receive the email?</h3>
            <ul className="text-sm text-gray-700 space-y-1 mb-4">
              <li>• Check your spam/junk folder</li>
              <li>• Make sure you entered the correct email</li>
              <li>• Wait a few minutes and try again</li>
            </ul>
            <Link to="/contact" className="text-sm font-bold text-black hover:underline">
              Contact support →
            </Link>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}