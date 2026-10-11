import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/shared/infrastructure/filters/http-exception.filter.js';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';

describe('Loans authorization and lifecycle (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let userId: string;
  let requestId: string;
  let accountId: string;
  let categoryId: string;
  let resourceId: string;
  let copyId: string;
  let loanId: string;
  let token: string;
  const suffix = Date.now().toString();
  const email = `loans.e2e.${suffix}@unsa.edu.pe`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    prisma = app.get(PrismaService);
    await app.init();

    const registration = await request(app.getHttpServer())
      .post('/users/registration-requests')
      .send({
        nombre: `Usuario Loans ${suffix}`,
        tipoUsuario: 'ESTUDIANTE',
        identificadorInstitucional: `LOANS-E2E-${suffix}`,
      })
      .expect(201);
    requestId = registration.body.id;

    const approved = await request(app.getHttpServer())
      .post(`/users/registration-requests/${requestId}/approve`)
      .expect(201);
    userId = approved.body.user.id;

    const account = await request(app.getHttpServer())
      .post('/auth/accounts')
      .send({ userId, email, password: 'LoansE2E-password-1' })
      .expect(201);
    accountId = account.body.id;

    const authenticated = await request(app.getHttpServer())
      .post('/auth/authenticate')
      .send({ email, password: 'LoansE2E-password-1' })
      .expect(201);
    token = authenticated.body.accessToken;

    const category = await request(app.getHttpServer())
      .post('/inventory/categories')
      .send({
        nombre: `Categoría Loans ${suffix}`,
        tiempoMaximoPrestamoDias: 7,
      })
      .expect(201);
    categoryId = category.body.id;

    const resource = await request(app.getHttpServer())
      .post('/inventory/resources')
      .send({ categoriaId: categoryId, nombre: `Recurso Loans ${suffix}` })
      .expect(201);
    resourceId = resource.body.id;

    const copy = await request(app.getHttpServer())
      .post(`/inventory/resources/${resourceId}/copies`)
      .send({ codigoInventario: `LOANS-COPY-${suffix}` })
      .expect(201);
    copyId = copy.body.id;
  });

  it('requires authentication and derives the loan owner from the token', async () => {
    await request(app.getHttpServer())
      .post('/loans')
      .send({ copyId, startsAt: new Date(Date.now() + 60_000).toISOString() })
      .expect(401);

    await request(app.getHttpServer())
      .post('/loans')
      .set('Authorization', `Bearer ${token}`)
      .send({
        userId: '00000000-0000-4000-8000-000000000000',
        copyId,
        startsAt: new Date(Date.now() + 60_000).toISOString(),
      })
      .expect(400);
  });

  it('creates a loan, blocks an unavailable copy and protects returns', async () => {
    const created = await request(app.getHttpServer())
      .post('/loans')
      .set('Authorization', `Bearer ${token}`)
      .send({
        copyId,
        startsAt: new Date(Date.now() + 60_000).toISOString(),
      })
      .expect(201);
    loanId = created.body.id;
    expect(created.body.userId).toBe(userId);

    await request(app.getHttpServer())
      .post('/loans')
      .set('Authorization', `Bearer ${token}`)
      .send({
        copyId,
        startsAt: new Date(Date.now() + 120_000).toISOString(),
      })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/loans/${loanId}/return`)
      .set('Authorization', `Bearer ${token}`)
      .send({ returnedAt: new Date().toISOString() })
      .expect(403);

    await request(app.getHttpServer())
      .get(`/loans/user/${userId}/history`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.arrayContaining([expect.objectContaining({ id: loanId })]),
        );
      });
  });

  afterAll(async () => {
    if (loanId) {
      await prisma.client.runtime().query(
        prisma.sql.public.devoluciones
          .delete()
          .where((row, fns) => fns.eq(row.prestamoId, loanId))
          .returning('id')
          .build(),
      );
      await prisma.client.runtime().query(
        prisma.sql.public.prestamos
          .delete()
          .where((row, fns) => fns.eq(row.id, loanId))
          .returning('id')
          .build(),
      );
    }
    if (copyId) {
      await prisma.client.runtime().query(
        prisma.sql.public.ejemplares
          .delete()
          .where((row, fns) => fns.eq(row.id, copyId))
          .returning('id')
          .build(),
      );
    }
    if (resourceId) {
      await prisma.client.runtime().query(
        prisma.sql.public.recursos
          .delete()
          .where((row, fns) => fns.eq(row.id, resourceId))
          .returning('id')
          .build(),
      );
    }
    if (categoryId) {
      await prisma.client.runtime().query(
        prisma.sql.public.categorias_recurso
          .delete()
          .where((row, fns) => fns.eq(row.id, categoryId))
          .returning('id')
          .build(),
      );
    }
    if (accountId) {
      await prisma.client.runtime().query(
        prisma.sql.public.cuentas_acceso
          .delete()
          .where((row, fns) => fns.eq(row.id, accountId))
          .returning('id')
          .build(),
      );
    }
    if (requestId) {
      await prisma.client.runtime().query(
        prisma.sql.public.solicitudes_registro
          .delete()
          .where((row, fns) => fns.eq(row.id, requestId))
          .returning('id')
          .build(),
      );
    }
    if (userId) {
      await prisma.client.runtime().query(
        prisma.sql.public.usuarios
          .delete()
          .where((row, fns) => fns.eq(row.id, userId))
          .returning('id')
          .build(),
      );
    }
    await app?.close();
  });
});
