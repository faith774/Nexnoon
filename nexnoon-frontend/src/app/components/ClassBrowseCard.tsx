import { Clock, Heart, MapPin, Radio, Users } from 'lucide-react';
import { useNavigate } from 'react-router';
import { classDetailUrl } from '@/lib/url';
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
  const safeId = data.id != null && data.id !== '' ? String(data.id) : '';
  const location = data.location?.trim() || 'Online, Live';
  const duration = data.duration?.trim() || '';
  const enrolled = data.enrolledStudents ?? 0;
  const max = data.maxStudents;
  const showSeats = typeof max === 'number' && max > 0;

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
      <div className="relative h-56 overflow-hidden bg-[#ebe6de] rounded-2xl">
        <ImageWithFallback
          src={data.image}
          alt={data.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-80" />
        <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between">
          <span className="px-2.5 py-1 rounded-full bg-white/85 text-[#14110e] text-[10px] font-semibold tracking-wide backdrop-blur-sm inline-flex items-center gap-1">
            <Radio className="h-3 w-3 text-[#c45c26]" />
            Live
          </span>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="p-2 rounded-full bg-white/85 backdrop-blur-sm hover:bg-white transition-colors"
            aria-label="Save class"
          >
            <Heart className="h-4 w-4 text-[#3d3933] hover:text-rose-500 transition-colors" />
          </button>
        </div>
      </div>

      <div className="pt-3 px-0.5 pb-1">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3
            className={`min-w-0 flex-1 text-base font-semibold leading-snug text-[#14110e] line-clamp-1 ${
              showBorderHover
                ? 'group-hover:text-[#889dd1] transition-colors'
                : 'group-hover:text-[#3a5f8a] transition-colors'
            }`}
          >
            {data.title}
          </h3>
          <p className="shrink-0 text-[15px] font-semibold tabular-nums text-[#14110e]">
            {formatPrice(data.price, data.currency)}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 text-sm text-[#6b655c] -mt-0.5">
          <div className="flex items-center min-w-0 -ml-0.5">
            <MapPin className="h-4 w-4 mr-1 shrink-0 text-[#8a847a]" />
            <span className="text-[12px] truncate">{location}</span>
          </div>
          {duration ? (
            <span className="inline-flex items-center gap-1 text-[12px] text-[#8a847a] shrink-0">
              <Clock className="h-3.5 w-3.5" />
              {duration}
            </span>
          ) : null}
        </div>

        {showSeats ? (
          <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] tabular-nums text-[#8a847a]">
            <Users className="h-3 w-3" />
            {enrolled}/{max} seats
            {enrolled >= max ? ' · Full' : ''}
          </p>
        ) : null}
      </div>
    </div>
  );
}
