import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticateAccountUseCase } from '../../application/use-cases/authenticate-account.use-case.js';
import { GetAccessAccountUseCase } from '../../application/use-cases/get-access-account.use-case.js';
import { RegisterAccessAccountUseCase } from '../../application/use-cases/register-access-account.use-case.js';
import { AuthenticateAccountDto } from '../dto/authenticate-account.dto.js';
import { RegisterAccessAccountDto } from '../dto/register-access-account.dto.js';
import { JwtPort } from '../../application/ports/jwt.port.js';
import { AccessRole, type AccessAccount } from '../../domain/entities/access-account.js';
import { AuthGuard } from '../guards/auth.guard.js';
import { CurrentUser } from '../decorators/current-user.decorator.js';
import type { AuthenticatedIdentity } from '../../application/ports/auth.inputs.js';
import { UpdateAccessAccountUseCase } from '../../application/use-cases/update-access-account.use-case.js';
import { UpdateAccessAccountDto } from '../dto/update-access-account.dto.js';
import { Roles } from '../decorators/roles.decorator.js';
import { RolesGuard } from '../guards/roles.guard.js';

function safeAccount(account: AccessAccount) {
  const { passwordHash: _passwordHash, ...safe } = account;
  return safe;
}

function configuredExpiresIn(): number {
  const value = process.env.JWT_EXPIRES_IN ?? '3600';
  const match = /^(\d+)(s|m|h|d)?$/.exec(value);
  if (!match) return 3600;
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return Number(match[1]) * (multipliers[match[2] as keyof typeof multipliers] ?? 1);
}
@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerAccount: RegisterAccessAccountUseCase,
    private readonly authenticateAccount: AuthenticateAccountUseCase,
    private readonly getAccount: GetAccessAccountUseCase,
    private readonly jwt: JwtPort,
    private readonly updateAccount: UpdateAccessAccountUseCase,
  ) {}

  @Post('accounts')
  @ApiBody({ type: RegisterAccessAccountDto })
  @ApiOperation({ summary: 'Registrar cuenta de acceso' })
  register(@Body() input: RegisterAccessAccountDto) {
    return this.registerAccount.execute(input).then(safeAccount);
  }

  @Post('authenticate')
  @ApiBody({ type: AuthenticateAccountDto })
  @ApiOperation({ summary: 'Autenticar cuenta de acceso' })
  authenticate(@Body() input: AuthenticateAccountDto) {
    return this.authenticateAccount.execute(input).then((identity) => ({
      accessToken: this.jwt.sign(identity),
      tokenType: 'Bearer',
      expiresIn: configuredExpiresIn(),
      user: {
        id: identity.userId,
        email: input.email.trim().toLowerCase(),
        role: identity.role,
        userType: identity.userType,
      },
    }));
  }

  @Get('accounts/:accountId')
  @ApiOperation({ summary: 'Consultar cuenta de acceso' })
  @UseGuards(AuthGuard, RolesGuard)
  getById(
    @Param('accountId') accountId: string,
    @CurrentUser() identity: AuthenticatedIdentity,
  ) {
    if (
      identity.accountId !== accountId &&
      identity.role !== 'ADMINISTRADOR'
    ) {
      throw new ForbiddenException('No tiene permisos para consultar esta cuenta.');
    }
    return this.getAccount.execute({ accountId }).then(safeAccount);
  }

  @Patch('accounts/:accountId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(AccessRole.ADMINISTRATOR)
  update(
    @Param('accountId') accountId: string,
    @Body() input: UpdateAccessAccountDto,
  ) {
    return this.updateAccount
      .execute({ accountId, role: input.role, enabled: input.enabled })
      .then(safeAccount);
  }
}
