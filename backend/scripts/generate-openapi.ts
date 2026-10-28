import 'reflect-metadata';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { Module, type Type, type CanActivate } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants.js';
import { NestFactory, type ApplicationConfig } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  deriveAuthorization,
  type DocumentedOperation,
} from '../src/shared/presentation/openapi/authorization-metadata.js';
import { validateDocument } from '../src/shared/presentation/openapi/validate-document.js';
import {
  HttpErrorDto,
  UnhandledErrorDto,
} from '../src/shared/presentation/dto/http-error.dto.js';
import { ApiExtraModels, getSchemaPath } from '@nestjs/swagger';

// PrismaService importa dotenv/config. Anular ese módulo ANTES de importar AppModule
// evita incluso la lectura de archivos de entorno. No se inicializan proveedores.
const require = createRequire(import.meta.url);
const dotenvConfig = require.resolve('dotenv/config');
require.cache[dotenvConfig] = { exports: {}, loaded: true } as NodeModule;
process.env.DATABASE_URL = 'postgresql://openapi:openapi@127.0.0.1:1/openapi';
const { AppModule } = await import('../src/app.module.js');

function collectControllers(
  module: Type<unknown>,
  visited = new Set<Type<unknown>>(),
): Type<unknown>[] {
  if (visited.has(module)) return [];
  visited.add(module);

  const controllers = (Reflect.getMetadata(
    MODULE_METADATA.CONTROLLERS,
    module,
  ) ?? []) as Type<unknown>[];
  const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, module) ??
    []) as Type<unknown>[];
  return [
    ...controllers,
    ...imports.flatMap((dependency) => collectControllers(dependency, visited)),
  ];
}

// Lee las rutas sin inicializar proveedores ni abrir una conexión a PostgreSQL.
@ApiExtraModels(HttpErrorDto)
@Module({
  controllers: collectControllers(AppModule),
})
class ApiDocumentationModule {}

// APP_GUARD forma parte del runtime de Nest aunque el módulo documental no
// instancie proveedores. No ignorar silenciosamente factories desconocidas.
function collectGlobalGuards(
  module: Type<unknown>,
  visited = new Set<Type<unknown>>(),
): (Type<CanActivate> | CanActivate)[] {
  if (visited.has(module)) return [];
  visited.add(module);
  const providers =
    Reflect.getMetadata(MODULE_METADATA.PROVIDERS, module) ?? [];
  const guards = providers
    .filter(
      (provider: { provide?: string }) => provider?.provide === 'APP_GUARD',
    )
    .map(
      (provider: { useClass?: Type<CanActivate>; useValue?: CanActivate }) => {
        const guard = provider.useClass ?? provider.useValue;
        if (!guard)
          throw new Error(
            'APP_GUARD con factory/alias requiere resolución explícita del runtime.',
          );
        return guard;
      },
    );
  return [
    ...guards,
    ...(Reflect.getMetadata(MODULE_METADATA.IMPORTS, module) ?? []).flatMap(
      (dependency: Type<unknown>) => collectGlobalGuards(dependency, visited),
    ),
  ];
}

const app = await NestFactory.create(ApiDocumentationModule, { logger: false });

try {
  const config = new DocumentBuilder()
    .setTitle('CS Préstamos — API')
    .setDescription(
      'Contratos HTTP declarados en el backend. El estado de implementación se indica por operación.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const controllers = collectControllers(AppModule);
  const runtimeConfig = (app as unknown as { config: ApplicationConfig })
    .config;
  const globalGuards = [
    ...collectGlobalGuards(AppModule),
    ...runtimeConfig.getGlobalGuards(),
  ];
  const sources = new Map<
    string,
    { controller: Type<unknown>; handler: Function }
  >();
  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [HttpErrorDto, UnhandledErrorDto],
    operationIdFactory: (controllerName, methodName) => {
      const controller = controllers.find(
        (candidate) => candidate.name === controllerName,
      );
      if (!controller)
        throw new Error(`Controller desconocido: ${controllerName}`);
      const operationId = `${controllerName}_${methodName}`;
      sources.set(operationId, {
        controller,
        handler: controller.prototype[methodName],
      });
      return operationId;
    },
  });

  for (const [path, methods] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(methods ?? {})) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;

      const entry = operation as DocumentedOperation;
      const source = sources.get(entry.operationId!);
      if (!source) throw new Error(`Falta fuente Nest: ${method} ${path}`);
      Object.assign(
        entry,
        deriveAuthorization(source.controller, source.handler, globalGuards),
      );
      entry['x-implementation-status'] ??= 'implemented';
      entry.parameters ??= [];

      const auth = entry['x-authentication'] as {
        required: boolean;
        scope: string;
      };
      const statuses = [
        ...(auth.required ? [401] : []),
        ...(auth.scope === 'roles' ? [403] : []),
      ];
      for (const status of statuses)
        entry.responses[status] ??= {
          description:
            status === 401
              ? 'Token bearer requerido o inválido.'
              : 'Rol no autorizado.',
          content: {
            'application/json': {
              schema: { $ref: getSchemaPath(HttpErrorDto) },
            },
          },
        };
      // Las excepciones no HTTP no pasan por HttpExceptionFilter. No atribuirles
      // falsamente path/timestamp; ambos contratos 500 pueden ocurrir.
      entry.responses['500'] = {
        description:
          'Error interno HTTP normalizado o excepción no HTTP manejada por Nest.',
        content: {
          'application/json': {
            schema: {
              oneOf: [
                { $ref: getSchemaPath(HttpErrorDto) },
                { $ref: getSchemaPath(UnhandledErrorDto) },
              ],
            },
          },
        },
      };

      for (const [, name] of path.matchAll(/\{([^}]+)\}/g)) {
        if (
          entry.parameters.some(
            (parameter) =>
              'in' in parameter &&
              parameter.in === 'path' &&
              parameter.name === name,
          )
        )
          continue;
        entry.parameters.push({
          name,
          in: 'path',
          required: true,
          schema: { type: 'string' },
        });
      }
    }
  }

  const count = validateDocument(document);

  const generated = `${JSON.stringify(document, null, 2)}\n`;
  const backendFile = fileURLToPath(
    new URL('../openapi.json', import.meta.url),
  );
  const frontendFile = fileURLToPath(
    new URL(
      '../../frontend/public/generated/project/openapi.json',
      import.meta.url,
    ),
  );

  if (process.argv.includes('--check')) {
    for (const file of [backendFile, frontendFile]) {
      try {
        if (readFileSync(file, 'utf8').replace(/\r\n/g, '\n') !== generated) {
          throw new Error(
            `OpenAPI desactualizado: ${file}. Ejecuta npm run project:generate.`,
          );
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          throw new Error(`Falta ${file}. Ejecuta npm run project:generate.`, {
            cause: error,
          });
        }
        throw error;
      }
    }
  } else {
    writeFileSync(backendFile, generated);
  }
  console.log(
    `OpenAPI: ${count} operaciones ${process.argv.includes('--check') ? 'verificadas' : 'generadas'} sin conexiones ni carga de entorno.`,
  );
} finally {
  await app.close();
}
