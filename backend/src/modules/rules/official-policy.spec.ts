import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
// Estas pruebas no cargan secretos ni construyen conexiones compartidas.
vi.mock('dotenv/config', () => ({}));
import { inMemoryPrisma } from '../../../test/helpers/in-memory-prisma.js';
import { seedRules } from '../../../prisma/seeds/rules.seed.js';
import { authorizeRulesSeed } from '../../../prisma/seeds/rules.runner.js';
import {
  describeOfficialPolicy,
  OFFICIAL_POLICIES,
  OFFICIAL_TERMS_TITLE,
  type OfficialPolicy,
} from './domain/official-policy.catalog.js';
import { SuspensionType } from './domain/entities/usage-rule.js';
import { RegisterViolationUseCase } from './application/use-cases/register-violation.use-case.js';
import { PrismaRuleRepository } from './infrastructure/persistence/prisma/prisma-rule.repository.js';
import { PrismaViolationRepository } from './infrastructure/persistence/prisma/prisma-violation.repository.js';

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
const seed = (db: Memory) => seedRules(client(db), text);
function policy(key: string): OfficialPolicy {
  const result = OFFICIAL_POLICIES.find((p) => p.key === key);
  if (!result) throw new Error(`Política ausente: ${key}`);
  return result;
}
const severities = ['LEVE', 'MODERADA', 'GRAVE'];

describe('Catálogo oficial de políticas 2026-10-19', () => {
  it('prepara 29 identidades y versiones únicas sin atribuir aprobación institucional', () => {
    expect(OFFICIAL_POLICIES).toHaveLength(29);
    expect(new Set(OFFICIAL_POLICIES.map((p) => p.ruleId)).size).toBe(29);
    expect(new Set(OFFICIAL_POLICIES.map((p) => p.versionId)).size).toBe(29);
    expect(new Set(OFFICIAL_POLICIES.map((p) => p.key)).size).toBe(29);
    expect(text).toContain(
      'no acredita su implementación ni una aprobación institucional externa',
    );
  });

  it.each([
    [
      'ELECTRONICOS',
      [
        [0, 1, 10, 7],
        [1, 3, 20, 15],
        [3, null, 30, 30],
      ],
    ],
    [
      'LIBROS',
      [
        [0, 24, 10, 7],
        [24, 72, 15, 14],
        [72, null, 20, 30],
      ],
    ],
    [
      'DEPORTES',
      [
        [0, 3, 10, 7],
        [3, 12, 15, 14],
        [12, null, 20, 30],
      ],
    ],
  ] as const)(
    'conserva umbrales, descuentos y suspensión R-TAR %s sin tolerancia',
    (category, rows) => {
      for (const [s, [min, max, penalty, days]] of rows.entries()) {
        expect(policy(`R-TAR:${category}:${severities[s]}`)).toMatchObject({
          category,
          severity: severities[s],
          penalty,
          suspensionDays: days,
          suspensionType: SuspensionType.TEMPORARY,
          criteria: { delayHours: { exclusiveMin: min, inclusiveMax: max } },
        });
      }
      const bands = severities.map(
        (s) => policy(`R-TAR:${category}:${s}`).criteria.delayHours!,
      );
      for (const hours of [
        0,
        0.000001,
        rows[0][1],
        rows[0][1] + 0.000001,
        rows[1][1],
        rows[1][1] + 0.000001,
      ]) {
        const matching = bands.filter(
          (b) =>
            hours > b.exclusiveMin &&
            (b.inclusiveMax === null || hours <= b.inclusiveMax),
        );
        expect(matching).toHaveLength(hours === 0 ? 0 : 1);
      }
    },
  );

  it.each([
    [
      'ELECTRONICOS',
      [
        [10, 7],
        [30, 30],
        [0, null],
      ],
    ],
    [
      'LIBROS',
      [
        [10, 7],
        [20, 15],
        [30, 30],
      ],
    ],
    [
      'DEPORTES',
      [
        [10, 7],
        [20, 15],
        [30, 30],
      ],
    ],
  ] as const)(
    'conserva R-DAN por gravedad %s, excluyendo desgaste normal',
    (category, rows) => {
      rows.forEach(([penalty, days], s) => {
        expect(policy(`R-DAN:${category}:${severities[s]}`)).toMatchObject({
          category,
          severity: severities[s],
          penalty,
          suspensionDays: days,
          trustEffect: days === null ? 'SET_ZERO' : 'DISCOUNT',
          suspensionType:
            days === null
              ? SuspensionType.INDEFINITE
              : SuspensionType.TEMPORARY,
        });
        expect(
          policy(`R-DAN:${category}:${severities[s]}`).criteria.condition,
        ).toContain('Excluir desgaste normal');
      });
    },
  );

  it('representa pérdida/robo como efecto explícito a cero, no −100 nominal', () => {
    expect(policy('R-PER')).toMatchObject({
      category: null,
      penalty: 0,
      trustEffect: 'SET_ZERO',
      suspensionType: SuspensionType.INDEFINITE,
      suspensionDays: null,
    });
  });

  it.each([
    [0, 2],
    [1, 3],
    [2, 5],
  ])(
    'configura inasistencia %s sin suspensión y ventana móvil',
    (s, penalty) => {
      expect(policy(`R-RES:${severities[s]}`)).toMatchObject({
        penalty,
        suspensionType: SuspensionType.NONE,
        suspensionDays: null,
        criteria: {
          noShow: {
            inclusiveMin: s + 1,
            inclusiveMax: s === 2 ? null : s + 1,
            rollingDays: 30,
            pickupMinutes: 30,
          },
        },
      });
    },
  );

  it.each([
    ['ELECTRONICOS', 30, 3, 8, ['EXCELENTE', 'CONFIABLE']],
    ['LIBROS', 10, 1, 336, ['EXCELENTE', 'CONFIABLE', 'EN_OBSERVACION']],
    ['DEPORTES', 10, 1, 48, ['EXCELENTE', 'CONFIABLE', 'EN_OBSERVACION']],
  ] as const)(
    'conserva recompensa, duración y acceso %s como configuración no sancionable',
    (category, reference, reward, hours, levels) => {
      const p = policy(`R-PUN:${category}`);
      expect(p.trustEffect).toBe('NONE');
      expect(p.criteria.reward).toEqual({
        referencePoints: reference,
        fraction: 0.1,
        maximumTrust: 100,
      });
      expect(p.criteria.reward!.fraction * reference).toBe(reward);
      expect(policy(`R-ACC:${category}`).criteria.access).toEqual({
        allowedLevels: levels,
        durationHours: hours,
        campusOnly: category === 'ELECTRONICOS',
      });
    },
  );

  it('conserva confianza inicial, precisión y los cuatro rangos oficiales', () => {
    expect(policy('R-CON').criteria.trust).toEqual({
      initial: 75,
      minimum: 0,
      maximum: 100,
      decimals: 2,
      levels: [
        { name: 'CRITICO', inclusiveMin: 0, exclusiveMax: 25 },
        { name: 'EN_OBSERVACION', inclusiveMin: 25, exclusiveMax: 50 },
        { name: 'CONFIABLE', inclusiveMin: 50, exclusiveMax: 75 },
        { name: 'EXCELENTE', inclusiveMin: 75, exclusiveMax: null },
      ],
    });
  });
});

describe('Seed transaccional real con constructor SQL en memoria', () => {
  it('dos pasadas no duplican ni escriben datos preexistentes; reutiliza categorías sin asumir IDs', async () => {
    const db = inMemoryPrisma({
      categorias_recurso: [
        {
          id: 'id-libros-previo',
          nombre: 'Libros',
          tiempoMaximoPrestamoDias: 14,
          tiempoMaximoPrestamoHoras: null,
        },
        {
          id: 'id-electronicos-previo',
          nombre: 'Electronicos',
          tiempoMaximoPrestamoDias: 0,
          tiempoMaximoPrestamoHoras: 8,
        },
      ],
    });
    expect(await seed(db)).toMatchObject({
      createdCategories: 1,
      createdRules: 29,
      createdVersions: 29,
      createdTerms: 1,
    });
    const before = structuredClone(
      Object.fromEntries(
        [
          'categorias_recurso',
          'reglas_uso',
          'versiones_regla',
          'versiones_terminos',
        ].map((t) => [t, db.rows(t)]),
      ),
    );
    const cursor = db.calls.length;
    expect(await seed(db)).toMatchObject({
      createdCategories: 0,
      createdRules: 0,
      createdVersions: 0,
      createdTerms: 0,
    });
    for (const [table, rows] of Object.entries(before))
      expect(db.rows(table)).toEqual(rows);
    expect(db.calls.slice(cursor).every((p) => p.operation === 'select')).toBe(
      true,
    );
    const stored = db
      .rows('versiones_regla')
      .find((r) => r.id === policy('R-ACC:LIBROS').versionId)!;
    expect(JSON.parse(stored.descripcion).categoryId).toBe('id-libros-previo');
    expect(db.rows('versiones_terminos')[0]).toMatchObject({
      numero: 1,
      titulo: OFFICIAL_TERMS_TITLE,
      contenido: text,
    });
  });

  it('preserva reglas manuales, versiones posteriores, desactivaciones, aceptaciones e historial', async () => {
    const manual = { id: 'custom', versionVigenteId: 'custom-v2' };
    const manualVersion = {
      id: 'custom-v2',
      reglaId: 'custom',
      numero: 2,
      descripcion: 'Personalizada',
      estado: 'ACTIVA',
    };
    const protectedTables = [
      'usuarios',
      'cuentas_acceso',
      'prestamos',
      'apelaciones',
      'sanciones',
      'incumplimientos',
      'aceptaciones_terminos',
    ];
    const initial = Object.fromEntries(
      protectedTables.map((table) => [
        table,
        [{ id: `${table}-histórico`, contenido: 'no tocar' }],
      ]),
    );
    const db = inMemoryPrisma({
      ...initial,
      reglas_uso: [manual],
      versiones_regla: [manualVersion],
    });
    await seed(db);
    const p = policy('R-DAN:LIBROS:LEVE');
    const old = db.rows('versiones_regla').find((v) => v.id === p.versionId)!;
    old.estado = 'INACTIVA';
    db.rows('versiones_regla').push({
      ...old,
      id: 'v2-admin',
      numero: 2,
      penalizacionPorcentual: '12.00',
      estado: 'ACTIVA',
    });
    db.rows('reglas_uso').find((r) => r.id === p.ruleId)!.versionVigenteId =
      'v2-admin';
    db.rows('versiones_terminos').push({
      id: 'terms-2',
      numero: 2,
      titulo: 'Posteriores',
      contenido: 'Texto posterior',
    });
    await seed(db);
    expect(db.rows('reglas_uso')).toContainEqual(manual);
    expect(db.rows('versiones_regla')).toContainEqual(manualVersion);
    expect(old.estado).toBe('INACTIVA');
    expect(
      db.rows('reglas_uso').find((r) => r.id === p.ruleId)!.versionVigenteId,
    ).toBe('v2-admin');
    expect(db.rows('versiones_terminos')).toContainEqual({
      id: 'terms-2',
      numero: 2,
      titulo: 'Posteriores',
      contenido: 'Texto posterior',
    });
    for (const table of protectedTables)
      expect(db.rows(table)).toEqual(initial[table]);
    expect(db.calls.some((call) => protectedTables.includes(call.table))).toBe(
      false,
    );
  });

  it('conserva la identidad de categoría incluso después de renombrarla', async () => {
    const db = inMemoryPrisma();
    await seed(db);
    const category = db
      .rows('categorias_recurso')
      .find((r) => r.nombre === 'Electrónicos')!;
    category.nombre = 'Electrónicos de la escuela';
    expect(await seed(db)).toMatchObject({
      createdCategories: 0,
      createdRules: 0,
    });
    expect(db.rows('categorias_recurso')).toHaveLength(3);
  });

  it.each(['penalizacionPorcentual', 'descripcion', 'diasSuspension', 'id'])(
    'detecta conflicto histórico %s sin sobrescribir',
    async (field) => {
      const db = inMemoryPrisma();
      await seed(db);
      const row = db.rows('versiones_regla')[0];
      row[field] = field === 'diasSuspension' ? 99 : 'cambiado';
      const previous = structuredClone(db.rows('versiones_regla'));
      await expect(seed(db)).rejects.toThrow('Conflicto');
      expect(db.rows('versiones_regla')).toEqual(previous);
    },
  );

  it('revierte incluso las creaciones previas ante conflicto de términos aceptados', async () => {
    const originalTerms = {
      id: 'terms-original',
      numero: 1,
      titulo: 'Texto aceptado',
      contenido: 'No reescribir',
    };
    const db = inMemoryPrisma({
      versiones_terminos: [originalTerms],
      aceptaciones_terminos: [
        { id: 'accepted', versionTerminosId: originalTerms.id },
      ],
    });
    await expect(seed(db)).rejects.toThrow('términos v1');
    for (const table of ['reglas_uso', 'versiones_regla', 'categorias_recurso'])
      expect(db.rows(table)).toEqual([]);
    expect(db.rows('versiones_terminos')).toEqual([originalTerms]);
    expect(db.rows('aceptaciones_terminos')).toEqual([
      { id: 'accepted', versionTerminosId: originalTerms.id },
    ]);
    expect(
      db.calls.some(
        (p) => p.operation === 'insert' && p.table === 'versiones_regla',
      ),
    ).toBe(true);
  });

  it.each([
    [
      {
        id: 'conflict',
        nombre: 'Libros',
        tiempoMaximoPrestamoDias: 7,
        tiempoMaximoPrestamoHoras: null,
      },
    ],
    [
      {
        id: 'a',
        nombre: 'Electrónicos',
        tiempoMaximoPrestamoDias: 0,
        tiempoMaximoPrestamoHoras: 8,
      },
      {
        id: 'b',
        nombre: 'Electronicos',
        tiempoMaximoPrestamoDias: 0,
        tiempoMaximoPrestamoHoras: 8,
      },
    ],
  ])(
    'aborta por duración incompatible o categoría ambigua sin cambios',
    async (...categories) => {
      const db = inMemoryPrisma({ categorias_recurso: categories });
      await expect(seed(db)).rejects.toThrow('Conflicto');
      expect(db.rows('categorias_recurso')).toEqual(categories);
      expect(db.rows('reglas_uso')).toEqual([]);
    },
  );
});

describe('Consulta y aplicación mínima de versiones persistidas', () => {
  it('lista solo versiones vigentes activas, sin exponer históricas como actuales', async () => {
    const db = inMemoryPrisma();
    await seed(db);
    const p = policy('R-DAN:LIBROS:LEVE');
    const old = db.rows('versiones_regla').find((r) => r.id === p.versionId)!;
    db.rows('versiones_regla').push({ ...old, id: 'new-current', numero: 2 });
    db.rows('reglas_uso').find((r) => r.id === p.ruleId)!.versionVigenteId =
      'new-current';
    const active = await new PrismaRuleRepository(
      db as never,
    ).findActiveVersions();
    expect(active).toHaveLength(29);
    expect(active.some((v) => v.id === old.id)).toBe(false);
    expect(active.some((v) => v.id === 'new-current')).toBe(true);
  });

  it.each(['R-DAN:ELECTRONICOS:GRAVE', 'R-PER'])(
    'aplica %s a cero y conserva el descuento efectivo, sin −100 ficticio',
    async (key) => {
      const db = inMemoryPrisma({
        usuarios: [{ id: 'user', confianza: '42.25' }],
      });
      await seed(db);
      const useCase = new RegisterViolationUseCase(
        new PrismaViolationRepository(db as never),
        new PrismaRuleRepository(db as never),
      );
      const p = policy(key);
      const result = await useCase.execute({
        userId: 'user',
        ruleId: p.ruleId,
        occurredAt: new Date(),
      });
      expect(result.appliedPenalty).toBe(42.25);
      expect(db.rows('usuarios')[0].confianza).toBe('0.00');
      expect(db.rows('sanciones')[0]).toMatchObject({
        versionReglaId: p.versionId,
        confianzaAnterior: '42.25',
        confianzaPosterior: '0.00',
        estado: 'ACTIVA',
        fechaFin: null,
      });
      expect(
        db.rows('versiones_regla').find((r) => r.id === p.versionId)!
          .penalizacionPorcentual,
      ).toBe('0.00');
    },
  );

  it('consulta la versión administrativa vigente para descuento y duración, no el catálogo fuente', async () => {
    const db = inMemoryPrisma({
      usuarios: [{ id: 'user', confianza: '75.00' }],
    });
    await seed(db);
    const p = policy('R-DAN:LIBROS:LEVE');
    const old = db.rows('versiones_regla').find((r) => r.id === p.versionId)!;
    db.rows('versiones_regla').push({
      ...old,
      id: 'admin-v2',
      numero: 2,
      penalizacionPorcentual: '12.00',
      diasSuspension: 9,
    });
    db.rows('reglas_uso').find((r) => r.id === p.ruleId)!.versionVigenteId =
      'admin-v2';
    const useCase = new RegisterViolationUseCase(
      new PrismaViolationRepository(db as never),
      new PrismaRuleRepository(db as never),
    );
    const result = await useCase.execute({
      userId: 'user',
      ruleId: p.ruleId,
      occurredAt: new Date(),
    });
    expect(result).toMatchObject({
      appliedPenalty: 12,
      ruleVersionId: 'admin-v2',
    });
    const sanction = db.rows('sanciones')[0];
    expect(sanction.fechaFin.getTime() - sanction.fechaInicio.getTime()).toBe(
      9 * 86400000,
    );
    expect(old.penalizacionPorcentual).toBe('10.00');
  });

  it.each([
    'R-PUN:LIBROS',
    'R-ACC:ELECTRONICOS',
    'R-CON',
    'R-TAR:LIBROS:GRAVE',
    'R-RES:LEVE',
  ])('no permite aplicar %s como sanción manual sin contexto', async (key) => {
    const db = inMemoryPrisma({
      usuarios: [{ id: 'user', confianza: '75.00' }],
    });
    await seed(db);
    const useCase = new RegisterViolationUseCase(
      new PrismaViolationRepository(db as never),
      new PrismaRuleRepository(db as never),
    );
    await expect(
      useCase.execute({
        userId: 'user',
        ruleId: policy(key).ruleId,
        occurredAt: new Date(),
      }),
    ).rejects.toThrow();
    expect(db.rows('usuarios')[0].confianza).toBe('75.00');
    expect(db.rows('incumplimientos')).toEqual([]);
  });

  it('serializa metadatos sin cambiar el contrato API/ORM existente', () => {
    expect(
      JSON.parse(describeOfficialPolicy(policy('R-PUN:LIBROS'), 'category-id')),
    ).toMatchObject({
      format: 'epcc.official-policy/v1',
      release: '2026-10-19',
      categoryId: 'category-id',
    });
  });
});

describe('Autorización previa sin conexión', () => {
  it('no permite aplicar implícitamente ni cargar secretos', () => {
    expect(() => authorizeRulesSeed([], undefined)).toThrow('--apply');
    expect(() => authorizeRulesSeed(['--apply'], undefined)).toThrow(
      'no carga archivos',
    );
  });
  it('detiene Neon antes de construir el cliente salvo autorización explícita', () => {
    const fictitious = 'postgresql://example.invalid/test';
    expect(authorizeRulesSeed(['--apply'], fictitious)).toBe(fictitious);
    expect(() =>
      authorizeRulesSeed(['--apply'], 'postgresql://example.neon.tech/test'),
    ).toThrow('No se ha conectado');
    expect(
      authorizeRulesSeed(
        ['--apply', '--authorize-neon'],
        'postgresql://example.neon.tech/test',
      ),
    ).toBe('postgresql://example.neon.tech/test');
  });
});
