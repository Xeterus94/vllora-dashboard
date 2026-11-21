import {
  pageFieldId,
  pageFieldLength,
  pageFieldLimit,
  pageLimit,
  publicPagePath,
  type ContentPage,
  type PageField,
} from '../shared/site-pages';
import { absolute } from './branding';
import { fail } from './core';

export const pagePayloadLimit = 320 * 1024;
export type StoredPages = (Omit<ContentPage, 'fields'> & {
  fields: (Omit<PageField, 'media'> & { media?: string })[];
})[];
const object = (input: unknown): Record<string, unknown> =>
  input && typeof input === 'object' && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
const bytes = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).length;

// Shared manifest and publish normalization. Remote manifests cannot name R2 objects.
export function normalizePages(input: unknown, source?: string): StoredPages {
  const invalid = (reason: string): null => {
    if (!source) fail(400, `Pagini CMS: ${reason}.`);
    return null;
  };
  const read = (value: unknown, limit: number) => {
    if (typeof value !== 'string') return null;
    return value.length <= limit ? value : null;
  };
  if (!Array.isArray(input) || input.length > pageLimit) {
    invalid(`sunt permise maximum ${pageLimit} pagini`);
    return [];
  }
  const pages: StoredPages = [];
  const paths = new Set<string>();
  let count = 0;
  for (const raw of input) {
    const row = object(raw),
      path = publicPagePath(row.path),
      title = read(row.title, 160)?.trim();
    if (!path || !title || paths.has(path) || !Array.isArray(row.fields)) {
      invalid('calea, titlul sau lista de câmpuri nu sunt valide');
      continue;
    }
    const fields: StoredPages[number]['fields'] = [],
      ids = new Set<string>();
    for (const rawField of row.fields) {
      if (count >= pageFieldLimit) {
        invalid(`sunt permise maximum ${pageFieldLimit} câmpuri`);
        break;
      }
      const { id, kind, label, value, media } = object(rawField);
      const name = read(label, 160)?.trim();
      if (
        typeof id !== 'string' ||
        !pageFieldId.test(id) ||
        ids.has(id) ||
        !name ||
        (kind !== 'text' && kind !== 'image' && kind !== 'number')
      ) {
        invalid(`câmp invalid în ${path}`);
        continue;
      }
      const rawValue =
        kind === 'number' && source && typeof value === 'number'
          ? String(value)
          : value;
      let clean = read(
        rawValue,
        kind === 'text' ? pageFieldLength : kind === 'image' ? 2048 : 64,
      );
      if (clean !== null && kind === 'image' && clean.trim()) {
        const url = absolute(
          clean,
          source ? new URL(path, source).href : 'https://invalid.invalid/',
        );
        if (
          !url ||
          url.length > 2048 ||
          (!source && !/^https:\/\//i.test(clean.trim()))
        )
          clean = null;
        else clean = url;
      }
      if (
        clean === null ||
        (kind === 'number' &&
          clean !== '' &&
          (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i.test(clean) ||
            !Number.isFinite(Number(clean))))
      ) {
        invalid(`valoare invalidă pentru „${name}”`);
        continue;
      }
      const file = !source && media != null ? object(media).id : undefined;
      if (
        !source &&
        media != null &&
        (kind !== 'image' ||
          typeof file !== 'string' ||
          !/^m_[a-f0-9]{24}$/.test(file))
      ) {
        invalid(`fișier invalid pentru „${name}”`);
        continue;
      }
      fields.push({
        id,
        kind,
        label: name,
        value: clean,
        ...(typeof file === 'string' ? { media: file } : {}),
      });
      ids.add(id);
      count++;
    }
    paths.add(path);
    pages.push({ path, title, fields });
  }
  if (bytes(pages) > pagePayloadLimit) {
    invalid('conținutul depășește limita totală');
    return [];
  }
  return pages;
}
