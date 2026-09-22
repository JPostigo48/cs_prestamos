---
sprint: 2
name: Primer flujo funcional
status: planned
version: v0.2.0
commit_prefix: v0.2.0
---

# Sprint 2 — Primer flujo funcional

## Objetivo

Pasar de esqueletos y mocks a un flujo funcional integrado: un usuario autenticado consulta recursos, crea un préstamo que se almacena realmente y registra su devolución.

A partir de este sprint se evita una división estrictamente por tecnología. Cada integrante conserva su responsabilidad principal, pero el trabajo se organiza por flujo funcional.

## Alcance

- Esquema PostgreSQL consolidado y repositorios integrados con persistencia real.
- Solicitud de registro de usuarios con evidencia de vinculación, tipo de usuario y aprobación o rechazo.
- Consulta de habilitación del usuario para realizar préstamos.
- Autenticación de usuarios registrados, con interfaz propia y navegación según sesión.
- Registro de recursos, categorías y ejemplares, con disponibilidad derivada.
- Creación de préstamos, consulta de préstamos activos e historial, y registro de devoluciones.
- Interfaz de inventario conectada a la API real y primeras vistas de préstamos.

## Fuera de alcance

- Préstamos planificados y validación de superposición de intervalos: Sprint 3.
- Perfil de confianza, niveles, sanciones y apelaciones: Sprint 3.
- Reglas versionadas, incumplimientos y términos: Sprint 3.
- Identificación de préstamos vencidos (RF-25): Sprint 3.
- Restricciones de préstamo por tipo de usuario o nivel de confianza: Sprint 3.
- Cualquier valor todavía pendiente del modelo de confianza.

En este sprint, la habilitación del usuario para prestar se resuelve con lo que ya está definido: solicitud aprobada y vinculación vigente. La habilitación no incorpora todavía confianza ni sanciones; esa composición llega en el Sprint 3 y se documentará como un cambio de la regla, no como una regla nueva.

## Entregables

Debe poder demostrarse el recorrido completo:

1. usuario autenticado;
2. consulta de recursos;
3. consulta de ejemplares;
4. disponibilidad;
5. creación de préstamo;
6. almacenamiento real;
7. consulta de préstamo;
8. devolución.

## Versión objetivo

`v0.2.0` — todos los commits del sprint comienzan con este prefijo.

## Integrantes y responsabilidades

| Integrante | Responsabilidad en el sprint | Ramas |
| --- | --- | --- |
| Ronald Reynaldo Valdez Agüero | Persistencia e integración de datos | `feat/persistence-integration` |
| Juan Carlos Postigo Cabana | Backend, endpoints y coordinación | `feat/users-registration`, `feat/loan-flow` |
| Mauricio Alejandro Farfán Huayta | Frontend general y autenticación | `feat/auth-ui` |
| Luis Antonio Chipana Chura | Frontend de inventario y préstamos | `feat/inventory-management-ui`, `feat/loan-ui` |

## Tareas

### Ronald Reynaldo Valdez Agüero

**Responsabilidad:** persistencia e integración de datos.

**Rama:** `feat/persistence-integration`

**Tareas:**

- Consolidar el esquema PostgreSQL a partir del preliminar del Sprint 1.
- Integrar los repositorios con persistencia real (`ARCH-12`).
- Apoyar la persistencia de los módulos Usuarios, Inventario y Préstamos (`USR-04`, `INV-09`, `LOAN-08`).
- Revisar las restricciones relacionales, en particular la que impide que un ejemplar tenga dos préstamos activos simultáneos (RNF-04).
- Mantener las migraciones.
- Preparar datos de desarrollo suficientes para demostrar el flujo completo.

**Commits esperados:**

- `v0.2.0 feat: integra persistencia real de usuarios`
- `v0.2.0 feat: integra persistencia de inventario`
- `v0.2.0 feat: integra persistencia de préstamos`
- `v0.2.0 chore: actualiza migraciones del modelo`

### Juan Carlos Postigo Cabana

**Responsabilidad:** backend, contratos de la API y coordinación entre módulos.

**Ramas:** `feat/users-registration` y `feat/loan-flow`. No es necesario trabajar ambas simultáneamente; conviene cerrar la de usuarios antes de abrir la de préstamos, porque la habilitación del usuario es una precondición del préstamo.

**Tareas — Usuarios:**

- Implementar la solicitud de registro con tipo de usuario e identificador institucional (`USR-01`, RF-01, RF-02).
- Registrar la evidencia de vinculación asociada a la solicitud (`USR-02`, RF-03).
- Implementar la aprobación y el rechazo de solicitudes (`USR-03`, RF-04).
- Exponer la consulta de habilitación para préstamos (`USR-05`, RF-07).

**Tareas — Préstamos:**

- Implementar la creación de un préstamo sobre un ejemplar disponible (`LOAN-02`, RF-15).
- Verificar la habilitación del usuario antes de prestar (`LOAN-03`, RF-16).
- Aplicar el plazo de la categoría al fijar `fechaFin` (`LOAN-04`, RF-18).
- Cambiar el ejemplar a `PRESTADO` de forma consistente con el alta del préstamo (`LOAN-05`, RF-19).
- Implementar la consulta de préstamos activos e historial por usuario (`LOAN-06`, RF-23, RF-24).
- Implementar el registro de devoluciones y la liberación del ejemplar (`LOAN-07`, RF-20, RF-21).
- Definir la estrategia transaccional para préstamos concurrentes (`ARCH-11`, RNF-04, RNF-09).

**Tareas — Inventario y coordinación:**

- Implementar el registro de recursos, categorías y ejemplares (`INV-06`, `INV-07`, `INV-12`).
- Derivar la disponibilidad del recurso de sus ejemplares (`INV-08`, RF-13).
- Registrar observaciones sobre el estado de un ejemplar (`INV-11`, RF-14, RF-22).
- Decidir el mecanismo de credenciales y autenticación (`AUTH-01`) e implementar el endpoint correspondiente (`AUTH-02`).
- Consolidar los contratos de la API y sustituir los mocks del Sprint 1.
- Revisar la trazabilidad de RF-17 y RF-19 ante préstamos planificados (`DOC-08`), antes de que el Sprint 3 implemente la validación de superposición.
- Mantener actualizado este archivo durante el sprint (`PLAN-05`).

**Modelo de préstamo utilizado:** `usuarioId`, `ejemplarId`, `fechaInicio`, `fechaFin`, estado. Los estados son `PLANIFICADO`, `ACTIVO` y `FINALIZADO`. El Sprint 2 implementa el ciclo `ACTIVO` → `FINALIZADO`; `PLANIFICADO` forma parte del modelo desde ahora, pero su flujo se completa en el Sprint 3.

**Commits esperados:**

- `v0.2.0 feat: implementa solicitud de registro de usuario`
- `v0.2.0 feat: agrega aprobación de solicitudes de registro`
- `v0.2.0 feat: implementa creación de préstamos`
- `v0.2.0 feat: implementa consulta de préstamos`
- `v0.2.0 feat: implementa registro de devoluciones`
- `v0.2.0 docs: actualiza planificación del Sprint 2`

### Mauricio Alejandro Farfán Huayta

**Responsabilidad:** frontend general y autenticación.

**Rama:** `feat/auth-ui`

**Tareas:**

- Crear la interfaz de inicio de sesión (`AUTH-04`).
- Integrar la autenticación con la API (`AUTH-05`).
- Implementar la navegación autenticada y la protección visual de rutas.
- Mantener las vistas globales y la consistencia con Figma y el sistema visual.
- Adaptar la autenticación a dispositivos móviles.

La protección de rutas en el frontend es visual: no sustituye la restricción de permisos del backend (RNF-05), que corresponde a `AUTH-06` en el Sprint 3.

**Commits esperados:**

- `v0.2.0 feat: crea interfaz de autenticación`
- `v0.2.0 feat: integra autenticación con la API`
- `v0.2.0 feat: agrega navegación según sesión`
- `v0.2.0 style: adapta autenticación a dispositivos móviles`

### Luis Antonio Chipana Chura

**Responsabilidad:** frontend de inventario y préstamos, incluido su responsive.

**Ramas:** `feat/inventory-management-ui` y, posteriormente, `feat/loan-ui`.

**Tareas:**

- Conectar el módulo Inventario con la API real (`INV-10`).
- Completar la gestión visual de recursos y ejemplares.
- Crear las vistas iniciales de préstamos dentro de `frontend/src/modules/loans/`.
- Implementar el formulario de préstamo (`LOAN-09`).
- Implementar la consulta de préstamos y el registro visual de devoluciones (`LOAN-10`).
- Adaptar el módulo de préstamos a dispositivos móviles (`LOAN-11`).

**Coordinación:** la navegación hacia el nuevo módulo de préstamos toca el router global, que mantiene Mauricio. Se acuerda antes de abrir el Pull Request.

**Commits esperados:**

- `v0.2.0 feat: integra inventario con API real`
- `v0.2.0 feat: crea formulario de préstamo`
- `v0.2.0 feat: crea listado de préstamos`
- `v0.2.0 feat: agrega registro visual de devoluciones`
- `v0.2.0 style: adapta módulo de préstamos a dispositivos móviles`

## Dependencias

| Dependencia | Quién la produce | Quién la consume | Observación |
| --- | --- | --- | --- |
| Sprint 1 cerrado y `v0.1.0` publicada | Todo el equipo | Todo el equipo | Precondición del sprint. |
| Esquema consolidado y repositorios reales | Ronald | Juan Carlos | Bloquea la integración de los casos de uso con datos reales. |
| Contratos de API consolidados | Juan Carlos | Mauricio y Luis | Necesarios antes de sustituir los mocks en el frontend. |
| Mecanismo de autenticación decidido (`AUTH-01`) | Juan Carlos | Mauricio | Bloquea `AUTH-04` y `AUTH-05`. Debe decidirse al inicio del sprint. |
| Habilitación del usuario (`USR-05`) | Juan Carlos | Juan Carlos | Precondición de `LOAN-03`. Por eso Usuarios se cierra antes que Préstamos. |
| Entrada de navegación al módulo de préstamos | Mauricio | Luis | Cambio sobre el router global: se coordina previamente. |

El esquema de base de datos sigue derivándose del modelo de dominio. Si la integración revela un desajuste, se corrige primero el modelo en [`docs/architecture/`](../../architecture/uml/README.md).

## Criterios de aceptación

- Un usuario puede solicitar el registro aportando su tipo, identificador institucional y evidencia de vinculación.
- Una solicitud puede aprobarse o rechazarse, y solo una solicitud aprobada habilita la cuenta.
- Un usuario registrado puede autenticarse y la navegación cambia según su sesión.
- Los recursos y sus ejemplares pueden consultarse desde la interfaz con datos reales de PostgreSQL.
- La disponibilidad de un recurso se deriva de la existencia de al menos un ejemplar `DISPONIBLE`, sin almacenarse como fuente de verdad adicional.
- Crear un préstamo verifica la habilitación del usuario, fija `fechaFin` según el plazo de la categoría y deja el ejemplar en `PRESTADO`.
- Un mismo ejemplar no puede quedar asociado a dos préstamos activos, tampoco ante solicitudes concurrentes.
- Registrar una devolución finaliza el préstamo y devuelve el ejemplar a `DISPONIBLE` cuando su estado lo permite; si no, queda `NO_DISPONIBLE` con su observación.
- El historial de préstamos por usuario se conserva.
- El flujo completo, del inicio de sesión a la devolución, puede demostrarse de principio a fin.

## Definition of Done

Aplica la [Definition of Done del proyecto](../git-workflow.md#definition-of-done), con commits que comienzan por `v0.2.0`.

## Pull Requests

Pendiente.

## Resultado del sprint

Pendiente.

## Versión resultante

Prevista: `v0.2.0`

Al completar e integrar correctamente: `develop` → `main`, y después el tag `v0.2.0`.
