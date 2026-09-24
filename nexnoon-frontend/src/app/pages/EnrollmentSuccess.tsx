import BrandLoader from '../components/BrandLoader';
import { formatInZone, getViewerTimeZone } from '@/lib/timezone';
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { CheckCircle, Calendar, Clock, ArrowRight, Download } from 'lucide-react';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import { Button } from '@/app/components/ui/button';
import confetti from 'canvas-confetti';
import { classService } from '@/lib/api';
import { ENV } from '@/config/env';
import { classDetailUrl } from '@/lib/url';
import type { Class } from '@/types/api';

export default function EnrollmentSuccess() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [apiClass, setApiClass] = useState<Class | null>(null);
  const [loading, setLoading] = useState(!!id);

  const useRealDataOnly = !ENV.ENABLE_DEMO_MODE;

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    if (!useRealDataOnly) {
      setLoading(false);
      return;
    }
    classService
      .getClass(id)
      .then((data) => setApiClass(data))
      .catch(() => setApiClass(null))
      .finally(() => setLoading(false));
  }, [id, useRealDataOnly]);

  const classData = apiClass ? { title: apiClass.title,
    duration: `${apiClass.totalSessions} sessions`,
    nextSession: apiClass.schedule?.[0]?.startTime ? formatInZone(apiClass.schedule[0].startTime, getViewerTimeZone(), 'datetime', true) : 'Not scheduled yet',
  } : null;

  useEffect(() => {
    if (!loading && !classData && useRealDataOnly) navigate('/');
  }, [loading, classData, useRealDataOnly, navigate]);

  useEffect(() => {
    // Trigger confetti animation
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#889dd1', '#7a8ec2', '#6a7eb2']
      });
      confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#889dd1', '#7a8ec2', '#6a7eb2']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <BrandLoader />
        </div>
      </div>
    );
  }
  if (!classData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <Header variant="light" />
      
      <main className="py-12">
        <div className="w-[90vw] max-w-3xl mx-auto">
          {/* Success Card */}
          <div className="bg-white rounded-2xl border-2 border-[#889dd1]/20 shadow-xl overflow-hidden">
            {/* Success Header */}
            <div className="bg-gradient-to-r from-[#889dd1] to-[#7a8ec2] p-12 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full mb-6 shadow-lg">
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
              <h1 className="text-4xl font-bold text-white mb-3">Enrollment Successful!</h1>
              <p className="text-xl text-white/90">Welcome to {classData.title}</p>
            </div>

            {/* Content */}
            <div className="p-8 space-y-6">
              {/* Confirmation Message */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                <p className="text-green-900 font-medium mb-2">
                  🎉 You're all set! A confirmation email has been sent to your inbox.
                </p>
                <p className="text-green-800 text-sm">
                  Check your email for class details, schedule, and access information.
                </p>
              </div>

              {/* Class Details */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                  <div className="flex items-center gap-3 mb-3">
                    <Calendar className="h-5 w-5 text-[#889dd1]" />
                    <h3 className="font-semibold text-gray-900">Next Live Session</h3>
                  </div>
                  <p className="text-gray-700">{classData.nextSession}</p>
                </div>

                <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                  <div className="flex items-center gap-3 mb-3">
                    <Clock className="h-5 w-5 text-[#889dd1]" />
                    <h3 className="font-semibold text-gray-900">Duration</h3>
                  </div>
                  <p className="text-gray-700">{classData.duration}</p>
                </div>
              </div>

              {/* Next Steps */}
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4">What's Next?</h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-4 p-4 bg-white border-2 border-gray-100 rounded-xl transition-colors">
                    <div className="w-8 h-8 bg-[#889dd1] text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                      1
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Check Your Email</h3>
                      <p className="text-sm text-gray-600">You'll receive class materials and a calendar invite</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 bg-white border-2 border-gray-100 rounded-xl transition-colors">
                    <div className="w-8 h-8 bg-[#889dd1] text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                      2
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Join the Class Community</h3>
                      <p className="text-sm text-gray-600">Connect with fellow students and your Nexnoon Expert</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 bg-white border-2 border-gray-100 rounded-xl transition-colors">
                    <div className="w-8 h-8 bg-[#889dd1] text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                      3
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Prepare for First Session</h3>
                      <p className="text-sm text-gray-600">Review pre-class materials in your dashboard</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button
                  onClick={() => navigate('/my-classes')}
                  className="flex-1 bg-[#889dd1] hover:bg-[#7a8ec2] text-white py-4 text-lg font-semibold"
                >
                  Go to My Classes
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
                <Button
                  onClick={() => id && navigate(classDetailUrl(id, apiClass?.title))}
                  variant="outline"
                  className="flex-1 py-4 text-lg font-semibold border-2"
                >
                  <Download className="h-5 w-5 mr-2" />
                  Download Materials
                </Button>
              </div>

              {/* Additional Resources */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mt-6">
                <h3 className="font-semibold text-blue-900 mb-3">Need Help Getting Started?</h3>
                <div className="space-y-2 text-sm text-blue-800">
                  <p>• <a href="#" className="underline hover:no-underline">Download our mobile app</a> to access classes on the go</p>
                  <p>• <a href="#" className="underline hover:no-underline">Join our Discord community</a> to connect with other students</p>
                  <p>• <a href="#" className="underline hover:no-underline">Visit our Help Center</a> for technical support</p>
                </div>
              </div>
            </div>
          </div>

          {/* Support Footer */}
          <div className="text-center mt-8">
            <p className="text-gray-600">
              Questions? Contact us at{' '}
              <a href="mailto:support@nexnoon.com" className="text-[#889dd1] hover:underline font-medium">
                support@nexnoon.com
              </a>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}