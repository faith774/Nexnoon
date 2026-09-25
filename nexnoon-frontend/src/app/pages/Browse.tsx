import { useMemo, useState } from 'react';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import LiveClasses from '@/app/components/LiveClasses';
import Hero from '@/app/components/Hero';
import ClassFiltersSheet from '@/app/components/ClassFiltersSheet';
import CategoryFilterBar from '@/app/components/CategoryFilterBar';
import {
  DEFAULT_CLASS_FILTERS,
  countActiveFilters,
  type ClassBrowseFilters,
} from '@/lib/classFilters';

export default function Browse() {
  const [applied, setApplied] = useState<ClassBrowseFilters>(DEFAULT_CLASS_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  const activeCount = useMemo(() => countActiveFilters(applied), [applied]);

  return (
    <div className="min-h-screen bg-white">
      <Header variant="light" />

      <main>
        <Hero />

        <CategoryFilterBar
          value={applied}
          onChange={setApplied}
          onOpenFilters={() => setShowFilters(true)}
        />

        <ClassFiltersSheet
          open={showFilters}
          onOpenChange={setShowFilters}
          value={applied}
          activeCount={activeCount}
          onApply={setApplied}
          onClear={() => setApplied(DEFAULT_CLASS_FILTERS)}
        />

        <LiveClasses
          showTitle={false}
          variant="large"
          showBorderHover
          filters={applied}
          showLoadMore
        />
      </main>

      <Footer />
    </div>
  );
}
