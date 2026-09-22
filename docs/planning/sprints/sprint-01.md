---
sprint: 1
name: Base técnica
status: planned
version: v0.1.0
commit_prefix: v0.1.0
---

# Sprint 1 — Base técnica

## Objetivo

Dejar preparados PostgreSQL, backend y frontend para que los sprints siguientes puedan implementar funcionalidades sin bloquearse entre sí.

Este sprint **no** busca completar la lógica del sistema. Busca que cada integrante pueda trabajar en paralelo sobre su área con una base técnica común.

## Alcance

- PostgreSQL configurado, con esquema preliminar derivado del modelo de dominio, migraciones y datos mínimos de desarrollo.
- Backend Node.js + TypeScript con estructura modular por capas, configuración, manejo de errores, rutas preliminares y endpoints mock.
- Contratos request/response preliminares documentados.
- Frontend Vue.js + TypeScript consolidado: router, layout principal, navegación, sistema visual, componentes compartidos y cliente HTTP común.
- Primera interfaz del módulo Inventario consumiendo los endpoints mock.
- Documentación para levantar el proyecto completo.
- Creación de `develop` y resolución de la rama remota histórica `feature/mi_database`.

## Fuera de alcance

- Lógica de dominio completa en el backend.
- Conexión del backend con la persistencia real: en este sprint se usan repositorios o datos mock temporales.
- Autenticación funcional. El módulo `auth` puede existir como estructura vacía; su implementación corresponde al Sprint 2.
- Confianza, sanciones, reglas versionadas, incumplimientos y términos.
- Préstamos planificados y validación de superposición de intervalos.
- Contratos de API considerados definitivos.

## Entregables

- PostgreSQL inicial reproducible.
- Backend ejecutable con estructura modular creada.
- Endpoints mock disponibles.
- Contratos preliminares documentados.
- Frontend ejecutable con identidad visual aplicada, layout principal y navegación base.
- Primera interfaz de Inventario con consumo preliminar de la API.
- Documentación para levantar el proyecto.
- Planificación del sprint actualizada.

## Versión objetivo

`v0.1.0` — todos los commits del sprint comienzan con este prefijo.

## Integrantes y responsabilidades

| Integrante | Responsabilidad en el sprint | Rama |
| --- | --- | --- |
| Ronald Reynaldo Valdez Agüero | Persistencia y base de datos | `chore/database-bootstrap` |
| Juan Carlos Postigo Cabana | Planificación, backend base y endpoints | `chore/backend-scaffold` |
| Mauricio Alejandro Farfán Huayta | Diseño y shell del frontend | `feat/frontend-shell` |
| Luis Antonio Chipana Chura | Frontend funcional — Inventario | `feat/inventory-ui` |

## Tareas

### Ronald Reynaldo Valdez Agüero

**Responsabilidad:** persistencia y base de datos.

**Rama:** `chore/database-bootstrap`

**Tareas:**

- Configurar PostgreSQL y el acceso desde el proyecto (`ARCH-06`).
- Traducir el modelo de dominio vigente a un esquema relacional preliminar (`ARCH-07`).
- Crear migraciones o un mecanismo equivalente (`ARCH-08`).
- Crear datos mínimos para desarrollo (`ARCH-09`).
- Documentar cómo levantar la base de datos.
- Mantener la coherencia del esquema con el [modelo de dominio](../../architecture/uml/README.md).

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

**Rama:** `chore/backend-scaffold`

**Tareas:**

- Crear `develop` desde `main` y resolver la rama remota `feature/mi_database` (`ARCH-05`).
- Inicializar o consolidar Node.js + TypeScript (`ARCH-02`).
- Preparar la estructura modular aplicando la arquitectura por capas (`ARCH-02`).
- Preparar el manejo de errores y la configuración (`ARCH-03`).
- Definir rutas preliminares y crear endpoints mock (`LOAN-01`).
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

**Endpoints mock preliminares:**

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

**Rama:** `feat/frontend-shell`

**Trabajo previo ya realizado:** diseño en Figma, creación del logo, inicio del frontend y layout inicial. Este sprint lo consolida dentro del repositorio.

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

**Responsabilidad:** frontend funcional del módulo Inventario, incluido su responsive.

**Rama:** `feat/inventory-ui`

**Área de trabajo:** `frontend/src/modules/inventory/`

**Tareas:**

- Crear la estructura del módulo Inventario (`INV-01`).
- Implementar el listado de recursos (`INV-02`).
- Implementar el detalle de un recurso con sus ejemplares (`INV-03`).
- Representar los estados de disponibilidad de los ejemplares (`INV-04`).
- Consumir los endpoints mock publicados por Juan Carlos.
- Adaptar las vistas del módulo a dispositivos móviles (`INV-05`).

**Coordinación:** evita modificar sin acuerdo previo el layout global, los estilos globales, el router global y los componentes de `shared/`. Si necesita un componente compartido, lo acuerda antes con Mauricio en lugar de crearlo dentro del módulo o modificar `shared/` por su cuenta.

**Commits esperados:**

- `v0.1.0 feat: crea vista inicial del inventario`
- `v0.1.0 feat: agrega detalle de recursos y ejemplares`
- `v0.1.0 feat: muestra disponibilidad de ejemplares`
- `v0.1.0 feat: integra inventario con API preliminar`
- `v0.1.0 style: adapta vistas de inventario a dispositivos móviles`

## Dependencias

| Dependencia | Quién la produce | Quién la consume | Cuándo se necesita |
| --- | --- | --- | --- |
| `develop` creada y rama histórica resuelta | Juan Carlos | Todo el equipo | Antes de crear cualquier rama de trabajo. |
| Contratos mock publicados | Juan Carlos | Luis | Temprano en el sprint. Luis no debe esperar a que el backend esté completo. |
| Layout y componentes comunes | Mauricio | Luis | Temprano en el sprint. Luis monta sus vistas dentro del layout existente. |
| Cliente HTTP común | Mauricio | Luis | Antes de integrar el inventario con la API preliminar. |
| Esquema de base de datos | Ronald | Sprint 2 | No bloquea a nadie en este sprint. |

**Trabajo paralelo:**

- Luis puede consumir endpoints mock sin esperar persistencia real.
- Ronald puede desarrollar PostgreSQL de forma independiente mientras el backend utiliza repositorios o mocks temporales.
- Mauricio y Luis trabajan sobre carpetas distintas del frontend.

**Dirección del diseño:** el esquema de base de datos se deriva del modelo de dominio. La base de datos **no** se convierte en la fuente desde la cual se diseña el dominio. Si el esquema revela un problema en el modelo, se corrige el modelo en [`docs/architecture/`](../../architecture/uml/README.md) y luego el esquema, no al revés.

## Criterios de aceptación

- PostgreSQL puede levantarse siguiendo la documentación del repositorio, desde cero y de forma reproducible.
- El esquema preliminar cubre los conceptos del modelo de dominio que los requisitos actuales justifican, sin tablas inventadas.
- El backend arranca y responde a los endpoints mock.
- La estructura modular por capas existe para los módulos previstos.
- Los contratos request/response preliminares están documentados y marcados como preliminares.
- El frontend arranca, aplica la identidad visual y muestra el layout y la navegación base.
- El módulo Inventario lista recursos, muestra el detalle de un recurso con sus ejemplares e indica su disponibilidad consumiendo los mocks.
- El layout general y las vistas de inventario funcionan en pantallas de escritorio y móviles.
- La documentación permite a un integrante nuevo levantar base de datos, backend y frontend.
- Este archivo refleja el estado real del sprint al cerrarlo.

## Definition of Done

Aplica la [Definition of Done del proyecto](../git-workflow.md#definition-of-done): alcance cumplido, compila, pasa lint y pruebas si existen, respeta arquitectura y convenciones, sin errores conocidos, commits con prefijo `v0.1.0`, documentación afectada actualizada, Pull Request creado y revisado, merge en `develop`.

## Pull Requests

Pendiente.

## Resultado del sprint

Pendiente.

## Versión resultante

Prevista: `v0.1.0`

Al completar e integrar correctamente: `develop` → `main`, y después el tag `v0.1.0`.
