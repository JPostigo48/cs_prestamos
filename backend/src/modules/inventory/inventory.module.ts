import { Module } from '@nestjs/common';
import { InventoryService } from './application/use-cases/inventory.service.js';
import { InventoryRepository } from './domain/repositories/inventory.repository.js';
import { PrismaInventoryRepository } from './infrastructure/persistence/prisma/prisma-inventory.repository.js';
import { InventoryController } from './presentation/controllers/inventory.controller.js';

@Module({
  controllers: [InventoryController],
  providers: [
    InventoryService,
    {
      provide: InventoryRepository,
      useClass: PrismaInventoryRepository,
    },
  ],
  exports: [InventoryService],
})
export class InventoryModule {}
