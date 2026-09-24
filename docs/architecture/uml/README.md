# Modelo de dominio UML

[`modelo-dominio.puml`](modelo-dominio.puml) es el diagrama de clases conceptual del sistema. Está alineado con el [análisis de requisitos](../../requirements/README.md) vigente; no representa clases implementadas, tablas de PostgreSQL, DTO ni contratos de API. Las [vistas de Structurizr](../structurizr/README.md) describen los límites estratégicos; la incorporación de apelaciones en esas vistas se realizará por separado.

## Límites y agregados

| Contexto o área | Agregados y raíces | Responsabilidad representada |
| --- | --- | --- |
| Usuarios / `users` — soporte | `SolicitudRegistro`; `Usuario` | Separa la solicitud y sus evidencias de la identidad institucional aprobada. Mantiene el tipo de usuario y su vinculación vigente. |
| Inventario / `inventory` — soporte | `CategoriaRecurso`; `Recurso`; `Ejemplar` | Define el plazo por categoría, el catálogo de recursos y cada unidad física prestable con sus observaciones. |
| Préstamos / `loans` — central | `Prestamo` | Registra el intervalo temporal en el que un ejemplar queda ocupado por un usuario, incluyendo préstamos inmediatos o planificados. |
| Confianza / `trust` — soporte | `PerfilConfianza`; `Sancion`; `Apelacion` | Mantiene porcentaje y nivel, aplica sanciones, evalúa restricciones y conserva la revisión histórica de sanciones apeladas. |
| Autenticación / `auth` — genérico de apoyo | `CuentaAcceso` | Vincula una identidad de usuario con su rol de acceso sin mezclar permisos con la clasificación institucional. |
| Reglas y términos — límite por validar | `ReglaUso`; `VersionRegla`; `Incumplimiento`; `VersionTerminos`; `AceptacionTerminos` | Modela reglas versionadas, penalizaciones históricas y aceptación de términos. No se afirma todavía que esta área sea un bounded context independiente. |

Los agregados se mantienen pequeños y las relaciones entre ellos se expresan mediante identificadores. Las composiciones solo aparecen donde un objeto forma parte del ciclo de vida de su agregado: evidencias de una solicitud, porcentaje del perfil de confianza, observaciones de un ejemplar y devolución de un préstamo.

## Usuarios, confianza y acceso

- `SolicitudRegistro` conserva el tipo de usuario, el identificador institucional cuando corresponda, la fecha, el estado y cero o más evidencias de vinculación. La dependencia punteada indica que una solicitud aprobada puede originar un usuario; no representa una asociación persistente entre ambos agregados. El procedimiento de verificación sigue pendiente.
- `Usuario` es la raíz que conserva la identidad institucional ya habilitada. `TipoUsuario` distingue `ESTUDIANTE`, `DOCENTE` y `ADMINISTRATIVO`.
- `PerfilConfianza` pertenece al bounded context Confianza y referencia a `Usuario` mediante `usuarioId`; no duplica su identidad institucional. `PorcentajeConfianza` protege la invariante del intervalo cerrado de 0 a 100. El nivel se deriva del porcentaje y solo se representan cuatro identificadores provisionales (`NIVEL_1` a `NIVEL_4`); sus nombres y umbrales definitivos no están definidos.
- `Sancion` es una raíz de agregado porque posee ciclo de vida e historial propios y puede ser referenciada por apelaciones. Conserva el usuario, el incumplimiento, la regla y versión aplicadas, la cuenta del operador, el intervalo, el estado y el cambio de confianza mediante `confianzaAnterior` y `confianzaPosterior`. Sus estados son `ACTIVA`, `FINALIZADA` y `ABSUELTA`.
- `Apelacion` es una raíz del mismo bounded context Confianza. Referencia por ID a la sanción y al usuario, registra motivo y fecha de solicitud, y conserva el resultado, la fecha, el administrador y el fundamento de la resolución. La colección de apelaciones constituye el historial; no se introduce un agregado artificial `HistorialApelaciones`.
- Apelaciones no se separa como bounded context: por ahora su lenguaje y ciclo de vida dependen de Sanción. Una separación futura solo tendría sentido si aparecieran procesos independientes, etapas, políticas o integraciones propias.
- `CuentaAcceso` mantiene una correspondencia conceptual uno a uno con `Usuario`. Su estado `/habilitada` requiere una solicitud aprobada y vinculación vigente con la EPCC; no sustituye la decisión de elegibilidad para préstamos, que además considera confianza y restricciones del dominio. `TipoUsuario.ADMINISTRATIVO` describe la relación de una persona con la EPCC; `RolAcceso.ADMINISTRADOR` concede permisos dentro del sistema. Son conceptos distintos. La fórmula de habilitación, las credenciales y el proveedor de autenticación permanecen pendientes.

## Inventario y préstamos

- `CategoriaRecurso` define el tiempo máximo de préstamo. `Recurso` referencia su categoría y representa una entrada del catálogo. `Ejemplar` referencia el recurso y representa una unidad física. Cada recurso tiene uno o varios ejemplares registrados.
- `/disponible` de `Recurso` se deriva de que exista al menos un ejemplar `DISPONIBLE`; no se almacena como una fuente de verdad adicional.
- `EstadoEjemplar.NO_DISPONIBLE` permite conservar una unidad que, después de una devolución o incidencia, no puede seguir prestándose. Las observaciones pertenecen al agregado `Ejemplar` y registran el estado detectado sin inventar categorías de daño.
- Cada `Prestamo` referencia exactamente un usuario y un ejemplar. `fechaInicio` y `fechaFin` representan el intervalo en el que el ejemplar está ocupado, tanto para préstamos inmediatos como para préstamos planificados.
- Un ejemplar no puede tener préstamos activos o planificados con intervalos superpuestos. Las multiplicidades `0..*` representan el historial por ejemplar, no autorización para solapar ocupaciones.
- `fechaFin` queda fijada al crear o planificar el préstamo a partir del tiempo de la categoría. Es una instantánea del plazo aplicado: modificar después una categoría no cambia préstamos existentes.
- La devolución es un Value Object opcional del préstamo y su fecha no puede ser anterior a `fechaInicio`. El estado derivado puede ser `PLANIFICADO`, `ACTIVO` o `FINALIZADO`; `/vencido` indica que un préstamo no finalizado superó `fechaFin`.
- Registrar un préstamo y cambiar el ejemplar a `PRESTADO` deben coordinarse de forma atómica, también ante concurrencia. Al devolver, el ejemplar solo pasa a `DISPONIBLE` si puede seguir prestándose; de lo contrario queda `NO_DISPONIBLE` y se conserva la observación correspondiente.

## Reglas, incumplimientos y términos

- `ReglaUso` se asocia por identificador con una o más raíces `VersionRegla` y conserva `versionVigenteId`. Cada versión registra `reglaId`, título, descripción, porcentaje de penalización, consecuencia y estado, y es inmutable una vez histórica. `VersionRegla` es un agregado independiente porque otros agregados, en particular `Incumplimiento`, deben referenciar directamente la versión histórica sin atravesar ni cargar `ReglaUso`. Modificar una regla genera una versión que no altera las anteriores.
- `Incumplimiento` referencia al usuario, la regla y la versión exacta infringida. También conserva `penalizacionAplicada`, por lo que una modificación posterior no cambia el descuento histórico.
- `Sancion` representa la penalización aplicada al usuario y su duración. Cuando proviene de una regla incumplida, conserva referencias por identificador al incumplimiento, la regla y la versión usada para no depender de cambios posteriores.
- La versión de regla conserva la duración de la restricción de préstamo para estudiantes. Las fechas de la sanción son la instantánea aplicada; modificar después esa duración no altera sanciones existentes.
- Registrar el incumplimiento, aplicar la sanción y actualizar el porcentaje de confianza debe ser una operación consistente. El mecanismo técnico de coordinación se definirá durante el diseño de implementación.
- Una sanción activa puede ser apelada por el usuario afectado. Solo un administrador resuelve la apelación; si la acepta, la sanción queda `ABSUELTA` y deja de bloquear préstamos. El efecto de esa absolución sobre el porcentaje de confianza permanece pendiente.
- `VersionTerminos` y `AceptacionTerminos` permiten saber qué versión aceptó cada usuario y cuándo. No se relaciona una versión de términos con versiones de reglas porque la composición de los términos sigue pendiente.
- La consecuencia se conserva como información conceptual de la regla. Su representación y ejecución automática aún no están definidas.

## Decisiones deliberadamente pendientes

El diagrama NO define todavía:

- porcentaje inicial de confianza;
- nombres y umbrales definitivos de los cuatro niveles;
- restricciones concretas por nivel de confianza o tipo de usuario;
- límite de préstamos simultáneos para estudiantes;
- mecanismos para aumentar la confianza;
- efecto de una apelación aceptada sobre el porcentaje de confianza;
- procedimiento de verificación de la vinculación con la EPCC;
- credenciales o proveedor de autenticación;
- consecuencias ejecutables y restricciones concretas asociadas a una sanción activa;
- composición de una versión de términos;
- estrategia transaccional y restricciones de persistencia que garanticen las invariantes bajo concurrencia;
- alineación definitiva entre el contrato Prisma existente y las decisiones de dominio que todavía están pendientes.

Tampoco introduce subclases por tipo de usuario o recurso, un motor de reglas, eventos de dominio, sagas ni otros patrones que los requisitos actuales no justifican.

## Arquitectura modular por capas

[`arquitectura-modular.puml`](arquitectura-modular.puml) es la vista objetivo de la arquitectura del backend, no un inventario literal de archivos implementados. Las **columnas representan módulos** y las **filas representan capas**: Presentación, Aplicación, Dominio e Infraestructura. Permite repartir el trabajo por módulo y reconocer sus responsabilidades en cada capa. El frontend Vue.js y PostgreSQL quedan fuera de la matriz del backend NestJS; todos utilizan las tecnologías seleccionadas para el proyecto.

La matriz utiliza una [tabla Creole](https://plantuml.com/creole) dentro del backend para mantener las columnas y filas alineadas sin depender de la distribución automática de paquetes. Prioriza la estructura sobre las flechas. Las dependencias e interacciones detalladas entre contextos se documentan en [Structurizr](../structurizr/README.md). El orden visual de las filas no representa una cadena de dependencias: Presentación invoca casos de uso de Aplicación; Aplicación coordina el dominio y los puertos internos; Infraestructura implementa esos contratos. **El dominio no depende de Infraestructura ni de PostgreSQL.**

Confianza aparece como módulo separado, de acuerdo con el [modelo de confianza vigente](../../requirements/trust-model.md) y el UML: concentra el perfil, las sanciones y las apelaciones, sin duplicar la identidad institucional de Usuarios. Apelaciones no constituye otro bounded context. Reglas y Términos se organiza como módulo de planificación, pero su límite DDD continúa por validar.

Shared/Common no se añade como columna ni como bounded context de negocio. Si se necesita durante la implementación, se limitará a tipos base, errores comunes, utilidades sin significado de negocio y configuración técnica compartida. Identificadores y objetos de valor específicos, como `UsuarioId`, `PrestamoId` o `PorcentajeConfianza`, permanecen en sus módulos propietarios.

Los nombres de controllers, DTO y repositorios orientan el reparto de trabajo, no fijan todavía contratos de API ni clases definitivas. JWT y hash son opciones técnicas de Autenticación pendientes de selección; no se asume aún un proveedor ni un mecanismo de credenciales. Tampoco se fijan umbrales de confianza, restricciones aún pendientes ni la restitución de confianza tras una apelación aceptada.

### Estado de implementación respecto de la vista

El backend ya tiene una estructura ejecutable con los módulos `auth`, `users`, `inventory`, `loans` y `rules`, infraestructura Prisma compartida y casos de uso tipados. `inventory` contiene comportamiento y pruebas; los demás módulos son principalmente esqueletos con implementación pendiente.

La estructura integrada desde `develop` fue creada antes de separar conceptualmente `trust`: mantiene contratos provisionales de confianza y sanciones dentro de `users`, y apelaciones dentro de `rules`. El UML, los requisitos y esta matriz son la fuente del diseño objetivo; mover esas responsabilidades al módulo `trust` debe realizarse como una tarea posterior y coordinada, no como parte de esta corrección documental.

La matriz recoge los préstamos planificados y sus intervalos definidos en el UML. Existe un ajuste de trazabilidad pendiente en [requisitos funcionales](../../requirements/functional.md): RF-17 solo menciona préstamos activos y RF-19 no distingue el alta de un préstamo futuro de su inicio. Esta vista no decide cuándo un ejemplar planificado cambia a `PRESTADO`.

Para validar y renderizar esta vista desde la raíz del repositorio, con Java y la variable `PLANTUML_JAR` apuntando al JAR local:

```powershell
$salida = Join-Path ([System.IO.Path]::GetFullPath($env:TEMP)) 'prestamos-arquitectura'
New-Item -ItemType Directory -Force -Path $salida | Out-Null
java -jar $env:PLANTUML_JAR -charset UTF-8 -checkonly docs/architecture/uml/arquitectura-modular.puml
java -jar $env:PLANTUML_JAR -charset UTF-8 -tsvg -o $salida docs/architecture/uml/arquitectura-modular.puml
java -jar $env:PLANTUML_JAR -charset UTF-8 -tpng -o $salida docs/architecture/uml/arquitectura-modular.puml
```

La ruta de salida es absoluta y temporal; los renderizados no se incorporan al repositorio.

## Renderizado local

Se requiere Java y un [JAR de PlantUML](https://plantuml.com/download). El archivo usa el motor Smetana incluido en PlantUML para no depender de una instalación separada de Graphviz.

Validado con Java 21 y PlantUML 1.2026.8 mediante comprobación de sintaxis, generación SVG/PNG y revisión visual del PNG.

Desde la raíz del repositorio, en PowerShell:

```powershell
$env:PLANTUML_JAR = 'C:\herramientas\plantuml.jar'
$salida = Join-Path $env:TEMP 'prestamos-uml'
New-Item -ItemType Directory -Force -Path $salida | Out-Null
java -jar $env:PLANTUML_JAR -charset UTF-8 --check-syntax docs/architecture/uml/modelo-dominio.puml
java -jar $env:PLANTUML_JAR -charset UTF-8 --format svg --output-dir $salida docs/architecture/uml/modelo-dominio.puml
java -jar $env:PLANTUML_JAR -charset UTF-8 --format png --output-dir $salida docs/architecture/uml/modelo-dominio.puml
```

Sustituir la ruta del JAR por su ubicación local. Los renderizados se mantienen fuera del repositorio; el archivo `.puml` es la fuente versionada.

Referencias de sintaxis y ejecución: [diagrama de clases](https://plantuml.com/class-diagram) y [línea de comandos de PlantUML](https://plantuml.com/command-line).
