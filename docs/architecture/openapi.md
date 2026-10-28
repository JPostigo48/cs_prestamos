# Contrato OpenAPI y autorización para Project Showcase

La fuente es Nest: controllers y DTOs de presentación de cada módulo. No editar
manualmente los JSON generados ni mantener una matriz paralela de roles en Vue.

## Generación focalizada, sin base de datos

Desde la raíz del repositorio:

```sh
npm run openapi:generate --prefix backend
node scripts/generate-project-showcase.mjs --openapi-only
npm run openapi:check --prefix backend
npm run test:openapi --prefix backend
```

El generador anula el módulo de carga de entorno antes de importar la aplicación,
usa una URL local inaccesible y crea un módulo documental con los controllers,
sin proveedores de negocio, inicialización de Prisma, seeds ni servidor HTTP.
El modo focalizado de Showcase copia exclusivamente el JSON; no procesa notas,
planificación ni diagramas. La comprobación compara ambas copias con la generación.

Salidas: [backend](../../backend/openapi.json) y
[copia de Showcase](../../frontend/public/generated/project/openapi.json).

## Extensiones por operación

- `x-roles: string[]`: valores reales de los roles efectivos de `RolesGuard`.
  Vacío significa **sin restricción de rol inferida**, no necesariamente público.
  Solo se publica la metadata `auth:roles` cuando el guard está presente.
  Se usa el mismo `Reflector.getAllAndOverride([handler, controller])` del guard:
  un método sustituye la lista de clase, incluso por una lista vacía.
- `x-authentication`: objeto requerido en cada operación:
  - `required: boolean`: presencia efectiva de `AuthGuard`.
  - `scope: "public" | "authenticated" | "roles" | "custom-guards"`:
    público, cualquier usuario autenticado, restricción por roles efectivos o
    guard personalizado cuya política no se interpreta automáticamente.
  - `description: string`: explicación del alcance y advertencia sobre controles
    adicionales de propiedad/negocio.
  - `guards: string[]`: nombres de guards en orden global, clase y método.
- `security: [{ "bearer": [] }]` para autenticación obligatoria; `[]` para las
  demás operaciones. El esquema bearer HTTP/JWT se declara en componentes.
- `x-implementation-status`: estado declarado en el controller; las operaciones
  actuales sin extensión explícita también están implementadas.

Los guards se concatenan, no se sobrescriben. Se incluyen los proveedores
`APP_GUARD` de los módulos y los guards globales del runtime documental. Actualmente
no hay autenticación global en el bootstrap. Un proveedor global con factory o
alias no resoluble detiene la generación, en vez de anunciar acceso público.
No confundir roles con propiedad: las consultas propias, cancelaciones y
apelaciones tienen controles adicionales documentados en las respuestas.

## Particularidades reales conservadas

- Catálogo: `{ data, total, page, limit }`; usuarios y solicitudes:
  `{ items, total, page, limit }`.
- Disponibilidad expone `disponibles`, `prestados` y `noDisponibles`; el total
  incluye reservas aunque no se exponga un contador separado.
- Reservas y devoluciones usan fechas `date-time`; devolución y recogida
  responden 201. Cancelar reserva devuelve su objeto con 200, no 204.
  No hay operaciones 204 actualmente; el validador exige ausencia de contenido
  si se añade una. La raíz devuelve texto plano.
- Auth documenta solo la cuenta segura, sin hash. Registrar cuenta requiere
  administrador, pero el caso de uso sigue creando exclusivamente rol USUARIO.
- Aceptar términos exige validar el `userId` del cuerpo, aunque el propietario
  efectivo se obtiene del token. No se ha cambiado esa lógica.
- Los errores HTTP siguen el filtro: `statusCode`, `error`, `message` (texto o
  lista), `path`, `timestamp`. Excepciones no HTTP conservan el error 500 estándar
  de Nest (sin path/timestamp). Por ejemplo, regla inexistente al modificar o
  cambiar estado lanza actualmente una excepción no HTTP: no se inventa un 404.

Las pruebas focalizadas verifican cobertura de handlers reales, códigos de éxito,
referencias, campos de entidades expuestos, fechas, nulabilidad, paginación,
entradas y autorización, incluyendo ejecución del guard real con overrides.
El comando focalizado normaliza la ruta canónica en Windows para evitar cargar
dos instancias de Vitest por diferencias entre letras de unidad mayúsculas y
minúsculas, y evita cargar archivos de entorno.

## Presentación API y contrato ORM

La página `/project/api` consume directamente las extensiones generadas anteriores:
estado junto a candado para acceso protegido, etiqueta Público para operaciones
públicas y «cualquier usuario autenticado» cuando el alcance no limita roles.
El tooltip abre con hover, foco o toque, se cierra con Escape, pérdida de foco o
segundo toque; incluye descripción accesible y la advertencia del contrato.
No hay matriz de permisos en Vue ni se cambian permisos de negocio.
Cada respuesta presenta descripción, ejemplo ilustrativo y esquema expandido
(referencias, arrays, campos anidados y composición); los ciclos conservan `$ref`.
Las respuestas sin contenido se indican explícitamente, sin fabricar un cuerpo.

`/project/db`, junto a API en la navegación, consume exclusivamente
`frontend/public/generated/project/db.json`, generado desde
`backend/prisma/contract.prisma`. No usa un schema Prisma clásico, introspección,
cliente ORM, conexión, archivos de entorno ni registros. Se exponen nombres de
modelos, campos y enums (incluidos nombres como passwordHash, **sin valores**),
tipos parametrizados, nullable/lista, PK/FK, atributos de unicidad, índices,
restricciones declarativas, defaults, mapeos y las dos direcciones de cada relación
con cardinalidad, campos referenciados y acciones onDelete/onUpdate. Los módulos
proceden de los encabezados del contrato; no se clasifican manualmente modelos.

El parser local `scripts/project-db.mjs` consume tokens, comentarios y literales
con escapes, argumentos anidados/multilínea y el tipo `temporal.updatedAt()`.
Conserva las declaraciones de atributos completas, incluidos índices compuestos
y restricciones check. Valida tipos conocidos, campos de índices/FK e inversas
sin ambigüedad. Una extensión del dialecto no soportada, relación implícita sin
FK, datasource, generator o SQL suelto detiene la generación con línea de origen,
en lugar de producir un catálogo incompleto. No publica URLs de datasource.

Generación completa: `npm run project:generate` (incluye ORM automáticamente).
Actualización focalizada, desde la raíz, sin diagramas ni otros documentos:

```sh
node scripts/generate-project-showcase.mjs --db-only
node scripts/generate-project-showcase.mjs --openapi-only
node --test frontend/tests/project-showcase.test.mjs
```

Las pruebas comparan todos los modelos/enums/campos/tipos/atributos y relaciones
contra el contrato completo y fixtures representativos; también montan las páginas,
la navegación y el tooltip con los helpers Vue existentes. La cabecera sticky vive
dentro del contenedor de pantalla completa y scroll propio de ProjectLayout: sin
offset heredado, sin compensación estimada, navegación wrap móvil y CSS scoped,
sin modificar Prototype, las interfaces reales ni estilos globales.

Comprobación de empaquetado sin carga de entorno (desde frontend):

```sh
npm run build
node --input-type=module -e "import { build } from 'vite'; await build({ envFile: false });"
```

El segundo comando comprueba solo empaquetado, no sustituye el chequeo de tipos
del build oficial. Smoke local opcional, solo Chrome headless con CDP y sin API
ni navegación externa: `node frontend/tests/project-showcase.browser.mjs`.
