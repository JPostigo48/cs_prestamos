import type { OpenAPIObject } from '@nestjs/swagger';
import type { DocumentedOperation } from './authorization-metadata.js';

/** Rechaza contratos vacíos antes de publicar las dos copias del documento. */
export function validateDocument(document: OpenAPIObject): number {
  const root = document as unknown as Record<string, unknown>;
  function visit(value: unknown, location: string): void {
    if (!value || typeof value !== 'object') return;
    const node = value as Record<string, unknown>;
    if (typeof node.$ref === 'string') {
      if (!node.$ref.startsWith('#/'))
        throw new Error(`Referencia externa no soportada en ${location}`);
      let target: unknown = root;
      for (const part of node.$ref.slice(2).split('/')) {
        target = (target as Record<string, unknown> | undefined)?.[
          part.replaceAll('~1', '/').replaceAll('~0', '~')
        ];
      }
      if (!target)
        throw new Error(`Referencia no resoluble ${node.$ref} en ${location}`);
    }
    if (node.type === 'array' && !node.items)
      throw new Error(`Array sin items en ${location}`);
    if (
      node.type === 'object' &&
      !node.properties &&
      !node.additionalProperties &&
      !node.allOf
    ) {
      throw new Error(`Objeto vacío en ${location}`);
    }
    for (const [key, child] of Object.entries(node))
      visit(child, `${location}/${key}`);
  }
  visit(document, '#');
  let count = 0;
  for (const [path, item] of Object.entries(document.paths)) {
    for (const method of [
      'get',
      'post',
      'put',
      'patch',
      'delete',
      'options',
      'head',
    ] as const) {
      const operation = item?.[method] as DocumentedOperation | undefined;
      if (!operation) continue;
      count++;
      const successes = Object.entries(operation.responses).filter(([code]) =>
        /^2\d\d$/.test(code),
      );
      if (!successes.length)
        throw new Error(`Sin respuesta exitosa: ${method} ${path}`);
      for (const [code, response] of successes) {
        if (!response)
          throw new Error(`Respuesta indefinida: ${method} ${path} ${code}`);
        if ('$ref' in response) continue;
        if (code === '204' || method === 'head') {
          if (response.content)
            throw new Error(
              `Respuesta sin cuerpo con content: ${method} ${path}`,
            );
          continue;
        }
        const media = Object.values(response.content ?? {});
        if (
          !media.length ||
          media.some(
            (entry) => !entry.schema || !Object.keys(entry.schema).length,
          )
        ) {
          throw new Error(
            `Esquema exitoso incompleto: ${method} ${path} ${code}`,
          );
        }
      }
      const auth = operation['x-authentication'] as
        { required: boolean } | undefined;
      if (!auth || !Array.isArray(operation['x-roles']))
        throw new Error(`Falta autorización: ${method} ${path}`);
      if (
        Boolean(operation.security?.some((entry) => 'bearer' in entry)) !==
        auth.required
      ) {
        throw new Error(`Bearer inconsistente: ${method} ${path}`);
      }
    }
  }
  return count;
}
