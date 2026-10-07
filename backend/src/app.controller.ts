import { Controller, Get, InternalServerErrorException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiExtension, ApiTags } from '@nestjs/swagger';
import { PrismaService } from './shared/infrastructure/prisma/prisma.service.js';

@ApiTags('Sistema')
@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar estado del backend' })
  @ApiOkResponse({
    content: {
      'text/plain': {
        schema: { type: 'string', example: 'Backend funcionando' },
      },
    },
  })
  @ApiExtension('x-implementation-status', 'implemented')
  getStatus(): string {
    return 'Backend funcionando';
  }

  @Get('health/database')
  @ApiOperation({ summary: 'Comprobar conexión con PostgreSQL' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['ok', 'database', 'table', 'rows'],
      properties: {
        ok: { type: 'boolean', example: true },
        database: { type: 'string', example: 'postgresql' },
        table: { type: 'string', example: 'usuarios' },
        rows: { type: 'integer', example: 0 },
      },
    },
  })
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
