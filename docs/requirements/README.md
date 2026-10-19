# Análisis de requisitos

Esta carpeta es la **fuente de verdad de los requisitos y políticas de negocio acordados** para el sistema de gestión de préstamos universitarios de la Escuela Profesional de Ciencia de la Computación (EPCC). Documenta el comportamiento esperado y **no implica que ya esté implementado**.

## Organización

| Documento | Contenido |
| --- | --- |
| [Requisitos funcionales](functional.md) | Capacidades del sistema e identificadores estables `RF-xx`. |
| [Requisitos no funcionales](non-functional.md) | Rendimiento, integridad, seguridad, persistencia, usabilidad y trazabilidad. |
| [Reglas de negocio](business-rules.md) | Invariantes y restricciones independientes de la interfaz. |
| [Modelo de confianza](trust-model.md) | Confianza inicial, cuatro niveles, acceso por categoría, recompensas, sanciones, acumulación y apelaciones. |
| [Términos y condiciones](terms-and-conditions.md) | Texto de aceptación, políticas por categoría, matrices de tardanza y daño, pérdida/robo, inasistencia a reservas, sanciones y versionado. |

El [modelo de dominio UML](../architecture/uml/README.md) y las [vistas DDD de Structurizr](../architecture/structurizr/README.md) deben revisarse para reflejar las nuevas políticas. **Actualizar estos Markdown no actualiza automáticamente el UML, Prisma ni el código**.

## Versión vigente

**Línea base de requisitos revisada al 19 de octubre de 2026.** Los valores, matrices y criterios de esta carpeta constituyen la versión vigente para el desarrollo. Se mantienen como configuración versionada y podrán modificarse en revisiones posteriores según la evolución de la aplicación.

Esta revisión documental no equivale a certificar que las funciones ya estén implementadas, probadas o aprobadas como normativa institucional.

## Ciclo y configuración vigente

Todo préstamo nace de una reserva CONFIRMADA de un ejemplar concreto que queda RESERVADO inmediatamente. Al recoger, la reserva pasa a RECOGIDA y nace el préstamo ACTIVO; no existe un préstamo PLANIFICADO independiente. Un estudiante solo puede mantener una operación abierta en total, reserva CONFIRMADA o préstamo ACTIVO. Docentes y administrativos pueden mantener varias sobre ejemplares distintos.

La duración empieza en la recogida efectiva: **electrónicos 8 horas dentro del campus, libros 14 días y deportes 2 días**. Las políticas y duración se conservan al confirmar la reserva. Los cambios posteriores no modifican esa operación; la elegibilidad personal y términos vigentes se verifican nuevamente al entregar.

La ventana de recogida incluye los 30 minutos posteriores a la hora pactada. Después, la reserva pasa a VENCIDA y genera inasistencia. La cancelación válida o administrativa no genera esa falta.

Las reglas completas de acumulación, escalamiento y absolución están en [términos y condiciones](terms-and-conditions.md#8-acumulación-de-sanciones). Las suspensiones futuras usan PROGRAMADA, las efectivas ACTIVA y las terminadas FINALIZADA o ABSUELTA. Las sanciones sin suspensión se finalizan después del descuento y pueden apelarse durante 30 días desde su registro; las demás finalizadas, durante 30 días desde su finalización.

El administrador puede finalizar un bloqueo indefinido por solución material acreditada, guardando motivo, evidencia y fecha, **sin absolver ni devolver confianza**. Un saldo Crítico sigue impidiendo reservar, aun resuelto el incidente: no existe recuperación automática ni excepción administrativa al nivel. Solo una apelación aceptada restituye el descuento efectivo correspondiente. Otras restricciones siguen vigentes.

## Identificadores y mantenimiento

- `RF-xx`: requisito funcional. Se mantienen los **RF-01 a RF-56** y se agregan RF-57 en adelante sin renumerar.
- `RNF-xx`: requisito no funcional. Se conservan los diez originales y se añaden los necesarios.
- `RN-xx`: regla de negocio. Se mantienen los identificadores RN-01 a RN-29 y se incorporan los adicionales.
- La versión de la regla aplicable se guarda al registrar una falta. Una actualización de términos no modifica sanciones históricas.
- Los cambios posteriores en valores o criterios deben registrarse como una revisión de esta línea base y de las políticas correspondientes.

La documentación y sus diagramas son independientes de la implementación actual. La visualización del proyecto puede consumir estos archivos, pero no reemplazarlos como fuente de verdad.
