import { realpathSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

/** Alcance offline focal: sin archivos de entorno ni bootstrap de aplicación. */
export default defineConfig({
  // Evita identidades duplicadas de módulos por mayúsculas de unidad en Windows.
  root: realpathSync.native('.'),
  envDir: false,
  test: {
    globals: true,
    pool: 'vmThreads',
    include: ['test/repair-copy-conditions.offline.spec.ts'],
  },
});
