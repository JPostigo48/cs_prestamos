# Cierre de implementación Fase3 — 29/10/2026

## Resultado y alcance

14 contratos originales: **13 implementados + F02 ya existente reutilizado; 0 pendientes de implementación**. F01 tiene dos operaciones HTTP; la matriz contiene 15 operaciones. No equivale a disponibilidad externa ni despliegue.

Se retiró el registro provisional vacío y su test específico. El bloque genérico se conservó como [RemoteSection.vue](../../frontend/src/shared/components/RemoteSection.vue), independiente de rutas/IDs: carga, error normal, consulta explícita, vacío configurable, reintento, cancelación y detalle técnico solo en desarrollo. Los consumidores reales conservan sus adaptadores y estados. Sin cambios en Prototype/Figma, sidebar ni topbar.

Se usaron el [generador oficial](../../backend/scripts/generate-openapi.ts) y la sincronización focalizada existente [del Showcase](../../scripts/generate-project-showcase.mjs:20). Ambas copias tienen **75 operaciones**. No hubo edición manual del documento ni catálogo de producto paralelo. Se completaron filtros query de cuentas/reservas/historial, tipos UUID trust y restricciones de propiedad del tooltip desde metadata backend. No se regeneraron DB, equipo, planificación ni Git; DB y T&C siguen funcionando.

## Contratos verificados

U = USUARIO, O = OPERADOR, A = ADMINISTRADOR. Son permisos efectivos del backend, no inferidos de la navegación. En todas las filas, Showcase fue comprobado en Chrome filtrando método/ruta, respuesta y acceso. «Artículo» nunca significa ejemplar.

| ID | Método / ruta real | Módulo | Acceso backend | Consumidor principal | Showcase |
| --- | --- | --- | --- | --- | --- |
| F01 | POST /auth/google/authorization; POST /auth/google/authenticate | Auth | Público; sesión solo para cuenta aprobada/habilitada | [GoogleAccessPage.vue](../../frontend/src/modules/auth/pages/GoogleAccessPage.vue) | Sí, ambas |
| F02 | GET /terms/current | Reglas/términos | Público, ya existente | [TermsPanel.vue](../../frontend/src/modules/auth/components/TermsPanel.vue) | Sí |
| F03 | POST /auth/registration-requests | Auth/usuarios | Público; no crea sesión/cuenta antes de aprobación | [FullRegistrationForm.vue](../../frontend/src/modules/auth/components/FullRegistrationForm.vue) | Sí |
| F04 | GET /appeals | Trust | U propias; O/A operativas | [AppealsPage.vue](../../frontend/src/modules/trust/pages/AppealsPage.vue), [MyAppeals.vue](../../frontend/src/modules/trust/components/MyAppeals.vue) | Sí |
| F05 | GET /sanctions/:sanctionId | Trust | U propias; O/A operativas | [SanctionDetails.vue](../../frontend/src/modules/trust/components/SanctionDetails.vue) | Sí |
| F06 | GET /inventory/resources/:resourceId/accessories | Inventory | U/O/A autenticados | [ResourceDetailPage.vue](../../frontend/src/modules/inventory/pages/ResourceDetailPage.vue) | Sí |
| F07 | PUT /inventory/resources/:resourceId/accessories | Inventory | A | [ResourceEditorDialog.vue](../../frontend/src/modules/inventory/components/ResourceEditorDialog.vue) | Sí |
| F08 | GET /loans/resource/:resourceId/history | Loans | O/A; artículo, todos sus ejemplares | [ResourceHistory.vue](../../frontend/src/modules/loans/components/ResourceHistory.vue) | Sí |
| F09 | POST /loans/:loanId/return-checklist | Loans | O/A | [ReturnChecklist.vue](../../frontend/src/modules/loans/components/ReturnChecklist.vue) | Sí |
| F10 | GET /auth/accounts?userId | Auth | A | [UserActionsDialog.vue](../../frontend/src/modules/users/components/UserActionsDialog.vue) | Sí |
| F11 | POST /users/:userId/suspensions | Trust | A | [UserActionsDialog.vue](../../frontend/src/modules/users/components/UserActionsDialog.vue) | Sí |
| F12 | POST /sanctions/:sanctionId/lift | Trust | A | [UserActionsDialog.vue](../../frontend/src/modules/users/components/UserActionsDialog.vue) | Sí |
| F13 | PATCH /inventory/resources/:resourceId/loan-policy | Inventory | A | [ResourceEditorDialog.vue](../../frontend/src/modules/inventory/components/ResourceEditorDialog.vue) | Sí |
| F14 | GET /loans/reservations | Loans | U propias; O/A operativas | [ReservationsPanel.vue](../../frontend/src/modules/loans/components/ReservationsPanel.vue) | Sí |

Fuentes de autorización: controladores [auth](../../backend/src/modules/auth/presentation/controllers/auth.controller.ts), [inventory](../../backend/src/modules/inventory/presentation/controllers/inventory.controller.ts), [loans](../../backend/src/modules/loans/presentation/controllers/loans.controller.ts), [trust](../../backend/src/modules/rules/presentation/controllers/sanctions.controller.ts); propiedad en [reservas](../../backend/src/modules/loans/application/use-cases/loan-contracts.use-cases.ts:23) y [trust](../../backend/src/modules/rules/application/use-cases/manage-sanctions.use-case.ts:19).

## Verificación final razonable

- Backend normal, una pasada completa: **530 casos, 525 pasan y 5 fallan** exclusivamente por la lista de controladores del test OpenAPI que omitía SanctionsController. Se añadió ese controlador sin eliminar assertions; repetición oficial focalizada: **106/106 pasan**. Los otros **424** casos ya habían pasado. No se repitió la batería completa.
- Frontend normal, una pasada completa: **195 casos, 192 pasan y 3 fallan**. Se corrigieron dos expectativas obsoletas (75 operaciones y error normalizado 503) y el fixture antiguo del editor (faltaban política/accesorios y provocaba error de render). Repetición de los tres archivos afectados: **20/20 pasan**. Los otros **175** ya habían pasado. Sin debilitar assertions ni repetir la batería completa.
- [Regresión específica de Showcase](../../frontend/tests/phase3-showcase.test.mjs): **16/16**, dentro de la pasada normal; incluye las 15 operaciones, esquemas completos recursivos de entradas/respuestas/errores, UUID, filtros, JWT, roles, propiedad y públicas sin candado. [Estados remotos](../../frontend/tests/remote-section.test.mjs): **2/2**, también dentro de esa pasada.
- Tipos backend: correcto. Tipos frontend y build oficial: bloqueados exclusivamente por los **6 errores previos de Prototype**, en [ApplicationPrototypePage.vue](../../frontend/src/modules/prototype/pages/ApplicationPrototypePage.vue:759) (759, 761, 762, 763, 769, 965). No se modificó la referencia ni se ocultó por configuración.
- Comprobación oficial de sincronía OpenAPI: **75 operaciones verificadas**. Empaquetado Vite complementario sin entorno: correcto; **no sustituye el build oficial**.
- Chrome **156.0.8078.48**, bundle estático recién empaquetado: **21 casos únicos verificados**. Primera pasada: 9 pasan y 12 fallan por el harness (foco mientras terminaba scroll y expectativa de 48 horas en lugar de 2 días); repetición solo de esos 12 con hover real y presentación correcta: **12/12 pasan**. Sin fallos de producto descubiertos en esa comprobación.
- Navegador: filtros de las 15 operaciones, respuestas con esquemas, roles/propiedad, públicas sin candado; DB con 31 modelos y búsqueda; T&C con lectura pública; Google 503 sin sesión, detalle con accesorios/política, reservas propias a demanda/diálogo/Escape y bandeja de apelaciones. API interceptada **solo en pruebas**, declarada; no certifica backend desplegado, proveedor Google ni DB. Sin errores de runtime ni fixtures inesperados. Perfil temporal y servidor cerrados.

## Persistencia y requisitos externos pendientes

No se detectaron ejecutables, servicio ni puerto local 5432 de PostgreSQL en la comprobación breve. **No se probó PostgreSQL real**. Las suites HTTP/JWT usan repositorios/SQL y transacciones en memoria, más planes del ORM nativo offline; no certifican bloqueos entre procesos ni migraciones reales. No se cargaron secretos, inició Docker Compose ni conectó a Neon.

Permanecen preparadas y **NO APLICADAS**, en orden:

1. [Alta integral](../../backend/prisma/migrations/app/20261029T0430_integral_registration/migration.ts).
2. [Inventario/accesorios/política](../../backend/prisma/migrations/app/20261029T0439_inventory_accessories_policy/migration.ts).
3. [Snapshots/checklist](../../backend/prisma/migrations/app/20261029T0544_loans_snapshots_checklist/migration.ts).

Su aplicación real requiere autorización y revisión operativa de datos existentes; trust no añade migración. No están «listos en Neon» por estas pruebas.

Google requiere GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REDIRECT_URI, redirect autorizado y cuenta institucional aprobada/habilitada. Sin configuración responde 503. Valida firma, issuer, audience y nonce; estado efímero de un uso exige instancia única/afinidad. No se verificó integración con Google externo ni se obtuvieron secretos. Detalles: [auth integral](auth-integral.md).

Se conserva la semántica implementada: suspensión no cierra préstamos ni libera ejemplares prestados; levantamiento finaliza/reprograma fechas sin absolver ni restituir confianza; legacy sin snapshot no reconstruye accesorios pasados. No hubo commits, cambios de índice/ramas/configuración Git, migraciones remotas ni despliegue.
