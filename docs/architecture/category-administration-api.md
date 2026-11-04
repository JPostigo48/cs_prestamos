# Categorías: contrato para integración frontend

Fuente de verdad: [OpenAPI generado](../../backend/openapi.json), [controlador](../../backend/src/modules/inventory/presentation/controllers/inventory.controller.ts), [DTO administrativos](../../backend/src/modules/inventory/presentation/dto/category-management.dto.ts). Sin cambios de UI.

## Rutas y permisos

| Operación | Ruta | Acceso |
|---|---|---|
| Listar todas | GET /inventory/categories | Lectura pública existente |
| Filtrar activas/inactivas | GET /inventory/categories?active=true o active=false | Lectura pública existente |
| Resumen | GET /inventory/categories/:categoryId | Lectura pública existente |
| Crear | POST /inventory/categories | ADMINISTRADOR |
| Editar/desactivar/reactivar | PATCH /inventory/categories/:categoryId | ADMINISTRADOR |
| Políticas publicadas | GET /inventory/categories/:categoryId/policies | ADMINISTRADOR |
| Previsualizar borrado | GET /inventory/categories/:categoryId/deletion-preview | ADMINISTRADOR |
| Borrado físico | DELETE /inventory/categories/:categoryId | ADMINISTRADOR |

Omitir active incluye inactivas. Solo acepta las cadenas true/false; otro valor da 400. Listado devuelve un array, no una página. IDs son UUID.

POST exige nombre (no vacío, máximo 120) y tiempoMaximoPrestamoDias (entero positivo). Opcionales: descripcion (texto de hasta 2000 o null), activo (booleano, por defecto true), tiempoMaximoPrestamoHoras (entero positivo). PATCH admite esos mismos campos, todos opcionales, pero exige al menos uno. activo no admite null; descripcion=null limpia la descripción. No se copian reglas al crear.

Resumen/listado: id, nombre, descripcion, activo, tiempoMaximoPrestamoDias, tiempoMaximoPrestamoHoras, resourceCount, copyCount. Los conteos incluyen todos los recursos/ejemplares, independientemente del estado. Tras mutar, refrescar el resumen/listado para obtener conteos actualizados.

## Duración y recursos

- Unidad operativa: **horas enteras**. tiempoMaximoPrestamoHoras explícito prevalece; si se omite al crear o se modifica solo días, se calcula días × 24. El campo días se conserva por compatibilidad; no impone un segundo límite independiente.
- GET /inventory/resources/:resourceId expone loanPolicy: resourceId, categoryId, durationHours, effectiveDurationHours, source (CATEGORY o RESOURCE).
- PATCH /inventory/resources/:resourceId/loan-policy, solo ADMINISTRADOR: cuerpo { durationHours: entero entre 1 y 2147483647, o null }. null elimina el override y hereda la categoría. No modifica reglas ni porcentajes.
- POST/PATCH de recursos admiten activo; GET del recurso y catálogo lo exponen. Recurso/categoría inactivos no figuran disponibles aunque existan ejemplares físicamente DISPONIBLE. Inventario no asigna nuevos recursos a categorías inactivas ni ejemplares a recursos/categorías inactivos.
- No se recalculan fechas, duración ni instantáneas de reservas/préstamos existentes. La recogida utiliza la duración reservada, incluso en reservas antiguas sin instantánea; cambiar la duración actual no invalida esa recogida.
- Creación de reserva revalida dentro de su transacción actividad y política publicada completa/vigente de la categoría. La recogida revalida actividad, pero no exige recalcular políticas/duración históricas. Inactividad impide recogida hasta reactivar; **no impide inspección ni devolución histórica**.
- Se mantienen elegibilidad, sanciones, términos y límites simultáneos existentes. Esta entrega no introduce otro motor de confianza ni aplica sanciones/recompensas retroactivas.

## Políticas: lectura, no guardado

Respuesta: status (COMPLETE, INCOMPLETE, UNAVAILABLE), eligibleForNewOperations (considera también actividad de categoría), termsVersionId (UUID o null), policies (array), rulesEditable=false, message.

Cada política conserva el DTO público de Rules: id (versión), ruleId, number, title, key, kind, category, categoryId, severity, trustEffect, penaltyPoints, suspensionType, suspensionDays, consequence, criteria. kind: LATENESS/DAMAGE/LOSS/NO_SHOW/REWARD/ACCESS/TRUST. severity: LEVE/MODERADA/GRAVE o null. trustEffect: DISCOUNT/SET_ZERO/NONE. criteria expone umbrales, ventana no-show, recompensa, restricciones de acceso y niveles de confianza estructurados. Consultar los campos anidados exactos en OpenAPI.

Se seleccionan versiones del manifiesto publicado de términos vigente, asociadas por categoryId, más las reglas realmente globales. No se infiere por nombre ni se toman reglas de otra categoría. Para habilitar nuevas reservas se exige la matriz propia de tardanza/daño por gravedad, recompensa/acceso, y configuración global de pérdida/no-show/confianza, con versiones activas y vigentes y criterios estructurados presentes. Las políticas se muestran aunque una versión haya dejado de ser vigente; en ese caso no habilitan operaciones nuevas.

Mensaje de operación pendiente: «Consulta de políticas publicadas. Edición y publicación coordinada por categoría pendiente; no se guardan cambios de reglas desde esta operación.» No hay PATCH/PUT de esta configuración por categoría; no mostrar éxito de guardado. Crear/activar una categoría sin publicación completa **no basta para reservar**. No se ha ejecutado ninguna semilla.

## Modal de eliminación

Preview devuelve:

- categoryId, nombre, resourceIds, copyIds, accessoryIds.
- resourceCount, copyCount.
- blockers: array de { dependency, count, reason }.
- canDelete: booleano.
- wouldDelete: { categories, resources, copies, accessories }; todos cero si está bloqueada.
- alternative: DEACTIVATE.

El modal no debe interpretar el preview como autorización. DELETE no recibe una lista cliente de IDs ni canDelete: **vuelve a leer dependencias bajo bloqueo transaccional**. Éxito 200: { deleted: true, categoryId }. Admite categoría vacía o conjunto completo sin referencias; borra explícitamente ejemplares, accesorios, recursos y categoría. No borra observaciones, reservas, préstamos, inspecciones, reglas, términos, sanciones ni auditorías.

Se bloquean referencias directas e IDs embebidos en instantáneas/texto histórico, incluyendo versiones de reglas y auditorías. Préstamos/reglas referenciados bloquean también la eliminación de sus dependencias transitivas: devoluciones, evidencias, inspecciones, incumplimientos, sanciones y apelaciones. No se invocan cascadas para borrar historia. Una auditoría de creación/edición también es dependencia: una categoría administrada por API normalmente debe desactivarse, aunque después quede vacía.

PATCH con activo=false conserva categoría, recursos, ejemplares, estados y toda la historia; activo=true permite reactivar. No convierte ejemplares reservados/prestados en disponibles.

## Errores y límites operativos

- 400: entrada inválida, UUID incorrecto, PATCH vacío o filtro inválido.
- 401/403: autenticación/rol. OPERADOR no crea/edita/borra categorías, recursos ni códigos de ejemplar; tampoco cambia accesorios o duración individual.
- 404: categoría/recurso inexistente; también una ruta de edición de políticas por categoría no implementada.
- 409: nombre duplicado, historial/dependencias, inventario inactivo o política incompleta al operar; conflicto de bloqueo/borrado concurrente. Mostrar message y ofrecer desactivar donde corresponda.
- 500: fallo inesperado; no simular persistencia. Errores HTTP usan statusCode, error, message (texto o array), path, timestamp; errores no HTTP pueden usar el cuerpo genérico de Nest documentado en OpenAPI.

ADMINISTRADOR conserva circulación de OPERADOR: recogida, devolución, inspecciones, lecturas staff y solicitudes. Cambios manuales de estado de ejemplar y observaciones siguen disponibles para ambos roles como operaciones de circulación; no habilitan marcar PRESTADO manualmente ni saltar operaciones abiertas. USUARIO conserva catálogo/disponibilidad y operaciones propias con sus guards actuales.

**Migración aplicada el 2026-11-04 a la base configurada, con autorización expresa:** [20261104T0641_category_administration](../../backend/prisma/migrations/app/20261104T0641_category_administration/migration.ts:14). Aplicada mediante el motor oficial; columnas verificadas y ninguna migración pendiente hacia este contrato. Añade solamente descripcion/activo de categoría y activo de recurso, con estado inicial true para filas existentes. Consultas reales del repositorio y lecturas HTTP de categorías/recursos verificadas (200); sin semillas.

El borrado toma bloqueos breves y amplios sobre tablas con referencias no normalizadas (SHARE ROW EXCLUSIVE, NOWAIT). La reserva estabiliza las tablas de publicación mientras valida políticas (SHARE, NOWAIT). Una operación concurrente puede recibir 409 y requerir reintento; la previsualización no bloquea tablas. La comprobación de referencias históricas es conservadora y recorre los campos históricos relevantes; optimizar/normalizar esos vínculos sería trabajo posterior para volúmenes grandes. Las pruebas automatizadas son offline y verifican lógica, planes ORM y rollback del doble. El 2026-11-04 se ejecutó además un mantenimiento excepcional autorizado, por IDs y en transacción, con claves foráneas reales y conservación de relaciones supervivientes; no cambia el contrato restrictivo de DELETE ni sustituye pruebas de concurrencia del endpoint.
