import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { vi } from 'vitest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/shared/infrastructure/prisma/prisma.service.js';
import { ReservationRepository } from './../src/modules/loans/domain/repositories/reservation.repository.js';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  const expire = vi.fn<ReservationRepository['expire']>().mockResolvedValue([]);

  beforeEach(async () => {
    expire.mockClear();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(ReservationRepository)
      .useValue({ expire })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET) smoke with expiration repository isolated', async () => {
    await request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Backend funcionando');
    await vi.waitFor(() => expect(expire).toHaveBeenCalledWith(expect.any(Date)));
  });

  afterEach(async () => {
    await app.close();
  });
});
