import BrandLoader from '../components/BrandLoader';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { classService, getErrorMessage } from '@/lib/api';
import { ENV } from '@/config/env';
import { toast } from 'sonner';
import type { Class } from '@/types/api';

// Loaded once per publishable key, per Stripe.js guidance (not inside a component/render).
const stripePromise = ENV.STRIPE_PUBLISHABLE_KEY ? loadStripe(ENV.STRIPE_PUBLISHABLE_KEY) : null;

const cardElementOptions = {
  style: {
    base: {
      fontSize: '16px',
      color: '#111827',
      '::placeholder': { color: '#6b7280' },
    },
    invalid: { color: '#dc2626' },
  },
};

function PaymentForm({
  classData,
  paymentError,
  isProcessing,
  user,
  onPay,
  onCardholderChange,
  formatPrice,
  cardholderName,
  requiresCard,
}: {
  classData: Class;
  paymentError: string;
  isProcessing: boolean;
  user: { name?: string; email?: string } | null;
  onPay: () => void;
  onCardholderChange: (v: string) => void;
  formatPrice: (n: number) => string;
  cardholderName: string;
  requiresCard: boolean;
}) {
  const navigate = useNavigate();
  const instructorName = typeof classData.instructor === 'object' && classData.instructor?.name
    ? classData.instructor.name
    : 'Instructor';
  const durationDisplay = classData.duration
    ? `${Math.round(classData.duration / 60)} hr${classData.duration >= 120 ? 's' : ''} total`
    : `${classData.totalSessions || 0} sessions`;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header variant="light" />
      <div className="relative h-64 bg-gradient-to-br from-gray-900 to-gray-800 overflow-hidden">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1758270704524-596810e891b5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
          alt="Online Learning"
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-black/30" />
        <div className="relative h-full flex items-center justify-center text-center px-4">
          <h1 className="text-4xl font-bold text-white">Complete your enrollment</h1>
        </div>
      </div>
      <main className="py-12">
        <div className="w-[90vw] max-w-6xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-8"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to class
          </button>
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl border border-gray-200 p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Enrollment</h2>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cardholder Name</label>
                  <Input
                    placeholder="John Doe"
                    defaultValue={user?.name || user?.email || ''}
                    onChange={(e) => onCardholderChange(e.target.value)}
                    className="w-full"
                  />
                </div>
                {requiresCard && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Card Details</label>
                    <div className="border border-input rounded-md px-3 py-3 bg-input-background">
                      <CardElement options={cardElementOptions} />
                    </div>
                  </div>
                )}
                {paymentError && <p className="text-sm text-red-600 mb-2">{paymentError}</p>}
                <Button
                  onClick={onPay}
                  disabled={isProcessing || !cardholderName.trim()}
                  className="w-full bg-[#889dd1] hover:bg-[#7a8ec2] text-white py-4 text-lg font-semibold"
                >
                  {isProcessing ? 'Processing...' : `Complete Payment • ${formatPrice(classData.price)}`}
                </Button>
                <p className="text-center text-gray-500 text-sm mt-4">Your enrollment is saved to your account.</p>
              </div>
            </div>
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-24">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Order Summary</h2>
                <div className="space-y-4 mb-6">
                  <h3 className="font-semibold text-gray-900">{classData.title}</h3>
                  <p className="text-sm text-gray-600">by {instructorName}</p>
                  <p className="text-sm text-gray-600">{durationDisplay}</p>
                </div>
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex justify-between">
                    <span className="text-lg font-bold text-gray-900">Total</span>
                    <span className="text-2xl font-bold text-gray-900">{formatPrice(classData.price)}</span>
                  </div>
                </div>
                <div className="space-y-3 border-t border-gray-200 pt-6 mt-6">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">Lifetime access to class materials</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">Certificate of completion</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function PaymentCheckout({
  classData,
  classId,
  enrollmentSuccessId,
}: {
  classData: Class;
  classId: string;
  enrollmentSuccessId: string;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [cardholderName, setCardholderName] = useState(user?.name || user?.email || '');
  const requiresCard = classData.price > 0;

  const handlePay = async () => {
    setIsProcessing(true);
    setPaymentError('');
    try {
      let paymentMethodId: string | undefined;

      if (requiresCard) {
        if (!stripe || !elements) {
          setPaymentError('Payments are not configured yet. Please contact support.');
          return;
        }
        const card = elements.getElement(CardElement);
        if (!card) {
          setPaymentError('Enter your card details to continue.');
          return;
        }
        const { error, paymentMethod } = await stripe.createPaymentMethod({
          type: 'card',
          card,
          billing_details: { name: cardholderName || undefined, email: user?.email },
        });
        if (error || !paymentMethod) {
          setPaymentError(error?.message || 'Could not process your card. Please try again.');
          return;
        }
        paymentMethodId = paymentMethod.id;
      }

      await classService.enrollInClass({ classId, paymentMethodId });
      toast.success('Enrollment successful!');
      navigate(`/enrollment-success/${enrollmentSuccessId}`);
    } catch (err) {
      const msg = getErrorMessage(err);
      setPaymentError(msg);
      toast.error(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatPrice = (price: number) => `$${Number(price).toFixed(2)}`;

  return (
    <PaymentForm
      classData={classData}
      paymentError={paymentError}
      isProcessing={isProcessing}
      user={user}
      onPay={handlePay}
      onCardholderChange={setCardholderName}
      formatPrice={formatPrice}
      cardholderName={cardholderName}
      requiresCard={requiresCard}
    />
  );
}

export default function Payment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [classData, setClassData] = useState<Class | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const classId = id || '';

  const useDemoData = ENV.ENABLE_DEMO_MODE;

  useEffect(() => {
    if (!classId) {
      setLoadError('Class ID is required.');
      return;
    }
    let cancelled = false;
    classService
      .getClass(classId)
      .then((data) => {
        if (!cancelled) setClassData(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getErrorMessage(err));
      });
    return () => { cancelled = true; };
  }, [classId, useDemoData]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      sessionStorage.setItem('returnPath', `/payment/${id}`);
      navigate('/login');
    }
  }, [authLoading, isAuthenticated, id, navigate]);

  if (!classData && !loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <BrandLoader />
        </div>
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{loadError || 'Class not found'}</p>
          <Button onClick={() => navigate('/')}>Back to home</Button>
        </div>
      </div>
    );
  }

  if (classData.price > 0 && !ENV.STRIPE_PUBLISHABLE_KEY) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <p className="text-red-600 mb-4">Payments are not configured yet. Please contact support to enroll in this class.</p>
          <Button onClick={() => navigate(-1)}>Back to class</Button>
        </div>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <PaymentCheckout classData={classData} classId={classId} enrollmentSuccessId={id || ''} />
    </Elements>
  );
}
