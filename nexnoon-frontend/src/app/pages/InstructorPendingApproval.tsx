import { Clock, Mail, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import { Button } from '@/app/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';

export default function InstructorPendingApproval() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header variant="light" />
      
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <div className="bg-white border border-black/10 rounded-2xl p-8 md:p-12 text-center">
            {/* Icon */}
            <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-100 rounded-full mb-6">
              <Clock className="h-10 w-10 text-yellow-600" />
            </div>

            {/* Title */}
            <h1 className="text-3xl font-bold text-black/90 mb-4">
              Application Under Review
            </h1>

            {/* Message */}
            <p className="text-lg text-black/70 mb-8 leading-relaxed">
              Thank you for registering as a Nexnoon Expert, <strong>{user?.name}</strong>! 
              Your application is currently being reviewed by our admin team.
            </p>

            {/* Info Cards */}
            <div className="space-y-4 mb-8">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-left">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Mail className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-black/90 mb-1">
                      You'll Receive an Email
                    </h3>
                    <p className="text-sm text-black/70">
                      We'll notify you at <strong>{user?.email}</strong> once your application has been reviewed. This usually takes 1-3 business days.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-left">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-black/90 mb-1">
                      What Happens Next?
                    </h3>
                    <p className="text-sm text-black/70">
                      Once approved, you'll gain full access to the Nexnoon Expert Dashboard where you can create and manage your live classes, track earnings, and engage with students.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-left">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-black/90 mb-1">
                      Need Help?
                    </h3>
                    <p className="text-sm text-black/70">
                      If you have any questions or haven't heard from us within 3 business days, please contact our support team at support@nexnoon.com
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => navigate('/')}
                className="bg-[#889dd1] text-white hover:bg-[#7a8ec2] px-8 py-3 rounded-lg"
              >
                Back to Home
              </Button>
              <Button
                onClick={handleLogout}
                variant="outline"
                className="border-black/20 text-black/80 hover:bg-black/5 px-8 py-3 rounded-lg"
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
