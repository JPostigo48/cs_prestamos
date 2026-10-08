import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiBody, ApiTags } from '@nestjs/swagger';
import { AcceptTermsVersionUseCase } from '../../application/use-cases/accept-terms-version.use-case.js';
import { CreateTermsVersionUseCase } from '../../application/use-cases/create-terms-version.use-case.js';
import { ListUserTermsAcceptancesUseCase } from '../../application/use-cases/list-user-terms-acceptances.use-case.js';
import {
  AcceptTermsVersionDto,
  CreateTermsVersionDto,
} from '../dto/terms.dto.js';

@ApiTags('Reglas y términos')
@Controller('terms')
export class TermsController {
  constructor(
    private readonly createVersion: CreateTermsVersionUseCase,
    private readonly acceptVersion: AcceptTermsVersionUseCase,
    private readonly listUserAcceptances: ListUserTermsAcceptancesUseCase,
  ) {}

  @Post('versions')
  @ApiBody({ type: CreateTermsVersionDto })
  @ApiOperation({ summary: 'Registrar versión de términos' })
  create(@Body() input: CreateTermsVersionDto) {
    return this.createVersion.execute(input);
  }

  @Post('acceptances')
  @ApiBody({ type: AcceptTermsVersionDto })
  @ApiOperation({ summary: 'Aceptar versión de términos' })
  accept(@Body() input: AcceptTermsVersionDto) {
    return this.acceptVersion.execute(input);
  }

  @Get('users/:userId/acceptances')
  @ApiOperation({ summary: 'Consultar aceptaciones de términos de un usuario' })
  listByUser(@Param('userId') userId: string) {
    return this.listUserAcceptances.execute({ userId });
  }
}
