# Términos y condiciones de uso del sistema de préstamos universitarios

Este documento define el **texto y las políticas que se presentarán para aceptación del usuario**, junto con su configuración y versionado. Las reglas no son constantes fijadas en el frontend: el sistema debe almacenarlas en la base de datos, permitir su administración y conservar las versiones aplicadas. Esta documentación describe el producto objetivo; no garantiza que cada función esté implementada.

> **Versión vigente:** línea base revisada al 19 de octubre de 2026. Las tablas y criterios siguientes se adoptan como configuración actual para el desarrollo y podrán cambiar mediante nuevas versiones. Esta revisión no acredita su implementación ni una aprobación institucional externa.

## 1. Aceptación y vigencia

1. El sistema es para **estudiantes, docentes y personal administrativo con vinculación vigente con la EPCC**. La cuenta es personal e intransferible.
2. La solicitud de registro requiere datos de identificación, correo institucional **`@unsa.edu.pe`**, contraseña si se utiliza acceso con contraseña y evidencia de vinculación. Para **estudiantes** debe adjuntarse imagen de carné o constancia de matrícula, verificable por operador o administrador. La documentación equivalente para docentes y administrativos debe acreditarse conforme al procedimiento institucional.
3. El acceso con **Google y correo institucional** es una forma adicional de autenticación, **no** reemplaza la revisión de la solicitud ni habilita automáticamente cuentas no aprobadas.
4. El usuario debe aceptar la **versión vigente** de estos términos al registrarse. Si los términos cambian, deberá aceptar expresamente la nueva versión **antes de realizar otra reserva o préstamo**. Mientras tanto podrá ingresar para consultar su información e historial, si su cuenta continúa habilitada.
5. Cada aceptación registra el usuario, la **versión exacta** y la fecha/hora. Modificar el contenido genera una nueva versión; no se reescriben aceptaciones anteriores.
6. Las reglas de sanción publicadas y conservadas al confirmar la reserva determinan las consecuencias de esa operación. Su configuración y sus antecedentes pueden consultarse en el sistema según los permisos correspondientes.

## 2. Obligaciones del usuario

- Utilizar correctamente los recursos, sin emplearlos con fines de lucro ni ceder el ejemplar o la cuenta a terceros.
- Revisar el recurso recibido y conservar sus componentes; comunicar las incidencias al operador.
- Devolver el **mismo ejemplar** en la fecha/hora establecida y con todas sus piezas.
- Responder por daños, pérdida o robo detectados durante el periodo de asignación, sujetos a verificación y posibilidad de apelación.
- Usar los electrónicos **únicamente dentro de la universidad**: no pueden retirarse del campus.
- Presentarse a recoger la reserva a la hora elegida o **dentro de los 30 minutos siguientes**.
- Reconocer que el desgaste normal por uso correcto no constituye por sí solo una falta sancionable; debe distinguirse de daños atribuibles al uso indebido.

## 3. Categorías, duración y acceso

**La duración máxima es un atributo de categoría**, no de cada recurso. La categoría también configura niveles de confianza admitidos y un porcentaje de penalización de referencia para calcular recompensas.

| Categoría | Plazo máximo de préstamo | Condición de uso | Niveles admitidos inicialmente | Penalización de referencia para recompensa |
| --- | --- | --- | --- | ---: |
| Electrónicos | **8 horas desde la recogida**; duración configurable positiva y menor de 24 h | **Solo dentro del campus** | Excelente y Confiable | 30 puntos |
| Libros | **14 días** | Conforme al préstamo autorizado | Excelente, Confiable y En observación | 10 puntos |
| Deportes | **2 días** | Conforme al préstamo autorizado | Excelente, Confiable y En observación | 10 puntos |

**Rectificación de Figma:** la maqueta muestra algunos electrónicos con préstamos de 3 o 7 días. **Esos plazos dejan de ser válidos como criterio de diseño**; deberán reemplazarse por un único plazo **por categoría**, menor de 24 horas y compatible con la permanencia del recurso dentro de la universidad.

### Confianza y límites simultáneos

- Cada cuenta aprobada inicia con **75 %** y se clasifica según los rangos de [modelo de confianza](trust-model.md): **Excelente 75 ≤ confianza ≤ 100**, **Confiable 50 ≤ confianza < 75**, **En observación 25 ≤ confianza < 50**, **Crítico 0 ≤ confianza < 25**.
- Cada categoría autoriza los niveles indicados en la tabla; **Crítico** no accede inicialmente a ninguna de las tres categorías. El administrador puede cambiar la configuración para versiones futuras.
- Cada **estudiante puede mantener una sola operación abierta en total**: reserva CONFIRMADA o préstamo ACTIVO; no puede confirmar otra reserva hasta cerrar esa operación.
- Los **docentes y administrativos no tienen un límite numérico general de reservas confirmadas o préstamos activos**; continúan sujetos a disponibilidad, nivel permitido, sanciones y otras reglas.
- El rol técnico `OPERADOR` o `ADMINISTRADOR` **no es equivalente** al tipo institucional de usuario. Los permisos administrativos no exoneran del cumplimiento de las reglas al pedir prestado para uso personal.

## 4. Reservas y recogida

Todo préstamo empieza por una reserva, incluso si la recogida es inmediata. El usuario confirma un ejemplar DISPONIBLE para una hora igual o posterior a la actual. El ejemplar pasa inmediatamente a RESERVADO; no admite otra reserva futura mientras continúe ocupado.

| Objeto | Estados y transiciones |
| --- | --- |
| Reserva | CONFIRMADA → RECOGIDA, CANCELADA o VENCIDA; estos tres estados son terminales. |
| Préstamo | Nace ACTIVO al recoger; termina FINALIZADO por devolución o CERRADO_POR_INCIDENCIA por pérdida/robo confirmado. Vencido es una condición del préstamo ACTIVO. |
| Ejemplar | DISPONIBLE → RESERVADO → PRESTADO. Solo vuelve a DISPONIBLE si sigue apto y habilitado; en otro caso queda NO_DISPONIBLE. |

- La reserva RECOGIDA y su préstamo constituyen la misma operación para el cupo del estudiante. No existe préstamo PLANIFICADO independiente.
- Se recoge en **[hora pactada, hora pactada + 30 minutos]**, incluidos ambos extremos. Antes no se entrega; después la reserva pasa a VENCIDA y genera una sola inasistencia.
- El titular puede cancelar sin descuento mientras la reserva esté CONFIRMADA y dentro de esa ventana o antes de ella. Después corresponde vencimiento por inasistencia.
- El operador o administrador comprueba identidad, elegibilidad y estado físico al entregar. Una pérdida de vinculación, nivel permitido o restricción efectiva cancela sin inasistencia. La falta de aceptación de nuevos términos debe subsanarse dentro de la misma ventana, sin extenderla.
- La cancelación administrativa por indisponibilidad o desactivación requiere motivo y no sanciona al usuario; no se sustituye silenciosamente el ejemplar reservado.
- Al recoger se fija fechaInicio a la recogida efectiva y fechaFin a esa fecha más la duración conservada al reservar. Crear la reserva no consume tiempo de préstamo.
- Confirmar, recoger, cancelar y vencer requieren transiciones atómicas e idempotentes. Ante concurrencia solo una transición válida puede ganar.
- Sin recogida no se crea préstamo, devolución, tardanza ni recompensa. Las cancelaciones y vencimientos conservan su historial.

### Regla R-RES: inasistencia a una reserva

Se aplican descuentos de **2, 3 y 5 puntos** según las inasistencias del **mismo usuario dentro de una ventana móvil de 30 días**, contando la actual y las anteriores no absueltas en (instante actual − 30 días, instante actual]. Una absolución cambia conteos futuros sin recalcular sanciones anteriores:

| Inasistencia durante los últimos 30 días | Gravedad | Descuento | Días de suspensión |
| --- | --- | ---: | ---: |
| Primera | Leve | −2 puntos | 0 |
| Segunda | Moderada | −3 puntos | 0 |
| Tercera y siguientes | Grave | −5 puntos | 0 |

## 5. Regla R-TAR: devolución tardía

**No existe tolerancia de entrega.** Todo instante posterior a `fechaFin` constituye retraso. El sistema calcula automáticamente la diferencia entre la hora actual y la fecha/hora límite del préstamo, y determina la gravedad correspondiente **por categoría**.

**Una misma tardanza se agrava, no se multiplica.** Cuando supera un nuevo umbral, su consecuencia total cambia de leve a moderada o grave. La actualización registra el ajuste de puntos y de plazo, pero **no crea tres descuentos completos por el mismo retraso**. Las faltas de tipos distintos sí se acumulan.

Los porcentajes de las tablas se expresan en **puntos porcentuales de confianza** (−10 puntos significa, por ejemplo, pasar de 75 % a 65 %).

### Electrónicos

| Tiempo de retraso (sin tolerancia) | Gravedad | Penalización total | Suspensión total |
| --- | --- | ---: | ---: |
| Más de 0 y hasta 1 hora | Leve | **−10 puntos** | **7 días** |
| Más de 1 y hasta 3 horas | Moderada | **−20 puntos** | 15 días |
| Más de 3 horas | Grave | **−30 puntos** | **30 días** |

### Libros

| Tiempo de retraso | Gravedad | Penalización total | Suspensión total |
| --- | --- | ---: | ---: |
| Más de 0 y hasta 24 horas | Leve | **−10 puntos** | **7 días** |
| Más de 24 y hasta 72 horas | Moderada | −15 puntos | 14 días |
| Más de 72 horas | Grave | −20 puntos | 30 días |

### Deportes

| Tiempo de retraso | Gravedad | Penalización total | Suspensión total |
| --- | --- | ---: | ---: |
| Más de 0 y hasta 3 horas | Leve | **−10 puntos** | **7 días** |
| Más de 3 y hasta 12 horas | Moderada | −15 puntos | 14 días |
| Más de 12 horas | Grave | −20 puntos | 30 días |

### Aplicación automática y escalamiento

1. El sistema detecta la tardanza cuando `ahora > fechaFin`.
2. Registra el incumplimiento con su categoría, versión de regla, gravedad y descuentos efectivamente aplicados; no depende del formulario del operador.
3. Si la tardanza cruza otro umbral, incrementa **solo la diferencia** necesaria hasta la consecuencia total de la nueva gravedad y registra el evento de escalamiento.
4. La devolución o pérdida/robo confirmado detienen el escalamiento en su instante efectivo, sin simular devolución del ejemplar perdido.
5. Cuando se registra la devolución, no vuelve a descontar la parte ya aplicada automáticamente.

**Ejemplo:** un electrónico pasa por −10, luego alcanza un total de −20 y finalmente −30. Los cargos incrementales son 10 + 10 + 10 = **30**, y su suspensión corresponde a **30 días en total** por esa tardanza, no a 7 + 15 + 30.

## 6. Regla R-DAN: daño o piezas faltantes

Al recibir el ejemplar, un **operador** debe registrar en un formulario si el artículo y sus accesorios están completos y si existe daño. La descripción y clasificación se apoyan en los criterios siguientes; el sistema consulta la política de sanción por **categoría y gravedad**.

**Desgaste normal** por uso correcto no genera falta. La gravedad se determina según el daño real y no simplemente por el valor comercial del artículo. Si el operador identifica distintos daños que pertenecen al **mismo incidente de devolución**, debe evitar duplicar una misma falta por descripciones equivalentes; si son incumplimientos independientes, se registran con su propia evidencia.

### Electrónicos

| Gravedad | Ejemplos orientativos | Penalización | Suspensión |
| --- | --- | ---: | ---: |
| Leve | Rayón o daño estético atribuible a uso indebido, sin afectar funcionamiento | −10 puntos | 7 días |
| Moderada | Daño funcional reparable, accesorio esencial dañado o pieza faltante recuperable | −30 puntos | 30 días |
| Grave | Equipo inutilizable o daño crítico | **Confianza a 0 %** | **Bloqueo indefinido**, sujeto a resolución interna o apelación aceptada |

### Libros

| Gravedad | Ejemplos orientativos | Penalización | Suspensión |
| --- | --- | ---: | ---: |
| Leve | Una línea pintada, pequeño subrayado o marca aislada atribuible a mal uso | **−10 puntos** | **7 días** |
| Moderada | Varias páginas intervenidas o daño reparable relevante | −20 puntos | 15 días |
| Grave | Varias hojas rotas o arrancadas, mojado severo o libro inutilizable | −30 puntos | 30 días |

### Deportes

| Gravedad | Ejemplos orientativos | Penalización | Suspensión |
| --- | --- | ---: | ---: |
| Leve | Deterioro superficial atribuible a uso indebido que no afecta el uso | **−10 puntos** | **7 días** |
| Moderada | Daño funcional reparable o accesorio incompleto | −20 puntos | 15 días |
| Grave | Rotura importante o pérdida de utilidad del artículo | −30 puntos | 30 días |

### Estado posterior a la devolución

El operador registra condiciones y observaciones. **No debe volver a marcarse `DISPONIBLE` un ejemplar que necesita inspección, reparación o reposición**: permanece `NO_DISPONIBLE` hasta nueva verificación. Esta condición debe conservarse en el inventario hasta que el ejemplar vuelva a ser apto para préstamo.

## 7. Regla R-PER: pérdida o robo

La pérdida o robo confirmado cierra el préstamo como CERRADO_POR_INCIDENCIA y deja el ejemplar NO_DISPONIBLE, sin recompensa ni devolución ficticia. Conserva la tardanza ya causada y detiene su escalamiento; no duplica una falta de daño por el mismo hecho. Constituye un **incumplimiento independiente**:

- Se registra la incidencia, el usuario, ejemplar, fecha, responsable de registro y evidencia disponible.
- El porcentaje de confianza del usuario pasa directamente a **0 %**, independientemente del valor anterior.
- Queda **bloqueado indefinidamente** para nuevos préstamos y reservas hasta que los responsables resuelvan el incidente por vía interna o se acepte una apelación de la sanción.
- El sistema **no fija automáticamente un pago, valor de reposición o acuerdo económico**, pues la solución material se tratará con los encargados institucionales.
- El historial mantiene el valor anterior, valor final, efecto nominal `establecer a cero` y **descuento realmente aplicado**. Si antes había 42 %, se registran 42 puntos descontados, no se afirma que se hayan descontado efectivamente 100 puntos.
- Si concurren otros incumplimientos independientes, todos se registran y se mantienen sus consecuencias, sin bajar la confianza por debajo de cero.

## 8. Acumulación de sanciones

Cuando hay **faltas independientes**, se registran todas y sus consecuencias se acumulan. Por ejemplo, retraso grave de un electrónico (−30, 30 días) y daño moderado del mismo ejemplar (−30, 30 días) generan **dos incumplimientos y 60 puntos de descuento**, y **60 días consecutivos** de suspensión, sujetos al mínimo de confianza de 0.

Las suspensiones temporales se ordenan por instante de registro y, en empate, por identificador. La primera empieza al registrarse; cada siguiente comienza al finalizar la anterior. Un día son 24 horas continuas.

- Una suspensión futura está PROGRAMADA; en su intervalo [inicio, fin) está ACTIVA; al terminar está FINALIZADA. PROGRAMADA no bloquea por sí sola, pero la cadena iniciada mantiene la restricción mediante su tramo ACTIVO.
- El descuento se aplica al registrar, aunque la suspensión sea futura. Si la falta tiene cero días, queda FINALIZADA tras registrar el descuento, sin bloqueo artificial.
- La detección automática conserva como inicio efectivo el instante en que se cruzó el umbral, no la hora de ejecución de la tarea; si la tarea se retrasa, calcula los tramos transcurridos sin duplicarlos.
- Escalar aumenta solo la diferencia nominal de puntos y de duración total. Si su suspensión no terminó, se amplía su tramo y desplaza los siguientes; si terminó, solo la duración adicional se añade al final de la cola. Nunca vuelve a consumirse tiempo ya cumplido.
- Absolver deja la sanción ABSUELTA, elimina su tiempo restante y adelanta las siguientes desde la resolución, sin devolver días transcurridos ni cancelar otras faltas. Toda reprogramación conserva fechas anteriores y motivo.
- Un bloqueo indefinido comienza inmediatamente y coexiste con las temporales, sin pausar sus días. Al levantarlo siguen vigentes los tramos temporales no cumplidos.
- Cada incremento de confianza descontado se limita al saldo actual; los incrementos se calculan sobre la diferencia nominal del nuevo tramo. No se cobran posteriormente puntos que no pudieron descontarse por saldo cero.
- Ajustar sanciones, cola y confianza debe ser consistente. Las faltas se procesan en orden de registro y conservan todos sus ajustes.

## 9. Recompensa por devolución puntual y sin faltas

Un préstamo devuelto **antes o justo en su fecha/hora límite**, con artículo **completo, sin daño indebido y sin otra incidencia**, concede una sola recompensa de confianza: **10 % de la penalización de referencia de su categoría**, con máximo de 100 %.

| Categoría | Referencia | Recompensa |
| --- | ---: | ---: |
| Electrónicos | 30 puntos | **+3 puntos** |
| Libros | 10 puntos | **+1 punto** |
| Deportes | 10 puntos | **+1 punto** |

Esta referencia es configurable y versionada por categoría. No se otorgan puntos por recoger una reserva, por devolver tarde ni por devolver un artículo dañado.

## 10. Sanciones, apelaciones y autoridad

- El **operador** confirma el estado físico al devolver el artículo y revisa solicitudes de inscripción. La **tardanza** la determina el sistema automáticamente.
- El **administrador** puede realizar todas las operaciones del operador, además de configurar políticas y resolver apelaciones.
- Cada sanción conserva usuario, incumplimiento, categoría, gravedad, versión de regla, responsable o proceso automático, plazo, cambio de confianza y estado. Su historial es permanente.
- El titular puede presentar **una apelación por sanción** PROGRAMADA o ACTIVA, o durante 30 días desde su finalización; en faltas sin suspensión, desde su registro. Debe aportar motivo.
- La apelación usa EN_REVISION, ACEPTADA o RECHAZADA. EN_REVISION no suspende efectos y debe resolverse aunque la sanción termine durante la revisión.
- Solo un administrador la resuelve con fundamento, fecha y resultado dentro de **72 horas continuas**. Superar el plazo genera aviso al administrador y registro de retraso, nunca absolución automática.
- Si se **rechaza**, la sanción continúa sin otra apelación para ese mismo registro.
- Si se **acepta**, se registra la absolución, se elimina la restricción originada por esa sanción y se **devuelve el descuento de confianza efectivamente aplicado por ella**, sin exceder 100. Otras sanciones independientes siguen vigentes.
- Los descuentos, absoluciones y restituciones se registran como hechos separados; **no se eliminan ni sobrescriben registros históricos**.

## 11. Notificaciones

El usuario dispondrá de una sección de **notificaciones dentro de la aplicación** para enterarse de cambios importantes, incluyendo cuando corresponda vencimientos, cancelación de reservas, sanciones, apelaciones y solicitudes de aprobación. **No se contempla en esta versión envío por correo, SMS ni notificaciones externas.**

## 12. Gestión dinámica, versiones y auditoría

El administrador puede crear, modificar, activar o desactivar reglas. Toda modificación que altere el contenido aplicable a usuarios debe originar una **nueva versión inmutable**, manteniendo la versión anterior para la trazabilidad.

### Información mínima de la política versionada

| Campo conceptual | Finalidad |
| --- | --- |
| Regla e identificador estable | Identificar `R-TAR`, `R-DAN`, `R-PER`, `R-RES` u otra regla. |
| Versión y vigencia | Conocer qué definición estaba vigente al producirse un hecho. |
| Categoría de recurso | Determinar matriz aplicable. |
| Gravedad | Distinguir leve, moderada y grave, cuando corresponda. |
| Criterio o umbral | Retraso o reincidencia; evidencia/tipo de daño. |
| Efecto de confianza | Descuento numérico o instrucción explícita de establecer confianza en 0. |
| Suspensión | Días o bloqueo indefinido. |
| Regla de recompensa | Porcentaje de referencia por categoría y cálculo del 10 %. |
| Estado | Activa o inactiva, sin borrar el historial. |

Se requiere registrar como **instantánea histórica** la regla, versión, gravedad, porcentaje nominal, **descuento efectivamente aplicado**, fecha/hora, responsable y duración resultante, incluso cuando después se modifique la tabla. Una versión nueva nunca reescribe sanciones anteriores.

### Aceptación de una nueva versión

La publicación de una nueva versión de términos exige una nueva aceptación explícita antes de **reservar o pedir nuevos préstamos**. El usuario podrá autenticarse y consultar su historial mientras no haya aceptado, pero no efectuar nuevas operaciones sujetas a los términos.

## 13. Resolución interna y precisión operativa

### Cierre administrativo

El administrador verifica recuperación, reparación o reposición con los encargados y registra evidencia, fecha y fundamento. La sanción pasa a FINALIZADA por RESOLUCION_INTERNA. No se impone automáticamente importe económico: la solución acordada se acredita mediante evidencia.

Este cierre **no absuelve ni restituye confianza**. Un usuario en Crítico o con otra restricción sigue sin acceso a reservas. No hay recuperación automática ni excepción administrativa al nivel de confianza. Una apelación aceptada sí restituye el descuento efectivo de su sanción. Si ya estaba EN_REVISION debe resolverse aun después del cierre. Una sanción absuelta deja de escalar; la absolución no modifica por sí sola la condición física del ejemplar.

### Identidad y acceso

El correo institucional debe ser único, verificado y pertenecer a `@unsa.edu.pe`. Google se verifica en el servidor y vincula a la misma cuenta, sin duplicar aprobación ni cupo. El operador o administrador contrasta identidad y vigencia: estudiantes aportan carné o constancia de matrícula vigente; docentes y administrativos, constancia de trabajo o designación vigente emitida por la universidad. Evidencia ilegible, vencida o incongruente se rechaza con motivo y permite una nueva solicitud corregida.

La aceptación durante el registro se conserva por solicitud y se vincula al usuario al aprobar. Se admite iniciar sesión para consultar estado, historial, notificaciones y apelaciones sin estar habilitado para reservar. Sanciones, confianza o términos sin aceptar no impiden devolver ni reportar incidencias.

### Tiempo, políticas y cálculo

- Los instantes se almacenan inequívocamente en UTC y se muestran en **America/Lima**. Un día son 24 horas continuas. Los plazos desde recogida son electrónicos **8 horas**, libros **14 días** y deportes **2 días**.
- Al confirmar reserva se conservan duración, categoría, reglas versionadas, matrices y referencia de recompensa, mostradas antes de confirmar. Cambios futuros no alteran esa operación; al recoger se revisan nuevamente elegibilidad personal y aceptación vigente.
- Desactivar un recurso o ejemplar cancela reservas no recogidas sin inasistencia; los préstamos activos siguen admitiendo devolución y el ejemplar queda NO_DISPONIBLE. No se eliminan referencias históricas.
- Confianza y ajustes usan dos decimales y redondeo aritmético, con límites [0, 100]. Cada recompensa o restitución registra importe calculado y efectivo. La absolución devuelve una sola vez lo efectivamente descontado por su sanción, incluidos escalones, sin recalcular otras faltas.
- Para un mismo incidente de daño se aplica la mayor gravedad acreditada por el formulario y evidencia; descripciones equivalentes no se cobran dos veces. Faltas de tipos distintos mantienen su independencia.
- El usuario acepta las fechas mostradas antes de confirmar; no se desplaza automáticamente la devolución por fines de semana o feriados. No se permite alterar retrospectivamente horas de recogida o devolución para evitar consecuencias.

Estas reglas conforman la versión vigente. Los cambios se publican como nuevas versiones, sin sustituir el historial.
