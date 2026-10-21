import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/shared/infrastructure/filters/http-exception.filter.js';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import { JwtPort } from '../src/modules/auth/application/ports/jwt.port.js';
import { AccessRole } from '../src/modules/auth/domain/entities/access-account.js';

describe('Users flow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let requestId: string;
  let rejectedRequestId: string;
  let userId: string;
  let operatorToken: string;
  let userToken: string;
  const institutionalId = `E2E-USERS-${Date.now()}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    prisma = app.get(PrismaService);
    operatorToken = app.get(JwtPort).sign({
      accountId: 'test-operator',
      userId: 'test-operator',
      userType: 'ADMINISTRATIVO',
      role: AccessRole.OPERATOR,
    });
    await app.init();
  });

  it('creates, approves and evaluates a registration request', async () => {
    const created = await request(app.getHttpServer())
      .post('/users/registration-requests')
      .send({ nombre: 'Usuario E2E', tipoUsuario: 'ESTUDIANTE', identificadorInstitucional: institutionalId, evidencias: ['Carnet E2E'] })
      .expect(201);
    requestId = created.body.id;
    expect(created.body).toMatchObject({ name: 'Usuario E2E', status: 'PENDIENTE', evidence: [{ information: 'Carnet E2E' }] });

    await request(app.getHttpServer()).get(`/users/registration-requests/${requestId}`).expect(401);
    await request(app.getHttpServer()).post(`/users/registration-requests/${requestId}/approve`).expect(401);
    await request(app.getHttpServer()).get(`/users/registration-requests/${requestId}`).auth(operatorToken, { type: 'bearer' }).expect(200);
    await request(app.getHttpServer()).get('/users/registration-requests').auth(operatorToken, { type: 'bearer' }).query({ status: 'PENDIENTE', page: 1, limit: 10 }).expect(200);

    const approved = await request(app.getHttpServer()).post(`/users/registration-requests/${requestId}/approve`).auth(operatorToken, { type: 'bearer' }).expect(201);
    userId = approved.body.user.id;
    userToken = app.get(JwtPort).sign({
      accountId: 'test-user',
      userId,
      userType: 'ESTUDIANTE',
      role: AccessRole.USER,
    });
    expect(approved.body).toMatchObject({ request: { status: 'APROBADA' }, user: { id: userId, trustPercentage: 100 } });

    await request(app.getHttpServer()).get(`/users/${userId}`).expect(401);
    await request(app.getHttpServer()).get(`/users/${userId}`).auth(userToken, { type: 'bearer' }).expect(200);
    await request(app.getHttpServer()).get('/users/another-user').auth(userToken, { type: 'bearer' }).expect(403);
    await request(app.getHttpServer()).get('/users').auth(userToken, { type: 'bearer' }).expect(403);
    await request(app.getHttpServer()).get('/users').auth(operatorToken, { type: 'bearer' }).query({ institutionalId, page: 1, limit: 10 }).expect(200);
    await request(app.getHttpServer()).get(`/users/${userId}/trust-profile`).auth(userToken, { type: 'bearer' }).expect(200);
    await request(app.getHttpServer()).get(`/users/${userId}/loan-eligibility`).auth(userToken, { type: 'bearer' }).expect(200).expect(({ body }) => {
      expect(body).toMatchObject({ userId, eligible: true, reasons: [] });
    });
    await request(app.getHttpServer()).post(`/users/registration-requests/${requestId}/approve`).auth(userToken, { type: 'bearer' }).expect(403);
    await request(app.getHttpServer()).post(`/users/registration-requests/${requestId}/approve`).auth(operatorToken, { type: 'bearer' }).expect(409);
    await request(app.getHttpServer()).patch(`/users/${userId}/affiliation-status`).send({ vinculacionVigente: false }).expect(401);
    await request(app.getHttpServer()).patch(`/users/${userId}/affiliation-status`).auth(userToken, { type: 'bearer' }).send({ vinculacionVigente: false }).expect(403);
    const accountInput = { userId, email: 'users.e2e@unsa.edu.pe', password: 'SecurePassword123' };
    await request(app.getHttpServer()).post('/auth/accounts').send(accountInput).expect(401);
    await request(app.getHttpServer()).post('/auth/accounts').auth(userToken, { type: 'bearer' }).send(accountInput).expect(403);
  });

  it('rejects a pending request', async () => {
    const created = await request(app.getHttpServer())
      .post('/users/registration-requests')
      .send({ nombre: 'Usuario Rechazado E2E', tipoUsuario: 'DOCENTE', identificadorInstitucional: `${institutionalId}-REJECT` })
      .expect(201);
    rejectedRequestId = created.body.id;
    const rejected = await request(app.getHttpServer())
      .post(`/users/registration-requests/${rejectedRequestId}/reject`)
      .auth(operatorToken, { type: 'bearer' })
      .send({ rejectionReason: 'No se pudo validar la vinculación.' })
      .expect(201);
    expect(rejected.body.rejectionReason).toBe('No se pudo validar la vinculación.');
    await request(app.getHttpServer()).post(`/users/registration-requests/${rejectedRequestId}/reject`).auth(operatorToken, { type: 'bearer' }).expect(409);
  });

  afterAll(async () => {
    if (rejectedRequestId) await prisma.client.runtime().query(prisma.sql.public.solicitudes_registro.delete().where((row, fns) => fns.eq(row.id, rejectedRequestId)).returning('id').build());
    if (requestId) await prisma.client.runtime().query(prisma.sql.public.solicitudes_registro.delete().where((row, fns) => fns.eq(row.id, requestId)).returning('id').build());
    if (userId) await prisma.client.runtime().query(prisma.sql.public.usuarios.delete().where((row, fns) => fns.eq(row.id, userId)).returning('id').build());
    await app?.close();
  });
});
