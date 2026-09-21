import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-white">
      <Header variant="light" />
      
      <main className="py-20">
        <div className="w-[90vw] max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Privacy Policy</h1>
          <p className="text-gray-600 mb-12">Last updated: January 21, 2026</p>

          <div className="prose prose-lg max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Information We Collect</h2>
              <p className="text-gray-600">
                We collect information you provide directly, including name, email, and usage data.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">2. How We Use Your Information</h2>
              <p className="text-gray-600">
                We use your information to provide services, improve our platform, and communicate with you.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Data Security</h2>
              <p className="text-gray-600">
                We implement industry-standard security measures to protect your personal information.
              </p>
            </section>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
