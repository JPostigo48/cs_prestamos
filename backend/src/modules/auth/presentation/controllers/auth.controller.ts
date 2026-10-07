import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiBody, ApiTags } from '@nestjs/swagger';
import { AuthenticateAccountUseCase } from '../../application/use-cases/authenticate-account.use-case.js';
import { GetAccessAccountUseCase } from '../../application/use-cases/get-access-account.use-case.js';
import { RegisterAccessAccountUseCase } from '../../application/use-cases/register-access-account.use-case.js';
import { AuthenticateAccountDto } from '../dto/authenticate-account.dto.js';
import { RegisterAccessAccountDto } from '../dto/register-access-account.dto.js';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerAccount: RegisterAccessAccountUseCase,
    private readonly authenticateAccount: AuthenticateAccountUseCase,
    private readonly getAccount: GetAccessAccountUseCase,
  ) {}

  @Post('accounts')
  @ApiBody({ type: RegisterAccessAccountDto })
  @ApiOperation({ summary: 'Registrar cuenta de acceso' })
  register(@Body() input: RegisterAccessAccountDto) {
    return this.registerAccount.execute(input);
  }

  @Post('authenticate')
  @ApiBody({ type: AuthenticateAccountDto })
  @ApiOperation({ summary: 'Autenticar cuenta de acceso' })
  authenticate(@Body() input: AuthenticateAccountDto) {
    return this.authenticateAccount.execute(input);
  }

  @Get('accounts/:accountId')
  @ApiOperation({ summary: 'Consultar cuenta de acceso' })
  getById(@Param('accountId') accountId: string) {
    return this.getAccount.execute({ accountId });
  }
}
