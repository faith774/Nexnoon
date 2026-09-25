import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Globe2, MapPin, Search, X } from 'lucide-react';
import { allTimeZones, browserTimeZone, tzAbbrev, tzLabel, useViewerTimeZone } from '@/lib/timezone';

/** Form field that opens the same searchable time-zone list as the dashboard switcher. */
export function TimeZoneSelect({
  value,
  onChange,
  className = '',
  id,
  ariaLabel = 'Time zone',
}: {
  value: string;
  onChange: (tz: string) => void;
  className?: string;
  id?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={btnRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${ariaLabel}, currently ${tzLabel(value)}`}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex w-full items-center justify-between gap-2 text-left ${className}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Globe2 className="h-4 w-4 shrink-0 text-[#c45c26]" />
          <span className="truncate">{tzLabel(value)}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[#8a847a] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && btnRef.current ? (
        <TimeZonePopover
          anchor={btnRef.current}
          value={value}
          onSelect={(next) => {
            onChange(next);
            setOpen(false);
            btnRef.current?.focus();
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

type ZoneRow = { tz: string; city: string; place: string; abbrev: string; time: string; offsetMin: number; search: string };

function offsetMinutes(abbrev: string) {
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(abbrev);
  if (!m) return abbrev === 'GMT' || abbrev === 'UTC' ? 0 : NaN;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0));
}

function buildRows(): ZoneRow[] {
  const now = new Date();
  return allTimeZones().map((tz) => {
    const parts = tz.split('/');
    const city = tz === 'UTC' ? 'UTC' : parts[parts.length - 1].replace(/_/g, ' ');
    const place = tz === 'UTC' ? 'Coordinated Universal Time' : parts.slice(0, -1).join(' / ').replace(/_/g, ' ');
    const abbrev = tzAbbrev(tz, now);
    const longOffset = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
      .formatToParts(now)
      .find((p) => p.type === 'timeZoneName')?.value;
    const time = now.toLocaleTimeString(undefined, { timeZone: tz, hour: 'numeric', minute: '2-digit' });
    return {
      tz,
      city,
      place,
      abbrev,
      time,
      offsetMin: offsetMinutes(longOffset || abbrev),
      search: `${tz} ${city} ${place} ${abbrev} ${longOffset || ''}`.toLowerCase().replace(/_/g, ' '),
    };
  });
}

const PANEL_W = 380;
const PANEL_H = 440;

/** Searchable, grouped time zone picker shown in a floating panel anchored to `anchor`. */
function TimeZonePopover({
  anchor,
  value,
  onSelect,
  onClose,
}: {
  anchor: HTMLElement;
  value: string;
  onSelect: (tz: string) => void;
  onClose: () => void;
}) {
  const listId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const rows = useMemo(buildRows, []);
  const device = browserTimeZone();

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (r: ZoneRow) => !q || q.split(/\s+/).every((w) => r.search.includes(w));
    const byTz = new Map(rows.map((r) => [r.tz, r]));
    const pinned = [...new Set([device, value, 'UTC'])].map((tz) => byTz.get(tz)).filter((r): r is ZoneRow => !!r && match(r));
    const pinnedSet = new Set(pinned.map((r) => r.tz));
    const groups = new Map<string, ZoneRow[]>();
    for (const r of rows) {
      if (pinnedSet.has(r.tz) || !match(r)) continue;
      const region = r.tz.includes('/') ? r.tz.split('/')[0] : 'Other';
      groups.set(region, [...(groups.get(region) || []), r]);
    }
    const out: { label: string; rows: ZoneRow[] }[] = [];
    if (pinned.length) out.push({ label: q ? 'Suggested' : 'Quick picks', rows: pinned });
    for (const [label, list] of groups) out.push({ label, rows: list });
    return out;
  }, [rows, query, device, value]);

  const flat = useMemo(() => sections.flatMap((s) => s.rows), [sections]);

  useEffect(() => setActive(0), [query]);

  useLayoutEffect(() => {
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(PANEL_W, vw - 16);
      const left = Math.max(8, Math.min(r.right - width, vw - width - 8));
      const below = vh - r.bottom - 12;
      const above = r.top - 12;
      const openUp = below < 280 && above > below;
      const maxHeight = Math.min(PANEL_H, openUp ? above : below);
      const top = openUp ? r.top - 8 - maxHeight : r.bottom + 8;
      setPos({ top, left, width, maxHeight });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor]);

  useEffect(() => {
    inputRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !anchor.contains(target)) onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [anchor, onClose]);

  useEffect(() => {
    const idx = query ? active : flat.findIndex((r) => r.tz === value);
    if (!query && idx >= 0) setActive(idx);
    // Only on open: jump to the current choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flat[active]) onSelect(flat[active].tz);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!pos) return null;
  let index = -1;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Choose a time zone"
      onKeyDown={onKeyDown}
      className="fixed z-[90] flex flex-col overflow-hidden border border-[#e4dfd6] bg-white text-[#14110e] shadow-[0_24px_60px_-20px_rgba(20,17,14,0.35)] animate-in fade-in-0 zoom-in-95 duration-150"
      style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
    >
      <div className="border-b border-[#eee9e0] bg-[#faf8f5] px-3 py-3">
        <div className="flex items-center justify-between gap-2 px-1 pb-2.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#8a847a]">Show times in</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-6 w-6 items-center justify-center text-[#8a847a] hover:bg-[#f0ebe3] hover:text-[#14110e]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <label className="flex items-center gap-2 border border-[#d5cfc4] bg-white px-2.5 focus-within:border-[#c45c26] focus-within:ring-2 focus-within:ring-[#c45c26]/15">
          <Search className="h-4 w-4 shrink-0 text-[#b5aea3]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search city, country or GMT+1"
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-activedescendant={flat[active] ? `${listId}-${active}` : undefined}
            className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#b5aea3]"
          />
          {query ? (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="text-[#b5aea3] hover:text-[#14110e]">
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </label>
      </div>

      <ul ref={listRef} id={listId} role="listbox" aria-label="Time zones" className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
        {sections.length ? (
          sections.map((section) => (
            <li key={section.label} role="presentation">
              <p className="sticky top-0 z-[1] bg-white/95 px-4 pb-1 pt-2.5 text-[10px] font-medium uppercase tracking-[0.18em] text-[#b5aea3] backdrop-blur-sm">
                {section.label}
              </p>
              <ul role="presentation">
                {section.rows.map((r) => {
                  index += 1;
                  const i = index;
                  const selected = r.tz === value;
                  const isActive = i === active;
                  return (
                    <li
                      key={r.tz}
                      id={`${listId}-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={selected}
                      onMouseMove={() => active !== i && setActive(i)}
                      onClick={() => onSelect(r.tz)}
                      className={`mx-1 flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors ${
                        isActive ? 'bg-[#f6f1ea]' : ''
                      } ${selected ? 'text-[#9a4518]' : ''}`}
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                        {selected ? (
                          <Check className="h-4 w-4 text-[#c45c26]" />
                        ) : r.tz === device ? (
                          <MapPin className="h-3.5 w-3.5 text-[#b5aea3]" />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-sm ${selected ? 'font-medium' : ''}`}>
                          {r.city}
                          {r.tz === device ? <span className="ml-1.5 text-[11px] font-normal text-[#8a847a]">· your device</span> : null}
                        </span>
                        <span className="block truncate text-[11px] text-[#8a847a]">{r.place}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-xs tabular-nums text-[#3d3933]">{r.time}</span>
                        <span className="block text-[10px] tabular-nums text-[#b5aea3]">{r.abbrev}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))
        ) : (
          <li className="px-4 py-10 text-center text-sm text-[#8a847a]">No time zone matches “{query}”.</li>
        )}
      </ul>

      <p className="border-t border-[#eee9e0] bg-[#faf8f5] px-4 py-2 text-[11px] text-[#8a847a]">
        {flat.length} zone{flat.length === 1 ? '' : 's'} · <kbd className="font-sans">↑</kbd> <kbd className="font-sans">↓</kbd> to move, Enter to pick
      </p>
    </div>,
    document.body
  );
}

/** "Times in Lagos (GMT+1)" button that opens a searchable time zone picker. */
export function ViewerTimeZoneSwitcher({ className = '', tone = 'light' }: { className?: string; tone?: 'light' | 'dark' }) {
  const [tz, setTz] = useViewerTimeZone();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dark = tone === 'dark';

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Show times in time zone, currently ${tzLabel(tz)}`}
        title="Change the time zone times are shown in"
        className={`inline-flex h-9 items-center gap-2 border px-3 text-xs transition-colors ${
          dark
            ? `border-white/20 text-white/80 hover:border-white/50 hover:text-white ${open ? 'border-white/50 text-white' : ''}`
            : `border-[#d5cfc4] bg-white text-[#6b655c] hover:border-[#14110e]/40 hover:text-[#14110e] ${open ? 'border-[#14110e]/40 text-[#14110e]' : ''}`
        } ${className}`}
      >
        <Globe2 className={`h-3.5 w-3.5 ${dark ? '' : 'text-[#c45c26]'}`} />
        <span className="whitespace-nowrap">
          <span className={dark ? 'text-white/50' : 'text-[#8a847a]'}>Times in </span>
          <span className="font-medium">{tzLabel(tz)}</span>
        </span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && btnRef.current ? (
        <TimeZonePopover
          anchor={btnRef.current}
          value={tz}
          onSelect={(next) => {
            setTz(next);
            setOpen(false);
            btnRef.current?.focus();
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
