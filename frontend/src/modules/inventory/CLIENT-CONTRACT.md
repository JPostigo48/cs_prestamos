# Contrato cliente de inventario

## Integración de préstamos

No se modificaron los consumidores de préstamos/confianza ni el cliente HTTP compartido. El servidor sigue siendo la autoridad para permisos, compromisos, actividad, políticas y escrituras concurrentes.

### Exportaciones de ejemplares

Desde [copy-contracts.ts](api/copy-contracts.ts):

- [`physicalConditions`](api/copy-contracts.ts:2): colección literal de las seis condiciones físicas del servidor; no añade «desconocido» como condición física.
- [`CopyVerification`](api/copy-contracts.ts:3) y [`validCopyVerification(value: unknown)`](api/copy-contracts.ts:4): contrato y predicado existentes de verificación explícita; no se relajaron evidencias, motivo, aptitud ni componentes completos.
- [`validCopy(value: unknown): boolean`](api/copy-contracts.ts:10): valida una respuesta HTTP sin modificarla. No es un predicado de aptitud ni un estrechamiento de tipos.
- [`parseCopy(value: unknown)`](api/copy-contracts.ts:13): valida y devuelve un objeto nuevo, conservando los campos adicionales de la respuesta. Identificadores y código son cadenas no vacías; ocupación es uno de los cuatro estados registrados. Condición física y habilitación administrativa son nullable. La compatibilidad normalizada también puede ser nula exclusivamente por ausencia de metadatos legacy.
- [`isCopyEligibleForLoan(copy): boolean`](api/copy-contracts.ts:27): recibe ocupación como cadena, condición física nullable, habilitación nullable y compatibilidad nullable. Solo devuelve verdadero con disponibilidad verificable acreditada, ocupación libre, condición apta y habilitación verdadera. Es un prerrequisito del ejemplar, **no autorización para reservar/prestar**.

Desde [inventory-api.ts](api/inventory-api.ts):

- [`Copy`](api/inventory-api.ts:46): identificadores de ejemplar/recurso, código, ocupación registrada; condición física y habilitación nullable; compatibilidad nullable. No se introduce alias para habilitación.
- [`CopyDetail`](api/inventory-api.ts:55): extiende el ejemplar con su recurso; se conservan los campos adicionales recibidos, incluidas observaciones.
- [`getCopies(id: string, signal?: AbortSignal)`](api/inventory-api.ts:155): promesa de arreglo de ejemplares normalizados; exige pertenencia al recurso solicitado.
- [`getCopy(id: string, signal?: AbortSignal)`](api/inventory-api.ts:164): promesa de detalle normalizado; exige identidad solicitada.
- [`changeCopyState(copy, estado, verification?)`](api/inventory-api.ts:285): conserva firma y verificación; reconsulta el ejemplar antes de escribir y rechaza capacidades desconocidas/pendientes con estado 503. Ocupados siguen bloqueados con 409; verificación insuficiente con 400.

### Capacidades y disponibilidad

Desde [compatibility-contracts.ts](api/compatibility-contracts.ts), con reexportación de los dos tipos y los dos auxiliares de presentación/acciones desde [inventory-api.ts](api/inventory-api.ts:6):

- [`InventoryCompatibility`](api/compatibility-contracts.ts:3): estado listo o pendiente, mensaje nullable, tres capacidades booleanas y seis acciones. Ediciones descriptivas siempre verdaderas; las otras cinco acciones solo verdaderas con bundle completo. No son permisos.
- [`RegisteredStock`](api/compatibility-contracts.ts:9): libres, prestados, retenidos y reservados como enteros no negativos. Libre **no** equivale a prestable.
- [`inventoryActionAllowed(compatibility, action): boolean`](api/compatibility-contracts.ts:13): acepta compatibilidad nula/ausente y devuelve falso en esos casos. Combinar siempre con permisos y restricciones por fila.
- [`inventoryCompatibilityMessage(compatibility): string`](api/compatibility-contracts.ts:14): mensaje visible pendiente/desconocido; cadena vacía cuando está listo.

Exportaciones HTTP adicionales de [inventory-api.ts](api/inventory-api.ts):

- [`Resource`](api/inventory-api.ts:22): disponibilidad booleana nullable; cantidad disponible, total y stock nullable solo para lecturas legacy incompletas. Con metadatos nuevos, total/stock son obligatorios y exactos; disponibilidad/cantidad disponible solo pueden ser nulas con bundle incompleto.
- [`ResourcePage`](api/inventory-api.ts:58): compatibilidad en la raíz, incluso sin filas. Total nullable únicamente en respuesta legacy que lo omita; página/límite omitidos en legacy se normalizan a los parámetros solicitados, sin cambiar filtros.
- [`GlobalAvailability`](api/inventory-api.ts:72): recurso más cantidades disponibles/prestadas/no disponibles/reservadas. Cantidades ausentes en legacy quedan desconocidas, no cero.
- [`ResourceAvailability`](api/inventory-api.ts:113): identificador del recurso, disponibilidad y conteos, stock y compatibilidad; conserva cantidad reservada. Cantidad prestada obligatoria; reservada desconocida únicamente si falta en legacy.
- [`parseResource(value: unknown)`](api/inventory-api.ts:105), [`parseResourceAvailability(value: unknown)`](api/inventory-api.ts:124): validadores/normalizadores, no generan disponibilidad a partir de stock.
- [`getResourceAvailability(id: string, signal?: AbortSignal)`](api/inventory-api.ts:137): consulta individual e identidad validada.
- [`getInventoryCompatibility(signal?: AbortSignal)`](api/inventory-api.ts:143): consulta la primera página sin filtros con límite uno; obtiene compatibilidad sin requerir recursos existentes.
- [`getGlobalAvailability(signal?: AbortSignal)`](api/inventory-api.ts:81): arreglo completo, no página del catálogo.
- [`categoryAvailability(resources, categoryId): number | null`](api/inventory-api.ts:99): propaga desconocido si cualquier recurso de esa categoría tiene cantidad disponible nula; nunca suma nulos como ceros.

La ausencia completa de metadatos HTTP permite lectura legacy conservadora. **Metadatos presentes pero nulos, incompletos, incoherentes o de tipos inválidos no permiten fallback**: fallan como respuesta incompatible con estado local cero. Los parsers consumen respuestas HTTP crudas; no volver a pasar un objeto legacy ya normalizado por un parser HTTP, pues su compatibilidad nula es una representación interna, no un metadato válido del servidor.

Los errores HTTP se propagan; no se convierten en arreglos vacíos ni conteos cero. No se modificó el tratamiento compartido de códigos/diagnósticos HTTP.

### Edición descriptiva

[`saveResource()`](api/inventory-api.ts:242) y [`saveCategory()`](api/categories-api.ts:56) admiten un tercer parámetro opcional de edición exclusivamente descriptiva. Requiere identificador existente y envía solo nombre/descripción; no envía categoría, activación, duración ni datos físicos. Los editores usan ese modo mientras las capacidades físicas no estén acreditadas. El servidor revalida toda escritura.

En modo descriptivo, la confirmación y conciliación de categorías comparan solo
nombre/descripción enviados. La duración no enviada no se valida ni se infiere
desde las horas; una categoría con dos días y 24 horas conserva ambos valores.
La edición completa mantiene la validación y comparación de todos sus campos.
El [editor](components/CategoryEditorDialog.vue:24) recuerda el modo de la
solicitud incierta al conciliar, sin repetir la escritura.

La [resolución compartida de ejemplares](useCopyDetails.ts:6) permite revalidar
en cada cambio de la fuente. Los listados operativos optan explícitamente por
esa opción: descartan capacidades obsoletas, abortan lecturas anteriores e
ignoran respuestas tardías. Un error conserva el identificador en el listado,
pero no una capacidad lista anterior.

## Archivos de esta entrega

- Contratos y API: [compatibilidad](api/compatibility-contracts.ts), [ejemplares](api/copy-contracts.ts), [inventario](api/inventory-api.ts), [categorías](api/categories-api.ts).
- Componentes: [aviso](components/InventoryCompatibilityNotice.vue), [gestor de ejemplares](components/CopyManager.vue), [rehabilitación](components/RehabilitateCopyDialog.vue), [tarjeta](components/ResourceCard.vue), [editor de recurso](components/ResourceEditorDialog.vue), [editor de categoría](components/CategoryEditorDialog.vue).
- Páginas: [catálogo](pages/CatalogPage.vue), [detalle](pages/ResourceDetailPage.vue), [categorías](pages/CategoriesPage.vue).
- Pruebas nuevas: [suite focal](../../../tests/inventory-compatibility.test.mjs) y [fixtures](../../../tests/helpers/inventory-compatibility-fixtures.mjs). Las pruebas y artefactos preexistentes se conservaron sin modificación.

## Verificación offline

Desde la raíz del repositorio:

- [`node --test frontend/tests/inventory-compatibility.test.mjs frontend/tests/inventory.test.mjs`](../../../tests/inventory-compatibility.test.mjs:1): **59/59**, cero fallos/omitidas. Incluye 52 pruebas nuevas y siete existentes; renderizado Vue en memoria, no navegador real.
- `npm --prefix frontend run typecheck`: correcto, sin cargar entorno ni emitir compilación.
- [`node --test frontend/tests/*.test.mjs`](../../../tests/): **405 pruebas, 371 aprobadas, 34 fallidas**, cero omitidas/canceladas. **La suite completa no está aprobada.** Hay expectativas/fixtures legacy que no acreditan compatibilidad, respuestas incompletas de alta y expectativas antiguas del detalle; también fallas fuera de inventario. No se eliminaron ni relajaron aserciones para obtener resultados verdes. La comparación con originales en memoria no produjo evidencia utilizable; no se afirma que esas fallas sean todas preexistentes.

No se ejecutaron build con carga de entorno, instalaciones, navegador real, conexiones, operaciones de base de datos ni mutaciones de Git. La integración de consumidores de préstamos/confianza y la revisión de sus fixtures quedan a cargo de la integración padre.

## Revisión final de compatibilidad

La revisión posterior de fixtures y expectativas está documentada en el [cierre de integración frontend](../loans/CLIENT-CONTRACT.md#revisión-final-de-integración-frontend). Suite completa: **430/440**, diez fallos ajenos pendientes; focal conjunta ampliada: **252/252**, más dos grupos de siete casos relacionados aprobados. Se corrigieron trece fallos sin cambios adicionales de producción ni relajación de garantías. Las cifras anteriores se conservan como registro de cada entrega, no como estado final de la suite.

La [revisión de cuatro hallazgos](../../../../docs/compatibility-review-verification.md)
registra las comprobaciones actuales y la comparación histórica verificable;
no extiende la atribución de fallos a una suite histórica completa.
