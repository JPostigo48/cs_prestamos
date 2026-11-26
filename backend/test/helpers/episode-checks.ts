import type { SchemaMetadata } from '../../src/shared/infrastructure/prisma/schema-capability-metadata.js';

/** Independent pg_get_expr-style fixtures, not generated from provider requirements. */
export function episodeChecks(): SchemaMetadata['constraints'] {
  return [
    {
      table: 'ajustes_incumplimiento', name: 'ajustes_efecto_check_bddadac4',
      expression: `((((efecto)::text = 'SET_ZERO'::text) AND ("nominalObjetivo" IS NULL) AND ("incrementoNominal" IS NULL) AND ("duracionTotalDias" IS NULL) AND ("incrementoDias" IS NULL) AND ("saldoPosterior" = (0)::numeric)) OR (((efecto)::text = 'DISCOUNT'::text) AND (("nominalObjetivo" >= (0)::numeric) AND ("nominalObjetivo" <= (100)::numeric)) AND (("incrementoNominal" >= (0)::numeric) AND ("incrementoNominal" <= "nominalObjetivo")) AND ("duracionTotalDias" > 0) AND (("incrementoDias" >= 0) AND ("incrementoDias" <= "duracionTotalDias"))))`,
    },
    {
      table: 'ajustes_incumplimiento', name: 'ajustes_saldos_check_2259aaf4',
      expression: `(("descuentoEfectivo" >= (0)::numeric) AND (("saldoAnterior" >= (0)::numeric) AND ("saldoAnterior" <= (100)::numeric)) AND (("saldoPosterior" >= (0)::numeric) AND ("saldoPosterior" <= (100)::numeric)) AND (("saldoAnterior" - "saldoPosterior") = "descuentoEfectivo"))`,
    },
    {
      table: 'incumplimientos', name: 'incumplimientos_episodio_contexto_check_431bd0a6',
      expression: `((("prestamoId" IS NULL) AND (origen IS NULL)) OR (("prestamoId" IS NOT NULL) AND ("categoriaId" IS NOT NULL) AND ("termsVersionId" IS NOT NULL) AND (origen IS NOT NULL)))`,
    },
  ].map(check => ({ ...check, kind: 'c', columns: [], validated: true, deferred: false,
    targetSchema: null, target: null, targetColumns: [], onDelete: ' ', onUpdate: ' ' }));
}
