import { execFileSync } from 'node:child_process';
import { copyFile, cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dest = 'dist-portal/master';
process.chdir(root);
await rm(dest, { recursive: true, force: true });
await mkdir(`${dest}/assets`, { recursive: true });
execFileSync(
  process.execPath,
  [
    'node_modules/tailwind-legacy/lib/cli.js',
    '-c',
    'master/tailwind.config.cjs',
    '-i',
    'master/master.css',
    '-o',
    `${dest}/assets/master.css`,
    '--minify',
  ],
  { stdio: 'inherit' },
);
await Promise.all([
  copyFile('master/index.html', `${dest}/index.html`),
  copyFile('public/assets/vllora-logo.svg', `${dest}/assets/vllora-logo.svg`),
  copyFile('master/master.js', `${dest}/assets/master.js`),
  copyFile(
    'node_modules/chart.js/dist/chart.umd.js',
    `${dest}/assets/chart.js`,
  ),
  copyFile(
    'node_modules/chart.js/LICENSE.md',
    `${dest}/assets/chart-license.txt`,
  ),
  ...['inter', 'cinzel'].map(async (font) => {
    const source = `node_modules/@fontsource-variable/${font}`;
    const out = `${dest}/assets/${font}`;
    await mkdir(out, { recursive: true });
    await Promise.all([
      copyFile(`${source}/index.css`, `${out}/index.css`),
      copyFile(`${source}/LICENSE`, `${out}/license.txt`),
      cp(`${source}/files`, `${out}/files`, {
        recursive: true,
        filter: (path) =>
          !path.endsWith('.woff2') || path.endsWith('-wght-normal.woff2'),
      }),
    ]);
  }),
]);
