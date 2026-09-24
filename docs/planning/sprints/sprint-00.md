---
sprint: 0
name: Planificación y arquitectura
status: in_progress
version: v0.0.1
commit_prefix: v0.0.1
---

# Sprint 0 — Planificación y arquitectura

Sprint 0 no es un sprint de desarrollo. No produce código ejecutable. Existe porque el trabajo de análisis, modelado y planificación realizado antes de implementar es real, está versionado en el repositorio y condiciona todo lo que sigue.

## Objetivo

Establecer entre todos una base común antes de implementar: requisitos, modelo de dominio, arquitectura, forma de trabajo con Git y planificación de tareas para los sprints siguientes.

Responsable de consolidar la planificación y la documentación: **Juan Carlos Postigo Cabana**. El análisis y las decisiones de alcance se trabajan con aportes del equipo.

## Alcance

- Levantamiento y organización de requerimientos funcionales y no funcionales.
- Reglas de negocio, modelo de confianza y gestión de términos y condiciones.
- Modelo de dominio: contextos delimitados, agregados, entidades, objetos de valor e invariantes.
- UML conceptual y vistas DDD en Structurizr.
- Arquitectura modular por capas del backend y definición de módulos.
- Estrategia de ramas, convención de commits y versionado.
- Backlog inicial y planificación de los sprints 1 a 3.
- Criterios de Definition of Done.

## Fuera de alcance

- Cualquier código de backend o frontend.
- Esquema físico de PostgreSQL, migraciones y datos iniciales.
- Contratos definitivos de la API.
- Decisiones marcadas como pendientes en los documentos de requisitos y arquitectura. Se registran como pendientes, no se resuelven aquí.
- Implementación del módulo de visualización de planificación en el frontend.

## Entregables

| Entregable | Ubicación | Estado |
| --- | --- | --- |
| Requisitos funcionales | [`docs/requirements/functional.md`](../../requirements/functional.md) | Terminado |
| Requisitos no funcionales | [`docs/requirements/non-functional.md`](../../requirements/non-functional.md) | Terminado |
| Reglas de negocio | [`docs/requirements/business-rules.md`](../../requirements/business-rules.md) | Terminado |
| Modelo de confianza | [`docs/requirements/trust-model.md`](../../requirements/trust-model.md) | Terminado |
| Términos y condiciones | [`docs/requirements/terms-and-conditions.md`](../../requirements/terms-and-conditions.md) | Terminado |
| Modelo de dominio UML | [`docs/architecture/uml/modelo-dominio.puml`](../../architecture/uml/modelo-dominio.puml) | Terminado |
| Arquitectura modular por capas | [`docs/architecture/uml/arquitectura-modular.puml`](../../architecture/uml/arquitectura-modular.puml) | Terminado |
| Vistas DDD en Structurizr | [`docs/architecture/structurizr/workspace.dsl`](../../architecture/structurizr/workspace.dsl) | Terminado, con ajustes pendientes (`DOC-07`) |
| Estrategia Git y de versionado | [`docs/planning/git-workflow.md`](../git-workflow.md) | Terminado |
| Roadmap | [`docs/planning/roadmap.md`](../roadmap.md) | Terminado |
| Backlog inicial | [`docs/planning/backlog.md`](../backlog.md) | Terminado |
| Planificación de sprints 1 a 3 | [`docs/planning/sprints/`](.) | Terminado |
| Definition of Done | [`docs/planning/git-workflow.md`](../git-workflow.md#definition-of-done) | Terminado |

## Versión objetivo

`v0.0.1` — todos los commits del sprint comienzan con este prefijo.

## Integrantes y responsabilidades

| Integrante | Participación en este sprint |
| --- | --- |
| Juan Carlos Postigo Cabana | Consolida requisitos, arquitectura, documentación, backlog y dimensionamiento de los sprints. |
| Ronald Reynaldo Valdez Agüero | Aporta la perspectiva de datos y persistencia al análisis del dominio. Su esquema y configuración técnica se registran en el Sprint 1. |
| Mauricio Alejandro Farfán Huayta | Aporta flujos y necesidades de usuario al análisis. Sus maquetas de Figma se registran como avance de diseño del Sprint 1, fuera del repositorio. |
| Luis Antonio Chipana Chura | Aporta la perspectiva de la interfaz y los flujos funcionales. Su prototipo de login en `aporte-login` se registra en el Sprint 1. |

## Tareas

### Juan Carlos Postigo Cabana

**Responsabilidad:** análisis, modelado, arquitectura, planificación y documentación.

**Rama:** `docs/project-planning`

**Tareas:**

- Levantar y organizar los requisitos funcionales y no funcionales (`DOC-01`).
- Documentar reglas de negocio, modelo de confianza y términos y condiciones (`DOC-02`).
- Modelar el dominio en UML con agregados, entidades, objetos de valor e invariantes (`DOC-03`).
- Definir contextos delimitados y vistas internas en Structurizr (`DOC-04`).
- Documentar la arquitectura modular por capas del backend (`DOC-05`).
- Definir la estrategia de ramas, commits y versionado (`ARCH-01`).
- Crear el roadmap, el backlog inicial y la planificación de los sprints 1 a 3.
- Registrar las decisiones que siguen pendientes, sin presentarlas como cerradas.

**Commits esperados:**

- `v0.0.1 docs: agrega planificación inicial del proyecto`
- `v0.0.1 docs: documenta estrategia de ramas y versiones`
- `v0.0.1 docs: agrega roadmap y backlog inicial`
- `v0.0.1 docs: documenta arquitectura modular del proyecto`
- `v0.0.1 docs: planifica los primeros sprints de desarrollo`

## Módulos definidos

Módulos considerados a partir de la documentación vigente. Los nombres entre paréntesis corresponden a las carpetas previstas en `backend/src/modules/`.

| Módulo | Clasificación DDD | Estado del límite |
| --- | --- | --- |
| Autenticación (`auth`) | Genérico de apoyo | Definido. Mecanismo de credenciales pendiente. |
| Usuarios (`users`) | Soporte | Definido. |
| Inventario (`inventory`) | Soporte | Definido. |
| Préstamos (`loans`) | **Central** | Definido. |
| Reglas y Términos | Soporte | **Límite DDD por validar.** El UML lo trata como «área de dominio · límite por validar». |
| Confianza (`trust`) | Soporte | Separado como contexto en el UML y en el modelo de confianza. Structurizr todavía lo marca como pendiente de consolidación con Usuarios (ver `DOC-07`). |

**Shared/Common** no es un módulo de negocio ni un contexto delimitado. Si se necesita durante la implementación, se limitará a tipos base, errores comunes, utilidades sin significado de negocio y configuración técnica compartida. Los identificadores y objetos de valor específicos, como `UsuarioId`, `PrestamoId` o `PorcentajeConfianza`, permanecen en sus módulos propietarios.

**Apelaciones** no constituye un contexto delimitado independiente: su ciclo de vida depende de una sanción y permanece dentro de Confianza.

## Dependencias

Sprint 0 no depende de ningún otro sprint. Los sprints 1, 2 y 3 dependen de sus entregables:

El equipo avanzó tareas técnicas y visuales del Sprint 1 mientras se terminaba la documentación. Esta superposición cronológica no cambia el alcance de cada sprint: el Sprint 0 registra planificación; el Sprint 1 registra esos artefactos y prototipos.

- El esquema de base de datos del Sprint 1 se deriva del modelo de dominio producido aquí.
- La estructura modular del backend del Sprint 1 sigue la arquitectura modular por capas definida aquí.
- El reparto de trabajo y el control de conflictos de todos los sprints se apoyan en la estrategia Git definida aquí.

## Criterios de aceptación

- Los requisitos, reglas de negocio, modelo de confianza y términos están documentados y son coherentes entre sí.
- El modelo de dominio UML está alineado con los requisitos vigentes.
- Los contextos delimitados están identificados, con su clasificación estratégica y el estado de cada límite.
- La arquitectura modular por capas permite repartir trabajo por módulo sin ambigüedad sobre quién toca qué.
- La estrategia de ramas, commits y versionado está documentada y es aplicable desde el primer commit del Sprint 1.
- El backlog cubre los requisitos vigentes con identificadores estables.
- Los sprints 1 a 3 tienen objetivo, alcance, responsables, ramas, dependencias y criterios de aceptación.
- Las decisiones pendientes figuran como pendientes y no se presentan como definitivas.

## Definition of Done

Aplica la [Definition of Done para tareas documentales](../git-workflow.md#tarea-puramente-documental):

- contenido terminado;
- coherente con los documentos vigentes;
- Markdown válido;
- versión correcta en los commits;
- Pull Request revisado;
- merge en `develop`.

> **Situación al planificar el sprint:** `develop` todavía no existía y su creación quedó asignada a `ARCH-05`. Esa tarea ya fue completada durante el Sprint 1; el flujo documentado se aplica ahora con `develop` como rama de integración.

## Decisiones pendientes registradas

Estas decisiones quedan abiertas al cerrar el sprint. Ningún sprint posterior debe asumirlas como resueltas:

| Decisión | Documento de origen |
| --- | --- |
| Porcentaje inicial de confianza | [Modelo de confianza](../../requirements/trust-model.md#definiciones-pendientes) |
| Nombres y umbrales de los cuatro niveles de confianza | [Modelo de confianza](../../requirements/trust-model.md#definiciones-pendientes) |
| Restricciones concretas por nivel de confianza | [Modelo de confianza](../../requirements/trust-model.md#definiciones-pendientes) |
| Mecanismos para aumentar la confianza | [Modelo de confianza](../../requirements/trust-model.md#definiciones-pendientes) |
| Efecto de una apelación aceptada sobre el porcentaje de confianza | [Modelo de confianza](../../requirements/trust-model.md#apelaciones) |
| Límite de préstamos activos simultáneos para estudiantes | [RF-27](../../requirements/functional.md#gestión-de-préstamos) |
| Procedimiento de verificación de la vinculación con la EPCC | [UML](../../architecture/uml/README.md#decisiones-deliberadamente-pendientes) |
| Credenciales y proveedor de autenticación | [UML](../../architecture/uml/README.md#decisiones-deliberadamente-pendientes) |
| Representación y ejecución de la consecuencia de una regla | [Términos y condiciones](../../requirements/terms-and-conditions.md#gestión-y-vigencia) |
| Composición de una versión de términos | [Términos y condiciones](../../requirements/terms-and-conditions.md#historial-e-incumplimientos) |
| Límite DDD de Reglas y Términos | [UML](../../architecture/uml/README.md#límites-y-agregados) |
| Estrategia transaccional y esquema de base de datos | [UML](../../architecture/uml/README.md#decisiones-deliberadamente-pendientes) |

## Seguimiento de inconsistencias entre documentos

Se registran aquí y se corrigen en su documento de origen, no en la planificación. Las resueltas se conservan para mantener la trazabilidad.

| # | Inconsistencia | Documentos implicados | Seguimiento | Estado |
| --- | --- | --- | --- | --- |
| 1 | Structurizr situaba `porcentajeConfianza`, `nivelConfianza` y `sanciones` dentro del agregado Usuario, mientras el UML y el modelo de confianza los situaban en Confianza. | `workspace.dsl` · `modelo-dominio.puml` · `trust-model.md` | `DOC-07` | Resuelta |
| 2 | Structurizr definía `EstadoSancion` sin el estado `ABSUELTA`. | `workspace.dsl` · `modelo-dominio.puml` · `functional.md` | `DOC-07` | Resuelta |
| 3 | Structurizr no modelaba `Apelacion` ni su estado dentro de Confianza. | `workspace.dsl` · `modelo-dominio.puml` · `functional.md` | `DOC-07` | Resuelta |
| 4 | Structurizr mantenía pendiente la separación de Confianza respecto de Usuarios. | `workspace.dsl` · `trust-model.md` · `modelo-dominio.puml` | `DOC-07` | Resuelta |
| 5 | RF-17 menciona solo préstamos **activos**; el UML y la arquitectura modular exigen que no se superpongan intervalos de préstamos activos **o planificados**. | `functional.md` · `modelo-dominio.puml` · `arquitectura-modular.puml` | `DOC-08` | Pendiente |
| 6 | RF-19 no distingue el alta de un préstamo planificado de su inicio efectivo, por lo que no queda definido cuándo un ejemplar planificado pasa a `PRESTADO`. | `functional.md` · `modelo-dominio.puml` | `DOC-08` | Pendiente |
| 7 | El estado `PLANIFICADO` y el intervalo `fechaInicio`–`fechaFin` existen en el UML y en Structurizr, pero ningún requisito funcional describe la planificación de un préstamo futuro. | `functional.md` · `modelo-dominio.puml` | `DOC-08` | Pendiente |
| 8 | La duración de restricción por sanción está definida únicamente para estudiantes (`duracionRestriccionEstudiante`, RN-21, RN-23). No hay definición equivalente para docentes ni administrativos. | `terms-and-conditions.md` · `business-rules.md` · `modelo-dominio.puml` | Decisión del equipo | Pendiente |
| 9 | El árbol del `README.md` raíz no reflejaba los archivos y carpetas ya integrados. | `README.md` | Actualización documental | Resuelta |

## Pull Requests

Pendiente.

## Resultado del sprint

Documentación y planificación avanzadas con aportes de todo el equipo. Pendiente registrar revisión, Pull Request e integración antes de marcar el sprint como `completed`.

## Versión resultante

Prevista: `v0.0.1`

El tag `v0.0.1` es opcional. Puede crearse si el equipo considera que la planificación inicial ya constituye un estado estable del repositorio.
