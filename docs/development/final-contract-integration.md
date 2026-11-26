# Integración documental final: compatibilidad y registro 11–18

> **Actualización 26/11/2026:** el hallazgo histórico pendiente sobre
> [closureHistory](cs_prestamos/backend/src/modules/loans/presentation/dto/loans-response.dto.ts:86)
> quedó superado por el corte correctivo añadido al final. Los resultados previos
> se conservan como históricos; esto **no implica aprobación posterior del reviewer ni global**.

Corte: 25/11/2026, Lima (26/11 UTC). Solo documentación, dos OpenAPI generados
y expectativas obsoletas de una prueba documental. Sin cambios de lógica, DTO,
esquema o datos. Preflight de solo lectura: estado y nombres del diff de árbol
e índice; cambios previos preservados. Sin instalación, lectura de secretos o
archivos de entorno, DB, servicios, semillas, migraciones aplicadas o Git mutante.
La migración previa de episodios sigue **preparada, NO aplicada**.

## Matriz de compatibilidad vigente

Fuentes: [matriz detallada recibida](cs_prestamos/docs/development/loan-integration-verification.md:158),
[bundles y operaciones](cs_prestamos/backend/docs/loan-episodes-integration.md#bundles-y-operaciones-concretas)
y [contrato HTTP compartido](cs_prestamos/frontend/src/shared/api/SCHEMA-CLIENT-CONTRACT.md:1).
Viejo/parcial/completo describen capacidades físicas acreditadas, no el ledger
ni una bandera global de migración. Completo no concede permisos o elegibilidad.

| Superficie | Viejo conocido | Parcial conocido | Completo conocido |
| --- | --- | --- | --- |
| Catálogo/detalle/ejemplares | Stock y ocupación legacy; disponibilidad desconocida | Solo columnas acreditadas; columna aislada no acredita aptitud | Bundle físico permite verificar disponibilidad; condición legacy nula no es apta |
| Cambios descriptivos | Conservados | Conservados; petición mixta rechazada no guarda parcialmente | Controles normales |
| Altas/activación/gestión física/liberación/rehabilitación | 503 antes de escribir | 503 si falta cualquier garantía física | Bundle completo más permisos, estado y compromisos |
| Préstamos e historial | Lectura legacy; historial integral no consultable | Cierres legibles con asociación y resultado aunque falten restricciones de escritura | Resultado persistido, sin recalcular consecuencias |
| Política de devolución/sanción | 503 si faltan columnas utilizadas | Lectura con sus columnas concretas | Lectura histórica; datos irresolubles aún pueden dar 503 |
| Reservas/recogida/cancelación/vencimiento/mora | 503 | Físico + episodios, sin exigir cierres | Validaciones y atomicidad normales |
| Devolución/incidente/replay | 503 | Físico + episodios + cierre | Integral e idempotente, nunca devolución básica |
| Apelación/presentación/resolución | 503 sin episodios | Solo episodios | Restitución y transacción originales |

Metadata desconocida no equivale a esquema viejo: produce 503 en operaciones
protegidas, no catálogo vacío, stock cero ni ausencia de cierre. Las lecturas
antiguas ajenas a esos objetos conservan su comportamiento. Ausencia explícita
de objeto permite como máximo repetir una **lectura**, fuera de la transacción
fallida; nunca se reintenta escritura por esquema ni se convierte desconocido
en apto. Historial no consultable u omitido no acredita ausencia de cierre.

El [proveedor de capacidades](cs_prestamos/backend/src/shared/infrastructure/prisma/schema-capabilities.ts:180)
es lazy y local al proceso: caché conocida de 30 segundos, deduplicación de
consultas concurrentes, desconocido sin caché. La inspección transaccional evita
la caché compartida y revalida antes de escribir. HTTP 503 con código
SCHEMA_CAPABILITY_UNAVAILABLE distingue SCHEMA_INCOMPLETE de SCHEMA_UNKNOWN;
no incluye reason ni causas SQL. El cliente conserva solo código, operación
válida y diagnóstico conocido, con mensaje fijo saneado. Red u otro 503 no
prueban migración pendiente.

Los [jobs](cs_prestamos/backend/src/modules/loans/SCHEMA-COMPATIBILITY.md) verifican
capacidad antes de candidatos y se pausan sin proceso básico alternativo.
Reintentan cada minuto; conservan cursor, exclusión y fallo del recorrido entre
ticks. Registran pausa, recordatorio como máximo cada 15 minutos y recuperación
solo tras recorrido posterior correcto, no por cola vacía después de unidades
fallidas. Diagnósticos acotados, sin SQL, URLs, parámetros o titulares.

Despliegue: expansión mediante migraciones **versionadas, revisadas y autorizadas**,
nunca DDL automático desde arranque, proveedor o jobs. Comprobar garantías físicas
por bundle, no solo ledger; después expira/revalida la caché y el job puede
recuperarse. Este corte no ejecutó ese procedimiento ni acredita DB actualizada.
No hay esquema nuevo ni razón para regenerar el catálogo DB documental.

## Registro 11–18: pruebas reportadas, no reejecutadas aquí

La [matriz original completa](cs_prestamos/docs/development/registration-review-verification.md:9) conserva
implementación y evidencia de cada caso:

| Pendiente | Contrato verificado en la entrega de registro |
| --- | --- |
| 11 | Misma consulta normalizada refresca; cambio genera una lectura; descarta respuestas tardías y no mezcla páginas. |
| 12 | PDF exacto 10 MiB; JSON de registro 15 MiB por ruta, con prefijo opcional; otras rutas 100 KiB; excesos 413 JSON y formato inválido 400. |
| 13 | Todos los campos del alta nuevos requeridos, incluidos identificador y teléfono, en DTO/aplicación/cliente; omitido, nulo, vacío y blancos rechazados. Sin rellenar retrofilas. |
| 14 | Correo recortado exteriormente y en minúsculas, dominio exacto unsa.edu.pe; rechaza subdominios, sufijos, espacios interiores y múltiples arrobas. |
| 15 | Contraseña 8–128, no solo blancos ASCII/Unicode; nunca se recorta ni transforma, incluso con espacios legítimos. |
| 16 | Cada preparación PDF obtiene firma nueva; permisos 401/403/operador-admin, índice vinculado y cabeceras de no caché. |
| 17 | Error/reintento visibles fuera del modal; sin ventana vacía; enlace nativo explícito seguro, respuestas obsoletas descartadas y firmas concurrentes controladas. |
| 18 | FechaSolicitud DESC e id DESC antes de paginar; total y página de la misma lectura ordenada, probado con fechas empatadas. |

Una evidencia PNG/JPEG hasta 60 KiB o PDF hasta 10 MiB; base64 máximo PDF de
13 981 016 bytes ASCII, de ahí el body JSON de 15 MiB solo para registro. Nombre,
identificador y teléfono se recortan exteriormente; contraseña nunca. Requeridos
del alta no cambian nulabilidad del legado ni reparan solicitudes viejas. La
aprobación legacy incompleta conserva 409 sin escritura y motivos seguros.

PDF privado: firma de 15 minutos; descarte cliente a los 14 desde antes de pedirla,
solo en memoria. HTTPS y ruta de objeto firmado validados; enlace con aislamiento
de origen, no URL pública genérica. No-store/no-cache en endpoint protegido; no
se certifican permisos reales del bucket ni bloqueadores de pestañas. Count y
página consistentes no significan snapshot entre clics: offset puede desplazarse
por inserciones; la lectura materializada mantiene coste O(n).

Conteos independientes recibidos, **no sumados ni ejecutados en este corte**:
compatibilidad: 476 backend préstamos, 193 backend inventario, 269 frontend focal;
registro: 85 backend y 23 frontend focal. Último global reportado: **467/477,
10 fallos baseline**, no verde. Los cortes previos quedan fechados, no se
reescriben como nuevas ejecuciones.

## Comandos y resultados de este corte

Desde la raíz, dependencias locales existentes, sin entorno ni conexiones:

```text
npm run openapi:generate --prefix backend
node scripts/generate-project-showcase.mjs --openapi-only
npm run openapi:check --prefix backend
npm run test:openapi --prefix backend
node --test frontend/tests/project-showcase.test.mjs
node backend/node_modules/typescript/bin/tsc --project backend/tsconfig.json --noEmit --incremental false
node frontend/node_modules/vue-tsc/bin/vue-tsc.js --project frontend/tsconfig.json --noEmit --incremental false
```

- Generación/comparación: salida 0, **84 operaciones**, sin cambio de cantidad;
  **129 esquemas OpenAPI frente a 125** antes. Los cuatro añadidos describen
  capacidades, acciones, compatibilidad y stock registrado de inventario;
  son componentes HTTP, **no cambios del esquema DB**.
- Primera prueba OpenAPI: **115/118**, tres fallos. Tras ajuste documental:
  **117/118**, un fallo contractual real conservado, salida 1. No está verde.
- Showcase documental frontend: **7/7**, salida 0, sin omitidas/canceladas.
  Avisos del harness: listeners y ruta /app no encontrada, no silenciados.
- Tipos backend y frontend: ambos salida 0, sin emisión ni diagnósticos.
- Comprobación de espacios con diff: salida 0 (solo avisos LF/CRLF). Índice
  sin cambios preparados. Validación de 59 enlaces locales del informe,
  arquitectura OpenAPI y entrega de registro: todos los destinos existentes;
  comprobación binaria de ambas copias OpenAPI: idénticas.
- Wrapper [Windows offline](cs_prestamos/backend/scripts/test-openapi.ts:1): ruta
  canónica y cargador de entorno dirigido al dispositivo nulo. No se ejecutó
  la suite backend predeterminada. Procedimiento: [OpenAPI](cs_prestamos/docs/architecture/openapi.md:6).

Ambas copias generadas pesan 365956 bytes y son idénticas, SHA-256
78771285a19e27326ab65f1bc59c58fa8a57005249a2fd0c73aeacdb22d54aba.
El [catálogo DB preservado](cs_prestamos/frontend/public/generated/project/db.json)
sigue en 194448 bytes, SHA-256
8397bc6a46396fd8a12f31f70b8e47709f884c1c875523d0670c7bd5c331b9f6.

## Hallazgo para el siguiente agente, sin corregir lógica

La [entidad Loan](cs_prestamos/backend/src/modules/loans/domain/entities/loan.ts:35)
expone closureHistory, pero el [DTO fuente](cs_prestamos/backend/src/modules/loans/presentation/dto/loans-response.dto.ts:80)
no lo declara; el OpenAPI regenerado tampoco. La
[comparación estricta entidad/DTO](cs_prestamos/backend/test/openapi-contract.spec.ts:238)
sigue fallando: **no** se excluyó ese campo, no se editó JSON a mano ni se
modificó el DTO. El reviewer debe auditar la publicación de ese estado antes
de considerar completo el contrato; ausencia no significa historial disponible
ni ausencia de cierre.

Única excepción de escritura de pruebas: [expectativas documentales](cs_prestamos/backend/test/openapi-contract.spec.ts:264)
actualizadas para incluir metadata/stock de inventario y exigir exactamente los
ocho campos requeridos de registro. Justificación: contratos intencionales ya
implementados; se mantienen comparaciones de conjuntos completos, no se
debilitan a comparaciones parciales ni se alteran pruebas funcionales.

No se auditaron lógica, PostgreSQL live, concurrencia real, infraestructura,
almacenamiento o navegador/CSS. No se afirma DB actualizada ni migración aplicada.

## Archivos de esta integración

- Este informe nuevo; [entrega de préstamos](cs_prestamos/docs/development/loan-integration-verification.md:1)
  y [entrega de registro](cs_prestamos/docs/development/registration-review-verification.md:1): solo avisos
  posteriores añadidos, sin reemplazar sus resultados históricos.
- [Arquitectura OpenAPI](cs_prestamos/docs/architecture/openapi.md:1),
  [integración frontend](cs_prestamos/docs/architecture/frontend-integration.md:46),
  [alta integral](cs_prestamos/docs/development/auth-integral.md:1) y [README backend](cs_prestamos/backend/README.md:111):
  actualización contractual/documental.
- [OpenAPI backend](cs_prestamos/backend/openapi.json),
  [copia frontend](cs_prestamos/frontend/public/generated/project/openapi.json) y
  [prueba documental](cs_prestamos/backend/test/openapi-contract.spec.ts:264).

Los diffs totales del repositorio incluyen trabajo anterior ajeno a este corte;
no se atribuyen aquí. No se modificó el README frontend ni artefactos DB,
contrato ORM, capturas, pruebas funcionales o lógica.

## Corte correctivo 26/11/2026: H1–H4 y evidencia de sesión

Este añadido documenta las correcciones y ejecuciones reales de la sesión
ejecutadas durante esta sesión; la edición documental no las reejecuta. No reemplaza
los resultados anteriores ni atribuye al correctivo evidencia histórica.
Los enlaces nuevos usan rutas relativas al workspace con prefijo del repositorio.

### H1 — Filtro HTTP saneado y consumidor real

El [filtro productivo](cs_prestamos/backend/src/shared/infrastructure/filters/http-exception.filter.ts:14)
reconstruye exactamente los cinco campos
[statusCode, code, operation, diagnostic y message](cs_prestamos/backend/src/shared/infrastructure/filters/http-exception.filter.ts:27):
HTTP 503, código contractual fijo, operación validada o alternativa segura,
diagnóstico conocido y mensaje fijo. No propaga detalles del proveedor, SQL,
causas ni mensajes arbitrarios. Un 503 ordinario no adquiere por suplantación
el significado de indisponibilidad de capacidades.

La [prueba HTTP Nest/Express → JSON → cliente/presentador frontend](cs_prestamos/backend/test/loan-schema-http.offline.spec.ts:34)
acredita **14/14** casos, incluidos los dos diagnósticos de esquema, saneamiento,
validación ordinaria y el **413 real del parser**, además del 503 contractual.
Es transporte en memoria, sin DB; no una prueba de despliegue ni navegador.

### H2 — Historial publicado y OpenAPI regenerado

El [campo opcional no nullable](cs_prestamos/backend/src/modules/loans/presentation/dto/loans-response.dto.ts:81)
publica exactamente el enum
[AVAILABLE / UNAVAILABLE](cs_prestamos/backend/src/modules/loans/presentation/dto/loans-response.dto.ts:83).
Omitido significa desconocido: ni historial disponible ni ausencia de cierre.
La [prueba contractual estricta](cs_prestamos/backend/test/openapi-contract.spec.ts:74)
comprueba valores, opcionalidad y ausencia de nulabilidad; no excluye el campo
para ocultar la discrepancia histórica.

Se regeneraron [OpenAPI backend](cs_prestamos/backend/openapi.json) y su
[copia frontend](cs_prestamos/frontend/public/generated/project/openapi.json):
**84 operaciones, 129 esquemas**, copias iguales mediante comparación de buffers.
La suite OpenAPI final pasa **119/119**; supera el **117/118** histórico sin
reescribirlo. No se trasladan aquí los tamaños o hashes del corte anterior.

### H3 — Recorrido persistente, observabilidad y riesgo postrollback

El [recorrido de vencimiento y su recuperación](cs_prestamos/backend/src/modules/loans/infrastructure/persistence/prisma/prisma-reservation.repository.ts:716)
conserva estado entre ticks. Los [casos de 100/101 candidatos](cs_prestamos/backend/test/loan-reservation-expiry.offline.spec.ts:55)
exigen un recorrido completo limpio **posterior** al fallido; ni una cola vacía
ni éxitos posteriores dentro del mismo recorrido acreditan recuperación.
El [monitor compartido entre repositorio y scheduler](cs_prestamos/backend/src/modules/loans/infrastructure/loan-job-monitor.ts:8)
deduplica **por categoría durante 15 minutos**, no solo por último diagnóstico.
Los [fallos terminales de categorías distintas](cs_prestamos/backend/test/loan-reservation-expiry.offline.spec.ts:148)
se notifican todos, incluso entre páginas, sin SQL ni datos privados; un primer
intento fallido seguido de éxito no se presenta como fallo terminal.

El reviewer focal encontró **dos problemas de deduplicación**, ya corregidos:
coordinación de avisos internos/externos y cobertura de categorías terminales.
**No consta revisión aprobatoria posterior a esas correcciones ni aprobación
global.** Las pruebas finales no sustituyen esa aprobación.

Riesgo delimitado por
[rethrowAfterRollback()](cs_prestamos/backend/src/shared/infrastructure/prisma/schema-capabilities.ts:228):
solo después del rollback se invalida/reinspecciona fuera de la transacción
fallida. Bundle completo conocido conserva el **error original**; dependencia
confirmada ausente produce diagnóstico de esquema incompleto; metadata
desconocida produce [diagnóstico desconocido seguro](cs_prestamos/backend/src/shared/infrastructure/prisma/schema-capabilities.ts:272).
SQLSTATE por sí solo no prueba ausencia de dependencia. **No reintenta escrituras**
ni convierte cualquier error SQL en necesidad de migración.

### H4 — Count y página en una sentencia, sin extrapolar evidencia

El [listado de solicitudes](cs_prestamos/backend/src/modules/users/infrastructure/persistence/prisma/prisma-registration-request.repository.ts:347)
usa una sentencia CTE parametrizada para total y página bajo el mismo snapshot
de sentencia, con filtros comunes y orden fecha descendente/id descendente.
Límite y desplazamiento se aplican en DB; el agregado no proyecta hashes y no
se traen hashes de filas fuera de la página. Una página vacía conserva el total.
La [evidencia se incorpora después, solo a la página](cs_prestamos/backend/src/modules/users/infrastructure/persistence/prisma/prisma-registration-request.repository.ts:395):
esto **no acredita un snapshot común de la evidencia** ni entre clics.

La [prueba offline de 10 000 filas](cs_prestamos/backend/test/registration-pagination.offline.spec.ts:20)
verifica límite, enriquecimiento acotado y ausencia de campos internos en la
salida simulada. **No es un benchmark ni validación del plan o aislamiento de
PostgreSQL real.** La evidencia no-leak anterior sigue siendo previa, no una
ejecución nueva atribuible a este corte.

### Comandos y resultados reales reportados de la sesión

Desde la raíz del repositorio salvo el build indicado. Selecciones independientes
con posibles solapamientos: **no sumar sus conteos**. No se ejecutó la suite
backend predeterminada con conexiones reales.

| Comando / alcance | Resultado final de sesión |
| --- | --- |
| [npm --prefix backend test -- --config vitest.config.loans-offline.ts](cs_prestamos/backend/vitest.config.loans-offline.ts:1) | **531/531, 20 archivos**; la corrida previa **519/519** queda superada, no sumada. |
| [npm --prefix backend test -- --config vitest.config.registration-offline.ts](cs_prestamos/backend/vitest.config.registration-offline.ts:1) | **98/98, 7 archivos**. |
| [npm --prefix backend run typecheck](cs_prestamos/backend/package.json) y [npm --prefix frontend run typecheck](cs_prestamos/frontend/package.json) | Ambos exitosos. |
| [npm --prefix backend run test:openapi](cs_prestamos/backend/package.json) | **119/119**. |
| [npm --prefix backend run openapi:check](cs_prestamos/backend/package.json) | Éxito, **84 operaciones**. |
| [npm --prefix backend run openapi:generate](cs_prestamos/backend/package.json) + [node scripts/generate-project-showcase.mjs --openapi-only](cs_prestamos/scripts/generate-project-showcase.mjs) | Generación exitosa; **129 esquemas**, comparación de buffers de ambas copias: iguales. |
| [node --test frontend/tests/schema-api-errors.test.mjs frontend/tests/loans-schema-compatibility.test.mjs frontend/tests/registration-review.test.mjs](cs_prestamos/frontend/tests/registration-review.test.mjs:1) | **63/63**. |
| [node --test frontend/tests/*.test.mjs](cs_prestamos/frontend/package.json) | **477 pruebas, 467 aprobadas, 10 fallidas, 0 omitidas/canceladas**. Global no verde. |
| [node --input-type=module -e "import { build } from 'vite'; await build({ envFile: false, build: { write: false } });"](cs_prestamos/frontend/package.json) — desde frontend | Éxito, **2145 módulos**, sin archivos de entorno ni escritura del bundle. |
| Comprobación de espacios mediante diff | **git diff --check: salida 0**, advertencias CRLF conservadas. Resultado reportado de sesión, no reejecutado por esta edición. |

### Diez fallos baseline conservados, no aprobación global

El [resumen de esta sesión](cs_prestamos/docs/development/final-contract-integration.md:260)
contiene los siguientes diez casos exactos. Coinciden **por nombre** con los
[diez documentados anteriormente](cs_prestamos/docs/development/registration-review-verification.md:197)
y sus [familias baseline](cs_prestamos/docs/compatibility-review-verification.md:36).
Este cotejo documental no repite el arnés histórico ni demuestra por sí solo
equivalencia de comportamiento o aprobación de esas superficies.

1. [imagen: cambiar o cancelar una selección invalida una lectura anterior aún pendiente](cs_prestamos/frontend/tests/auth-user.test.mjs:207).
2. [I7: inicio conserva estados independientes, sanción activa antes de categorías y una sola búsqueda en cabecera](cs_prestamos/frontend/tests/final-corrections.test.mjs:157).
3. [REFLOW: layout añade estado contextual y lo limpia al desmontar; Más conserva todos los destinos ADMIN](cs_prestamos/frontend/tests/final-corrections.test.mjs:183).
4. [I6: ida y retorno con categoría/disponibilidad/página en ambos orígenes y destino controlado](cs_prestamos/frontend/tests/phase3-corrections.test.mjs:165).
5. [I2: montaje conserva texto ante incertidumbre y no muestra éxito ni permite duplicar](cs_prestamos/frontend/tests/phase3-corrections.test.mjs:244).
6. [I2: montaje muestra ID confirmado y deshabilita reapelación al remontar](cs_prestamos/frontend/tests/phase3-corrections.test.mjs:265).
7. [I6: enlaces montados y router real conservan filtros al ir y volver en ambos contextos](cs_prestamos/frontend/tests/phase3-corrections.test.mjs:322).
8. [I7/I8: inicio montado tiene tabla de escritorio, tarjetas móviles, contador y disponibilidad distinta de recursos](cs_prestamos/frontend/tests/phase3-corrections.test.mjs:345).
9. [I7: inventario montado ofrece tabla desktop y tarjetas móviles con las mismas acciones reales](cs_prestamos/frontend/tests/phase3-corrections.test.mjs:369).
10. [política: tres roles, rutas directas y destinos seguros](cs_prestamos/frontend/tests/real-integration.test.mjs:43).

Esta actualización modifica únicamente este informe. No lee archivos de entorno,
secretos o informes personales; no accede a DB, instala dependencias ni realiza
Git mutante. No acredita migración aplicada, infraestructura, benchmark,
concurrencia PostgreSQL real ni aprobación posterior/global del reviewer.
