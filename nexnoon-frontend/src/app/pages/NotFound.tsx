import { useNavigate } from 'react-router';
import { Home, Search } from 'lucide-react';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import { Button } from '@/app/components/ui/button';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header variant="light" />
      
      <main className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="text-center max-w-2xl">
          <h1 className="text-9xl font-bold text-gray-200">404</h1>
          <div className="-mt-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Page Not Found</h2>
            <p className="text-xl text-gray-600 mb-8">
              Sorry, we couldn't find the page you're looking for.
            </p>
          </div>

          <div className="flex items-center justify-center gap-4">
            <Button
              onClick={() => navigate('/')}
              className="bg-black text-white hover:bg-black/90 flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              Go Home
            </Button>
            <Button
              onClick={() => navigate('/browse')}
              variant="outline"
              className="border-black text-black hover:bg-black hover:text-white flex items-center gap-2"
            >
              <Search className="h-4 w-4" />
              Browse Classes
            </Button>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
