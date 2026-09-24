/** Helpers for class preview media in the enroll card (not the hero). */

export type PreviewMedia =
  | { kind: 'youtube'; id: string }
  | { kind: 'vimeo'; id: string }
  | { kind: 'file'; url: string };

export function resolvePreviewMedia(url?: string | null): PreviewMedia | null {
  if (!url?.trim()) return null;
  const value = url.trim();

  const yt = value.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/i);
  if (yt) return { kind: 'youtube', id: yt[1] };

  const vimeo = value.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeo) return { kind: 'vimeo', id: vimeo[1] };

  if (/^https:\/\//i.test(value)) return { kind: 'file', url: value };
  return null;
}
