---
document: roadmap
version: v0.0.1
status: in_progress
owner: Juan Carlos Postigo Cabana
---

# Roadmap

Progresión prevista del proyecto. Cada sprint tiene una versión objetivo; todos los commits de un sprint comienzan con esa versión, según la [convención de commits](git-workflow.md#convención-de-commits).

## Progresión

```text
Planificación
  → Base técnica
    → Flujo funcional
      → Reglas del dominio
```

| Sprint | Nombre | Propósito | Versión objetivo | Prefijo de commit | Estado |
| --- | --- | --- | --- | --- | --- |
| 0 | Planificación y arquitectura | Establecer requisitos, dominio, arquitectura y forma de trabajo antes de implementar. | `v0.0.1` | `v0.0.1` | En curso |
| 1 | Base técnica | Dejar PostgreSQL, backend y frontend preparados para trabajar en paralelo. | `v0.1.0` | `v0.1.0` | Planificado |
| 2 | Primer flujo funcional | Pasar de mocks a un flujo real: autenticación, inventario, préstamo y devolución. | `v0.2.0` | `v0.2.0` | Planificado |
| 3 | Reglas de dominio y consolidación | Incorporar confianza, sanciones, reglas versionadas, incumplimientos y términos. | `v0.3.0` | `v0.3.0` | Planificado |

## Sprint 0 — Planificación y arquitectura

**Versión objetivo:** `v0.0.1` · [Detalle](sprints/sprint-00.md)

Levantamiento de requisitos, reglas de negocio, modelo de confianza, términos y condiciones, modelo de dominio UML, contextos delimitados en Structurizr, arquitectura modular por capas, estrategia Git y de versionado, backlog y planificación de los tres sprints siguientes. No produce código ejecutable.

## Sprint 1 — Base técnica

**Versión objetivo:** `v0.1.0` · [Detalle](sprints/sprint-01.md)

PostgreSQL reproducible y esquema preliminar derivado del modelo de dominio; backend Node.js + TypeScript con estructura modular por capas y endpoints mock documentados; frontend Vue.js + TypeScript con layout, navegación, sistema visual y primera interfaz de Inventario consumiendo los mocks. El objetivo es habilitar trabajo paralelo, no completar lógica de dominio.

## Sprint 2 — Primer flujo funcional

**Versión objetivo:** `v0.2.0` · [Detalle](sprints/sprint-02.md)

Persistencia real conectada a los repositorios; solicitud y aprobación de registro de usuarios; autenticación con interfaz propia; creación, consulta y devolución de préstamos sobre datos reales. Al terminar debe poder demostrarse el recorrido completo desde el inicio de sesión hasta la devolución de un ejemplar.

## Sprint 3 — Reglas de dominio y consolidación

**Versión objetivo:** `v0.3.0` · [Detalle](sprints/sprint-03.md)

Préstamos planificados con validación de superposición de intervalos, perfil de confianza, sanciones, reglas versionadas, incumplimientos con penalización histórica y versiones de términos con su aceptación. Es el sprint que separa el sistema de un CRUD de préstamos.

## Funcionalidades futuras identificadas

Estas funcionalidades están reconocidas pero no planificadas dentro de los sprints 0 a 3. No tienen versión asignada.

### Módulo de visualización de planificación

**Responsable principal:** Juan Carlos Postigo Cabana · **Backlog:** `PLAN-01` a `PLAN-04`

Sección del frontend que muestre, dentro de la propia aplicación, la información que hoy vive en [`docs/planning/`](README.md): roadmap, sprints con su estado y versión objetivo, responsables, tareas, ramas, commits, Pull Requests, tags, arquitectura relacionada y progreso general.

La fuente de verdad seguirá siendo Markdown versionado. El módulo leerá esos archivos y su front matter; no sustituye a la documentación ni introduce una base de datos de planificación. **No se implementa durante los sprints actuales.**

### Apelaciones en la interfaz

**Backlog:** `TRUST-08`

El dominio ya modela apelaciones sobre sanciones activas (RF-52 a RF-56). Sprint 3 incorpora confianza y sanciones; el flujo completo de apelación y resolución por un administrador queda identificado como continuación natural, sin versión asignada todavía.

### Verificación de vinculación institucional

**Backlog:** `USR-06`

RF-03 exige registrar información para verificar la vinculación vigente con la EPCC, pero el procedimiento de verificación sigue [pendiente de definición](../architecture/uml/README.md#decisiones-deliberadamente-pendientes). Sprint 2 registra la evidencia y permite aprobar o rechazar manualmente; el mecanismo de verificación se planificará cuando esté acordado.

## Versionado

| Versión | Origen | Contenido |
| --- | --- | --- |
| `v0.0.1` | Cierre de Sprint 0 | Documentación de requisitos, arquitectura y planificación. Tag opcional. |
| `v0.1.0` | Cierre de Sprint 1 | Base técnica ejecutable con mocks. |
| `v0.2.0` | Cierre de Sprint 2 | Primer flujo funcional integrado. |
| `v0.3.0` | Cierre de Sprint 3 | Reglas de dominio, confianza, sanciones y versionado de reglas y términos. |
| `v0.x.y` | Corrección posterior | Incrementos PATCH sobre una versión ya cerrada. |
| `v1.0.0` | Por definir | Primera versión considerada completa y estable. Todavía no planificada. |

El detalle del flujo `rama temporal → develop → main → tag` está en [flujo de trabajo con Git](git-workflow.md#versionado-y-tags).
