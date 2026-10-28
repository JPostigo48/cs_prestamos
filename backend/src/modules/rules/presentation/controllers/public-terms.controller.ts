import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiExtension,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ApiHttpErrors } from '../../../../shared/presentation/openapi/api-http-errors.decorator.js';
import { ReadPublicTermsUseCase } from '../../application/use-cases/read-public-terms.use-case.js';
import { PublicTermsResponseDto } from '../dto/public-terms-response.dto.js';

@ApiTags('Reglas y términos')
@Controller('terms')
export class PublicTermsController {
  constructor(private readonly readTerms: ReadPublicTermsUseCase) {}

  @Get('current')
  @ApiOperation({
    summary: 'Consultar términos públicos vigentes',
    description:
      'Mayor número publicado en la base real. Incluye únicamente reglas versionadas vinculadas a esos términos, sin datos personales. No requiere autenticación.',
  })
  @ApiOkResponse({ type: PublicTermsResponseDto })
  @ApiHttpErrors(404)
  @ApiExtension('x-implementation-status', 'implemented')
  current() {
    return this.readTerms.execute();
  }

  @Get('versions/:versionId')
  @ApiOperation({
    summary: 'Consultar una versión histórica pública de términos',
    description:
      'Conserva la matriz de la versión solicitada, incluso si las reglas actuales cambiaron. No requiere autenticación.',
  })
  @ApiParam({
    name: 'versionId',
    type: String,
    format: 'uuid',
    description: 'Identificador exacto de la versión, no su número.',
  })
  @ApiOkResponse({ type: PublicTermsResponseDto })
  @ApiHttpErrors(400, 404)
  @ApiExtension('x-implementation-status', 'implemented')
  version(@Param('versionId', new ParseUUIDPipe()) versionId: string) {
    return this.readTerms.execute(versionId);
  }
}
