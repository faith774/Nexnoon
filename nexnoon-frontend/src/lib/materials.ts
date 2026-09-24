/** Helpers for class materials stored as string[] (URLs, titled links, or plain-text notes). */

export type MaterialKind = 'image' | 'pdf' | 'video' | 'office' | 'drive' | 'link' | 'note';

export type ParsedMaterial = {
  raw: string;
  kind: MaterialKind;
  title: string;
  /** Openable URL when kind is not note */
  url?: string;
  /** Best URL for in-app preview iframe/img (may differ from url) */
  previewUrl?: string;
  canPreview: boolean;
  canDownload: boolean;
  hostLabel?: string;
};

function tryUrl(value: string): URL | null {
  try {
    const u = new URL(value);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u;
    return null;
  } catch {
    return null;
  }
}

/** Supports "My slides | https://…" titled links from the add-link form. */
export function splitTitledLink(raw: string): { title?: string; href: string } | null {
  const pipe = raw.match(/^(.+?)\s\|\s(https?:\/\/\S+)$/i);
  if (pipe) return { title: pipe[1].trim(), href: pipe[2].trim() };
  const asUrl = tryUrl(raw.trim());
  if (asUrl) return { href: asUrl.href };
  return null;
}

export function fileNameFromUrl(url: string): string {
  try {
    const { pathname } = new URL(url);
    const name = decodeURIComponent(pathname.split('/').pop() || '');
    return name || url;
  } catch {
    return url;
  }
}

export function fileExt(name: string): string {
  const match = name.match(/\.([a-z0-9]+)(?:\?|$)/i);
  return match ? match[1].toLowerCase() : '';
}

function drivePreviewUrl(url: string): string | undefined {
  // /file/d/FILE_ID/
  const file = url.match(/\/file\/d\/([^/]+)/);
  if (file) return `https://drive.google.com/file/d/${file[1]}/preview`;

  // docs / spreadsheets / presentation
  const doc = url.match(/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([^/]+)/);
  if (doc) {
    const type = doc[1];
    const id = doc[2];
    if (type === 'document') return `https://docs.google.com/document/d/${id}/preview`;
    if (type === 'spreadsheets') return `https://docs.google.com/spreadsheets/d/${id}/preview`;
    if (type === 'presentation') return `https://docs.google.com/presentation/d/${id}/embed?start=false&loop=false`;
  }
  return undefined;
}

function officeEmbedUrl(url: string): string {
  return `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
}

export function parseMaterial(raw: string): ParsedMaterial {
  const trimmed = (raw || '').trim();
  const titled = splitTitledLink(trimmed);

  if (!titled) {
    return {
      raw,
      kind: 'note',
      title: trimmed || 'Note',
      canPreview: true,
      canDownload: false,
    };
  }

  const url = titled.href;
  const parsed = tryUrl(url)!;
  const host = parsed.hostname.replace(/^www\./, '');
  const name = titled.title || fileNameFromUrl(url);
  const ext = fileExt(name) || fileExt(parsed.pathname);

  const isDrive =
    host.includes('drive.google.com') ||
    host.includes('docs.google.com') ||
    host.includes('dropbox.com') ||
    host.includes('onedrive.live.com') ||
    host.includes('sharepoint.com');

  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
    return {
      raw,
      kind: 'image',
      title: name,
      url,
      previewUrl: url,
      canPreview: true,
      canDownload: true,
      hostLabel: host,
    };
  }

  if (ext === 'pdf' || parsed.pathname.toLowerCase().endsWith('.pdf')) {
    return {
      raw,
      kind: 'pdf',
      title: name,
      url,
      previewUrl: url,
      canPreview: true,
      canDownload: true,
      hostLabel: host,
    };
  }

  if (['mp4', 'mov', 'webm', 'm4v'].includes(ext)) {
    return {
      raw,
      kind: 'video',
      title: name,
      url,
      previewUrl: url,
      canPreview: true,
      canDownload: true,
      hostLabel: host,
    };
  }

  if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(ext)) {
    return {
      raw,
      kind: 'office',
      title: name,
      url,
      previewUrl: officeEmbedUrl(url),
      canPreview: true,
      canDownload: true,
      hostLabel: host,
    };
  }

  if (isDrive) {
    const preview = drivePreviewUrl(url);
    return {
      raw,
      kind: 'drive',
      title: titled.title || (host.includes('docs.google') ? 'Google Docs' : host.includes('drive.google') ? 'Google Drive' : host),
      url,
      previewUrl: preview,
      canPreview: !!preview,
      canDownload: false,
      hostLabel: host,
    };
  }

  return {
    raw,
    kind: 'link',
    title: titled.title || host,
    url,
    previewUrl: undefined,
    canPreview: false,
    canDownload: false,
    hostLabel: host,
  };
}

export function formatMaterialEntry(url: string, title?: string): string {
  const cleanUrl = url.trim();
  const cleanTitle = (title || '').trim();
  if (cleanTitle) return `${cleanTitle} | ${cleanUrl}`;
  return cleanUrl;
}

export function isValidMaterialUrl(value: string): boolean {
  return !!tryUrl(value.trim());
}

/** Cloudinary fl_attachment for download. */
export function downloadUrl(url: string): string {
  return url.includes('res.cloudinary.com/') ? url.replace('/upload/', '/upload/fl_attachment/') : url;
}
