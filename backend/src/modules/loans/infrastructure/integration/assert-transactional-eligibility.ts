import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service.js';
import {
  instantToDate,
  nullableInstantToDate,
} from '../../../../shared/infrastructure/prisma/instant-to-date.js';
import { isEffectiveActiveSanction } from '../../../rules/domain/entities/sanction-schedule.js';

type Runtime = Pick<ReturnType<PrismaService['client']['runtime']>, 'query'>;
/** Debe ejecutarse después del bloqueo del usuario, antes de reservar/recoger. */
export async function assertTransactionalEligibility(
  prisma: PrismaService,
  tx: Runtime,
  userId: string,
  at: Date,
) {
  const rows = await tx.query(
    prisma.sql.public.sanciones
      .select('estado', 'fechaInicio', 'fechaFin')
      .where((r, f) => f.eq(r.usuarioId, userId))
      .build(),
  );
  if (
    rows.some((r) =>
      isEffectiveActiveSanction(
        {
          status: r.estado,
          startsAt: instantToDate(r.fechaInicio),
          endsAt: nullableInstantToDate(r.fechaFin),
        },
        at,
      ),
    )
  )
    throw new ConflictException('El usuario tiene una sanción activa.');
}
