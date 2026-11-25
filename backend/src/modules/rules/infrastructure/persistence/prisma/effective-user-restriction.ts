import type { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service.js';
import {
  instantToDate,
  nullableInstantToDate,
} from '../../../../../shared/infrastructure/prisma/instant-to-date.js';
import { isEffectiveActiveSanction } from '../../../domain/entities/sanction-schedule.js';
import type { RulesTransaction } from './historical-loan-policy.reader.js';

export async function hasEffectiveUserRestriction(
  prisma: PrismaService,
  tx: RulesTransaction,
  userId: string,
  at: Date,
): Promise<boolean> {
  const rows = await tx.query(
    prisma.sql.public.sanciones
      .select('estado', 'fechaInicio', 'fechaFin')
      .where((r, f) => f.eq(r.usuarioId, userId))
      .build(),
  );
  return rows.some((r) =>
    isEffectiveActiveSanction(
      {
        status: r.estado,
        startsAt: instantToDate(r.fechaInicio),
        endsAt: nullableInstantToDate(r.fechaFin),
      },
      at,
    ),
  );
}
