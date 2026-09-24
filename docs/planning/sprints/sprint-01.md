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

`develop` ya contiene PostgreSQL mediante Docker Compose, el contrato Prisma para las entidades modeladas, una migración inicial, seeds y un backend Nest con Inventario funcional conectado a persistencia. Los demás módulos (`auth`, `users`, `loans`, `rules`) cuentan con carpetas y contratos preliminares; esto no significa que sus casos de uso y endpoints estén implementados. La versión objetivo del frontend aún no está integrada.

Ronald avanzó la base de datos y la base Nest en los commits de `christmas`. Juan Carlos reorganizó las carpetas del backend por módulos y capas, y preparó contratos y puntos de partida para los endpoints, sin dar por implementados los módulos restantes. Mauricio informa que completó en Figma las maquetas web y móvil para los roles usuario, operador y administrador; se trata de un avance externo al repositorio, todavía sin enlace o entrega versionada aquí. Luis publicó en la rama remota `aporte-login` un prototipo de interfaz de login bajo `front-end/`; usa Vue CLI y JavaScript, por lo que aún debe evaluarse su adaptación al frontend objetivo en Vue.js + TypeScript. Esa rama no está integrada en `develop`.

La separación de `trust` definida por la documentación es posterior al esqueleto integrado: confianza y sanciones permanecen provisionalmente en `users`, y apelaciones en `rules`. Esa diferencia está documentada y debe corregirse en una tarea posterior sin presentar la distribución actual como arquitectura objetivo.

| Integrante | Evidencia o ubicación del avance | Pendiente inmediato |
| --- | --- | --- |
| Ronald | Commits de `christmas` (`9302fa5`, `c76bcde`, `7c073e8`, `06d3415`, `2f6e440`) integrados en `develop`; `backend/prisma/`, `docker-compose.yml` e Inventario. | Revisar consistencia del esquema con el dominio y cerrar la documentación de puesta en marcha. |
| Mauricio | Maquetas Figma web/móvil por los tres roles, informadas por el equipo; sin enlace versionado aquí. | Compartir el enlace, revisar los flujos e implementar el frontend común. |
| Luis | Rama remota `aporte-login`, commits `b36c43b` y `a2b2712` con prototipo en `front-end/`. | Acordar con Mauricio la adaptación a Vue.js + TypeScript antes de integrar. |
| Juan Carlos | Commits de estructura y contratos `cc76659`, `8dbf161`, `bde7441`, `23e9fae`, `da799b2` integrados en `develop`; planificación en `docs/project-planning`. | Completar casos de uso, contratos de API y endpoints aún pendientes. |

Los hashes documentan el avance observado, no sustituyen los criterios de cierre ni corrigen retroactivamente mensajes de commits anteriores.

## Alcance

- PostgreSQL reproducible y contrato Prisma preliminar con migraciones y datos de desarrollo; revisar su coherencia con el UML vigente.
- Backend Nest + TypeScript modular por capas. Inventario puede aportar endpoints reales y persistencia; los demás módulos mantienen contratos preliminares hasta implementar sus casos de uso.
- Diseño web y móvil por rol en Figma como referencia para la interfaz, pendiente de vincular y revisar en el repositorio.
- Prototipo de login de Luis en `aporte-login`; decidir su adaptación a Vue.js + TypeScript antes de integrar.
- Base común del frontend: estructura, navegación y criterios visuales acordados a partir de Figma. La interfaz de Inventario continúa como trabajo pendiente, no como entrega ya realizada.
- Documentación de puesta en marcha y estado real de ramas, módulos y contratos.
- `develop` creada y rama histórica `feature/mi_database` tratada según `ARCH-05`.

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

## Versión objetivo

`v0.1.0` — todos los commits del sprint comienzan con este prefijo.

## Integrantes y responsabilidades

| Integrante | Responsabilidad en el sprint | Rama |
| --- | --- | --- |
| Ronald Reynaldo Valdez Agüero | PostgreSQL, contrato Prisma, migración, seeds y arranque técnico del backend | `feature/mi_database` (integrada en `develop`); verificar cierre de rama |
| Juan Carlos Postigo Cabana | Arquitectura, estructura por capas, contratos de módulos y planificación | Trabajo integrado en `develop` y documentación en `docs/project-planning` |
| Mauricio Alejandro Farfán Huayta | Maquetas web y móvil por rol; coordinación del frontend común | Figma externo; rama de implementación por definir |
| Luis Antonio Chipana Chura | Prototipo de login y futura adaptación al frontend común | `aporte-login` (remota, no integrada) |

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

**Commits esperados:**

- `v0.1.0 chore: configura proyecto inicial del backend`
- `v0.1.0 chore: crea estructura modular por capas`
- `v0.1.0 feat: agrega rutas iniciales de la API`
- `v0.1.0 feat: agrega endpoints mock para desarrollo`
- `v0.1.0 docs: documenta contratos iniciales de la API`
- `v0.1.0 docs: actualiza planificación del Sprint 1`

### Mauricio Alejandro Farfán Huayta

**Responsabilidad:** diseño visual y shell del frontend.

**Rama de implementación:** por definir. El diseño reportado se encuentra en Figma, no en una rama del repositorio.

**Trabajo reportado:** maquetación completa en Figma para web y móvil, diferenciada por usuario, operador y administrador. Falta registrar el enlace o la entrega del diseño y traducirlo al frontend versionado; no se da por existente un layout integrado.

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

**Rama verificada:** `aporte-login` (remota, sin integrar en `develop`). `feat/inventory-ui` era una rama prevista y no se ha verificado como avance actual.

**Área del prototipo:** `front-end/` en su rama. El frontend definitivo del proyecto usa Vue.js + TypeScript y todavía debe decidir cómo adaptar el prototipo Vue CLI + JavaScript.

**Tareas:**

- Revisar el prototipo de login existente y coordinar con Mauricio qué se reutiliza y qué se adapta al frontend común.
- Evitar integrar directamente `front-end/` sobre la estructura objetivo sin resolver el cambio de JavaScript a TypeScript y los elementos de navegación compartidos.
- Retomar las vistas de Inventario (`INV-01` a `INV-05`) una vez disponible la base común; la API de Inventario ya existe en el backend y no requiere inventar mocks para justificar estas vistas.

**Coordinación:** evita modificar sin acuerdo previo el layout global, los estilos globales, el router global y los componentes de `shared/`. Si necesita un componente compartido, lo acuerda antes con Mauricio en lugar de crearlo dentro del módulo o modificar `shared/` por su cuenta.

**Commits esperados:**

- `v0.1.0 feat: crea vista inicial del inventario`
- `v0.1.0 feat: agrega detalle de recursos y ejemplares`
- `v0.1.0 feat: muestra disponibilidad de ejemplares`
- `v0.1.0 feat: integra inventario con API preliminar`
- `v0.1.0 style: adapta vistas de inventario a dispositivos móviles`

Estos commits de Inventario siguen siendo orientativos, no trabajo completado. El avance verificable de Luis está en `aporte-login` (`b36c43b`, `a2b2712`) y todavía requiere adaptación e integración.

## Dependencias

| Dependencia | Quién la produce | Quién la consume | Cuándo se necesita |
| --- | --- | --- | --- |
| `develop` y base de datos integradas | Juan Carlos y Ronald | Todo el equipo | Ya disponibles; comprobar el estado remoto antes de abrir tareas nuevas. |
| Diseño web/móvil por rol y decisiones de navegación | Mauricio | Luis | Registrar y revisar el Figma antes de adaptar el prototipo de login. |
| Estructura Vue.js + TypeScript compartida | Mauricio, coordinado con Luis | Luis | Precondición para incorporar el prototipo de `aporte-login` sin duplicar aplicaciones. |
| Contratos y endpoints de Inventario existentes | Ronald y Juan Carlos | Luis | Se usan como referencia para la interfaz; no se requiere un mock nuevo del módulo. |
| Contratos de los demás módulos | Juan Carlos | Sprint 2 | Las carpetas creadas no sustituyen casos de uso ni endpoints funcionales. |

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
- Se decide y documenta cómo adaptar o descartar el prototipo de login de `aporte-login` antes de integrarlo.
- Si las vistas de Inventario no se completan en este sprint, se trasladan explícitamente al Sprint 2 y se actualiza el backlog; no se marcan como entregadas por existir la API.
- La documentación permite a un integrante nuevo levantar base de datos, backend y frontend.
- Este archivo refleja el estado real del sprint al cerrarlo.

## Definition of Done

Aplica la [Definition of Done del proyecto](../git-workflow.md#definition-of-done): alcance cumplido, compila, pasa lint y pruebas si existen, respeta arquitectura y convenciones, sin errores conocidos, commits con prefijo `v0.1.0`, documentación afectada actualizada, Pull Request creado y revisado, merge en `develop`.

## Pull Requests

Pendiente registrar los Pull Requests y revisiones utilizados para cada integración.

## Resultado del sprint

Avances comprobados: PostgreSQL/Prisma, migración, seeds, backend Nest, organización modular y módulo Inventario funcional en `develop`; prototipo de login en `aporte-login`. Mauricio reporta el diseño Figma completo para web y móvil por rol, pendiente de enlace y revisión en el repositorio. Siguen pendientes la base frontend integrada, la adaptación del login, las vistas visuales de Inventario y los endpoints de los demás módulos. El sprint permanece `in_progress`.

## Versión resultante

Prevista: `v0.1.0`

Al completar e integrar correctamente: `develop` → `main`, y después el tag `v0.1.0`.
