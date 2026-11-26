# Correctivo de condición física: solo base de datos de prueba

Asigna APTO a **todos** los ejemplares: sobrescribe nulos y cualquier otra
condición, incluso dañados, incompletos, perdidos, robados, ocupados o
deshabilitados. No consulta historial ni deja pendientes por condiciones previas.
Solo modifica la condición física; no cambia ocupación, habilitación, fechas,
préstamos, reservas, sanciones ni historial. **APTO no equivale a libre.**

Desde la raíz del repositorio, previsualización predeterminada sin escrituras:

    npm run seed:repair-copy-conditions

Aplicación directa, sin confirmaciones adicionales:

    npm run seed:repair-copy-conditions -- --apply

Conserva la carga diferida de configuración habitual del backend, sin exigir
exportación manual. No se ejecuta automáticamente ni invoca otros seeds.
La aplicación usa una sola actualización SQL parametrizada, idempotente,
limitada a condiciones distintas de APTO. Los ya APTO no cuentan como actualizados.

La salida solo contiene modo y totales: total, aptos antes, propuestos en preview,
actualizados y aptos al finalizar. Los conteos y la actualización están dentro de
una transacción; ante error se revierte. Sin filas, los totales son cero.
No expone identificadores, usuarios ni conexión. Un fallo termina con código 1.

Validación del agente exclusivamente offline con dobles; **no aplicado en Neon**
ni en otra base de datos. No requiere migraciones ni cambios de esquema.
