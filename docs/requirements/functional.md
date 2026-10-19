# Requisitos funcionales

Los requisitos funcionales se organizan según los dominios o módulos identificados en la planificación actual.

## Gestión de usuarios

- **RF-01.** El sistema debe permitir que estudiantes, docentes y personal administrativo de la EPCC soliciten la creación de una cuenta.
- **RF-02.** El sistema debe permitir registrar la información institucional necesaria del usuario, incluyendo su tipo de usuario y su identificador institucional cuando corresponda.
- **RF-03.** El sistema debe permitir adjuntar y conservar evidencia de vinculación vigente con la EPCC. Para estudiantes se requiere imagen de carné o constancia de matrícula, revisada por un operador o administrador; para docentes y administrativos se registrará la evidencia institucional que corresponda.
- **RF-04.** El sistema debe permitir que un **operador o administrador** apruebe o rechace una solicitud de registro tras verificar la evidencia, **antes** de habilitar la cuenta.
- **RF-05.** El sistema debe permitir autenticar a los usuarios registrados mediante credenciales propias y mediante Google con correo institucional `@unsa.edu.pe`, sin omitir la aprobación de la solicitud; la aceptación vigente de términos se exige para nuevas reservas o préstamos, no para consultar la cuenta y el historial.
- **RF-06.** El sistema debe permitir identificar el tipo de usuario autenticado: estudiante, docente o administrativo.
- **RF-07.** El sistema debe permitir consultar si un usuario se encuentra habilitado para realizar préstamos.

## Gestión de recursos e inventario

- **RF-08.** El sistema debe permitir registrar recursos disponibles para préstamo.
- **RF-09.** El sistema debe permitir clasificar los recursos según su categoría, que mantiene la duración máxima del préstamo, los niveles de confianza admitidos y el porcentaje de penalización de referencia para recompensas.
- **RF-10.** El sistema debe permitir registrar uno o varios ejemplares físicos asociados a un mismo recurso.
- **RF-11.** Cada ejemplar debe mantener un estado que permita identificar su disponibilidad.
- **RF-12.** El sistema debe permitir consultar los recursos y ejemplares registrados.
- **RF-13.** Un recurso habilitado está disponible si tiene al menos un ejemplar DISPONIBLE. Los ejemplares RESERVADO, PRESTADO o NO_DISPONIBLE no admiten otra reserva.
- **RF-14.** El sistema debe permitir registrar observaciones relacionadas con el estado de un ejemplar.

## Gestión de préstamos

- **RF-15.** Todo préstamo nace de una reserva confirmada de un ejemplar concreto. Una recogida inmediata también exige confirmar primero su reserva; no hay entrega directa sin reserva.
- **RF-16.** El sistema verifica elegibilidad al confirmar la reserva y al recoger: aprobación, vinculación vigente, términos aceptados, confianza por categoría, ausencia de restricciones efectivas y cupo disponible.
- **RF-17.** Cada ejemplar admite una sola operación abierta: una reserva CONFIRMADA o un préstamo ACTIVO. La confirmación lo bloquea inmediatamente, aunque la hora de recogida sea futura.
- **RF-18.** La duración se cuenta desde la recogida efectiva: electrónicos 8 horas, libros 14 días y deportes 2 días. Es un atributo versionado de categoría; cualquier duración electrónica debe ser positiva y menor de 24 horas, con uso exclusivo dentro del campus.
- **RF-19.** El operador o administrador confirma la entrega dentro de la ventana de recogida. En una transacción la reserva pasa a RECOGIDA, nace el préstamo ACTIVO vinculado y el ejemplar pasa de RESERVADO a PRESTADO.
- **RF-20.** El sistema debe permitir registrar la devolución de un ejemplar.
- **RF-21.** Al registrar una devolución, el ejemplar debe volver a encontrarse disponible siempre que su estado permita continuar prestándolo.
- **RF-22.** El sistema debe permitir registrar observaciones durante la devolución cuando se detecte daño, mal estado u otra incidencia.
- **RF-23.** El sistema debe permitir consultar los préstamos activos.
- **RF-24.** El sistema debe mantener un historial de préstamos por usuario.
- **RF-25.** El sistema debe identificar préstamos que hayan superado su fecha u hora límite de devolución.
- **RF-26.** Un estudiante solo puede mantener una operación abierta en total: una reserva CONFIRMADA o un préstamo ACTIVO. Docentes y administrativos pueden mantener varias sobre ejemplares distintos, sujetos a las demás restricciones.
- **RF-27.** El sistema impide confirmar otra reserva a un estudiante con una reserva CONFIRMADA o préstamo ACTIVO, incluso ante peticiones concurrentes. Recoger transforma la misma operación y no consume un segundo cupo.

## Confianza del usuario

- **RF-28.** El sistema debe mantener un porcentaje de confianza asociado a cada usuario, inicializado en **75 %** cuando se aprueba su cuenta.
- **RF-29.** El sistema debe clasificar al usuario según: **Excelente (75 ≤ confianza ≤ 100), Confiable (50 ≤ confianza < 75), En observación (25 ≤ confianza < 50), Crítico (0 ≤ confianza < 25)**.
- **RF-30.** El sistema debe permitir consultar el porcentaje y nivel de confianza del usuario.
- **RF-31.** El sistema debe aplicar restricciones de préstamo según el nivel de confianza del usuario y los **niveles admitidos configurados para cada categoría**.
- **RF-32.** El sistema debe actualizar el porcentaje de confianza cuando se registre o escale el incumplimiento de una regla, evitando cobrar varias veces los tramos de **una misma** tardanza y acumulando los efectos de incumplimientos **diferentes**.
- **RF-33.** El sistema debe impedir que el porcentaje de confianza tome valores fuera de **[0, 100]**, incluidos los efectos de las faltas acumuladas, recompensas y apelaciones.

## Reglas, términos y condiciones

- **RF-34.** El sistema debe permitir a los administradores registrar reglas de uso.
- **RF-35.** El sistema debe permitir modificar las reglas existentes.
- **RF-36.** El sistema debe permitir activar o desactivar reglas sin necesidad de eliminarlas.
- **RF-37.** Cada regla sancionable debe permitir configurar su penalización de confianza por **categoría de recurso, gravedad y versión**, incluyendo leve, moderada y grave para tardanza y daño.
- **RF-38.** El porcentaje de penalización, sus umbrales y la duración del bloqueo deben poder ser definidos y modificados por un administrador mediante versiones, conservando las anteriores.
- **RF-39.** Cada regla debe permitir definir su consecuencia, incluida una suspensión temporal en días o un bloqueo indefinido en los supuestos autorizados.
- **RF-40.** El sistema debe permitir consultar las reglas vigentes.
- **RF-41.** El sistema debe permitir registrar el incumplimiento de una regla por parte de un usuario.
- **RF-42.** Al registrar un incumplimiento, el sistema debe aplicar el descuento configurado en la versión de regla correspondiente, o establecer confianza en 0 cuando la consecuencia así lo determine; debe guardar el **descuento realmente aplicado**.
- **RF-43.** El registro del incumplimiento debe conservar la referencia a la regla infringida.
- **RF-44.** El registro del incumplimiento debe conservar la regla, categoría, gravedad, versión, penalización nominal y **descuento realmente aplicado**, incluso si después cambia la regla.
- **RF-45.** El sistema debe considerar las consecuencias y restricciones vigentes al determinar si un usuario puede realizar un nuevo préstamo.
- **RF-46.** El sistema debe conservar un historial de modificaciones o versiones de las reglas.
- **RF-47.** El sistema debe registrar qué versión de los términos y condiciones aceptó cada usuario y exigir una nueva aceptación cuando cambien, antes de permitir otra reserva o préstamo.

## Sanciones y apelaciones

- **RF-48.** El sistema registra sanciones vinculadas al usuario, incumplimiento y política versionada, automáticamente por tardanza o inasistencia y por registro de operador o administrador ante daño, pérdida o robo. Una pérdida no requiere devolución física.
- **RF-49.** Cada sanción debe conservar inicio, fin **o condición de bloqueo indefinido**, estado, responsable o proceso automático, y los valores de confianza anterior, posterior y efectivamente descontado.
- **RF-50.** Una restricción efectiva impide confirmar reservas y recoger. Si sobreviene, se cancelan las reservas no recogidas del usuario sin inasistencia; no cancela préstamos activos ni impide devolverlos.
- **RF-51.** La duración temporal o el bloqueo indefinido deben obtenerse de la versión de regla aplicable y quedar registrados con su criterio de cálculo y los eventuales ajustes por escalamiento.
- **RF-52.** El titular puede presentar una sola apelación por sanción PROGRAMADA o ACTIVA, o dentro de los 30 días posteriores a su finalización. Para sanciones sin suspensión, la ventana comienza al registrarse. La apelación EN_REVISION no suspende sus efectos y se resuelve aunque la sanción finalice.
- **RF-53.** Solo un administrador resuelve apelaciones EN_REVISION con fundamento, fecha y resultado, dentro de 72 horas continuas. Superar el plazo genera aviso, no absolución automática.
- **RF-54.** Cuando una apelación sea aceptada, la sanción queda absuelta, se elimina **su** restricción y se restituyen los puntos de confianza **efectivamente descontados por esa sanción**, sin borrar otras sanciones ni superar 100.
- **RF-55.** El sistema debe conservar el historial de apelaciones, incluyendo el usuario, la sanción apelada, las fechas, el resultado y el administrador que resolvió cada solicitud.
- **RF-56.** Las sanciones, sus cambios de gravedad, apelaciones, absoluciones y restituciones deben conservarse en el historial, sin sobrescribir registros resueltos ni alterar versiones históricas.

Las políticas y matrices numéricas de la versión vigente se detallan en [términos y condiciones](terms-and-conditions.md).

## Especificaciones complementarias

Los requisitos RF-57 en adelante amplían la versión inicial sin modificar los identificadores existentes.

### Reservas y control de tiempos

- **RF-57.** El usuario confirma una reserva de un ejemplar DISPONIBLE para una hora igual o posterior a la actual. La confirmación bloquea inmediatamente la unidad y conserva duración, categoría y políticas aplicables.
- **RF-58.** La recogida se permite desde la hora pactada hasta esa hora más 30 minutos, inclusive. Después la reserva no recogida pasa a VENCIDA, libera la unidad apta y genera una sola inasistencia.
- **RF-59.** El sistema debe registrar la inasistencia a una reserva como una regla diferenciada, aplicar un descuento menor de confianza configurable y conservar la cancelación. La escala vigente es de **2/3/5 puntos** para la primera, segunda y tercera o siguientes inasistencias, respectivamente, dentro de una ventana móvil de 30 días.
- **RF-60.** El sistema debe detectar automáticamente la devolución tardía **sin tolerancia**, determinar su gravedad según categoría y tiempo transcurrido, y escalar la consecuencia conforme a la versión vigente de la regla.
- **RF-61.** El sistema debe evitar aplicar varias veces las penalizaciones completas leve, moderada y grave **sobre un mismo episodio de tardanza**; al escalar debe cobrar solo el incremento de la consecuencia total.

### Inspección, pérdida y recompensas

- **RF-62.** Al recibir un ejemplar, el operador debe completar un formulario que indique si está **completo, en buen estado o con daño**, y registrar las observaciones correspondientes. El sistema aplicará la matriz de daño por categoría y gravedad.
- **RF-63.** La pérdida o robo confirmado cierra el préstamo como CERRADO_POR_INCIDENCIA, sin simular devolución ni recompensa; deja el ejemplar NO_DISPONIBLE, establece confianza en cero y genera bloqueo indefinido.
- **RF-64.** El sistema debe establecer la confianza en **0 %** y mantener un bloqueo indefinido cuando corresponda **daño grave de electrónico**.
- **RF-65.** El sistema debe **sumar** descuentos y días de suspensión de incumplimientos distintos y mantener el historial de cada uno; ninguna operación puede reducir la confianza por debajo de 0.
- **RF-66.** Al devolver un ejemplar dentro de plazo y sin daño ni incidencias, el sistema debe conceder una recompensa equivalente al **10 % de la penalización de referencia de su categoría**, con máximo 100 % de confianza.

### Registro, permisos, términos e inventario

- **RF-67.** El sistema debe aceptar el acceso mediante **Google con correo institucional `@unsa.edu.pe`**, sin conceder autorización de préstamo a usuarios aún no aprobados.
- **RF-68.** El sistema debe permitir que **operadores y administradores** verifiquen y decidan las solicitudes de registro; el administrador dispone de todas las operaciones autorizadas al operador.
- **RF-69.** El sistema debe exigir a un estudiante la imagen de su **carné o constancia de matrícula** en la solicitud y conservar la decisión de revisión de esa evidencia.
- **RF-70.** El sistema debe exigir la aceptación de los términos al registrarse y de cada nueva versión antes de cualquier nueva reserva o préstamo, permitiendo mientras tanto consultar el historial.
- **RF-71.** El sistema debe permitir **desactivar** un recurso con historial de préstamos sin eliminarlo físicamente ni destruir referencias históricas.
- **RF-72.** El sistema debe proporcionar una **sección de notificaciones dentro de la aplicación**, sin exigir en esta versión correo, SMS ni servicios de notificación externos.
- **RF-73.** El sistema debe guardar por categoría el **plazo máximo**, los **niveles admitidos** y el **porcentaje de referencia de recompensa**; la consecuencia de las faltas se configura por regla, categoría, gravedad y versión.
- **RF-74.** Los electrónicos se prestan inicialmente por 8 horas desde la recogida. El sistema impide configurar 24 horas o más y muestra la prohibición de retirarlos del campus; el control físico corresponde al operador, no a geolocalización.
- **RF-75.** El sistema debe conservar el registro de los ajustes automáticos de gravedad, descuentos y restricciones, manteniendo la trazabilidad y evitando duplicar cargos al devolver.

La distribución exacta de importes y umbrales se encuentra en [términos y condiciones](terms-and-conditions.md). Los cambios posteriores deben conservar las versiones históricas aplicadas.

## Cancelación y resolución administrativa

- **RF-76.** El titular puede cancelar una reserva CONFIRMADA hasta el final de su ventana de recogida, sin descuento. El operador o administrador puede cancelarla por indisponibilidad o pérdida de elegibilidad con motivo y sin inasistencia. Después de la ventana corresponde vencimiento.
- **RF-77.** La devolución cierra el préstamo aun con sanciones o términos sin aceptar. Solo un ejemplar apto y habilitado vuelve a DISPONIBLE; una devolución correcta concede una recompensa única según la política fijada al reservar.
- **RF-78.** Solo un administrador puede finalizar un bloqueo indefinido tras verificar la solución material. Registra evidencia, motivo y fecha; no absuelve ni restituye confianza.
- **RF-79.** Las suspensiones temporales se ejecutan consecutivamente por orden de registro. Escalar amplía solo su duración total; absolver elimina su tiempo restante y reprograma las siguientes, conservando la historia.
