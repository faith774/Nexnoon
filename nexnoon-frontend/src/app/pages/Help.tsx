import { useState } from 'react';
import { Link } from 'react-router';
import { 
  Search, HelpCircle, BookOpen, Video, DollarSign, 
  Settings, MessageCircle, ChevronRight, ChevronDown 
} from 'lucide-react';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';

export default function Help() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const categories = [
    {
      icon: BookOpen,
      title: 'Getting Started',
      description: 'Learn the basics of using Nexnoon',
      articles: 12,
      image: 'https://images.unsplash.com/photo-1759984782106-4b56d0aa05b8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvbmxpbmUlMjBsZWFybmluZyUyMHN0dWRlbnR8ZW58MXx8fHwxNzY5MTQ4NzY0fDA&ixlib=rb-4.1.0&q=80&w=1080',
    },
    {
      icon: Video,
      title: 'Live Classes',
      description: 'How to join and participate in live sessions',
      articles: 8,
      image: 'https://images.unsplash.com/photo-1707945272785-38071d393b5f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2aWRlbyUyMGNvbmZlcmVuY2UlMjB0ZWFjaGluZ3xlbnwxfHx8fDE3NjkxNzQ1NDF8MA&ixlib=rb-4.1.0&q=80&w=1080',
    },
    {
      icon: DollarSign,
      title: 'Payments & Billing',
      description: 'Manage subscriptions and payments',
      articles: 6,
      image: 'https://images.unsplash.com/photo-1648161235864-00702f154f09?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwYXltZW50JTIwY3JlZGl0JTIwY2FyZHxlbnwxfHx8fDE3NjkxNTUxMzl8MA&ixlib=rb-4.1.0&q=80&w=1080',
    },
    {
      icon: Settings,
      title: 'Account Settings',
      description: 'Customize your account preferences',
      articles: 10,
      image: 'https://images.unsplash.com/photo-1767449441925-737379bc2c4d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzZXR0aW5ncyUyMGludGVyZmFjZSUyMGRhc2hib2FyZHxlbnwxfHx8fDE3NjkxNjE2MDV8MA&ixlib=rb-4.1.0&q=80&w=1080',
    },
  ];

  const faqs = [
    {
      question: 'How do I join a live class?',
      answer: 'To join a live class, go to "My Classes", select the class you\'re enrolled in, and click "Join Live Session" when it\'s time. You\'ll be taken to a waiting room before the instructor starts the session.',
    },
    {
      question: 'Can I watch recordings of missed classes?',
      answer: 'Yes! All live classes are automatically recorded and available in your classroom. Navigate to the class page and click on "Recordings" to access past sessions.',
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept all major credit cards (Visa, Mastercard, American Express), PayPal, and bank transfers. All payments are processed securely through our payment partners.',
    },
    {
      question: 'How do I get a refund?',
      answer: 'You can request a refund within 14 days of purchase if you haven\'t attended more than 2 live sessions. Go to Settings > Billing and click "Request Refund" next to the course.',
    },
    {
      question: 'Can I download course materials?',
      answer: 'Yes! Nexnoon Experts can provide downloadable materials like PDFs, slides, and code files. You can find these in the "Materials" section of your classroom.',
    },
    {
      question: 'How do I earn a certificate?',
      answer: 'To earn a certificate, you must complete all required assignments, attend at least 80% of live sessions, and achieve a passing grade. Certificates are automatically issued upon completion.',
    },
    {
      question: 'What if I have technical issues during a live class?',
      answer: 'If you experience technical issues, try refreshing your browser first. Make sure you have a stable internet connection. You can also check our system status page or contact support for immediate help.',
    },
    {
      question: 'Can I become an instructor on Nexnoon?',
      answer: 'Absolutely! Click on "Teach" in the navigation menu to apply. We review all applications within 2-3 business days. You\'ll need to provide information about your expertise and the classes you want to teach.',
    },
  ];

  const popularArticles = [
    { title: 'How to Set Up Your Profile', category: 'Getting Started', time: '3 min read' },
    { title: 'Troubleshooting Video Connection Issues', category: 'Technical', time: '5 min read' },
    { title: 'Understanding the Classroom Layout', category: 'Live Classes', time: '4 min read' },
    { title: 'Managing Your Subscriptions', category: 'Billing', time: '2 min read' },
    { title: 'How to Submit Assignments', category: 'Classes', time: '3 min read' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header variant="light" />
      
      <main>
        {/* Hero Section with Background Image */}
        <div className="relative py-20 overflow-hidden">
          {/* Background Image */}
          <div className="absolute inset-0">
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1738598647432-9ec379ca2291?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoZWxwJTIwZGVzayUyMHN1cHBvcnR8ZW58MXx8fHwxNzY5MDY2ODk0fDA&ixlib=rb-4.1.0&q=80&w=1080"
              alt="Help Center"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/60 to-black/70" />
          </div>

          {/* Hero Content */}
          <div className="relative w-[90vw] max-w-6xl mx-auto text-center">
            <h1 className="text-4xl font-bold text-white mb-4">How can we help you?</h1>
            <p className="text-white/90 mb-8">
              Search our help center or browse categories below
            </p>

            {/* Search */}
            <div className="max-w-2xl mx-auto relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 z-10" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for help articles, guides, and FAQs..."
                className="pl-12 pr-4 py-6 text-base rounded-xl border-gray-300 shadow-lg bg-white"
              />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="py-12 bg-gray-50">
          <div className="w-[90vw] max-w-6xl mx-auto">
            {/* Categories with Images */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              {categories.map((category, index) => {
                const Icon = category.icon;
                return (
                  <button
                    key={index}
                    className="bg-white border border-gray-300 rounded-xl overflow-hidden text-left hover:shadow-lg hover:border-gray-400 transition-all group"
                  >
                    {/* Image Section */}
                    <div className="relative h-32 overflow-hidden bg-gray-100">
                      <ImageWithFallback
                        src={category.image}
                        alt={category.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                      <div className="absolute bottom-3 left-3 w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-lg">
                        <Icon className="h-5 w-5 text-black" />
                      </div>
                    </div>
                    
                    {/* Content Section */}
                    <div className="p-5">
                      <h3 className="font-bold text-black mb-2">{category.title}</h3>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{category.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">{category.articles} articles</span>
                        <ChevronRight className="h-4 w-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Popular Articles */}
            <div className="bg-white border border-gray-300 rounded-xl p-8 mb-12">
              <h2 className="text-2xl font-bold text-black mb-6">Popular Articles</h2>
              <div className="space-y-3">
                {popularArticles.map((article, index) => (
                  <button
                    key={index}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <BookOpen className="h-5 w-5 text-gray-400" />
                      <div className="text-left">
                        <h3 className="font-bold text-black group-hover:text-gray-700">
                          {article.title}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span>{article.category}</span>
                          <span>•</span>
                          <span>{article.time}</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400 group-hover:translate-x-1 transition-transform" />
                  </button>
                ))}
              </div>
            </div>

            {/* FAQs */}
            <div className="bg-white border border-gray-300 rounded-xl p-8">
              <h2 className="text-2xl font-bold text-black mb-6">Frequently Asked Questions</h2>
              <div className="space-y-3">
                {faqs.map((faq, index) => (
                  <div
                    key={index}
                    className="border border-gray-300 rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                    >
                      <span className="font-bold text-black pr-4">{faq.question}</span>
                      <ChevronDown
                        className={`h-5 w-5 text-gray-600 flex-shrink-0 transition-transform ${
                          expandedFaq === index ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {expandedFaq === index && (
                      <div className="px-4 pb-4 text-gray-600 border-t border-gray-200 pt-4">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Contact Support with Background Image */}
            <div className="mt-12 relative rounded-2xl overflow-hidden">
              <div className="absolute inset-0">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1618544976420-1f213fcf2052?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjdXN0b21lciUyMHN1cHBvcnQlMjB0ZWFtfGVufDF8fHx8MTc2OTA5MjYyNXww&ixlib=rb-4.1.0&q=80&w=1080"
                  alt="Customer Support"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-black/90 via-black/80 to-gray-900/90" />
              </div>
              
              <div className="relative p-8 text-center text-white">
                <MessageCircle className="h-12 w-12 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Still need help?</h2>
                <p className="text-white/80 mb-6 max-w-lg mx-auto">
                  Our support team is available 24/7 to assist you with any questions or concerns.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link to="/contact">
                    <Button className="bg-white text-black hover:bg-gray-100 rounded-lg">
                      Contact Support
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    className="border-white text-white hover:bg-white/10 rounded-lg"
                  >
                    Live Chat
                  </Button>
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