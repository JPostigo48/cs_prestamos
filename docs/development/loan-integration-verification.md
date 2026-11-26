# Verificación de integración documental de préstamos · 25/11/2026

**Integración documental posterior:** [compatibilidad + registro y OpenAPI regenerado](final-contract-integration.md:1). Las afirmaciones inferiores sobre generados preservados y conteos corresponden a sus cortes históricos, no al artefacto vigente.

El cierre vigente de compatibilidad y sus verificaciones está en [compatibilidad segura](#compatibilidad-segura--cierre-del-25112026). El corte funcional H1–H4 se encuentra en [corrección independiente](#corrección-independiente-h1h4). Las secciones anteriores a ese cierre se conservan como evidencia histórica, no como resultados de la ejecución final.

## Alcance y resultado

Integración de documentación y artefactos de la implementación ya entregada; sin cambios funcionales, autenticación/registro/cuentas, esquema, migraciones o dependencias. Preflight de solo lectura: estado y diff del árbol e índice; índice vacío antes y después. Se conservaron los cambios previos de backend/frontend. No se accedió a archivos de entorno/secretos, datos, servicios reales o notas externas al repositorio; no hubo instalación, servidor de aplicación, semillas, Git mutante ni aplicación de migraciones.

La migración de episodios **20261125T0313_loan_policy_episodes permanece preparada, NO aplicada**. Las 480 pruebas backend de la entrega anterior no se atribuyen a esta ejecución: aquí se ejecutaron las 117 pruebas focales OpenAPI y los chequeos indicados abajo. No se volvió a emitir el contrato ORM tipado.

**Resultado frontend final: 351 pruebas, 340 aprobadas, 11 fallidas, ninguna cancelada/omitida. No está verde.** Los once fallos se reprodujeron con fuentes HEAD en memoria; no se detectó un fallo nuevo de integración en esta batería. Esto no certifica lógica global, seguridad ni concurrencia real. Los avisos del harness incluyen listeners de scroll, rutas sin coincidencia y errores Vue asíncronos posteriores a pruebas fallidas; no se silenciaron.

## Comandos ejecutados desde la raíz

| Comando | Resultado |
| --- | --- |
| `git status --short`, `git diff --stat`, `git diff --cached --stat` | Preflight de solo lectura; cambios previos amplios; índice sin diferencias |
| `npm run openapi:generate --prefix backend` | 84 operaciones, sin conexiones ni carga de entorno |
| `node scripts/generate-project-showcase.mjs --openapi-only` | Copia frontend sincronizada, sin generación general |
| `node scripts/generate-project-showcase.mjs --db-only` | 25 modelos, 13 enums, 84 direcciones de relación |
| `npm run openapi:check --prefix backend` | 84 operaciones coinciden con las fuentes y ambas copias |
| `npm run test:openapi --prefix backend` | 1 suite, 117 pruebas aprobadas |
| `node --test frontend/tests/project-showcase.test.mjs` | 7/7 aprobadas |
| `node --test frontend/tests/*.test.mjs` | Tras regenerar, antes del ajuste documental: 337/351, 14 fallos. Después del ajuste: 340/351, 11 fallos; salida 1 |
| `npm run typecheck --prefix backend` | Correcto |
| `npm run typecheck --prefix frontend` | Correcto |
| `git diff --check` | Correcto; avisos locales LF/CRLF de Git, sin errores de whitespace |

Los scripts OpenAPI existentes sustituyen la carga de entorno antes de importar la aplicación y no inicializan proveedores de negocio; el runner focal usa la ruta canónica Windows y destino nulo para dotenv. Los modos focales Showcase salen antes de procesar el resto de documentos. Procedimiento: [OpenAPI](../architecture/openapi.md).

SHA-256 del corte documental anterior de ambas copias OpenAPI: `2756233e7f9d1d96e0bd38536652ac7145853c538079af32cf37ae432214bbbb`. SHA-256 del catálogo DB de ese corte: `bf91804fd5a0b394ad32bf1cdda515d0d2174626e579fc839dc04b0a46f5298d`.

El contexto recibido reportaba 336/351 y cuatro pendientes documentales/generados; ese estado anterior a regeneración no se volvió a ejecutar en este corte. La primera ejecución propia posterior a regeneración dio 337/351. Los tres fallos documentales restantes eran conteos explícitos obsoletos en [Showcase](../../frontend/tests/project-showcase.test.mjs:19): modelos 23 → 25, enums 11 → 13, operaciones 81 → 84 y encabezados DB 34 → 38. Se conservaron las comparaciones exhaustivas de campos/atributos/relaciones y artefacto contra fuente; además se añadieron aserciones de presencia de cierres/ajustes, nuevos enums y autorización de endpoints de cierre. No se relajaron validaciones ni se eliminaron pruebas.

## Once fallos restantes: árbol actual y HEAD en memoria

Referencia comparada: HEAD `8e6325906f3afc577cb4c96f478dc18b0d8de5ad`. Se mantuvieron las pruebas actuales y sus helpers; únicamente las lecturas de fuentes bajo frontend/src se sustituyeron por blobs de HEAD. Por tanto, baseline significa **reproducción con fuentes HEAD y pruebas actuales**, no ejecución de toda la suite histórica de HEAD.

| Prueba (nombre exacto) | Evidencia coincidente en ambas ejecuciones |
| --- | --- |
| [imagen: cambiar o cancelar una selección invalida una lectura anterior aún pendiente](../../frontend/tests/auth-user.test.mjs:203) | Espera expresión «PNG o JPEG válida»; recibe mensaje de selección PNG/JPEG o PDF. Discrepancia de texto en registro; fuera de alcance, no se corrigió ni se declaró aprobado el comportamiento posterior de esa prueba. |
| [I7: inicio conserva estados independientes, sanción activa antes de categorías y una sola búsqueda en cabecera](../../frontend/tests/final-corrections.test.mjs:154) | Categoría usada por el montaje llega sin nombre al icono; error de normalize y fallo de desmontaje con vnode nulo. No es evidencia de fallo del cierre de préstamo. |
| [REFLOW: layout añade estado contextual y lo limpia al desmontar; Más conserva todos los destinos ADMIN](../../frontend/tests/final-corrections.test.mjs:180) | Cuenta 11 destinos frente a 7 esperados. |
| [I6: ida y retorno con categoría/disponibilidad/página en ambos orígenes y destino controlado](../../frontend/tests/phase3-corrections.test.mjs:164) | Destino real /app/admin/inventory frente a /app/admin/catalog esperado. |
| [I2: montaje conserva texto ante incertidumbre y no muestra éxito ni permite duplicar](../../frontend/tests/phase3-corrections.test.mjs:243) | Mismo error previo de render de categoría y desmontaje de vnode nulo. |
| [I2: montaje muestra ID confirmado y deshabilita reapelación al remontar](../../frontend/tests/phase3-corrections.test.mjs:264) | Mismo error de montaje/desmontaje; la prueba no permite certificar sus aserciones de apelación posteriores. |
| [I6: enlaces montados y router real conservan filtros al ir y volver en ambos contextos](../../frontend/tests/phase3-corrections.test.mjs:321) | /app/admin/inventory frente a /app/admin/catalog. |
| [I7/I8: inicio montado tiene tabla de escritorio, tarjetas móviles, contador y disponibilidad distinta de recursos](../../frontend/tests/phase3-corrections.test.mjs:344) | Error de render de categoría/desmontaje con vnode nulo. |
| [I7: inventario montado ofrece tabla desktop y tarjetas móviles con las mismas acciones reales](../../frontend/tests/phase3-corrections.test.mjs:368) | No encuentra tabla «Recurso real» en el montaje de CatalogPage con management. Causa funcional definitiva no diagnosticada; requiere corrección separada del montaje/contrato actual. |
| [política: tres roles, rutas directas y destinos seguros](../../frontend/tests/real-integration.test.mjs:43) | Acceso devuelve verdadero donde se esperaba falso (aserción en línea 54). No se cambió la política ni el test. |
| [estructura del detalle: confirmar reserva no recarga/desmonta el diálogo](../../frontend/tests/review-regressions.test.mjs:72) | Handler real reservationUpdated frente a expresión literal reservationChanged = true. Discrepancia estructural reproducida; no demuestra por sí sola recarga del diálogo. |

Los once casos fallan tanto con fuentes actuales como con HEAD, con las mismas diferencias o familia de errores; **cero fallos restantes exclusivos del árbol actual** en esta selección. No se alteró lógica para esconderlos. Los errores de montaje y discrepancias de contrato requieren un trabajo posterior autorizado; reproducirlos no significa que sean inocuos.

## Reproducción comparativa sin checkout ni archivos temporales

Se ejecutó mediante un wrapper Node en línea que precarga un módulo data URL en cada proceso de pruebas. El módulo intercepta las lecturas síncronas y asíncronas usadas por el compilador de componentes/helpers y devuelve `git show HEAD:ruta` solo para frontend/src; el resto de lecturas conserva el árbol actual. No ejecuta fuentes backend, no modifica módulos en disco ni el índice. La salida confirmó respectivamente **18, 25, 38, 12 y 12** fuentes sustituidas en los cinco procesos; resultado **11 pruebas, 0 aprobadas, 11 fallidas**, salida 1.

Equivalente reproducible desde PowerShell, en la raíz del repositorio (solo memoria):

```powershell
@'
import { spawnSync } from 'node:child_process';
const preload = async function () {
  const fs = (await import('node:fs')).default;
  const fsp = (await import('node:fs/promises')).default;
  const { syncBuiltinESMExports } = await import('node:module');
  const { execFileSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const { resolve, relative } = await import('node:path');
  const root = process.cwd();
  const sync = fs.readFileSync, asyncRead = fsp.readFile;
  const cache = new Map();
  function historical(path, options) {
    if (typeof path !== 'string' && !(path instanceof URL)) return;
    const absolute = path instanceof URL ? fileURLToPath(path) : resolve(path);
    const rel = relative(root, absolute).replaceAll('\\', '/');
    if (!rel.startsWith('frontend/src/')) return;
    if (!cache.has(rel)) cache.set(rel, execFileSync('git', ['show', 'HEAD:' + rel], { cwd: root, maxBuffer: 8000000 }));
    const bytes = cache.get(rel);
    const encoding = typeof options === 'string' ? options : options?.encoding;
    return encoding ? bytes.toString(encoding) : Buffer.from(bytes);
  }
  fs.readFileSync = function (path, options) { return historical(path, options) ?? sync.apply(this, arguments); };
  fsp.readFile = async function (path, options) { return historical(path, options) ?? asyncRead.apply(this, arguments); };
  syncBuiltinESMExports();
  process.on('exit', () => console.log('HEAD en memoria: ' + cache.size + ' fuentes sustituidas, sin escritura'));
};
const url = 'data:text/javascript;base64,' + Buffer.from('await (' + preload.toString() + ')();').toString('base64');
const result = spawnSync(process.execPath, [
  '--import', url, '--test',
  '--test-name-pattern=imagen: cambiar|I7: inicio conserva|REFLOW:|I6: ida|I2: montaje|I6: enlaces|I7/I8: inicio|I7: inventario|política: tres|estructura del detalle',
  'frontend/tests/auth-user.test.mjs', 'frontend/tests/final-corrections.test.mjs',
  'frontend/tests/phase3-corrections.test.mjs', 'frontend/tests/real-integration.test.mjs',
  'frontend/tests/review-regressions.test.mjs',
], { stdio: 'inherit' });
process.exitCode = result.status;
'@ | node --input-type=module
```

## Archivos integrados y límites de coordinación

- [Contrato de préstamos](loans-contracts.md), [integración frontend](../architecture/frontend-integration.md), [procedimiento OpenAPI](../architecture/openapi.md), [reglas](../requirements/business-rules.md) y [requisitos funcionales](../requirements/functional.md): estado vigente y selección humana guiada sin cambiar matrices, condiciones o términos publicados.
- [Entrega backend](../../backend/docs/loan-episodes-integration.md): dos correcciones factuales de la conexión HTTP y generación final.
- [OpenAPI backend](../../backend/openapi.json), [copia frontend](../../frontend/public/generated/project/openapi.json) y [catálogo DB](../../frontend/public/generated/project/db.json): emitidos exclusivamente por generadores focales existentes, sin edición manual.
- [Prueba documental Showcase](../../frontend/tests/project-showcase.test.mjs:19): conteos intencionalmente actualizados con cobertura exhaustiva conservada y presencia/autorización adicional.

No se añadió ADR: las decisiones de snapshot, episodio, reloj e idempotencia ya quedan localizadas en el contrato y la entrega interna. El reviewer debe evaluar la barrera global (reduce paralelismo), cursores/exclusión locales del job y coste del recorrido paginado. H2 elimina la denegación permanente por cantidad de vencidos, conservando denegación transitoria con progreso si resta trabajo. Los dobles no certifican bloqueos, aislamiento ni DDL en PostgreSQL; tampoco hay verificación de seguridad o despliegue contra servicios reales en este corte.

## Corrección independiente H1–H4

Corte funcional posterior del 25/11/2026. **H1, H2, H3 y H4 resueltos en código y pruebas offline.** Se conservaron los cambios existentes del árbol e índice. Sin instalaciones, acceso a entorno/secretos, cambios en cuentas/registro, servicios o DB reales, semillas, Git mutante ni cambios de esquema/migraciones. La migración de episodios sigue **preparada, NO aplicada**; este correctivo no requiere otra migración.

| Hallazgo | Corrección y evidencia |
| --- | --- |
| H1 · legado | La [respuesta persistida](../../backend/src/modules/loans/infrastructure/persistence/prisma/prisma-loan-closure.ts:611) usa el mismo snapshot histórico acreditado que el cierre. Conserva intacto el original parcial en la fila del préstamo, sin catálogo actual ni parser relajado. La [prueba interoperable HTTP](../../backend/test/loan-closure.offline.spec.ts:1197) combina préstamo parcial y reserva completa, lee política, obtiene 201 y valida respuestas serializadas reales con los validadores frontend cargados desde su fuente. GET y replay son idénticos, sin nueva recompensa ni efectos. Se conserva el caso 503 sin reserva recuperable. |
| H2 · convergencia | El [sincronizador](../../backend/src/modules/loans/infrastructure/loan-overdue-synchronizer.ts:97) pagina por clave con 25 candidatos; las 100 unidades son presupuesto de trabajo pendiente, no cantidad máxima de activos. Confirma progreso antes de devolver 503 transitorio. El reintento consulta ajustes persistidos y omite saldados/absueltos; no depende de cerrar préstamos ni de caché local. La comprobación final bajo bloqueo también confirma lo aplicado antes de denegar. [Operaciones](../../backend/test/loan-overdue-operations.offline.spec.ts:332): pendientes, >100 saldados/absueltos, carreras entre fases, reserva/recogida, ausencia de duplicados/no-show. [Job real con doble](../../backend/test/loan-overdue-job.offline.spec.ts:204): cursor y segundo recorrido. |
| H3 · sanción actual | El [repositorio](../../backend/src/modules/rules/infrastructure/persistence/prisma/prisma-sanction.repository.ts:316) agrega consecuencia acumulada actual sin reescribir versión, penalización o saldos iniciales. Última regla/gravedad, objetivo nominal, suma efectiva e historial de ajustes; incluye el primer ajuste una sola vez. El [DTO](../../backend/src/modules/rules/presentation/dto/sanction.dto.ts:115) permite ausencia por compatibilidad y null para legado sin ajustes. El [validador](../../frontend/src/modules/trust/api/trust-contracts.ts:108) verifica sumas, saldos, último objetivo/versión y ajustes únicos; la [UI](../../frontend/src/modules/trust/components/SanctionDetails.vue:23) separa inicial y actual y aclara absolución. [Prueba backend](../../backend/test/loan-episodes.offline.spec.ts:503): 10 iniciales frente a 30 nominales/30 días y 25 efectivos por truncamiento, legado; conserva la prueba de restitución efectiva e inmutabilidad. Se cubre también saldo cero con objetivo nominal null. [Consumidor/UI](../../frontend/tests/trust-consumers.test.mjs:76): proyección, legado, absolución y rechazos de inconsistencias. |
| H4 · selección deliberada | El [diálogo](../../frontend/src/modules/loans/components/CloseIncidentDialog.vue:14) parte sin tipo, presenta opción neutra y exige pérdida o robo en botón y función de envío. [Pruebas de ambos tipos](../../frontend/tests/loan-closure.test.mjs:184): descripción y confirmación sin selección no envían; selección explícita envía el tipo correcto una sola vez. No cambia la gravedad normativa ni los tipos backend. |

### Decisión H2 y límites operativos

Memoria de candidatos acotada a una página y escrituras de reevaluación acotadas por fase. El recorrido de lectura sigue siendo proporcional a todos los activos vencidos del titular, con consultas de política, episodio, ajustes y sanción por candidato; los saldados no consumen presupuesto de aplicación pero sí lectura. La comprobación final mantiene la barrera global durante ese recorrido, preservando la protección fail-closed y el orden de bloqueos existente. Por tanto, **no se afirma latencia o throughput**: hay que medir consultas, contención e índices en PostgreSQL con autorización separada. Job/cursor/exclusión siguen locales; unicidad e idempotencia de efectos permanecen en persistencia para múltiples instancias. Un dato histórico no acreditable sigue bloqueando, no se salta por conveniencia.

### Comandos y resultados del correctivo

Desde la raíz salvo donde se indica. No se suman ejecuciones repetidas ni se atribuyen las 480 pruebas del corte anterior a este correctivo.

| Comando | Resultado final |
| --- | --- |
| Wrapper backend reproducido debajo: CLI instalado, configuración offline, pool threads, 14 suites explícitas | **385/385**, cero fallos/omitidas. Incluye cierre 98, episodios 27, mora operaciones 26, job 11 y regresiones seleccionadas. |
| `node --test frontend/tests/loan-closure.test.mjs frontend/tests/trust-consumers.test.mjs frontend/tests/project-showcase.test.mjs` | **59/59** (35 cierre + 17 confianza + 7 documentación). Avisos existentes de listeners y ruta de montaje, no silenciados. |
| `npm run openapi:generate --prefix backend` | 84 operaciones, generación offline desde DTO/controladores. |
| `node scripts/generate-project-showcase.mjs --openapi-only` | Copia frontend regenerada exclusivamente con generador focal. |
| `npm run openapi:check --prefix backend` | 84 operaciones y ambas copias coinciden con las fuentes. |
| `npm run test:openapi --prefix backend` | **118/118**, incluye nueva aserción del contrato actual/ajustes y conserva igualdad estricta. |
| `npm run typecheck --prefix backend` | Correcto. |
| `npm run typecheck --prefix frontend` | Correcto. |
| `npm run build --prefix backend` | Correcto, sin iniciar aplicación. |
| En frontend: `node --input-type=module -e "import { build } from 'vite'; await build({ envFile: false });"` | Correcto, 2138 módulos; carga de archivos de entorno explícitamente desactivada. Tipos comprobados por separado. |
| `node --test frontend/tests/*.test.mjs` | **352 pruebas: 341 aprobadas, 11 fallidas**, cero canceladas/omitidas, salida 1. Los once nombres y familias de errores son los del [baseline documentado](#once-fallos-restantes-árbol-actual-y-head-en-memoria), sin nuevos casos fallidos. No se volvió a ejecutar HEAD en este correctivo ni se tocaron esos fallos. |
| `git diff --check`, `git diff --cached --stat`, `git status --short` | Whitespace correcto (avisos LF/CRLF), índice vacío; cambios previos conservados y sin operaciones mutantes de Git. |

Reproducción exacta de la selección backend desde backend (normalización de unidad Windows como en el corte anterior):

```cmd
node -e "const {spawnSync}=require('child_process');const fs=require('fs');const tests=fs.readdirSync('test').filter(x=>x.endsWith('.offline.spec.ts')).map(x=>'test/'+x);tests.push('test/loans-contracts.spec.ts','test/trust-contracts.spec.ts','src/modules/rules/rules.spec.ts','src/modules/loans/infrastructure/persistence/prisma/prisma-reservation.repository.spec.ts','src/modules/loans/infrastructure/persistence/prisma/reservation-no-show.spec.ts','src/modules/loans/application/use-cases/loans.use-cases.spec.ts');console.log('SELECTION',tests.join(' '));const r=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run','--config','vitest.config.offline.ts','--pool=threads',...tests],{cwd:process.cwd().replace(/^d:/,'D:'),stdio:'inherit'});process.exitCode=r.status"
```

La selección contiene las ocho suites offline de este corte más contratos préstamos/confianza, reglas, repositorio reservas, no-show y casos de uso de préstamos. Se corrigió el doble para reproducir el valor por defecto de fecha de registro de ajustes como instante nativo; no se relajó la conversión temporal de producción. Los fallos intermedios de aserciones/fixtures se corrigieron y se repitieron las suites sin eliminar cobertura.

SHA-256 vigente de ambas copias OpenAPI: `e5af1cc0fb7b52874d6288f51b92767804c54962569aaac40f97ce9a524a222a`. No fue necesario generar contrato ORM, catálogo DB ni migración. Persisten los límites de verificación offline: no certifica DDL, aislamiento/bloqueos PostgreSQL, capacidad, concurrencia entre conexiones reales ni despliegue. Los once fallos globales frontend siguen abiertos fuera de H1–H4.

## Compatibilidad segura · cierre del 25/11/2026

Corte final ejecutado el 25/11/2026, 19:54–19:56 (Lima; 26/11 UTC). **Solo se modificaron los dos documentos existentes de integración** en este cierre; código, pruebas y contratos de compatibilidad ya presentes se revisaron y conservaron. No se encontró un bug de integración que justificara modificar producción o pruebas. Los conteos anteriores de este documento no son resultados de esta corrida.

### Contratos y matriz vigente

Fuentes: [inventario backend](../../backend/src/modules/inventory/SCHEMA-COMPATIBILITY.md), [préstamos backend](../../backend/src/modules/loans/SCHEMA-COMPATIBILITY.md), [inventario frontend](../../frontend/src/modules/inventory/CLIENT-CONTRACT.md), [préstamos/confianza frontend](../../frontend/src/modules/loans/CLIENT-CONTRACT.md) y [API compartida](../../frontend/src/shared/api/SCHEMA-CLIENT-CONTRACT.md). La [matriz técnica con bundles y columnas exactas](../../backend/docs/loan-episodes-integration.md#compatibilidad-segura--contrato-vigente) complementa esta matriz funcional.

Viejo/parcial/completo describen objetos físicos acreditados por el [proveedor](../../backend/src/shared/infrastructure/prisma/schema-capabilities.ts:97), **no** el ledger ni una bandera global de migración. Completo permite continuar las validaciones normales, no concede autorización ni garantiza elegibilidad.

| Superficie | Viejo conocido | Parcial conocido | Completo conocido |
| --- | --- | --- | --- |
| Catálogo, detalle, disponibilidad y ejemplares | Conserva catálogo, ocupación y stock reales; disponibilidad desconocida | Lee solo columnas acreditadas; no infiere aptitud ni disponibilidad por una columna aislada | Disponibilidad verificable con bundle físico completo; legado con condición nula sigue no elegible |
| Edición descriptiva de nombre/descripción; código de ejemplar; observación | Sigue disponible con controles existentes | Igual; petición mixta física/descriptiva rechazada no guarda la parte descriptiva | Controles normales |
| Altas, activación, reasignación, gestión física, liberación y rehabilitación | 503 | 503 mientras falte cualquier requisito físico | Requiere bundle físico y verificaciones/permisos/compromisos normales |
| GET préstamo, activos, vencidos e historiales personal/recurso | Préstamo, devolución e inspección antiguas; historial integral no consultable | Lee cierres si asociación y resultado están acreditados, aunque falten restricciones de escritura | Restaura resultado integral persistido; no recalcula consecuencias |
| GET política de devolución y detalle de sanción | 503 si faltan columnas de episodios/ajustes utilizadas | Lectura permitida con sus columnas concretas aunque falten CHECKs, índices o claves de escritura | Lectura histórica normal; datos históricos no resolubles siguen pudiendo dar 503 |
| Reserva/recogida/cancelación/vencimiento, mora y sanciones | 503 sin escritura alternativa | Exige físico + episodios; no exige cierres | Misma atomicidad y reglas de negocio |
| Devolución/cierre por incidente y replay integral | 503 | Exige físico + episodios + cierre | Idempotencia, consecuencias y resultado originales; nunca devolución básica |
| Presentación/resolución de apelación | 503 sin episodios | Solo exige episodios, no físico ni cierres | Restitución efectiva exacta y transacción originales |

Metadata desconocida produce 503 en lecturas protegidas y escrituras, no una respuesta legacy, una lista vacía, disponibilidad cero ni cierre ausente. Las lecturas antiguas de reglas/incumplimientos/apelaciones que no utilizan estos objetos conservan su comportamiento. Solo ausencia explícita de tabla/columna permite una repetición de lectura fuera de transacción fallida; no hay fallback ni reintento de escritura por esquema.

### Nulos, metadata y errores exactos

La [proyección de inventario](../../backend/src/modules/inventory/infrastructure/persistence/prisma/prisma-inventory.repository.ts:62) devuelve:

- [compatibility](../../backend/src/modules/inventory/domain/entities/inventory-compatibility.ts:2): status READY y message nulo con bundle físico completo; UPDATE_PENDING y «Actualización de inventario pendiente. La disponibilidad no se puede verificar y las operaciones de circulación están deshabilitadas.» en viejo/parcial.
- [capabilities](../../backend/src/modules/inventory/domain/entities/inventory-compatibility.ts:5): physicalCondition y administrativeEnablement acreditan cada columna; verifiedAvailability exige el bundle completo. [actions](../../backend/src/modules/inventory/domain/entities/inventory-compatibility.ts:10): descriptiveEdits siempre verdadero; create, activate, release, rehabilitate y manageCopy solo con bundle completo. No contiene reason ni permisos por fila.
- [condicionFisica/habilitado](../../backend/src/modules/inventory/presentation/dto/inventory-response.dto.ts:172): nulo cuando no se acredita su columna; condición legada nula permanece nula incluso con esquema completo. No se crea alias habilitadoPrestamo ni se transforma desconocido en falso/dañado/apto.
- [available/availableCopies/disponibles/noDisponibles](../../backend/src/modules/inventory/SCHEMA-COMPATIBILITY.md:29): nulos sin bundle físico completo, incluso con stock cero o recurso inactivo. Ocupación almacenada, prestados y reservados se conservan. registeredStock contiene libres, prestados, retenidos y reservados; totalCopies suma los cuatro, no solo libres. Filtros de disponibilidad verdadera y falsa excluyen desconocidos; sin filtro se conservan, con totales/paginación coherentes.
- [closureHistory](../../backend/src/modules/loans/domain/entities/loan.ts:35): AVAILABLE acredita consulta de cierres; solo entonces cierre nulo significa que no se encontró cierre integral (puede existir devolución antigua). UNAVAILABLE no acredita ausencia. Omisión legacy tampoco acredita capacidad; valor presente nulo/inválido se rechaza. Sin cierre conocido no se anuncian cero consecuencias/recompensas como hechos.
- [Episodio de sanción](../../frontend/src/modules/trust/api/trust-contracts.ts:89): omitido significa desconocido; nulo explícito significa sin episodio asociado; objeto presente se valida íntegramente. Gravedades actual/proyectada de mora requieren presencia, admitiendo nulo explícito; no se rellenan con «sin mora».

El [cuerpo de error compartido](../../backend/src/shared/infrastructure/prisma/schema-capabilities.ts:36), por ejemplo al cerrar sin garantías físicas, es exactamente:

```json
{
  "statusCode": 503,
  "code": "SCHEMA_CAPABILITY_UNAVAILABLE",
  "operation": "loans.close",
  "diagnostic": "SCHEMA_INCOMPLETE",
  "message": "Operación bloqueada por una actualización pendiente del sistema. Solicite al administrador completar la actualización y vuelva a intentarlo."
}
```

Con metadata desconocida cambian el diagnóstico y el mensaje; el cuerpo exacto para la misma operación es:

```json
{
  "statusCode": 503,
  "code": "SCHEMA_CAPABILITY_UNAVAILABLE",
  "operation": "loans.close",
  "diagnostic": "SCHEMA_UNKNOWN",
  "message": "No se pudo verificar la disponibilidad de esta operación. Vuelva a intentarlo; si persiste, contacte al administrador."
}
```

La operación identifica al llamador real, no una causa inventada. **No hay campo reason ni error en estos cuerpos**, ni SQL, tablas sensibles o secretos. Un fallo de red no prueba una actualización pendiente. No confundirlos con otros 503 históricos/de negocio ni con diagnósticos internos de jobs. La [lista de operaciones y dependencias](../../backend/docs/loan-episodes-integration.md#bundles-y-operaciones-concretas) precisa qué operación se informa; una comprobación anidada puede informar la operación interna que falla.

El [cliente HTTP](../../frontend/src/shared/api/client.ts:26) reconoce exclusivamente HTTP 503 + código exacto. Conserva código, operación válida (identificador de 2–4 segmentos de puntos, hasta 96 caracteres) y diagnóstico conocido; no copia mensaje arbitrario, SQL ni causas. Su mensaje seguro añade « [SCHEMA_CAPABILITY_UNAVAILABLE: loans.close]» en este ejemplo. La única excepción compartida en [errorMessage()](../../frontend/src/shared/composables/useRemote.ts:4) muestra ese mensaje saneado: **sin cambios de filtros, cargas, cancelación, reintentos, registro ni autenticación**. El cierre conserva intención, cuerpo y UUID; reconsultar no reenvía y una conciliación con historial no disponible no confirma ausencia.

### Comandos finales y conteos independientes

Ejecutados con dependencias existentes, sin instalación ni scripts habituales que carguen entorno. CLI backend Vitest 4.1.11, Node v24.22.0; build frontend Vite 7.3.7. Cada fila es una corrida independiente: **no sumar pruebas solapadas ni atribuir la comparación histórica a esta ejecución**.

| Directorio | Comando | Resultado observado |
| --- | --- | --- |
| Backend | [node node_modules/vitest/vitest.mjs run --config vitest.config.loans-offline.ts](../../backend/vitest.config.loans-offline.ts) | **18 suites, 476/476**, 0 fallos; incluye proveedor 69 y compatibilidad préstamos 39. Coincide con las 476 de la revisión anterior, ahora vuelto a ejecutar. |
| Backend | [node node_modules/vitest/vitest.mjs run --config vitest.config.offline.ts --pool=vmThreads test/inventory-schema-compatibility.offline.spec.ts test/inventory-rehabilitation.offline.spec.ts src/modules/inventory](../../backend/vitest.config.offline.ts) | **6 suites, 193/193**: compatibilidad 55, rehabilitación 43, servicio 46, repositorio 21, CRUD 7, controlador 21. Complementaria, no incluida en las 18 anteriores. |
| Frontend | [node --test --test-reporter=tap tests/schema-api-errors.test.mjs tests/compatibility-review.test.mjs tests/inventory-compatibility.test.mjs tests/loans-schema-compatibility.test.mjs tests/copy-rehabilitation.test.mjs tests/loan-closure.test.mjs tests/categories.test.mjs tests/operator-visual.test.mjs tests/user-visual.test.mjs tests/trust-consumers.test.mjs tests/loans-contracts.test.mjs tests/my-history.test.mjs tests/reservation-availability.test.mjs tests/reservation-settings.test.mjs tests/inventory.test.mjs tests/inventory-configuration-visual.test.mjs](../../frontend/tests/compatibility-review.test.mjs) | **269/269**, 0 fallos/canceladas/omitidas. Incluye errores compartidos, rehabilitación y cierre; solapa la corrida global. |
| Backend | [node node_modules/typescript/bin/tsc --noEmit --incremental false](../../backend/package.json) | Salida 0; sin diagnósticos ni emisión. |
| Frontend | [node node_modules/vue-tsc/bin/vue-tsc.js --noEmit --incremental false](../../frontend/package.json) | Salida 0; sin diagnósticos ni emisión. |
| Backend | [node node_modules/@nestjs/cli/bin/nest.js build](../../backend/package.json) | Salida 0, **sin texto de salida**; compilación, sin arrancar aplicación. |
| Frontend | [node --input-type=module -e "import { build } from 'vite'; await build({ envFile: false, build: { write: false } });"](../../frontend/src/shared/api/SCHEMA-CLIENT-CONTRACT.md:35) | Salida 0: «2144 modules transformed», «rendering chunks…», «built in 4.54s». Carga de archivos de entorno desactivada y bundle en memoria, sin escritura. |
| Frontend | [node --test --test-reporter=tap tests/*.test.mjs](../../frontend/tests/) | **459 pruebas, 449 aprobadas, 10 fallidas**, 0 canceladas/omitidas; salida 1, 8577.0288 ms. No está verde. |

La configuración focal bloquea dotenv transitivo; la complementaria usa alias y setup offline existentes. Los avisos de jobs pausados/reanudados pertenecen a los dobles. Frontend conserva avisos del arnés Vue/listeners/rutas y errores asíncronos de los montajes fallidos, sin silenciarlos. No se ejecutaron generadores OpenAPI, Showcase, ORM ni capturas.

Los diez fallos globales actuales corresponden a imagen de registro (1), inicio/layout de correcciones finales (2), fase 3 (6) y política de acceso (1). Nombres y códigos se cotejaron con la [revisión registrada](../compatibility-review-verification.md#comparación-histórica-de-los-diez-fallos). Esa revisión acredita **53 aprobadas/63 históricas focales, 10 fallidas**, en el commit 5d910793c0701e236ae68bae35000bc0358a233a; **no una suite global histórica**. Aquí no se repitió ese arnés histórico ni se repararon esos casos. La corrida focal anterior 129/129 tampoco se añade a las 269 actuales.

### Archivos por grupos y preservación

Referencias del árbol de integración recibido, no atribución de todos esos cambios a este cierre:

- Proveedor: [capacidades/caché/error](../../backend/src/shared/infrastructure/prisma/schema-capabilities.ts), [bundles](../../backend/src/shared/infrastructure/prisma/schema-capability-bundles.ts), [metadata física](../../backend/src/shared/infrastructure/prisma/schema-capability-metadata.ts), [parser CHECK](../../backend/src/shared/infrastructure/prisma/schema-check-expression.ts), [servicio Prisma](../../backend/src/shared/infrastructure/prisma/prisma.service.ts).
- Inventario backend: [repositorio](../../backend/src/modules/inventory/infrastructure/persistence/prisma/prisma-inventory.repository.ts), [servicio](../../backend/src/modules/inventory/application/use-cases/inventory.service.ts), [tipos](../../backend/src/modules/inventory/domain/entities/inventory.types.ts), [capacidades](../../backend/src/modules/inventory/domain/entities/inventory-compatibility.ts), [puerto](../../backend/src/modules/inventory/domain/repositories/inventory.repository.ts), [DTO](../../backend/src/modules/inventory/presentation/dto/inventory-response.dto.ts).
- Préstamos/reglas backend: [guards transaccionales](../../backend/src/modules/loans/infrastructure/loan-schema.ts), [lectura](../../backend/src/modules/loans/infrastructure/persistence/prisma/prisma-loan.repository.ts), [cierre](../../backend/src/modules/loans/infrastructure/persistence/prisma/prisma-loan-closure.ts), [reservas](../../backend/src/modules/loans/infrastructure/persistence/prisma/prisma-reservation.repository.ts), [mora](../../backend/src/modules/loans/infrastructure/loan-overdue-synchronizer.ts), [job mora](../../backend/src/modules/loans/infrastructure/loan-overdue.service.ts), [vencimiento](../../backend/src/modules/loans/infrastructure/reservation-expiry.service.ts), [monitor](../../backend/src/modules/loans/infrastructure/loan-job-monitor.ts), [motor](../../backend/src/modules/rules/infrastructure/persistence/prisma/loan-episode.engine.ts), [sanciones](../../backend/src/modules/rules/infrastructure/persistence/prisma/prisma-sanction.repository.ts), [incumplimientos](../../backend/src/modules/rules/infrastructure/persistence/prisma/prisma-violation.repository.ts), [apelaciones](../../backend/src/modules/rules/infrastructure/persistence/prisma/prisma-appeal.repository.ts).
- Frontend contratos/estado: [inventario](../../frontend/src/modules/inventory/api/inventory-api.ts), [capacidades](../../frontend/src/modules/inventory/api/compatibility-contracts.ts), [ejemplares](../../frontend/src/modules/inventory/api/copy-contracts.ts), [categorías](../../frontend/src/modules/inventory/api/categories-api.ts), [préstamos](../../frontend/src/modules/loans/api/loan-contracts.ts), [API préstamos](../../frontend/src/modules/loans/api/loans-api.ts), [cierre](../../frontend/src/modules/loans/api/closure-contracts.ts), [confianza](../../frontend/src/modules/trust/api/trust-contracts.ts), [intención de cierre](../../frontend/src/modules/loans/useLoanClosure.ts), [detalles revalidados](../../frontend/src/modules/inventory/useCopyDetails.ts), [historial](../../frontend/src/modules/loans/closure-history.ts), [HTTP compartido](../../frontend/src/shared/api/client.ts), [única excepción de mensaje](../../frontend/src/shared/composables/useRemote.ts).
- Frontend UI: [aviso inventario](../../frontend/src/modules/inventory/components/InventoryCompatibilityNotice.vue), [rehabilitación](../../frontend/src/modules/inventory/components/RehabilitateCopyDialog.vue), [editor categorías](../../frontend/src/modules/inventory/components/CategoryEditorDialog.vue), [editor recursos](../../frontend/src/modules/inventory/components/ResourceEditorDialog.vue), [ejemplares](../../frontend/src/modules/inventory/components/CopyManager.vue), [catálogo](../../frontend/src/modules/inventory/pages/CatalogPage.vue), [detalle](../../frontend/src/modules/inventory/pages/ResourceDetailPage.vue), [operaciones](../../frontend/src/modules/loans/pages/LoanOperationsPage.vue), [reservas](../../frontend/src/modules/loans/components/ReservationsPanel.vue), [devolución](../../frontend/src/modules/loans/components/ReturnLoanDialog.vue), [incidente](../../frontend/src/modules/loans/components/CloseIncidentDialog.vue), [resultado](../../frontend/src/modules/loans/components/ClosureResult.vue), [aviso historial](../../frontend/src/modules/loans/components/ClosureHistoryNotice.vue), [historial personal](../../frontend/src/modules/loans/pages/MyHistoryPage.vue), [sanción](../../frontend/src/modules/trust/components/SanctionDetails.vue).
- Pruebas: [proveedor](../../backend/test/schema-capabilities.offline.spec.ts), [inventario](../../backend/test/inventory-schema-compatibility.offline.spec.ts), [préstamos](../../backend/test/loans-schema-compatibility.offline.spec.ts), [job](../../backend/test/loan-overdue-job.offline.spec.ts), [doble](../../backend/test/helpers/in-memory-prisma.ts), [CHECKs independientes](../../backend/test/helpers/episode-checks.ts), [configuración focal](../../backend/vitest.config.loans-offline.ts), [regresiones frontend](../../frontend/tests/compatibility-review.test.mjs), [errores HTTP](../../frontend/tests/schema-api-errors.test.mjs), [inventario cliente](../../frontend/tests/inventory-compatibility.test.mjs), [préstamos cliente](../../frontend/tests/loans-schema-compatibility.test.mjs), [cierre UI](../../frontend/tests/loan-closure.test.mjs), [rehabilitación UI](../../frontend/tests/copy-rehabilitation.test.mjs). Las demás suites concretas ejecutadas están enumeradas en los comandos, no se declara toda la suite backend aprobada.
- Documentación modificada ahora: este [informe existente](loan-integration-verification.md) y la [entrega backend existente](../../backend/docs/loan-episodes-integration.md). Evidencia previa conservada: [revisión de compatibilidad](../compatibility-review-verification.md).

No se tocaron autenticación, usuarios, arranque, entorno, seeds, migraciones, dependencias, índice o ramas; sin DB, servicios externos ni Git mutante. El build backend solo emitió salida local ignorada. Las capturas y generados existentes se verifican por tamaño/SHA-256 antes y después; los dos OpenAPI permanecen idénticos entre sí, **sin afirmar que se hayan regenerado o validado contra los nuevos DTO**:

| Artefacto | Bytes | SHA-256 inicial = final |
| --- | --- | --- |
| [OpenAPI backend](../../backend/openapi.json) y [copia frontend](../../frontend/public/generated/project/openapi.json), cada uno | 373024 | c3f1c0f660946c294c04fe97a4b895ddb67ae904c03dff334d7787b2200e3390 |
| [Catálogo DB documental](../../frontend/public/generated/project/db.json) | 194448 | 8397bc6a46396fd8a12f31f70b8e47709f884c1c875523d0670c7bd5c331b9f6 |
| [Captura 1440](../../frontend/tests/artifacts/loan-closure-1440.png) | 107994 | 39937db584fc249954c288d1d471d4f6d1d7f04c2c1dacfb4d08751f481725ed |
| [Captura 375](../../frontend/tests/artifacts/loan-closure-375.png) | 52896 | f2b3ae6ec273f312efc6a72fc5c52ae3489fc692817c6ee635573d2f21e06575 |

Control final de solo lectura: diff sin errores de whitespace (solo avisos LF/CRLF), índice vacío y exclusiones sin cambios. Estado: **99 entradas, 67 modificadas y 32 no rastreadas**; respecto del preflight solo se añaden las modificaciones de los dos documentos existentes. Las dos capturas ya eran no rastreadas y siguen así, sin añadirlas al índice. Se comprobaron las rutas locales de los enlaces de las secciones nuevas: **100 en este informe y 47 en la entrega backend**, todas existentes. Los cinco hashes de la tabla se volvieron a calcular y coincidieron con el preflight.

**Límites:** migración preparada, no aplicada; dobles/AST y Vue en memoria no certifican DDL, aislamiento, bloqueos, carreras entre conexiones PostgreSQL, rendimiento, navegador/CSS ni despliegue. La suite global frontend continúa con diez fallos abiertos. El parser CHECK falla conservadoramente ante expresiones equivalentes no reconocidas; la reanudación del job no acredita capacidad de una DB real.
