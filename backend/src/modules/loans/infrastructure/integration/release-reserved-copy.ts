import type { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service.js';

type Runtime = Pick<ReturnType<PrismaService['client']['runtime']>, 'query'>;

/** Barrera de inventario ya adquirida. No repara, habilita ni toca PRESTADO. */
export async function releaseReservedCopy(
  prisma: PrismaService,
  tx: Runtime,
  copyId: string,
) {
  const copy = (
    await tx.query(
      prisma.sql.public.ejemplares
        .update({ id: copyId })
        .where((r, f) => f.eq(r.id, copyId))
        .returning('id', 'recursoId', 'estado', 'condicionFisica', 'habilitado')
        .build(),
    )
  )[0];
  if (!copy || copy.estado !== 'RESERVADO') return;
  const resource = (
    await tx.query(
      prisma.sql.public.recursos
        .select('categoriaId', 'activo')
        .where((r, f) => f.eq(r.id, copy.recursoId))
        .limit(1)
        .build(),
    )
  )[0];
  const category = resource
    ? (
        await tx.query(
          prisma.sql.public.categorias_recurso
            .select('activo')
            .where((r, f) => f.eq(r.id, resource.categoriaId))
            .limit(1)
            .build(),
        )
      )[0]
    : null;
  const loans = await tx.query(
    prisma.sql.public.prestamos
      .select('id')
      .where((r, f) => f.eq(r.ejemplarId, copyId))
      .where((r, f) => f.eq(r.estado, 'ACTIVO'))
      .limit(1)
      .build(),
  );
  const reservations = await tx.query(
    prisma.sql.public.reservas
      .select('id')
      .where((r, f) => f.eq(r.ejemplarId, copyId))
      .where((r, f) => f.eq(r.estado, 'CONFIRMADA'))
      .limit(1)
      .build(),
  );
  const available =
    copy.condicionFisica === 'APTO' &&
    copy.habilitado === true &&
    resource?.activo === true &&
    category?.activo === true &&
    !loans.length &&
    !reservations.length;
  await tx.query(
    prisma.sql.public.ejemplares
      .update({ estado: available ? 'DISPONIBLE' : 'NO_DISPONIBLE' })
      .where((r, f) => f.eq(r.id, copyId))
      .where((r, f) => f.eq(r.estado, 'RESERVADO'))
      .build(),
  );
}
