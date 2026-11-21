import type { CmsFile } from './site-content';

export type PageField = {
  id: string;
  label: string;
  kind: 'text' | 'image' | 'number';
  value: string;
  media?: CmsFile;
};
export type ContentPage = { path: string; title: string; fields: PageField[] };
export const pageLimit = 40;
export const pageFieldLimit = 800;
export const pageFieldLength = 6000;
export const pageFieldId = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}$/;

// Only public paths on the configured host can be previewed. No admin paths,
// protocol-relative destinations, encoded path separators or traversal.
export function publicPagePath(value: unknown): string | null {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.length > 240 ||
    /[?#\\\s]/.test(value)
  )
    return null;
  try {
    const decoded = decodeURIComponent(value);
    if (
      !/^\/(?:[^/%?#\\]+\/)*[^/%?#\\]*$/.test(decoded) ||
      /[\u0000-\u001f\u007f]/.test(decoded) ||
      /(?:^|\/)\.{1,2}(?:\/|$)/.test(decoded) ||
      /%(?:2f|5c)/i.test(value) ||
      /^\/(?:admin|portal-admin|api|\.well-known)(?:\/|$)/i.test(decoded)
    )
      return null;
    return new URL(value, 'https://site.invalid').pathname;
  } catch {
    return null;
  }
}

export function mergePages(current: ContentPage[], imported: ContentPage[]) {
  const pages = new Map(current.map((page) => [page.path, page]));
  let remaining =
    pageFieldLimit - current.reduce((sum, page) => sum + page.fields.length, 0);
  for (const page of imported) {
    const existing = pages.get(page.path);
    if (!existing && (pages.size >= pageLimit || remaining <= 0)) continue;
    const ids = new Set(existing?.fields.map((field) => field.id));
    const fresh = page.fields
      .filter((field) => !ids.has(field.id))
      .slice(0, Math.max(0, remaining));
    remaining -= fresh.length;
    if (existing && !fresh.length) continue;
    pages.set(page.path, {
      ...(existing ?? page),
      fields: [...(existing?.fields ?? []), ...fresh],
    });
  }
  return [...pages.values()];
}
