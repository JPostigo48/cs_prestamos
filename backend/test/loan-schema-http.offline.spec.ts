import 'reflect-metadata';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Controller, Get, Inject, Post, ServiceUnavailableException, BadRequestException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpExceptionFilter } from '../src/shared/infrastructure/filters/http-exception.filter.js';
import { SchemaCapabilities, SchemaCapabilityUnavailableException } from '../src/shared/infrastructure/prisma/schema-capabilities.js';
import { installRequestBodyParser } from '../src/shared/infrastructure/http/request-body-parser.js';

const requireBundle = vi.fn();
@Controller('fixture')
class CapabilityController {
  constructor(@Inject(SchemaCapabilities) private readonly capabilities: SchemaCapabilities) {}
  @Get()
  async read() { return this.capabilities.assert('loanClosure', 'loans.close'); }
  @Post()
  write() { return {}; }
}

function project(response: { status: number; text: string }) {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../../frontend/tests/helpers/schema-http-bridge.mjs', import.meta.url))], {
    input: JSON.stringify({ status: response.status, text: response.text }), encoding: 'utf8',
  });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout);
}
const safeKeys = ['statusCode', 'code', 'operation', 'diagnostic', 'message'];
const normalKeys = ['statusCode', 'error', 'message', 'path', 'timestamp'];
const generic = 'No pudimos comunicarnos con el servicio. Intenta consultar de nuevo. Si estabas enviando una solicitud, verifica su estado antes de repetirla.';

describe('Productive HTTP filter → real JSON → frontend client/presenter, offline', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CapabilityController],
      providers: [{ provide: SchemaCapabilities, useValue: { assert: requireBundle } }],
    }).compile();
    app = module.createNestApplication({ bodyParser: false });
    installRequestBodyParser(app);
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  beforeEach(() => { requireBundle.mockReset(); });
  afterAll(async () => { await app.close(); });

  it.each(['SCHEMA_INCOMPLETE', 'SCHEMA_UNKNOWN'] as const)('preserves exactly five safe fields and actionable client message: %s', async (diagnostic) => {
    const exception = new SchemaCapabilityUnavailableException('loans.close', diagnostic);
    requireBundle.mockImplementation(() => { throw exception; });
    const response = await request(app.getHttpServer()).get('/fixture').expect(503);
    expect(requireBundle).toHaveBeenCalledWith('loanClosure', 'loans.close');
    expect(response.headers['content-type']).toContain('application/json');
    expect(Object.keys(response.body)).toEqual(safeKeys);
    expect(response.body).toEqual(exception.getResponse());
    const projected = project(response);
    expect(projected).toEqual({ status: 503, code: 'SCHEMA_CAPABILITY_UNAVAILABLE', operation: 'loans.close', diagnostic,
      message: 'La operación no está disponible temporalmente. Intente nuevamente más tarde. [SCHEMA_CAPABILITY_UNAVAILABLE: loans.close]',
      presented: 'La operación no está disponible temporalmente. Intente nuevamente más tarde. [SCHEMA_CAPABILITY_UNAVAILABLE: loans.close]' });
  });

  it.each(['SCHEMA_INCOMPLETE', 'SCHEMA_UNKNOWN'] as const)('does not spread provider details or reflect an arbitrary message: %s', async (diagnostic) => {
    const exception = new SchemaCapabilityUnavailableException('loans.close', diagnostic);
    const expected = structuredClone(exception.getResponse());
    Object.assign(exception.getResponse(), { message: 'SQL provider secret', code: 'unsafe', statusCode: 200, reason: 'private', cause: 'private', stack: 'private', sql: 'private' });
    requireBundle.mockImplementation(() => { throw exception; });
    const response = await request(app.getHttpServer()).get('/fixture').expect(503);
    expect(response.body).toEqual(expected);
    expect(Object.keys(response.body)).toEqual(safeKeys);
    expect(response.text).not.toMatch(/SQL|private|secret|reason|cause|stack/);
  });

  it.each([null, {}, ['loans.close'], 'SELECT * FROM secret', 'https://user:password@host', '<script>', 'x'.repeat(200)])('sanitizes invalid operation %j and unknown diagnostic', async (operation) => {
    const exception = new SchemaCapabilityUnavailableException('loans.close', 'SCHEMA_UNKNOWN');
    Object.assign(exception.getResponse(), { operation, diagnostic: 'SQL secret' });
    requireBundle.mockImplementation(() => { throw exception; });
    const response = await request(app.getHttpServer()).get('/fixture').expect(503);
    expect(response.body).toEqual(new SchemaCapabilityUnavailableException('schema.unavailable', 'SCHEMA_UNKNOWN').getResponse());
  });

  it('keeps ordinary 503 in its original format, ignores spoofed capability fields and presents generic failure', async () => {
    requireBundle.mockImplementation(() => { throw new ServiceUnavailableException({ message: 'Servicio temporalmente no disponible', code: 'SCHEMA_CAPABILITY_UNAVAILABLE', operation: 'loans.close', diagnostic: 'SCHEMA_INCOMPLETE', cause: 'private' }); });
    const response = await request(app.getHttpServer()).get('/fixture').expect(503);
    expect(Object.keys(response.body)).toEqual(normalKeys);
    expect(response.body).toMatchObject({ statusCode: 503, message: 'Servicio temporalmente no disponible', path: '/fixture' });
    const projected = project(response);
    expect(projected.code).toBeUndefined();
    expect(projected.presented).toBe(generic);
    expect(response.text).not.toContain('private');
  });

  it('preserves validation arrays and normal error shape without extra fields', async () => {
    requireBundle.mockImplementation(() => { throw new BadRequestException({ message: ['Campo requerido', 'Campo inválido'], secret: 'private' }); });
    const response = await request(app.getHttpServer()).get('/fixture').expect(400);
    expect(Object.keys(response.body)).toEqual(normalKeys);
    expect(response.body.message).toEqual(['Campo requerido', 'Campo inválido']);
    expect(project(response).presented).toBe('Campo requerido Campo inválido');
    expect(response.text).not.toContain('private');
  });

  it('preserves actual parser 413 JSON and its frontend message', async () => {
    const response = await request(app.getHttpServer()).post('/fixture').send({ value: 'x'.repeat(101 * 1024) }).expect(413);
    expect(Object.keys(response.body)).toEqual(normalKeys);
    expect(response.body.message).toContain('15 MiB');
    expect(project(response)).toEqual({ status: 413, message: response.body.message, presented: response.body.message });
    expect(requireBundle).not.toHaveBeenCalled();
  });
});
