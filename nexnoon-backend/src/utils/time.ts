export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** First valid zone from the candidates (recipient's profile, class, …), else UTC. */
export function pickTimeZone(...candidates: (string | null | undefined)[]): string {
  return candidates.find(isValidTimeZone) || 'UTC';
}

/** "Mon, Sep 28, 2026, 10:08 PM GMT+1" in the given zone; always states the zone. */
export function formatWhen(date: Date | string, timeZone: string) {
  return new Date(date).toLocaleString('en-US', {
    timeZone: pickTimeZone(timeZone),
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}
