import { Radio } from 'lucide-react';
import { useNavigate } from 'react-router';
import { classDetailUrl } from '@/lib/url';
import { useTimeFormat } from '@/lib/timezone';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';

export type ClassBrowseCardData = {
  id: string;
  title: string;
  instructor?: string;
  price: number;
  currency?: string;
  image: string;
  duration?: string;
  /** Raw minutes — used by browse filters */
  durationMinutes?: number;
  category?: string;
  level?: string;
  language?: string;
  startDate?: string;
  startHour?: number | null;
  location?: string;
  enrolledStudents?: number;
  maxStudents?: number;
};

function formatPrice(price: number, currency = 'USD') {
  if (price === 0) return 'Free';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: price % 1 === 0 ? 0 : 2,
  }).format(price);
}

/**
 * Browse / homepage class card — image + tidy meta block underneath.
 */
export default function ClassBrowseCard({
  data,
  showBorderHover = false,
  fullWidth = false,
}: {
  data: ClassBrowseCardData;
  showBorderHover?: boolean;
  fullWidth?: boolean;
}) {
  const navigate = useNavigate();
  const t = useTimeFormat();
  const safeId = data.id != null && data.id !== '' ? String(data.id) : '';
  const duration = data.duration?.trim() || '';
  const enrolled = data.enrolledStudents ?? 0;
  const max = data.maxStudents;
  const showSeats = typeof max === 'number' && max > 0;
  const left = showSeats ? Math.max(0, max - enrolled) : 0;
  const full = showSeats && left === 0;
  const fewLeft = showSeats && !full && left <= Math.max(3, Math.ceil(max * 0.2));
  const starts = data.startDate && !Number.isNaN(new Date(data.startDate).getTime()) ? data.startDate : '';
  const eyebrow = [data.category, data.level].filter(Boolean).join(' · ');
  const meta = [data.instructor, starts ? t.day(starts) : '', duration].filter(Boolean);
  const hover = showBorderHover ? 'group-hover:text-[#889dd1]' : 'group-hover:text-[#c45c26]';

  return (
    <div
      role={safeId ? 'link' : undefined}
      tabIndex={safeId ? 0 : undefined}
      onClick={() => safeId && navigate(classDetailUrl(safeId, data.title))}
      onKeyDown={(e) => {
        if (safeId && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          navigate(classDetailUrl(safeId, data.title));
        }
      }}
      className={`group cursor-pointer w-full min-w-0 ${fullWidth ? '' : 'max-w-[320px]'}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#ebe6de] rounded-2xl">
        <ImageWithFallback
          src={data.image}
          alt={data.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
        <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#14110e] backdrop-blur-sm">
            <Radio className="h-3 w-3 text-[#c45c26]" />
            {data.language ? `Live · ${data.language}` : 'Live online'}
          </span>
          {full ? (
            <span className="rounded-full bg-[#14110e]/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">Full</span>
          ) : fewLeft ? (
            <span className="rounded-full bg-[#c45c26] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
              {left} seat{left === 1 ? '' : 's'} left
            </span>
          ) : null}
        </div>
        <span className="absolute bottom-3 right-3 z-10 rounded-full bg-white px-3 py-1 text-sm font-semibold tabular-nums text-[#14110e] shadow-sm">
          {formatPrice(data.price, data.currency)}
        </span>
      </div>

      <div className="px-0.5 pt-3">
        {eyebrow ? (
          <p className="truncate text-[10px] font-medium uppercase tracking-[0.16em] text-[#8a847a]">{eyebrow}</p>
        ) : null}
        <h3 className={`mt-1 line-clamp-2 font-serif text-[16px] leading-snug tracking-tight text-[#14110e] transition-colors ${hover}`}>
          {data.title}
        </h3>
        {meta.length > 0 ? (
          <p className="mt-1.5 truncate text-xs text-[#6b655c]">{meta.join(' · ')}</p>
        ) : null}
      </div>
    </div>
  );
}
