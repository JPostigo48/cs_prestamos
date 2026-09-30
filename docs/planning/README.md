---
document: planning-index
version: v0.0.1
status: in_progress
owner: Juan Carlos Postigo Cabana
---

# Planificación del proyecto

Esta carpeta es la fuente de verdad de la planificación del sistema de gestión de préstamos universitarios: roadmap, backlog, estrategia de ramas y versiones, y el detalle de cada sprint. No documenta arquitectura ni requisitos; cuando hace falta ese detalle se enlaza [`docs/requirements/`](../requirements/README.md) o [`docs/architecture/`](../architecture/uml/README.md).

El contenido es Markdown versionado en el repositorio. Está escrito con encabezados predecibles, tablas simples y front matter consistente para servir como fuente del **Project Showcase**, una línea de trabajo frontend planificada en paralelo durante los Sprints 1 a 3. Ninguna de sus vistas se considera implementada por estar planificada.

## Organización

| Documento | Contenido |
| --- | --- |
| [Roadmap](roadmap.md) | Progresión de sprints, línea paralela Project Showcase y funcionalidades futuras identificadas. |
| [Backlog](backlog.md) | Elementos de trabajo con identificador estable, módulo, responsable, prioridad, sprint, versión y estado. |
| [Flujo de trabajo con Git](git-workflow.md) | Ramas permanentes y temporales, convención de commits con prefijo de versión, Pull Requests, tags y control de conflictos. |
| [Seguimiento semanal](progress/README.md) | Formato de registro semanal por sprint e integrante, sin inventar avances ni medir productividad. |
| [Sprint 0](sprints/sprint-00.md) | Planificación y arquitectura. `v0.0.1` |
| [Sprint 1](sprints/sprint-01.md) | Base técnica y prototipos. `v0.1.0` |
| [Sprint 2](sprints/sprint-02.md) | Primer flujo funcional. `v0.2.0` |
| [Sprint 3](sprints/sprint-03.md) | Reglas de dominio y consolidación. `v0.3.0` |

## Equipo y responsabilidades principales

| Integrante | Responsabilidad principal | Área de trabajo habitual |
| --- | --- | --- |
| Juan Carlos Postigo Cabana | Planificación, arquitectura, documentación, backend base, contratos de API, coordinación entre módulos y Project Showcase. | `docs/planning/`, `docs/architecture/`, `backend/src/`, futuro módulo frontend `project-showcase` |
| Ronald Reynaldo Valdez Agüero | Base de datos y persistencia: PostgreSQL, esquema, migraciones, datos iniciales e integridad. | Esquema y migraciones, capa de infraestructura |
| Mauricio Alejandro Farfán Huayta | Diseño visual, identidad, layout principal, navegación y componentes compartidos del frontend. | `frontend/src/app/`, `router/`, `layouts/`, `shared/` |
| Luis Antonio Chipana Chura | Frontend funcional por módulos, incluido el responsive de sus propias vistas. | `frontend/src/modules/` |

Cada responsable frontend implementa el comportamiento responsive de lo que desarrolla. El trabajo no se divide en «escritorio» y «responsive»: se divide por módulos. El detalle de esta separación y de la coordinación sobre archivos globales está en [control de conflictos](git-workflow.md#control-de-conflictos).

Project Showcase es una sección de documentación del proyecto, no un módulo del negocio. Juan Carlos se encarga de su visualización frontend sin asumir el frontend funcional de préstamos asignado a Mauricio y Luis. Su rama de código prevista es `feat/project-showcase`, creada desde `develop` y destinada a un Pull Request hacia `develop`; `docs/project-planning` queda para la documentación. Las rutas y entregas por sprint están en el [roadmap](roadmap.md).

## Estado de la planificación

| Sprint | Nombre | Estado | Versión objetivo |
| --- | --- | --- | --- |
| 0 | Planificación y arquitectura | En curso | `v0.0.1` |
| 1 | Base técnica y prototipos | En curso | `v0.1.0` |
| 2 | Primer flujo funcional | Planificado | `v0.2.0` |
| 3 | Reglas de dominio y consolidación | Planificado | `v0.3.0` |

Sprint 0 no es un sprint de desarrollo: recoge el análisis y la planificación previos a la implementación. Se mantiene como sprint porque ese trabajo existe, tiene entregables verificables en el repositorio y condiciona los sprints siguientes.

## Convenciones de estos documentos

- Cada archivo de sprint comienza con front matter que incluye `sprint`, `name`, `status`, `version` y `commit_prefix`. `version` y `commit_prefix` coinciden siempre.
- `status` toma uno de tres valores: `planned`, `in_progress` o `completed`.
- Los identificadores del backlog (`INV-01`, `LOAN-03`, …) son referencias estables. Se evita renumerar, igual que con `RF-xx`, `RNF-xx` y `RN-xx` en requisitos.
- Los commits esperados que figuran en cada sprint son planificación orientativa, no una lista cerrada ni un commit obligatorio por línea.
- Las secciones «Pull Requests», «Resultado del sprint» y «Versión resultante» se rellenan durante y al cerrar el sprint, no al planificarlo.

## Documentación y visualización

`/project` y sus subrutas mostrarán planificación, arquitectura, requisitos, API, modelos, equipo y flujo Git según las etapas del roadmap. Los Markdown de `docs/planning/`, incluidos los [avances semanales](progress/README.md), siguen siendo la fuente de verdad de planificación. Los diagramas `.puml` y `workspace.dsl`, el código backend y la especificación OpenAPI generada conservan sus respectivas fuentes canónicas.

Se planifica transformar esas fuentes, sin copiarlas manualmente a componentes Vue, mediante un generador futuro en `scripts/generate-project-showcase.mjs`. La salida prevista es `frontend/public/generated/project/`: `planning.json`, `backlog.json`, `team-progress.json`, `openapi.json` y `diagrams/*.svg`. Son artefactos derivados, no documentos editables como fuente primaria. Los SVG de PlantUML y Structurizr se generan fuera del tiempo de ejecución del frontend; antes de automatizar Structurizr debe quedar documentado su mecanismo de exportación. La vista de API será propia y consumirá OpenAPI, no Swagger UI.

Como orientación, el futuro `frontend/src/modules/project-showcase/` podrá organizar páginas, componentes, acceso a los datos derivados, tipos y rutas. No se fija esa estructura hasta revisar e integrar la base real del frontend Vue.js + TypeScript y coordinar el router compartido con Mauricio.

## Actualización durante el ciclo del sprint

La planificación se mantiene viva. El objetivo es poder comparar **planificado** contra **realizado**.

| Momento | `status` | Qué se registra |
| --- | --- | --- |
| Antes de iniciar | `planned` | Objetivo, alcance, tareas, responsables, ramas, versión, commits esperados y dependencias. |
| Al iniciar | `in_progress` | Fecha o hito de inicio si se acuerda; ajustes de alcance previos al arranque. |
| Durante el sprint | `in_progress` | Cambios relevantes de alcance, responsable, rama o dependencia; tareas bloqueadas o trasladadas. |
| Al cerrar | `completed` | Tareas completadas y no completadas, tareas trasladadas, Pull Requests utilizados, resultado, versión publicada y tag creado. |

Mantener actualizados estos archivos durante el sprint es responsabilidad de Juan Carlos Postigo Cabana, con la información que aporte cada integrante sobre su propia área.

## Relación con el resto de la documentación

- [`docs/requirements/`](../requirements/README.md) define qué debe hacer el sistema. La planificación no redefine requisitos: los referencia por identificador.
- [`docs/architecture/uml/`](../architecture/uml/README.md) contiene el modelo de dominio conceptual y la vista de arquitectura modular por capas que orienta el reparto de trabajo por módulo.
- [`docs/architecture/structurizr/`](../architecture/structurizr/README.md) contiene las vistas estratégicas de contextos delimitados.

Cuando la planificación y la arquitectura discrepen, la arquitectura y los requisitos son la fuente de verdad; la discrepancia se registra en el sprint correspondiente y se corrige en su documento de origen.
