import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';

export default function About() {
  return (
    <div className="min-h-screen bg-white">
      <Header variant="light" />
      
      <main className="py-20">
        <div className="w-[90vw] mx-auto max-w-4xl">
          <h1 className="text-4xl font-bold text-gray-900 mb-6">About Nexnoon</h1>
          
          <div className="prose prose-lg max-w-none text-gray-600 space-y-6">
            <p>
              We're on a mission to democratize education through live, interactive online learning experiences.
            </p>
            <p>
              Founded in 2024, Nexnoon connects passionate instructors with curious learners worldwide through real-time classes.
            </p>
            <p>
              Our platform makes it easy to learn anything, anywhere, from the best teachers in the world.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900 mb-2">10K+</div>
              <div className="text-gray-600">Active Students</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900 mb-2">500+</div>
              <div className="text-gray-600">Nexnoon Experts</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900 mb-2">1,000+</div>
              <div className="text-gray-600">Classes</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900 mb-2">190+</div>
              <div className="text-gray-600">Countries</div>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
