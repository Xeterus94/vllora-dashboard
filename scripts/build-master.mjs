import { copyFile, mkdir, rm } from 'node:fs/promises';

const output = new URL('../dist/', import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await copyFile(
  new URL('../legacy/standalone-dashboard.html', import.meta.url),
  new URL('index.html', output),
);
console.log(
  'Panoul master original a fost copiat neschimbat în dist/index.html.',
);
