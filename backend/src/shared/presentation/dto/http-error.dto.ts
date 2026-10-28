import { ApiProperty } from '@nestjs/swagger';

/** Cuerpo emitido por HttpExceptionFilter, incluida la validación de entrada. */
export class HttpErrorDto {
  @ApiProperty({ type: 'integer' }) statusCode!: number;
  @ApiProperty({ type: String }) error!: string;
  @ApiProperty({
    type: Object,
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  message!: string | string[];
  @ApiProperty({ type: String }) path!: string;
  @ApiProperty({ type: String, format: 'date-time' }) timestamp!: string;
}

export class PageMetadataDto {
  @ApiProperty({ type: 'integer', minimum: 0 }) total!: number;
  @ApiProperty({ type: 'integer', minimum: 1 }) page!: number;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 100 }) limit!: number;
}

/** Excepciones no HTTP: respuesta por defecto del filtro base de Nest. */
export class UnhandledErrorDto {
  @ApiProperty({ type: 'integer', enum: [500] }) statusCode!: number;
  @ApiProperty({ type: String, example: 'Internal server error' })
  message!: string;
}
