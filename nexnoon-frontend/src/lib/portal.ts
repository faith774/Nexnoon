import { ENV } from '@/config/env';

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** True when the app is served from the admin portal origin (e.g. admin.nexnoon.com or admin.localhost). */
export function isAdminPortalHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  const configured = ENV.ADMIN_PORTAL_URL ? hostnameOf(ENV.ADMIN_PORTAL_URL) : null;
  if (configured && configured === host) return true;
  return host.startsWith('admin.');
}

/** True when admin pages should be served from a different origin than the current one. */
export function adminPortalIsExternal(): boolean {
  return Boolean(ENV.ADMIN_PORTAL_URL) && !isAdminPortalHost();
}

/** Link to an admin portal path, absolute when the portal lives on another origin. */
export function adminPortalHref(path = '/admin/dashboard'): string {
  return adminPortalIsExternal() ? `${ENV.ADMIN_PORTAL_URL}${path}` : path;
}

/** Public site origin as seen from the admin portal: configured, or the current host without `admin.`. */
function publicSiteOrigin(): string {
  if (ENV.PUBLIC_SITE_URL) return ENV.PUBLIC_SITE_URL;
  const { protocol, hostname, port } = window.location;
  const publicHost = hostname.replace(/^admin\./, '');
  return `${protocol}//${publicHost}${port ? `:${port}` : ''}`;
}

/** Link to a public site path; absolute when called from the admin portal origin. */
export function publicSiteHref(path = '/'): string {
  if (isAdminPortalHost()) return `${publicSiteOrigin()}${path}`;
  return path;
}
