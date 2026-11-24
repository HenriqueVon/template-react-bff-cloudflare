import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// In development the browser talks to Vite only. /api goes to `wrangler pages dev` (npm run
// dev:functions), which runs the Pages Functions in functions/ the same way Cloudflare does.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8788',
        // Keep the browser's Host, so the Functions see the same origin as the page.
        changeOrigin: false,
      },
    },
  },
});
