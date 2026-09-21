import { Check, Users, Video, DollarSign, BookOpen, TrendingUp, Award, Clock, Globe, Shield, UserPlus, Calendar, Rocket } from 'lucide-react';
import { useNavigate } from 'react-router';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import { Button } from '@/app/components/ui/button';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';

export default function Teach() {
  const navigate = useNavigate();

  const features = [
    { icon: Users, title: 'Reach Global Students', description: 'Connect with learners from over 190 countries worldwide' },
    { icon: Video, title: 'Interactive Live Classes', description: 'Professional video streaming with HD quality and screen sharing' },
    { icon: DollarSign, title: 'Earn on Your Terms', description: 'Set your own prices and keep up to 85% of revenue' },
    { icon: Clock, title: 'Flexible Schedule', description: 'Teach when you want, manage your own calendar' },
    { icon: TrendingUp, title: 'Grow Your Brand', description: 'Build your reputation and expand your student base' },
    { icon: Shield, title: 'Secure Payments', description: 'Get paid on time with our secure payment system' },
  ];

  const steps = [
    { 
      icon: UserPlus, 
      number: '01', 
      title: 'Create Your Profile', 
      description: 'Share your expertise and teaching experience with students' 
    },
    { 
      icon: Calendar, 
      number: '02', 
      title: 'Plan Your Classes', 
      description: 'Design engaging live sessions and set your schedule' 
    },
    { 
      icon: Rocket, 
      number: '03', 
      title: 'Start Teaching', 
      description: 'Connect with students and share your knowledge globally' 
    },
  ];

  const benefits = [
    'Professional teaching tools and resources',
    'Dedicated instructor support team',
    'Marketing and promotional assistance',
    'Real-time analytics and insights',
    'Community of fellow instructors',
    'Flexible payment options',
  ];

  return (
    <div className="min-h-screen bg-white">
      <Header variant="light" />
      
      <main>
        {/* Hero Section with Background Image */}
        <section className="relative py-24 sm:py-32 overflow-hidden">
          {/* Background Image with Overlay */}
          <div className="absolute inset-0 z-0">
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1649920442906-3c8ef428fb6e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbnN0cnVjdG9yJTIwdGVhY2hpbmclMjBzdHVkZW50cyUyMGNsYXNzcm9vbXxlbnwxfHx8fDE3Njk1OTA5MDN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
              alt="Teaching background"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/70 to-black/60"></div>
          </div>

          {/* Content */}
          <div className="relative z-10 w-[90vw] mx-auto max-w-6xl">
            <div className="max-w-3xl">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                Share Your Passion.<br />Inspire Learners.
              </h1>
              <p className="text-xl sm:text-2xl text-white/90 mb-8 leading-relaxed">
                Join thousands of instructors teaching what they love on Nexnoon. Create engaging live classes and build a thriving teaching career.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  onClick={() => navigate('/signup')}
                  className="bg-[#889dd1] text-white hover:bg-[#7a8ec2] px-8 py-6 text-lg font-semibold rounded-lg shadow-lg"
                >
                  Start Teaching Today
                </Button>
                <Button
                  onClick={() => navigate('/about')}
                  className="bg-white text-black/90 hover:bg-black/5 px-8 py-6 text-lg font-semibold rounded-lg border-2 border-white"
                >
                  Learn More
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-white">
          <div className="w-[90vw] mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-black/90 mb-4">
                Why Teach on Nexnoon?
              </h2>
              <p className="text-xl text-black/70 max-w-3xl mx-auto">
                Everything you need to create, manage, and grow your online teaching business
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <div 
                  key={index} 
                  className="group bg-white border border-black/10 rounded-2xl p-8 hover:shadow-xl transition-all duration-300"
                >
                  <div className="inline-flex items-center justify-center w-14 h-14 bg-[#889dd1]/10 rounded-xl mb-4 group-hover:bg-[#889dd1] transition-colors">
                    <feature.icon className="h-7 w-7 text-[#889dd1] group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-xl font-semibold text-black/90 mb-2">{feature.title}</h3>
                  <p className="text-black/70 leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-20 bg-gradient-to-br from-[#889dd1]/5 to-white">
          <div className="w-[90vw] mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-black/90 mb-4">
                How It Works
              </h2>
              <p className="text-xl text-black/70">
                Start teaching in three simple steps
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {steps.map((step, index) => (
                <div 
                  key={index} 
                  className="group relative bg-white border border-black/10 rounded-2xl p-8 hover:border-[#889dd1] hover:shadow-xl transition-all duration-300"
                >
                  {/* Step Number Badge */}
                  <div className="absolute -top-3 -right-3 w-12 h-12 bg-gradient-to-br from-[#889dd1] to-[#7a8ec2] rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                    {step.number}
                  </div>
                  
                  {/* Icon */}
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-[#889dd1]/10 rounded-2xl mb-6 group-hover:bg-[#889dd1] transition-colors">
                    <step.icon className="h-8 w-8 text-[#889dd1] group-hover:text-white transition-colors" />
                  </div>
                  
                  {/* Content */}
                  <h3 className="text-xl font-semibold text-black/90 mb-3">{step.title}</h3>
                  <p className="text-black/70 leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits Section with Image */}
        <section className="relative py-20 overflow-hidden">
          <div className="w-[90vw] mx-auto max-w-6xl">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              {/* Image Side */}
              <div className="relative rounded-2xl overflow-hidden shadow-2xl order-2 md:order-1">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1764720573370-5008f1ccc9fa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBlZHVjYXRpb24lMjB0ZWNobm9sb2d5fGVufDF8fHx8MTc2OTA2NTEyMXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                  alt="Teaching benefits"
                  className="w-full h-[500px] object-cover"
                />
              </div>

              {/* Content Side */}
              <div className="order-1 md:order-2">
                <h2 className="text-3xl sm:text-4xl font-bold text-black/90 mb-6">
                  Everything You Need to Succeed
                </h2>
                <p className="text-lg text-black/70 mb-8">
                  We provide all the tools and support you need to create amazing learning experiences.
                </p>
                <ul className="space-y-4">
                  {benefits.map((benefit, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-[#889dd1] rounded-full flex items-center justify-center mt-0.5">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-black/80 text-lg">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section with Background */}
        <section className="relative py-24 overflow-hidden">
          {/* Background Image with Overlay */}
          <div className="absolute inset-0 z-0">
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1766867257943-0665537fb2dd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZWFjaGVyJTIwcHJlc2VudGluZyUyMG9ubGluZSUyMGNsYXNzfGVufDF8fHx8MTc2OTA2ODIwN3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
              alt="Join us"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#889dd1]/95 to-[#7a8ec2]/90"></div>
          </div>

          {/* Content */}
          <div className="relative z-10 w-[90vw] mx-auto max-w-4xl text-center">
            <Award className="h-16 w-16 text-white mx-auto mb-6" />
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
              Ready to Start Your Teaching Journey?
            </h2>
            <p className="text-xl text-white/95 mb-10 max-w-2xl mx-auto">
              Join our community of passionate instructors and make a difference in students' lives while building a successful online teaching career.
            </p>
            <Button
              onClick={() => navigate('/signup')}
              className="bg-white text-[#889dd1] hover:bg-black/5 px-10 py-6 text-lg font-semibold rounded-lg shadow-xl"
            >
              Get Started Now
            </Button>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
}