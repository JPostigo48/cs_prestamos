import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import {
  Controller,
  Get,
  UseGuards,
  type ExecutionContext,
  type Type,
} from '@nestjs/common';
import {
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import type { OpenAPIObject, SchemaObject } from '@nestjs/swagger';
import { describe, expect, it, vi } from 'vitest';
import ts from 'typescript';
import {
  deriveAuthorization,
  type DocumentedOperation,
} from '../src/shared/presentation/openapi/authorization-metadata.js';
import { validateDocument } from '../src/shared/presentation/openapi/validate-document.js';
import { AuthGuard } from '../src/modules/auth/presentation/guards/auth.guard.js';
import { RolesGuard } from '../src/modules/auth/presentation/guards/roles.guard.js';
import { Roles } from '../src/modules/auth/presentation/decorators/roles.decorator.js';
import { AccessRole } from '../src/modules/auth/domain/entities/access-account.js';
import { AuthController } from '../src/modules/auth/presentation/controllers/auth.controller.js';
import { InventoryController } from '../src/modules/inventory/presentation/controllers/inventory.controller.js';
import { UsersController } from '../src/modules/users/presentation/controllers/users.controller.js';
import { RegistrationRequestsController } from '../src/modules/users/presentation/controllers/registration-requests.controller.js';
import { LoansController } from '../src/modules/loans/presentation/controllers/loans.controller.js';
import { RulesController } from '../src/modules/rules/presentation/controllers/rules.controller.js';
import { TermsController } from '../src/modules/rules/presentation/controllers/terms.controller.js';
import { PublicTermsController } from '../src/modules/rules/presentation/controllers/public-terms.controller.js';
import { ViolationsController } from '../src/modules/rules/presentation/controllers/violations.controller.js';
import { AppController } from '../src/app.controller.js';

vi.mock('dotenv/config', () => ({}));

const document = JSON.parse(
  readFileSync(new URL('../openapi.json', import.meta.url), 'utf8'),
) as OpenAPIObject;
const controllers: Type<unknown>[] = [
  AppController,
  AuthController,
  InventoryController,
  UsersController,
  RegistrationRequestsController,
  LoansController,
  RulesController,
  TermsController,
  PublicTermsController,
  ViolationsController,
];
const operations = Object.entries(document.paths).flatMap(([path, item]) =>
  (['get', 'post', 'put', 'patch', 'delete'] as const).flatMap((method) =>
    item?.[method]
      ? [{ path, method, operation: item[method] as DocumentedOperation }]
      : [],
  ),
);

function schema(name: string): SchemaObject {
  return document.components!.schemas![name] as SchemaObject;
}

describe('Contrato OpenAPI generado desde Nest', () => {
  it('publica términos sin autenticación y con matriz estructurada y versión histórica', () => {
    for (const path of ['/terms/current', '/terms/versions/{versionId}']) {
      const operation = document.paths[path]!.get! as DocumentedOperation;
      expect(operation['x-authentication']).toMatchObject({ required: false });
      expect(operation.responses['404']).toBeDefined();
      expect(operation.responses['200']).toMatchObject({
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/PublicTermsResponseDto' },
          },
        },
      });
    }
    expect(schema('PublicTermsResponseDto').properties).toHaveProperty(
      'policies',
    );
    expect(schema('PublicPolicyResponseDto').properties).toHaveProperty(
      'criteria',
    );
    expect(schema('PolicyCriteriaDto').properties).toHaveProperty('delayHours');
  });
  it('valida todas las operaciones, referencias y objetos anidados y mantiene ambas copias iguales', () => {
    expect(validateDocument(document)).toBe(operations.length);
    expect(
      readFileSync(
        new URL(
          '../../frontend/public/generated/project/openapi.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ).toBe(readFileSync(new URL('../openapi.json', import.meta.url), 'utf8'));
  });

  it.each(operations)(
    '$method $path: éxito, parámetros y autorización coinciden con metadata efectiva',
    ({ path, method, operation }) => {
      const controller = controllers.find((candidate) =>
        operation.operationId?.startsWith(`${candidate.name}_`),
      )!;
      expect(controller).toBeDefined();
      const name = operation.operationId!.slice(controller.name.length + 1);
      const handler = controller.prototype[name] as Function;
      const expected = deriveAuthorization(controller, handler);
      expect(operation['x-roles']).toEqual(expected['x-roles']);
      expect(operation['x-authentication']).toEqual(
        expected['x-authentication'],
      );
      expect(operation.security).toEqual(expected.security);
      const status =
        Reflect.getMetadata(HTTP_CODE_METADATA, handler) ??
        (method === 'post' ? 201 : 200);
      expect(operation.responses[String(status)]).toBeDefined();
      for (const [, parameter] of path.matchAll(/\{([^}]+)\}/g)) {
        expect(operation.parameters).toContainEqual(
          expect.objectContaining({
            name: parameter,
            in: 'path',
            required: true,
          }),
        );
      }
      expect(Reflect.hasMetadata(METHOD_METADATA, handler)).toBe(true);
      expect(Reflect.hasMetadata(PATH_METADATA, handler)).toBe(true);
    },
  );

  it('cada handler de los controllers reales está incluido (sin operaciones omitidas)', () => {
    const handlers = controllers.flatMap((controller) =>
      Object.getOwnPropertyNames(controller.prototype)
        .filter((name) =>
          Reflect.hasMetadata(METHOD_METADATA, controller.prototype[name]),
        )
        .map((name) => `${controller.name}_${name}`),
    );
    expect(
      operations.map(({ operation }) => operation.operationId).sort(),
    ).toEqual(handlers.sort());
  });

  it.each([
    [
      'auth',
      'access-account',
      'AccessAccount',
      'AccessAccountResponseDto',
      ['passwordHash'],
    ],
    ['loans', 'loan', 'Loan', 'LoanResponseDto', []],
    ['loans', 'loan', 'LoanReturn', 'LoanReturnResponseDto', []],
    ['loans', 'reservation', 'Reservation', 'ReservationResponseDto', []],
    [
      'users',
      'registration-request',
      'RegistrationRequest',
      'RegistrationRequestResponseDto',
      [],
    ],
    ['users', 'user', 'Sanction', 'SanctionResponseDto', []],
    ['users', 'user', 'UserTrustProfile', 'TrustProfileResponseDto', []],
    ['users', 'user', 'LoanEligibility', 'LoanEligibilityResponseDto', []],
    ['rules', 'usage-rule', 'UsageRule', 'UsageRuleResponseDto', []],
    ['rules', 'usage-rule', 'RuleVersion', 'RuleVersionResponseDto', []],
    ['rules', 'terms', 'TermsVersion', 'TermsVersionResponseDto', []],
    ['rules', 'terms', 'TermsAcceptance', 'TermsAcceptanceResponseDto', []],
    ['rules', 'violation', 'Violation', 'ViolationResponseDto', []],
    ['rules', 'appeal', 'Appeal', 'AppealResponseDto', []],
  ] as const)(
    '%s/%s: %s conserva todos los campos reales expuestos',
    (module, file, entity, dto, excluded) => {
      const source = ts.createSourceFile(
        file,
        readFileSync(
          new URL(
            `../src/modules/${module}/domain/entities/${file}.ts`,
            import.meta.url,
          ),
          'utf8',
        ),
        ts.ScriptTarget.Latest,
        true,
      );
      const declaration = source.statements.find(
        (node) =>
          (ts.isInterfaceDeclaration(node) ||
            ts.isTypeAliasDeclaration(node)) &&
          node.name.text === entity,
      )!;
      const members = ts.isInterfaceDeclaration(declaration)
        ? declaration.members
        : ts.isTypeAliasDeclaration(declaration) &&
            ts.isTypeLiteralNode(declaration.type)
          ? declaration.type.members
          : [];
      const fields = members
        .map((member) => member.name!.getText(source))
        .filter((name) => !(excluded as readonly string[]).includes(name));
      expect(Object.keys(schema(dto).properties!).sort()).toEqual(
        fields.sort(),
      );
      for (const member of members) {
        if (!ts.isPropertySignature(member) || !member.type) continue;
        const name = member.name.getText(source);
        if ((excluded as readonly string[]).includes(name)) continue;
        const field = schema(dto).properties![name] as SchemaObject;
        if (member.type.getText(source).includes('Date'))
          expect(field.format).toBe('date-time');
        if (member.type.getText(source).includes('null'))
          expect(field.nullable).toBe(true);
      }
    },
  );

  it('catálogo paginado, disponibilidad y reservas no usan contratos vacíos o inventados', () => {
    expect(
      document.paths['/inventory/resources']!.get!.responses['200'],
    ).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ResourcesPageResponseDto' },
        },
      },
    });
    expect(
      Object.keys(schema('ResourcesPageResponseDto').properties!).sort(),
    ).toEqual(['data', 'limit', 'page', 'total']);
    expect(
      Object.keys(schema('ResourceAvailabilityResponseDto').properties!).sort(),
    ).toEqual([
      'available',
      'disponibles',
      'noDisponibles',
      'prestados',
      'resourceId',
      'totalCopies',
    ]);
    expect(schema('CreateReservationDto').properties).toMatchObject({
      copyId: { format: 'uuid' },
      requestedAt: { type: 'string', format: 'date-time' },
    });
    expect(schema('ReturnLoanDto').properties!.returnedAt).toMatchObject({
      type: 'string',
      format: 'date-time',
    });
    expect(
      schema('LoanReturnResponseDto').properties!.returnedAt,
    ).toMatchObject({ type: 'string', format: 'date-time' });
    expect(
      document.paths['/loans/reservations/{reservationId}']!.delete!.responses[
        '200'
      ],
    ).toBeDefined();
    expect(
      document.paths['/loans/{loanId}/return']!.post!.responses['201'],
    ).toBeDefined();
  });

  it('entradas incluyen aliases, query y cuerpos administrativos reales', () => {
    expect(
      Object.keys(schema('SubmitRegistrationRequestDto').properties!).sort(),
    ).toEqual([
      'evidence',
      'evidencias',
      'identificadorInstitucional',
      'institutionalId',
      'name',
      'nombre',
      'tipoUsuario',
      'userType',
    ]);
    expect(
      schema('SubmitRegistrationRequestDto').properties!
        .identificadorInstitucional,
    ).toMatchObject({ type: 'string' });
    expect(
      schema('SubmitRegistrationRequestDto').properties!.evidencias,
    ).toMatchObject({ type: 'array', items: { type: 'string' } });
    expect(schema('UpdateAccessAccountDto').properties).toHaveProperty(
      'enabled',
    );
    for (const path of [
      '/inventory/resources',
      '/users',
      '/users/registration-requests',
    ]) {
      expect(document.paths[path]!.get!.parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'page', in: 'query' }),
          expect.objectContaining({ name: 'limit', in: 'query' }),
        ]),
      );
    }
  });

  it('texto plano y forma del filtro de errores son explícitos; auth nunca expone hashes', () => {
    expect(document.paths['/']!.get!.responses['200']).toMatchObject({
      content: { 'text/plain': { schema: { type: 'string' } } },
    });
    expect(schema('HttpErrorDto').required).toEqual([
      'statusCode',
      'error',
      'message',
      'path',
      'timestamp',
    ]);
    expect(schema('HttpErrorDto').properties!.message).toMatchObject({
      oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    });
    expect(JSON.stringify(document)).not.toContain('passwordHash');
    expect(
      (document.paths['/auth/authenticate']!.post! as DocumentedOperation)[
        'x-authentication'
      ],
    ).toMatchObject({ required: false, scope: 'public' });
  });

  it('rechaza referencias rotas, objetos vacíos y éxitos sin esquema; admite 204 sin cuerpo', () => {
    const copy = () => structuredClone(document);
    const broken = copy();
    broken.components!.schemas!.Broken = {
      $ref: '#/components/schemas/Absent',
    };
    expect(() => validateDocument(broken)).toThrow('no resoluble');
    const empty = copy();
    empty.components!.schemas!.Broken = { type: 'object' };
    expect(() => validateDocument(empty)).toThrow('Objeto vacío');
    const missing = copy();
    missing.paths['/']!.get!.responses['200'] = { description: '' };
    expect(() => validateDocument(missing)).toThrow('incompleto');
    const noBody = copy();
    noBody.paths['/']!.get!.responses = {
      '204': { description: 'Sin cuerpo' },
    };
    expect(() => validateDocument(noBody)).not.toThrow();
    noBody.paths['/']!.get!.responses['204'] = {
      description: '',
      content: { 'application/json': { schema: { type: 'string' } } },
    };
    expect(() => validateDocument(noBody)).toThrow('sin cuerpo');
  });
});

@Controller('metadata-fixture')
@UseGuards(AuthGuard, RolesGuard)
@Roles(AccessRole.ADMINISTRATOR)
class GuardFixture {
  @Get() inherited() {}
  @Get('override') @Roles(AccessRole.OPERATOR) overridden() {}
  @Get('any') @Roles() anyAuthenticated() {}
}

@Controller('unguarded-fixture')
class UnguardedFixture {
  @Get() @Roles(AccessRole.ADMINISTRATOR) decorativeRolesOnly() {}
  @Get('combined')
  @UseGuards(RolesGuard)
  @Roles(AccessRole.OPERATOR)
  combined() {}
}

describe('Derivación de guards y override real de RolesGuard', () => {
  it('hereda roles de controller, reemplaza en método y admite override vacío', () => {
    expect(
      deriveAuthorization(GuardFixture, GuardFixture.prototype.inherited)[
        'x-roles'
      ],
    ).toEqual([AccessRole.ADMINISTRATOR]);
    expect(
      deriveAuthorization(GuardFixture, GuardFixture.prototype.overridden)[
        'x-roles'
      ],
    ).toEqual([AccessRole.OPERATOR]);
    const any = deriveAuthorization(
      GuardFixture,
      GuardFixture.prototype.anyAuthenticated,
    );
    expect(any['x-roles']).toEqual([]);
    expect(any['x-authentication']).toMatchObject({
      required: true,
      scope: 'authenticated',
      description: expect.stringContaining('Cualquier usuario autenticado'),
    });
  });

  it('no aplica Roles sin guard y combina guard global con guard del método', () => {
    expect(
      deriveAuthorization(
        UnguardedFixture,
        UnguardedFixture.prototype.decorativeRolesOnly,
      ),
    ).toMatchObject({
      'x-roles': [],
      security: [],
      'x-authentication': { required: false, scope: 'public' },
    });
    expect(
      deriveAuthorization(
        UnguardedFixture,
        UnguardedFixture.prototype.combined,
        [AuthGuard],
      ),
    ).toMatchObject({
      'x-roles': [AccessRole.OPERATOR],
      security: [{ bearer: [] }],
      'x-authentication': { guards: ['AuthGuard', 'RolesGuard'] },
    });
  });

  it.each([
    ['inherited', AccessRole.ADMINISTRATOR, true],
    ['inherited', AccessRole.OPERATOR, false],
    ['overridden', AccessRole.ADMINISTRATOR, false],
    ['overridden', AccessRole.OPERATOR, true],
    ['anyAuthenticated', AccessRole.USER, true],
  ] as const)(
    '%s/%s coincide con la ejecución del guard real',
    (name, role, allowed) => {
      const handler = GuardFixture.prototype[name];
      const context = {
        getHandler: () => handler,
        getClass: () => GuardFixture,
        switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
      } as unknown as ExecutionContext;
      const guard = new RolesGuard(new Reflector());
      const roles = deriveAuthorization(GuardFixture, handler)['x-roles'];
      expect(!roles.length || roles.includes(role)).toBe(allowed);
      if (allowed) expect(guard.canActivate(context)).toBe(true);
      else expect(() => guard.canActivate(context)).toThrow();
    },
  );
});
