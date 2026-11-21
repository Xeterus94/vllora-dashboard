// Run against the public output directory, never the private source tree.
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'parse5';

const folder = process.argv[2];
if (!folder)
  throw new Error('Utilizare: node build-manifest.mjs directorul-public');
const root = path.resolve(folder),
  manifestPath = path.join(root, '.well-known/vllora-content.json');
const old = await readFile(manifestPath, 'utf8')
  .then(JSON.parse)
  .catch((error) => {
    if (error.code !== 'ENOENT') throw error;
    return {};
  });
const walk = function* (node) {
  yield node;
  for (const child of node.childNodes ?? []) yield* walk(child);
};
async function* files(dir = '') {
  for (const entry of (
    await readdir(path.join(root, dir), { withFileTypes: true })
  ).sort((a, b) => a.name.localeCompare(b.name))) {
    if (
      entry.name.startsWith('.') ||
      (!dir && /^(admin|portal-admin|api)$/i.test(entry.name))
    )
      continue;
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) yield* files(relative);
    else if (
      entry.isFile() &&
      /\.html$/i.test(entry.name) &&
      !(!dir && /^404\.html$/i.test(entry.name))
    )
      yield relative;
  }
}
const pages = [];
for await (const file of files()) {
  const nodes = [...walk(parse(await readFile(path.join(root, file), 'utf8')))];
  const fields = new Map();
  const route =
    '/' +
    file
      .split('/')
      .map(encodeURIComponent)
      .join('/')
      .replace(/(^|\/)index\.html$/i, '$1');
  const title =
    nodes
      .find((node) => node.tagName === 'title')
      ?.childNodes.map((node) => node.value ?? '')
      .join('')
      .trim() || route;
  for (const node of nodes) {
    const attrs = new Map(node.attrs?.map(({ name, value }) => [name, value]));
    const type = ['text', 'image', 'background', 'number'].find((kind) =>
      attrs.has(`data-vllora-${kind}`),
    );
    if (!type) continue;
    const id = attrs.get(`data-vllora-${type}`),
      kind = type === 'background' ? 'image' : type;
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}$/.test(id))
      throw new Error(`${file}: identificator CMS invalid: ${id}`);
    if (kind === 'text' && node.childNodes.some((child) => child.tagName))
      throw new Error(
        `${file}: marchează un element text fără elemente copil: ${id}`,
      );
    if (type === 'image' && node.tagName !== 'img')
      throw new Error(`${file}: folosește data-vllora-image pe <img>: ${id}`);
    const value =
      kind === 'text'
        ? node.childNodes
            .map((child) => child.value ?? '')
            .join('')
            .trim()
        : type === 'image'
          ? (attrs.get('src') ?? '')
          : (attrs.get('data-vllora-value') ?? '');
    const field = {
      id,
      label: attrs.get('data-vllora-label') || id,
      kind,
      value,
    };
    if (
      field.label.length > 160 ||
      value.length > (kind === 'text' ? 6000 : kind === 'image' ? 2048 : 64)
    )
      throw new Error(
        `${file}: valoarea sau eticheta depășește limita pentru ${id}`,
      );
    if (
      kind === 'number' &&
      value &&
      (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value) ||
        !Number.isFinite(Number(value)))
    )
      throw new Error(`${file}: valoare numerică invalidă pentru ${id}`);
    const existing = fields.get(id);
    if (existing && (existing.kind !== kind || existing.value !== value))
      throw new Error(`${file}: valorile câmpului ${id} nu coincid`);
    fields.set(id, field);
  }
  if (route.length > 240 || title.length > 160)
    throw new Error(`${file}: calea sau titlul depășește limita CMS`);
  pages.push({ path: route, title, fields: [...fields.values()] });
}
const count = pages.reduce((total, page) => total + page.fields.length, 0);
const manifest =
  JSON.stringify({ version: 2, content: old.content ?? {}, pages }, null, 2) +
  '\n';
if (
  pages.length > 40 ||
  count > 800 ||
  Buffer.byteLength(JSON.stringify(pages)) > 320 * 1024 ||
  Buffer.byteLength(manifest) > 384 * 1024
)
  throw new Error(
    'Inventarul depășește limitele CMS: 40 pagini, 800 câmpuri și 384 KiB.',
  );
await mkdir(path.dirname(manifestPath), { recursive: true });
await writeFile(manifestPath, manifest);
console.log(`${pages.length} pagini, ${count} câmpuri → ${manifestPath}`);
