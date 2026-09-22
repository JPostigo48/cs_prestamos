---
document: backlog
version: v0.0.1
status: in_progress
owner: Juan Carlos Postigo Cabana
---

# Backlog

Elementos de trabajo identificados a partir de los [requisitos vigentes](../requirements/README.md), el [modelo de dominio](../architecture/uml/README.md) y las [vistas de contextos](../architecture/structurizr/README.md).

Los identificadores son referencias estables: se evita renumerarlos. Los elementos marcados como `Futuro` no tienen versión asignada porque no pertenecen a ningún sprint planificado.

## Prefijos

| Prefijo | Módulo o área |
| --- | --- |
| `AUTH-` | Autenticación (`auth`) |
| `USR-` | Usuarios (`users`) |
| `INV-` | Inventario (`inventory`) |
| `LOAN-` | Préstamos (`loans`) |
| `RULE-` | Reglas |
| `TRUST-` | Confianza (`trust`) |
| `TERM-` | Términos y condiciones |
| `ARCH-` | Arquitectura y base técnica |
| `PLAN-` | Planificación |
| `DOC-` | Documentación |

## Estados

`Pendiente` · `En curso` · `Terminado` · `Bloqueado` · `Trasladado`

## Planificación y documentación

| ID | Tarea | Módulo | Responsable | Prioridad | Sprint | Versión | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DOC-01 | Levantar y organizar los requisitos funcionales y no funcionales | Documentación | Juan Carlos Postigo Cabana | Alta | 0 | v0.0.1 | Terminado |
| DOC-02 | Documentar reglas de negocio, modelo de confianza y términos y condiciones | Documentación | Juan Carlos Postigo Cabana | Alta | 0 | v0.0.1 | Terminado |
| DOC-03 | Modelar el dominio en UML con agregados, entidades y objetos de valor | Documentación | Juan Carlos Postigo Cabana | Alta | 0 | v0.0.1 | Terminado |
| DOC-04 | Definir contextos delimitados y vistas internas en Structurizr | Documentación | Juan Carlos Postigo Cabana | Alta | 0 | v0.0.1 | Terminado |
| DOC-05 | Documentar la arquitectura modular por capas del backend | Documentación | Juan Carlos Postigo Cabana | Alta | 0 | v0.0.1 | Terminado |
| DOC-06 | Documentar cómo levantar base de datos, backend y frontend | Documentación | Juan Carlos Postigo Cabana | Alta | 1 | v0.1.0 | Pendiente |
| DOC-07 | Alinear Structurizr con el UML vigente en confianza, sanciones y apelaciones | Documentación | Juan Carlos Postigo Cabana | Alta | 1 | v0.1.0 | Pendiente |
| DOC-08 | Revisar la trazabilidad de RF-17 y RF-19 ante préstamos planificados | Documentación | Juan Carlos Postigo Cabana | Media | 2 | v0.2.0 | Pendiente |
| PLAN-01 | Crear visualización de sprints en el frontend | Planning | Juan Carlos Postigo Cabana | Media | Futuro | Por definir | Pendiente |
| PLAN-02 | Definir el formato de lectura del front matter de planificación | Planning | Juan Carlos Postigo Cabana | Baja | Futuro | Por definir | Pendiente |
| PLAN-03 | Mostrar ramas, commits, Pull Requests y tags por sprint | Planning | Juan Carlos Postigo Cabana | Baja | Futuro | Por definir | Pendiente |
| PLAN-04 | Mostrar roadmap, progreso general y arquitectura relacionada | Planning | Juan Carlos Postigo Cabana | Baja | Futuro | Por definir | Pendiente |
| PLAN-05 | Mantener actualizada la planificación durante cada sprint | Planning | Juan Carlos Postigo Cabana | Alta | 1, 2, 3 | v0.1.0, v0.2.0, v0.3.0 | Pendiente |

## Arquitectura y base técnica

| ID | Tarea | Módulo | Responsable | Prioridad | Sprint | Versión | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ARCH-01 | Definir la estrategia de ramas, commits y versionado | Arquitectura | Juan Carlos Postigo Cabana | Alta | 0 | v0.0.1 | Terminado |
| ARCH-02 | Inicializar Node.js + TypeScript con estructura modular por capas | Backend | Juan Carlos Postigo Cabana | Alta | 1 | v0.1.0 | Pendiente |
| ARCH-03 | Preparar manejo de errores y configuración del backend | Backend | Juan Carlos Postigo Cabana | Alta | 1 | v0.1.0 | Pendiente |
| ARCH-04 | Consolidar Vue.js + TypeScript con router y estructura base | Frontend | Mauricio Alejandro Farfán Huayta | Alta | 1 | v0.1.0 | Pendiente |
| ARCH-05 | Crear `develop` y resolver la rama remota `feature/mi_database` | Repositorio | Juan Carlos Postigo Cabana | Alta | 1 | v0.1.0 | Pendiente |
| ARCH-06 | Configurar PostgreSQL y el acceso desde el proyecto | Persistencia | Ronald Reynaldo Valdez Agüero | Alta | 1 | v0.1.0 | Pendiente |
| ARCH-07 | Crear el esquema relacional preliminar derivado del modelo de dominio | Persistencia | Ronald Reynaldo Valdez Agüero | Alta | 1 | v0.1.0 | Pendiente |
| ARCH-08 | Crear migraciones o mecanismo equivalente | Persistencia | Ronald Reynaldo Valdez Agüero | Alta | 1 | v0.1.0 | Pendiente |
| ARCH-09 | Crear datos mínimos para desarrollo | Persistencia | Ronald Reynaldo Valdez Agüero | Media | 1 | v0.1.0 | Pendiente |
| ARCH-10 | Agregar cliente HTTP común en el frontend | Frontend | Mauricio Alejandro Farfán Huayta | Alta | 1 | v0.1.0 | Pendiente |
| ARCH-11 | Definir la estrategia transaccional para préstamos concurrentes | Backend | Juan Carlos Postigo Cabana | Alta | 2 | v0.2.0 | Pendiente |
| ARCH-12 | Integrar repositorios con persistencia real | Persistencia | Ronald Reynaldo Valdez Agüero | Alta | 2 | v0.2.0 | Pendiente |

## Autenticación

| ID | Tarea | Módulo | Responsable | Prioridad | Sprint | Versión | Estado | Requisitos |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AUTH-01 | Decidir el mecanismo de credenciales y autenticación | Autenticación | Juan Carlos Postigo Cabana | Alta | 2 | v0.2.0 | Pendiente | RF-05 |
| AUTH-02 | Implementar el endpoint de autenticación de usuarios registrados | Autenticación | Juan Carlos Postigo Cabana | Alta | 2 | v0.2.0 | Pendiente | RF-05 |
| AUTH-03 | Modelar `CuentaAcceso` y `RolAcceso` en dominio y persistencia | Autenticación | Ronald Reynaldo Valdez Agüero | Alta | 2 | v0.2.0 | Pendiente | RF-05, RF-06 |
| AUTH-04 | Crear la interfaz de inicio de sesión | Frontend | Mauricio Alejandro Farfán Huayta | Alta | 2 | v0.2.0 | Pendiente | RF-05 |
| AUTH-05 | Integrar la autenticación con la API y la navegación según sesión | Frontend | Mauricio Alejandro Farfán Huayta | Alta | 2 | v0.2.0 | Pendiente | RF-05, RF-06 |
| AUTH-06 | Restringir operaciones según los permisos del usuario autenticado | Autenticación | Juan Carlos Postigo Cabana | Alta | 3 | v0.3.0 | Pendiente | RNF-05 |

## Usuarios

| ID | Tarea | Módulo | Responsable | Prioridad | Sprint | Versión | Estado | Requisitos |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| USR-01 | Implementar la solicitud de registro con tipo de usuario e identificador institucional | Usuarios | Juan Carlos Postigo Cabana | Alta | 2 | v0.2.0 | Pendiente | RF-01, RF-02 |
| USR-02 | Registrar la evidencia de vinculación asociada a la solicitud | Usuarios | Juan Carlos Postigo Cabana | Alta | 2 | v0.2.0 | Pendiente | RF-03 |
| USR-03 | Implementar la aprobación y el rechazo de solicitudes de registro | Usuarios | Juan Carlos Postigo Cabana | Alta | 2 | v0.2.0 | Pendiente | RF-04 |
| USR-04 | Persistir usuarios, solicitudes y evidencias | Persistencia | Ronald Reynaldo Valdez Agüero | Alta | 2 | v0.2.0 | Pendiente | RNF-06 |
| USR-05 | Consultar si un usuario está habilitado para realizar préstamos | Usuarios | Juan Carlos Postigo Cabana | Alta | 2 | v0.2.0 | Pendiente | RF-07, RF-16 |
| USR-06 | Definir el procedimiento de verificación de la vinculación con la EPCC | Usuarios | Juan Carlos Postigo Cabana | Media | Futuro | Por definir | Pendiente | RF-03 |

## Inventario

| ID | Tarea | Módulo | Responsable | Prioridad | Sprint | Versión | Estado | Requisitos |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INV-01 | Crear la estructura del módulo Inventario en el frontend | Frontend | Luis Antonio Chipana Chura | Alta | 1 | v0.1.0 | Pendiente | RF-12 |
| INV-02 | Crear el listado de recursos | Frontend | Luis Antonio Chipana Chura | Alta | 1 | v0.1.0 | Pendiente | RF-12 |
| INV-03 | Crear el detalle de un recurso con sus ejemplares | Frontend | Luis Antonio Chipana Chura | Alta | 1 | v0.1.0 | Pendiente | RF-10, RF-12 |
| INV-04 | Mostrar el estado de disponibilidad de los ejemplares | Frontend | Luis Antonio Chipana Chura | Alta | 1 | v0.1.0 | Pendiente | RF-11, RF-13 |
| INV-05 | Adaptar las vistas de inventario a dispositivos móviles | Frontend | Luis Antonio Chipana Chura | Media | 1 | v0.1.0 | Pendiente | RNF-07 |
| INV-06 | Implementar el registro de recursos y su categoría | Inventario | Juan Carlos Postigo Cabana | Alta | 2 | v0.2.0 | Pendiente | RF-08, RF-09 |
| INV-07 | Implementar el registro de ejemplares de un recurso | Inventario | Juan Carlos Postigo Cabana | Alta | 2 | v0.2.0 | Pendiente | RF-10 |
| INV-08 | Derivar la disponibilidad del recurso de sus ejemplares | Inventario | Juan Carlos Postigo Cabana | Alta | 2 | v0.2.0 | Pendiente | RF-13, RN-05 |
| INV-09 | Persistir categorías, recursos y ejemplares | Persistencia | Ronald Reynaldo Valdez Agüero | Alta | 2 | v0.2.0 | Pendiente | RNF-06 |
| INV-10 | Conectar el módulo de inventario con la API real | Frontend | Luis Antonio Chipana Chura | Alta | 2 | v0.2.0 | Pendiente | RF-12 |
| INV-11 | Registrar observaciones sobre el estado de un ejemplar | Inventario | Juan Carlos Postigo Cabana | Media | 2 | v0.2.0 | Pendiente | RF-14, RF-22 |
| INV-12 | Definir el tiempo máximo de préstamo por categoría | Inventario | Juan Carlos Postigo Cabana | Alta | 2 | v0.2.0 | Pendiente | RF-18, RN-06 |

## Préstamos

| ID | Tarea | Módulo | Responsable | Prioridad | Sprint | Versión | Estado | Requisitos |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LOAN-01 | Definir los contratos preliminares de préstamos y publicarlos como mock | Préstamos | Juan Carlos Postigo Cabana | Alta | 1 | v0.1.0 | Pendiente | RF-15, RF-23 |
| LOAN-02 | Implementar la creación de un préstamo sobre un ejemplar disponible | Préstamos | Juan Carlos Postigo Cabana | Alta | 2 | v0.2.0 | Pendiente | RF-15, RN-03 |
| LOAN-03 | Verificar la habilitación del usuario antes de prestar | Préstamos | Juan Carlos Postigo Cabana | Alta | 2 | v0.2.0 | Pendiente | RF-16, RN-07 |
| LOAN-04 | Aplicar el plazo de la categoría al fijar `fechaFin` | Préstamos | Juan Carlos Postigo Cabana | Alta | 2 | v0.2.0 | Pendiente | RF-18 |
| LOAN-05 | Cambiar el ejemplar a `PRESTADO` de forma consistente con el préstamo | Préstamos | Juan Carlos Postigo Cabana | Alta | 2 | v0.2.0 | Pendiente | RF-19, RNF-09 |
| LOAN-06 | Implementar la consulta de préstamos activos e historial por usuario | Préstamos | Juan Carlos Postigo Cabana | Alta | 2 | v0.2.0 | Pendiente | RF-23, RF-24 |
| LOAN-07 | Implementar el registro de devoluciones y la liberación del ejemplar | Préstamos | Juan Carlos Postigo Cabana | Alta | 2 | v0.2.0 | Pendiente | RF-20, RF-21 |
| LOAN-08 | Persistir préstamos y devoluciones | Persistencia | Ronald Reynaldo Valdez Agüero | Alta | 2 | v0.2.0 | Pendiente | RNF-06 |
| LOAN-09 | Crear el formulario de préstamo en el frontend | Frontend | Luis Antonio Chipana Chura | Alta | 2 | v0.2.0 | Pendiente | RF-15 |
| LOAN-10 | Crear el listado de préstamos y el registro visual de devoluciones | Frontend | Luis Antonio Chipana Chura | Alta | 2 | v0.2.0 | Pendiente | RF-20, RF-23 |
| LOAN-11 | Adaptar el módulo de préstamos a dispositivos móviles | Frontend | Luis Antonio Chipana Chura | Media | 2 | v0.2.0 | Pendiente | RNF-07 |
| LOAN-12 | Implementar préstamos planificados con intervalo `fechaInicio`–`fechaFin` | Préstamos | Juan Carlos Postigo Cabana | Alta | 3 | v0.3.0 | Pendiente | RF-15 |
| LOAN-13 | Validar que un ejemplar no tenga intervalos superpuestos | Préstamos | Juan Carlos Postigo Cabana | Alta | 3 | v0.3.0 | Pendiente | RF-17, RN-04, RNF-04 |
| LOAN-14 | Identificar préstamos que superaron su fecha límite de devolución | Préstamos | Juan Carlos Postigo Cabana | Alta | 3 | v0.3.0 | Pendiente | RF-25, RN-11 |
| LOAN-15 | Aplicar las restricciones de préstamo por tipo de usuario | Préstamos | Juan Carlos Postigo Cabana | Media | 3 | v0.3.0 | Pendiente | RF-26, RN-13 |
| LOAN-16 | Confirmar y, si procede, aplicar el límite de préstamos activos para estudiantes | Préstamos | Juan Carlos Postigo Cabana | Baja | Futuro | Por definir | Pendiente | RF-27 |

## Confianza

| ID | Tarea | Módulo | Responsable | Prioridad | Sprint | Versión | Estado | Requisitos |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TRUST-01 | Implementar el perfil de confianza con porcentaje en el intervalo 0–100 | Confianza | Juan Carlos Postigo Cabana | Alta | 3 | v0.3.0 | Pendiente | RF-28, RF-33 |
| TRUST-02 | Derivar el nivel de confianza del porcentaje | Confianza | Juan Carlos Postigo Cabana | Alta | 3 | v0.3.0 | Pendiente | RF-29, RN-15 |
| TRUST-03 | Exponer la consulta de porcentaje y nivel de confianza | Confianza | Juan Carlos Postigo Cabana | Alta | 3 | v0.3.0 | Pendiente | RF-30 |
| TRUST-04 | Registrar sanciones con intervalo, estado, operador y cambio de confianza | Confianza | Juan Carlos Postigo Cabana | Alta | 3 | v0.3.0 | Pendiente | RF-48, RF-49, RN-22 |
| TRUST-05 | Impedir nuevos préstamos mientras exista una sanción activa | Confianza | Juan Carlos Postigo Cabana | Alta | 3 | v0.3.0 | Pendiente | RF-50, RN-23 |
| TRUST-06 | Persistir perfiles de confianza y el historial de sanciones | Persistencia | Ronald Reynaldo Valdez Agüero | Alta | 3 | v0.3.0 | Pendiente | RNF-06, RN-27 |
| TRUST-07 | Crear la visualización de confianza, sanciones y restricciones | Frontend | Luis Antonio Chipana Chura | Alta | 3 | v0.3.0 | Pendiente | RF-30, RF-31 |
| TRUST-08 | Implementar el flujo de apelación y su resolución por un administrador | Confianza | Juan Carlos Postigo Cabana | Media | Futuro | Por definir | Pendiente | RF-52 a RF-56 |
| TRUST-09 | Definir porcentaje inicial, umbrales de los cuatro niveles y restricciones por nivel | Confianza | Juan Carlos Postigo Cabana | Alta | Futuro | Por definir | Pendiente | RF-29, RF-31 |
| TRUST-10 | Definir el efecto de una apelación aceptada sobre el porcentaje de confianza | Confianza | Juan Carlos Postigo Cabana | Media | Futuro | Por definir | Pendiente | RF-54 |

## Reglas

| ID | Tarea | Módulo | Responsable | Prioridad | Sprint | Versión | Estado | Requisitos |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RULE-01 | Implementar el registro y la modificación de reglas de uso | Reglas | Juan Carlos Postigo Cabana | Alta | 3 | v0.3.0 | Pendiente | RF-34, RF-35 |
| RULE-02 | Permitir activar y desactivar reglas sin eliminarlas | Reglas | Juan Carlos Postigo Cabana | Alta | 3 | v0.3.0 | Pendiente | RF-36 |
| RULE-03 | Configurar la penalización porcentual y la consecuencia de cada regla | Reglas | Juan Carlos Postigo Cabana | Alta | 3 | v0.3.0 | Pendiente | RF-37, RF-38, RF-39, RN-18 |
| RULE-04 | Versionar las reglas conservando su historial | Reglas | Juan Carlos Postigo Cabana | Alta | 3 | v0.3.0 | Pendiente | RF-46, RN-19 |
| RULE-05 | Registrar incumplimientos conservando regla, versión y penalización aplicada | Reglas | Juan Carlos Postigo Cabana | Alta | 3 | v0.3.0 | Pendiente | RF-41, RF-43, RF-44 |
| RULE-06 | Descontar la penalización configurada del porcentaje de confianza | Reglas | Juan Carlos Postigo Cabana | Alta | 3 | v0.3.0 | Pendiente | RF-32, RF-42 |
| RULE-07 | Registrar la duración de restricción para estudiantes en la versión de regla | Reglas | Juan Carlos Postigo Cabana | Alta | 3 | v0.3.0 | Pendiente | RF-51, RN-21 |
| RULE-08 | Persistir reglas, versiones e incumplimientos con integridad histórica | Persistencia | Ronald Reynaldo Valdez Agüero | Alta | 3 | v0.3.0 | Pendiente | RN-19, RN-28 |
| RULE-09 | Crear la interfaz administrativa de reglas y sus versiones | Frontend | Mauricio Alejandro Farfán Huayta | Alta | 3 | v0.3.0 | Pendiente | RF-34, RF-40 |
| RULE-10 | Consultar las reglas vigentes desde la aplicación | Reglas | Juan Carlos Postigo Cabana | Media | 3 | v0.3.0 | Pendiente | RF-40 |
| RULE-11 | Definir la representación y la ejecución de la consecuencia de una regla | Reglas | Juan Carlos Postigo Cabana | Media | Futuro | Por definir | Pendiente | RF-39 |

## Términos y condiciones

| ID | Tarea | Módulo | Responsable | Prioridad | Sprint | Versión | Estado | Requisitos |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TERM-01 | Implementar versiones de términos y condiciones | Términos | Juan Carlos Postigo Cabana | Alta | 3 | v0.3.0 | Pendiente | RF-47 |
| TERM-02 | Registrar qué versión aceptó cada usuario y cuándo | Términos | Juan Carlos Postigo Cabana | Alta | 3 | v0.3.0 | Pendiente | RF-47 |
| TERM-03 | Persistir versiones de términos y sus aceptaciones | Persistencia | Ronald Reynaldo Valdez Agüero | Alta | 3 | v0.3.0 | Pendiente | RNF-06 |
| TERM-04 | Crear la interfaz de términos y condiciones | Frontend | Mauricio Alejandro Farfán Huayta | Media | 3 | v0.3.0 | Pendiente | RF-47 |
| TERM-05 | Definir la composición de una versión de términos | Términos | Juan Carlos Postigo Cabana | Media | Futuro | Por definir | Pendiente | RF-47 |

## Elementos sin versión asignada

Los siguientes elementos dependen de decisiones todavía pendientes en los documentos de requisitos y arquitectura. No se planifican dentro de los sprints 0 a 3 y no deben asumirse como acordados:

`USR-06` · `LOAN-16` · `TRUST-08` · `TRUST-09` · `TRUST-10` · `RULE-11` · `TERM-05` · `PLAN-01` a `PLAN-04`

`TRUST-09` está marcado con prioridad alta porque condiciona `TRUST-02` y `TRUST-05`: la derivación del nivel y las restricciones por nivel no pueden cerrarse en Sprint 3 mientras los umbrales sigan sin definir.
