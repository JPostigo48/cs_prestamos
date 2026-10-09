import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service.js';
import { PrismaRegistrationRequestRepository } from './prisma-registration-request.repository.js';
import { PrismaUserRepository } from './prisma-user.repository.js';

describe('Users persistence (PostgreSQL)', () => {
  let prisma: PrismaService;
  let requests: PrismaRegistrationRequestRepository;
  let users: PrismaUserRepository;
  let requestId: string;
  let userId: string;
  const institutionalId = `INT-USERS-${Date.now()}`;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
    requests = new PrismaRegistrationRequestRepository(prisma);
    users = new PrismaUserRepository(prisma);
  });

  it('persists evidence and approves a request atomically', async () => {
    const created = await requests.create({
      name: 'Integration User',
      userType: 'ESTUDIANTE',
      institutionalId,
      evidence: ['Institutional card'],
    });
    requestId = created.id;
    expect(created.evidence).toEqual([{ information: 'Institutional card' }]);

    const approved = await requests.approveAndCreateUser(requestId);
    userId = approved.user.id;
    expect(approved.request.status).toBe('APROBADA');
    expect(approved.user.trustPercentage).toBe(100);
    const auditRows = await prisma.client.runtime().query(
      prisma.sql.public.auditorias_usuario
        .select('accion')
        .where((row, fns) => fns.eq(row.solicitudRegistroId, requestId))
        .build(),
    );
    expect(auditRows.map((row: any) => row.accion)).toEqual(
      expect.arrayContaining(['SOLICITUD_CREADA', 'SOLICITUD_APROBADA']),
    );
    await expect(requests.approveAndCreateUser(requestId)).rejects.toThrow();
  });

  it('updates affiliation and changes eligibility', async () => {
    await users.updateAffiliationStatus(userId, false);
    const eligibility = await users.getLoanEligibility(userId);
    expect(eligibility).toMatchObject({
      userId,
      enabled: false,
      eligible: false,
      reasons: ['VINCULACION_NO_VIGENTE'],
    });
  });

  afterAll(async () => {
    if (requestId) {
      await prisma.client.runtime().query(prisma.sql.public.solicitudes_registro.delete().where((row, fns) => fns.eq(row.id, requestId)).returning('id').build());
    }
    if (userId) {
      await prisma.client.runtime().query(prisma.sql.public.usuarios.delete().where((row, fns) => fns.eq(row.id, userId)).returning('id').build());
    }
    await prisma?.onModuleDestroy();
  });
});
