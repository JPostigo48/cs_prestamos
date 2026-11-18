import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { inMemoryPrisma } from '../../../test/helpers/in-memory-prisma.js';
import { PrismaRegistrationRequestRepository } from '../users/infrastructure/persistence/prisma/prisma-registration-request.repository.js';
import { PrismaAccessAccountRepository } from './infrastructure/persistence/prisma/prisma-access-account.repository.js';
import { UserType } from '../users/domain/entities/registration-request.js';
import { AccessRole } from './domain/entities/access-account.js';
import { PendingCredentialsAdapter } from './infrastructure/security/pending-credentials.adapter.js';
import { AuthenticateAccountUseCase } from './application/use-cases/authenticate-account.use-case.js';
import {
  FullRegistrationUseCase,
  isRegistrationImage,
} from './application/use-cases/full-registration.use-case.js';

vi.mock('dotenv/config', () => ({}));
const password = 'isolated-original-password';
const credentials = new PendingCredentialsAdapter();
const image =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWP4//8/AAX+Av5Y8msOAAAAAElFTkSuQmCC';
const invalidImages = [
  'data:image/jpeg;base64,/9j/2Q==',
  'data:image/png;base64,' +
    Buffer.from(image.split(',')[1], 'base64')
      .subarray(0, 40)
      .toString('base64'),
];
const actor = { userId: 'admin-user', accountId: 'admin-account' };
const access = {
  email: 'new@unsa.edu.pe',
  passwordHash: await credentials.hash(password),
  termsVersionId: 'terms',
  acceptedAt: new Date(),
};
const data = {
  name: 'Usuario de prueba',
  userType: UserType.ESTUDIANTE,
  institutionalId: 'ISOLATED-1',
  phone: '999123456',
  evidence: [image],
  access,
};
const initial = () => ({ versiones_terminos: [{ id: 'terms', numero: 1 }] });

describe('Registration and account SQL repositories, transactional in-memory harness (NOT PostgreSQL)', () => {
  it('creates request/evidence/audit together; approval creates account USER and original acceptance once', async () => {
    const db = inMemoryPrisma(initial());
    const repo = new PrismaRegistrationRequestRepository(db as any);
    const pending = await repo.create(data);
    expect(pending.status).toBe('PENDIENTE');
    expect(access.passwordHash).toMatch(/^\$argon2id\$v=19\$/);
    expect(pending.approvalBlockers).toEqual([]);
    expect(JSON.stringify(pending)).not.toContain(access.passwordHash);
    expect(db.rows('cuentas_acceso')).toHaveLength(0);
    expect(db.rows('usuarios')).toHaveLength(0);
    const result = await repo.approveAndCreateUser(pending.id, actor);
    expect(result.request.status).toBe('APROBADA');
    expect(result.request.phone).toBe(data.phone);
    expect(result.user.phone).toBe(data.phone);
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
    expect(db.rows('cuentas_acceso')).toHaveLength(1);
    expect(db.rows('aceptaciones_terminos')).toHaveLength(1);
    await expect(
      repo.updateStatus(pending.id, 'RECHAZADA', 'Tardío'),
    ).rejects.toThrow('ya fue procesada');
    const login = new AuthenticateAccountUseCase(
      new PrismaAccessAccountRepository(db as any),
      {
        getById: async () => ({
          id: result.user.id,
          currentAffiliation: true,
          userType: UserType.ESTUDIANTE,
        }),
      } as any,
      credentials,
    );
    const identity = await login.execute({ email: access.email, password });
    expect(identity).toMatchObject({
      userId: result.user.id,
      role: AccessRole.USER,
    });
    for (const value of [
      pending,
      result,
      identity,
      db.rows('auditorias_usuario'),
      await repo.findById(pending.id),
      await repo.list({ page: 1, limit: 20 }),
    ]) {
      expect(JSON.stringify(value)).not.toContain(access.passwordHash);
      expect(JSON.stringify(value)).not.toContain(password);
    }
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
  it('blocks incomplete legacy requests before ANY write, projects safe blockers, permits motivated rejection and complete resubmission', async () => {
    const variants = [
      {
        email: null,
        passwordHash: null,
        versionTerminosId: null,
        fechaAceptacionTerminos: null,
      },
      { email: 'invalid' },
      { passwordHash: null },
      { passwordHash: '$argon2id$invalid' },
      { passwordHash: access.passwordHash.replace('argon2id', 'argon2i') },
      { versionTerminosId: null },
      { versionTerminosId: 'missing-version' },
      { fechaAceptacionTerminos: null },
      { fechaAceptacionTerminos: 'invalid' },
      { evidence: [] },
      { evidence: ['texto'] },
      ...invalidImages.map((value) => ({ evidence: [value] })),
    ];
    for (const { evidence = data.evidence, ...changes } of variants) {
      const db = inMemoryPrisma(initial());
      const repo = new PrismaRegistrationRequestRepository(db as any);
      const pending = await repo.create(data);
      Object.assign(db.rows('solicitudes_registro')[0], changes);
      db.rows('evidencias_vinculacion').splice(
        0,
        1,
        ...evidence.map((informacion) => ({
          solicitudRegistroId: pending.id,
          informacion,
        })),
      );
      const detail = await repo.findById(pending.id);
      expect(detail!.approvalBlockers.length).toBeGreaterThan(0);
      expect(
        (await repo.list({ page: 1, limit: 20 })).items[0].approvalBlockers,
      ).toEqual(detail!.approvalBlockers);
      expect(JSON.stringify(detail)).not.toContain(access.passwordHash);
      const start = db.calls.length;
      await expect(
        repo.approveAndCreateUser(pending.id, actor),
      ).rejects.toMatchObject({ status: 409 });
      expect(
        db.calls.slice(start).every((call) => call.operation === 'select'),
      ).toBe(true);
      for (const table of [
        'usuarios',
        'cuentas_acceso',
        'aceptaciones_terminos',
      ])
        expect(db.rows(table)).toHaveLength(0);
      await repo.updateStatus(
        pending.id,
        'RECHAZADA',
        'Reenvíe el registro integral completo.',
        undefined,
        actor,
      );
      const resend = await repo.create(data);
      expect(resend.approvalBlockers).toEqual([]);
    }
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
    expect(await isRegistrationImage(image)).toBe(true);
    const jpeg = await sharp(Buffer.from(image.split(',')[1], 'base64'))
      .jpeg()
      .toBuffer();
    expect(
      await isRegistrationImage(
        'data:image/jpeg;base64,' + jpeg.toString('base64'),
      ),
    ).toBe(true);
    for (const value of [
      'texto',
      'https://example.invalid/image.png',
      'data:image/png;base64,dGV4dG8=',
      ...invalidImages,
    ])
      expect(await isRegistrationImage(value)).toBe(false);
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
    const oversized = await sharp({
      create: { width: 2001, height: 2000, channels: 3, background: '#fff' },
    })
      .png()
      .toBuffer();
    const tooWide = await sharp({
      create: { width: 4097, height: 1, channels: 3, background: '#fff' },
    })
      .png()
      .toBuffer();
    // PNG cortado en IDAT pero con IEND conservado: el cierre tampoco basta.
    const bytes = Buffer.from(image.split(',')[1], 'base64');
    const corrupt = Buffer.concat([bytes.subarray(0, 60), bytes.subarray(-12)]);
    for (const value of [
      ...invalidImages,
      ...[oversized, tooWide, corrupt, Buffer.alloc(60 * 1024 + 1)].map(
        (b) => 'data:image/png;base64,' + b.toString('base64'),
      ),
    ]) {
      await expect(
        useCase.execute({ ...input, evidence: [value] }),
      ).rejects.toMatchObject({ status: 400 });
      expect(submit).not.toHaveBeenCalled();
      expect(hash).not.toHaveBeenCalled();
    }
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
