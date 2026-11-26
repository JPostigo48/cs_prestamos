import 'temporal-polyfill/full/global';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from '../contract.d.ts';
import contractJson from '../contract.json' with { type: 'json' };
import {
  CopyRepairError,
  nativeRepairDatabase,
  repairCopyConditions,
} from './repair-copy-conditions.seed.js';

export function repairOptions(args: readonly string[]) {
  const allowed = ['--apply', '--dry-run'];
  if (
    new Set(args).size !== args.length ||
    args.some((arg) => !allowed.includes(arg))
  )
    throw new CopyRepairError('Opciones: --dry-run (predeterminada), --apply.');
  if (args.includes('--apply') && args.includes('--dry-run'))
    throw new CopyRepairError('No mezcle --apply con --dry-run.');
  return { apply: args.includes('--apply') };
}

export async function runCopyRepair(
  args: readonly string[] = process.argv.slice(2),
  loadConfiguration: () => Promise<void> = async () => {
    const { config } = await import('dotenv');
    config({ quiet: true });
  },
) {
  const options = repairOptions(args);
  // Carga habitual desde cwd backend, solo tras validar; nunca seeds generales.
  await loadConfiguration();
  const url = process.env.DATABASE_URL;
  if (!url)
    throw new CopyRepairError(
      'Configure DATABASE_URL en la configuración habitual del backend o en el entorno autorizado.',
    );
  try {
    if (!['postgres:', 'postgresql:'].includes(new URL(url).protocol))
      throw new Error();
  } catch {
    throw new CopyRepairError(
      'DATABASE_URL debe ser PostgreSQL; no se ha conectado.',
    );
  }
  const client = postgres<Contract>({ contractJson, url });
  try {
    await client.connect();
    const result = await repairCopyConditions(
      nativeRepairDatabase(client),
      options,
    );
    console.info(JSON.stringify(result, null, 2));
    return result;
  } finally {
    await client.close();
  }
}
