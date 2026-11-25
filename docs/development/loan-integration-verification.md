# Verificación de integración documental de préstamos · 25/11/2026

El corte funcional posterior de H1–H4 y sus comandos/resultados se encuentra en [corrección independiente](#corrección-independiente-h1h4). Las secciones documentales anteriores se conservan como evidencia histórica, no como estado final del correctivo.

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
