# Seed oficial de reglas y términos

## Fuente y representación

La [línea base de términos](../requirements/terms-and-conditions.md:5) del 19 de octubre de 2026 es vigente **para desarrollo**, no acredita aprobación institucional externa. No se incorporan propuestas de maquetas ni nuevas penalizaciones.

El [catálogo tipado compartido](../../backend/src/modules/rules/domain/official-policy.catalog.ts:1) prepara **29 reglas, 29 versiones iniciales y 1 versión de términos completa**:

| Familia | Cantidad | Referencia normativa (no redefinida aquí) |
| --- | ---: | --- |
| Tardanza | 9 | [Matrices de categoría y gravedad](../requirements/terms-and-conditions.md#5-regla-r-tar-devolución-tardía). |
| Daño | 9 | [Matrices y criterios](../requirements/terms-and-conditions.md#6-regla-r-dan-daño-o-piezas-faltantes). |
| Pérdida/robo | 1 | [Efecto y cierre por incidencia](../requirements/terms-and-conditions.md#7-regla-r-per-pérdida-o-robo). |
| Inasistencia | 3 | [Ventana y reincidencia](../requirements/terms-and-conditions.md#regla-r-res-inasistencia-a-una-reserva). |
| Puntualidad | 3 | [Referencias y recompensa](../requirements/terms-and-conditions.md#9-recompensa-por-devolución-puntual-y-sin-faltas). |
| Acceso | 3 | [Categorías, duración y acceso](../requirements/terms-and-conditions.md#3-categorías-duración-y-acceso). |
| Confianza | 1 | [Modelo de confianza](../requirements/trust-model.md#porcentaje-inicial-y-niveles). |

Al faltar columnas específicas de categoría, gravedad, umbral, efecto a cero, acceso y recompensa, se conservan metadatos discriminados en la descripción textual existente. La descripción incluye identidad real de categoría, criterios, fuente y revisión documental. Los campos existentes de descuento y suspensión conservan sus valores exactos. Las instrucciones de establecer a cero usan descuento nominal cero como campo **no aplicable**, con efecto explícito separado; no se inventa una penalización nominal de 100.

Los identificadores de reglas/versiones son UUID fijos reservados por familia/categoría/gravedad, no IDs de categorías asumidos. La versión de almacenamiento inicial es 1; la revisión documental es 2026-10-19. Los slots no deben reutilizarse. Las obligaciones generales, apelaciones y demás condiciones se conservan en el texto completo de términos, sin abreviarlo para aceptación.

## Consulta y aplicación existentes

- La consulta de reglas activas devuelve **solo las versiones vigentes activas**, conservando versiones históricas aunque aún tengan estado activo.
- El registro manual consulta la versión vigente persistida, no vuelve a buscar descuentos en el catálogo fuente. Daño y pérdida/robo aprovechan el registro transaccional existente de incumplimiento, confianza, sanción y auditoría. El efecto a cero descuenta solo el saldo real y conserva antes/después y la versión exacta.
- El registro manual **rechaza configuración de acceso, recompensa y confianza** como si fueran faltas.
- También rechaza las políticas automáticas sembradas de tardanza/inasistencia: su entrada actual carece de préstamo/reserva y no puede garantizar clasificación, escalamiento diferencial ni deduplicación. No se añade otro motor ni se aplica una consecuencia total repetidamente mediante ese endpoint.
- Recompensa, rangos y niveles permitidos quedan persistidos y consultables, **no conectados a un motor nuevo**. El modelo actual de categoría no tiene niveles permitidos ni referencia versionada de recompensa; la reserva no conserva instantáneas de matrices/versiones. No se atribuye a este seed aplicación automática ni fidelidad histórica de reservas que el dominio aún no ofrece.
- La selección de categoría/gravedad de daño sigue dependiendo de la regla elegida y verificación del operador; la entrada actual no permite validarla contra un préstamo. El seed no inventa esa relación.
- Los términos completos se consultan por las [rutas públicas de lectura](public-terms.md). La elegibilidad existente usa la versión de términos de mayor número y exige su aceptación. El seed no crea aceptaciones ni modifica solicitudes, usuarios o cuentas.

El seed **no introduce una nueva migración** ni cambia el contrato ORM; requiere que las columnas del contrato vigente ya existan físicamente. El bloqueo detectado por columnas de suspensión ausentes y su reparación parcial pendiente están descritos en la [guía focalizada de reparación](rules-schema-repair.md). La lectura pública amplía el contrato API y sus artefactos mediante el flujo de generación existente. Normalizar metadatos, enlazar incumplimientos a operaciones y congelar políticas al reservar requiere otro cambio explícito; no se oculta como parte del seed.

## Idempotencia y conflictos

El [adaptador](../../backend/prisma/seeds/rules.seed.ts:1) ejecuta todo en una transacción. Solo escribe categorías faltantes, reglas/versiones faltantes, su enlace vigente inicial y términos faltantes. La segunda pasada equivalente no escribe nada.

Las categorías se resuelven por nombre natural normalizado (acentos, espacios extremos y mayúsculas), conservando su UUID; tras el primer seed se reutiliza además la identidad persistida incluso si cambia el nombre. Dos coincidencias, identidades incompatibles o duración existente distinta abortan: no se reclasifica un laboratorio como electrónico ni se cambia una categoría personalizada. Solo se crean Electrónicos, Libros y Deportes si faltan. Las demás categorías no reciben políticas inventadas.

Una diferencia de contenido en una versión inicial o términos número 1 aborta y revierte todo, incluso si ya existen aceptaciones. No se actualizan versiones históricas, estados ni punteros existentes. Versiones posteriores y términos posteriores permanecen vigentes según su administración; tampoco se reactivan reglas desactivadas. Las reglas manuales/custom ajenas permanecen intactas. Ante conflicto se requiere revisión explícita y una nueva versión; nunca renumeración automática ni sustitución silenciosa.

## Ejecución autorizada pendiente

La comprobación previa [`npm run rules:seed -- --dry-run`](../../backend/prisma/seeds/rules.runner.ts) consume solo una conexión ya provista al proceso, sin cargar secretos ni requerir autorización de escritura. Reutiliza el mismo validador dentro de una transacción y sustituye las operaciones de creación por simulación local: solo envía consultas de lectura de categorías, reglas, versiones y términos. Los campos `created*` del resultado significan **faltantes que se crearían**, no escrituras realizadas; `createdRules` también determina los enlaces iniciales faltantes. Ante conflicto histórico informa el primer conflicto controlado y no escribe nada. No puede combinarse con opciones de aplicación. La comprobación no reserva filas: la aplicación vuelve a validar transaccionalmente.

Desde el backend, el comando focalizado es [`npm run rules:seed -- --apply`](../../backend/package.json:15). Exige una conexión proporcionada explícitamente en el entorno autorizado: **no lee archivos de secretos**, no carga demos ni modifica usuarios/autenticación. Sin autorización de aplicación falla antes de construir el cliente; Neon exige además autorización previa del responsable y el indicador adicional [`--authorize-neon`](../../backend/prisma/seeds/rules.runner.ts:10).

Para una eventual ejecución en Neon, **solicitar primero autorización** explicando: creará como máximo **3 categorías, 29 reglas, 29 versiones, 1 versión de términos y 29 enlaces vigentes iniciales de reglas nuevas**; no actualizará ninguna fila preexistente ni tocará préstamos, usuarios, cuentas, sanciones, apelaciones o aceptaciones. Si hay conflicto, no persistirá cambios. Tras esa autorización, usar [`npm run rules:seed -- --apply --authorize-neon`](../../backend/package.json:15), nunca el seed general. No se ha ejecutado contra ninguna base compartida.

La [entrada general](../../backend/prisma/seed.ts:1) enlaza estas políticas antes de los seeds previos. **No es el comando seguro focalizado:** sigue incluyendo demos de inventario/usuarios/autenticación y ahora exige la misma autorización de aplicación. No usarla para cargar únicamente reglas.

Las [pruebas offline focales](../../backend/src/modules/rules/official-policy.spec.ts:1) reutilizan el constructor SQL y transacciones en memoria; bloquean la carga de secretos. Cubren valores oficiales, límites, segunda pasada, conflictos/rollback, preservación y consulta/aplicación mínima. No sustituyen una validación posterior autorizada del driver en PostgreSQL.
