import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AcceptTermsVersionUseCase } from '../../application/use-cases/accept-terms-version.use-case.js';
import { CreateTermsVersionUseCase } from '../../application/use-cases/create-terms-version.use-case.js';
import { ListUserTermsAcceptancesUseCase } from '../../application/use-cases/list-user-terms-acceptances.use-case.js';
import {
  AcceptTermsVersionDto,
  CreateTermsVersionDto,
} from '../dto/terms.dto.js';

@Controller('terms')
export class TermsController {
  constructor(
    private readonly createVersion: CreateTermsVersionUseCase,
    private readonly acceptVersion: AcceptTermsVersionUseCase,
    private readonly listUserAcceptances: ListUserTermsAcceptancesUseCase,
  ) {}

  @Post('versions')
  create(@Body() input: CreateTermsVersionDto) {
    return this.createVersion.execute(input);
  }

  @Post('acceptances')
  accept(@Body() input: AcceptTermsVersionDto) {
    return this.acceptVersion.execute(input);
  }

  @Get('users/:userId/acceptances')
  listByUser(@Param('userId') userId: string) {
    return this.listUserAcceptances.execute({ userId });
  }
}
