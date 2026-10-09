import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    testTimeout: 20000,
    include: ['src/modules/inventory/**/*.integration.spec.ts', 'src/modules/users/**/*.integration.spec.ts'],
  },
});
