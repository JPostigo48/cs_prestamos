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
Análisis y arquitectura compartidos
  → Base técnica y prototipos por área
    → Integración del primer flujo funcional
      → Reglas del dominio y consolidación
```

| Sprint | Nombre | Propósito | Versión objetivo | Prefijo de commit | Estado |
| --- | --- | --- | --- | --- | --- |
| 0 | Planificación y arquitectura | Analizar requisitos, acordar el dominio y la arquitectura y planificar el trabajo entre todos. | `v0.0.1` | `v0.0.1` | En curso; cierre formal pendiente |
| 1 | Base técnica y prototipos | Integrar PostgreSQL/Prisma, Nest e Inventario; consolidar diseño y base Vue. | `v0.1.0` | `v0.1.0` | En curso |
| 2 | Primer flujo funcional | Integrar autenticación, usuarios, inventario existente, préstamo y devolución sobre datos reales. | `v0.2.0` | `v0.2.0` | Planificado |
| 3 | Reglas de dominio y consolidación | Incorporar confianza, sanciones, reglas versionadas, incumplimientos y términos. | `v0.3.0` | `v0.3.0` | Planificado |

## Sprint 0 — Planificación y arquitectura

**Versión objetivo:** `v0.0.1` · [Detalle](sprints/sprint-00.md)

Análisis de requisitos y reglas, modelo de dominio, contextos DDD, arquitectura modular, estrategia Git, backlog y planificación de tareas realizados con participación del equipo. La documentación está avanzada; el sprint sigue abierto hasta registrar revisión, integración y cierre formal. El código, los esquemas físicos y los prototipos visuales se contabilizan en el Sprint 1, aunque parte del trabajo haya ocurrido en paralelo.

## Sprint 1 — Base técnica y prototipos

**Versión objetivo:** `v0.1.0` · [Detalle](sprints/sprint-01.md)

Avance integrado en `develop`: PostgreSQL mediante Docker Compose, contrato Prisma con modelos del dominio, migración y datos iniciales; backend Nest con carpetas modulares por capas y módulo Inventario con persistencia y endpoints propios. Juan Carlos organizó los demás módulos y sus contratos, pero sus casos de uso y endpoints siguen pendientes. Fuera de `develop`, Mauricio reporta en Figma diseños web y móvil para usuario, operador y administrador; Luis desarrolló un prototipo de login en `aporte-login`. Falta evaluar su adaptación al frontend Vue.js + TypeScript objetivo e integrar el frontend común. Estos avances no equivalen al cierre del sprint.

## Sprint 2 — Primer flujo funcional

**Versión objetivo:** `v0.2.0` · [Detalle](sprints/sprint-02.md)

Consolidación del frontend y del prototipo de login, integración de autenticación y registro de usuarios, aprovechamiento del Inventario ya conectado a Prisma y creación, consulta y devolución de préstamos con datos reales. La persistencia de los módulos aún incompletos se integra aquí; no se vuelve a planificar Inventario desde cero. Al terminar debe demostrarse el recorrido del inicio de sesión a la devolución.

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
