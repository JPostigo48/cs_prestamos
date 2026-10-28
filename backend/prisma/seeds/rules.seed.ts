import type postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from '../contract.d.ts';
import {
  describeOfficialPolicy,
  OFFICIAL_CATEGORIES,
  OFFICIAL_POLICIES,
  OFFICIAL_TERMS_NUMBER,
  OFFICIAL_TERMS_TITLE,
  POLICY_DESCRIPTION_FORMAT,
} from '../../src/modules/rules/domain/official-policy.catalog.js';
import type { SuspensionType } from '../../src/modules/rules/domain/entities/usage-rule.js';

/** Mensajes controlados que el CLI puede mostrar sin divulgar datos del driver. */
export class RulesSeedError extends Error {}

export interface CategoryRow {
  id: string;
  nombre: string;
  tiempoMaximoPrestamoDias: number;
  tiempoMaximoPrestamoHoras: number | null;
}
export interface SeedRuleRow {
  id: string;
  versionVigenteId: string | null;
}
export interface SeedVersionRow {
  id: string;
  reglaId: string;
  numero: number;
  titulo: string;
  descripcion: string;
  penalizacionPorcentual: string;
  consecuencia: string;
  tipoSuspension: SuspensionType | null;
  diasSuspension: number | null;
}
export interface SeedTermsRow {
  id: string;
  numero: number;
  titulo: string | null;
  contenido: string | null;
}
export interface RulesSeedStore {
  categories(): Promise<CategoryRow[]>;
  rules(): Promise<SeedRuleRow[]>;
  versions(): Promise<SeedVersionRow[]>;
  terms(): Promise<SeedTermsRow[]>;
  createCategory(data: Omit<CategoryRow, 'id'>): Promise<CategoryRow>;
  createRule(id: string): Promise<void>;
  createVersion(data: SeedVersionRow): Promise<void>;
  setInitialVersion(ruleId: string, versionId: string): Promise<void>;
  createTerms(data: Omit<SeedTermsRow, 'id'>): Promise<void>;
}

function normalizedName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLocaleLowerCase('es');
}
function conflict(identity: string): never {
  throw new RulesSeedError(
    `Conflicto histórico/configuración en ${identity}; no se sobrescribe. Requiere revisión y una nueva versión explícita.`,
  );
}

/** Ejecutar exclusivamente dentro de una transacción. Nunca actualiza filas preexistentes. */
export async function seedRulesInTransaction(
  store: RulesSeedStore,
  termsContent: string,
) {
  if (!termsContent.trim())
    throw new RulesSeedError(
      'El texto oficial de términos no puede estar vacío.',
    );
  const [categories, rules, versions, terms] = await Promise.all([
    store.categories(),
    store.rules(),
    store.versions(),
    store.terms(),
  ]);
  const categoryIds = new Map<string, string>();
  let createdCategories = 0;
  let createdRules = 0;
  let createdTerms = 0;

  for (const category of OFFICIAL_CATEGORIES) {
    const named = categories.filter(
      (row) => normalizedName(row.nombre) === normalizedName(category.name),
    );
    if (named.length > 1) conflict(`categoría ambigua ${category.key}`);
    // Tras un cambio de nombre, conservar la identidad vinculada a la versión sembrada.
    const boundIds = new Set<string>();
    for (const policy of OFFICIAL_POLICIES.filter(
      (p) => p.category === category.key,
    )) {
      const stored = versions.find((v) => v.id === policy.versionId);
      if (!stored) continue;
      let metadata: unknown;
      try {
        metadata = JSON.parse(stored.descripcion);
      } catch {
        conflict(policy.key);
      }
      if (
        metadata &&
        typeof metadata === 'object' &&
        'format' in metadata &&
        metadata.format === POLICY_DESCRIPTION_FORMAT &&
        'categoryId' in metadata &&
        typeof metadata.categoryId === 'string'
      )
        boundIds.add(metadata.categoryId);
      else conflict(policy.key);
    }
    if (boundIds.size > 1) conflict(`identidad ${category.key}`);
    const boundId = [...boundIds][0];
    const bound = boundId
      ? categories.find((row) => row.id === boundId)
      : undefined;
    if (boundId && (!bound || (named[0] && named[0].id !== boundId)))
      conflict(`identidad ${category.key}`);
    let existing = bound ?? named[0];
    const expectedHours = category.hours ?? category.days * 24;
    if (
      existing &&
      (existing.tiempoMaximoPrestamoHoras ??
        existing.tiempoMaximoPrestamoDias * 24) !== expectedHours
    ) {
      conflict(`duración ${category.key}`);
    }
    if (!existing) {
      existing = await store.createCategory({
        nombre: category.name,
        tiempoMaximoPrestamoDias: category.days,
        tiempoMaximoPrestamoHoras: category.hours,
      });
      createdCategories++;
    }
    categoryIds.set(category.key, existing.id);
  }

  for (const policy of OFFICIAL_POLICIES) {
    const expected: SeedVersionRow = {
      id: policy.versionId,
      reglaId: policy.ruleId,
      numero: policy.version,
      titulo: policy.title,
      descripcion: describeOfficialPolicy(
        policy,
        policy.category ? categoryIds.get(policy.category)! : null,
      ),
      penalizacionPorcentual: policy.penalty.toFixed(2),
      consecuencia: policy.consequence,
      tipoSuspension: policy.suspensionType,
      diasSuspension: policy.suspensionDays,
    };
    const rule = rules.find((row) => row.id === policy.ruleId);
    const existing = versions.find(
      (row) =>
        row.id === policy.versionId ||
        (row.reglaId === policy.ruleId && row.numero === policy.version),
    );
    if (rule || existing) {
      if (!rule || !existing) conflict(policy.key);
      for (const key of Object.keys(expected) as (keyof SeedVersionRow)[]) {
        const value =
          key === 'penalizacionPorcentual'
            ? Number(existing[key]).toFixed(2)
            : existing[key];
        if (value !== expected[key])
          conflict(`${policy.key} v${policy.version} (${key})`);
      }
      // No reactivar, reparar punteros ni reemplazar versiones posteriores administrativas.
      continue;
    }
    await store.createRule(policy.ruleId);
    await store.createVersion(expected);
    await store.setInitialVersion(policy.ruleId, policy.versionId);
    createdRules++;
  }
  const existingTerms = terms.find(
    (row) => row.numero === OFFICIAL_TERMS_NUMBER,
  );
  if (existingTerms) {
    if (
      existingTerms.titulo !== OFFICIAL_TERMS_TITLE ||
      existingTerms.contenido !== termsContent
    )
      conflict(`términos v${OFFICIAL_TERMS_NUMBER}`);
  } else {
    await store.createTerms({
      numero: OFFICIAL_TERMS_NUMBER,
      titulo: OFFICIAL_TERMS_TITLE,
      contenido: termsContent,
    });
    createdTerms++;
  }
  return {
    preparedRules: OFFICIAL_POLICIES.length,
    preparedVersions: OFFICIAL_POLICIES.length,
    preparedTerms: 1,
    createdCategories,
    createdRules,
    createdVersions: createdRules,
    createdTerms,
  };
}

type RulesClient = ReturnType<typeof postgres<Contract>>;

/** Adaptador real: una transacción para categorías, reglas, versiones y términos. */
export async function seedRules(
  client: RulesClient,
  termsContent: string,
  options: { dryRun?: boolean } = {},
) {
  const sql = client.sql.public;
  // La simulación reutiliza las mismas comprobaciones, pero nunca construye SQL mutante.
  let virtualCategory = 0;
  return client.transaction(async (tx) =>
    seedRulesInTransaction(
      {
        categories: async () =>
          tx.query(
            sql.categorias_recurso
              .select(
                'id',
                'nombre',
                'tiempoMaximoPrestamoDias',
                'tiempoMaximoPrestamoHoras',
              )
              .build(),
          ),
        rules: async () =>
          tx.query(sql.reglas_uso.select('id', 'versionVigenteId').build()),
        versions: async () => {
          const rows = await tx.query(
            sql.versiones_regla
              .select(
                'id',
                'reglaId',
                'numero',
                'titulo',
                'descripcion',
                'penalizacionPorcentual',
                'consecuencia',
                'tipoSuspension',
                'diasSuspension',
              )
              .build(),
          );
          return rows.map((row) => ({
            ...row,
            penalizacionPorcentual: String(row.penalizacionPorcentual),
            tipoSuspension: row.tipoSuspension as SuspensionType | null,
          }));
        },
        terms: async () =>
          tx.query(
            sql.versiones_terminos
              .select('id', 'numero', 'titulo', 'contenido')
              .build(),
          ),
        createCategory: async (data) =>
          options.dryRun
            ? {
                ...data,
                id: `00000000-0000-4000-8000-${String(++virtualCategory).padStart(12, '0')}`,
              }
            : (
                await tx.query(
                  sql.categorias_recurso
                    .insert([data])
                    .returning(
                      'id',
                      'nombre',
                      'tiempoMaximoPrestamoDias',
                      'tiempoMaximoPrestamoHoras',
                    )
                    .build(),
                )
              )[0],
        createRule: async (id) => {
          if (options.dryRun) return;
          await tx.query(sql.reglas_uso.insert([{ id }]).build());
        },
        createVersion: async (data) => {
          if (options.dryRun) return;
          await tx.query(
            sql.versiones_regla.insert([{ ...data, estado: 'ACTIVA' }]).build(),
          );
        },
        setInitialVersion: async (ruleId, versionId) => {
          if (options.dryRun) return;
          await tx.query(
            sql.reglas_uso
              .update({ versionVigenteId: versionId })
              .where((r, f) => f.eq(r.id, ruleId))
              .build(),
          );
        },
        createTerms: async (data) => {
          if (options.dryRun) return;
          await tx.query(sql.versiones_terminos.insert([data]).build());
        },
      },
      termsContent,
    ),
  );
}
