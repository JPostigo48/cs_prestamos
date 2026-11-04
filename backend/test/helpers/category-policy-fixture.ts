import {
  describeOfficialPolicy,
  OFFICIAL_POLICIES,
} from '../../src/modules/rules/domain/official-policy.catalog.js';

/** Publicación sintética exclusivamente en memoria; no ejecuta semillas. */
export function categoryPolicyFixture(
  categoryId: string,
  termsId = '123e4567-e89b-42d3-a456-426614174099',
) {
  return {
    reglas_uso: OFFICIAL_POLICIES.map((p) => ({
      id: p.ruleId,
      versionVigenteId: p.versionId,
    })),
    versiones_regla: OFFICIAL_POLICIES.map((p) => ({
      id: p.versionId,
      reglaId: p.ruleId,
      numero: p.version,
      titulo: p.title,
      descripcion: describeOfficialPolicy(
        p,
        p.category === null
          ? null
          : p.category === 'LIBROS'
            ? categoryId
            : '123e4567-e89b-42d3-a456-426614174098',
      ),
      penalizacionPorcentual: p.penalty.toFixed(2),
      consecuencia: p.consequence,
      tipoSuspension: p.suspensionType,
      diasSuspension: p.suspensionDays,
      estado: 'ACTIVA',
    })),
    versiones_terminos: [
      {
        id: termsId,
        numero: 1,
        titulo: 'Publicación sintética de prueba',
        contenido: `<!-- epcc.policy-versions/v1: ${JSON.stringify(OFFICIAL_POLICIES.map((p) => p.versionId))} -->`,
      },
    ],
  };
}
