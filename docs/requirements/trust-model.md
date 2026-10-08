# Modelo de confianza

El modelo de confianza permite representar el cumplimiento de las reglas por parte de cada usuario y aplicar las condiciones de préstamo que correspondan. Esta definición es conceptual; los valores marcados como pendientes no deben asumirse durante la implementación.

En el diseño actual, **Confianza** se trata como un bounded context de soporte. Referencia al usuario mediante `usuarioId` y concentra el porcentaje, el nivel, las restricciones derivadas, las sanciones y sus apelaciones. **Apelaciones no constituye otro bounded context por ahora**: su ciclo de vida depende directamente de una sanción y no presenta todavía reglas, lenguaje o integraciones independientes que justifiquen separarlo.

## Porcentaje y niveles

- Cada usuario tendrá un porcentaje de confianza dentro del intervalo cerrado de **0 a 100**.
- El porcentaje determinará uno de **cuatro niveles de confianza**.
- Los límites exactos de los cuatro niveles están **pendientes de definición**.
- El porcentaje inicial asignado a un usuario está **pendiente de definición**.
- Los usuarios con niveles bajos podrán tener restricciones de préstamo, pero los niveles afectados y las restricciones concretas están **pendientes de definición**.
- El sistema deberá impedir que el porcentaje tome valores fuera del intervalo permitido. El mecanismo para mantener esa invariante todavía no está definido.

## Incumplimientos y penalizaciones

Cada incumplimiento puede reducir la confianza en un porcentaje diferente. La penalización:

- pertenece a la regla incumplida;
- representa la gravedad de esa regla;
- se obtiene de su configuración persistida, no de una constante en el código;
- puede ser definida y modificada por administradores;
- debe registrarse con el incumplimiento para conservar cuánto se descontó realmente.

Los cambios posteriores en una regla no deben alterar la penalización que quedó registrada en incumplimientos anteriores. Esta conservación histórica se detalla en [términos y condiciones](terms-and-conditions.md).

Porcentajes como **5 %**, **10 %** o **12 %** son únicamente ejemplos ilustrativos. No representan valores aprobados ni deben utilizarse como configuración predeterminada.

## Sanciones

Una sanción representa la consecuencia aplicada por un operador a un usuario a partir de un incumplimiento. Para estudiantes, cada versión de regla aplicable debe definir el tiempo durante el cual no podrán solicitar nuevos préstamos.

Cada sanción debe conservar:

- el usuario sancionado;
- el incumplimiento, la regla y la versión exacta que la originaron;
- la cuenta del operador que la impuso;
- las fechas de inicio y fin;
- su estado: activa, finalizada o absuelta;
- la confianza anterior y posterior, de forma que el cambio aplicado permanezca trazable.

Mientras una sanción de restricción de préstamo esté activa, el estudiante no podrá solicitar nuevos préstamos. Las sanciones finalizadas o absueltas no se sobrescriben: su colección constituye el historial de penalizaciones del usuario.

## Apelaciones

El usuario puede apelar una sanción activa asociada a su cuenta cuando considere que no está justificada. La apelación debe conservar la referencia a la sanción y al usuario, la fecha y el motivo de la solicitud.

Solo un administrador puede resolverla. La resolución debe registrar si fue aceptada o rechazada, la fecha, el administrador responsable y su fundamento. Si se acepta, la sanción queda absuelta y deja de bloquear nuevos préstamos; si se rechaza, la sanción conserva su vigencia original.

Las apelaciones resueltas forman un historial y no se reemplazan por solicitudes posteriores. El efecto de una apelación aceptada sobre el porcentaje de confianza todavía no está definido: no debe asumirse una restitución total, parcial ni automática.

## Definiciones pendientes

| Aspecto | Estado actual |
| --- | --- |
| Porcentaje inicial | Pendiente de definición. |
| Límites de los cuatro niveles | Pendientes de definición. |
| Restricciones por nivel | Pendientes de definición. |
| Mecanismos para aumentar la confianza | No definidos; no deben incorporarse todavía. |
| Efecto de una apelación aceptada sobre la confianza | Pendiente de definición. |

Las reglas generales que sustentan este modelo se encuentran en [reglas de negocio](business-rules.md).
