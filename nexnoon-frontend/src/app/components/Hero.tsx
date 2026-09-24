import { useState } from 'react';
import { useNavigate } from 'react-router';
import ClassSearchAutocomplete from '@/app/components/ClassSearchAutocomplete';

export default function Hero({ variant = 'home' }: { variant?: 'home' | 'browse' }) {
  const isBrowse = variant === 'browse';
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  return (
        <section className="relative z-40 bg-gray-50 py-20 border-b border-gray-200">
          {/* Background Image */}
          <div className="absolute inset-0 z-0 overflow-hidden">
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

              <div className="relative z-30">
                <ClassSearchAutocomplete
                  variant="plain"
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder={isBrowse ? "What do you want to learn today?" : "Search for classes, instructors, or topics..."}
                />
              </div>
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
