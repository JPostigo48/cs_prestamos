import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { devNull } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// En Windows, mezclar d: y D: puede cargar dos instancias ESM de Vitest.
const cwd = realpathSync.native(fileURLToPath(new URL('../', import.meta.url)));
const result = spawnSync(
  process.execPath,
  [
    join(cwd, 'node_modules/vitest/vitest.mjs'),
    'run',
    'test/openapi-contract.spec.ts',
  ],
  {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, DOTENV_CONFIG_PATH: devNull },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
