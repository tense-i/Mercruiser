import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    exclude: ['.omx/**', 'node_modules/**'],
    alias: {
      '@': process.cwd(),
    },
  },
});
