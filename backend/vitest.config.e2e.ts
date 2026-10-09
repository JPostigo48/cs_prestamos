import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    testTimeout: 20000,
    include: ['**/*.e2e-spec.ts'],
  },
});
