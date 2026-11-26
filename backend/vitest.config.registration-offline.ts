import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true, alias: {
    'dotenv/config': fileURLToPath(new URL('./test/helpers/no-environment.ts', import.meta.url)),
  } },
  test: {
    globals: true, pool: 'vmThreads',
    include: [
      'test/registration-*.offline.spec.ts', 'test/auth-contracts.spec.ts',
      'src/modules/auth/auth.spec.ts', 'src/modules/auth/registration-persistence.spec.ts',
      'src/modules/users/application/use-cases/registration-request.use-cases.spec.ts',
    ],
  },
});
