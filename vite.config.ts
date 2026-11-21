import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  build: { outDir: 'dist-portal' },
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    // Match the Worker in dev; the root is not the React dashboard.
    allowedHosts: [
      '.e2b.app',
      ...(process.env.DEV_TENANT_HOSTS || 'siteclient.com').split(','),
    ],
    proxy: {
      '^/(?:$|api(?:/|$)|admin(?:/|$)|portal-admin(?:/|$)|media/|track\\.js$)':
        {
          target: 'http://127.0.0.1:8787',
          changeOrigin: false,
        },
    },
  },
}));
