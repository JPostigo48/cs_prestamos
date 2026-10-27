import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
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
    expect(approved.user.trustPercentage).toBe(75);
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

  it('roundtrips sanctions and evaluates future, active, ended and absolved dates', async () => {
    await users.updateAffiliationStatus(userId, true);
    const now = Date.now();
    const timestamp = (ms: number) => Temporal.Instant.fromEpochMilliseconds(ms);
    const cases = [
      { estado: 'PROGRAMADA', inicio: now + 60_000, fin: null, effective: 'PROGRAMADA', active: false },
      { estado: 'ACTIVA', inicio: now - 60_000, fin: null, effective: 'ACTIVA', active: true },
      { estado: 'ACTIVA', inicio: now - 120_000, fin: now - 60_000, effective: 'FINALIZADA', active: false },
      { estado: 'ABSUELTA', inicio: now - 90_000, fin: null, effective: 'ABSUELTA', active: false },
    ] as const;
    for (const item of cases) {
      await prisma.client.runtime().query(prisma.sql.public.sanciones.insert([{
        usuarioId: userId, estado: item.estado, fechaInicio: timestamp(item.inicio),
        fechaFin: item.fin === null ? null : timestamp(item.fin),
        confianzaAnterior: '75.00', confianzaPosterior: '75.00',
      }]).returning('id').build());
    }
    const sanctions = await users.listSanctions(userId);
    for (const item of cases) {
      const sanction = sanctions.find((row) => row.startsAt.getTime() === item.inicio);
      expect(sanction).toBeDefined();
      expect(sanction?.endsAt?.getTime() ?? null).toBe(item.fin);
      expect(sanction?.status).toBe(item.effective);
    }
    expect((await users.getLoanEligibility(userId)).activeSanctions).toHaveLength(1);
    expect((await users.getLoanEligibility(userId)).reasons).toContain('SANCION_ACTIVA');
    expect((await users.getTrustProfile(userId)).currentlyPenalized).toBe(true);
    await prisma.client.runtime().query(prisma.sql.public.sanciones.delete()
      .where((row, fns) => fns.eq(row.usuarioId, userId)).returning('id').build());
    expect((await users.getLoanEligibility(userId)).eligible).toBe(true);
  });

  afterAll(async () => {
    if (userId) {
      await prisma.client.runtime().query(prisma.sql.public.sanciones.delete().where((row, fns) => fns.eq(row.usuarioId, userId)).returning('id').build());
    }
    if (requestId) {
      await prisma.client.runtime().query(prisma.sql.public.solicitudes_registro.delete().where((row, fns) => fns.eq(row.id, requestId)).returning('id').build());
    }
    if (userId) {
      await prisma.client.runtime().query(prisma.sql.public.usuarios.delete().where((row, fns) => fns.eq(row.id, userId)).returning('id').build());
    }
    await prisma?.onModuleDestroy();
  });
});
