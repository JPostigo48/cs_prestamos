---
document: planning-index
version: v0.0.1
status: in_progress
owner: Juan Carlos Postigo Cabana
---

# Planificación del proyecto

Esta carpeta es la fuente de verdad de la planificación del sistema de gestión de préstamos universitarios: roadmap, backlog, estrategia de ramas y versiones, y el detalle de cada sprint. No documenta arquitectura ni requisitos; cuando hace falta ese detalle se enlaza [`docs/requirements/`](../requirements/README.md) o [`docs/architecture/`](../architecture/uml/README.md).

El contenido es Markdown versionado en el repositorio. Está escrito con encabezados predecibles, tablas simples y front matter consistente porque más adelante se consumirá desde el frontend (ver [`PLAN-01`](backlog.md)); esa visualización todavía no forma parte del alcance.

## Organización

| Documento | Contenido |
| --- | --- |
| [Roadmap](roadmap.md) | Progresión de sprints, versión objetivo de cada uno y funcionalidades futuras identificadas. |
| [Backlog](backlog.md) | Elementos de trabajo con identificador estable, módulo, responsable, prioridad, sprint, versión y estado. |
| [Flujo de trabajo con Git](git-workflow.md) | Ramas permanentes y temporales, convención de commits con prefijo de versión, Pull Requests, tags y control de conflictos. |
| [Sprint 0](sprints/sprint-00.md) | Planificación y arquitectura. `v0.0.1` |
| [Sprint 1](sprints/sprint-01.md) | Base técnica. `v0.1.0` |
| [Sprint 2](sprints/sprint-02.md) | Primer flujo funcional. `v0.2.0` |
| [Sprint 3](sprints/sprint-03.md) | Reglas de dominio y consolidación. `v0.3.0` |

## Equipo y responsabilidades principales

| Integrante | Responsabilidad principal | Área de trabajo habitual |
| --- | --- | --- |
| Juan Carlos Postigo Cabana | Planificación, arquitectura, documentación, backend base, contratos de API y coordinación entre módulos. | `docs/planning/`, `docs/architecture/`, `backend/src/` |
| Ronald Reynaldo Valdez Agüero | Base de datos y persistencia: PostgreSQL, esquema, migraciones, datos iniciales e integridad. | Esquema y migraciones, capa de infraestructura |
| Mauricio Alejandro Farfán Huayta | Diseño visual, identidad, layout principal, navegación y componentes compartidos del frontend. | `frontend/src/app/`, `router/`, `layouts/`, `shared/` |
| Luis Antonio Chipana Chura | Frontend funcional por módulos, incluido el responsive de sus propias vistas. | `frontend/src/modules/` |

Cada responsable frontend implementa el comportamiento responsive de lo que desarrolla. El trabajo no se divide en «escritorio» y «responsive»: se divide por módulos. El detalle de esta separación y de la coordinación sobre archivos globales está en [control de conflictos](git-workflow.md#control-de-conflictos).

## Estado de la planificación

| Sprint | Nombre | Estado | Versión objetivo |
| --- | --- | --- | --- |
| 0 | Planificación y arquitectura | En curso | `v0.0.1` |
| 1 | Base técnica | Planificado | `v0.1.0` |
| 2 | Primer flujo funcional | Planificado | `v0.2.0` |
| 3 | Reglas de dominio y consolidación | Planificado | `v0.3.0` |

Sprint 0 no es un sprint de desarrollo: recoge el análisis y la planificación previos a la implementación. Se mantiene como sprint porque ese trabajo existe, tiene entregables verificables en el repositorio y condiciona los sprints siguientes.

## Convenciones de estos documentos

- Cada archivo de sprint comienza con front matter que incluye `sprint`, `name`, `status`, `version` y `commit_prefix`. `version` y `commit_prefix` coinciden siempre.
- `status` toma uno de tres valores: `planned`, `in_progress` o `completed`.
- Los identificadores del backlog (`INV-01`, `LOAN-03`, …) son referencias estables. Se evita renumerar, igual que con `RF-xx`, `RNF-xx` y `RN-xx` en requisitos.
- Los commits esperados que figuran en cada sprint son planificación orientativa, no una lista cerrada ni un commit obligatorio por línea.
- Las secciones «Pull Requests», «Resultado del sprint» y «Versión resultante» se rellenan durante y al cerrar el sprint, no al planificarlo.

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
