import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import LiveClasses from '@/app/components/LiveClasses';
import Hero from '@/app/components/Hero';
import { Button } from '@/app/components/ui/button';

export default function Browse() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [priceRange, setPriceRange] = useState<'all' | 'free' | 'paid'>('all');
  const [showFilters, setShowFilters] = useState(false);

  const categories = [
    'All',
    'Development',
    'Design',
    'Marketing',
    'Business',
    'Photography',
    'Music',
    'Health & Wellness',
    'Languages'
  ];

  return (
    <div className="min-h-screen bg-white">
      <Header variant="light" />
      
      <main>
        {/* Search Section */}
        <Hero />

        {/* Filters */}
        <section className="sticky top-16 z-30 bg-white border-b border-gray-200 shadow-sm">
          <div className="w-[90vw] mx-auto py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-1">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      selectedCategory === category
                        ? 'bg-black text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="text-sm font-medium">Filters</span>
              </button>
            </div>

            {showFilters && (
              <div className="mt-4 p-6 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Filters</h3>
                  <button onClick={() => setShowFilters(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">Price</label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="price"
                          checked={priceRange === 'all'}
                          onChange={() => setPriceRange('all')}
                          className="rounded-full border-gray-300 text-black focus:ring-black"
                        />
                        <span className="ml-2 text-sm text-gray-700">All Prices</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="price"
                          checked={priceRange === 'free'}
                          onChange={() => setPriceRange('free')}
                          className="rounded-full border-gray-300 text-black focus:ring-black"
                        />
                        <span className="ml-2 text-sm text-gray-700">Free</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="price"
                          checked={priceRange === 'paid'}
                          onChange={() => setPriceRange('paid')}
                          className="rounded-full border-gray-300 text-black focus:ring-black"
                        />
                        <span className="ml-2 text-sm text-gray-700">Paid</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-3">
                  <Button onClick={() => setShowFilters(false)} className="bg-black text-white hover:bg-black/90">
                    Apply Filters
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setSelectedCategory('All');
                    setPriceRange('all');
                  }}>
                    Clear All
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Results */}
        <section className="py-8">
          <div className="w-[90vw] mx-auto">
            <LiveClasses
              showTitle={false}
              variant="large"
              showBorderHover
              selectedCategory={selectedCategory}
              priceRange={priceRange}
              showLoadMore
            />
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
}