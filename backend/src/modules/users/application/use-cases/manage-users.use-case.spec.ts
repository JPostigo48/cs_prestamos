import {
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { inMemoryPrisma } from '../../../../../test/helpers/in-memory-prisma.js';
import { PrismaUserRepository } from '../../infrastructure/persistence/prisma/prisma-user.repository.js';
import { ManageUsersUseCase } from './manage-users.use-case.js';

const userId = '123e4567-e89b-42d3-a456-426614174001';
const actor = { accountId: 'admin-account', userId: 'admin-user' };
const original = {
  id: userId,
  nombre: 'Ada Lovelace',
  tipoUsuario: 'ESTUDIANTE',
  identificadorInstitucional: 'A-1',
  vinculacionVigente: true,
  confianza: '75.00',
};
const setup = (extra = {}) => {
  const db = inMemoryPrisma({ usuarios: [original], ...extra });
  const repository = new PrismaUserRepository(db as any);
  return { db, repository, service: new ManageUsersUseCase(repository) };
};

describe('Managed users without database', () => {
  it('does not equate a disabled access account with an inactive domain user', async () => {
    const { repository } = setup({
      cuentas_acceso: [{ usuarioId: userId, habilitada: false }],
    });
    expect(await repository.getLoanEligibility(userId)).toMatchObject({
      enabled: true,
      hasCurrentAffiliation: true,
    });
  });

  it('creates, consults, lists, edits and logically deactivates without touching accounts or history', async () => {
    const history = {
      id: 'historic-loan',
      usuarioId: userId,
      estado: 'FINALIZADO',
    };
    const account = { id: 'account', usuarioId: userId, habilitada: true };
    const { service, repository, db } = setup({
      prestamos: [history],
      cuentas_acceso: [account],
      solicitudes_registro: [
        { id: 'approved', usuarioAprobadoId: userId, estado: 'APROBADA' },
      ],
    });
    const created = await service.create(
      { name: ' Grace Hopper ', userType: 'DOCENTE', institutionalId: ' G-1 ' },
      actor,
    );
    expect(created).toMatchObject({
      name: 'Grace Hopper',
      trustPercentage: 75,
      institutionalId: 'G-1',
    });
    expect((await repository.list({ page: 1, limit: 20 })).total).toBe(2);
    expect(await repository.findById(created.id)).toEqual(created);
    await service.update(
      userId,
      { name: 'Ada Byron', institutionalId: null },
      actor,
    );
    expect(await service.deactivate(userId, actor)).toMatchObject({
      name: 'Ada Byron',
      hasCurrentAffiliation: false,
      trustPercentage: 75,
    });
    expect(await repository.getLoanEligibility(userId)).toMatchObject({
      enabled: false,
      reasons: ['VINCULACION_NO_VIGENTE'],
    });
    expect(db.rows('prestamos')).toEqual([history]);
    expect(db.rows('cuentas_acceso')).toEqual([account]);
    expect(db.rows('solicitudes_registro')[0].usuarioAprobadoId).toBe(userId);
    expect(
      JSON.parse(db.rows('auditorias_usuario').at(-1)!.datosNuevos).actor,
    ).toEqual(actor);
    expect(
      JSON.parse(db.rows('auditorias_usuario').at(-1)!.datosAnteriores)
        .hasCurrentAffiliation,
    ).toBe(true);
    await service.update(userId, { hasCurrentAffiliation: true }, actor);
    expect(await repository.getLoanEligibility(userId)).toMatchObject({
      enabled: true,
    });
    expect(db.calls.some((call) => call.operation === 'delete')).toBe(false);
  });

  it.each(['ACTIVO', 'PLANIFICADO', 'CONFIRMADA'])(
    'rejects deactivation and affiliation changes with open %s',
    async (state) => {
      const table = state === 'CONFIRMADA' ? 'reservas' : 'prestamos';
      const { service, db } = setup({
        [table]: [{ id: 'open', usuarioId: userId, estado: state }],
      });
      await expect(service.deactivate(userId, actor)).rejects.toThrow(
        ConflictException,
      );
      await expect(
        service.update(userId, { hasCurrentAffiliation: false }, actor),
      ).rejects.toThrow(ConflictException);
      expect(db.rows('usuarios')[0].vinculacionVigente).toBe(true);
      expect(db.rows('auditorias_usuario')).toHaveLength(0);
    },
  );

  it('preserves approval workflow, rejects duplicates and missing/invalid users', async () => {
    const { service } = setup({
      solicitudes_registro: [
        {
          id: 'pending',
          identificadorInstitucional: 'P-1',
          estado: 'PENDIENTE',
        },
      ],
    });
    await expect(
      service.create(
        {
          name: 'Pending User',
          userType: 'ESTUDIANTE',
          institutionalId: 'P-1',
        },
        actor,
      ),
    ).rejects.toThrow(ConflictException);
    await expect(
      service.update(userId, { institutionalId: 'P-1' }, actor),
    ).rejects.toThrow(ConflictException);
    await expect(
      service.create(
        { name: 'Duplicate', userType: 'DOCENTE', institutionalId: 'A-1' },
        actor,
      ),
    ).rejects.toThrow(ConflictException);
    await expect(
      service.update('missing', { name: 'Missing' }, actor),
    ).rejects.toThrow(NotFoundException);
    expect(() => service.update(userId, {}, actor)).toThrow(
      BadRequestException,
    );
    expect(() =>
      service.create({ name: ' ', userType: 'ESTUDIANTE' }, actor),
    ).toThrow(BadRequestException);
  });

  it('rolls back both creation and edition if audit fails', async () => {
    const { service, db } = setup();
    db.failAudit();
    await expect(
      service.create({ name: 'Grace Hopper', userType: 'DOCENTE' }, actor),
    ).rejects.toThrow('audit unavailable');
    await expect(
      service.update(userId, { name: 'Changed' }, actor),
    ).rejects.toThrow('audit unavailable');
    expect(db.rows('usuarios')).toEqual([original]);
  });
});
