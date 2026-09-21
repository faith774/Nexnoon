/**
 * Slugify a string for use in URLs (lowercase, spaces to hyphens, remove special chars).
 */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'class';
}

/**
 * Build class detail URL: /class/:id or /class/:id/:titleSlug when title is provided.
 */
export function classDetailUrl(id: string, title?: string | null): string {
  if (title && title.trim()) {
    return `/class/${id}/${slugify(title)}`;
  }
  return `/class/${id}`;
}
