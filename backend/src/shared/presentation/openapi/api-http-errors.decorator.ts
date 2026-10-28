import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { HttpErrorDto } from '../dto/http-error.dto.js';

/** Errores HttpException normalizados por el filtro global. */
export function ApiHttpErrors(...statuses: number[]) {
  return applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({
        status,
        description: HttpStatus[status] ?? 'Error HTTP',
        type: HttpErrorDto,
      }),
    ),
  );
}
