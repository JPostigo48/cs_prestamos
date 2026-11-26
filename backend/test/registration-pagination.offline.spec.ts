import { describe, expect, it, vi } from 'vitest';
import postgres from '@prisma/orm-postgres/runtime';
import { Temporal } from 'temporal-polyfill';
import type { Contract } from '../prisma/contract.d.ts';
import contractJson from '../prisma/contract.json' with { type: 'json' };
import { PrismaRegistrationRequestRepository } from '../src/modules/users/infrastructure/persistence/prisma/prisma-registration-request.repository.js';
import type { RegistrationRequestFilters } from '../src/modules/users/domain/repositories/registration-request.repository.js';
import { inMemoryPrisma } from './helpers/in-memory-prisma.js';

// Native plan construction only: no runtime(), connect(), environment or DB.
const native = postgres<Contract>({ contractJson });
const historic = (id: number) => ({
  id: String(id).padStart(8, '0'), nombre: 'Histórico', tipoUsuario: 'DOCENTE',
  identificadorInstitucional: 'DOC', telefono: null,
  fechaSolicitud: '2026-11-01T00:00:00.123+00:00', estado: 'RECHAZADA',
  motivoRechazo: 'Histórico', usuarioAprobadoId: null, email: null,
  passwordHash: null, versionTerminosId: null, fechaAceptacionTerminos: null,
});

describe('H4 registration pagination, offline only', () => {
  it('10,000 rows: returns/enriches only the requested page, with a full aggregate total', async () => {
    const rows = Array.from({ length: 10_000 }, (_, i) => historic(i + 1));
    rows.push({ ...historic(10_001), estado: 'APROBADA' });
    rows.push({ ...historic(10_002), identificadorInstitucional: 'OTHER' });
    const db = inMemoryPrisma({ solicitudes_registro: rows });
    const query = vi.spyOn(db.client.runtime(), 'query');
    const repo = new PrismaRegistrationRequestRepository(db as any);
    const result = await repo.list({ page: 200, limit: 20, status: 'RECHAZADA', institutionalId: 'DOC' });
    expect(result).toMatchObject({ total: 10_000, page: 200, limit: 20 });
    expect(result.items.map(row => row.id)).toEqual(
      Array.from({ length: 20 }, (_, i) => String(6020 - i).padStart(8, '0')),
    );
    expect(result.items[0].requestedAt).toBeInstanceOf(Temporal.Instant);
    expect(String(result.items[0].requestedAt)).toBe('2026-11-01T00:00:00.123Z');
    expect(JSON.stringify(result)).not.toMatch(/passwordHash|versionTerminosId|email/);
    const snapshots = await query.mock.results[0]!.value;
    expect(JSON.parse(snapshots[0]!.items)).toHaveLength(20);
    expect(db.calls.filter(c => c.table === 'solicitudes_registro')).toHaveLength(1);
    expect(db.calls.filter(c => c.table === 'evidencias_vinculacion')).toHaveLength(20);
    expect(db.calls).toHaveLength(21);
    expect(db.rows('solicitudes_registro')).toEqual(rows);
  });

  it.each([
    { page: 1, limit: 20 },
    { page: 501, limit: 20, status: 'RECHAZADA' },
    { page: 3, limit: 7, institutionalId: "DOC' OR TRUE --" },
    { page: 2, limit: 5, status: 'PENDIENTE', institutionalId: 'DOC' },
  ] satisfies RegistrationRequestFilters[])('native parameterized SQL, empty page keeps total: %j', async filters => {
    const query = vi.fn().mockResolvedValue([{ total: '10000', items: '[]' }]);
    const transaction = vi.fn(async work => work({ query }));
    const repo = new PrismaRegistrationRequestRepository({
      client: { raw: native.raw, transaction },
    } as any);
    expect(await repo.list(filters)).toEqual({ items: [], total: 10000, page: filters.page, limit: filters.limit });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(1);
    const plan = query.mock.calls[0]![0];
    const parts = plan.ast.parts as Array<string | { kind: string; value: unknown }>;
    expect(parts.filter(part => typeof part !== 'string').map(part => part.value)).toEqual([
      filters.status ?? null, filters.institutionalId ?? null,
      filters.limit, (filters.page - 1) * filters.limit,
    ]);
    expect(parts.filter(part => typeof part !== 'string').every(part => part.kind === 'param-ref')).toBe(true);
    const sql = parts.filter(part => typeof part === 'string').join('');
    expect(sql).toMatch(/ORDER BY r\."fechaSolicitud" DESC, r\.id DESC\s+LIMIT\s+OFFSET/);
    expect(sql).toContain('jsonb_agg(to_jsonb(p) ORDER BY p."fechaSolicitud" DESC, p.id DESC)');
    expect(sql).toContain("'[]'::jsonb");
    expect(sql).toContain('SELECT count(*) FROM public.solicitudes_registro');
    // Filters shared by the page and count, with no historical row/hash projection.
    expect(sql.match(/r\.estado = c\.status/g)).toHaveLength(2);
    expect(sql.match(/r\."identificadorInstitucional" = c\.institutional_id/g)).toHaveLength(2);
    expect(sql.match(/r\."passwordHash"/g)).toHaveLength(1);
    const aggregate = sql.slice(sql.indexOf('SELECT count(*)'));
    expect(aggregate).not.toContain('passwordHash');
    expect(sql).not.toMatch(/SELECT\s+\*|FOR UPDATE|INSERT|UPDATE|DELETE/);
    expect(sql).not.toContain("DOC' OR TRUE --");
    expect(parts.filter(part => typeof part !== 'string').slice(0, 2)).toMatchObject([
      { codec: { codecId: 'pg/text@1' } }, { codec: { codecId: 'pg/text@1' } },
    ]);
  });

  it('zero matching rows returns zero total, empty items and no enrichment queries', async () => {
    const db = inMemoryPrisma({ solicitudes_registro: [historic(1)] });
    const repo = new PrismaRegistrationRequestRepository(db as any);
    expect(await repo.list({ page: 1, limit: 20, status: 'PENDIENTE' })).toEqual({
      items: [], total: 0, page: 1, limit: 20,
    });
    expect(db.calls).toHaveLength(1);
  });

  it('a database failure propagates without a second read or fallback', async () => {
    const error = new Error('snapshot unavailable');
    const query = vi.fn().mockRejectedValue(error);
    const repo = new PrismaRegistrationRequestRepository({
      client: { raw: native.raw, transaction: async (work: any) => work({ query }) },
    } as any);
    await expect(repo.list({ page: 1, limit: 20 })).rejects.toBe(error);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it.each([
    [],
    [{ total: '-1', items: '[]' }],
    [{ total: '9007199254740992', items: '[]' }],
    [{ total: '1', items: '{}' }],
    [{ total: '2', items: '[{}, {}]' }],
    [{ total: '1', items: 'not JSON' }],
  ])('rejects an invalid snapshot without fallback: %j', async (...snapshot) => {
    const query = vi.fn().mockResolvedValue(snapshot);
    const repo = new PrismaRegistrationRequestRepository({
      client: { raw: native.raw, transaction: async (work: any) => work({ query }) },
    } as any);
    await expect(repo.list({ page: 1, limit: 1 })).rejects.toThrow();
    expect(query).toHaveBeenCalledTimes(1);
  });
});
