import 'reflect-metadata';
import { Body, Controller, Post, Req, ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { FullRegistrationDto } from '../src/modules/auth/presentation/dto/full-registration.dto.js';
import { FullRegistrationUseCase } from '../src/modules/auth/application/use-cases/full-registration.use-case.js';
import { UserType } from '../src/modules/users/domain/entities/registration-request.js';
import { installRequestBodyParser, REGISTRATION_JSON_LIMIT } from '../src/shared/infrastructure/http/request-body-parser.js';
import { HttpExceptionFilter } from '../src/shared/infrastructure/filters/http-exception.filter.js';

const submit = vi.fn().mockResolvedValue({ id: 'pending', status: 'PENDIENTE' });
const hash = vi.fn().mockResolvedValue('hash');
const upload = vi.fn().mockResolvedValue(undefined);
const useCase = new FullRegistrationUseCase({ submit }, { hash } as any, { upload, remove: vi.fn() } as any);
@Controller()
class TransportController {
  @Post('auth/registration-requests')
  register(@Body() body: FullRegistrationDto) { return useCase.execute(body); }
  @Post('other')
  other(@Body() body: unknown) { return body; }
  @Post('webhook')
  webhook(@Req() req: { rawBody: Buffer }) { return { raw: req.rawBody.toString('base64') }; }
}
Reflect.defineMetadata('design:paramtypes', [FullRegistrationDto], TransportController.prototype, 'register');
function pdf(size: number) {
  const bytes = Buffer.alloc(size, 32);
  bytes.write('%PDF-1.7\n'); bytes.write('\n%%EOF', size - 6);
  return 'data:application/pdf;base64,' + bytes.toString('base64');
}
const fixture = () => ({
  name: 'Nombre completo', email: '  NEW@UNSA.EDU.PE ', password: ' legitimate password ',
  userType: UserType.DOCENTE, institutionalId: ' DOC-A ', phone: ' 999123456 ',
  evidence: [pdf(100)], termsVersionId: '123e4567-e89b-42d3-a456-426614174003',
});
describe.each(['', '/api'])('real HTTP transport in memory, prefix %s, no DB', (prefix) => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [TransportController] }).compile();
    app = module.createNestApplication({ bodyParser: false });
    if (prefix) app.setGlobalPrefix(prefix.slice(1));
    installRequestBodyParser(app, prefix, true);
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });
  afterAll(async () => { await app.close(); });
  const post = (path: string) => request(app.getHttpServer()).post(prefix + path);
  it('passes a complete 10 MiB PDF plus bounded fields through parser, DTO and application', async () => {
    const body = { ...fixture(), evidence: [pdf(10 * 1024 * 1024)] };
    expect(body.evidence[0].split(',')[1].length).toBe(13_981_016);
    await post('/auth/registration-requests').send(body).expect(201);
    expect(upload).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ buffer: expect.any(Buffer) }), expect.any(String));
    expect(submit).toHaveBeenLastCalledWith(expect.objectContaining({ email: 'new@unsa.edu.pe', institutionalId: 'DOC-A', phone: '999123456' }));
    expect(hash).toHaveBeenLastCalledWith(' legitimate password ');
  });
  it('accepts JSON greater than 80 KiB, rejects PDF 10 MiB + 1 in domain before upload', async () => {
    const body = { ...fixture(), evidence: [pdf(61_500)] };
    expect(Buffer.byteLength(JSON.stringify(body))).toBeGreaterThan(80 * 1024);
    await post('/auth/registration-requests').send(body).expect(201);
    const calls = upload.mock.calls.length;
    await post('/auth/registration-requests').send({ ...fixture(), evidence: [pdf(10 * 1024 * 1024 + 1)] }).expect(400);
    expect(upload).toHaveBeenCalledTimes(calls);
  });
  it('passes a real 60 KiB JPEG (~80 KiB JSON) and rejects 60 KiB + 1 or false PDF signature before effects', async () => {
    const original = await sharp({ create: { width: 1, height: 1, channels: 3, background: '#fff' } }).jpeg().toBuffer();
    const jpeg = (size: number) => {
      const payload = Buffer.alloc(size - original.length - 4, 32);
      const header = Buffer.from([0xff, 0xfe, 0, 0]);
      header.writeUInt16BE(payload.length + 2, 2);
      return Buffer.concat([original.subarray(0, 2), header, payload, original.subarray(2)]);
    };
    const body = { ...fixture(), evidence: ['data:image/jpeg;base64,' + jpeg(60 * 1024).toString('base64')] };
    expect(Buffer.byteLength(JSON.stringify(body))).toBeGreaterThan(80 * 1024);
    await post('/auth/registration-requests').send(body).expect(201);
    const calls = hash.mock.calls.length;
    await post('/auth/registration-requests').send({ ...fixture(), evidence: ['data:image/jpeg;base64,' + jpeg(60 * 1024 + 1).toString('base64')] }).expect(400);
    await post('/auth/registration-requests').send({ ...fixture(), evidence: ['data:application/pdf;base64,' + Buffer.from('not a PDF %%EOF').toString('base64')] }).expect(400);
    expect(hash).toHaveBeenCalledTimes(calls);
  });
  it('returns understandable JSON 413, never HTML or stack', async () => {
    const response = await post('/auth/registration-requests').send({ ...fixture(), evidence: ['x'.repeat(REGISTRATION_JSON_LIMIT)] }).expect(413);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body).toMatchObject({ statusCode: 413, message: expect.stringContaining('15 MiB') });
    expect(response.text).not.toMatch(/<!doctype|<html|stack|SyntaxError/i);
  });
  it('keeps the other routes at 100 KiB and preserves exact raw webhook bytes', async () => {
    await post('/other').send({ value: 'x'.repeat(80 * 1024) }).expect(201);
    await post('/other').send({ value: 'x'.repeat(101 * 1024) }).expect(413);
    const raw = '{ "event": "á", "n": 1 }';
    const response = await post('/webhook').set('Content-Type', 'application/json').send(raw).expect(201);
    expect(response.body.raw).toBe(Buffer.from(raw).toString('base64'));
    await post('/other').set('Content-Type', 'application/json').send('{invalid').expect(400);
  });
  it.each(['name', 'email', 'password', 'userType', 'institutionalId', 'phone', 'evidence', 'termsVersionId'])('requires %s with field errors for missing/null/empty/blank', async (key) => {
    for (const value of [undefined, null, '', '   ']) {
      const body = { ...fixture(), [key]: value };
      const response = await post('/auth/registration-requests').send(body).expect(400);
      expect(response.body.message.join(' ')).toContain(key);
    }
  });
  it.each(['user@evil.pe', 'user@sub.unsa.edu.pe', 'user@unsa.edu.pe.evil', 'user@unsa.edu.pe ', 'user@@unsa.edu.pe', 'user name@unsa.edu.pe'])('email rejects invalid domains/syntax (except outer trim): %s', async (email) => {
    await post('/auth/registration-requests').send({ ...fixture(), email }).expect(email === 'user@unsa.edu.pe ' ? 201 : 400);
  });
  it.each(['        ', '\u2003\u2003\u2003\u2003\u2003\u2003\u2003\u2003'])('rejects whitespace password without hashing', async (password) => {
    const calls = hash.mock.calls.length;
    await post('/auth/registration-requests').send({ ...fixture(), password }).expect(400);
    await expect(useCase.execute({ ...fixture(), password })).rejects.toMatchObject({ status: 400 });
    expect(hash).toHaveBeenCalledTimes(calls);
  });
});
