import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Search } from 'lucide-react';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';

export default function Hero({ variant = 'home' }: { variant?: 'home' | 'browse' }) {
  const isBrowse = variant === 'browse';
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
        <section className="relative bg-gray-50 py-20 border-b border-gray-200 overflow-hidden">
          {/* Background Image */}
          <div className="absolute inset-0 z-0">
            <img
              src={isBrowse
                ? "https://images.unsplash.com/photo-1758270704534-fd9715bffc0e?auto=format&fit=crop&q=80&w=1080"
                : "https://images.unsplash.com/photo-1758612214882-03f8a1d7211f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvbmxpbmUlMjBlZHVjYXRpb24lMjBzdHVkZW50cyUyMGxlYXJuaW5nfGVufDF8fHx8MTc2OTA3NTE4NXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"}
              alt="Browse Classes"
              className="w-full h-full object-cover"
            />
            {/* Dark Overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/60 to-black/50"></div>
          </div>

          <div className="w-[90vw] mx-auto relative z-10">
            <div className="max-w-3xl mx-auto">
              {isBrowse && (
                <div className="text-center mb-6">
                  <span className="inline-block px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/30 rounded-full text-white text-sm sm:text-base">
                    Online Live Classes
                  </span>
                </div>
              )}
              <h1 className="text-4xl md:text-5xl font-bold text-white text-center mb-4">
                {isBrowse ? 'Learn Live, Grow Fast' : 'Discover Live Classes'}
              </h1>
              {!isBrowse && <p className="text-white/90 text-lg text-center mb-10">
                Find the perfect class to enhance your skills
              </p>}

              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 z-10" />
                <Input
                  type="text"
                  placeholder={isBrowse ? "What do you want to learn today?" : "Search for classes, instructors, or topics..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-14 pr-32 py-6 text-base rounded-full border-2 border-white/20 focus-visible:border-black focus-visible:ring-0 focus-visible:outline-none bg-white/95 backdrop-blur-sm"
                />
                <Button
                  type="submit"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black text-white hover:bg-black/90 rounded-full px-8 shadow-lg"
                >
                  Search
                </Button>
              </form>
              {isBrowse && (
                <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
                  <span className="text-xs sm:text-sm text-white/80">Popular:</span>
                  {['Web Development', 'Design', 'Marketing', 'Business'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => navigate(`/search?q=${encodeURIComponent(tag)}`)}
                      className="px-3 sm:px-4 py-1.5 text-xs sm:text-sm bg-white/10 backdrop-blur-sm border border-white/30 text-white rounded-full hover:bg-white/20 transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
  );
}
