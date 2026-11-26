# Integración cliente: préstamos y confianza

## Alcance y fuentes

Implementación limitada a préstamos, presentación de sanciones y pruebas relacionadas. Fuentes: [compatibilidad de préstamos](../../../../backend/src/modules/loans/SCHEMA-COMPATIBILITY.md), [DTO de préstamos](../../../../backend/src/modules/loans/presentation/dto/loans-response.dto.ts), [DTO de cierre](../../../../backend/src/modules/loans/presentation/dto/loan-closure-response.dto.ts), [DTO de sanciones](../../../../backend/src/modules/rules/presentation/dto/sanction.dto.ts) y [contrato cliente de inventario](../inventory/CLIENT-CONTRACT.md).

No se modificaron inventario, cliente HTTP compartido, autenticación, registro, usuarios, filtros generales, backend, documentos OpenAPI ni generados. La rehabilitación conserva su implementación única de inventario; solo se actualizó su fixture de prueba para acreditar capacidades reales. Se preservaron los artefactos de pruebas existentes.

## Exportaciones y semántica exacta

- [Loan](api/loans-api.ts:9) incorpora el campo opcional de historial de cierre con los dos valores HTTP del servidor: disponible o no consultable. La omisión legacy sigue siendo omisión, no capacidad acreditada. Un valor presente nulo, indefinido, objeto, arreglo o distinto de los dos literales es incompatible.
- [parseLoan()](api/loan-contracts.ts:73) recibe una respuesta desconocida, valida y devuelve una copia; normaliza únicamente las capturas históricas omitidas a nulo. No cambia el estado, fechas, devolución antigua ni efectos persistidos. [parseLoans()](api/loan-contracts.ts:78) exige un arreglo y valida cada fila; nunca convierte errores en lista vacía.
- [validLoan()](api/loan-contracts.ts:66) conserva el validador existente y añade la validación del historial. Si hay metadato nuevo, exige los campos de resultado del cierre. Sin cierre integral exige consecuencias y cancelaciones vacías y recompensa/ejemplar nulos. Historial no consultable no admite un cierre inventado. Un cierre real sigue sujeto a validación integral estricta.
- [closureHistoryMessage()](closure-history.ts:4) devuelve un aviso de historial no disponible tanto para omisión legacy como para esquema no consultable. Solo con historial disponible y cierre nulo informa que no se encontró un cierre integral, aclarando que puede existir devolución antigua. No afirma ausencia de sanciones/recompensa.
- [ClosureHistoryNotice](components/ClosureHistoryNotice.vue) se reutiliza en historial personal, historial de recurso y resultado. [ClosureResult](components/ClosureResult.vue) no anuncia pérdida, cero consecuencias, cero cancelaciones ni ausencia de recompensa cuando no hay un cierre conocido. Las afirmaciones negativas de consecuencias/recompensa requieren historial disponible y resultado explícito.
- Las lecturas [activas, vencidas, detalle e historial de recurso](api/loans-api.ts) validan contratos. El [historial personal](pages/MyHistoryPage.vue) aplica el parser al consumidor, sin cambiar el adaptador de usuarios. Otros consumidores de ese adaptador permanecen fuera del alcance y pueden reutilizar los parsers exportados.
- La [política de devolución](api/closure-contracts.ts:29) exige también las gravedades actual y proyectada de mora, con nulo explícito admitido; omisión o respuesta incompleta no significa «ninguna mora».

## Inventario y acciones

- [ReservationDialog](components/ReservationDialog.vue) reutiliza el predicado de aptitud de inventario: ocupación libre no basta. Solo ofrece ejemplares con capacidad de disponibilidad verificable, condición apta y habilitación verdadera. Stock, ocupación o habilitación desconocida nunca autorizan reserva.
- [ReturnLoanDialog](components/ReturnLoanDialog.vue) y [CloseIncidentDialog](components/CloseIncidentDialog.vue) reciben una propiedad opcional de compatibilidad de inventario, del tipo exportado por inventario. Ausente o nula significa desconocida, no lista. El [panel operador](pages/LoanOperationsPage.vue) transmite la compatibilidad del detalle de ejemplar.
- Los cierres nuevos, entregas y cancelaciones requieren la acción física de liberación acreditada en metadatos. Se conserva la lectura y se muestra aviso cuando la capacidad falta. Los guardas de envío repiten el bloqueo de los botones; no basta con alterar un control desde fuera.
- Las capacidades son prerrequisitos locales, no permisos ni garantía de escritura del préstamo. No se recomputan capacidades, disponibilidad, sanciones o garantías del servidor. El backend revalida reglas, episodios, persistencia/idempotencia, permisos y concurrencia.
- El [panel operador](pages/LoanOperationsPage.vue:27) y el [panel de reservas](components/ReservationsPanel.vue:48) revalidan explícitamente detalles de ejemplar cada vez que se actualiza su listado. No conservan capacidades listas obsoletas ni permiten que una respuesta anterior sobrescriba la nueva. Se conserva el diálogo abierto, la intención y el UUID; actualizar solo realiza lecturas, nunca reenvía una escritura.

## Sanciones y episodios

En [SanctionDetails](../trust/components/SanctionDetails.vue), episodio omitido significa historial de ajustes desconocido; nulo explícito significa que no hay episodio asociado y se muestra el antecedente inicial. Un episodio presente debe pasar íntegramente el [validador](../trust/api/trust-contracts.ts:89). Un objeto parcial o indefinido explícito no cae al antecedente legacy. Los importes y ajustes conocidos siguen mostrando exclusivamente el resultado backend.

## HTTP 503 e integración padre/registro

[useLoanClosure()](useLoanClosure.ts:7) informa indisponibilidad temporal sin atribuirla necesariamente a una migración. Se conservan intención, cuerpo y UUID, con bloqueo incluso al reabrir el diálogo. La conciliación no interpreta historial no disponible como ausencia de cierre. Solo se permite reenviar el cuerpo original y su misma clave; no existe ruta de devolución básica ni petición alternativa de inventario/sanciones.

Reservas y cancelaciones mantienen sus campos y guardas existentes ante resultados inciertos; no se inventa un UUID donde el contrato backend no lo admite. Los errores de lectura se propagan sin convertirlos a datos vacíos o a capacidad falsa.

Para el agente padre y el de registro: no cambia ninguna firma de autenticación/registro ni del cliente HTTP. Se consume el estado HTTP de error ya existente; esta entrega no modifica la conservación compartida de código, operación o diagnóstico de capacidad. Tampoco cambia el tratamiento general de errores ni los filtros. No hay nuevas dependencias ni instalaciones.

## Verificación offline del 25/11/2026

Según la [guía offline](../../../README.md), los siguientes comandos se ejecutaron desde la raíz del repositorio, sin servicios, base de datos ni lectura de archivos de entorno:

- [node --test frontend/tests/loans-schema-compatibility.test.mjs](../../../tests/loans-schema-compatibility.test.mjs): 34 pruebas nuevas incluidas en la comprobación focal; contratos legacy/nuevos, datos inválidos, renderizado de avisos/botones y conservación de intención/UUID ante 503.
- Comprobación focal conjunta: 219/219, cero fallidas/omitidas. Comando exacto: [node --test frontend/tests/loans-schema-compatibility.test.mjs frontend/tests/loan-closure.test.mjs frontend/tests/loans-contracts.test.mjs frontend/tests/my-history.test.mjs frontend/tests/trust-consumers.test.mjs frontend/tests/reservation-availability.test.mjs frontend/tests/operator-visual.test.mjs frontend/tests/reservation-settings.test.mjs frontend/tests/copy-rehabilitation.test.mjs frontend/tests/inventory-compatibility.test.mjs frontend/tests/inventory.test.mjs](../../../tests/loans-schema-compatibility.test.mjs).
- npm --prefix frontend run typecheck: correcto, sin emisión.
- git diff --check -- frontend: correcto; solo inspección, sin mutar Git.
- [node --test frontend/tests/*.test.mjs](../../../tests/): 440 pruebas, 417 aprobadas, 23 fallidas, cero omitidas. **La suite completa no está aprobada.**

Se actualizaron fixtures relacionados para acreditar inventario listo, ocupación real, capturas nulas y cierre con historial disponible. Se conservaron sus aserciones de negocio, sin eliminar casos, omitir pruebas ni relajar validadores.

Fallos restantes observados, sin afirmar que todos sean preexistentes: dos en [admin-visual](../../../tests/admin-visual.test.mjs), uno en [auth-user](../../../tests/auth-user.test.mjs), dos en [categories](../../../tests/categories.test.mjs), seis en [final-corrections](../../../tests/final-corrections.test.mjs), diez en [phase3-corrections](../../../tests/phase3-corrections.test.mjs), uno en [real-integration](../../../tests/real-integration.test.mjs) y uno en [review-regressions](../../../tests/review-regressions.test.mjs). Incluyen fixtures sin capacidades, altas incompletas, expectativas estructurales anteriores y verificaciones fuera del alcance de registro/navegación. No se cambiaron indiscriminadamente sus expectativas para obtener verde.

Las pruebas renderizan Vue en memoria, no navegador real ni CSS. No se ejecutaron build con carga de entorno, instalaciones, migraciones, seeds, conexiones externas ni mutaciones de Git.

## Revisión final de integración frontend

Verificación posterior, también offline y sin cargar entorno:

- Suite completa con [las pruebas frontend](../../../tests/): **440 pruebas, 430 aprobadas, 10 fallidas, cero omitidas/canceladas**. Antes de esta revisión: 417 aprobadas y 23 fallidas. Se corrigieron 13 fallos; **la suite completa sigue sin estar aprobada**.
- Comprobación focal anterior de 219 pruebas más las suites completas [administrativa](../../../tests/admin-visual.test.mjs), [categorías](../../../tests/categories.test.mjs) y [revisión](../../../tests/review-regressions.test.mjs): **252/252**, cero fallidas/omitidas/canceladas.
- Casos R1/R2/R3 de [correcciones finales](../../../tests/final-corrections.test.mjs): **7/7**. Casos I3/I4/I5 y devolución 401 de [fase 3](../../../tests/phase3-corrections.test.mjs): **7/7**. Los filtros solo delimitan estas ejecuciones focales; la ejecución completa mantuvo las 440 pruebas.
- Comprobación de espacios del diff frontend: correcta. No se ejecutó build.

Cambios limitados a cinco archivos de pruebas: **42 líneas añadidas y 22 eliminadas** frente al estado previo de esta revisión. Se reutilizaron los [fixtures de compatibilidad](../../../tests/helpers/inventory-compatibility-fixtures.mjs), con ocupación explícita, capacidades acreditadas y stock/conteos coherentes. Las altas de ejemplares incluyen su estado; las lecturas del editor incluyen los campos de política vigentes. El caso legacy agregado omite deliberadamente el total para comprobar que permanece desconocido, en vez de confundir stock libre con total.

Dos actualizaciones estructurales conservan las garantías: el editor comprueba el cuerpo de la escritura y no el GET posterior; categorías exige exactamente el sondeo adicional de capacidades, sin escrituras adicionales ni DELETE. La prueba del detalle comprueba el manejador nombrado, la marca de cambio y la consulta de operaciones propias, prohíbe refrescar recurso/copias o cerrar el diálogo al confirmar y conserva la exigencia de refresco al cierre explícito.

Se revisaron parsers y consumidores de inventario/préstamos sin encontrar un error adicional de compatibilidad que justificara cambios de producción. No se relajaron validadores, permisos, verificación física, conservación de intención ni aserciones de negocio. No se modificaron autenticación, usuarios, registro, arranque, consultas compartidas ni cliente HTTP compartido o sus pruebas.

### Diez fallos restantes, no corregidos por estar fuera de alcance

| Suite | Casos | Diagnóstico observado |
| --- | --- | --- |
| [Autenticación de usuario](../../../tests/auth-user.test.mjs:203) | 1 | Invalidación de una lectura pendiente de imagen del registro. |
| [Correcciones finales](../../../tests/final-corrections.test.mjs:157) | 2 | Inicio: categoría sin nombre y errores asíncronos de renderizado/desmontaje. Layout: expectativa de siete enlaces frente a once. |
| [Fase 3](../../../tests/phase3-corrections.test.mjs:165) | 6 | Dos expectativas de ruta administrativa anterior; tres montajes del inicio/apelaciones con categoría sin nombre y errores asíncronos; un montaje de inventario con sesión USUARIO que espera controles de ADMINISTRADOR. |
| [Integración real](../../../tests/real-integration.test.mjs:43) | 1 | Expectativa de política de acceso/rutas distinta del resultado actual. |

El fixture de lectura del detalle en fase 3 se completó, pero la prueba sigue fallando al esperar la ruta administrativa anterior. No se cambió esa expectativa de navegación para conseguir verde. Estos diagnósticos no afirman que todos los problemas sean preexistentes a otras entregas.

Se inspeccionó exclusivamente el archivo extraño de la raíz: contenía solo un resumen temporal de una ejecución anterior de tres suites frontend, sin código ni datos de usuario; se eliminó ese archivo. No se tocaron artefactos preexistentes, archivos de entorno, backend, base de datos, generados ni documentación OpenAPI, ni se instalaron dependencias o mutó Git.

## Revisión posterior de cuatro hallazgos

Los párrafos anteriores describen entregas históricas. Estado comprobado ahora:
**129/129 focales**, tipos correctos; suite global **449/459**, diez fallos.
Los diez nombres, mensajes de error y códigos coinciden con los reproducidos en
las cuatro suites afectadas del commit 5d91079, cargadas en memoria mediante
lectura de Git. No se ejecutó una suite global histórica ni se extrapola esa
comparación a otros fallos. [Evidencias, método y límites](../../../../docs/compatibility-review-verification.md).
