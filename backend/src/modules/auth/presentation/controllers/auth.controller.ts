import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuthenticateAccountUseCase } from '../../application/use-cases/authenticate-account.use-case.js';
import { GetAccessAccountUseCase } from '../../application/use-cases/get-access-account.use-case.js';
import { RegisterAccessAccountUseCase } from '../../application/use-cases/register-access-account.use-case.js';
import { AuthenticateAccountDto } from '../dto/authenticate-account.dto.js';
import { RegisterAccessAccountDto } from '../dto/register-access-account.dto.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerAccount: RegisterAccessAccountUseCase,
    private readonly authenticateAccount: AuthenticateAccountUseCase,
    private readonly getAccount: GetAccessAccountUseCase,
  ) {}

  @Post('accounts')
  register(@Body() input: RegisterAccessAccountDto) {
    return this.registerAccount.execute(input);
  }

  @Post('authenticate')
  authenticate(@Body() input: AuthenticateAccountDto) {
    return this.authenticateAccount.execute(input);
  }

  @Get('accounts/:accountId')
  getById(@Param('accountId') accountId: string) {
    return this.getAccount.execute({ accountId });
  }
}
