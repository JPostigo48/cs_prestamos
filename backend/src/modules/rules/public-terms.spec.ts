import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
vi.mock('dotenv/config', () => ({}));
import { inMemoryPrisma } from '../../../test/helpers/in-memory-prisma.js';
import { seedRules } from '../../../prisma/seeds/rules.seed.js';
import { OFFICIAL_POLICIES } from './domain/official-policy.catalog.js';
import { PrismaTermsRepository } from './infrastructure/persistence/prisma/prisma-terms.repository.js';
import { ReadPublicTermsUseCase } from './application/use-cases/read-public-terms.use-case.js';
import { PublicTermsController } from './presentation/controllers/public-terms.controller.js';

const text = await readFile(
  new URL(
    '../../../../docs/requirements/terms-and-conditions.md',
    import.meta.url,
  ),
  'utf8',
);
type Memory = ReturnType<typeof inMemoryPrisma>;
const client = (db: Memory) =>
  ({ ...db.client, sql: db.sql }) as unknown as Parameters<typeof seedRules>[0];
const repository = (db: Memory) => new PrismaTermsRepository(db as never);
const snapshot = (db: Memory) =>
  structuredClone(
    Object.fromEntries(
      [
        'categorias_recurso',
        'reglas_uso',
        'versiones_regla',
        'versiones_terminos',
      ].map((table) => [table, db.rows(table)]),
    ),
  );

describe('Lectura pública de términos y comprobación previa offline', () => {
  it('simula todos los faltantes sin enviar una sola consulta mutante', async () => {
    const db = inMemoryPrisma();
    const before = snapshot(db);
    const result = await seedRules(client(db), text, { dryRun: true });
    expect(result).toMatchObject({
      createdCategories: 3,
      createdRules: 29,
      createdVersions: 29,
      createdTerms: 1,
    });
    expect(db.calls.every((call) => call.operation === 'select')).toBe(true);
    expect(snapshot(db)).toEqual(before);
  });

  it('simula una segunda pasada y detecta conflicto sin mutaciones', async () => {
    const db = inMemoryPrisma();
    await seedRules(client(db), text);
    const before = snapshot(db);
    db.calls.length = 0;
    expect(await seedRules(client(db), text, { dryRun: true })).toMatchObject({
      createdCategories: 0,
      createdRules: 0,
      createdTerms: 0,
    });
    expect(snapshot(db)).toEqual(before);
    expect(db.calls.every((call) => call.operation === 'select')).toBe(true);
    await expect(
      seedRules(client(db), text + '\nCambio no autorizado', { dryRun: true }),
    ).rejects.toThrow('Conflicto');
    expect(snapshot(db)).toEqual(before);
  });

  it('ausencia clara y 404 sin recurrir a semilla en memoria', async () => {
    const db = inMemoryPrisma();
    expect(await repository(db).readPublicVersion()).toBeNull();
    await expect(
      new ReadPublicTermsUseCase(repository(db)).execute(),
    ).rejects.toMatchObject({ status: 404 });
    expect(db.calls.every((call) => call.operation === 'select')).toBe(true);
  });

  it('lee contenido, 29 versiones y criterios reales sin datos personales', async () => {
    const db = inMemoryPrisma();
    await seedRules(client(db), text);
    db.calls.length = 0;
    const controller = new PublicTermsController(
      new ReadPublicTermsUseCase(repository(db)),
    );
    const terms = await controller.current();
    expect(terms).toMatchObject({
      number: 1,
      content: text,
      policiesStatus: 'COMPLETE',
    });
    expect(terms.policies).toHaveLength(29);
    expect(
      terms.policies.find((p) => p.key === 'R-TAR:ELECTRONICOS:LEVE'),
    ).toMatchObject({
      penaltyPoints: 10,
      suspensionDays: 7,
      criteria: { delayHours: { exclusiveMin: 0, inclusiveMax: 1 } },
    });
    expect(terms.policies.find((p) => p.kind === 'LOSS')).toMatchObject({
      penaltyPoints: null,
      trustEffect: 'SET_ZERO',
      suspensionType: 'INDEFINIDA',
      suspensionDays: null,
    });
    expect(
      db.calls.every(
        (call) =>
          call.operation === 'select' &&
          ['versiones_terminos', 'versiones_regla'].includes(call.table),
      ),
    ).toBe(true);
  });

  it('no adjunta versiones activas futuras a términos históricos ni expone metadatos arbitrarios', async () => {
    const db = inMemoryPrisma();
    await seedRules(client(db), text);
    const oldTerms = db.rows('versiones_terminos')[0]!;
    const original = db.rows('versiones_regla')[0]!;
    const futureId = '11111111-2222-4333-8444-555555555555';
    const description = {
      ...JSON.parse(original.descripcion),
      privateField: 'no-publicar',
    };
    original.descripcion = JSON.stringify(description);
    db.rows('versiones_regla').push({
      ...original,
      id: futureId,
      numero: 2,
      penalizacionPorcentual: '99.00',
    });
    const old = await repository(db).readPublicVersion(oldTerms.id);
    expect(old!.policies).toHaveLength(29);
    expect(old!.policies.some((p) => p.id === futureId)).toBe(false);
    expect(JSON.stringify(old)).not.toContain('no-publicar');
    db.rows('versiones_terminos').push({
      id: '22222222-2222-4333-8444-555555555555',
      numero: 2,
      titulo: 'Nueva',
      contenido: `Texto nuevo\n<!-- epcc.policy-versions/v1: ["${futureId}"] -->`,
    });
    const current = await repository(db).readPublicVersion();
    expect(current).toMatchObject({ number: 2, policiesStatus: 'COMPLETE' });
    expect(current!.policies).toHaveLength(1);
    expect(current!.policies[0]).toMatchObject({
      id: futureId,
      penaltyPoints: 99,
    });
    expect(
      (await repository(db).readPublicVersion(oldTerms.id))!.policies[0]!
        .penaltyPoints,
    ).toBe(10);
  });

  it('no infiere asociaciones sin manifiesto y declara matrices incompletas o inválidas', async () => {
    const db = inMemoryPrisma();
    await seedRules(client(db), text);
    db
      .rows('versiones_regla')
      .find((row) => row.id === OFFICIAL_POLICIES[0]!.versionId)!.descripcion =
      '{inválido';
    expect(await repository(db).readPublicVersion()).toMatchObject({
      policiesStatus: 'INCOMPLETE',
    });
    db.rows('versiones_terminos').push({
      id: 'next',
      numero: 3,
      titulo: 'Sin vínculo',
      contenido: 'Nuevo texto',
    });
    expect(await repository(db).readPublicVersion()).toMatchObject({
      number: 3,
      policiesStatus: 'UNAVAILABLE',
      policies: [],
    });
  });
});
