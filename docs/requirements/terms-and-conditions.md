# Términos y condiciones

Los términos y condiciones no serán texto estático incorporado en el código. Sus reglas estarán persistidas en la base de datos y podrán ser gestionadas dinámicamente por administradores.

## Información conceptual de una regla

Cada regla deberá poder contener, al menos, la siguiente información:

| Campo conceptual | Propósito |
| --- | --- |
| Identificador | Distinguir la regla de manera estable. |
| Título | Nombrar la regla. |
| Descripción | Expresar la condición de uso o conducta esperada. |
| Porcentaje de penalización de confianza | Representar su gravedad y determinar el descuento aplicable ante un incumplimiento. |
| Consecuencia asociada | Definir la consecuencia vigente ante su incumplimiento. |
| Duración de restricción para estudiantes | Determinar cuánto tiempo impide solicitar préstamos una sanción derivada de esa versión. |
| Estado | Indicar si la regla está activa o inactiva. |
| Información de historial o versión | Conservar sus modificaciones y determinar qué contenido estuvo vigente. |

La representación técnica de estos campos todavía no está definida.

## Gestión y vigencia

Los administradores podrán:

- agregar reglas;
- modificar reglas existentes;
- activarlas o desactivarlas sin eliminarlas;
- configurar su porcentaje de penalización;
- asociar una consecuencia a cada regla;
- definir la duración de la restricción de préstamo aplicable a estudiantes.

Cada porcentaje representa la gravedad de la regla y debe proceder de su configuración persistida. Las consecuencias concretas y los porcentajes aplicables todavía no están definidos.

## Historial e incumplimientos

El sistema deberá conservar el historial o las versiones de las reglas. Cuando se registre un incumplimiento, el registro deberá conservar:

- la referencia a la regla infringida;
- el porcentaje de penalización realmente aplicado en ese momento.

Una modificación posterior de la regla no deberá cambiar la regla ni la penalización asociadas a un incumplimiento histórico.

Cuando un incumplimiento origine una sanción, esta deberá conservar también la versión aplicada y su intervalo de vigencia. Una modificación posterior de la duración configurada no deberá alterar sanciones ya registradas. Las apelaciones se registran en el [modelo de confianza](trust-model.md) y no modifican retroactivamente la versión histórica de la regla.

El sistema también deberá registrar qué versión de los términos y condiciones aceptó cada usuario. El mecanismo de versionado, la composición de cada versión y el proceso de aceptación están pendientes de definición.

## Conceptos de reglas conocidos

Las reglas actualmente identificadas comprenden:

- uso personal e intransferible de la cuenta;
- buen uso de los recursos;
- prohibición de uso con fines de lucro;
- responsabilidad ante pérdida, robo o daño;
- devolución dentro del plazo establecido.

Esta lista no define sanciones concretas. Las [reglas de negocio](business-rules.md) establecen las restricciones del dominio y el [modelo de confianza](trust-model.md) describe cómo se relacionan las penalizaciones con la confianza del usuario.
