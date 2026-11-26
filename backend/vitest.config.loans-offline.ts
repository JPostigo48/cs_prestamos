import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/** Offline scope: no environment loader, database, installation or service. */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: { 'dotenv/config': fileURLToPath(new URL('./test/helpers/no-environment.ts', import.meta.url)) },
  },
  test: {
    globals: true,
    // Node 24 / Windows: avoid duplicate imported Vitest state in fork workers.
    pool: 'vmThreads',
    include: [
      'test/loans-schema-compatibility.offline.spec.ts',
      'test/schema-capabilities.offline.spec.ts',
      'test/loan-*.offline.spec.ts',
      'test/episode-calendar.offline.spec.ts',
      'test/sanction-cancellation.offline.spec.ts',
      'test/loans-contracts.spec.ts',
      'src/modules/loans/**/*.spec.ts',
      'src/modules/rules/**/*.spec.ts',
    ],
    exclude: ['**/*.integration.spec.ts', '**/*.e2e-spec.ts'],
  },
});
