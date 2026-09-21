import BrandLoader from '@/app/components/BrandLoader';
import { useState, useEffect } from "react";
import { Clock, Users, Star, Heart, MapPin } from "lucide-react";
import { useNavigate } from "react-router";
import { classDetailUrl } from "@/lib/url";
import { Button } from "@/app/components/ui/button";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";

import { classService } from "@/lib/api";
import { ENV } from "@/config/env";
import type { Class } from "@/types/api";

type CourseCard = { id: string; title: string; instructor: string; location: string; date: string; time: string; participants: number; price: number; currency: string; category: string; image: string; duration: string };
function formatDuration(minutes?: number): string {
  if (!minutes || minutes <= 0) return 'Not specified';
  if (minutes >= 60) {
    const hours = Math.round(minutes / 60);
    return `${hours} hr${hours === 1 ? '' : 's'}`;
  }
  return `${minutes} min`;
}
function apiClassToCourse(c: Class & { _id?: string }): CourseCard {
  const id = c.id ?? c._id;
  return {
    id: id != null ? String(id) : '',
    title: c.title,
    instructor: typeof c.instructor === 'object' && c.instructor?.name ? c.instructor.name : 'Instructor',
    location: 'Online, Live',
    date: c.startDate ? new Date(c.startDate).toLocaleDateString() : '',
    time: '',
    participants: c.enrolledStudents || 0,
    price: c.price,
    currency: c.currency || "USD",
    category: c.category,
    image: c.thumbnail || 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800',
    duration: formatDuration(c.duration),
  };
}

interface LiveClassesProps {
  title?: string;
  subtitle?: string;
  variant?: "default" | "large";
  showBorderHover?: boolean;
  showTitle?: boolean;
  selectedCategory?: string;
  limit?: number;
  priceRange?: 'all' | 'free' | 'paid';
  showLoadMore?: boolean;
}

export default function LiveClasses({ title = "Featured Classes", subtitle, variant = "default", showBorderHover = false, showTitle = true, selectedCategory = "All", limit, showLoadMore = false, priceRange = 'all' }: LiveClassesProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayCount, setDisplayCount] = useState(32);
  const [apiClasses, setApiClasses] = useState<CourseCard[]>([]);
  const useRealData = true;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!useRealData) return;
    setLoading(true); setError('');
    classService.getClasses({ pageSize: 100 })
      .then((res) => setApiClasses((res.data || []).map(apiClassToCourse).filter((card) => card.id != null && card.id !== '')))
      .catch(() => { setApiClasses([]); setError('Unable to load classes. Check the backend connection and try again.'); })
      .finally(() => setLoading(false));
  }, [useRealData, retry]);

  const liveClasses = apiClasses.filter(c => priceRange === "all" || (priceRange === "free" ? c.price === 0 : c.price > 0));

  // Filter classes by category
  const filteredClasses = selectedCategory === "All"
    ? liveClasses
    : liveClasses.filter(cls => cls.category === selectedCategory);

  // If limit is provided, use it; otherwise use displayCount for load more functionality
  const cardsToShow = limit || (showLoadMore ? displayCount : filteredClasses.length);
  const cardsPerPage = limit || 40;
  const totalPages = Math.ceil(filteredClasses.length / cardsPerPage);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % totalPages);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + totalPages) % totalPages);
  };

  const currentClasses = limit
    ? filteredClasses.slice(currentIndex * cardsPerPage, (currentIndex + 1) * cardsPerPage)
    : filteredClasses.slice(0, cardsToShow);

  const hasMore = showLoadMore && cardsToShow < filteredClasses.length;

  const loadMore = () => {
    setDisplayCount(prev => Math.min(prev + 12, filteredClasses.length)); // Load 12 more cards (3 rows)
  };

  const navigate = useNavigate();

  return (
    <section className="pt-4 bg-white">
      <div className="w-[90vw] mx-auto">
        <div>
          {/* Section Header */}
          {showTitle && (
            <div className="flex justify-between items-center mb-6 sm:mb-8">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">{title}</h2>
                {subtitle && (
                  <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
                )}
              </div>

              {/* View All Link */}
              <a
                href="/browse"
                className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-[#889dd1] transition-colors group"
              >
                <span>View All</span>
                <svg
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          )}

          {loading && <BrandLoader />}
          {error && <div role="alert" className="py-8 text-red-700">{error} <button className="underline" onClick={() => setRetry(n => n + 1)}>Retry</button></div>}
          {!loading && !error && !filteredClasses.length && <p className="py-8 text-gray-600">No classes found. Published instructor classes will appear here.</p>}
          {/* Classes Grid with Navigation Arrows */}
          <div className="relative">
            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-[1328px] mx-auto justify-items-center">
              {currentClasses.map((liveClass, index) => {
                const safeId = liveClass.id != null && liveClass.id !== '' ? String(liveClass.id) : '';
                const key = `liveclass-${index}-${safeId || liveClass.title}`;
                return (
                <div
                  key={key}
                  onClick={() => safeId && navigate(classDetailUrl(safeId, liveClass.title))}
                  className={`group rounded-2xl overflow-hidden cursor-pointer w-full min-w-0 max-w-[320px] ${showBorderHover ? 'border border-transparent transition-all duration-300' : ''}`}
                >
                  {/* Image */}
                  <div className="relative h-56 overflow-hidden bg-gray-100 rounded-2xl">
                    <ImageWithFallback
                      src={liveClass.image}
                      alt={liveClass.title}
                      className="w-full h-full object-cover"
                    />

                    {/* Live Class badge + wishlist — aligned row */}
                    <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between">
                      <span className="px-2.5 py-1.5 rounded-full bg-white/40 text-dark text-[11px] font-semibold tracking-wide backdrop-blur-sm">
                        Live Class
                      </span>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-full bg-white/40 backdrop-blur-sm hover:bg-white/60 transition-colors"
                      >
                        <Heart className="h-5 w-5 text-gray-700 hover:text-red-500 hover:fill-red-500 transition-colors" />
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-[10px] px-[0px] py-[5px]">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className={`font-semibold text-base text-gray-900 line-clamp-1 min-w-0 ${showBorderHover ? 'group-hover:text-[#889dd1] transition-colors' : ''}`}>
                        {liveClass.title}
                      </h3>
                      <p className="text-[15px] font-semibold text-gray-900 flex-shrink-0">{liveClass.price === 0 ? 'Free' : new Intl.NumberFormat(undefined, { style: 'currency', currency: liveClass.currency }).format(liveClass.price)}</p>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-sm text-gray-600 m-[0px] -mt-1 mx-[0px] my-[5px]">
                      <div className="flex items-center min-w-0 -ml-0.5">
                        <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
                        <span className="text-[12px] truncate">{liveClass.location}</span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[12px] text-gray-500 flex-shrink-0">
                        <Clock className="h-3.5 w-3.5" />
                        {liveClass.duration}
                      </span>
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div className="text-center mt-6">
              <button
                onClick={loadMore}
                className="px-6 py-3 bg-black text-white font-medium rounded-lg hover:bg-black/90 transition-colors"
              >
                Load More
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
