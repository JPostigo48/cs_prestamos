# Requisitos no funcionales

- **RNF-01. Rendimiento.** Las operaciones habituales, como consultar inventario, registrar préstamos y devoluciones, deben responder en un tiempo máximo aproximado de 2 segundos bajo condiciones normales.
- **RNF-02. Concurrencia.** El sistema debe soportar al menos 50 usuarios conectados simultáneamente sin una degradación significativa del servicio.
- **RNF-03. Capacidad.** El sistema debe gestionar inicialmente al menos 300 usuarios registrados, además de mantener el inventario y el historial de préstamos correspondiente.
- **RNF-04. Consistencia.** El sistema debe garantizar que un mismo ejemplar no pueda estar asociado simultáneamente a dos préstamos activos.
- **RNF-05. Seguridad.** Las operaciones disponibles deben restringirse según los permisos del usuario autenticado.
- **RNF-06. Persistencia.** La información de usuarios, inventario, préstamos, devoluciones, confianza, reglas, incumplimientos, sanciones y apelaciones debe mantenerse después del cierre o reinicio de la aplicación.
- **RNF-07. Usabilidad.** Las operaciones principales deben poder realizarse mediante una interfaz clara y con una cantidad reducida de pasos.
- **RNF-08. Mantenibilidad.** La aplicación debe organizarse de forma modular, evitando duplicación de lógica y dependencias innecesarias.
- **RNF-09. Integridad.** Las operaciones que impliquen cambios relacionados, como crear un préstamo y cambiar el estado de un ejemplar o resolver una apelación y absolver una sanción, deben mantenerse consistentes.
- **RNF-10. Trazabilidad.** El historial debe permitir conocer qué operador impuso una sanción, qué administrador resolvió una apelación y qué versiones y valores fueron aplicados, sin alterar los registros históricos.
