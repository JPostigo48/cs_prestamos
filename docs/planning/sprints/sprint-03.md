---
sprint: 3
name: Reglas de dominio y consolidación
status: planned
version: v0.3.0
commit_prefix: v0.3.0
---

# Sprint 3 — Reglas de dominio y consolidación

## Objetivo

Incorporar las reglas que distinguen al sistema de un CRUD de préstamos y consolidar el primer flujo funcional completo: préstamos planificados con intervalos no superpuestos, confianza, sanciones, reglas versionadas, incumplimientos con penalización histórica y versiones de términos aceptadas por el usuario.

## Alcance

- Préstamos planificados con intervalo `fechaInicio`–`fechaFin` y validación de superposición por ejemplar.
- Identificación de préstamos que superaron su fecha límite de devolución.
- Perfil de confianza con porcentaje en el intervalo 0–100 y nivel derivado.
- Sanciones con intervalo, estado, operador responsable y cambio de confianza trazable.
- Reglas de uso versionadas, con penalización y consecuencia configurables.
- Incumplimientos que conservan la regla, la versión exacta y la penalización realmente aplicada.
- Versiones de términos y condiciones, y registro de la versión aceptada por cada usuario.
- Restricción de operaciones según los permisos del usuario autenticado.
- Interfaces administrativas de reglas y términos, y visualización de confianza y sanciones.

## Fuera de alcance

- Los valores todavía pendientes del modelo de confianza: porcentaje inicial, umbrales de los cuatro niveles y restricciones concretas por nivel. **No se inventan.** Ver «Decisiones que bloquean parte del alcance».
- Flujo completo de apelación y su resolución por un administrador (`TRUST-08`): el dominio ya lo modela, pero no se implementa en este sprint.
- Efecto de una apelación aceptada sobre el porcentaje de confianza.
- Mecanismos para aumentar la confianza.
- Límite de préstamos activos simultáneos para estudiantes (RF-27, todavía no confirmado).
- Ejecución automática de la consecuencia asociada a una regla.

## Entregables

Sistema integrado con:

- préstamos planificados;
- validación de superposición de intervalos;
- confianza;
- sanciones;
- reglas versionadas;
- incumplimientos;
- términos;
- historial consistente.

## Versión objetivo

`v0.3.0` — todos los commits del sprint comienzan con este prefijo.

## Integrantes y responsabilidades

| Integrante | Responsabilidad en el sprint | Ramas |
| --- | --- | --- |
| Juan Carlos Postigo Cabana | Planificación y backend de reglas, confianza y validación temporal | `feat/loan-overlap-validation`, `feat/trust-sanctions`, `feat/rule-versioning`, `feat/terms-versioning` |
| Ronald Reynaldo Valdez Agüero | Persistencia de reglas, confianza e integridad histórica | `feat/rules-trust-persistence` |
| Mauricio Alejandro Farfán Huayta | Interfaz general de reglas y administración | `feat/rules-admin-ui` |
| Luis Antonio Chipana Chura | Interfaz de confianza y sanciones | `feat/trust-sanctions-ui` |

## Tareas

### Juan Carlos Postigo Cabana

**Responsabilidad:** planificación, backend de reglas, confianza, validación temporal de préstamos e integración entre módulos.

**Ramas sugeridas:** `feat/loan-overlap-validation`, `feat/trust-sanctions`, `feat/rule-versioning`, `feat/terms-versioning`.

No es necesario trabajar todas al mismo tiempo. Las ramas se mantienen pequeñas y enfocadas, y se integran en `develop` a medida que se cierran.

**Tareas — Préstamos:**

- Implementar préstamos planificados con intervalo `fechaInicio`–`fechaFin` (`LOAN-12`).
- Validar que un ejemplar no tenga préstamos activos o planificados con intervalos superpuestos (`LOAN-13`, RF-17, RN-04, RNF-04).
- Identificar préstamos que superaron su fecha límite de devolución (`LOAN-14`, RF-25).
- Aplicar las restricciones de préstamo por tipo de usuario (`LOAN-15`, RF-26, RN-13).

**Tareas — Confianza:**

- Implementar el perfil de confianza con porcentaje en el intervalo cerrado 0–100 (`TRUST-01`, RF-28, RF-33).
- Derivar el nivel de confianza del porcentaje (`TRUST-02`, RF-29).
- Exponer la consulta de porcentaje y nivel (`TRUST-03`, RF-30).
- Registrar sanciones con usuario, incumplimiento, regla y versión aplicadas, operador, intervalo, estado y `confianzaAnterior`/`confianzaPosterior` (`TRUST-04`, RF-48, RF-49).
- Impedir nuevos préstamos mientras exista una sanción activa de restricción (`TRUST-05`, RF-50, RN-23).

**Tareas — Reglas y términos:**

- Implementar el registro y la modificación de reglas de uso (`RULE-01`, RF-34, RF-35).
- Permitir activar y desactivar reglas sin eliminarlas (`RULE-02`, RF-36).
- Configurar la penalización porcentual y la consecuencia de cada regla (`RULE-03`, RF-37 a RF-39).
- Versionar las reglas conservando su historial (`RULE-04`, RF-46).
- Registrar incumplimientos conservando regla, versión y penalización aplicada (`RULE-05`, RF-41, RF-43, RF-44).
- Descontar del porcentaje de confianza la penalización configurada en la regla (`RULE-06`, RF-32, RF-42).
- Registrar en la versión de regla la duración de restricción para estudiantes (`RULE-07`, RF-51, RN-21).
- Exponer la consulta de reglas vigentes (`RULE-10`, RF-40).
- Implementar versiones de términos y el registro de la versión aceptada por cada usuario (`TERM-01`, `TERM-02`, RF-47).

**Tareas — Transversales:**

- Restringir las operaciones según los permisos del usuario autenticado (`AUTH-06`, RNF-05).
- Mantener actualizado este archivo durante el sprint (`PLAN-05`).

**Commits esperados:**

- `v0.3.0 feat: implementa préstamos planificados`
- `v0.3.0 feat: valida superposición de intervalos de préstamo`
- `v0.3.0 feat: implementa gestión de confianza y sanciones`
- `v0.3.0 feat: implementa endpoints de reglas e incumplimientos`
- `v0.3.0 feat: implementa endpoints de términos y condiciones`
- `v0.3.0 docs: actualiza planificación del Sprint 3`

### Ronald Reynaldo Valdez Agüero

**Responsabilidad:** persistencia de reglas y confianza, con especial atención a la integridad histórica.

**Rama:** `feat/rules-trust-persistence`

**Tareas:**

- Persistir perfiles de confianza y el historial de sanciones (`TRUST-06`).
- Persistir reglas, versiones e incumplimientos (`RULE-08`).
- Persistir versiones de términos y sus aceptaciones (`TERM-03`).
- Definir las restricciones que garantizan la integridad histórica.
- Apoyar la conservación de datos históricos.

**Invariantes de persistencia que este sprint debe garantizar:**

- Una versión de regla histórica es inmutable: modificar una regla crea una versión nueva y no altera las anteriores (RN-19).
- Un incumplimiento conserva la penalización realmente aplicada; cambiar después la regla no modifica ese valor (RF-44).
- Una sanción conserva su duración, su cambio de confianza y sus referencias; cambios posteriores en la regla no la alteran (RN-28).
- Las sanciones y apelaciones resueltas no se sobrescriben ni se eliminan del historial (RN-27, RF-56).

**Commits esperados:**

- `v0.3.0 feat: agrega persistencia de confianza y sanciones`
- `v0.3.0 feat: agrega persistencia de reglas versionadas`
- `v0.3.0 feat: agrega persistencia de incumplimientos`
- `v0.3.0 feat: agrega persistencia de términos y aceptaciones`
- `v0.3.0 test: verifica integridad del historial de reglas`

### Mauricio Alejandro Farfán Huayta

**Responsabilidad:** interfaz general de reglas y administración, y coherencia del diseño global.

**Rama:** `feat/rules-admin-ui`

**Tareas:**

- Crear la interfaz administrativa de reglas y la gestión visual de sus versiones (`RULE-09`, RF-34, RF-40).
- Crear la interfaz de términos y condiciones (`TERM-04`, RF-47).
- Adaptar la navegación para los nuevos módulos administrativos.
- Mantener la coherencia del diseño global y del sistema visual.
- Adaptar las vistas administrativas a dispositivos móviles.

**Commits esperados:**

- `v0.3.0 feat: crea interfaz administrativa de reglas`
- `v0.3.0 feat: agrega gestión visual de versiones de reglas`
- `v0.3.0 feat: crea interfaz de términos y condiciones`
- `v0.3.0 style: adapta vistas administrativas a dispositivos móviles`

### Luis Antonio Chipana Chura

**Responsabilidad:** interfaz de confianza y sanciones, incluido su responsive.

**Rama:** `feat/trust-sanctions-ui`

**Tareas:**

- Crear la visualización del porcentaje y nivel de confianza del usuario (`TRUST-07`, RF-30).
- Mostrar el historial de sanciones con su estado e intervalo.
- Mostrar las restricciones vigentes y el estado de habilitación para préstamos.
- Crear las vistas relacionadas con incidencias e incumplimientos.
- Adaptar las vistas de confianza a dispositivos móviles.

La interfaz muestra los cuatro niveles derivados del dominio. **No inventa nombres ni umbrales**: mientras `TRUST-09` siga pendiente, las vistas se apoyan en lo que expone el backend (`NIVEL_1` a `NIVEL_4`).

**Commits esperados:**

- `v0.3.0 feat: crea visualización de confianza del usuario`
- `v0.3.0 feat: agrega historial de sanciones`
- `v0.3.0 feat: muestra restricciones de préstamo`
- `v0.3.0 style: adapta vistas de confianza a dispositivos móviles`

## Reglas a implementar

### Préstamos

Un ejemplar no puede tener préstamos activos o planificados cuyos intervalos `[fechaInicio, fechaFin]` se superpongan.

`fechaFin` queda fijada al crear o planificar el préstamo, a partir del tiempo máximo de la categoría del recurso. Es una instantánea del plazo aplicado: modificar después la categoría no cambia préstamos existentes.

### Confianza

- Porcentaje dentro del intervalo cerrado de 0 a 100.
- Nivel derivado del porcentaje: cuatro niveles.
- Sanciones asociadas al usuario.
- `confianzaAnterior` y `confianzaPosterior` en cada sanción, de forma que el cambio aplicado permanezca trazable.
- Estado de sanción: `ACTIVA`, `FINALIZADA` o `ABSUELTA`.
- Estado de restricción del perfil y habilitación para préstamos.

No se inventan rangos definitivos mientras sigan pendientes.

> El [modelo de dominio](../../architecture/uml/modelo-dominio.puml) nombra el atributo derivado del perfil como `restringidoParaPrestamos`. Se usa ese nombre; la habilitación efectiva para prestar se compone además de la aprobación de la solicitud y la vinculación vigente, no solo del perfil de confianza.

### Reglas

- `ReglaUso` con su `versionVigenteId`.
- `VersionRegla` con título, descripción, penalización porcentual, consecuencia, duración de restricción para estudiantes y estado activa/inactiva.
- `Incumplimiento` que conserva regla, versión exacta y penalización aplicada.

Los cambios futuros no alteran el historial.

### Términos

- `VersionTerminos`.
- `AceptacionTerminos` con usuario, versión aceptada y fecha.

## Dependencias

| Dependencia | Quién la produce | Quién la consume | Observación |
| --- | --- | --- | --- |
| Sprint 2 cerrado y `v0.2.0` publicada | Todo el equipo | Todo el equipo | Precondición del sprint. |
| `DOC-08` resuelto | Juan Carlos | Juan Carlos | RF-17 y RF-19 deben aclararse antes de implementar `LOAN-13`. |
| Versiones de regla persistidas | Ronald | Juan Carlos | `RULE-05` no puede conservar la versión exacta sin ellas. |
| Perfil de confianza y sanciones persistidos | Ronald | Juan Carlos | Bloquea `TRUST-04` y `TRUST-05`. |
| Endpoints de confianza y sanciones | Juan Carlos | Luis | Bloquea `TRUST-07`. |
| Endpoints de reglas y términos | Juan Carlos | Mauricio | Bloquea `RULE-09` y `TERM-04`. |
| Navegación de módulos administrativos | Mauricio | Luis y Juan Carlos | Cambio sobre el router global: se coordina previamente. |

**Orden interno recomendado:** reglas versionadas antes que incumplimientos; incumplimientos antes que sanciones; sanciones antes que la restricción de préstamos por sanción activa. La validación de superposición de intervalos es independiente del resto y puede avanzar en paralelo.

## Decisiones que bloquean parte del alcance

`TRUST-09` (porcentaje inicial, umbrales de los cuatro niveles y restricciones concretas por nivel) sigue pendiente en el [modelo de confianza](../../requirements/trust-model.md#definiciones-pendientes). Mientras no se acuerde:

- `TRUST-02` puede implementar la derivación del nivel como una función configurable, pero no puede fijar umbrales definitivos en el código.
- `RF-31` (aplicar restricciones según el nivel de confianza) **no puede completarse** en este sprint. La restricción que sí puede aplicarse es la derivada de una sanción activa (`TRUST-05`, RF-50), que no depende de umbrales.
- Los valores de penalización provienen de la configuración persistida de cada regla (RN-18), no de constantes. Porcentajes como 5 %, 10 % o 12 % son ejemplos ilustrativos del modelo de confianza y no deben usarse como configuración predeterminada.

Esta decisión debe tomarse antes de iniciar el sprint. Si no se toma, `RF-31` se traslada y se registra como tarea no completada al cerrar.

## Criterios de aceptación

- Un préstamo puede planificarse con un intervalo futuro y queda en estado `PLANIFICADO`.
- Crear o planificar un préstamo sobre un ejemplar con un intervalo superpuesto es rechazado.
- Los préstamos no finalizados que superaron `fechaFin` pueden identificarse.
- Cada usuario tiene un perfil de confianza cuyo porcentaje nunca sale del intervalo 0–100.
- Registrar un incumplimiento descuenta la penalización configurada en la versión de la regla y conserva el valor aplicado.
- Modificar una regla crea una versión nueva y no altera incumplimientos ni sanciones ya registrados.
- Una sanción conserva usuario, incumplimiento, regla, versión, operador, intervalo, estado y el cambio de confianza.
- Mientras una sanción de restricción está activa, el usuario sancionado no puede crear préstamos.
- Puede registrarse qué versión de los términos aceptó cada usuario y cuándo.
- Las operaciones disponibles se restringen según los permisos del usuario autenticado.
- El historial de reglas, incumplimientos y sanciones es consistente y no se reescribe.

## Definition of Done

Aplica la [Definition of Done del proyecto](../git-workflow.md#definition-of-done), con commits que comienzan por `v0.3.0`.

Dado el peso de la integridad histórica en este sprint, las tareas de persistencia de `RULE-08` y `TRUST-06` incluyen además pruebas que verifiquen que un cambio posterior en una regla no altera incumplimientos ni sanciones anteriores.

## Pull Requests

Pendiente.

## Resultado del sprint

Pendiente.

## Versión resultante

Prevista: `v0.3.0`

Al completar e integrar correctamente: `develop` → `main`, y después el tag `v0.3.0`.
