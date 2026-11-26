# Integración interna de políticas históricas y episodios

## Alcance y autoridad

Implementación del contexto de reglas/confianza, basada en [requisitos](../../docs/requirements/README.md), [acumulación y cierre](../../docs/requirements/terms-and-conditions.md) y [arquitectura de publicaciones](../../docs/architecture/public-terms.md). La entrega final incluye cierre HTTP, automatización, reevaluación transaccional de elegibilidad y rehabilitación; las secciones de integración del motor describen sus responsabilidades internas, no funcionalidades pendientes.

Estado vigente: [compatibilidad segura](#compatibilidad-segura--contrato-vigente) y [verificación final](#verificación-final-de-compatibilidad). Los inventarios de archivos, generaciones y conteos anteriores se conservan como evidencia de sus respectivas entregas, no como operaciones repetidas en este cierre.

## Firmas para conectar

El motor se exporta como proveedor del [módulo de reglas](../src/modules/rules/rules.module.ts). Puede inyectarse o construirse con el servicio de persistencia existente. No abre transacciones ni captura el reloj.

- [`LoanEpisodeEngine.synchronize(tx: RulesTransaction, data: SynchronizeLoanEpisodes, at: Date): Promise<LoanEpisodeResult>`](../src/modules/rules/infrastructure/persistence/prisma/loan-episode.engine.ts:89).
- [`LoanEpisodeEngine.readPolicy(tx: RulesTransaction, loanId: string): Promise<HistoricalLoanPolicy>`](../src/modules/rules/infrastructure/persistence/prisma/loan-episode.engine.ts:69).
- [`HistoricalLoanPolicyReader.read(tx: RulesTransaction, context: HistoricalLoanPolicyContext): Promise<HistoricalLoanPolicy>`](../src/modules/rules/infrastructure/persistence/prisma/historical-loan-policy.reader.ts:31).
- [`PrismaSanctionRepository.cancelReservations(tx: Runtime, userId: string, reason: string, now: Date): Promise<string[]>`](../src/modules/rules/infrastructure/persistence/prisma/prisma-sanction.repository.ts:550). Exige bloqueo previo del usuario. Ya se invoca desde sanción manual, incumplimiento/no-show y episodios de préstamo.

El [tipo transaccional](../src/modules/rules/infrastructure/persistence/prisma/historical-loan-policy.reader.ts:11) solo exige el ejecutor de consultas de la transacción nativa. El [comando](../src/modules/rules/infrastructure/persistence/prisma/loan-episode.engine.ts:30) contiene usuario, préstamo, actor verificado o proceso, origen del llamador e instante efectivo opcional. El [resultado](../src/modules/rules/infrastructure/persistence/prisma/loan-episode.engine.ts:49) devuelve identificadores de ajustes nuevos, sanciones afectadas, reservas canceladas, saldo resultante y señal de préstamo no activo.

Para daño se entregan las dos gravedades, física y faltantes, identificador de inspección persistida del mismo préstamo y fundamento. Una ausencia de ambas gravedades no produce cargo. La gravedad de faltantes debe corresponder al checklist: no puede indicarse sin piezas faltantes ni omitirse si las hay. Para pérdida/robo se entregan condición, fundamento e identificadores de evidencias de pérdida del mismo préstamo. Ambos incidentes requieren cierre con actor de cuenta; no son comandos del proceso automático. No se admite daño y pérdida simultáneos por el mismo hecho.

## Lectura para GET e inspección

La [proyección histórica](../src/modules/rules/domain/loan-policy.ts:11) devuelve las opciones de daño, los tres tramos de mora, pérdida y recompensa, además de publicación y categoría. Incluye identificadores/versiones de regla, criterios, puntos, efecto y suspensión. La entrega final conecta esta proyección al GET de política de devolución y amplía el contrato HTTP de cierre, descrito más abajo.

La lectura exige una publicación completa mediante el [repositorio de términos](../src/modules/rules/infrastructure/persistence/prisma/prisma-terms.repository.ts:33). Solo carga las versiones del manifiesto, sin filtrar su estado histórico por el estado vigente. No usa importes del catálogo baseline ni punteros actuales.

Precedencia de procedencia:

1. Referencia común explícita del [snapshot](../src/modules/inventory/domain/entities/resource-configuration.ts:33), capturada por la [confirmación](../src/modules/loans/infrastructure/integration/capture-loan-configuration.ts:14).
2. Referencia de inasistencia conservada en el snapshot del préstamo, junto con su categoría histórica.
3. Snapshot de su reserva vinculada, si el préstamo antiguo no trasladó las referencias.
4. Solo si no hay referencia: publicación existente al confirmar esa reserva, usando su fecha de creación, y categoría acreditada por un snapshot. No se infiere categoría desde el catálogo actual.

Referencias contradictorias, categoría ausente, publicación incompleta, escalas ambiguas o discontinuas producen conflicto y deben revertir la transacción. Una referencia explícita inválida no habilita fallback a reglas vigentes.

## Secuencia del cierre

1. Abrir la transacción y adquirir la barrera común de inventario/publicación antes de bloquear filas.
2. Autorizar al actor y bloquear primero el usuario y después el préstamo; capturar entonces una sola vez el tiempo de operación. El motor también toma esos bloqueos en ese orden; no debe llamarse después de adquirirlos en orden contrario.
3. Comprobar idempotencia del cierre por préstamo y clave de solicitud antes de ejecutar consecuencias. La misma clave con hash/actor diferentes debe ser conflicto. No registrar una nueva recompensa en un reintento.
4. Persistir/validar inspección y evidencias dentro de la misma transacción, cuando correspondan.
5. Invocar el motor mientras el préstamo siga activo, con el instante efectivo del cierre, nunca posterior al tiempo capturado. Reconstruye primero la mora hasta ese instante; luego agrega un solo daño por máxima gravedad o una pérdida/robo independiente.
6. Resolver cierre, condición física, devolución real o incidencia y eventual recompensa puntual usando la política histórica. El motor **no** crea devoluciones, no cambia el estado del préstamo, no calcula ni acredita recompensas y no repara/habilita ejemplares.
7. Persistir el resultado de cierre y confirmar todo junto. No atrapar un error del motor para continuar confirmando parcialmente.

El cierre por pérdida/robo debe marcar el préstamo cerrado por incidencia y el ejemplar no disponible, sin devolución ficticia ni recompensa. La pérdida persistida congela la mora en su instante incluso si el préstamo todavía figura activo; no se admite daño posterior. Los llamados al motor para un préstamo no activo no generan ajustes. Un reintento del cierre debe recuperar su resultado persistido antes de llegar a ese caso.

## Automatización y calendario

La automatización entrega un proceso identificado, sin daño/pérdida, y el tiempo ya capturado por el llamador. El [job local](../src/modules/loans/infrastructure/loan-overdue.service.ts) está registrado al inicio y cada 60 segundos, sin solape local y con máximo de cuatro lotes de 25. Se verificó sin arrancar la aplicación real.

- Un episodio de mora por préstamo. Se reconstruyen todos los umbrales cruzados, con el primer milisegundo posterior al límite exclusivo como instante efectivo. El vencimiento exacto no es mora.
- Cada ajuste calcula incremento nominal como objetivo menos nominal alcanzado, y efectivo como el mínimo entre incremento y saldo. Los puntos truncados por saldo cero no se cobran posteriormente.
- La suspensión aumenta por diferencia de duración total. Una extensión vigente desplaza las siguientes; una ya cumplida añade únicamente la diferencia al final. Los bloqueos indefinidos empiezan inmediatamente y no pausan las temporales.
- Se deduplica por episodio, gravedad y versión. Una sanción absuelta deja de escalar. Los importes, saldos y versiones iniciales no se reescriben.
- Las fechas de ejecución y las efectivas son distintas. El estado efectivo se determina por el intervalo y el [evaluador existente](../src/modules/rules/domain/entities/sanction-schedule.ts:9), no exclusivamente por el estado almacenado de una ejecución histórica demorada.

Las funciones puras de [ampliación](../src/modules/rules/domain/episode-calendar.ts:23), [absolución](../src/modules/rules/domain/episode-calendar.ts:88), [ajuste](../src/modules/rules/domain/episode-adjustment.ts:6) y [restitución](../src/modules/rules/domain/episode-adjustment.ts:41) están separadas de persistencia para pruebas y reutilización interna.

## Cancelación, apelaciones y rehabilitación

La cancelación compartida solo cancela reservas confirmadas no recogidas y guarda motivo/auditoría sin crear no-show. Solo libera un ejemplar reservado, apto, habilitado, con recurso y categoría activos, sin otro préstamo activo ni reserva confirmada. Una condición física nula de legado **no acredita aptitud**. Nunca libera un ejemplar prestado ni cancela un préstamo activo.

La [resolución de apelaciones](../src/modules/rules/infrastructure/persistence/prisma/prisma-appeal.repository.ts:159) ya suma los descuentos efectivos de todos los ajustes, una sola vez, con tope cien. Sin ajustes conserva la diferencia original de saldos del legado. La transición de pendiente a resuelta y de sanción a absuelta, el saldo y la reprogramación de siguientes se realizan en la misma transacción. La auditoría conserva los calendarios anterior y posterior. No altera la condición física del ejemplar.

Para rehabilitación, la resolución material de un bloqueo indefinido sigue siendo el [levantamiento administrativo existente](../src/modules/rules/infrastructure/persistence/prisma/prisma-sanction.repository.ts). No absuelve ni devuelve confianza. La operación de inventario implementada exige verificación explícita y habilitación separada, actividad y ausencia de compromisos antes de disponibilidad; no deduce reparación desde la absolución o el levantamiento. Los ejemplares legados sin clasificación requieren verificación explícita; los nuevos se crean aptos y habilitados.

## Esquema y migración offline

Fuente única: [contrato Prisma nativo](../prisma/contract.prisma). [Artefactos tipados](../prisma/contract.d.ts) y [contrato emitido](../prisma/contract.json) se generaron con la herramienta instalada, sin edición manual.

- [Cierre único](../prisma/contract.prisma:299): préstamo único, solicitud única, hash, actor/contexto, inspección/resultado/recompensa e instante efectivo. La semántica de hash e idempotencia la conecta el cierre.
- [Episodio](../prisma/contract.prisma:411): préstamo nullable para legado, categoría/publicación/origen obligatorios en episodios nuevos; unicidad por préstamo y origen. Las referencias a préstamo, categoría y publicación son restrictivas.
- [Ajustes](../prisma/contract.prisma:446): historial append-only desde este motor, unicidad por episodio/gravedad/versión, referencia restrictiva a versión, objetivo/incremento nominal nullable para establecer cero, efectivo/saldos/duración y calendarios. No existe operación de modificación/borrado de ajustes en esta API.
- [Ejemplar](../prisma/contract.prisma:79): condición física nullable para legado y habilitación separada. No se reclasifica ni repara masivamente el legado.

El [paquete nuevo](../prisma/migrations/app/20261125T0313_loan_policy_episodes/migration.ts) parte explícitamente de la punta de inasistencias, hash 21bf2bbc35dc01507a1ee4e804cfa31bde531b5023de21adc4a21e09e27ea036, y llega a cc2b201bafbcbb0245956beddd7a63637bab481b2272a588f6a6747324bb3b48. No contiene las diferencias de configuraciones previas ni modifica migraciones anteriores. Reemplaza el check de estados del préstamo únicamente para admitir el cierre por incidencia; no elimina tablas ni datos.

Se emitió y planificó con la [configuración sin conexión](../scripts/prisma-offline.config.ts). **Migración no aplicada.** No se leyó entorno ni secretos, no se instalaron dependencias, no se ejecutaron seeds ni se arrancó la aplicación. Las pruebas con [configuración offline](../vitest.config.offline.ts) y [setup sin entorno](../test/setup-offline.ts) verifican dominio y repositorios con el doble existente en memoria; no certifican concurrencia real ni DDL en PostgreSQL.

## Verificación realizada

### Resultado consolidado anterior a H1–H4

La evidencia correctiva vigente se registra en la [verificación H1–H4](../../docs/development/loan-integration-verification.md#corrección-independiente-h1h4). Los conteos siguientes corresponden al corte backend anterior, no se suman a la ejecución correctiva.

- 20 suites seleccionadas, **480 pruebas aprobadas, cero fallos u omitidas**. Ejecución con `vitest run --config vitest.config.offline.ts --pool=threads`, mediante el CLI instalado y wrapper de proceso que normaliza la unidad Windows a `D:`. No se usó la API programática del runner: esa variante falló antes de registrar pruebas por duplicación de contexto.
- `npm run typecheck`, `npm run build` y `git diff --check`: correctos. `npm run lint`: cero errores y siete advertencias en archivos no modificados.
- Las suites incluyen las ocho nuevas de episodios/calendario/cierre/job/transiciones/cancelación/rehabilitación/revisión, contratos de préstamos/confianza/categorías y regresiones de repositorios y casos de uso. Los fallos intermedios de fixtures se corrigieron sin eliminar aserciones.
- El cierre reintenta únicamente contención tipada de la barrera, hasta cinco transacciones; concilia el resultado persistido antes de tocar el ejemplar. Agotamiento sin resultado: 503 transitorio; incompatibilidad de préstamo/actor/huella: 409.
- La barrera global evita ciclos entre recursos de una categoría, pero reduce paralelismo. La exclusión del job y los cursores son locales al proceso. La corrección H2 sustituye la denegación por cantidad de activos por páginas de 25 y presupuesto de 100 unidades con trabajo pendiente: confirma progreso antes de denegar transitoriamente y los reintentos omiten lo ya aplicado o absuelto. No existe cupo funcional de cien préstamos por titular.
- La migración permanece **preparada, no aplicada**. No se ejecutó ninguna suite DB ni seed, ni se leyeron secretos o archivos de entorno. Los dobles no acreditan aislamiento, bloqueos ni aplicación de DDL en PostgreSQL.
- El contrato HTTP fuente son los DTO/controladores actuales. La copia backend inicialmente intermedia y la copia frontend se regeneraron en la integración final: 84 operaciones, comprobación de igualdad correcta y 117 pruebas OpenAPI aprobadas. El catálogo documental ORM se regeneró sin conexión: 25 modelos, 13 enums. La prueba estricta de igualdad entre copias no se debilitó. Véase [verificación de integración](../../docs/development/loan-integration-verification.md).

### Contratos para frontend

- `GET /loans/:loanId/return-policy`: operador/administrador, solo lectura. [Respuesta exacta](../src/modules/loans/presentation/dto/loan-closure-response.dto.ts:70), con opciones heredadas de la política pública y `versionId`; 403/404/503 según autorización/existencia/resolución histórica.
- `POST /loans/:loanId/return`: 201, [cuerpo exacto](../src/modules/loans/presentation/dto/return-loan.dto.ts:91) e [inspección completa](../src/modules/loans/presentation/dto/return-loan.dto.ts:30). No admite fecha efectiva, actor, categoría ni importes enviados por cliente. Inspección y evidencias obligatorias, aunque sus listas puedan estar vacías según snapshot.
- `POST /loans/:loanId/close-incident`: 201, [cuerpo exacto](../src/modules/loans/presentation/dto/return-loan.dto.ts:108). Pérdida/robo confirmado, sin devolución ficticia. Recompensa nula.
- Los cierres conservan la respuesta de préstamo y agregan [cierre, consecuencias, recompensa y ejemplar](../src/modules/loans/presentation/dto/loan-closure-response.dto.ts:8), además de identificadores de reservas canceladas. GET préstamo devuelve el cierre original persistido; mismo actor/clave/cuerpo reproduce el resultado y hora originales. Cierres legados no reciben consecuencias retroactivas.
- H1: la respuesta persistida del cierre usa el mismo snapshot histórico acreditado que la inspección. Si procede de la reserva porque el préstamo parcial carece de componentes, no se reescribe el snapshot original del préstamo ni se consulta catálogo actual. GET/replay recuperan exactamente esa proyección. La [prueba HTTP interoperable](../test/loan-closure.offline.spec.ts:1197) pasa respuestas reales serializadas por los validadores frontend; la ausencia no recuperable sigue siendo 503.
- H3: el [detalle de sanción](../src/modules/rules/presentation/dto/sanction.dto.ts:115) agrega una proyección actual opcional/nullable: última gravedad y versión histórica, objetivo nominal, suma efectiva e historial de ajustes con saldos, incrementos, duración y fechas efectiva/registro. El primer descuento ya forma parte del historial; no se suma otra vez el antecedente inicial. Sin ajustes devuelve null; consumidores anteriores pueden omitir el campo. Absolución conserva los importes históricos, no los convierte en cargo vigente ni altera su restitución efectiva.
- `PATCH /inventory/copies/:copyId/state`: operador/administrador, [cuerpo exacto](../src/modules/inventory/presentation/dto/update-copy-state.dto.ts:57). Para rehabilitar: `estado: DISPONIBLE` y `verification` con `fitForLoan: true`, `componentsComplete: true`, motivo no blanco de hasta 1000 caracteres y `evidenceIds` UUID únicos obligatorios (admite lista vacía); evidencias del mismo ejemplar. No habilita administrativamente ni absuelve.

### Evidencia de etapas anteriores

- Comprobación estática de tipos completa sin errores; lint focalizado en 19 archivos sin advertencias ni errores.
- 106 pruebas seleccionadas aprobadas: 103 de motor/calendario/cancelación y regresiones de reglas/reservas, más tres de rechazo manual oficial. Los demás casos del archivo de políticas se excluyeron de esta ejecución para no ejecutar sus seeds, incluso en memoria.
- Suites nuevas: [episodios](../test/loan-episodes.offline.spec.ts), [calendario y restitución](../test/episode-calendar.offline.spec.ts), [cancelación](../test/sanction-cancellation.offline.spec.ts).
- Plan offline posterior desde el hash final hacia el contrato emitido: ninguna diferencia pendiente. Revisión de whitespace aprobada; únicamente avisos locales de conversión de finales de línea de Git.

## Inventario final de archivos cambiados

- [docs/loan-episodes-integration.md](../docs/loan-episodes-integration.md)
- [openapi.json](../openapi.json)
- [prisma/contract.d.ts](../prisma/contract.d.ts)
- [prisma/contract.json](../prisma/contract.json)
- [prisma/contract.prisma](../prisma/contract.prisma)
- [prisma/migrations/app/20261125T0313_loan_policy_episodes/migration.json](../prisma/migrations/app/20261125T0313_loan_policy_episodes/migration.json)
- [prisma/migrations/app/20261125T0313_loan_policy_episodes/migration.ts](../prisma/migrations/app/20261125T0313_loan_policy_episodes/migration.ts)
- [prisma/migrations/app/20261125T0313_loan_policy_episodes/ops.json](../prisma/migrations/app/20261125T0313_loan_policy_episodes/ops.json)
- [prisma/migrations/snapshots/cc2b201bafbcbb0245956beddd7a63637bab481b2272a588f6a6747324bb3b48/contract.d.ts](../prisma/migrations/snapshots/cc2b201bafbcbb0245956beddd7a63637bab481b2272a588f6a6747324bb3b48/contract.d.ts)
- [prisma/migrations/snapshots/cc2b201bafbcbb0245956beddd7a63637bab481b2272a588f6a6747324bb3b48/contract.json](../prisma/migrations/snapshots/cc2b201bafbcbb0245956beddd7a63637bab481b2272a588f6a6747324bb3b48/contract.json)
- [src/modules/inventory/application/ports/inventory.inputs.ts](../src/modules/inventory/application/ports/inventory.inputs.ts)
- [src/modules/inventory/application/use-cases/inventory-crud.spec.ts](../src/modules/inventory/application/use-cases/inventory-crud.spec.ts)
- [src/modules/inventory/application/use-cases/inventory.service.spec.ts](../src/modules/inventory/application/use-cases/inventory.service.spec.ts)
- [src/modules/inventory/application/use-cases/inventory.service.ts](../src/modules/inventory/application/use-cases/inventory.service.ts)
- [src/modules/inventory/domain/entities/inventory.types.ts](../src/modules/inventory/domain/entities/inventory.types.ts)
- [src/modules/inventory/domain/entities/resource-configuration.ts](../src/modules/inventory/domain/entities/resource-configuration.ts)
- [src/modules/inventory/domain/repositories/inventory.repository.ts](../src/modules/inventory/domain/repositories/inventory.repository.ts)
- [src/modules/inventory/infrastructure/persistence/prisma/prisma-inventory.repository.spec.ts](../src/modules/inventory/infrastructure/persistence/prisma/prisma-inventory.repository.spec.ts)
- [src/modules/inventory/infrastructure/persistence/prisma/prisma-inventory.repository.ts](../src/modules/inventory/infrastructure/persistence/prisma/prisma-inventory.repository.ts)
- [src/modules/inventory/presentation/controllers/inventory.controller.ts](../src/modules/inventory/presentation/controllers/inventory.controller.ts)
- [src/modules/inventory/presentation/dto/inventory-response.dto.ts](../src/modules/inventory/presentation/dto/inventory-response.dto.ts)
- [src/modules/inventory/presentation/dto/update-copy-state.dto.ts](../src/modules/inventory/presentation/dto/update-copy-state.dto.ts)
- [src/modules/inventory/presentation/dto/update-copy.dto.ts](../src/modules/inventory/presentation/dto/update-copy.dto.ts)
- [src/modules/loans/application/ports/loans.inputs.ts](../src/modules/loans/application/ports/loans.inputs.ts)
- [src/modules/loans/application/use-cases/loans.use-cases.spec.ts](../src/modules/loans/application/use-cases/loans.use-cases.spec.ts)
- [src/modules/loans/application/use-cases/return-loan.use-case.ts](../src/modules/loans/application/use-cases/return-loan.use-case.ts)
- [src/modules/loans/domain/entities/loan-closure.ts](../src/modules/loans/domain/entities/loan-closure.ts)
- [src/modules/loans/domain/entities/loan.ts](../src/modules/loans/domain/entities/loan.ts)
- [src/modules/loans/domain/repositories/loan.repository.ts](../src/modules/loans/domain/repositories/loan.repository.ts)
- [src/modules/loans/infrastructure/integration/assert-transactional-eligibility.ts](../src/modules/loans/infrastructure/integration/assert-transactional-eligibility.ts)
- [src/modules/loans/infrastructure/integration/capture-loan-configuration.ts](../src/modules/loans/infrastructure/integration/capture-loan-configuration.ts)
- [src/modules/loans/infrastructure/integration/loan-trust-access.ts](../src/modules/loans/infrastructure/integration/loan-trust-access.ts)
- [src/modules/loans/infrastructure/integration/release-reserved-copy.ts](../src/modules/loans/infrastructure/integration/release-reserved-copy.ts)
- [src/modules/loans/infrastructure/integration/users-loan-eligibility.adapter.ts](../src/modules/loans/infrastructure/integration/users-loan-eligibility.adapter.ts)
- [src/modules/loans/infrastructure/loan-overdue-synchronizer.ts](../src/modules/loans/infrastructure/loan-overdue-synchronizer.ts)
- [src/modules/loans/infrastructure/loan-overdue.service.ts](../src/modules/loans/infrastructure/loan-overdue.service.ts)
- [src/modules/loans/infrastructure/persistence/prisma/prisma-loan-closure.ts](../src/modules/loans/infrastructure/persistence/prisma/prisma-loan-closure.ts)
- [src/modules/loans/infrastructure/persistence/prisma/prisma-loan.repository.ts](../src/modules/loans/infrastructure/persistence/prisma/prisma-loan.repository.ts)
- [src/modules/loans/infrastructure/persistence/prisma/prisma-reservation.repository.spec.ts](../src/modules/loans/infrastructure/persistence/prisma/prisma-reservation.repository.spec.ts)
- [src/modules/loans/infrastructure/persistence/prisma/prisma-reservation.repository.ts](../src/modules/loans/infrastructure/persistence/prisma/prisma-reservation.repository.ts)
- [src/modules/loans/infrastructure/persistence/prisma/reservation-no-show.spec.ts](../src/modules/loans/infrastructure/persistence/prisma/reservation-no-show.spec.ts)
- [src/modules/loans/loans.module.ts](../src/modules/loans/loans.module.ts)
- [src/modules/loans/presentation/controllers/loans.controller.ts](../src/modules/loans/presentation/controllers/loans.controller.ts)
- [src/modules/loans/presentation/dto/loan-closure-response.dto.ts](../src/modules/loans/presentation/dto/loan-closure-response.dto.ts)
- [src/modules/loans/presentation/dto/loans-response.dto.ts](../src/modules/loans/presentation/dto/loans-response.dto.ts)
- [src/modules/loans/presentation/dto/return-loan.dto.ts](../src/modules/loans/presentation/dto/return-loan.dto.ts)
- [src/modules/rules/application/use-cases/register-violation.use-case.ts](../src/modules/rules/application/use-cases/register-violation.use-case.ts)
- [src/modules/rules/domain/category-trust-access.ts](../src/modules/rules/domain/category-trust-access.ts)
- [src/modules/rules/domain/episode-adjustment.ts](../src/modules/rules/domain/episode-adjustment.ts)
- [src/modules/rules/domain/episode-calendar.ts](../src/modules/rules/domain/episode-calendar.ts)
- [src/modules/rules/domain/loan-policy.ts](../src/modules/rules/domain/loan-policy.ts)
- [src/modules/rules/domain/public-terms-policy.ts](../src/modules/rules/domain/public-terms-policy.ts)
- [src/modules/rules/infrastructure/persistence/prisma/effective-user-restriction.ts](../src/modules/rules/infrastructure/persistence/prisma/effective-user-restriction.ts)
- [src/modules/rules/infrastructure/persistence/prisma/historical-loan-policy.reader.ts](../src/modules/rules/infrastructure/persistence/prisma/historical-loan-policy.reader.ts)
- [src/modules/rules/infrastructure/persistence/prisma/loan-episode.engine.ts](../src/modules/rules/infrastructure/persistence/prisma/loan-episode.engine.ts)
- [src/modules/rules/infrastructure/persistence/prisma/prisma-appeal.repository.ts](../src/modules/rules/infrastructure/persistence/prisma/prisma-appeal.repository.ts)
- [src/modules/rules/infrastructure/persistence/prisma/prisma-sanction.repository.ts](../src/modules/rules/infrastructure/persistence/prisma/prisma-sanction.repository.ts)
- [src/modules/rules/infrastructure/persistence/prisma/prisma-terms.repository.ts](../src/modules/rules/infrastructure/persistence/prisma/prisma-terms.repository.ts)
- [src/modules/rules/infrastructure/persistence/prisma/prisma-violation.repository.ts](../src/modules/rules/infrastructure/persistence/prisma/prisma-violation.repository.ts)
- [src/modules/rules/official-policy.spec.ts](../src/modules/rules/official-policy.spec.ts)
- [src/modules/rules/rules.module.ts](../src/modules/rules/rules.module.ts)
- [src/modules/rules/rules.spec.ts](../src/modules/rules/rules.spec.ts)
- [src/modules/users/infrastructure/persistence/prisma/prisma-user.repository.ts](../src/modules/users/infrastructure/persistence/prisma/prisma-user.repository.ts)
- [src/shared/infrastructure/prisma/lock-loan-inventory.ts](../src/shared/infrastructure/prisma/lock-loan-inventory.ts)
- [test/category-administration.spec.ts](../test/category-administration.spec.ts)
- [test/episode-calendar.offline.spec.ts](../test/episode-calendar.offline.spec.ts)
- [test/helpers/in-memory-prisma.ts](../test/helpers/in-memory-prisma.ts)
- [test/helpers/offline-environment.ts](../test/helpers/offline-environment.ts)
- [test/helpers/overdue-fixture.ts](../test/helpers/overdue-fixture.ts)
- [test/independent-review.offline.spec.ts](../test/independent-review.offline.spec.ts)
- [test/inventory-rehabilitation.offline.spec.ts](../test/inventory-rehabilitation.offline.spec.ts)
- [test/loan-closure.offline.spec.ts](../test/loan-closure.offline.spec.ts)
- [test/loan-episodes.offline.spec.ts](../test/loan-episodes.offline.spec.ts)
- [test/loan-overdue-job.offline.spec.ts](../test/loan-overdue-job.offline.spec.ts)
- [test/loan-overdue-operations.offline.spec.ts](../test/loan-overdue-operations.offline.spec.ts)
- [test/loans-contracts.spec.ts](../test/loans-contracts.spec.ts)
- [test/loans.e2e-spec.ts](../test/loans.e2e-spec.ts)
- [test/openapi-contract.spec.ts](../test/openapi-contract.spec.ts)
- [test/sanction-cancellation.offline.spec.ts](../test/sanction-cancellation.offline.spec.ts)
- [test/trust-contracts.spec.ts](../test/trust-contracts.spec.ts)
- [vitest.config.offline.ts](../vitest.config.offline.ts)

## Compatibilidad segura · contrato vigente

Cierre documental del 25/11/2026 (Lima). Fuentes actuales: [contrato inventario backend](../src/modules/inventory/SCHEMA-COMPATIBILITY.md), [contrato préstamos backend](../src/modules/loans/SCHEMA-COMPATIBILITY.md), [inventario cliente](../../frontend/src/modules/inventory/CLIENT-CONTRACT.md), [préstamos/confianza cliente](../../frontend/src/modules/loans/CLIENT-CONTRACT.md) y [API compartida](../../frontend/src/shared/api/SCHEMA-CLIENT-CONTRACT.md). Se revisó implementación real; no se regeneraron OpenAPI ni sus copias, ORM o catálogo DB.

### Bundles y operaciones concretas

La [declaración física](../src/shared/infrastructure/prisma/schema-capability-bundles.ts:16) exige tipos y nulabilidad exactos de columnas, no solo su nombre. El [evaluador](../src/shared/infrastructure/prisma/schema-capabilities.ts:97) comprueba restricciones de la tabla correcta: CHECK validado y expresión reconocida, PK/UNIQUE validadas y no diferidas con columnas exactas, FK validada/no diferida hacia id del destino public, borrado restrictivo y actualización en cascada. No se usa el ledger como prueba de capacidad.

| Bundle | Requisitos concretos |
| --- | --- |
| [copyPhysicalState](../src/shared/infrastructure/prisma/schema-capability-bundles.ts:184) | Tabla ejemplares, condicionFisica text nullable y habilitado boolean no nullable; CHECK físico validado con APTO, DANADO, INCOMPLETO, DANADO_E_INCOMPLETO, PERDIDO y ROBADO. |
| [loanEpisodes](../src/shared/infrastructure/prisma/schema-capability-bundles.ts:189) | Columnas nuevas de incumplimientos (categoriaId, origen, prestamoId, termsVersionId), todas las columnas declaradas de ajustes_incumplimiento; CHECK de origen MORA/DANO/PERDIDA; tres CHECKs semánticos de contexto, efecto/importes/duración y conservación/rangos de saldos; PK de ajustes; UNIQUE episodio por préstamo/origen y ajuste por episodio/severidad/versión; FK de episodio a categoría/préstamo/términos y de ajuste a episodio/versión de regla. |
| [loanClosure](../src/shared/infrastructure/prisma/schema-capability-bundles.ts:185) | Todas las columnas declaradas de cierres_prestamo, PK, UNIQUE por prestamoId y requestId, FK a préstamo; columna estado text no nullable de prestamos y CHECK que incluye CERRADO_POR_INCIDENCIA junto a PLANIFICADO/ACTIVO/FINALIZADO. |
| [loanPolicyEpisodes](../src/shared/infrastructure/prisma/schema-capability-bundles.ts:198) | Unión de los tres anteriores, no interruptor global obligatorio para toda operación. |

La [selección de dependencias](../src/modules/loans/infrastructure/loan-schema.ts:10) y sus llamadores usan estas operaciones exactas:

| Operación informada | Bundles exigidos para escribir |
| --- | --- |
| [reservations.create / pickup / cancel / expire](../src/modules/loans/infrastructure/persistence/prisma/prisma-reservation.repository.ts:199) | copyPhysicalState + loanEpisodes; no loanClosure |
| [loans.synchronizeOverdue](../src/modules/loans/infrastructure/loan-overdue-synchronizer.ts:31) | copyPhysicalState + loanEpisodes |
| [loans.close](../src/modules/loans/infrastructure/persistence/prisma/prisma-loan-closure.ts:204) | copyPhysicalState + loanEpisodes + loanClosure, también para replay integral |
| [episodes.synchronize](../src/modules/rules/infrastructure/persistence/prisma/loan-episode.engine.ts:97) | Con daño: los tres; sin daño: copyPhysicalState + loanEpisodes |
| [sanctions.suspend / lift](../src/modules/rules/infrastructure/persistence/prisma/prisma-sanction.repository.ts:406), [violations.register](../src/modules/rules/infrastructure/persistence/prisma/prisma-violation.repository.ts:42) | copyPhysicalState + loanEpisodes |
| [appeals.create / resolve](../src/modules/rules/infrastructure/persistence/prisma/prisma-appeal.repository.ts:45) | Solo loanEpisodes; no exige inventario físico ni cierres |
| [reservations.releaseForSanction](../src/modules/rules/infrastructure/persistence/prisma/prisma-sanction.repository.ts:615) | copyPhysicalState, dentro de la transacción coordinadora |
| [inventory.createCategory / activateCategory / createResource / activateResource / createCopy / updateCopy / markCopyAsLoaned](../src/modules/inventory/infrastructure/persistence/prisma/prisma-inventory.repository.ts:121) | copyPhysicalState; incluye reasignación/activación, gestión física, retención/baja y rehabilitación. El código descriptivo exclusivo usa inventory.updateCopyDescription, sin exigir bundle completo. |

No se bloquea mora por una tabla de cierres que no utiliza ni apelación por habilitación física. Una operación anidada puede identificar al coordinador interno que detectó el problema. Se comprueba antes de escribir (también antes de bloqueos implementados como actualizaciones neutras) y se revalida con runtime transaccional fresco, sin caché externa. Ausencia de objeto durante escritura causa rollback y 503, nunca reintento por esquema, omisión de consecuencias o devolución básica.

### Matriz de lectura y degradación segura

| Capacidad | Viejo conocido | Parcial conocido | Full conocido |
| --- | --- | --- | --- |
| Inventario público y ejemplares | Lee catálogo/ocupación/stock; campos físicos ausentes nulos y disponibilidad no verificable | Proyecta únicamente columnas físicas presentes; disponibilidad sigue nula si faltan restricciones | Disponibilidad verificable solo con bundle físico completo, permisos y aptitud reales; clasificación legada nula no se convierte en APTO |
| Descriptivos/observaciones | Conserva ediciones descriptivas soportadas | Igual, sin guardar parte descriptiva de una petición mixta rechazada | Controles normales |
| Circulación/altas/rehabilitación | 503 | 503 si falta alguno de sus bundles | Continúa reglas/autorización/transacciones normales |
| [Préstamos e historial](../src/modules/loans/infrastructure/persistence/prisma/prisma-loan.repository.ts:73) | Conserva préstamo/devolución/inspección antiguas sin consultar cierres ausentes; closureHistory UNAVAILABLE | Con columnas acreditadas prestamoId y resultado de cierres_prestamo, lee resultado original y marca AVAILABLE aunque el bundle de escritura esté incompleto | Restaura cierre, consecuencias, recompensa y ejemplar persistidos; AVAILABLE |
| [loans.returnPolicy](../src/modules/loans/infrastructure/persistence/prisma/prisma-loan-closure.ts:133) | 503 si faltan columnas necesarias | Requiere incumplimientos.prestamoId/origen y ajustes: incumplimientoId, versionReglaId, severidad, descuentoEfectivo, duracionTotalDias, fechaEfectiva. Restricciones de escritura ausentes por sí solas no bloquean lectura | Política histórica acreditada, sin catálogo vigente como fallback |
| [sanctions.readDetail](../src/modules/rules/infrastructure/persistence/prisma/prisma-sanction.repository.ts:233) | 503 si faltan columnas proyectadas/usadas | Requiere ajustes: id, incumplimientoId, versionReglaId, severidad, efecto, nominalObjetivo, incrementoNominal, descuentoEfectivo, saldoAnterior, saldoPosterior, duracionTotalDias, fechaEfectiva, createdAt. No exige CHECKs/UNIQUE/FK de escritura para leer | Detalle inicial más episodio/ajustes actuales, sin sumar dos veces el primero |

Viejo/parcial/full son estados por dependencia, no por despliegue. Metadata desconocida **no** habilita degradación: responde 503 antes de aparentar ausencia de cierre/episodio o disponibilidad cero. Lecturas antiguas de reglas, incumplimientos y apelaciones ajenas a estos objetos no cambian. [Recuperación compartida](../src/shared/infrastructure/prisma/schema-capabilities.ts:230): una repetición solo por SQLSTATE 42P01/42703, con invalidación y reconstrucción fuera de transacciones fallidas; red, permisos y SQL ajeno no prueban esquema faltante.

### Metadata, nulos y cuerpo HTTP

El [contrato de inventario](../src/modules/inventory/domain/entities/inventory-compatibility.ts:2) tiene exactamente status, message, capabilities y actions. [Su proyección](../src/modules/inventory/infrastructure/persistence/prisma/prisma-inventory.repository.ts:62) marca READY/message nulo solo con bundle físico completo; de lo contrario UPDATE_PENDING y «Actualización de inventario pendiente. La disponibilidad no se puede verificar y las operaciones de circulación están deshabilitadas.».

Las capacidades physicalCondition/administrativeEnablement acreditan cada columna; verifiedAvailability acredita bundle completo. descriptiveEdits siempre es verdadero; create/activate/release/rehabilitate/manageCopy solo cuando está completo. **No son permisos ni contienen reason**. Campos físicos ausentes/incompatibles son nulos; habilitado falso solo si se leyó falso. available, availableCopies, disponibles y noDisponibles son nulos sin disponibilidad verificable, incluso con stock cero o inactividad. registeredStock contiene libres/prestados/retenidos/reservados por ocupación, totalCopies suma los cuatro; no se usa stock libre como cantidad prestable. Filtros true/false excluyen desconocidos; la consulta sin filtro los mantiene.

En [préstamos](../src/modules/loans/domain/entities/loan.ts:35), solo AVAILABLE + cierre nulo acredita que no se encontró cierre integral (no excluye devolución antigua). UNAVAILABLE y omisión legacy significan historial no acreditado. En [sanciones cliente](../../frontend/src/modules/trust/api/trust-contracts.ts:89), episodio omitido es desconocido, nulo explícito es ausencia de episodio, objeto presente se valida íntegro; no se inventan ajustes ni saldos. La política exige gravedades actual/proyectada presentes, aunque puedan ser nulas.

La [excepción compartida real](../src/shared/infrastructure/prisma/schema-capabilities.ts:36) devuelve HTTP 503 y, por ejemplo:

```json
{
  "statusCode": 503,
  "code": "SCHEMA_CAPABILITY_UNAVAILABLE",
  "operation": "loans.close",
  "diagnostic": "SCHEMA_INCOMPLETE",
  "message": "Operación bloqueada por una actualización pendiente del sistema. Solicite al administrador completar la actualización y vuelva a intentarlo."
}
```

Metadata desconocida cambia el diagnóstico y el mensaje. Cuerpo exacto para la misma operación:

```json
{
  "statusCode": 503,
  "code": "SCHEMA_CAPABILITY_UNAVAILABLE",
  "operation": "loans.close",
  "diagnostic": "SCHEMA_UNKNOWN",
  "message": "No se pudo verificar la disponibilidad de esta operación. Vuelva a intentarlo; si persiste, contacte al administrador."
}
```

La operación es la operación concreta del llamador. **No hay reason ni error en estos cuerpos**, ni SQL, tablas sensibles o secretos. Red o permisos no prueban una actualización pendiente. Otros 503, incluidos fallos de política histórica no resoluble, no se convierten automáticamente a este contrato. El diagnóstico interno METADATA_UNAVAILABLE del snapshot desconocido no se expone como diagnóstico HTTP.

El [cliente compartido](../../frontend/src/shared/api/client.ts:26) conserva API y 401; solo proyecta el código exacto con HTTP 503, operación válida de puntos (2–4 segmentos, máximo 96 caracteres) y los dos diagnósticos admitidos. Construye mensaje público seguro más código/operación, sin copiar texto arbitrario o SQL. La única excepción en [errorMessage()](../../frontend/src/shared/composables/useRemote.ts:4) muestra ese mensaje ya saneado; no altera filtros, cargas, cancelación ni reintentos. El [flujo integral](../../frontend/src/modules/loans/useLoanClosure.ts:7) conserva cuerpo/intención/UUID y concilia solo con historial acreditado; no sustituye el cierre por una escritura básica.

### Jobs y límites operativos

El [proveedor](../src/shared/infrastructure/prisma/schema-capabilities.ts:173) cachea metadata conocida 30 segundos; desconocida no queda cacheada y el runtime transaccional evita la caché. Los jobs verifican capacidades antes de candidatos, reintentan por ciclos de un minuto y conservan cursor/exclusión local. El [monitor](../src/modules/loans/infrastructure/loan-job-monitor.ts:5) registra pausa, recordatorio como máximo cada 15 minutos y recuperación tras recorrido correcto. El fallo de un recorrido persiste entre ticks: cola vacía tras unidades fallidas no acredita recuperación; requiere recorrido posterior sin fallos. No registra SQL, URLs o titulares.

### Verificación final de compatibilidad

Comandos completos, listado de archivos por grupos, hashes y límites en el [cierre de desarrollo existente](../../docs/development/loan-integration-verification.md#compatibilidad-segura--cierre-del-25112026). Corridas actuales separadas, **sin sumarlas ni añadir las anteriores**:

- [Configuración loans-offline](../vitest.config.loans-offline.ts): **18 suites, 476/476**; incluye proveedor 69 y compatibilidad préstamos 39. Se volvió a ejecutar, no se atribuye simplemente el resultado anterior.
- [Configuración offline](../vitest.config.offline.ts) con pool vmThreads y selección inventario/rehabilitación/módulo inventario: **6 suites, 193/193**, complementarias; compatibilidad 55, rehabilitación 43, servicio 46, repositorio 21, CRUD 7, controlador 21.
- [Selección focal frontend](../../frontend/tests/compatibility-review.test.mjs): **269/269**, incluyendo [errores API](../../frontend/tests/schema-api-errors.test.mjs), [rehabilitación](../../frontend/tests/copy-rehabilitation.test.mjs), [cierre](../../frontend/tests/loan-closure.test.mjs), contratos y consumidores. La selección exacta está en el comando del informe enlazado.
- [Tipos backend](../package.json) y [frontend](../../frontend/package.json): salida 0, sin emisión/incremental ni diagnósticos. Build backend mediante CLI Nest instalado: salida 0 **sin texto de salida**, sin iniciar aplicación. [Build frontend seguro](../../frontend/src/shared/api/SCHEMA-CLIENT-CONTRACT.md:35): salida 0, **2144 módulos**, rendering chunks, construido en **4.54 s**, carga de archivos de entorno y escritura desactivadas; tipos comprobados por separado.
- [Global frontend actual](../../frontend/tests/): **459 pruebas, 449 aprobadas, 10 fallidas**, 0 omitidas/canceladas, salida 1. No está aprobada. Los diez casos coinciden con los registrados en la [revisión previa](../../docs/compatibility-review-verification.md#comparación-histórica-de-los-diez-fallos): imagen (1), correcciones finales (2), fase 3 (6), política de acceso (1). La evidencia histórica es **53/63 focales, 10 fallidas** en 5d910793c0701e236ae68bae35000bc0358a233a; no se repitió aquí ni se afirma una suite global histórica. Avisos y errores asíncronos del arnés no se silenciaron.

En este cierre solo se editaron este documento y el informe de desarrollo existente. Los cambios de integración recibidos y artefactos existentes se conservaron, con hashes en el informe. Control final: diff sin errores de whitespace, índice vacío, exclusiones sin cambios, rutas locales de los 47 enlaces nuevos comprobadas; cinco artefactos con tamaño/SHA-256 idénticos al preflight. Sin modificaciones de auth/users/arranque, entorno, migraciones, seeds, dependencias o Git mutante; sin generadores OpenAPI/copias, servicios ni DB. La migración sigue preparada, **no aplicada**. Dobles/AST y Vue en memoria no certifican aislamiento, bloqueos, concurrencia DDL/PostgreSQL real, rendimiento, navegador/CSS ni despliegue. Los diez fallos globales siguen abiertos; no se debilitó ninguna prueba para aprobar.
