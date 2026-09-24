import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

export const money = (amount: number, currency = 'USD') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: (currency || 'USD').toUpperCase() }).format(
    amount || 0
  );

export const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const fmtDateTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';

export function daysAgo(iso?: string | null) {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}

export function relativeDue(iso?: string | null) {
  if (!iso) return 'No due date';
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.round(Math.abs(diff) / 86400000);
  if (diff >= 0) return days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `Due in ${days} days`;
  return days === 0 ? 'Due earlier today' : days === 1 ? 'Closed yesterday' : `Closed ${days} days ago`;
}

export const initials = (name: string) =>
  (name || '?')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export const matches = (query: string, ...fields: (string | undefined | null)[]) =>
  !query.trim() || fields.join(' ').toLowerCase().includes(query.trim().toLowerCase());

/* ------------------------------------------------------------------ */
/* CSV export                                                          */
/* ------------------------------------------------------------------ */

type CsvValue = string | number | boolean | null | undefined | Date;

function csvCell(value: CsvValue) {
  if (value == null) return '';
  let s = value instanceof Date ? value.toISOString() : String(value);
  // Spreadsheet apps execute cells starting with these characters as formulas.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(filename: string, rows: Record<string, CsvValue>[]) {
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const body = [headers.map(csvCell).join(','), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(','))].join('\r\n');
  const blob = new Blob([`\ufeff${body}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportButton({
  filename,
  rows,
  label = 'Export CSV',
}: {
  filename: string;
  rows: () => Record<string, CsvValue>[];
  label?: string;
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 border border-[#d0dae6] bg-white px-3 py-2 text-sm text-[#0b1220] transition-colors hover:border-[#3a5f8a]/60"
      onClick={() => {
        const data = rows();
        if (data.length) downloadCsv(filename, data);
      }}
    >
      <Download className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Tones                                                               */
/* ------------------------------------------------------------------ */

export type Tone = 'green' | 'amber' | 'rose' | 'orange' | 'slate' | 'blue' | 'ink';

const toneClass: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
  amber: 'bg-amber-50 text-amber-900 ring-amber-200/80',
  rose: 'bg-rose-50 text-rose-800 ring-rose-200/80',
  orange: 'bg-orange-50 text-orange-900 ring-orange-200/80',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200/80',
  blue: 'bg-[#e8eef6] text-[#3a5f8a] ring-[#c9d6e6]',
  ink: 'bg-[#0b1220] text-white ring-[#0b1220]',
};

export function statusToneOf(status?: string): Tone {
  switch (status) {
    case 'approved':
    case 'published':
    case 'active':
    case 'completed':
      return 'green';
    case 'pending':
    case 'draft':
      return 'amber';
    case 'rejected':
    case 'failed':
      return 'rose';
    case 'suspended':
      return 'orange';
    default:
      return 'slate';
  }
}

export function scoreToneOf(score: number): Tone {
  if (score >= 80) return 'green';
  if (score >= 60) return 'amber';
  return 'rose';
}

export function Pill({ tone = 'slate', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ${toneClass[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons & inputs                                                    */
/* ------------------------------------------------------------------ */

export const btn = {
  primary:
    'inline-flex items-center justify-center gap-1.5 bg-[#0b1220] px-4 py-2 text-sm text-white transition-colors hover:bg-[#1a2438] disabled:opacity-50',
  secondary:
    'inline-flex items-center justify-center gap-1.5 border border-[#d0dae6] bg-white px-3.5 py-2 text-sm text-[#0b1220] transition-colors hover:border-[#3a5f8a]/60 disabled:opacity-50',
  danger:
    'inline-flex items-center justify-center gap-1.5 border border-rose-200 bg-white px-3.5 py-2 text-sm text-rose-800 transition-colors hover:bg-rose-50 disabled:opacity-50',
  link: 'inline-flex items-center gap-1 text-sm font-medium text-[#3a5f8a] hover:underline disabled:opacity-50',
};

export const inputCls =
  'w-full border border-[#d0dae6] bg-white px-3 py-2.5 text-sm outline-none transition-[border,box-shadow] focus:border-[#3a5f8a] focus:ring-2 focus:ring-[#889dd1]/25';

export function Field({
  label,
  hint,
  className = '',
  children,
}: {
  label: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[11px] uppercase tracking-[0.14em] text-[#6a7a8c]">{label}</span>
      {children}
      {hint ? <span className="text-xs text-[#7a8898]">{hint}</span> : null}
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Layout pieces                                                       */
/* ------------------------------------------------------------------ */

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
    <section className={`border border-[#d0dae6]/90 bg-white ${className}`}>
      {title ? (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4ebf2] px-5 py-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {icon ? (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#e8eef6] text-[#3a5f8a]">{icon}</span>
            ) : null}
            <div className="min-w-0">
              <h3 className="font-display text-lg tracking-tight text-[#0b1220]">{title}</h3>
              {subtitle ? <p className="text-xs text-[#6a7a8c]">{subtitle}</p> : null}
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
    <div className="border border-dashed border-[#d0dae6] bg-[#f7f9fc]/60 p-8 text-center">
      <p className="text-sm text-[#5c6b7a]">{text}</p>
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
            : 'border-[#d0dae6]/90'
      } ${onClick ? 'hover:border-[#3a5f8a]/60' : ''}`}
    >
      <p className="text-[11px] uppercase tracking-[0.14em] text-[#6a7a8c]">{label}</p>
      <p className="mt-1 font-display text-2xl tracking-tight text-[#0b1220]">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-[#7a8898]">{hint}</p> : null}
      {onClick ? (
        <ChevronRight className="absolute right-3 top-3.5 h-4 w-4 text-[#9aa7b5] transition-transform group-hover:translate-x-0.5" />
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
            className={`inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              active
                ? 'border-[#0b1220] bg-[#0b1220] text-white'
                : 'border-[#d0dae6] bg-white text-[#5c6b7a] hover:border-[#3a5f8a]/50'
            }`}
          >
            {o.label}
            {typeof o.count === 'number' ? (
              <span className={`text-[10px] ${active ? 'text-white/70' : 'text-[#9aa7b5]'}`}>{o.count}</span>
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
    <div role="tablist" className="flex gap-5 border-b border-[#e4ebf2]">
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={`-mb-px border-b-2 pb-2.5 text-sm transition-colors ${
              active ? 'border-[#0b1220] font-medium text-[#0b1220]' : 'border-transparent text-[#6a7a8c] hover:text-[#0b1220]'
            }`}
          >
            {t.label}
            {typeof t.count === 'number' ? <span className="ml-1.5 text-xs text-[#9aa7b5]">{t.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function Avatar({ name, src, size = 36, tone = 'blue' }: { name: string; src?: string; size?: number; tone?: Tone }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold ${toneClass[tone]} ring-0`}
      style={{ width: size, height: size, fontSize: Math.max(10, size / 3.2) }}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initials(name)}
    </span>
  );
}

export function ProgressBar({ value, tone, className = '' }: { value: number; tone?: string; className?: string }) {
  const v = Math.max(0, Math.min(100, value || 0));
  const color = tone || (v >= 80 ? 'bg-emerald-500' : v >= 40 ? 'bg-[#3a5f8a]' : 'bg-amber-400');
  return (
    <div className={`h-1.5 overflow-hidden bg-[#e8eef6] ${className}`}>
      <div className={`h-full transition-[width] duration-500 ${color}`} style={{ width: `${v}%` }} />
    </div>
  );
}

export function DetailGrid({ items, cols = 2 }: { items: { label: string; value: ReactNode }[]; cols?: 2 | 3 }) {
  return (
    <dl className={`grid gap-x-6 gap-y-3.5 sm:grid-cols-2 ${cols === 3 ? 'lg:grid-cols-3' : ''}`}>
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-[11px] uppercase tracking-[0.14em] text-[#7a8898]">{i.label}</dt>
          <dd className="mt-0.5 break-words text-sm text-[#0b1220]">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SectionLabel({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#6a7a8c]">{children}</p>
      {aside}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pagination                                                          */
/* ------------------------------------------------------------------ */

export const PAGE_SIZES = [10, 20, 50] as const;

/**
 * Client-side pagination. `resetKey` should change whenever the filtered set
 * changes meaning (search text, filter chip) so the view jumps back to page 1.
 */
export function usePagination<T>(items: T[], initialSize = 10, resetKey = '') {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialSize);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  const pageItems = useMemo(() => items.slice(start, start + pageSize), [items, start, pageSize]);

  return {
    page: current,
    pageCount,
    pageSize,
    total,
    start,
    pageItems,
    setPage,
    setPageSize: (n: number) => {
      setPageSizeState(n);
      setPage(1);
    },
  };
}

function pageList(current: number, count: number): (number | '…')[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const pages = new Set([1, count, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
}

export function Pagination({
  page,
  pageCount,
  pageSize,
  total,
  start,
  setPage,
  setPageSize,
  noun = 'items',
  className = '',
  sizes = PAGE_SIZES,
}: ReturnType<typeof usePagination<unknown>> & { noun?: string; className?: string; sizes?: readonly number[] }) {
  if (!total) return null;
  const end = Math.min(total, start + pageSize);
  return (
    <nav
      aria-label="Pagination"
      className={`flex flex-wrap items-center justify-between gap-3 border-t border-[#e4ebf2] px-4 py-3 text-xs text-[#5c6b7a] ${className}`}
    >
      <div className="flex items-center gap-3">
        <span>
          Showing <strong className="font-medium text-[#0b1220]">{start + 1}</strong>–
          <strong className="font-medium text-[#0b1220]">{end}</strong> of{' '}
          <strong className="font-medium text-[#0b1220]">{total}</strong> {noun}
        </span>
        {total > sizes[0] ? (
          <label className="flex items-center gap-1.5">
            <span className="sr-only">Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="border border-[#d0dae6] bg-white px-1.5 py-1 text-xs outline-none focus:border-[#3a5f8a]"
            >
              {sizes.map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      {pageCount > 1 ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="flex h-8 w-8 items-center justify-center border border-[#d0dae6] bg-white hover:border-[#3a5f8a]/60 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {pageList(page, pageCount).map((p, i) =>
            p === '…' ? (
              <span key={`gap-${i}`} className="px-1.5 text-[#9aa7b5]">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                aria-current={p === page ? 'page' : undefined}
                onClick={() => setPage(p)}
                className={`h-8 min-w-8 border px-2 text-xs transition-colors ${
                  p === page
                    ? 'border-[#0b1220] bg-[#0b1220] text-white'
                    : 'border-[#d0dae6] bg-white text-[#0b1220] hover:border-[#3a5f8a]/60'
                }`}
              >
                {p}
              </button>
            )
          )}
          <button
            type="button"
            aria-label="Next page"
            disabled={page >= pageCount}
            onClick={() => setPage(page + 1)}
            className="flex h-8 w-8 items-center justify-center border border-[#d0dae6] bg-white hover:border-[#3a5f8a]/60 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Overlays                                                            */
/* ------------------------------------------------------------------ */

/** Last non-null value, so overlay content stays rendered while it animates out. */
export function useSticky<T>(value: T | null | undefined): T | null {
  const [kept, setKept] = useState<T | null>(value ?? null);
  if (value != null && value !== kept) setKept(value);
  return value ?? kept;
}

const overlayStack: symbol[] = [];

export function useOverlay(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const id = Symbol('overlay');
    overlayStack.push(id);
    const previous = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && overlayStack[overlayStack.length - 1] === id) closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    requestAnimationFrame(() => panelRef.current?.focus());
    return () => {
      overlayStack.splice(overlayStack.indexOf(id), 1);
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open]);

  return panelRef;
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
    <header className="flex items-start justify-between gap-4 border-b border-[#e4ebf2] px-5 py-4 md:px-6">
      <div className="min-w-0">
        {eyebrow ? <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-[#6a7a8c]">{eyebrow}</p> : null}
        <h2 className="font-display text-xl leading-tight tracking-tight text-[#0b1220]">{title}</h2>
        {subtitle ? <div className="mt-1 text-sm text-[#5c6b7a]">{subtitle}</div> : null}
        {headerExtra}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="-mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center text-[#5c6b7a] transition-colors hover:bg-[#eef2f7] hover:text-[#0b1220]"
      >
        <X className="h-5 w-5" />
      </button>
    </header>
  );
}

export function Modal({ size = 'md', ...props }: OverlayProps & { size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const { open, onClose, footer, children } = props;
  const panelRef = useOverlay(open, onClose);
  const reduce = useReducedMotion();
  const width = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size];

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-[#0b1220]/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            className={`relative flex max-h-[92vh] w-full ${width} flex-col bg-white shadow-[0_30px_80px_-20px_rgba(11,18,32,0.45)] outline-none`}
            initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <OverlayHeader {...props} />
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6">{children}</div>
            {footer ? (
              <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e4ebf2] bg-[#f7f9fc] px-5 py-3.5 md:px-6">
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

export function Drawer({ width = 'max-w-2xl', ...props }: OverlayProps & { width?: string }) {
  const { open, onClose, footer, children } = props;
  const panelRef = useOverlay(open, onClose);
  const reduce = useReducedMotion();

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div className="fixed inset-0 z-[70]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-[#0b1220]/35" onClick={onClose} aria-hidden />
          <motion.aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            className={`absolute inset-y-0 right-0 flex w-full ${width} flex-col bg-[#f7f9fc] shadow-[-30px_0_80px_-30px_rgba(11,18,32,0.4)] outline-none`}
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
              <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e4ebf2] bg-white px-5 py-3.5 md:px-6">
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
