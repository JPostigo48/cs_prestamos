import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/shared/infrastructure/filters/http-exception.filter.js';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import { JwtPort } from '../src/modules/auth/application/ports/jwt.port.js';
import { AccessRole } from '../src/modules/auth/domain/entities/access-account.js';

describe('Loans authorization and lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userId: string;
  let requestId: string;
  let accountId: string;
  let categoryId: string;
  let resourceId: string;
  let copyId: string;
  let reservationId: string;
  let loanId: string;
  let createdTermsVersionId: string | null = null;
  let token: string;
  let administratorToken: string;
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
    administratorToken = app.get(JwtPort).sign({
      accountId: 'test-administrator',
      userId: 'test-administrator',
      userType: 'ADMINISTRATIVO',
      role: AccessRole.ADMINISTRATOR,
    });
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
      .auth(administratorToken, { type: 'bearer' })
      .expect(201);
    userId = approved.body.user.id;

    const account = await request(app.getHttpServer())
      .post('/auth/accounts')
      .auth(administratorToken, { type: 'bearer' })
      .send({ userId, email, password: 'LoansE2E-password-1' })
      .expect(201);
    accountId = account.body.id;

    const authenticated = await request(app.getHttpServer())
      .post('/auth/authenticate')
      .send({ email, password: 'LoansE2E-password-1' })
      .expect(201);
    token = authenticated.body.accessToken;

    const versions = await prisma.client.runtime().query(
      prisma.sql.public.versiones_terminos.select('id', 'numero').build(),
    );
    let currentVersion = versions.reduce(
      (latest: any, version: any) => !latest || version.numero > latest.numero ? version : latest,
      null as any,
    );
    if (!currentVersion) {
      const created = await request(app.getHttpServer())
        .post('/terms/versions')
        .auth(administratorToken, { type: 'bearer' })
        .send({ number: 1, title: 'Términos de prueba' })
        .expect(201);
      createdTermsVersionId = created.body.id;
      currentVersion = { id: created.body.id };
    }
    await request(app.getHttpServer())
      .post('/terms/acceptances')
      .auth(token, { type: 'bearer' })
      .send({ userId, termsVersionId: currentVersion.id, acceptedAt: new Date().toISOString() })
      .expect(201);

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

  it('requires authentication and derives the reservation owner from the token', async () => {
    await request(app.getHttpServer())
      .post('/loans/reservations')
      .send({ copyId, requestedAt: new Date(Date.now() + 60_000).toISOString() })
      .expect(401);

    await request(app.getHttpServer())
      .post('/loans/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        userId: '00000000-0000-4000-8000-000000000000',
        copyId,
        requestedAt: new Date(Date.now() + 60_000).toISOString(),
      })
      .expect(400);
  });

  it('creates a loan through pickup, blocks an unavailable copy and protects returns', async () => {
    const requestedAt = new Date(Date.now() + 1500);
    const reserved = await request(app.getHttpServer())
      .post('/loans/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        copyId,
        requestedAt: requestedAt.toISOString(),
      })
      .expect(201);
    reservationId = reserved.body.id;
    expect(reserved.body.userId).toBe(userId);

    await request(app.getHttpServer())
      .post('/loans/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        copyId,
        requestedAt: new Date(Date.now() + 60_000).toISOString(),
      })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/loans/reservations/${reservationId}/pickup`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    await new Promise((resolve) => setTimeout(resolve, Math.max(0, requestedAt.getTime() - Date.now() + 25)));
    const created = await request(app.getHttpServer())
      .post(`/loans/reservations/${reservationId}/pickup`)
      .auth(administratorToken, { type: 'bearer' })
      .expect(201);
    loanId = created.body.id;
    expect(created.body.userId).toBe(userId);

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
  }, 10000);

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
    if (reservationId) {
      await prisma.client.runtime().query(
        prisma.sql.public.reservas
          .delete()
          .where((row, fns) => fns.eq(row.id, reservationId))
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
    if (userId) {
      await prisma.client.runtime().query(
        prisma.sql.public.aceptaciones_terminos
          .delete()
          .where((row, fns) => fns.eq(row.usuarioId, userId))
          .returning('id')
          .build(),
      );
    }
    if (createdTermsVersionId) {
      await prisma.client.runtime().query(
        prisma.sql.public.versiones_terminos
          .delete()
          .where((row, fns) => fns.eq(row.id, createdTermsVersionId))
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
