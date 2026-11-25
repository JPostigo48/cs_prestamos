import type { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service.js';
import { PrismaInventoryRepository } from '../../../inventory/infrastructure/persistence/prisma/prisma-inventory.repository.js';
import { categoryTrustAccess } from '../../../rules/domain/category-trust-access.js';

type Runtime = Pick<ReturnType<PrismaService['client']['runtime']>, 'query'>;

/** Usuario e inventario protegidos; leer SIEMPRE el saldo posterior a sync. */
export async function copyTrustAllowed(
  prisma: PrismaService,
  tx: Runtime,
  userId: string,
  copyId: string,
  categoryCache?: Map<string, boolean | null>,
) {
  const users = await tx.query(
    prisma.sql.public.usuarios
      .select('confianza')
      .where((r, f) => f.eq(r.id, userId))
      .limit(1)
      .build(),
  );
  const copies = await tx.query(
    prisma.sql.public.ejemplares
      .select('recursoId')
      .where((r, f) => f.eq(r.id, copyId))
      .limit(1)
      .build(),
  );
  const resources = copies[0]
    ? await tx.query(
        prisma.sql.public.recursos
          .select('categoriaId')
          .where((r, f) => f.eq(r.id, copies[0]!.recursoId))
          .limit(1)
          .build(),
      )
    : [];
  if (!users[0] || !resources[0]) return null;
  const categoryId = resources[0].categoriaId;
  // Solo vive durante una evaluación bajo locks de usuario/publicación.
  if (categoryCache?.has(categoryId)) return categoryCache.get(categoryId)!;
  const configuration = await new PrismaInventoryRepository(prisma)
    .forTransaction(tx)
    .getCategoryPolicies(categoryId);
  if (!configuration.eligibleForNewOperations) {
    categoryCache?.set(categoryId, null);
    return null;
  }
  let allowed: boolean | null;
  try {
    allowed = categoryTrustAccess(
      configuration.policies,
      categoryId,
      Number(users[0].confianza),
    );
  } catch (error) {
    // Indeterminado NO autoriza operaciones ni acredita una restricción para
    // cancelar destructivamente. Tampoco sustituye la política histórica no-show.
    if (!(error instanceof RangeError)) throw error;
    allowed = null;
  }
  categoryCache?.set(categoryId, allowed);
  return allowed;
}
