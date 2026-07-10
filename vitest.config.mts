import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    globals: true,
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
  },
});
