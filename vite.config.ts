import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  build: { outDir: 'dist-portal' },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'webp-codec-notices',
      apply: 'build',
      async generateBundle() {
        const notices = await Promise.all(
          [
            '@jsquash/webp/LICENSE',
            '@jsquash/webp/codec/LICENSE.codec.md',
            'wasm-feature-detect/LICENSE',
          ].map(
            async (file) =>
              `${file}\n\n${await readFile(new URL(`./node_modules/${file}`, import.meta.url), 'utf8')}`,
          ),
        );
        this.emitFile({
          type: 'asset',
          fileName: 'assets/webp-licenses.txt',
          source: notices.join('\n\n'),
        });
      },
    },
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    // Match the Worker in dev; the root is not the React dashboard.
    allowedHosts: [
      '.e2b.app',
      ...(process.env.DEV_TENANT_HOSTS || 'siteclient.com').split(','),
    ],
    proxy: {
      '^/(?:$|api(?:/|$)|admin(?:/|$)|portal-admin(?:/|$)|master/assets/|media/|track\\.js$)':
        {
          target: 'http://127.0.0.1:8787',
          changeOrigin: false,
        },
    },
  },
}));
