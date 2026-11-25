import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service.js';
import { hasEffectiveUserRestriction } from '../../../rules/infrastructure/persistence/prisma/effective-user-restriction.js';

type Runtime = Pick<ReturnType<PrismaService['client']['runtime']>, 'query'>;
/** Debe ejecutarse después del bloqueo del usuario, antes de reservar/recoger. */
export async function assertTransactionalEligibility(
  prisma: PrismaService,
  tx: Runtime,
  userId: string,
  at: Date,
) {
  if (await hasEffectiveUserRestriction(prisma, tx, userId, at))
    throw new ConflictException('El usuario tiene una sanción activa.');
}
