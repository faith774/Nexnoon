import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { downloadCsv, useOverlay, type usePagination } from '../admin/ui';

export {
  daysAgo,
  downloadCsv,
  fmtDate,
  fmtDateTime,
  initials,
  matches,
  money,
  relativeDue,
  usePagination,
  useSticky,
} from '../admin/ui';

/* Warm Nexnoon palette: paper #f6f4f0, ink #14110e, clay #c45c26, lines #e4dfd6 / #eee9e0, muted #6b655c / #8a847a. */

export function untilLabel(iso?: string | null) {
  if (!iso) return '';
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (mins <= 0) return 'now';
  if (mins < 60) return `in ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `in ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'tomorrow' : `in ${days} days`;
}

export type Tone = 'green' | 'amber' | 'rose' | 'clay' | 'stone' | 'ink';

const toneClass: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
  amber: 'bg-amber-50 text-amber-900 ring-amber-200/80',
  rose: 'bg-rose-50 text-rose-800 ring-rose-200/80',
  clay: 'bg-[#fbeee6] text-[#9a4518] ring-[#f0d3c1]',
  stone: 'bg-[#f1ede6] text-[#6b655c] ring-[#e4dfd6]',
  ink: 'bg-[#14110e] text-white ring-[#14110e]',
};

export function statusToneOf(status?: string): Tone {
  switch (status) {
    case 'approved':
    case 'published':
    case 'active':
    case 'completed':
    case 'present':
      return 'green';
    case 'pending':
    case 'draft':
    case 'late':
    case 'invited':
      return 'amber';
    case 'rejected':
    case 'failed':
    case 'absent':
    case 'revoked':
    case 'expired':
      return 'rose';
    case 'suspended':
      return 'clay';
    default:
      return 'stone';
  }
}

export function scoreToneOf(score: number): Tone {
  if (score >= 80) return 'green';
  if (score >= 60) return 'amber';
  return 'rose';
}

export function Pill({ tone = 'stone', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ${toneClass[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export const btn = {
  primary:
    'inline-flex items-center justify-center gap-1.5 bg-[#14110e] px-4 py-2 text-sm text-white transition-colors hover:bg-black/80 disabled:opacity-50',
  accent:
    'inline-flex items-center justify-center gap-1.5 bg-[#c45c26] px-4 py-2 text-sm text-white transition-colors hover:bg-[#a94d1f] disabled:opacity-50',
  secondary:
    'inline-flex items-center justify-center gap-1.5 border border-[#d5cfc4] bg-white px-3.5 py-2 text-sm text-[#14110e] transition-colors hover:border-[#14110e] disabled:opacity-50',
  danger:
    'inline-flex items-center justify-center gap-1.5 border border-rose-200 bg-white px-3.5 py-2 text-sm text-rose-800 transition-colors hover:bg-rose-50 disabled:opacity-50',
  link: 'inline-flex items-center gap-1 text-sm font-medium text-[#c45c26] hover:underline disabled:opacity-50',
};

export const inputCls =
  'w-full border border-[#d5cfc4] bg-white px-3 py-2.5 text-sm outline-none transition-[border,box-shadow] focus:border-[#c45c26] focus:ring-2 focus:ring-[#c45c26]/15';

export function Field({ label, hint, className = '', children }: { label: string; hint?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[11px] uppercase tracking-[0.14em] text-[#6b655c]">{label}</span>
      {children}
      {hint ? <span className="text-xs text-[#8a847a]">{hint}</span> : null}
    </label>
  );
}

export function Panel({
  title,
  subtitle,
  icon,
  actions,
  children,
  className = '',
  bodyClassName = 'p-5 md:p-6',
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`border border-[#e4dfd6] bg-white ${className}`}>
      {title ? (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eee9e0] px-5 py-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {icon ? <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#fbeee6] text-[#c45c26]">{icon}</span> : null}
            <div className="min-w-0">
              <h3 className="font-serif text-lg tracking-tight text-[#14110e]">{title}</h3>
              {subtitle ? <p className="text-xs text-[#8a847a]">{subtitle}</p> : null}
            </div>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function EmptyBlock({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="border border-dashed border-[#ddd6ca] bg-white/60 p-8 text-center">
      <p className="text-sm text-[#6b655c]">{text}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone,
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'warn' | 'good';
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`group relative block w-full border bg-white px-4 py-3.5 text-left transition-colors ${
        tone === 'warn'
          ? 'border-amber-300/80 bg-gradient-to-br from-amber-50/80 to-white'
          : tone === 'good'
            ? 'border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white'
            : 'border-[#e4dfd6]'
      } ${onClick ? 'hover:border-[#14110e]/40' : ''}`}
    >
      <p className="text-[11px] uppercase tracking-[0.14em] text-[#8a847a]">{label}</p>
      <p className="mt-1 font-serif text-2xl tracking-tight text-[#14110e]">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-[#8a847a]">{hint}</p> : null}
      {onClick ? (
        <ChevronRight className="absolute right-3 top-3.5 h-4 w-4 text-[#b5aea3] transition-transform group-hover:translate-x-0.5" />
      ) : null}
    </Tag>
  );
}

export function FilterChips<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: NoInfer<T>) => void;
  options: { id: NoInfer<T>; label: string; count?: number }[];
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.id)}
            className={`inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-medium transition-colors ${
              active ? 'border-[#14110e] bg-[#14110e] text-white' : 'border-[#ddd6ca] bg-white text-[#6b655c] hover:border-[#14110e]/40'
            }`}
          >
            {o.label}
            {typeof o.count === 'number' ? (
              <span className={`text-[10px] ${active ? 'text-white/70' : 'text-[#b5aea3]'}`}>{o.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function SegmentedTabs<T extends string>({
  value,
  onChange,
  tabs,
}: {
  value: T;
  onChange: (v: NoInfer<T>) => void;
  tabs: { id: NoInfer<T>; label: string; count?: number }[];
}) {
  return (
    <div role="tablist" className="flex gap-5 overflow-x-auto border-b border-[#e4dfd6]">
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={`-mb-px whitespace-nowrap border-b-2 pb-2.5 text-sm transition-colors ${
              active ? 'border-[#c45c26] font-medium text-[#14110e]' : 'border-transparent text-[#6b655c] hover:text-[#14110e]'
            }`}
          >
            {t.label}
            {typeof t.count === 'number' ? <span className="ml-1.5 text-xs text-[#b5aea3]">{t.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function Avatar({ name, src, size = 36 }: { name: string; src?: string; size?: number }) {
  const letters = (name || '?')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f1ede6] font-semibold text-[#6b655c]"
      style={{ width: size, height: size, fontSize: Math.max(10, size / 3.2) }}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : letters}
    </span>
  );
}

export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value || 0));
  const color = v >= 80 ? 'bg-emerald-500' : v >= 50 ? 'bg-[#c45c26]' : 'bg-amber-400';
  return (
    <div className={`h-1.5 overflow-hidden bg-[#eee9e0] ${className}`}>
      <div className={`h-full transition-[width] duration-500 ${color}`} style={{ width: `${v}%` }} />
    </div>
  );
}

export function SectionLabel({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#8a847a]">{children}</p>
      {aside}
    </div>
  );
}

export function DetailGrid({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-[11px] uppercase tracking-[0.14em] text-[#8a847a]">{i.label}</dt>
          <dd className="mt-0.5 break-words text-sm text-[#14110e]">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

type CsvRow = Parameters<typeof downloadCsv>[1][number];

export function ExportButton({ filename, rows, label = 'Export CSV' }: { filename: string; rows: () => CsvRow[]; label?: string }) {
  return (
    <button
      type="button"
      className={btn.secondary}
      onClick={() => {
        const data = rows();
        if (data.length) downloadCsv(filename, data);
      }}
    >
      <Download className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

export function Pagination({
  page,
  pageCount,
  pageSize,
  total,
  start,
  setPage,
  noun = 'items',
}: ReturnType<typeof usePagination<unknown>> & { noun?: string }) {
  if (!total) return null;
  const end = Math.min(total, start + pageSize);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t border-[#eee9e0] px-4 py-3 text-xs text-[#6b655c]">
      <span>
        {start + 1}–{end} of {total} {noun}
      </span>
      {pageCount > 1 ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="flex h-8 w-8 items-center justify-center border border-[#ddd6ca] bg-white hover:border-[#14110e]/40 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 tabular-nums">
            {page} / {pageCount}
          </span>
          <button
            type="button"
            aria-label="Next page"
            disabled={page >= pageCount}
            onClick={() => setPage(page + 1)}
            className="flex h-8 w-8 items-center justify-center border border-[#ddd6ca] bg-white hover:border-[#14110e]/40 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </nav>
  );
}

type OverlayProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  headerExtra?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
};

function OverlayHeader({ title, subtitle, eyebrow, headerExtra, onClose }: Omit<OverlayProps, 'open' | 'children' | 'footer'>) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-[#eee9e0] px-5 py-4 md:px-6">
      <div className="min-w-0 flex-1">
        {eyebrow ? <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-[#8a847a]">{eyebrow}</p> : null}
        <h2 className="font-serif text-xl leading-tight tracking-tight text-[#14110e]">{title}</h2>
        {subtitle ? <div className="mt-1 text-sm text-[#6b655c]">{subtitle}</div> : null}
        {headerExtra}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="-mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center text-[#6b655c] transition-colors hover:bg-[#f6f4f0] hover:text-[#14110e]"
      >
        <X className="h-5 w-5" />
      </button>
    </header>
  );
}

export function Modal({ size = 'md', ...props }: OverlayProps & { size?: 'sm' | 'md' | 'lg' }) {
  const { open, onClose, footer, children } = props;
  const panelRef = useOverlay(open, onClose);
  const reduce = useReducedMotion();
  const width = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' }[size];

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-[#14110e]/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            className={`relative flex max-h-[92vh] w-full ${width} flex-col bg-white shadow-[0_30px_80px_-20px_rgba(20,17,14,0.45)] outline-none`}
            initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <OverlayHeader {...props} />
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6">{children}</div>
            {footer ? (
              <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[#eee9e0] bg-[#faf8f5] px-5 py-3.5 md:px-6">
                {footer}
              </footer>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

export function Drawer({ width = 'max-w-3xl', ...props }: OverlayProps & { width?: string }) {
  const { open, onClose, footer, children } = props;
  const panelRef = useOverlay(open, onClose);
  const reduce = useReducedMotion();

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div className="fixed inset-0 z-[70]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-[#14110e]/30" onClick={onClose} aria-hidden />
          <motion.aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            className={`absolute inset-y-0 right-0 flex w-full ${width} flex-col bg-[#f6f4f0] shadow-[-30px_0_80px_-30px_rgba(20,17,14,0.4)] outline-none`}
            initial={reduce ? false : { x: '100%' }}
            animate={{ x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: '100%' }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="bg-white">
              <OverlayHeader {...props} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6">{children}</div>
            {footer ? (
              <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[#eee9e0] bg-white px-5 py-3.5 md:px-6">
                {footer}
              </footer>
            ) : null}
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
