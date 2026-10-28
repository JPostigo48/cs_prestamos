import 'temporal-polyfill/full/global';
import { readFile } from 'node:fs/promises';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from '../contract.d.ts';
import contractJson from '../contract.json' with { type: 'json' };
import { RulesSeedError, seedRules } from './rules.seed.js';

export function authorizeRulesSeed(
  args: readonly string[],
  databaseUrl: string | undefined,
): string {
  if (!args.includes('--apply'))
    throw new RulesSeedError(
      'Sin ejecución: requiere --apply y autorización previa del responsable de la base de datos.',
    );
  if (!databaseUrl)
    throw new RulesSeedError(
      'Proporcione DATABASE_URL explícitamente en el entorno autorizado; este comando no carga archivos de secretos.',
    );
  const url = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(url.protocol))
    throw new RulesSeedError('Se requiere PostgreSQL.');
  if (
    /(^|\.)neon\.tech$/i.test(url.hostname) &&
    !args.includes('--authorize-neon')
  ) {
    throw new RulesSeedError(
      'Neon requiere autorización explícita previa y --authorize-neon. No se ha conectado.',
    );
  }
  return databaseUrl;
}

export async function runRulesSeed() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  if (dryRun && (args.includes('--apply') || args.includes('--authorize-neon')))
    throw new RulesSeedError('No mezclar --dry-run con opciones de escritura.');
  const url = dryRun
    ? process.env.DATABASE_URL
    : authorizeRulesSeed(args, process.env.DATABASE_URL);
  if (!url)
    throw new RulesSeedError(
      'Se requiere DATABASE_URL ya provista al proceso. No se cargan archivos de secretos.',
    );
  if (!['postgres:', 'postgresql:'].includes(new URL(url).protocol))
    throw new RulesSeedError('Se requiere PostgreSQL.');
  const termsContent = await readFile(
    new URL(
      '../../../docs/requirements/terms-and-conditions.md',
      import.meta.url,
    ),
    'utf8',
  );
  const client = postgres<Contract>({ contractJson, url });
  try {
    await client.connect();
    const result = await seedRules(client, termsContent, { dryRun });
    console.info(
      dryRun
        ? 'Solo lectura: faltantes que se crearían (sin escrituras):'
        : 'Seed oficial de reglas completado:',
      result,
    );
    return result;
  } finally {
    await client.close();
  }
}
