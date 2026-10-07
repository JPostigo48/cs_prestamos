import { Controller, Get, InternalServerErrorException } from '@nestjs/common';
import { ApiOperation, ApiExtension, ApiTags } from '@nestjs/swagger';
import { PrismaService } from './shared/infrastructure/prisma/prisma.service.js';

@ApiTags('Sistema')
@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar estado del backend' })
  @ApiExtension('x-implementation-status', 'implemented')
  getStatus(): string {
    return 'Backend funcionando';
  }

  @Get('health/database')
  @ApiOperation({ summary: 'Comprobar conexión con PostgreSQL' })
  @ApiExtension('x-implementation-status', 'implemented')
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
