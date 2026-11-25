import { Temporal } from 'temporal-polyfill/full';
import type { PrismaService } from '../../src/shared/infrastructure/prisma/prisma.service.js';
import { inMemoryPrisma } from './in-memory-prisma.js';
import { categoryPolicyFixture } from './category-policy-fixture.js';
import { LoanOverdueSynchronizer } from '../../src/modules/loans/infrastructure/loan-overdue-synchronizer.js';
import { PrismaReservationRepository } from '../../src/modules/loans/infrastructure/persistence/prisma/prisma-reservation.repository.js';

export const overdueNow = new Date('2026-11-10T12:00:00.000Z');
export const overdueDay = 86_400_000;
export const overdueInstant = (at: Date) =>
  Temporal.Instant.from(at.toISOString());

/** Solo datos sintéticos; no semillas, cliente nativo ni conexión. */
export function overdueFixture(type = 'DOCENTE') {
  const fixture = categoryPolicyFixture('category');
  const db = inMemoryPrisma({
    ...fixture,
    aceptaciones_terminos: [{ id: 'acceptance', usuarioId: 'user', versionTerminosId: fixture.versiones_terminos[0]!.id }],
    usuarios: [
      {
        id: 'user',
        confianza: '80.00',
        vinculacionVigente: true,
        tipoUsuario: type,
      },
    ],
    prestamos: [
      {
        id: 'loan',
        usuarioId: 'user',
        ejemplarId: 'loan-copy',
        estado: 'ACTIVO',
        reservaId: null,
        configurationSnapshot: {
          loanPolicy: {
            termsVersionId: fixture.versiones_terminos[0]!.id,
            categoryId: 'category',
          },
          policy: { categoryId: 'category' },
        },
      },
    ],
    reservas: [
      {
        id: 'reservation',
        usuarioId: 'user',
        ejemplarId: 'reserved-copy',
        estado: 'CONFIRMADA',
        fechaRecogida: null,
        fechaCancelacion: null,
        motivoCancelacion: null,
        duracionPrestamoHoras: 8,
        configurationSnapshot: { reservationNoShow: {
          termsVersionId: fixture.versiones_terminos[0]!.id,
          ruleVersionId: fixture.versiones_regla.find((r) => JSON.parse(r.descripcion).key === 'R-RES:LEVE')!.id,
        } },
      },
    ],
    ejemplares: [
      {
        id: 'loan-copy',
        recursoId: 'resource',
        estado: 'PRESTADO',
        condicionFisica: 'APTO',
        habilitado: true,
      },
      {
        id: 'reserved-copy',
        recursoId: 'resource',
        estado: 'RESERVADO',
        condicionFisica: 'APTO',
        habilitado: true,
      },
      {
        id: 'new-copy',
        recursoId: 'resource',
        estado: 'DISPONIBLE',
        condicionFisica: 'APTO',
        habilitado: true,
      },
    ],
    recursos: [{ id: 'resource', categoriaId: 'category', activo: true }],
    categorias_recurso: [{ id: 'category', activo: true }],
    configuracion_reservas: [
      { id: 1, pickupWaitMinutes: 30, weeklySchedule: null, version: 1 },
    ],
  });
  db.rows('versiones_terminos')[0]!.createdAt = overdueInstant(
    new Date('2026-01-01T00:00:00Z'),
  );
  db.rows('prestamos')[0]!.fechaInicio = overdueInstant(
    new Date(overdueNow.getTime() - 5 * overdueDay),
  );
  db.rows('prestamos')[0]!.fechaFin = overdueInstant(
    new Date(overdueNow.getTime() - 4 * overdueDay),
  );
  db.rows('reservas')[0]!.fechaSolicitada = overdueInstant(
    new Date(overdueNow.getTime() - 60_000),
  );
  db.rows('reservas')[0]!.fechaLimiteRecogida = overdueInstant(
    new Date(overdueNow.getTime() + 60_000),
  );
  db.rows('configuracion_reservas')[0]!.updatedAt = overdueInstant(overdueNow);
  const prisma = db as unknown as PrismaService;
  return {
    db,
    prisma,
    synchronizer: new LoanOverdueSynchronizer(prisma),
    reservations: new PrismaReservationRepository(prisma),
  };
}
