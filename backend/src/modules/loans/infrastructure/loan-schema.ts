import type { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import {
  SchemaCapabilityUnavailableException,
  type SchemaCapabilityBundle,
  type SchemaCapabilityRuntime,
  type KnownSchemaCapabilities,
} from '../../../shared/infrastructure/prisma/schema-capabilities.js';

// Dependencies, not a deployment-wide migration switch. Only integral closure
// requires closure storage; overdue/reservations require episodes and release.
export const LOAN_OPERATION_SCHEMA = [
  'copyPhysicalState', 'loanEpisodes', 'loanClosure',
] as const satisfies readonly SchemaCapabilityBundle[];
export const SANCTION_OPERATION_SCHEMA = [
  'copyPhysicalState', 'loanEpisodes',
] as const satisfies readonly SchemaCapabilityBundle[];
export const APPEAL_OPERATION_SCHEMA = ['loanEpisodes'] as const;

export function requireLoanColumns(
  snapshot: KnownSchemaCapabilities,
  table: string,
  columns: readonly string[],
  operation: string,
): void {
  if (columns.some((name) => snapshot.capabilities[`column:${table}.${name}`] !== true))
    throw new SchemaCapabilityUnavailableException(operation, 'SCHEMA_INCOMPLETE');
}

export async function assertLoanSchema(
  prisma: PrismaService,
  bundles: readonly SchemaCapabilityBundle[],
  operation: string,
  runtime?: SchemaCapabilityRuntime,
): Promise<void> {
  for (const bundle of bundles)
    await prisma.schemaCapabilities.assert(bundle, operation, runtime);
}

/** SQLSTATE only; never inspect/log SQL, messages, connection URLs or values. */
export function loanFailureDiagnostic(error: unknown): string {
  const seen = new Set<object>();
  let sqlFailure = false;
  while (error && typeof error === 'object' && !seen.has(error)) {
    seen.add(error);
    if (error instanceof SchemaCapabilityUnavailableException) {
      const response = error.getResponse() as { diagnostic: unknown };
      return response.diagnostic === 'SCHEMA_INCOMPLETE' || response.diagnostic === 'SCHEMA_UNKNOWN'
        ? response.diagnostic : 'OPERATION_FAILURE';
    }
    const value = error as { code?: unknown; sqlState?: unknown; cause?: unknown };
    for (const code of [value.code, value.sqlState]) {
      if (code === '42P01' || code === '42703') return 'SCHEMA_OBJECT_UNAVAILABLE';
      if (code === '42501') return 'PERMISSION_DENIED';
      if (typeof code === 'string' &&
          (/^08[A-Z0-9]{3}$/.test(code) ||
           ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'].includes(code)))
        return 'CONNECTION_UNAVAILABLE';
      if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) sqlFailure = true;
    }
    error = value.cause;
  }
  return sqlFailure ? 'SQL_FAILURE' : 'OPERATION_FAILURE';
}

/** Never retry or fall back on writes. Catch only after transaction rollback. */
export async function loanSchemaTransaction<T>(
  prisma: PrismaService,
  bundles: readonly SchemaCapabilityBundle[],
  operation: string,
  work: (tx: SchemaCapabilityRuntime) => Promise<T>,
): Promise<T> {
  await assertLoanSchema(prisma, bundles, operation);
  try {
    return await prisma.client.transaction(async (tx) => {
      await assertLoanSchema(prisma, bundles, operation, tx);
      return work(tx);
    });
  } catch (error) {
    return prisma.schemaCapabilities.rethrowAfterRollback(error, bundles, operation);
  }
}
