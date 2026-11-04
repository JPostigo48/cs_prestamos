import { ConflictException, NotFoundException } from '@nestjs/common';
import { Temporal } from 'temporal-polyfill/full';
import type { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service.js';
import { InventoryService } from '../../../inventory/application/use-cases/inventory.service.js';
import { PrismaInventoryRepository } from '../../../inventory/infrastructure/persistence/prisma/prisma-inventory.repository.js';
import { reservationNoShowPolicy } from '../../../rules/domain/reservation-no-show-policy.js';

type Runtime = Pick<ReturnType<PrismaService['client']['runtime']>, 'query'>;

/** El ejemplar ya está bloqueado por create. Plantilla y categoría se leen tras
 * adquirir los mismos bloqueos de fila que sus editores, dentro de la misma tx. */
export async function captureLoanConfiguration(
  prisma: PrismaService,
  tx: Runtime,
  copyId: string,
) {
  const repository = await assertActiveInventory(prisma, tx, copyId);
  const copy = await repository.findCopyById(copyId);
  const resource = await repository.findResourceById(copy.recursoId);
  // Mantiene coherentes publicación y punteros vigentes hasta confirmar la
  // reserva. Lecturas concurrentes siguen permitidas; una edición devuelve 409.
  await tx.query(
    prisma.client.raw.sql`
      LOCK TABLE public.reglas_uso, public.versiones_regla,
        public.versiones_terminos IN SHARE MODE NOWAIT
    `
      .returnsRow({})
      .build(),
  );
  const configuration = await repository.getCategoryPolicies(
    resource.categoriaId,
  );
  if (!configuration.eligibleForNewOperations)
    throw new ConflictException(
      'La categoría no tiene una política oficial completa y vigente para nuevas operaciones.',
    );
  const noShow = reservationNoShowPolicy(configuration.policies);
  const snapshot = await new InventoryService(repository).getCopyLoanSnapshot(copyId);
  return {
    ...snapshot,
    reservationNoShow: {
      termsVersionId: configuration.termsVersionId!,
      ruleVersionId: noShow.id,
    },
  };
}

/** Recogida histórica: valida actividad, NO vuelve a calcular duración/política. */
export async function assertActiveInventory(
  prisma: PrismaService,
  tx: Runtime,
  copyId: string,
) {
  const copies = await tx.query(
    prisma.sql.public.ejemplares
      .select('recursoId')
      .where((r, f) => f.eq(r.id, copyId))
      .limit(1)
      .build(),
  );
  if (!copies[0]) throw new NotFoundException('Ejemplar no encontrado.');
  const resources = await tx.query(
    prisma.sql.public.recursos
      .update({ updatedAt: Temporal.Now.instant() })
      .where((r, f) => f.eq(r.id, copies[0]!.recursoId))
      .returning('id', 'categoriaId', 'activo')
      .build(),
  );
  if (!resources[0]) throw new NotFoundException('Recurso no encontrado.');
  if (!resources[0].activo)
    throw new ConflictException('El recurso está inactivo.');
  const categories = await tx.query(
    prisma.sql.public.categorias_recurso
      .update({ updatedAt: Temporal.Now.instant() })
      .where((r, f) => f.eq(r.id, resources[0]!.categoriaId))
      .returning('id', 'activo')
      .build(),
  );
  if (!categories[0]) throw new ConflictException('Categoría no encontrada.');
  if (!categories[0].activo)
    throw new ConflictException('La categoría está inactiva.');
  return new PrismaInventoryRepository(prisma).forTransaction(tx);
}
