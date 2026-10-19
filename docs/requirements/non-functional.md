# Requisitos no funcionales

- **RNF-01. Rendimiento.** Las operaciones habituales, como consultar inventario, registrar préstamos y devoluciones, deben completar el 95 % de respuestas HTTP en 2 segundos o menos medidos en el servidor, con 50 sesiones concurrentes (una petición por sesión cada 5 segundos) durante 10 minutos, 300 usuarios, 100 recursos, 300 ejemplares y 1 000 operaciones históricas. Se incluye persistencia y se excluye la espera del proveedor Google.
- **RNF-02. Concurrencia.** El sistema debe soportar al menos 50 usuarios conectados simultáneamente con menos del 1 % de respuestas HTTP 5xx durante la prueba de RNF-01; rechazos correctos de negocio no cuentan como fallos técnicos.
- **RNF-03. Capacidad.** El sistema debe gestionar inicialmente al menos 300 usuarios registrados, además de mantener el inventario y el historial de préstamos correspondiente.
- **RNF-04. Consistencia.** El sistema debe garantizar que un mismo ejemplar no pueda estar asociado simultáneamente a dos préstamos activos.
- **RNF-05. Seguridad.** Las operaciones disponibles deben restringirse según los permisos del usuario autenticado.
- **RNF-06. Persistencia.** La información de usuarios, inventario, préstamos, devoluciones, confianza, reglas, incumplimientos, sanciones y apelaciones debe mantenerse después del cierre o reinicio de la aplicación.
- **RNF-07. Usabilidad.** Las operaciones principales deben poder realizarse mediante una interfaz clara y con un máximo de tres acciones desde el detalle del recurso hasta confirmar reserva, excluyendo autenticación y aceptación de términos; deben mostrar ejemplar, recogida, duración, política y motivos de rechazo.
- **RNF-08. Mantenibilidad.** La aplicación debe organizarse de forma modular, evitando duplicación de lógica y dependencias innecesarias.
- **RNF-09. Integridad.** Las operaciones que impliquen cambios relacionados, como crear un préstamo y cambiar el estado de un ejemplar o resolver una apelación y absolver una sanción, deben mantenerse consistentes.
- **RNF-10. Trazabilidad.** El historial debe permitir conocer qué operador o proceso automático originó una sanción, qué administrador resolvió una apelación y qué versiones y valores fueron aplicados, sin alterar los registros históricos.

- **RNF-11. Automatización y consistencia temporal.** La detección y el escalamiento de tardanzas, la caducidad de reservas y los cambios de confianza no deben generar sanciones duplicadas por reintentos o ejecuciones repetidas; se requiere comportamiento idempotente.
- **RNF-12. Concurrencia e integridad de inventario.** La asignación de reservas y préstamos debe impedir conflictos entre solicitudes simultáneas que compitan por el mismo ejemplar, incluyendo transiciones entre reserva y entrega.
- **RNF-13. Auditoría de políticas.** Para cada incumplimiento deben conservarse categoría, gravedad, versión de regla, criterio aplicado, descuento efectivo, duración y responsable o proceso automático, incluso después de modificaciones de políticas.
- **RNF-14. Seguridad de identidad.** El inicio de sesión mediante Google institucional debe verificarse del lado del servidor; el correo autenticado no sustituye la revisión de vinculación con la EPCC ni la autorización por rol.
- **RNF-15. Historial inalterable.** La desactivación de recursos, absolución de sanciones o sustitución de términos no debe borrar información referenciada en préstamos, incumplimientos, aceptaciones o apelaciones anteriores.
- **RNF-16. Consistencia de recompensas y restituciones.** Recompensas y devoluciones de confianza por apelaciones deben aplicarse sin duplicaciones y mantener el valor de confianza en el intervalo [0, 100], incluso ante reintentos y operaciones concurrentes.
- **RNF-17. Persistencia de notificaciones.** Las notificaciones dentro de la aplicación deben conservar los avisos relevantes para su posterior consulta; en esta etapa no se requiere distribución mediante correo ni servicios externos.

Los umbrales temporales y las duraciones de sanción se documentan como **políticas configurables y versionadas** en [términos y condiciones](terms-and-conditions.md). Sus valores constituyen la línea base vigente de requisitos.

- **RNF-18. Exactitud temporal.** El servidor es autoridad de tiempo y evalúa caducidad y elegibilidad antes de cada transición aunque no se haya ejecutado el proceso periódico. Las tareas automáticas se ejecutan al menos una vez por minuto.
- **RNF-19. Atomicidad del cupo.** Confirmar reserva verifica y ocupa conjuntamente el cupo del estudiante y del ejemplar; recoger no libera temporalmente el cupo ni permite duplicarlo.
