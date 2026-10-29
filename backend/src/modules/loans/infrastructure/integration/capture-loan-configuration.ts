import { ConflictException, NotFoundException } from '@nestjs/common';
import { Temporal } from 'temporal-polyfill/full';
import type { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service.js';
import { InventoryService } from '../../../inventory/application/use-cases/inventory.service.js';
import { PrismaInventoryRepository } from '../../../inventory/infrastructure/persistence/prisma/prisma-inventory.repository.js';

type Runtime = Pick<ReturnType<PrismaService['client']['runtime']>, 'query'>;

/** El ejemplar ya está bloqueado por create. Plantilla y categoría se leen tras
 * adquirir los mismos bloqueos de fila que sus editores, dentro de la misma tx. */
export async function captureLoanConfiguration(
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
      .returning('id', 'categoriaId')
      .build(),
  );
  if (!resources[0]) throw new NotFoundException('Recurso no encontrado.');
  const categories = await tx.query(
    prisma.sql.public.categorias_recurso
      .update({ updatedAt: Temporal.Now.instant() })
      .where((r, f) => f.eq(r.id, resources[0]!.categoriaId))
      .returning('id')
      .build(),
  );
  if (!categories[0]) throw new ConflictException('Categoría no encontrada.');
  const inventory = new InventoryService(
    new PrismaInventoryRepository(prisma).forTransaction(tx),
  );
  return inventory.getCopyLoanSnapshot(copyId);
}
