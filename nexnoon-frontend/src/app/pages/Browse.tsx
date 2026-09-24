import { useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import LiveClasses from '@/app/components/LiveClasses';
import Hero from '@/app/components/Hero';
import ClassFiltersSheet from '@/app/components/ClassFiltersSheet';
import {
  BROWSE_CATEGORIES,
  DEFAULT_CLASS_FILTERS,
  countActiveFilters,
  type ClassBrowseFilters,
} from '@/lib/classFilters';

export default function Browse() {
  const [applied, setApplied] = useState<ClassBrowseFilters>(DEFAULT_CLASS_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  const activeCount = useMemo(() => countActiveFilters(applied), [applied]);

  const setCategory = (category: string) => {
    setApplied((prev) => ({ ...prev, category }));
  };

  return (
    <div className="min-h-screen bg-white">
      <Header variant="light" />

      <main>
        <Hero />

        <section className="sticky top-16 z-20 bg-white border-b border-gray-200 shadow-sm">
          <div className="w-[90vw] mx-auto py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-1">
                {BROWSE_CATEGORIES.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setCategory(category)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      applied.category === category
                        ? 'bg-black text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowFilters(true)}
                className="relative flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="text-sm font-medium">Filters</span>
                {activeCount > 0 ? (
                  <span className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1 rounded-full bg-black text-white text-[10px] font-semibold flex items-center justify-center">
                    {activeCount}
                  </span>
                ) : null}
              </button>
            </div>
          </div>
        </section>

        <ClassFiltersSheet
          open={showFilters}
          onOpenChange={setShowFilters}
          value={applied}
          activeCount={activeCount}
          onApply={setApplied}
          onClear={() => setApplied(DEFAULT_CLASS_FILTERS)}
        />

        <section className="py-8">
          <div className="w-[90vw] mx-auto">
            <LiveClasses
              showTitle={false}
              variant="large"
              showBorderHover
              filters={applied}
              showLoadMore
            />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
