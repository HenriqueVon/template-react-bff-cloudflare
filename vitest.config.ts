import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // The logic and the Functions run in node. A component test opts into the DOM with a `@vitest-environment jsdom`
    // comment at the top of its file, so the other tests stay fast.
    environment: 'node',
    include: ['tests/**/*.spec.ts', 'src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    setupFiles: ['./tests/setup-dom.ts'],
    clearMocks: true,
  },
});
