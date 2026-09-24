const COMMON_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'live.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'yahoo.co.uk',
  'googlemail.com',
  'msn.com',
];

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[a.length][b.length];
}

/** Suggests a corrected address for likely domain typos (gmial.com → gmail.com), or null. */
export function suggestEmail(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain.includes('.') || COMMON_EMAIL_DOMAINS.includes(domain)) return null;
  let best: { domain: string; distance: number } | null = null;
  for (const candidate of COMMON_EMAIL_DOMAINS) {
    const distance = editDistance(domain, candidate);
    if (distance <= 2 && (!best || distance < best.distance)) best = { domain: candidate, distance };
  }
  return best ? `${local}@${best.domain}` : null;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export type PasswordCheck = { id: string; label: string; met: boolean };

export function passwordChecks(password: string, email = '', name = ''): PasswordCheck[] {
  const lower = password.toLowerCase();
  const personal = [email.split('@')[0], ...name.split(/\s+/)]
    .map((s) => s.toLowerCase())
    .filter((s) => s.length >= 3);
  return [
    { id: 'length', label: 'At least 8 characters', met: password.length >= 8 },
    { id: 'case', label: 'Upper and lower case letters', met: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { id: 'number', label: 'A number or symbol', met: /[\d\W_]/.test(password) },
    {
      id: 'personal',
      label: "Doesn't contain your name or email",
      met: password.length > 0 && !personal.some((p) => lower.includes(p)),
    },
  ];
}

export function passwordStrength(checks: PasswordCheck[], password: string) {
  if (!password) return { score: 0, label: '' };
  let score = checks.filter((c) => c.met).length;
  if (password.length >= 14 && score >= 3) score = 4;
  if (!checks[0].met) score = Math.min(score, 1);
  const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
  return { score, label: labels[score] };
}

export function timeOfDayGreeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return 'Working late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const REMEMBERED_KEY = 'nexnoon:lastAccount';

export type RememberedAccount = { email: string; name?: string; avatar?: string };

export function getRememberedAccount(): RememberedAccount | null {
  try {
    const raw = localStorage.getItem(REMEMBERED_KEY);
    const parsed = raw ? (JSON.parse(raw) as RememberedAccount) : null;
    return parsed?.email ? parsed : null;
  } catch {
    return null;
  }
}

export function rememberAccount(account: RememberedAccount) {
  localStorage.setItem(REMEMBERED_KEY, JSON.stringify(account));
}

export function forgetRememberedAccount() {
  localStorage.removeItem(REMEMBERED_KEY);
}

export function initials(nameOrEmail: string): string {
  const base = nameOrEmail.includes('@') ? nameOrEmail.split('@')[0] : nameOrEmail;
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}
