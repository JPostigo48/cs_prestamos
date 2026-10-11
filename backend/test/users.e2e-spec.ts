import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/shared/infrastructure/filters/http-exception.filter.js';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';

describe('Users flow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let requestId: string;
  let rejectedRequestId: string;
  let userId: string;
  const institutionalId = `E2E-USERS-${Date.now()}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    prisma = app.get(PrismaService);
    await app.init();
  });

  it('creates, approves and evaluates a registration request', async () => {
    const created = await request(app.getHttpServer())
      .post('/users/registration-requests')
      .send({ nombre: 'Usuario E2E', tipoUsuario: 'ESTUDIANTE', identificadorInstitucional: institutionalId, evidencias: ['Carnet E2E'] })
      .expect(201);
    requestId = created.body.id;
    expect(created.body).toMatchObject({ name: 'Usuario E2E', status: 'PENDIENTE', evidence: [{ information: 'Carnet E2E' }] });

    await request(app.getHttpServer()).get(`/users/registration-requests/${requestId}`).expect(200);
    await request(app.getHttpServer()).get('/users/registration-requests').query({ status: 'PENDIENTE', page: 1, limit: 10 }).expect(200);

    const approved = await request(app.getHttpServer()).post(`/users/registration-requests/${requestId}/approve`).expect(201);
    userId = approved.body.user.id;
    expect(approved.body).toMatchObject({ request: { status: 'APROBADA' }, user: { id: userId, trustPercentage: 100 } });

    await request(app.getHttpServer()).get(`/users/${userId}`).expect(200);
    await request(app.getHttpServer()).get('/users').query({ institutionalId, page: 1, limit: 10 }).expect(200);
    await request(app.getHttpServer()).get(`/users/${userId}/trust-profile`).expect(200);
    await request(app.getHttpServer()).get(`/users/${userId}/loan-eligibility`).expect(200).expect(({ body }) => {
      expect(body).toMatchObject({ userId, eligible: true, reasons: [] });
    });
    await request(app.getHttpServer()).post(`/users/registration-requests/${requestId}/approve`).expect(409);
  });

  it('rejects a pending request', async () => {
    const created = await request(app.getHttpServer())
      .post('/users/registration-requests')
      .send({ nombre: 'Usuario Rechazado E2E', tipoUsuario: 'DOCENTE', identificadorInstitucional: `${institutionalId}-REJECT` })
      .expect(201);
    rejectedRequestId = created.body.id;
    const rejected = await request(app.getHttpServer())
      .post(`/users/registration-requests/${rejectedRequestId}/reject`)
      .send({ rejectionReason: 'No se pudo validar la vinculación.' })
      .expect(201);
    expect(rejected.body.rejectionReason).toBe('No se pudo validar la vinculación.');
    await request(app.getHttpServer()).post(`/users/registration-requests/${rejectedRequestId}/reject`).expect(409);
  });

  afterAll(async () => {
    if (rejectedRequestId) await prisma.client.runtime().query(prisma.sql.public.solicitudes_registro.delete().where((row, fns) => fns.eq(row.id, rejectedRequestId)).returning('id').build());
    if (requestId) await prisma.client.runtime().query(prisma.sql.public.solicitudes_registro.delete().where((row, fns) => fns.eq(row.id, requestId)).returning('id').build());
    if (userId) await prisma.client.runtime().query(prisma.sql.public.usuarios.delete().where((row, fns) => fns.eq(row.id, userId)).returning('id').build());
    await app?.close();
  });
});