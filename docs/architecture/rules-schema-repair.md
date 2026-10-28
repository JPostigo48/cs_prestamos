# Reparación focalizada y seed — ejecutados en Neon (2026-10-28)

## Diagnóstico confirmado en lectura (2026-10-28)

Transacción PostgreSQL repetible y de sólo lectura: esquema efectivo público.
La tabla de versiones carece de las dos columnas de suspensión y su restricción.
El historial contiene la migración de duración de categorías, pero no la
[migración de suspensión existente](../../backend/prisma/migrations/app/20261021T0508_add_versioned_suspension_policy/migration.ts:19).
Ésta también sustituye una restricción de sanciones: **no aplicarla completa ni aplicar el lote pendiente**.

Fuente de verdad: [contrato vigente](../../backend/prisma/contract.prisma:272) y
[tres operaciones aditivas originales de versiones](../../backend/prisma/migrations/app/20261021T0508_add_versioned_suspension_policy/ops.json).

| Cambio físico en la tabla pública de versiones | Contrato |
| --- | --- |
| Columna [diasSuspension](../../backend/prisma/contract.prisma:281) | entero PostgreSQL, nullable, sin default |
| Columna [tipoSuspension](../../backend/prisma/contract.prisma:280) | texto PostgreSQL, nullable, sin default |
| Restricción [de valores de suspensión](../../backend/prisma/migrations/app/20261021T0508_add_versioned_suspension_policy/migration.ts:35) | NINGUNA, TEMPORAL o INDEFINIDA; permite nulos |

No requiere crear un enum PostgreSQL: la [enumeración del contrato](../../backend/prisma/contract.prisma:459) se almacena como texto restringido.
Las columnas de categorías, reglas, términos y demás columnas de versiones usadas por el
[seed](../../backend/prisma/seeds/rules.seed.ts:225) y la
[lectura pública de términos](../../backend/src/modules/rules/infrastructure/persistence/prisma/prisma-terms.repository.ts:23)
existen. No se identificó otro bloqueo físico para ese flujo. Los IDs y marcas de actualización
sin default físico son generados por el cliente según el contrato; no añadir defaults SQL.
Esto no sustituye la prueba posterior autorizada del seed real.

## Reparación autorizada y ejecutada

El [SQL focalizado](../../backend/scripts/repair-rule-suspension.sql:1) conserva exactamente los tres DDL originales.
Comprueba tipo, nulabilidad, ausencia de default y definición/validación de la restricción;
si hay una discrepancia aborta, no la oculta ni reemplaza objetos. Usa transacción,
bloqueo exclusivo y espera máxima de bloqueo de cinco segundos. Puede reintentarse;
no transforma filas existentes ni rellena datos: las nuevas columnas quedan nulas.

El [ejecutor](../../backend/scripts/repair-rule-suspension.mjs:1) no carga secretos ni configuración Prisma.
Desde el backend, la vista offline es [node scripts/repair-rule-suspension.mjs --print](../../backend/scripts/repair-rule-suspension.mjs:30).
La prueba pura es [node --test scripts/repair-rule-suspension.test.mjs](../../backend/scripts/repair-rule-suspension.test.mjs:1).
No requiere conexión y no ejecuta SQL. Sus cinco pruebas pasaron antes de ejecutar la reparación.
La reparación se confirmó en Neon y sus metadatos se verificaron por lectura posterior;
no se repitió el DDL para probar una segunda aplicación.

## Historial: reparación parcial, no migración completada

No se crea otra migración, no se editan los artefactos originales y no se alteran
el ledger ni el marcador Prisma. **El esquema quedó parcialmente adelantado al marcador**:
es una reparación operativa documentada, no una sincronización completa del historial.
No es correcto registrar la migración entera mientras sus dos operaciones de sanciones sigan pendientes.

El ejecutor instalado de Prisma 8 comprueba primero los postchecks y omite operaciones
ya satisfechas. Cuando se autorice por separado completar la migración original, su
ejecución focalizada al destino de esa migración reconocerá las tres operaciones realizadas,
ejecutará los cambios restantes de sanciones y registrará la migración completa con las
operaciones omitidas identificadas. Nunca registrar manualmente una aplicación ficticia.
No ejecutar ahora ese paso ni desactivar checks. Si se exige marcador totalmente sincronizado
inmediatamente, ese requisito es incompatible con completar esta migración sin tocar sanciones;
haría falta decidir explícitamente otra estrategia de migraciones antes de escribir.

## Secuencia de la autorización única ejecutada

Con conexión local cargada opacamente al proceso, se ejecutó en este orden:

1. [node scripts/repair-rule-suspension.mjs --apply --authorize-neon](../../backend/scripts/repair-rule-suspension.mjs:30).
2. [npm run rules:seed -- --dry-run](../../backend/prisma/seeds/rules.runner.ts:34), usando el runner real ya desbloqueado.
3. Sólo si coincide el preflight: [npm run rules:seed -- --apply --authorize-neon](../../backend/prisma/seeds/rules.runner.ts:34).

El preflight anterior calculó dos categorías nuevas, 29 reglas, 29 versiones,
una versión de términos y 29 enlaces iniciales; conserva las ocho categorías existentes
y reutiliza una categoría oficial. Revalidar estos números, no asumirlos constantes.
No ejecutar el seed general. No modificar sanciones, usuarios, aceptaciones, historial de
negocio, interfaz ni artefactos de Showcase en esta reparación.

Ante fallo antes del commit, rollback transaccional de todo el DDL. Ante resultado de commit
incierto, verificar metadatos antes de reintentar. Después de un commit exitoso no hay rollback
destructivo automático: eliminar las columnas podría perder políticas ya cargadas. Si falla el
seed posterior, éste revierte su propia transacción; las columnas reparadas permanecen.

## Resultado confirmado

- Reparación transaccional: las dos columnas nullable sin default y el CHECK validado
  coinciden con el contrato. No se ejecutó la parte de sanciones ni se marcó la migración completa.
- Preflight real previo: 2 categorías, 29 reglas, 29 versiones y 1 término faltantes,
  sin conflictos. Se aplicó únicamente el seed focalizado, una vez y en su propia transacción.
- Lectura posterior al commit: 10 categorías totales; las 8 previas se compararon completas
  en memoria y quedaron idénticas. Se crearon 2 categorías, 29 reglas, 29 versiones,
  29 vínculos iniciales y 1 término; una categoría oficial existente fue reutilizada.
- Las 29 versiones persistidas coinciden con el catálogo en identidad, categoría,
  criterios, penalización, consecuencia y suspensión; el texto del término coincide con la fuente.
- Términos públicos v1: **4758aae4-19eb-46e0-9cd2-481ab57d4575**,
  publicados **2026-10-28T13:24:01.890Z**.
- HTTP local real con el controlador público, caso de uso y repositorio existentes contra Neon:
  GET vigente y GET de esa versión devolvieron **200**, respuestas idénticas,
  **29 políticas COMPLETE**, sólo campos públicos. Se configuró conexión de sólo lectura;
  no se montaron módulos con tareas automáticas ni rutas mutantes.
- El montaje inicial de verificación entregaba incorrectamente el runtime al repositorio;
  se corrigió sólo el montaje en memoria y la verificación HTTP pasó, sin cambios de código.
- Preflight real final de sólo lectura: **0 categorías, 0 reglas, 0 versiones y 0 términos
  faltantes; 0 conflictos**. No se volvió a aplicar el seed.
- Sin suites DB, navegador, build ni otras fases. No se revalidaron los seis errores
  conocidos de build de Prototype. Continúa pendiente el resto de la migración original;
  el drift parcial temporal es intencional y no equivale a una migración completada.
