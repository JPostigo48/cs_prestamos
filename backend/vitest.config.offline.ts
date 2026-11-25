import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.config.js';
import { fileURLToPath } from 'node:url';

export default mergeConfig(
  base,
  defineConfig({
    resolve: {
      alias: {
        'dotenv/config': fileURLToPath(
          new URL('./test/helpers/offline-environment.ts', import.meta.url),
        ),
      },
    },
    test: { setupFiles: ['./test/setup-offline.ts'] },
  }),
);
