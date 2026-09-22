# Requisitos funcionales

Los requisitos funcionales se organizan según los dominios o módulos identificados en la planificación actual.

## Gestión de usuarios

- **RF-01.** El sistema debe permitir que estudiantes, docentes y personal administrativo de la EPCC soliciten la creación de una cuenta.
- **RF-02.** El sistema debe permitir registrar la información institucional necesaria del usuario, incluyendo su tipo de usuario y su identificador institucional cuando corresponda.
- **RF-03.** El sistema debe permitir registrar o adjuntar información necesaria para verificar la vinculación vigente del usuario con la EPCC.
- **RF-04.** El sistema debe permitir aprobar o rechazar solicitudes de registro antes de habilitar una cuenta.
- **RF-05.** El sistema debe permitir autenticar a los usuarios registrados.
- **RF-06.** El sistema debe permitir identificar el tipo de usuario autenticado: estudiante, docente o administrativo.
- **RF-07.** El sistema debe permitir consultar si un usuario se encuentra habilitado para realizar préstamos.

## Gestión de recursos e inventario

- **RF-08.** El sistema debe permitir registrar recursos disponibles para préstamo.
- **RF-09.** El sistema debe permitir clasificar los recursos según su categoría.
- **RF-10.** El sistema debe permitir registrar uno o varios ejemplares físicos asociados a un mismo recurso.
- **RF-11.** Cada ejemplar debe mantener un estado que permita identificar su disponibilidad.
- **RF-12.** El sistema debe permitir consultar los recursos y ejemplares registrados.
- **RF-13.** El sistema debe determinar la disponibilidad de un recurso a partir de la existencia de al menos un ejemplar disponible.
- **RF-14.** El sistema debe permitir registrar observaciones relacionadas con el estado de un ejemplar.

## Gestión de préstamos

- **RF-15.** El sistema debe permitir registrar un préstamo asociando un usuario con un ejemplar disponible.
- **RF-16.** Antes de registrar un préstamo, el sistema debe verificar que el usuario se encuentre habilitado.
- **RF-17.** El sistema debe impedir que un ejemplar tenga más de un préstamo activo simultáneamente.
- **RF-18.** El sistema debe aplicar el tiempo máximo de préstamo correspondiente a la categoría del recurso.
- **RF-19.** Al registrar un préstamo, el ejemplar debe cambiar su estado a prestado.
- **RF-20.** El sistema debe permitir registrar la devolución de un ejemplar.
- **RF-21.** Al registrar una devolución, el ejemplar debe volver a encontrarse disponible siempre que su estado permita continuar prestándolo.
- **RF-22.** El sistema debe permitir registrar observaciones durante la devolución cuando se detecte daño, mal estado u otra incidencia.
- **RF-23.** El sistema debe permitir consultar los préstamos activos.
- **RF-24.** El sistema debe mantener un historial de préstamos por usuario.
- **RF-25.** El sistema debe identificar préstamos que hayan superado su fecha u hora límite de devolución.
- **RF-26.** El sistema debe aplicar las restricciones de préstamo definidas para cada tipo de usuario.
- **RF-27 — PENDIENTE (no definitivo).** Para estudiantes se está considerando limitar la cantidad de préstamos activos simultáneos. Esta regla aún debe confirmarse, por lo que debe marcarse como pendiente y no asumirse como definitiva.

## Confianza del usuario

- **RF-28.** El sistema debe mantener un porcentaje de confianza asociado a cada usuario.
- **RF-29.** El sistema debe clasificar al usuario en uno de cuatro niveles de confianza según su porcentaje.
- **RF-30.** El sistema debe permitir consultar el porcentaje y nivel de confianza del usuario.
- **RF-31.** El sistema debe aplicar restricciones de préstamo según el nivel de confianza del usuario.
- **RF-32.** El sistema debe actualizar el porcentaje de confianza cuando se registre el incumplimiento de una regla.
- **RF-33.** El sistema debe impedir que el porcentaje de confianza tome valores fuera del intervalo permitido.

## Reglas, términos y condiciones

- **RF-34.** El sistema debe permitir a los administradores registrar reglas de uso.
- **RF-35.** El sistema debe permitir modificar las reglas existentes.
- **RF-36.** El sistema debe permitir activar o desactivar reglas sin necesidad de eliminarlas.
- **RF-37.** Cada regla debe tener asociada una penalización porcentual de confianza configurable según su gravedad.
- **RF-38.** El porcentaje de penalización de una regla debe poder ser definido y modificado por un administrador.
- **RF-39.** Cada regla debe permitir definir una consecuencia asociada a su incumplimiento.
- **RF-40.** El sistema debe permitir consultar las reglas vigentes.
- **RF-41.** El sistema debe permitir registrar el incumplimiento de una regla por parte de un usuario.
- **RF-42.** Al registrar un incumplimiento, el sistema debe descontar del porcentaje de confianza del usuario el porcentaje configurado en la regla correspondiente.
- **RF-43.** El registro del incumplimiento debe conservar la referencia a la regla infringida.
- **RF-44.** El registro del incumplimiento debe conservar el porcentaje de penalización realmente aplicado, incluso si posteriormente la regla es modificada.
- **RF-45.** El sistema debe considerar las consecuencias y restricciones vigentes al determinar si un usuario puede realizar un nuevo préstamo.
- **RF-46.** El sistema debe conservar un historial de modificaciones o versiones de las reglas.
- **RF-47.** El sistema debe registrar qué versión de los términos y condiciones fue aceptada por cada usuario.

## Sanciones y apelaciones

- **RF-48.** El sistema debe registrar una sanción cuando un operador determine el incumplimiento de una regla por parte de un usuario, asociándola con el usuario, el incumplimiento y la versión de la regla que la originó.
- **RF-49.** Cada sanción debe conservar su fecha de inicio, fecha de fin, estado, operador responsable y el cambio de confianza aplicado.
- **RF-50.** Mientras una sanción de restricción de préstamo se encuentre activa, el sistema debe impedir que el estudiante sancionado solicite nuevos préstamos durante el intervalo definido.
- **RF-51.** La duración de la restricción de préstamo debe obtenerse de la versión de la regla aplicable y quedar registrada en las fechas de la sanción.
- **RF-52.** El sistema debe permitir que un usuario presente una apelación contra una sanción activa asociada a su cuenta, indicando el motivo de la solicitud.
- **RF-53.** El sistema debe permitir que un administrador acepte o rechace una apelación pendiente y registre el fundamento de su decisión.
- **RF-54.** Cuando una apelación sea aceptada, la sanción correspondiente debe quedar absuelta y dejar de impedir nuevos préstamos.
- **RF-55.** El sistema debe conservar el historial de apelaciones, incluyendo el usuario, la sanción apelada, las fechas, el resultado y el administrador que resolvió cada solicitud.
- **RF-56.** Las sanciones y apelaciones resueltas no deben sobrescribirse ni eliminarse del historial por cambios posteriores en una regla o por nuevas decisiones sobre el mismo usuario.

El tratamiento del porcentaje de confianza después de aceptar una apelación está pendiente de definición; no debe asumirse una restitución automática hasta que esa regla sea acordada.
