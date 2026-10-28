import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { authorizeRepair, repairFile } from './repair-rule-suspension.mjs';

const sql = await readFile(repairFile, 'utf8');
const ops = JSON.parse(await readFile(new URL(
  '../prisma/migrations/app/20261021T0508_add_versioned_suspension_policy/ops.json',
  import.meta.url,
), 'utf8'));
const contract = JSON.parse(await readFile(new URL('../prisma/contract.json', import.meta.url), 'utf8'));

test('reutiliza exactamente los tres DDL aditivos de versiones, no duplica migración', () => {
  const selected = ops.filter((op) => op.target.details.table === 'versiones_regla');
  assert.equal(selected.length, 3);
  for (const op of selected) {
    assert.equal(op.operationClass, 'additive');
    assert.equal(op.target.details.schema, 'public');
    assert.equal(op.execute.length, 1);
    assert.ok(sql.includes(`${op.execute[0].sql};`));
  }
  assert.equal((sql.match(/ALTER TABLE/g) ?? []).length, 3);
  assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|CREATE SCHEMA|CREATE TABLE)\b/i);
  assert.doesNotMatch(sql, /ALTER TABLE\s+"public"\."(?!versiones_regla")/);
  assert.doesNotMatch(sql, /prisma_contract/);
});

test('mantiene contrato nullable, sin default ni enum nativo', () => {
  const table = contract.storage.namespaces.public.entries.table.versiones_regla;
  for (const [name, type] of [['diasSuspension', 'int4'], ['tipoSuspension', 'text']]) {
    assert.equal(table.columns[name].nativeType, type);
    assert.equal(table.columns[name].nullable, true);
    assert.equal(table.columns[name].default, undefined);
    assert.ok(sql.includes(`a.attname = '${name}' AND a.atttypid = 'pg_catalog.${type}'::regtype`));
  }
  assert.ok(sql.includes('NOT a.attnotnull AND NOT a.atthasdef'));
  assert.ok(sql.includes('c.convalidated'));
  assert.ok(sql.includes('pg_get_constraintdef(c.oid)'));
});

test('guardas idempotentes dentro de transacción y bloqueo acotado', () => {
  assert.match(sql, /BEGIN;[\s\S]+lock_timeout = '5s'/);
  assert.match(sql, /LOCK TABLE "public"\."versiones_regla" IN ACCESS EXCLUSIVE MODE/);
  assert.equal((sql.match(/IF NOT EXISTS/g) ?? []).length, 4);
  assert.match(sql, /RAISE EXCEPTION/);
  assert.match(sql, /COMMIT;\s*$/);
});

test('sin flags, con mezcla de modos o sin conexión no autoriza escritura', () => {
  assert.throws(() => authorizeRepair([], undefined));
  assert.throws(() => authorizeRepair(['--apply', '--print'], 'postgresql://localhost/test'));
  assert.throws(() => authorizeRepair(['--apply'], undefined));
  assert.throws(() => authorizeRepair(['--apply'], 'invalid'), /Conexión PostgreSQL inválida/);
});

test('Neon exige flag adicional; la prueba sólo analiza una URL ficticia', () => {
  const fake = 'postgresql://example.invalid@ep-example.neon.tech/example';
  assert.throws(() => authorizeRepair(['--apply'], fake), /Neon requiere/);
  assert.doesNotThrow(() => authorizeRepair(['--apply', '--authorize-neon'], fake));
});
