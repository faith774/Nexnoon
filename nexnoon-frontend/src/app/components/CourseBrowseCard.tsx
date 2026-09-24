import { ArrowRight, Globe2, Layers3 } from 'lucide-react';
import { useNavigate } from 'react-router';
import type { Course } from '@/types/api';

export default function CourseBrowseCard({ course }: { course: Course }) {
  const navigate = useNavigate();
  const langs = (course.languageOfferings || []).filter((o) => o.status !== 'inactive');

  return (
    <button
      type="button"
      onClick={() => navigate(`/courses/${course.slug}`)}
      className="group w-full max-w-[360px] text-left rounded-2xl border border-[#ebe6de] bg-white p-5 transition hover:border-[#14110e]/30"
    >
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0ebe3] text-[#5c564e]">
        <Layers3 className="h-5 w-5" />
      </div>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a847a]">
        {course.category || 'Course'}
      </p>
      <h3 className="mt-1 text-lg font-semibold leading-snug text-[#14110e] line-clamp-2 group-hover:text-[#3a5f8a] transition-colors">
        {course.title}
      </h3>
      <p className="mt-2 text-sm text-[#6b655c] line-clamp-2 leading-relaxed">{course.description}</p>
      <div className="mt-4 flex items-center justify-between gap-2 text-xs text-[#8a847a]">
        <span className="inline-flex items-center gap-1.5">
          <Globe2 className="h-3.5 w-3.5" />
          {langs.length
            ? langs
                .slice(0, 3)
                .map((l) => l.label)
                .join(' · ')
            : 'Languages TBA'}
          {langs.length > 3 ? ` +${langs.length - 3}` : ''}
        </span>
        <span className="inline-flex items-center gap-1 font-medium text-[#14110e]">
          View
          <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  );
}
