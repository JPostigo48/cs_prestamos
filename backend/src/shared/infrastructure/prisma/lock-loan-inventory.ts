import { ConflictException } from '@nestjs/common';
import type { PrismaService } from './prisma.service.js';

type Runtime = Pick<ReturnType<PrismaService['client']['runtime']>, 'query'>;

/** Solo contención NOWAIT acreditada; los demás errores conservan su causa. */
export class LoanInventoryContentionException extends ConflictException {}

function isLockUnavailable(error: unknown): boolean {
  const seen = new Set<object>();
  while (error && typeof error === 'object' && !seen.has(error)) {
    seen.add(error);
    const value = error as { code?: unknown; cause?: unknown };
    if (value.code === '55P03') return true;
    error = value.cause;
  }
  return false;
}

/** Barrera global de escritores, ANTES de cualquier fila de circulación/inventario.
 * También protege escritores simples que usan ROW EXCLUSIVE implícito. NOWAIT
 * impide ciclos con editores externos que ya tienen filas/tablas bloqueadas.
 * Reentrante en una misma transacción. No elimina los chequeos de actividad.
 */
export async function lockLoanInventory(prisma: PrismaService, tx: Runtime) {
  try {
    await tx.query(
      prisma.client.raw.sql`
      LOCK TABLE public.categorias_recurso, public.recursos, public.ejemplares
      IN SHARE ROW EXCLUSIVE MODE NOWAIT
    `
        .returnsRow({})
        .build(),
    );
  } catch (error) {
    if (!isLockUnavailable(error)) throw error;
    throw new LoanInventoryContentionException(
      'El inventario está siendo modificado; reintente.',
      { cause: error },
    );
  }
  // Orden global de fases: inventario -> publicación -> filas. Nunca descubrir
  // contención de publicación después de escribir consecuencias del usuario.
  await lockPublishedLoanPolicy(prisma, tx);
}

/** SHARE bloquea INSERT/UPDATE/DELETE de publicación hasta confirmar la operación. */
export async function lockPublishedLoanPolicy(
  prisma: PrismaService,
  tx: Runtime,
) {
  try {
    await tx.query(
      prisma.client.raw.sql`
    LOCK TABLE public.reglas_uso, public.versiones_regla, public.versiones_terminos
    IN SHARE MODE NOWAIT
    `
        .returnsRow({})
        .build(),
    );
  } catch (error) {
    if (!isLockUnavailable(error)) throw error;
    throw new LoanInventoryContentionException(
      'La política está siendo publicada; reintente.',
      { cause: error },
    );
  }
}
