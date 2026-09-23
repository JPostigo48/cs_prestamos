import { Controller, Get, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from './shared/infrastructure/prisma/prisma.service.js';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  getStatus(): string {
    return 'Backend funcionando';
  }

  @Get('health/database')
  async checkDatabase() {
    try {
      const result = this.prisma.sql.public.usuarios
        .select('id')
        .limit(1)
        .build();

      const runtime = (this.prisma.client as any).runtime();
      const rows = await runtime.query(result);

      return {
        ok: true,
        database: 'postgresql',
        table: 'usuarios',
        rows: rows.length,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';

      throw new InternalServerErrorException({
        ok: false,
        database: 'postgresql',
        error: errorMessage,
      });
    }
  }
}
