import BrandLoader from '@/app/components/BrandLoader';
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Search as SearchIcon, Filter, Clock, Users, Star, TrendingUp } from 'lucide-react';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import { classService } from '@/lib/api';
import { ENV } from '@/config/env';
import { classDetailUrl } from '@/lib/url';
import type { Class } from '@/types/api';

type SearchResultCard = {
  id: string | number;
  title: string;
  instructor: string;
  category: string;
  level: string;
  rating: number;
  students: number;
  price: number;
  duration: string;
  thumbnail: string;
};

function apiClassToSearchCard(c: Class): SearchResultCard {
  const durationMins = c.duration ?? 0;
  const durationStr = durationMins >= 60 ? `${Math.round(durationMins / 60)} hrs` : `${durationMins} min`;
  return {
    id: c.id,
    title: c.title,
    instructor: typeof c.instructor === 'object' && c.instructor?.name ? c.instructor.name : 'Instructor',
    category: c.category,
    level: c.level ?? 'All Levels',
    rating: c.rating ?? 0,
    students: c.enrolledStudents ?? 0,
    price: c.price ?? 0,
    duration: durationStr,
    thumbnail: c.thumbnail || 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400',
  };
}


export default function Search() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const query = searchParams.get('q') || '';
  const [searchTerm, setSearchTerm] = useState(query);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterPrice, setFilterPrice] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [apiResults, setApiResults] = useState<SearchResultCard[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    setSearchTerm(query);
  }, [query]);

  const useApiSearch = true;

  useEffect(() => {
    if (!useApiSearch) {
      setApiResults([]);
      return;
    }
    setSearchLoading(true);
    classService
      .searchClasses(query.trim(), { pageSize: 100 })
      .then((res) => setApiResults((res.data || []).map(apiClassToSearchCard)))
      .catch(() => setApiResults([]))
      .finally(() => setSearchLoading(false));
  }, [query, useApiSearch]);

  const searchResults = apiResults;

  const filteredResults = searchResults.filter((result) => {
    const matchesCategory = filterCategory === 'all' || result.category === filterCategory;
    const matchesLevel = filterLevel === 'all' || result.level === filterLevel;
    const matchesPrice = 
      filterPrice === 'all' ||
      (filterPrice === 'free' && result.price === 0) ||
      (filterPrice === 'paid' && result.price > 0) ||
      (filterPrice === 'under50' && result.price < 50) ||
      (filterPrice === 'under100' && result.price < 100);
    
    return matchesCategory && matchesLevel && matchesPrice;
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header variant="light" />
      
      <main className="py-12">
        <div className="w-[90vw] max-w-7xl mx-auto">
          {/* Search Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-black mb-2">
              {query ? `Search results for "${query}"` : 'Search Classes'}
            </h1>
            <p className="text-gray-600">
              {filteredResults.length} classes found
            </p>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="mb-8">
            <div className="relative">
              <SearchIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search for classes, instructors, or topics..."
                className="pl-12 pr-4 py-6 text-base rounded-lg border-gray-300"
              />
            </div>
          </form>

          <div className="grid lg:grid-cols-4 gap-8">
            {/* Filters Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white border border-gray-300 rounded-xl p-6 sticky top-24">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-black">Filters</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFilterCategory('all');
                      setFilterLevel('all');
                      setFilterPrice('all');
                    }}
                    className="text-xs"
                  >
                    Clear All
                  </Button>
                </div>

                {/* Category Filter */}
                <div className="mb-6">
                  <label className="block text-sm font-bold text-black mb-3">Category</label>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
                  >
                    <option value="all">All Categories</option>
                    <option value="Development">Development</option>
                    <option value="Design">Design</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Photography">Photography</option>
                    <option value="Business">Business</option>
                    <option value="Music">Music</option>
                  </select>
                </div>

                {/* Level Filter */}
                <div className="mb-6">
                  <label className="block text-sm font-bold text-black mb-3">Level</label>
                  <select
                    value={filterLevel}
                    onChange={(e) => setFilterLevel(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
                  >
                    <option value="all">All Levels</option>
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>

                {/* Price Filter */}
                <div className="mb-6">
                  <label className="block text-sm font-bold text-black mb-3">Price</label>
                  <select
                    value={filterPrice}
                    onChange={(e) => setFilterPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
                  >
                    <option value="all">All Prices</option>
                    <option value="free">Free</option>
                    <option value="paid">Paid</option>
                    <option value="under50">Under $50</option>
                    <option value="under100">Under $100</option>
                  </select>
                </div>

                {/* Popular Tags */}
                <div>
                  <label className="block text-sm font-bold text-black mb-3">Popular Topics</label>
                  <div className="flex flex-wrap gap-2">
                    {['React', 'Design', 'Marketing', 'Photography', 'JavaScript', 'UX'].map((tag) => (
                      <button
                        key={tag}
                        className="px-3 py-1 text-xs border border-gray-300 rounded-full hover:bg-black hover:text-white hover:border-black transition-colors"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="lg:col-span-3">
              {searchLoading ? (
                <div className="bg-white border border-gray-300 rounded-xl p-12 text-center">
                  <BrandLoader />
                </div>
              ) : filteredResults.length === 0 ? (
                <div className="bg-white border border-gray-300 rounded-xl p-12 text-center">
                  <SearchIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-black mb-2">No classes found</h3>
                  <p className="text-gray-600 mb-6">
                    Try adjusting your search or filters to find what you're looking for.
                  </p>
                  <Button
                    onClick={() => {
                      setSearchTerm('');
                      setFilterCategory('all');
                      setFilterLevel('all');
                      setFilterPrice('all');
                    }}
                    className="bg-black text-white hover:bg-gray-800 rounded-lg"
                  >
                    Clear Search
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredResults.map((result) => (
                    <div
                      key={result.id}
                      onClick={() => navigate(classDetailUrl(String(result.id), result.title))}
                      className="bg-white border border-gray-300 rounded-xl overflow-hidden hover:shadow-lg hover:border-gray-400 transition-all cursor-pointer group"
                    >
                      <div className="flex flex-col md:flex-row">
                        {/* Thumbnail */}
                        <div className="md:w-64 h-48 md:h-auto flex-shrink-0 relative overflow-hidden">
                          <ImageWithFallback
                            src={result.thumbnail}
                            alt={result.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute top-3 left-3 px-3 py-1 bg-black text-white text-xs font-bold rounded-full">
                            {result.category}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-6">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h3 className="text-xl font-bold text-black mb-2 group-hover:text-gray-700 transition-colors">
                                {result.title}
                              </h3>
                              <p className="text-sm text-gray-600 mb-3">by {result.instructor}</p>
                            </div>
                            <div className="text-right ml-4">
                              <div className="text-2xl font-bold text-black">${result.price}</div>
                            </div>
                          </div>

                          {/* Stats */}
                          <div className="flex flex-wrap items-center gap-4 mb-4">
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                              <span className="font-bold text-black">{result.rating}</span>
                            </div>
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Users className="h-4 w-4" />
                              <span>{result.students.toLocaleString()} students</span>
                            </div>
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Clock className="h-4 w-4" />
                              <span>{result.duration}</span>
                            </div>
                            <div className="px-3 py-1 bg-gray-100 text-black text-xs font-bold rounded-full">
                              {result.level}
                            </div>
                          </div>

                          <Button className="bg-black text-white hover:bg-gray-800 rounded-lg">
                            View Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}