import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ReservationSettingsRepository } from './domain/reservation-settings.repository.js';
import { PrismaReservationSettingsRepository } from './infrastructure/prisma-reservation-settings.repository.js';
import { ReservationSettingsController } from './presentation/reservation-settings.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [ReservationSettingsController],
  providers: [
    {
      provide: ReservationSettingsRepository,
      useClass: PrismaReservationSettingsRepository,
    },
  ],
})
export class SystemModule {}
