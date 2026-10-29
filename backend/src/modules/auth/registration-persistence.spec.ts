import { describe, expect, it, vi } from 'vitest';
import { inMemoryPrisma } from '../../../test/helpers/in-memory-prisma.js';
import { PrismaRegistrationRequestRepository } from '../users/infrastructure/persistence/prisma/prisma-registration-request.repository.js';
import { PrismaAccessAccountRepository } from './infrastructure/persistence/prisma/prisma-access-account.repository.js';
import { UserType } from '../users/domain/entities/registration-request.js';
import { AccessRole } from './domain/entities/access-account.js';
import {
  FullRegistrationUseCase,
  isRegistrationImage,
} from './application/use-cases/full-registration.use-case.js';

vi.mock('dotenv/config', () => ({}));
const actor = { userId: 'admin-user', accountId: 'admin-account' };
const access = {
  email: 'new@unsa.edu.pe',
  passwordHash: 'argon2-test-double',
  termsVersionId: 'terms',
  acceptedAt: new Date(),
};
const data = {
  name: 'Usuario de prueba',
  userType: UserType.ESTUDIANTE,
  institutionalId: 'ISOLATED-1',
  evidence: ['image-fixture'],
  access,
};
const initial = () => ({ versiones_terminos: [{ id: 'terms', numero: 1 }] });

describe('Registration and account SQL repositories, transactional in-memory harness (NOT PostgreSQL)', () => {
  it('creates request/evidence/audit together; approval creates account USER and original acceptance once', async () => {
    const db = inMemoryPrisma(initial());
    const repo = new PrismaRegistrationRequestRepository(db as any);
    const pending = await repo.create(data);
    expect(pending.status).toBe('PENDIENTE');
    expect(JSON.stringify(pending)).not.toContain(access.passwordHash);
    expect(db.rows('cuentas_acceso')).toHaveLength(0);
    expect(db.rows('usuarios')).toHaveLength(0);
    const result = await repo.approveAndCreateUser(pending.id, actor);
    expect(result.request.status).toBe('APROBADA');
    expect(db.rows('usuarios')[0].confianza).toBe('75.00');
    expect(db.rows('cuentas_acceso')).toEqual([
      expect.objectContaining({
        usuarioId: result.user.id,
        email: access.email,
        passwordHash: access.passwordHash,
        rol: 'USUARIO',
        habilitada: true,
      }),
    ]);
    expect(db.rows('solicitudes_registro')[0].passwordHash).toBeNull();
    expect(db.rows('aceptaciones_terminos')[0].fecha.epochMilliseconds).toBe(
      access.acceptedAt.getTime(),
    );
    expect(db.rows('auditorias_usuario').at(-1)!.datosNuevos).toContain(
      actor.accountId,
    );
    await expect(repo.approveAndCreateUser(pending.id, actor)).rejects.toThrow(
      'no pendiente',
    );
    expect(db.rows('usuarios')).toHaveLength(1);
  });
  it('rolls back request and evidence when its audit fails', async () => {
    const db = inMemoryPrisma(initial());
    db.failAudit();
    await expect(
      new PrismaRegistrationRequestRepository(db as any).create(data),
    ).rejects.toThrow('audit unavailable');
    expect(db.rows('solicitudes_registro')).toHaveLength(0);
    expect(db.rows('evidencias_vinculacion')).toHaveLength(0);
  });
  it('rolls back approval/user/account/acceptance when its audit fails', async () => {
    const db = inMemoryPrisma(initial());
    const repo = new PrismaRegistrationRequestRepository(db as any);
    const pending = await repo.create(data);
    db.failAudit();
    await expect(repo.approveAndCreateUser(pending.id, actor)).rejects.toThrow(
      'audit unavailable',
    );
    for (const table of ['usuarios', 'cuentas_acceso', 'aceptaciones_terminos'])
      expect(db.rows(table)).toHaveLength(0);
    expect(db.rows('solicitudes_registro')[0]).toMatchObject({
      estado: 'PENDIENTE',
      passwordHash: access.passwordHash,
    });
  });
  it('rejects stale terms, existing accounts and duplicate pending submissions', async () => {
    const db = inMemoryPrisma(initial());
    const repo = new PrismaRegistrationRequestRepository(db as any);
    await expect(
      repo.create({ ...data, access: { ...access, termsVersionId: 'old' } }),
    ).rejects.toThrow('términos cambiaron');
    await repo.create(data);
    await expect(
      repo.create({ ...data, institutionalId: 'OTHER' }),
    ).rejects.toThrow('solicitud pendiente');
    const occupied = inMemoryPrisma({
      ...initial(),
      cuentas_acceso: [{ id: 'old-account', email: access.email }],
    });
    await expect(
      new PrismaRegistrationRequestRepository(occupied as any).create(data),
    ).rejects.toThrow('ya tiene una cuenta');
  });
  it('keeps legacy basic approval separate from access provisioning', async () => {
    const db = inMemoryPrisma(initial());
    const repo = new PrismaRegistrationRequestRepository(db as any);
    const { access: _, ...basic } = data;
    const pending = await repo.create(basic);
    await repo.approveAndCreateUser(pending.id, actor);
    expect(db.rows('cuentas_acceso')).toHaveLength(0);
  });
  it('rejects atomically, erases pending hash and refuses approval after rejection', async () => {
    const db = inMemoryPrisma(initial());
    const repo = new PrismaRegistrationRequestRepository(db as any);
    const pending = await repo.create(data);
    await repo.updateStatus(
      pending.id,
      'RECHAZADA',
      'Evidencia ilegible',
      undefined,
      actor,
    );
    expect(db.rows('solicitudes_registro')[0]).toMatchObject({
      estado: 'RECHAZADA',
      passwordHash: null,
    });
    expect(
      JSON.parse(db.rows('auditorias_usuario').at(-1)!.datosNuevos),
    ).toMatchObject({ actor });
    await expect(repo.approveAndCreateUser(pending.id, actor)).rejects.toThrow(
      'no pendiente',
    );
    expect(db.rows('cuentas_acceso')).toHaveLength(0);
  });
  it('updates role/access and audit atomically, including actor and before/after', async () => {
    const row = {
      id: 'account',
      usuarioId: 'user',
      email: access.email,
      passwordHash: access.passwordHash,
      rol: AccessRole.USER,
      habilitada: true,
      ultimoAcceso: null,
    };
    const db = inMemoryPrisma({ cuentas_acceso: [row] });
    const repo = new PrismaAccessAccountRepository(db as any);
    await repo.update(row.id, { role: AccessRole.OPERATOR }, actor);
    expect(db.rows('cuentas_acceso')[0].rol).toBe(AccessRole.OPERATOR);
    expect(
      JSON.parse(db.rows('auditorias_usuario')[0].datosNuevos),
    ).toMatchObject({ actor, role: AccessRole.OPERATOR });
    expect(JSON.stringify(db.rows('auditorias_usuario'))).not.toContain(
      access.passwordHash,
    );
    db.failAudit();
    await expect(
      repo.update(row.id, { enabled: false }, actor),
    ).rejects.toThrow('audit unavailable');
    expect(db.rows('cuentas_acceso')[0].habilitada).toBe(true);
  });
  it('requires actual image bytes and hashes password before passing to registration port', async () => {
    const image =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1kAAAAASUVORK5CYII=';
    expect(isRegistrationImage(image)).toBe(true);
    for (const value of [
      'texto',
      'https://example.invalid/image.png',
      'data:image/png;base64,dGV4dG8=',
    ])
      expect(isRegistrationImage(value)).toBe(false);
    const submit = vi
      .fn()
      .mockResolvedValue({ id: 'request', status: 'PENDIENTE' });
    const hash = vi.fn().mockResolvedValue('hashed');
    const useCase = new FullRegistrationUseCase({ submit }, { hash } as any);
    const input = {
      ...data,
      email: access.email,
      password: 'isolated-password',
      termsVersionId: 'terms',
      evidence: [image],
    };
    await expect(useCase.execute(input)).resolves.toEqual({
      id: 'request',
      status: 'PENDIENTE',
    });
    expect(submit.mock.calls[0][0]).not.toHaveProperty('password');
    expect(submit.mock.calls[0][0]).toMatchObject({
      passwordHash: 'hashed',
      acceptedAt: expect.any(Date),
    });
  });
});
