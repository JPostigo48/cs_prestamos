# Configuración operativa de reservas: contrato para frontend

## Rutas y permisos

- GET /system/reservation-settings: cualquier usuario autenticado (USUARIO, OPERADOR, ADMINISTRADOR), respuesta 200.
- PATCH /system/reservation-settings: exclusivamente ADMINISTRADOR, respuesta 200 solo después de confirmar la transacción de configuración y auditoría. USUARIO y OPERADOR reciben 403. Ambas rutas exigen bearer; sin autenticación, 401.
- La creación sigue en POST /loans/reservations. No cambia el contrato de recogida, cancelación ni devolución.

Fuentes: [controlador](../../backend/src/modules/system/presentation/reservation-settings.controller.ts), [DTO exactos](../../backend/src/modules/system/presentation/reservation-settings.dto.ts), [OpenAPI](../../backend/openapi.json). La UI está implementada en el [panel /app/admin/settings](../../frontend/src/router.ts:50), con la [página de configuración](../../frontend/src/modules/system/pages/SystemSettingsPage.vue).

## Entrada y respuesta

El cuerpo PATCH es [PatchReservationSettingsDto](../../backend/src/modules/system/presentation/reservation-settings.dto.ts): al menos uno de los siguientes campos; campos desconocidos, nulos no admitidos y tipos incorrectos se rechazan.

| Campo | Tipo y semántica |
|---|---|
| pickupWaitMinutes | Entero entre 1 y 240, **minutos**, valor inicial persistido 30. Omitir conserva el anterior; null es inválido. |
| weeklySchedule | Array completo de exactamente siete días, o null para desconfigurar explícitamente. Omitir conserva el anterior. Reemplaza la semana, no hace merge de días. |

Cada día tiene day (entero ISO: 1 lunes, 2 martes, 3 miércoles, 4 jueves, 5 viernes, 6 sábado, 7 domingo) e intervals (array de 0 a 12 franjas). Cada franja tiene opens y closes, cadenas **HH:mm** de 00:00 a 23:59. Exige los siete días una sola vez; el orden de los días no importa. Franjas ordenadas ascendentemente, apertura menor que cierre, sin solapamientos ni cruce de medianoche; franjas contiguas son válidas. Un array de franjas vacío significa **día cerrado**; siete días cerrados es una configuración válida que impide nuevas reservas. No se admite 24:00 ni abreviación 9:00. Los ejemplos de los DTO no son horario oficial.

GET y PATCH devuelven [ReservationSettingsResponseDto](../../backend/src/modules/system/presentation/reservation-settings.dto.ts), objeto con:

| Campo | Valor |
|---|---|
| pickupWaitMinutes, weeklySchedule | Valores realmente persistidos, con los tipos anteriores. |
| version | Entero positivo, empieza en 1 e incrementa en cada PATCH confirmado. No es una versión de reglas ni términos. |
| updatedAt | Instante ISO 8601 con zona. |
| timeZone | Siempre America/Lima; no editable. |
| scheduleStatus | CONFIGURED si hay semana; UNCONFIGURED si es null. |
| pickupWindowPolicy | Siempre FULL_WINDOW_WITHIN_INTERVAL. |
| warning | Texto para mostrar si UNCONFIGURED; null si CONFIGURED. |

## Fecha, ventana y flujo del modal

1. Consultar GET al abrir el modal. Mostrar espera, zona institucional y estado de horario. No inferir horas oficiales ni usar la zona del dispositivo para decidir disponibilidad. Para presentar una fecha elegida en Lima, enviar su instante con offset -05:00 o su equivalente UTC.
2. [requestedAt](../../backend/src/modules/loans/presentation/dto/create-reservation.dto.ts) exige fecha/hora ISO completa, segundos y **Z u offset explícito**; fracción opcional de hasta tres dígitos. Fecha sin zona, fecha inexistente, NaN y fecha anterior al reloj del servidor se rechazan con 400. La validación se repite dentro de la transacción, por lo que una solicitud que envejece durante la operación puede rechazarse.
3. Con horario CONFIGURED, tanto el comienzo como el plazo final deben caber **en una misma franja** del día institucional de la recogida. Apertura incluida; no se puede iniciar al cierre. El plazo puede terminar exactamente al cierre, no un milisegundo después. No se recorta la espera ni se suman franjas separadas. El servidor interpreta días y cambios de fecha en America/Lima, aunque el offset enviado sea otro. Una ventana fuera de atención devuelve 400 con mensaje corto.
4. Con UNCONFIGURED, existe una configuración persistida válida y espera real, pero **la disponibilidad por horario no está configurada**. Mostrar warning. Se conserva compatibilidad: se puede reservar sin comprobar franjas inventadas; siguen vigentes elegibilidad, términos, cupo, inventario y fecha futura. No presentar este estado como atención permanente garantizada.
5. Tras crear, usar [pickupDeadline persistido](../../backend/src/modules/loans/domain/entities/reservation.ts), no recalcular con la configuración actual. La recogida conserva su ventana inclusiva entre requestedAt y pickupDeadline. El servidor vuelve a comprobar disponibilidad y configuración; la consulta del modal no garantiza una reserva.

## Persistencia, concurrencia y errores

Modelo [ConfiguracionReservas](../../backend/prisma/contract.prisma), tabla configuracion_reservas: fila única id=1, espera, semana JSON nullable, versión y fecha de actualización. La [migración Prisma 8 custom aplicada](../../backend/prisma/migrations/app/20261104T1117_reservation_settings/migration.ts:16) incluye creación, restricciones y operación inicial idempotente: espera 30, semana null, versión 1. **Aplicada el 2026-11-04, con autorización explícita, mediante el motor oficial y la conexión configurada.** Se comprobó previamente la predecesora de categorías registrada y una ruta con únicamente esta migración; se conservaron sus metadatos reales. No se ejecutaron otras migraciones, semillas, limpiezas ni ajustes de horario.

Verificación posterior de solo lectura: tabla y restricciones presentes (clave primaria, fila única, espera entre 1 y 240, versión positiva y campos obligatorios); una fila con identificador 1, espera 30 minutos, semana sin configurar y versión 1. Registro oficial y marcador coinciden con la migración aplicada. El [repositorio real](../../backend/src/modules/system/infrastructure/prisma-reservation-settings.repository.ts:64) y su [proyección](../../backend/src/modules/system/domain/reservation-settings.ts:131) confirmaron horario sin configurar y zona institucional de Lima. Las rutas de lectura directa y mediante proxy devolvieron **401 sin token**; las rutas de lectura y edición constan en el contrato. No se probó respuesta autenticada 200, edición administrativa, concurrencia real ni un flujo completo de reservas. El horario queda para configuración del administrador desde el panel; no se recalcularon ni modificaron reservas anteriores. Evidencia local sanitizada en [reservation-settings-migration-result.json](../../.git/temporary-maintenance/reservation-settings-migration-result.json:1), fuera de versionado.

PATCH y creación de reserva bloquean la misma fila hasta el commit. La configuración se lee y valida después del bloqueo dentro de la transacción de creación; no existe un cálculo previo de espera susceptible de quedar desactualizado. La nueva reserva conserva espera, semana, zona y versión en su instantánea, además del plazo definitivo. El plazo es la autoridad; la instantánea explica su origen. Las reservas y préstamos anteriores, incluidos aquellos sin instantánea operativa, no se recalculan ni se migran. Devoluciones históricas no consultan el horario actual.

La auditoría reutiliza el almacenamiento existente con actor autenticado, valores anteriores y nuevos, en la misma transacción. Un fallo de persistencia/auditoría no devuelve éxito. No hay fallback de configuración en memoria, creación implícita al leer ni guardado fingido.

- 400: cuerpo, minutos, días, franjas o fecha inválidos; día cerrado o ventana incompleta. Mostrar el mensaje del servidor.
- 401/403: autenticación o rol insuficiente.
- 409 en creación: conflictos existentes de elegibilidad/inventario/concurrencia. Refrescar antes de reintentar.
- **503** en lectura, PATCH o creación si no se puede leer la configuración, falta la tabla o su fila. Mensaje legible recomienda aplicar la migración pendiente. No se devuelve SQL ni un 500 por tabla faltante. Ante 503, mostrar configuración no disponible, no sustituir por un guardado exitoso ni por UNCONFIGURED. Para otros fallos de almacenamiento durante PATCH también se responde 503 sin fingir éxito; verificar servicio/estado de migración antes de reintentar.

## Historia y límite de automatización existente

La espera operativa configurable no altera los criterios no-show versionados, textos publicados, matrices, penalizaciones, términos aceptados ni deudas. Sus menciones históricas de 30 minutos permanecen intactas. No se introduce un motor sancionador paralelo.

El servicio de expiración usa el reloj real del equipo del backend, al arrancar y cada 60 segundos; algunas consultas también fuerzan la revisión. El plazo persistido es autoridad y su extremo final es inclusivo para recogida. Al superarlo, el flujo registra VENCIDA, libera solo el ejemplar reservado y aplica una sola vez la política LEVE de inasistencia publicada aplicable, sin escalamiento por reiteración. Todo efecto por reserva comparte transacción, confianza bloqueada y auditoría; ante fallo responde 503 y revierte. Se conserva historial, sin eliminación física ni sanciones retroactivas de reservas ya vencidas. La migración adicional se aplicó con autorización el 2026-11-04; se verificaron esquema y política publicada mediante lecturas, sin provocar vencimientos ni sanciones de prueba. Véase el [contrato de vencimiento](reservation-expiry.md) para selección histórica, idempotencia, API y límites de la verificación real.

## Verificación offline

Preparación desde backend con [configuración offline](../../backend/prisma.offline.config.ts), sin carga de entorno: contract emit y migration plan con esa configuración; ejecución del archivo de migración únicamente para autoemitir ops y metadatos, no para aplicarla. En Windows usar la ruta real con unidad mayúscula D: para evitar duplicación de módulos en Prisma/Vitest.

Comandos ejecutados de verificación:

- npm run typecheck; npm run build.
- npm run openapi:generate; node ../scripts/generate-project-showcase.mjs --openapi-only; node ../scripts/generate-project-showcase.mjs --db-only; npm run openapi:check. Resultado: **81 operaciones**, 23 modelos DB; sin generador completo ni datos personales.
- Vitest run con [vitest.config.offline.ts](../../backend/vitest.config.offline.ts), que bloquea carga de entorno, solo los archivos focalizados: [política horaria](../../backend/src/modules/system/domain/reservation-settings.spec.ts), [HTTP settings](../../backend/test/reservation-settings-http.spec.ts), [casos de reserva](../../backend/src/modules/loans/application/use-cases/reservation.use-cases.spec.ts), [repositorio reservas](../../backend/src/modules/loans/infrastructure/persistence/prisma/prisma-reservation.repository.spec.ts), [contratos préstamos](../../backend/test/loans-contracts.spec.ts), [categorías](../../backend/test/category-administration.spec.ts), [trust](../../backend/test/trust-contracts.spec.ts), [política oficial](../../backend/src/modules/rules/official-policy.spec.ts) y [OpenAPI](../../backend/test/openapi-contract.spec.ts).

Las pruebas usan dobles: comprueban rollback, errores 503, permisos de tres roles, fechas/offset/cierre, captura del nuevo plazo y preservación de historia. No sustituyen una aplicación autorizada ni una prueba de bloqueo concurrente en PostgreSQL real.

Resultado de la fase offline previa: **314 pruebas aprobadas en los nueve archivos indicados**, typecheck y build correctos, OpenAPI/check correcto (81 operaciones). La comprobación offline de integridad de la migración también pasó. Esa fase no aplicó la migración ni abrió conexiones DB/servicios, ejecutó semillas, leyó secretos o realizó cambios de rama, staging ni commits. La aplicación autorizada posterior y sus límites se documentan en Persistencia; no convierte estas pruebas con dobles en QA integral sobre una base real.

Comando exacto de pruebas, desde backend (tras normalizar la ruta Windows):

[`node_modules\.bin\vitest.cmd run --config vitest.config.offline.ts src/modules/system/domain/reservation-settings.spec.ts test/reservation-settings-http.spec.ts src/modules/loans/application/use-cases/reservation.use-cases.spec.ts src/modules/loans/infrastructure/persistence/prisma/prisma-reservation.repository.spec.ts test/loans-contracts.spec.ts test/category-administration.spec.ts test/trust-contracts.spec.ts src/modules/rules/official-policy.spec.ts test/openapi-contract.spec.ts`](../../backend/vitest.config.offline.ts:1)

Comprobación de artefactos, también desde backend y sin DB:

[`node_modules\.bin\prisma.cmd migration check 20261104T1117_reservation_settings --config prisma.offline.config.ts`](../../backend/prisma.offline.config.ts:1)
