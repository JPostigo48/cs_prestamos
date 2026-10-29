import { ApiHttpErrors } from '../../../../shared/presentation/openapi/api-http-errors.decorator.js';
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { GoogleIdentityPort } from '../../application/ports/google-identity.port.js';
import { GoogleAuthenticationUseCase } from '../../application/use-cases/google-authentication.use-case.js';
import { FullRegistrationUseCase } from '../../application/use-cases/full-registration.use-case.js';
import {
  FullRegistrationDto,
  PendingRegistrationResponseDto,
} from '../dto/full-registration.dto.js';
import {
  GoogleAuthorizationDto,
  GoogleExchangeDto,
  GoogleAuthorizationResponseDto,
} from '../dto/google-authentication.dto.js';
import {
  ListAccountsDto,
  AccountsResponseDto,
} from '../dto/list-accounts.dto.js';
import {
  ApiExtension,
  ApiBody,
  ApiOperation,
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiQuery,
} from '@nestjs/swagger';
import {
  AccessAccountResponseDto,
  AuthenticationResponseDto,
} from '../dto/auth-response.dto.js';
import { AuthenticateAccountUseCase } from '../../application/use-cases/authenticate-account.use-case.js';
import { GetAccessAccountUseCase } from '../../application/use-cases/get-access-account.use-case.js';
import { RegisterAccessAccountUseCase } from '../../application/use-cases/register-access-account.use-case.js';
import { AuthenticateAccountDto } from '../dto/authenticate-account.dto.js';
import { RegisterAccessAccountDto } from '../dto/register-access-account.dto.js';
import { JwtPort } from '../../application/ports/jwt.port.js';
import {
  AccessRole,
  type AccessAccount,
} from '../../domain/entities/access-account.js';
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
  return (
    Number(match[1]) * (multipliers[match[2] as keyof typeof multipliers] ?? 1)
  );
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
    private readonly google: GoogleIdentityPort,
    private readonly googleAuthentication: GoogleAuthenticationUseCase,
    private readonly fullRegistration: FullRegistrationUseCase,
  ) {}

  @Post('google/authorization')
  @ApiOperation({
    summary: 'Iniciar autorización Google institucional',
    description:
      'Público. Crea state/nonce/PKCE de un solo uso (5 minutos) y cookie HttpOnly SameSite=Lax. El correo es una sugerencia, nunca prueba de identidad. 503 si no se configuró el proveedor.',
  })
  @ApiBody({ type: GoogleAuthorizationDto })
  @ApiCreatedResponse({ type: GoogleAuthorizationResponseDto })
  @ApiHttpErrors(400, 503)
  authorizeGoogle(
    @Body() input: GoogleAuthorizationDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = this.google.authorize(input.email);
    response.cookie('google_flow', result.browserToken, {
      httpOnly: true,
      secure: result.secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 300_000,
    });
    response.setHeader('Cache-Control', 'no-store');
    return { authorizationUrl: result.authorizationUrl };
  }

  @Post('google/authenticate')
  @ApiOperation({
    summary: 'Completar acceso Google verificado',
    description:
      'Público. Intercambia código con PKCE y valida firma RS256, issuer, audience, expiración, nonce, email_verified y dominio institucional. Exige state y cookie del mismo navegador. Solo inicia sesión para una cuenta existente, aprobada y habilitada; no crea usuarios ni privilegios.',
  })
  @ApiBody({ type: GoogleExchangeDto })
  @ApiCreatedResponse({ type: AuthenticationResponseDto })
  @ApiHttpErrors(400, 401, 503)
  async exchangeGoogle(
    @Body() input: GoogleExchangeDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookie =
      request.headers.cookie
        ?.split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith('google_flow='))
        ?.slice('google_flow='.length) ?? '';
    response.clearCookie('google_flow', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    });
    response.setHeader('Cache-Control', 'no-store');
    const { identity, email } = await this.googleAuthentication.execute(
      input.code,
      input.state,
      cookie,
    );
    return {
      accessToken: this.jwt.sign(identity),
      tokenType: 'Bearer',
      expiresIn: configuredExpiresIn(),
      user: {
        id: identity.userId,
        email,
        role: identity.role,
        userType: identity.userType,
      },
    };
  }

  @Post('registration-requests')
  @ApiOperation({
    summary: 'Solicitar alta integral sin iniciar sesión',
    description:
      'Público. Guarda solicitud, evidencia de imagen y aceptación de términos vigentes en una transacción. Solo guarda hash Argon2id. La aprobación O/A existente crea usuario y cuenta USUARIO y transfiere la aceptación en la misma transacción. No admite rol ni habilitación del cliente.',
  })
  @ApiBody({ type: FullRegistrationDto })
  @ApiCreatedResponse({ type: PendingRegistrationResponseDto })
  @ApiHttpErrors(400, 409)
  registerFull(@Body() input: FullRegistrationDto) {
    return this.fullRegistration.execute(input);
  }

  @Get('accounts')
  @ApiQuery({ name: 'userId', type: String, format: 'uuid', required: true, description: 'Usuario exacto; devuelve cero o una cuenta sin credenciales.' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(AccessRole.ADMINISTRATOR)
  @ApiOperation({
    summary: 'Consultar cuenta por usuario',
    description:
      'Solo ADMINISTRADOR. Requiere userId UUID; devuelve cero o una cuenta sin hash ni credenciales. No equivale a consultar sanciones.',
  })
  @ApiOkResponse({ type: AccountsResponseDto })
  @ApiHttpErrors(400)
  async accountsForUser(@Query() input: ListAccountsDto) {
    return {
      items: (await this.getAccount.forUser(input.userId)).map(safeAccount),
    };
  }

  @ApiHttpErrors(400, 403, 404, 409)
  @Post('accounts')
  @ApiCreatedResponse({ type: AccessAccountResponseDto })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(AccessRole.ADMINISTRATOR)
  @ApiBody({ type: RegisterAccessAccountDto })
  @ApiOperation({
    summary: 'Registrar cuenta de acceso para un usuario aprobado',
  })
  @ApiExtension('x-implementation-status', 'implemented')
  register(@Body() input: RegisterAccessAccountDto) {
    return this.registerAccount.execute(input).then(safeAccount);
  }

  @ApiHttpErrors(400, 401, 404)
  @Post('authenticate')
  @ApiCreatedResponse({ type: AuthenticationResponseDto })
  @ApiBody({ type: AuthenticateAccountDto })
  @ApiOperation({ summary: 'Autenticar cuenta de acceso' })
  @ApiExtension('x-implementation-status', 'implemented')
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

  @ApiHttpErrors(400, 403, 404)
  @Get('accounts/:accountId')
  @ApiOkResponse({
    type: AccessAccountResponseDto,
    description:
      'Cuenta propia o consultada por un administrador; nunca incluye el hash de contraseña.',
  })
  @ApiOperation({ summary: 'Consultar cuenta de acceso' })
  @UseGuards(AuthGuard, RolesGuard)
  @ApiExtension('x-implementation-status', 'implemented')
  getById(
    @Param('accountId', new ParseUUIDPipe()) accountId: string,
    @CurrentUser() identity: AuthenticatedIdentity,
  ) {
    if (identity.accountId !== accountId && identity.role !== 'ADMINISTRADOR') {
      throw new ForbiddenException(
        'No tiene permisos para consultar esta cuenta.',
      );
    }
    return this.getAccount.execute({ accountId }).then(safeAccount);
  }

  @ApiHttpErrors(400, 404, 409)
  @Patch('accounts/:accountId')
  @ApiOperation({
    summary: 'Actualizar rol o acceso de una cuenta',
    description:
      'Solo ADMINISTRADOR. Guarda estado anterior, nuevo y actor en una transacción. Los JWT con rol anterior o cuenta deshabilitada se rechazan en la siguiente petición. No crea ni levanta sanciones de préstamo.',
  })
  @ApiBody({ type: UpdateAccessAccountDto })
  @ApiOkResponse({ type: AccessAccountResponseDto })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(AccessRole.ADMINISTRATOR)
  @ApiExtension('x-implementation-status', 'implemented')
  update(
    @Param('accountId', new ParseUUIDPipe()) accountId: string,
    @Body() input: UpdateAccessAccountDto,
    @CurrentUser() actor: AuthenticatedIdentity,
  ) {
    return this.updateAccount
      .execute({ accountId, role: input.role, enabled: input.enabled }, actor)
      .then(safeAccount);
  }
}
