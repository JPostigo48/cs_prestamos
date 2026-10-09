import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/shared/infrastructure/filters/http-exception.filter.js';

describe('Inventory flow (e2e)', () => {
  let app: INestApplication<App>;
  let categoryId: string;
  let resourceId: string;
  let copyId: string;
  const categoryName = `E2E-${Date.now()}`;

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
    await app.init();
  });

  it('completes the inventory lifecycle', async () => {
    const categoryResponse = await request(app.getHttpServer())
      .post('/inventory/categories')
      .send({ nombre: categoryName, tiempoMaximoPrestamoDias: 14 })
      .expect(201);
    categoryId = categoryResponse.body.id;

    const duplicateResponse = await request(app.getHttpServer())
      .post('/inventory/categories')
      .send({ nombre: categoryName, tiempoMaximoPrestamoDias: 14 })
      .expect(409);
    expect(duplicateResponse.body).toMatchObject({
      statusCode: 409,
      error: 'Conflict',
      path: '/inventory/categories',
    });

    const missingResourceResponse = await request(app.getHttpServer())
      .post('/inventory/resources')
      .send({
        categoriaId: '123e4567-e89b-42d3-a456-426614174999',
        nombre: 'Recurso inexistente',
      })
      .expect(404);
    expect(missingResourceResponse.body).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      message: 'Categoría no encontrada.',
      path: '/inventory/resources',
    });

    const resourceResponse = await request(app.getHttpServer())
      .post('/inventory/resources')
      .send({ categoriaId: categoryId, nombre: 'Recurso E2E' })
      .expect(201);
    resourceId = resourceResponse.body.id;

    const paginatedResources = await request(app.getHttpServer())
      .get('/inventory/resources')
      .query({ categoryId, page: 1, limit: 1 })
      .expect(200);
    expect(paginatedResources.body).toMatchObject({
      total: 1,
      page: 1,
      limit: 1,
    });
    expect(paginatedResources.body.data[0].categoria).toEqual({
      id: categoryId,
      nombre: categoryName,
    });

    const copyResponse = await request(app.getHttpServer())
      .post(`/inventory/resources/${resourceId}/copies`)
      .send({ codigoInventario: `E2E-${Date.now()}` })
      .expect(201);
    copyId = copyResponse.body.id;
    expect(copyResponse.body.estado).toBe('DISPONIBLE');

    await request(app.getHttpServer())
      .patch(`/inventory/copies/${copyId}/state`)
      .send({ estado: 'PRESTADO' })
      .expect(422);

    await request(app.getHttpServer())
      .patch(`/inventory/copies/${copyId}/state`)
      .send({ estado: 'NO_DISPONIBLE' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/inventory/copies/${copyId}/observations`)
      .send({ descripcion: '' })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/inventory/copies/${copyId}/observations`)
      .send({ descripcion: 'Observación E2E' })
      .expect(201);

    const availabilityResponse = await request(app.getHttpServer())
      .get(`/inventory/resources/${resourceId}/availability`)
      .expect(200);
    expect(availabilityResponse.body).toMatchObject({
      totalCopies: 1,
      disponibles: 0,
      prestados: 0,
      noDisponibles: 1,
    });

    const globalAvailability = await request(app.getHttpServer())
      .get('/inventory/availability')
      .expect(200);
    expect(globalAvailability.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: resourceId,
          disponibles: 0,
          prestados: 0,
          noDisponibles: 1,
        }),
      ]),
    );

    await request(app.getHttpServer())
      .delete(`/inventory/categories/${categoryId}`)
      .expect(409);
    await request(app.getHttpServer())
      .delete(`/inventory/resources/${resourceId}`)
      .expect(409);

    const copiesBeforeDelete = await request(app.getHttpServer())
      .get(`/inventory/resources/${resourceId}/copies`)
      .expect(200);
    expect(copiesBeforeDelete.body).toHaveLength(1);
    const copyById = await request(app.getHttpServer())
      .get(`/inventory/copies/${copyId}`);
    expect(copyById.status).toBe(200);

    await request(app.getHttpServer())
      .delete(`/inventory/copies/${copyId}`)
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/inventory/resources/${resourceId}`)
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/inventory/categories/${categoryId}`)
      .expect(200);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });
});
