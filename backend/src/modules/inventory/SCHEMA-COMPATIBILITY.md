# Contrato de compatibilidad de inventario para frontend

## Alcance

Compatibilidad con la migración física de ejemplares pendiente o parcialmente aplicada.
No aplica migraciones, no interpreta el ledger y no repara ni habilita datos legados.
La columna y el campo HTTP reales de habilitación son [habilitado](presentation/dto/inventory-response.dto.ts:180), no habilitadoPrestamo. No se introduce un alias nuevo.
Los permisos, verificaciones, auditoría, barrera de inventario y reglas de ocupación existentes se conservan.

## Respuestas HTTP

Las rutas y envoltorios existentes no cambian. Los [DTO de respuesta](presentation/dto/inventory-response.dto.ts) son la fuente del contrato; no se regeneraron las copias OpenAPI.

| Ruta GET | Contrato |
| --- | --- |
| /inventory/resources | Página existente con [data](presentation/dto/inventory-response.dto.ts:129), total, page y limit; agrega [compatibility](presentation/dto/inventory-response.dto.ts:127) en la raíz, incluso sin resultados. Cada recurso incluye también capacidades y stock registrado. |
| /inventory/resources/:resourceId | Conserva política y categoría; mismas capacidades, stock y disponibilidad nullable del catálogo. |
| /inventory/resources/:resourceId/availability | Conserva identificador y conteos; agrega capacidades, stock registrado y cantidad reservada. |
| /inventory/availability | Conserva el arreglo de recursos; cada elemento incluye capacidades, stock registrado y cantidad reservada. |
| /inventory/resources/:resourceId/copies | Conserva el arreglo de ejemplares; cada ejemplar agrega capacidades. |
| /inventory/copies/:copyId | Conserva recurso y observaciones; agrega capacidades del ejemplar. |

Las altas y ediciones de recurso devuelven los conteos actuales, no un cero de relleno.
Las altas y ediciones de ejemplar conservan la misma proyección de condición/habilitación/capacidades.
Categorías, observaciones, política y accesorios conservan sus envoltorios y campos; no se les añade disponibilidad inventada.

## Semántica de datos

| Campo | Tipo y significado |
| --- | --- |
| [condicionFisica](presentation/dto/inventory-response.dto.ts:172) | Condición física existente o nulo. Nulo significa desconocida: columna ausente/incompatible o clasificación legada nula. No mostrar «dañado» ni «apto» por defecto. |
| [habilitado](presentation/dto/inventory-response.dto.ts:180) | Booleano o nulo. Nulo significa que la columna no está acreditada. Falso solo se devuelve cuando se leyó realmente falso. |
| [estado](presentation/dto/inventory-response.dto.ts:195) | Se conserva literalmente la ocupación registrada: disponible, reservado, prestado o no disponible. No sintetiza aptitud. |
| [available](presentation/dto/inventory-response.dto.ts:103) | Booleano o nulo. Nulo cuando el esquema no permite verificar disponibilidad. Nunca convertir a falso. |
| [availableCopies](presentation/dto/inventory-response.dto.ts:109), [disponibles](presentation/dto/inventory-response.dto.ts:133) | Entero o nulo. Nulo cuando falta el bundle físico completo, incluso si el recurso/categoría están inactivos o el stock es cero. No mostrar cero ni ofrecer reserva a partir del stock. |
| [noDisponibles](presentation/dto/inventory-response.dto.ts:135) | Entero o nulo: retenciones más libres sin elegibilidad acreditada. Nulo si no se puede calcular desde disponibilidad verificable. |
| [totalCopies](presentation/dto/inventory-response.dto.ts:106) | Entero real: suma de los cuatro estados registrados. Incluye reservados. Independiente de la clasificación física y de disponibilidad. |
| [registeredStock](presentation/dto/inventory-response.dto.ts:76) | Objeto con cuatro enteros: libres, prestados, retenidos y reservados. Son exclusivamente cantidades por ocupación almacenada. Libre no equivale a apto ni prestable. |
| [prestados](presentation/dto/inventory-response.dto.ts:44), [reservados](presentation/dto/inventory-response.dto.ts:46) | Cantidades registradas, nunca convertidas a nulo por faltar clasificación física. |

Con esquema completo, la clasificación legada nula sigue sin acreditar aptitud: no integra el conteo de ejemplares elegibles. Un conteo verificable cero significa que no hay ejemplares que satisfagan todos los requisitos, no que todos estén dañados.

Los filtros de disponibilidad verdadera y falsa excluyen los recursos cuya disponibilidad es nula. La consulta sin filtro los conserva. Los totales y paginación del filtro cuentan únicamente coincidencias conocidas.

## Capacidades y acciones aditivas

El objeto [compatibility](domain/entities/inventory-compatibility.ts:2) siempre tiene:

- [status](domain/entities/inventory-compatibility.ts:3): READY con bundle físico completo; UPDATE_PENDING en esquema viejo/parcial o con restricciones faltantes.
- [message](domain/entities/inventory-compatibility.ts:4): nulo al estar listo; en actualización pendiente, texto: «Actualización de inventario pendiente. La disponibilidad no se puede verificar y las operaciones de circulación están deshabilitadas.»
- [capabilities](domain/entities/inventory-compatibility.ts:5): physicalCondition y administrativeEnablement indican individualmente columnas acreditadas. verifiedAvailability indica bundle físico completo, incluidas sus restricciones. Son booleanos, no clasificación del ejemplar.
- [actions](domain/entities/inventory-compatibility.ts:10): descriptiveEdits es verdadero; create, activate, release, rehabilitate y manageCopy son verdaderos únicamente con bundle completo.

Los nombres y valores exactos se encuentran en el [tipo del contrato](domain/entities/inventory-compatibility.ts:2). No son permisos: deben combinarse con rol, actividad, ocupación, compromisos y requisitos de verificación. READY no garantiza que una acción concreta esté permitida para esa fila.

El frontend puede obtener estas capacidades de la página de recursos incluso con catálogo vacío. Mientras estén pendientes, debe conservar visible el catálogo/stock y el mensaje, representar desconocidos sin coerción y deshabilitar altas, activaciones, gestión física, liberación y rehabilitación. No inferir capacidades por la presencia de una columna: un esquema parcial proyecta las columnas presentes sin autorizar escrituras físicas.

## Escrituras

Probadas con esquema viejo y ambas variantes parciales:

- Edición de nombre/descripción de categoría y recurso.
- Edición exclusiva del código de inventario del ejemplar, conservando las comprobaciones de ocupación/compromisos.
- Alta de observación sin cambiar condición, habilitación u ocupación.

Altas de categoría/recurso/ejemplar; activación de categoría/recurso; reasignación de categoría; cualquier habilitación o transición física del ejemplar (incluida retención/baja); liberación, rehabilitación y marcado como prestado requieren bundle completo. Una petición mixta descriptiva/física rechazada no guarda su parte descriptiva.

Se comprueba antes de cualquier escritura, incluidos bloqueos mediante actualización de filas, y se revalida con el ejecutor de la transacción antes de la primera escritura. La auditoría solo se escribe tras completar el trabajo. Nunca se reintenta una escritura por ausencia de esquema. No cambian las evidencias, verificación explícita, habilitación separada ni restricciones de rehabilitación.

## Errores y límites

- HTTP 503 por capacidad no disponible: cuerpo con statusCode 503, code SCHEMA_CAPABILITY_UNAVAILABLE, operation identificando la operación y diagnostic SCHEMA_INCOMPLETE o SCHEMA_UNKNOWN. El proveedor compartido diferencia mensajes seguros accionables: «Operación bloqueada por una actualización pendiente del sistema. Solicite al administrador completar la actualización y vuelva a intentarlo.» para esquema incompleto; «No se pudo verificar la disponibilidad de esta operación. Vuelva a intentarlo; si persiste, contacte al administrador.» para disponibilidad no verificable. Véanse los [dos cuerpos JSON exactos](../../../docs/loan-episodes-integration.md:248), sustituyendo la operación por la del llamador real. Red o permisos no prueban una actualización pendiente.
- Los metadatos desconocidos no producen fallback legacy ni disponibilidad cero: fallan con 503. No se exponen detalles del catálogo, credenciales ni errores SQL en este cuerpo.
- La lectura externa a transacciones permite un único reintento del proveedor para ausencia explícita de columna/tabla; reconstruye toda la lectura con capacidades frescas. Errores de conexión, permisos, timeout o SQL no relacionado no se ocultan.
- Una lectura dentro de una transacción coordinadora no se reintenta en esa transacción potencialmente abortada.
- El [consumidor de disponibilidad interna](application/use-cases/inventory.service.ts:836) de préstamos conserva su contrato booleano: ante esquema incompleto responde 503 en vez de devolver falso o cambiar el módulo consumidor. El conteo nullable solo tiene consumidores productivos en inventario.
- La caché y su invalidación son las del proveedor existente. Los metadatos de lectura son orientativos; el servidor siempre revalida escrituras.
- Pruebas [offline estrictas](../../../test/inventory-schema-compatibility.offline.spec.ts) con planes nativos y proveedor real; no certifican aislamiento, DDL ni concurrencia de PostgreSQL. Migración no aplicada, frontend y copias OpenAPI pendientes de integración autorizada por separado.

## Verificación de esta entrega

- 11 suites offline focales: 392 pruebas aprobadas, sin fallos ni omitidas; incluyen las 55 matrices/pruebas nuevas y regresiones de rehabilitación, categorías, configuración, contratos y cierre de préstamos.
- Comprobación completa de tipos sin emisión ni caché incremental: correcta.
- Lint con análisis de tipos sobre los 11 archivos de código/pruebas modificados: cero errores y cero advertencias.
- Sin lectura de entorno, conexiones, instalaciones, seeds ni migraciones. Proveedor compartido y artefactos previos del frontend preservados.
