# Modelo de confianza

Este documento especifica la confianza de los usuarios, las restricciones por categoría, las recompensas y el efecto de faltas, sanciones y apelaciones. Se trata de reglas de dominio **vigentes**, no de una declaración de implementación. La configuración numérica de las sanciones reside en las [versiones de términos y reglas](terms-and-conditions.md).

**Límite de dominio:** Confianza es un contexto delimitado de soporte que referencia al usuario mediante `usuarioId`. Administra `PerfilConfianza`, sanciones y apelaciones. Las apelaciones son parte de ese contexto porque revisan sanciones y no constituyen, en esta versión, un contexto independiente.

## Porcentaje inicial y niveles

Todo usuario cuya cuenta haya sido aprobada comienza con **75 puntos porcentuales** de confianza. El porcentaje siempre se mantiene en el intervalo cerrado **[0, 100]**.

| Intervalo de confianza | Nivel | Interpretación |
| --- | --- | --- |
| 75 ≤ confianza ≤ 100 | **Excelente** | Confianza suficiente para todas las categorías habilitadas para el nivel. |
| 50 ≤ confianza < 75 | **Confiable** | Acceso a categorías habilitadas para este nivel. |
| 25 ≤ confianza < 50 | **En observación** | Acceso limitado a categorías menos restringidas. |
| 0 ≤ confianza < 25 | **Crítico** | Acceso solo a las categorías que autorice la política; no implica, por sí solo, sanción indefinida. |

El nivel se **deriva** del porcentaje; no debe introducirse una segunda fuente de verdad inconsistente. Cada actualización usa límites: `max(0, min(100, valor))`.

## Acceso permitido según categoría

Cada categoría guarda explícitamente los niveles a los que permite acceder. Configuración inicial vigente para desarrollo, conforme a [términos y condiciones](terms-and-conditions.md#3-categorías-duración-y-acceso), sin acreditar aprobación institucional externa:

| Categoría | Excelente | Confiable | En observación | Crítico |
| --- | :---: | :---: | :---: | :---: |
| Electrónicos | Sí | Sí | No | No |
| Libros | Sí | Sí | Sí | No |
| Deportes | Sí | Sí | Sí | No |

La tabla es una **configuración inicial**, no una condición codificada dentro de las entidades. El administrador podrá modificar la política persistida y versionada para nuevas solicitudes. La elegibilidad se determina además por aprobación institucional, aceptación vigente de términos, disponibilidad, límites simultáneos y restricciones de sanciones. Una sanción activa puede bloquear aunque el nivel permita una categoría.

## Recompensa por devolución correcta

Una devolución **puntual, completa y sin daño o incidencia** recompensa al usuario con el **10 % del porcentaje de penalización de referencia de la categoría del ejemplar**, sin sobrepasar 100 puntos.

| Categoría | Penalización de referencia inicial | Recompensa por devolución correcta |
| --- | ---: | ---: |
| Electrónicos | 30 puntos | **+3 puntos** |
| Libros | 10 puntos | **+1 punto** |
| Deportes | 10 puntos | **+1 punto** |

La penalización de referencia debe quedar **persistida por categoría/política** y puede variar mediante una versión posterior. La fuente normativa es [términos y condiciones, sección 9](terms-and-conditions.md#9-recompensa-por-devolución-puntual-y-sin-faltas), no la maqueta. No debe confundirse «10 % de la penalización» con «recuperar el 10 % de la confianza que le quede al usuario».

- Si hubo tardanza, daño, falta de piezas, pérdida o robo, **no hay recompensa** por esa devolución.
- Si existe un único préstamo devuelto correctamente, se aplica una sola recompensa; no se recompensa una mera reserva cancelada.
- El historial conserva porcentaje previo, recompensa calculada, referencia de la política y porcentaje resultante.

## Incumplimientos y penalizaciones

Las faltas se clasifican en **reglas independientes**:

1. **Devolución tardía:** se detecta automáticamente desde el instante en que vence el préstamo, **sin tolerancia**. La gravedad puede aumentar por tiempo transcurrido.
2. **Daño o piezas faltantes:** el operador consigna el estado en un formulario al recibir el ejemplar. El sistema determina la gravedad y consecuencia según la regla vigente.
3. **Pérdida o robo:** se registra como incidente independiente; lleva la confianza a cero y provoca bloqueo indefinido hasta resolución o apelación aceptada.
4. **Reserva no recogida:** la reserva pasa a VENCIDA al superar los 30 minutos posteriores a la hora pactada y se aplica una penalización menor, según configuración.

Cada consecuencia depende de **regla, categoría, grado de falta y versión vigente**. Las tablas numéricas están en [términos y condiciones](terms-and-conditions.md).

### Escalamiento de una misma tardanza

La misma tardanza **no genera tres descuentos completos** si atraviesa leve, moderada y grave. Por ejemplo, en electrónicos: después del primer tramo la penalización total es 10 puntos, después del segundo 20 y después del tercero 30. Se aplica **solo la diferencia** al ascender de tramo (10, luego 10, luego 10). Igual criterio para los días de bloqueo: representan la duración total correspondiente a la gravedad alcanzada, **no la suma de 7 + 15 + 30 días de una sola tardanza**.

Se conserva la traza de cada cambio de gravedad y de los ajustes practicados. Una falta ya resuelta no se vuelve a cobrar cuando se devuelve el ejemplar.

### Faltas diferentes: acumulación

**Sí se acumulan** las consecuencias de faltas independientes, incluso en una misma devolución. Una tardanza grave y un daño moderado son dos incumplimientos distintos, cada uno con su propia versión de regla, porcentaje, sanción y registro histórico.

- La confianza resultante descuenta la suma de penalizaciones, con un mínimo de 0.
- Los **días de suspensión de faltas diferentes se suman de forma consecutiva**, sin solaparlos: 7 + 30 = 37 días de restricción total.
- Las restricciones se computan una vez por incumplimiento, independientemente del número de transiciones internas de gravedad.
- Si existe una sanción indefinida, continúa el bloqueo hasta resolución; las sanciones temporales siguen registradas, pero el paso del tiempo no elimina el bloqueo indefinido.

## Sanciones y bloqueo

Una sanción conserva como mínimo:

- `sancionId`, `usuarioId`, `incumplimientoId`, `reglaId`, `versionReglaId`;
- categoría, gravedad, tipo de falta y responsable cuando corresponde;
- porcentaje configurado, **descuento efectivamente aplicado**, `confianzaAnterior` y `confianzaPosterior`;
- fechas de inicio y fin (fin opcional para bloqueo indefinido), estado y secuencia de ajustes;
- información del operador que constató daño o registró pérdida cuando hubo intervención humana.

El sistema detecta la tardanza y puede crear o actualizar su consecuencia **automáticamente**, sin esperar a que el operador reciba el ejemplar. El operador solo confirma condición física, piezas y daños al devolverlo. La clasificación se toma de la política versionada conservada al confirmar la reserva.

Una sanción de restricción activa bloquea nuevos préstamos y reservas al usuario afectado, independientemente de que sea estudiante, docente o administrativo. Los bloqueos por daño grave electrónico y pérdida/robo se mantienen **indefinidos**, hasta resolver el incidente internamente o absolver la sanción mediante apelación.

La finalización por vencimiento y la absolución son estados diferentes; en ambos casos el historial permanece consultable.

## Apelaciones

- Solo el titular puede apelar una vez por sanción PROGRAMADA o ACTIVA, o durante 30 días desde su finalización; para faltas sin suspensión, desde su registro. Debe aportar motivo.
- Solo un **administrador** resuelve con fecha y fundamento dentro de 72 horas continuas; el retraso genera aviso, no absolución automática.
- EN_REVISION no suspende efectos ni el calendario de la sanción y debe resolverse aunque esta finalice.
- Una apelación rechazada no concede otra oportunidad por la misma sanción: continúa la consecuencia original.
- Una apelación aceptada marca la sanción como **absuelta**, levanta **su propia** restricción y **restituye los puntos de confianza efectivamente descontados por ella**, sin superar 100.
- Si existen otras sanciones independientes, sus descuentos y restricciones **no** se anulan al absolver una distinta.
- El cambio se registra como evento de restitución; no se borran el descuento original ni la resolución de la apelación.

Ejemplo: si una falta descontó efectivamente 20 puntos, una absolución reintegra esos 20 puntos (sujeto al máximo de 100), no necesariamente el porcentaje nominal configurado de la regla. Si existen cambios intermedios, deben calcularse sin restituir dos veces puntos ya devueltos ni borrar los demás efectos.

## Ciclo y configuración vigente

Todo préstamo nace de una reserva CONFIRMADA de un ejemplar concreto que queda RESERVADO inmediatamente. Al recoger, la reserva pasa a RECOGIDA y nace el préstamo ACTIVO; no existe un préstamo PLANIFICADO independiente. Un estudiante solo puede mantener una operación abierta en total, reserva CONFIRMADA o préstamo ACTIVO. Docentes y administrativos pueden mantener varias sobre ejemplares distintos.

La duración empieza en la recogida efectiva: **electrónicos 8 horas dentro del campus, libros 14 días y deportes 2 días**. Las políticas y duración se conservan al confirmar la reserva. Los cambios posteriores no modifican esa operación; la elegibilidad personal y términos vigentes se verifican nuevamente al entregar.

La ventana de recogida incluye los 30 minutos posteriores a la hora pactada. Después, la reserva pasa a VENCIDA y genera inasistencia. La cancelación válida o administrativa no genera esa falta.

Las reglas completas de acumulación, escalamiento y absolución están en [términos y condiciones](terms-and-conditions.md#8-acumulación-de-sanciones). Las suspensiones futuras usan PROGRAMADA, las efectivas ACTIVA y las terminadas FINALIZADA o ABSUELTA. Las sanciones sin suspensión se finalizan después del descuento y pueden apelarse durante 30 días desde su registro; las demás finalizadas, durante 30 días desde su finalización.

El administrador puede finalizar un bloqueo indefinido por solución material acreditada, guardando motivo, evidencia y fecha, **sin absolver ni devolver confianza**. Un saldo Crítico sigue impidiendo reservar, aun resuelto el incidente: no existe recuperación automática ni excepción administrativa al nivel. Solo una apelación aceptada restituye el descuento efectivo correspondiente. Otras restricciones siguen vigentes.
