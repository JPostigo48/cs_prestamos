# Reglas de negocio

Las reglas de negocio expresan invariantes y restricciones del sistema de préstamos universitarios. Se complementan con los [requisitos funcionales](functional.md), el [modelo de confianza](trust-model.md) y las matrices versionadas de [términos y condiciones](terms-and-conditions.md).

**Estado:** esta documentación define el comportamiento objetivo y no demuestra su implementación. Las matrices de términos y condiciones constituyen la configuración vigente de esta versión.

## Usuarios y acceso

| ID | Regla |
| --- | --- |
| RN-01 | Solo pueden solicitar acceso estudiantes, docentes y personal administrativo con vinculación vigente con la EPCC. Para estudiantes se exige imagen de carné o constancia de matrícula y verificación por operador o administrador. |
| RN-02 | La cuenta es personal e intransferible. El acceso con Google institucional no sustituye la aprobación de la solicitud ni la aceptación de términos vigentes. |

## Inventario, reservas y préstamos

| ID | Regla |
| --- | --- |
| RN-03 | Todo préstamo nace de una reserva confirmada de un ejemplar DISPONIBLE; no se permite entrega sin reserva. |
| RN-04 | Cada ejemplar admite una sola operación abierta: reserva CONFIRMADA o préstamo ACTIVO. La confirmación bloquea la unidad inmediatamente. |
| RN-05 | Un recurso está disponible si y solo si al menos un ejemplar puede prestarse según su estado y los compromisos existentes. |
| RN-06 | La duración pertenece a la categoría y empieza al recoger: electrónicos 8 horas dentro del campus, libros 14 días, deportes 2 días. La duración electrónica configurable debe ser positiva y menor de 24 horas. |
| RN-07 | Para realizar un nuevo préstamo o reserva se verifica aprobación, vinculación vigente, términos aceptados, categoría autorizada por confianza, límites de simultaneidad y ausencia de restricciones activas. |
| RN-08 | Los recursos se utilizan cuidadosamente y se devuelven con sus componentes completos; el desgaste normal debido a un uso correcto no equivale automáticamente a daño sancionable. |
| RN-09 | Los recursos prestados no se destinan a fines de lucro ni se transfieren a otro usuario. |
| RN-10 | La pérdida, el robo o daño mientras un ejemplar está asignado deben registrarse, verificarse y someterse a las políticas vigentes; la solución material de incidentes graves se tratará con los encargados. |
| RN-11 | Todo ejemplar se devuelve dentro de la fecha y hora establecidas; esa fecha límite se conserva en el préstamo aunque luego cambie la configuración de la categoría. |
| RN-12 | **No existe tolerancia para devoluciones.** Una devolución posterior al límite genera una tardanza que el sistema detecta y clasifica automáticamente. |
| RN-13 | Un estudiante solo puede mantener una operación abierta en total: una reserva CONFIRMADA o un préstamo ACTIVO. Docentes y administrativos admiten varias sobre unidades distintas. |

## Confianza e incumplimientos

| ID | Regla |
| --- | --- |
| RN-14 | Toda cuenta aprobada inicia con **75 puntos de confianza**, dentro del intervalo cerrado [0, 100]. |
| RN-15 | Los cuatro niveles son: **Excelente** 75 ≤ confianza ≤ 100, **Confiable** 50 ≤ confianza < 75, **En observación** 25 ≤ confianza < 50 y **Crítico** 0 ≤ confianza < 25; se calculan a partir del porcentaje. |
| RN-16 | Cada categoría almacena sus niveles de confianza permitidos; inicialmente: electrónicos solo Excelente/Confiable, libros y deportes también En observación, ninguna de las tres para Crítico. |
| RN-17 | Una penalización depende de **regla, categoría, gravedad y versión**. La tardanza y el daño tienen grados leve, moderado y grave; pérdida/robo y falta de recojo son reglas diferentes. |
| RN-18 | Porcentajes, umbrales, días de suspensión y categorías permitidas proceden de políticas persistidas y versionadas, **no de constantes dispersas en el código**. |
| RN-19 | Una modificación de reglas no altera retrospectivamente el porcentaje, consecuencia ni versión aplicada a un incumplimiento histórico. |

## Administración de reglas y términos

| ID | Regla |
| --- | --- |
| RN-20 | Los administradores pueden crear, modificar, activar/desactivar y versionar reglas y términos sin cambiar código; cada versión aplicable debe conservarse de manera inmutable. |

## Sanciones y apelaciones

| ID | Regla |
| --- | --- |
| RN-21 | La suspensión temporal o indefinida procede de la **versión exacta de la regla**, categoría y gravedad aplicables. Se conserva el tiempo total de sanción aun cuando la regla cambie después. |
| RN-22 | Una sanción conserva usuario, incumplimiento, versión de regla, categoría, gravedad, responsable o proceso automático, inicio, fin o condición indefinida y confianza antes/después. |
| RN-23 | Las restricciones efectivas impiden reservas y recogidas, cancelan reservas no recogidas sin inasistencia y no impiden devolver préstamos activos. |
| RN-24 | Solo el titular puede apelar una vez por sanción PROGRAMADA o ACTIVA, o durante 30 días desde su finalización; para sanciones sin suspensión, desde su registro. La revisión no suspende efectos. |
| RN-25 | Solo una cuenta con rol **ADMINISTRADOR** puede resolver apelaciones y debe conservar fecha, decisión y fundamento; el administrador también posee los permisos del operador. |
| RN-26 | Una apelación aceptada absuelve **esa sanción**, levanta **su bloqueo** y restituye el **descuento efectivo de confianza asociado a ella**. Una apelación rechazada mantiene la consecuencia y no habilita una segunda apelación. |
| RN-27 | Sanciones, apelaciones y ajustes conforman un historial; los registros finalizados o absueltos no se sobrescriben ni eliminan. |
| RN-28 | Las nuevas versiones de reglas no modifican retroactivamente sanciones anteriores ni su duración, descuentos efectivos o referencias. |
| RN-29 | Cada apelación registra sanción, usuario, motivo, fechas, resultado, fundamento y administrador que la resolvió. |

## Reglas complementarias

| ID | Regla |
| --- | --- |
| RN-30 | Una reserva se recoge a la hora pactada o **dentro de los siguientes 30 minutos**; después pasa a VENCIDA automáticamente y se registra inasistencia con descuento pequeño configurable. |
| RN-31 | Un estudiante debe aportar al registrarse carné o constancia de matrícula; un **operador o administrador** valida la evidencia antes de aprobar la cuenta. |
| RN-32 | El sistema permite acceso con Google mediante correo institucional `@unsa.edu.pe`; autenticar no equivale a estar aprobado ni habilitado para préstamos. |
| RN-33 | Un administrador puede ejecutar todas las funciones del operador. `TipoUsuario` (estudiante, docente, administrativo) y `RolAcceso` (usuario, operador, administrador) representan dimensiones distintas. |
| RN-34 | La categoría conserva **duración máxima, niveles admitidos y penalización de referencia** para recompensa por puntualidad. |
| RN-35 | Una devolución puntual, completa y sin faltas concede una recompensa de **10 % de la penalización de referencia de la categoría**; el porcentaje final no supera 100. |
| RN-36 | La tardanza se detecta y clasifica automáticamente **sin tolerancia** y puede escalar de leve a moderada o grave según los umbrales de su categoría. |
| RN-37 | Para una misma tardanza, escalar implica ajustar **solo la diferencia** hasta la nueva consecuencia total; no se aplican tres sanciones completas por haber atravesado tres niveles. |
| RN-38 | El operador registra al recibir el ejemplar su estado y si sus componentes están completos; el sistema determina la falta de daño y su gravedad según la política aplicable. |
| RN-39 | Pérdida o robo es una regla distinta: la confianza se establece en **0 %** y el usuario se bloquea indefinidamente hasta resolución interna o apelación aceptada. |
| RN-40 | Daño grave de electrónico también establece confianza en **0 %** y bloqueo indefinido hasta resolución interna o absolución. |
| RN-41 | Las **faltas diferentes** se registran y sus descuentos y días de suspensión **se acumulan**; las suspensiones temporales se encadenan, sin solaparse. |
| RN-42 | Los cálculos se limitan a [0, 100] y registran por separado el importe configurado y el **descuento efectivamente aplicado**, para trazabilidad y posible restitución. |
| RN-43 | Una misma reserva cancelada por inasistencia no genera sanciones repetidas aunque el proceso automático se ejecute varias veces. |
| RN-44 | Los términos se aceptan al registrarse; al publicarse una nueva versión, el usuario debe aceptarla antes de cualquier otra reserva o préstamo, aunque pueda seguir consultando sus datos. |
| RN-45 | Un recurso que ya aparece en el historial de préstamos **se desactiva**, no se elimina físicamente junto con sus referencias. |
| RN-46 | Las notificaciones se consultan **dentro de la aplicación**; no se establece en esta versión envío mediante correo, SMS u otros medios externos. |
| RN-47 | No se otorga recompensa a una devolución que genere cualquier falta, aunque se haya entregado dentro del plazo. |
| RN-48 | El sistema conserva las transiciones de una tardanza, los ajustes de gravedad y sus importes; el acto de devolver no vuelve a descontar una penalización ya aplicada. |
| RN-49 | La absolución de una sanción no cancela otras sanciones independientes; la restitución de confianza se registra como un nuevo hecho y no borra la deducción original. |
| RN-50 | La asignación del préstamo y la ocupación del ejemplar, y la absolución con restitución de confianza, requieren consistencia transaccional ante errores o reintentos. |

## Configuración vigente de sanciones

La política exacta se centraliza en [términos y condiciones](terms-and-conditions.md), no se replica en esta tabla. Sus matrices de tardanza, daño e inasistencia, junto con los plazos por categoría, son la configuración vigente y se modifican mediante nuevas versiones.

## Ciclo obligatorio y cierre

| ID | Regla |
| --- | --- |
| RN-51 | Reserva y préstamo son etapas vinculadas de una operación. RECOGIDA es terminal para la reserva; el préstamo ACTIVO mantiene el cupo hasta devolución o cierre por incidencia. |
| RN-52 | Cancelar antes o dentro de la ventana de recogida no genera sanción; después se aplica vencimiento. Las cancelaciones administrativas conservan motivo y no generan inasistencia. |
| RN-53 | La fecha límite es recogida efectiva más duración de categoría fijada al reservar. La política, categoría y recompensa conservadas no cambian retroactivamente. |
| RN-54 | El administrador finaliza el bloqueo indefinido por solución material acreditada, con motivo y evidencia, sin absolver ni restituir confianza. |
| RN-55 | Las faltas sin suspensión se finalizan tras el descuento y mantienen una ventana de apelación de 30 días desde su registro. |
| RN-56 | El bloqueo indefinido no pausa el transcurso de las suspensiones temporales. Al finalizarlo siguen aplicándose las temporales no cumplidas y el nivel de confianza. |
| RN-57 | La confianza usa dos decimales y redondeo aritmético, limitada a [0, 100]. Se registran importe nominal, importe efectivo y saldos antes/después. |
| RN-58 | La aceptación de términos al registrarse se vincula a la solicitud y después al usuario aprobado, sin exigir que ya exista una cuenta aprobada para aceptar. |

Los requisitos definen la versión normativa del producto; diagramas y código deben representar estas reglas, no redefinirlas.
