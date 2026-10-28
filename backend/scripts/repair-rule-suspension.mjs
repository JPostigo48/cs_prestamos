import { readFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const repairFile = new URL('./repair-rule-suspension.sql', import.meta.url);

export function authorizeRepair(args, databaseUrl) {
  if (
    !args.includes('--apply') ||
    args.some((arg) => !['--apply', '--authorize-neon'].includes(arg))
  ) {
    throw new Error('Requiere autorización previa y --apply; --print sólo muestra SQL offline.');
  }
  if (!databaseUrl) throw new Error('Se requiere DATABASE_URL ya provista al proceso.');
  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error('Conexión PostgreSQL inválida; no se muestra su contenido.');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('Se requiere PostgreSQL.');
  }
  if (/(^|\.)neon\.tech$/i.test(url.hostname) && !args.includes('--authorize-neon')) {
    throw new Error('Neon requiere autorización previa y --authorize-neon.');
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--print') {
    console.info(await readFile(repairFile, 'utf8'));
    return;
  }
  // No carga secretos, configuración Prisma ni cliente hasta autorizar.
  authorizeRepair(args, process.env.DATABASE_URL);
  const sql = await readFile(repairFile, 'utf8');
  const { default: pg } = await import('pg');
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 12000,
  });
  try {
    await client.connect();
    await client.query(sql);
    console.info('Reparación parcial completada: dos columnas y CHECK. Historial Prisma intacto.');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      console.error('No se pudo confirmar ROLLBACK; verificar conexión antes de reintentar.');
    }
    const code = /^[A-Z0-9]{5}$/.test(error?.code ?? '') ? error.code : 'CONTROLLED_FAILURE';
    throw new Error(`Reparación no confirmada (${code}); no se muestra el error del driver.`);
  } finally {
    await client.end();
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    // Sólo errores controlados; nunca imprimir mensajes, stacks o URLs del driver.
    console.error(error.message.startsWith('Reparación no confirmada') ||
      /^(Requiere|Se requiere|Conexión PostgreSQL|Neon requiere)/.test(error.message)
      ? error.message : 'No se pudo completar la reparación; detalles del driver omitidos.');
    process.exitCode = 1;
  });
}
