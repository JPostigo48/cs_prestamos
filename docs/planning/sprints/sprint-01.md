---
sprint: 1
name: Base técnica y prototipos
status: in_progress
version: v0.1.0
commit_prefix: v0.1.0
---

# Sprint 1 — Base técnica y prototipos

## Objetivo

Consolidar la base de datos, el backend modular y los prototipos visuales y de interfaz que permitirán integrar el primer flujo funcional en el Sprint 2.

Este sprint **no** busca completar la lógica del sistema. Busca que cada integrante pueda trabajar en paralelo sobre su área con una base técnica común.

## Estado actual

`develop` contiene PostgreSQL mediante Docker Compose, el contrato Prisma para las entidades modeladas, una migración inicial, seeds y un backend Nest con Inventario funcional conectado a persistencia. Los demás módulos (`auth`, `users`, `loans`, `rules`) cuentan con carpetas y contratos preliminares; esto no significa que sus casos de uso y endpoints estén implementados. La base Vue 3 + TypeScript ya está integrada, pero todavía no existe el frontend funcional de préstamos.

Ronald avanzó la base de datos, la base Nest y los endpoints de Inventario. Juan Carlos llevó la planificación y preparó la organización modular y los contratos del backend con apoyo de Ronald; los casos de uso de los demás módulos siguen pendientes. Mauricio completó una maquetación Figma casi final, web y móvil para usuario, operador y administrador, con ayuda de Luis. El diseño está enlazado en la tabla siguiente; sigue pendiente la revisión final del equipo. Luis también aportó el prototipo visual de login desde `aporte-login`, incorporado en `frontend/`; todavía no autentica contra la API.

La separación de `trust` definida por la documentación es posterior al esqueleto integrado: confianza y sanciones permanecen provisionalmente en `users`, y apelaciones en `rules`. Esa diferencia está documentada y debe corregirse en una tarea posterior sin presentar la distribución actual como arquitectura objetivo.

| Integrante | Evidencia o ubicación del avance | Pendiente inmediato | Enlace |
| --- | --- | --- | --- |
| Ronald Reynaldo Valdez Agüero | PostgreSQL/Prisma y endpoints de Inventario en `develop`; `backend/prisma/` y `backend/src/modules/inventory/`. | Revisar la consistencia del esquema con el dominio y cerrar la documentación de puesta en marcha. | — |
| Mauricio Alejandro Farfán Huayta | Maquetación Figma casi final, web y móvil por rol, con apoyo de Luis. | Revisar los flujos con el equipo antes de dar el diseño por cerrado. | [Ver Figma](https://www.figma.com/make/xgNTepyl4gkprTBb8lWzqr/Sistema-de-Pr%C3%A9stamos-Universitarios?t=jn7FnIXxi2AFKMvo-1) |
| Luis Antonio Chipana Chura | Apoyo a la maquetación Figma y prototipo visual de login incorporado desde `aporte-login`. | Integrar el acceso funcional con la API y coordinar sus vistas con el diseño común. | — |
| Juan Carlos Postigo Cabana | Planificación en `docs/planning/`, estructura y contratos del backend preparados con apoyo de Ronald. | Implementar los casos de uso y endpoints de los módulos restantes. | — |

El enlace de Figma fue proporcionado por el equipo; la revisión final del diseño sigue pendiente. La existencia de carpetas o rutas de los demás módulos no acredita casos de uso implementados.

## Alcance

- PostgreSQL reproducible y contrato Prisma preliminar con migraciones y datos de desarrollo; revisar su coherencia con el UML vigente.
- Backend Nest + TypeScript modular por capas. Inventario puede aportar endpoints reales y persistencia; los demás módulos mantienen contratos preliminares hasta implementar sus casos de uso.
- Diseño web y móvil por rol en Figma como referencia para la interfaz, enlazado y pendiente de revisión final.
- Prototipo de login de Luis incorporado desde `aporte-login`; decidir su adaptación a Vue.js + TypeScript antes de integrarlo funcionalmente.
- Base común del frontend: estructura, navegación y criterios visuales acordados a partir de Figma. La interfaz de Inventario continúa como trabajo pendiente, no como entrega ya realizada.
- Documentación de puesta en marcha y estado real de ramas, módulos y contratos.
- `develop` creada y rama histórica `feature/mi_database` tratada según `ARCH-05`.
- Línea paralela Project Showcase: base visual y técnica de `/project`, sprints, arquitectura y Git, sin sustituir el frontend funcional del sistema de préstamos.

## Fuera de alcance

- Lógica de dominio completa en el backend.
- Completar la conexión con persistencia real en todos los módulos; Inventario ya está conectado, pero los demás conservan implementaciones pendientes.
- Autenticación funcional. El módulo `auth` ya contiene contratos preliminares; sus casos de uso y endpoints corresponden al Sprint 2.
- Confianza, sanciones, reglas versionadas, incumplimientos y términos.
- Préstamos planificados y validación de superposición de intervalos.
- Contratos de API considerados definitivos.

## Entregables

- PostgreSQL, contrato Prisma, migración y seeds iniciales versionados.
- Backend Nest con estructura modular y módulo Inventario conectado a Prisma.
- Contratos preliminares para los módulos restantes, sin presentar casos de uso pendientes como funcionales.
- Diseño Figma web y móvil por rol identificado y revisable por el equipo.
- Prototipo de login de `aporte-login` evaluado para su integración o adaptación.
- Frontend base Vue.js + TypeScript integrado, con navegación y estructura comunes; Inventario visual queda pendiente mientras no esté integrado.
- Instrucciones de puesta en marcha y estado del sprint actualizados.
- Primera etapa prevista de Project Showcase con `/project`, `/project/sprints`, `/project/architecture` y `/project/git`; su incorporación al alcance no significa que ya esté integrada.

## Versión objetivo

`v0.1.0` — todos los commits del sprint comienzan con este prefijo.

## Integrantes y responsabilidades

| Integrante | Responsabilidad en el sprint | Rama |
| --- | --- | --- |
| Ronald Reynaldo Valdez Agüero | PostgreSQL, contrato Prisma, migración, seeds y arranque técnico del backend | `feature/mi_database` (integrada en `develop`); verificar cierre de rama |
| Juan Carlos Postigo Cabana | Arquitectura, estructura por capas, contratos de módulos, planificación y Project Showcase | Trabajo integrado en `develop`; documentación en `docs/project-planning`; código de Showcase previsto en `feat/project-showcase` |
| Mauricio Alejandro Farfán Huayta | Maquetas web y móvil por rol; coordinación del frontend común | Figma externo; rama de implementación por definir |
| Luis Antonio Chipana Chura | Prototipo de login y futura adaptación al frontend común | `frontend/` (incorporado desde `aporte-login`) |

## Tareas

### Ronald Reynaldo Valdez Agüero

**Responsabilidad:** persistencia y base de datos.

**Rama con avances verificados:** `feature/mi_database`, cuyos cambios de base de datos e Inventario están integrados en `develop`.

**Tareas:**

- Configurar PostgreSQL y el acceso desde el proyecto (`ARCH-06`).
- Traducir el modelo de dominio vigente a un esquema relacional preliminar (`ARCH-07`).
- Crear migraciones o un mecanismo equivalente (`ARCH-08`).
- Crear datos mínimos para desarrollo (`ARCH-09`).
- Documentar cómo levantar la base de datos.
- Mantener la coherencia del esquema con el [modelo de dominio](../../architecture/uml/README.md).

**Avance verificado:** Docker Compose para PostgreSQL, contrato Prisma con entidades del dominio, migración inicial y seeds; además, base Nest y módulo Inventario con persistencia y endpoints. El esquema no debe confundirse con la validación definitiva de todas las reglas del negocio.

**Conceptos a considerar,** solo en la medida en que los requisitos actuales los justifiquen: usuarios; cuentas de acceso; solicitudes de registro; categorías; recursos; ejemplares; préstamos; devoluciones; reglas y versiones; términos y versiones; incumplimientos; sanciones.

No se inventan tablas adicionales por comodidad. Las decisiones que el modelo de dominio todavía marca como pendientes no se resuelven en el esquema.

**Commits esperados:**

- `v0.1.0 chore: configura entorno inicial de PostgreSQL`
- `v0.1.0 feat: crea esquema inicial de persistencia`
- `v0.1.0 feat: agrega relaciones iniciales del modelo de datos`
- `v0.1.0 chore: agrega datos iniciales para desarrollo`
- `v0.1.0 docs: documenta configuración de la base de datos`

### Juan Carlos Postigo Cabana

**Responsabilidad:** planificación, backend base, endpoints y contratos de la API.

**Avance integrado:** commits de organización de `backend/src/modules/` y contratos en `develop`; la rama `chore/backend-scaffold` era una propuesta de planificación, no la rama utilizada.

**Tareas:**

- Crear `develop` desde `main` y resolver la rama remota `feature/mi_database` (`ARCH-05`).
- Consolidar el backend Nest + TypeScript ya iniciado (`ARCH-02`).
- Preparar la estructura modular aplicando la arquitectura por capas (`ARCH-02`); las carpetas y contratos preliminares ya están integrados.
- Preparar el manejo de errores y la configuración (`ARCH-03`).
- Definir rutas preliminares y contratos de endpoints para los módulos pendientes (`LOAN-01`). Inventario ya tiene endpoints reales; los mocks de Préstamos siguen pendientes.
- Documentar los contratos request/response preliminares.
- Documentar cómo levantar el proyecto (`DOC-06`).
- Alinear Structurizr con el UML vigente en confianza, sanciones y apelaciones (`DOC-07`).
- Mantener actualizado este archivo durante el sprint (`PLAN-05`).

**Estructura prevista:**

```text
backend/src/modules/
  auth/
  users/
  inventory/
  loans/
  rules/
  trust/
```

Dentro de cada módulo: `presentation`, `application`, `domain`, `infrastructure`. Sin sobrearquitectura innecesaria: una carpeta vacía es preferible a una capa llena de abstracciones que todavía no hacen nada.

`trust/` se crea como módulo separado según el [modelo de confianza vigente](../../requirements/trust-model.md) y el UML. `rules/` cubre Reglas y Términos, cuyo límite DDD sigue por validar.

**Rutas preliminares por validar, no endpoints implementados por la sola existencia de carpetas:**

```text
GET  /resources
GET  /resources/:id
GET  /users/:id
GET  /loans
POST /loans
```

Son preliminares. Antes de considerarlos definitivos deben contrastarse con los requisitos vigentes: `GET /resources` debe reflejar la disponibilidad derivada de los ejemplares (RF-13) y `POST /loans` debe anticipar el intervalo `fechaInicio`–`fechaFin` del modelo de dominio, aunque el sprint no implemente todavía su validación.

**Tareas — Project Showcase (paralelas a backend y planificación):**

- Crear la base del módulo separada de `auth`, `users`, `inventory`, `loans`, `rules` y `trust` (`PLAN-06`) y la ruta inicial `/project` (`PLAN-07`).
- Mostrar el roadmap, el estado general y accesos a las secciones (`PLAN-04`); crear la vista de sprints con sus versiones, tareas y responsables (`PLAN-01`).
- Crear la vista inicial de arquitectura a partir de los diagramas documentados (`PLAN-04`) y preparar SVG de PlantUML generados desde los `.puml` (`PLAN-09`).
- Crear `/project/git` con la estrategia de ramas y versiones del [flujo Git](../git-workflow.md); distinguir ramas previstas de avances verificados (`PLAN-03`). Los Pull Requests y tags se completarán cuando estén documentados.
- Definir el registro de avances y pendientes por integrante en el documento del sprint (`PLAN-08`).

**Rama actual:** `docs/project-planning` para planificación y ajustes de su visualización. El módulo coordina sus rutas con Mauricio, responsable del router global. La base Vue 3 + TypeScript ya existe; no equivale a tener implementado el frontend funcional de préstamos.

**Resultado mínimo previsto:** `/project`, `/project/sprints`, `/project/architecture` y `/project/git`. En esta etapa se admiten artefactos estáticos previamente generados, no duplicación manual de los documentos fuente ni dependencia de PlantUML en tiempo de ejecución.

**Commits esperados:**

- `v0.1.0 chore: configura proyecto inicial del backend`
- `v0.1.0 chore: crea estructura modular por capas`
- `v0.1.0 feat: agrega rutas iniciales de la API`
- `v0.1.0 feat: agrega endpoints mock para desarrollo`
- `v0.1.0 docs: documenta contratos iniciales de la API`
- `v0.1.0 docs: actualiza planificación del Sprint 1`
- `v0.1.0 feat: crea módulo inicial de visualización del proyecto`
- `v0.1.0 feat: agrega vista de planificación por sprints`
- `v0.1.0 feat: agrega visualización de arquitectura`
- `v0.1.0 feat: agrega visualización del flujo Git`
- `v0.1.0 chore: automatiza exportación inicial de diagramas`
- `v0.1.0 docs: define seguimiento por integrante del sprint`

### Mauricio Alejandro Farfán Huayta

**Responsabilidad:** diseño visual y shell del frontend.

**Rama de implementación:** por definir. El diseño reportado se encuentra en Figma, no en una rama del repositorio.

**Trabajo reportado:** maquetación casi final en Figma para web y móvil, diferenciada por usuario, operador y administrador, con apoyo de Luis. El enlace está en el [estado actual](#estado-actual). Falta revisar los flujos y trasladar el diseño al frontend funcional; la base Vue 3 + TypeScript ya existe.

**Tareas:**

- Consolidar Vue.js + TypeScript y configurar el router (`ARCH-04`).
- Crear el layout principal y la navegación base.
- Implementar sidebar/topbar según el diseño definido.
- Definir componentes compartidos, sistema visual y estilos globales.
- Agregar el cliente HTTP común para consumo de la API (`ARCH-10`).
- Implementar el comportamiento responsive del layout general.

**Área de trabajo:**

```text
frontend/src/
  app/
  router/
  layouts/
  shared/
```

Evita implementar en profundidad módulos funcionales que corresponden a Luis.

**Commits esperados:**

- `v0.1.0 chore: configura estructura inicial del frontend`
- `v0.1.0 feat: agrega navegación base de la aplicación`
- `v0.1.0 feat: implementa layout principal`
- `v0.1.0 style: integra identidad visual del proyecto`
- `v0.1.0 style: define componentes visuales compartidos`
- `v0.1.0 feat: agrega cliente base para consumo de la API`
- `v0.1.0 style: adapta layout principal a dispositivos móviles`

### Luis Antonio Chipana Chura

**Responsabilidad actual:** prototipo de login y posterior trabajo funcional del frontend, coordinado con el diseño común.

**Rama de origen:** `aporte-login` (prototipo incorporado en `develop`). `feat/inventory-ui` era una rama prevista y no se ha verificado como avance actual.

**Área del prototipo:** `frontend/` en `develop`. El login ya convive con la base Vue 3 + TypeScript como prototipo visual; falta conectarlo a la API.

**Tareas:**

- Revisar el prototipo de login existente y coordinar con Mauricio qué se reutiliza y qué se adapta al frontend común.
- Evitar tratar el prototipo de `frontend/` como frontend definitivo sin resolver el cambio de JavaScript a TypeScript y los elementos de navegación compartidos.
- Retomar las vistas de Inventario (`INV-01` a `INV-05`) una vez disponible la base común; la API de Inventario ya existe en el backend y no requiere inventar mocks para justificar estas vistas.

**Coordinación:** evita modificar sin acuerdo previo el layout global, los estilos globales, el router global y los componentes de `shared/`. Si necesita un componente compartido, lo acuerda antes con Mauricio en lugar de crearlo dentro del módulo o modificar `shared/` por su cuenta.

**Commits esperados:**

- `v0.1.0 feat: crea vista inicial del inventario`
- `v0.1.0 feat: agrega detalle de recursos y ejemplares`
- `v0.1.0 feat: muestra disponibilidad de ejemplares`
- `v0.1.0 feat: integra inventario con API preliminar`
- `v0.1.0 style: adapta vistas de inventario a dispositivos móviles`

Estos commits de la interfaz de Inventario siguen siendo orientativos, no trabajo completado. Luis también apoyó la maquetación Figma de Mauricio. Su prototipo de login, incorporado desde `aporte-login`, aún requiere integración funcional.

## Dependencias

| Dependencia | Quién la produce | Quién la consume | Cuándo se necesita |
| --- | --- | --- | --- |
| `develop` y base de datos integradas | Juan Carlos y Ronald | Todo el equipo | Ya disponibles; comprobar el estado remoto antes de abrir tareas nuevas. |
| Diseño web/móvil por rol y decisiones de navegación | Mauricio | Luis | Registrar y revisar el Figma antes de adaptar el prototipo de login. |
| Estructura Vue.js + TypeScript compartida | Mauricio, coordinado con Luis | Luis | Necesaria para adaptar el prototipo incorporado sin mantener dos aplicaciones. |
| Contratos y endpoints de Inventario existentes | Ronald y Juan Carlos | Luis | Se usan como referencia para la interfaz; no se requiere un mock nuevo del módulo. |
| Contratos de los demás módulos | Juan Carlos | Sprint 2 | Las carpetas creadas no sustituyen casos de uso ni endpoints funcionales. |
| Estructura Vue.js + TypeScript y router compartidos | Mauricio, coordinado con Luis | Juan Carlos (`PLAN-06`, `PLAN-07`) | Acordar integración de `/project` sin duplicar el frontend ni modificar simultáneamente el router global. |
| Diagramas PlantUML versionados | Juan Carlos | Juan Carlos (`PLAN-09`) | Generar SVG desde los `.puml`; no copiar imágenes como nueva fuente de verdad. |

**Trabajo paralelo:**

- Ronald puede cerrar ajustes del esquema y la persistencia mientras se prepara el frontend.
- Mauricio y Luis pueden trabajar en paralelo, siempre que acuerden el layout y el lugar donde se integrará el login.
- Juan Carlos puede preparar contratos y planificación sin presentar los esqueletos de módulos como funcionalidad terminada.

**Dirección del diseño:** el esquema de base de datos se deriva del modelo de dominio. La base de datos **no** se convierte en la fuente desde la cual se diseña el dominio. Si el esquema revela un problema en el modelo, se corrige el modelo en [`docs/architecture/`](../../architecture/uml/README.md) y luego el esquema, no al revés.

## Criterios de aceptación

- PostgreSQL puede levantarse siguiendo la documentación del repositorio, desde cero y de forma reproducible.
- El esquema preliminar cubre los conceptos del modelo de dominio que los requisitos actuales justifican, sin tablas inventadas.
- El backend Nest arranca, expone Inventario y documenta cuáles rutas de los demás módulos siguen pendientes.
- La estructura modular por capas existe para los módulos previstos.
- Los contratos request/response preliminares están documentados y marcados como preliminares.
- Las maquetas Figma web y móvil por rol son accesibles y están revisadas por el equipo.
- El frontend base Vue.js + TypeScript arranca, aplica el diseño acordado y define navegación común.
- Se decide y documenta cómo adaptar o descartar el prototipo de login incorporado antes de integrarlo funcionalmente.
- Si las vistas de Inventario no se completan en este sprint, se trasladan explícitamente al Sprint 2 y se actualiza el backlog; no se marcan como entregadas por existir la API.
- La documentación permite a un integrante nuevo levantar base de datos, backend y frontend.
- Este archivo refleja el estado real del sprint al cerrarlo.
- Si se integra Project Showcase, las cuatro rutas mínimas son navegables y distinguen planificación de resultados documentados; la vista Git no da por completada una rama solo por existir.

## Definition of Done

Aplica la [Definition of Done del proyecto](../git-workflow.md#definition-of-done): alcance cumplido, compila cuando corresponde, pasa lint y pruebas si existen, respeta arquitectura y convenciones, sin errores conocidos, commits con prefijo de la versión objetivo, documentación afectada actualizada, revisión mediante Pull Request para aportes ajenos o revisión local del trabajo propio, e integración en `develop`.

## Pull Requests

Registrar los Pull Requests utilizados para aportes del equipo y las integraciones directas del trabajo propio, sin presentar estas últimas como Pull Requests.

## Resultado del sprint

Avances registrados: Ronald preparó PostgreSQL/Prisma, migración, seeds y endpoints de Inventario; Juan Carlos llevó la planificación y preparó la estructura y los contratos del backend con apoyo de Ronald. Mauricio completó una maquetación Figma casi final para web y móvil por rol con ayuda de Luis; el diseño ya está enlazado, pero sigue pendiente su revisión final. La base Vue 3 + TypeScript está integrada y el login permanece como prototipo visual, sin autenticación real. Faltan las vistas funcionales de Inventario, los casos de uso de los demás módulos y el cierre formal del sprint. El sprint permanece `in_progress`.

## Versión resultante

Prevista: `v0.1.0`

Al completar e integrar correctamente: `develop` → `main`, y después el tag `v0.1.0`.
