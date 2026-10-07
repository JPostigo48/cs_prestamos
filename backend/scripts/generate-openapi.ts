import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Module, type Type } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants.js';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module.js';

function collectControllers(
  module: Type<unknown>,
  visited = new Set<Type<unknown>>(),
): Type<unknown>[] {
  if (visited.has(module)) return [];
  visited.add(module);

  const controllers = (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, module) ?? []) as Type<unknown>[];
  const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, module) ?? []) as Type<unknown>[];
  return [...controllers, ...imports.flatMap((dependency) => collectControllers(dependency, visited))];
}

// Lee las rutas sin inicializar proveedores ni abrir una conexión a PostgreSQL.
@Module({
  controllers: collectControllers(AppModule),
})
class ApiDocumentationModule {}

interface DocumentOperation {
  parameters?: {
    name: string;
    in: string;
    required?: boolean;
    schema?: { type: string };
  }[];
  'x-implementation-status'?: 'implemented' | 'pending';
}

const app = await NestFactory.create(ApiDocumentationModule, { logger: false });

try {
  const config = new DocumentBuilder()
    .setTitle('CS Préstamos — API')
    .setDescription('Contratos HTTP declarados en el backend. El estado de implementación se indica por operación.')
    .setVersion('0.1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);

  for (const [path, methods] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(methods ?? {})) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;

      const entry = operation as DocumentOperation;
      entry['x-implementation-status'] ??= 'pending';
      entry.parameters ??= [];

      for (const [, name] of path.matchAll(/\{([^}]+)\}/g)) {
        if (entry.parameters.some((parameter) => parameter.in === 'path' && parameter.name === name)) continue;
        entry.parameters.push({
          name,
          in: 'path',
          required: true,
          schema: { type: 'string' },
        });
      }
    }
  }

  writeFileSync(
    fileURLToPath(new URL('../openapi.json', import.meta.url)),
    `${JSON.stringify(document, null, 2)}\n`,
  );
} finally {
  await app.close();
}
