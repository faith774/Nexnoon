import { useMemo } from 'react';
import { Globe2 } from 'lucide-react';
import { allTimeZones, browserTimeZone, tzAbbrev, tzLabel, useViewerTimeZone } from '@/lib/timezone';

function useZoneGroups() {
  return useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const tz of allTimeZones()) {
      const region = tz.includes('/') ? tz.split('/')[0] : 'Other';
      groups.set(region, [...(groups.get(region) || []), tz]);
    }
    return [...groups.entries()];
  }, []);
}

const optionLabel = (tz: string) => `${tz.replace(/_/g, ' ')} (${tzAbbrev(tz)})`;

/** Full list of IANA zones grouped by region, with the device zone pinned first. */
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
  const groups = useZoneGroups();
  const device = browserTimeZone();
  return (
    <select id={id} aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} className={className}>
      <option value={device}>Your device: {optionLabel(device)}</option>
      {groups.map(([region, zones]) => (
        <optgroup key={region} label={region}>
          {zones.map((tz) => (
            <option key={tz} value={tz}>
              {optionLabel(tz)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/** "Times in Lagos (GMT+1)" with an invisible select on top, so anyone can switch the zone times are shown in. */
export function ViewerTimeZoneSwitcher({ className = '', tone = 'light' }: { className?: string; tone?: 'light' | 'dark' }) {
  const [tz, setTz] = useViewerTimeZone();
  return (
    <label
      className={`relative inline-flex cursor-pointer items-center gap-1.5 text-xs ${
        tone === 'dark' ? 'text-white/70 hover:text-white' : 'text-[#6b655c] hover:text-[#14110e]'
      } ${className}`}
      title="Change the time zone times are shown in"
    >
      <Globe2 className="h-3.5 w-3.5" />
      <span>
        Times in <span className="underline decoration-dotted underline-offset-2">{tzLabel(tz)}</span>
      </span>
      <TimeZoneSelect value={tz} onChange={setTz} className="absolute inset-0 cursor-pointer opacity-0" ariaLabel="Show times in time zone" />
    </label>
  );
}
