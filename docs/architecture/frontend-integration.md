# Integración frontend de la aplicación real

La aplicación Vue usa los módulos de autenticación, usuarios, inventario, préstamos y confianza. Conserva separadas la aplicación real, la referencia visual y la presentación del proyecto. Esta guía integra y reemplaza el documento de primer corte que estaba en el directorio frontend.

**Actualización Fase3 (29/10/2026):** los 14 contratos originales tienen backend y consumidores reales (F02 reutilizado). El registro provisional fue retirado. Estado vigente, permisos, verificaciones y requisitos externos: [cierre de implementación](../development/phase3-closure.md). Las tablas de cobertura y los resultados de cortes anteriores más abajo son históricos, no pendientes actuales. No implican despliegue ni migraciones aplicadas.

## Arquitectura y ejecución

- [Transporte HTTP único](../../frontend/src/shared/api/client.ts): base pública configurada o proxy local; bearer, cancelación y errores HTTP. No hay respuestas simuladas, servidor mock, polling ni fallback de datos en producción.
- [Sesión y autenticación](../../frontend/src/modules/auth/api/auth-api.ts): sesión de pestaña validada, expiración, limpieza por 401 autenticado y conservación por 403. El rol de acceso no se deduce del tipo institucional ni del correo.
- [Política de acceso](../../frontend/src/modules/auth/access-policy.ts) y [router](../../frontend/src/router.ts): ADMINISTRADOR accede a todas las operaciones de OPERADOR. Los destinos de retorno se validan mediante una allowlist. Los guards frontend no reemplazan autorización backend.
- [Layout real](../../frontend/src/shared/layouts/AppLayout.vue): sidebar azul, cabecera blanca, navegación móvil, tarjetas, tablas con desplazamiento local, foco visible y enlace para saltar al contenido. Estilos restringidos al contenedor real o encapsulados en componentes. Sin marco de teléfono ni altura fija de aplicación.
- [Cargas independientes](../../frontend/src/shared/composables/useRemote.ts): cancelan respuestas obsoletas, conservan error por bloque y permiten actualización manual. Las consultas operativas a demanda no reintentan automáticamente.
- [Sección remota normal](../../frontend/src/shared/components/RemoteSection.vue): conserva presentación y consulta explícita, cancelación, carga, error, vacío configurable, reintento y detalle técnico solo en desarrollo. No conoce IDs Fxx ni rutas propuestas. Los consumidores de negocio usan sus adaptadores reales.
- [Bloqueo de mutaciones inciertas](../../frontend/src/shared/api/mutation-guard.ts): reservas, recogida, cancelación, resoluciones, suspensión, levantamiento, alta de recurso/ejemplar y registro integral no se repiten automáticamente ni por reabrir el formulario. Conserva solo claves de operación, no cuerpos ni credenciales. Una consulta que confirma una operación permite reconciliarla; su ausencia no prueba que haya fallado. Sin lectura confirmatoria, el bloqueo incierto se mantiene durante la pestaña. El servidor no garantiza idempotencia.
- [Fechas](../../frontend/src/shared/format.ts): salida con zona America/Lima; los formularios etiquetan la hora local del dispositivo y convierten a ISO con zona antes del envío.

El formulario de acceso real está aislado en [RealLoginForm.vue](../../frontend/src/modules/auth/components/RealLoginForm.vue). No importa componentes ni estado simulado de la referencia. El formulario visual compartido original, los módulos de referencia, sus assets y la configuración/dependencias permanecen sin cambios.

## Rutas y roles

| Ruta | Acceso / función |
| --- | --- |
| /login, /login/google, /register | Público; autenticación propia, OIDC Google configurado y solicitudes separadas |
| /app | Inicio personal de USUARIO |
| /app/catalog, /app/catalog/:resourceId | Todos los roles autenticados; catálogo compartido y reserva propia |
| /app/reservations | Todos los roles; reservas propias y aceptación informada de términos |
| /app/loans | OPERADOR y ADMINISTRADOR; activos, mora, recepción y entregas |
| /app/registrations | OPERADOR y ADMINISTRADOR; aprobación/rechazo de vinculación. Alta de acceso solo ADMINISTRADOR |
| /app/admin/appeals, /app/admin/users, /app/admin/catalog | Solo ADMINISTRADOR |
| /app/denied | Acceso denegado sin cerrar la sesión |
| /prototype, /project | Referencia y documentación; accesos preservados |

Inicio de sesión: USUARIO → inicio personal; OPERADOR → operaciones; ADMINISTRADOR → apelaciones, manteniendo acceso inmediato a operaciones.

## Cobertura funcional de la referencia

**Integrado** significa UI y llamada HTTP conectadas, con pruebas offline; no certificación contra servicios ni aprobación visual. **Parcial/API** significa interfaz entregada con petición propuesta y error visible, pero falta backend. Se conservan siempre los estados de carga, error, vacío y confirmación pertinentes.

| ID | Interfaz / acción | Estado y archivo principal |
| --- | --- | --- |
| V01 | Acceso, visibilidad de contraseña y envío | Integrado: [login](../../frontend/src/modules/auth/pages/LoginPage.vue) |
| V02 | Google, correo y volver | Parcial/API F01: [acceso Google](../../frontend/src/modules/auth/pages/GoogleAccessPage.vue); no emite sesión por correo |
| V03 | Registro, evidencia textual y alta integral separada | Básica integrada; términos/alta integral F02/F03: [registro](../../frontend/src/modules/auth/pages/RegistrationRequestPage.vue). Sin upload ni cuenta creada ficticiamente |
| V04 | Bienvenida, habilitación y confianza | Integrado: [inicio](../../frontend/src/modules/users/pages/StudentAppPage.vue), bloques independientes |
| V05 | Categorías, contadores, ver todo y búsqueda | Integrado: [inicio](../../frontend/src/modules/users/pages/StudentAppPage.vue); contador rotulado como recursos, no ejemplares disponibles |
| V06 | Préstamos propios, estado/mora e historial | Integrado: [inicio](../../frontend/src/modules/users/pages/StudentAppPage.vue), nombres enriquecidos o ID real |
| V07 | Sanciones y estado de apelación | Estado básico integrado; detalles F05 y apelaciones F04 a demanda |
| V08 | Apelar y cancelar diálogo | Integrado: [inicio](../../frontend/src/modules/users/pages/StudentAppPage.vue); motivo no vacío, máximo 2000 |
| V09 | Catálogo, filtros, paginación, búsqueda y vacío | Integrado: [catálogo](../../frontend/src/modules/inventory/pages/CatalogPage.vue); busca nombre y conserva filtros URL |
| V10 | Detalle, duración, códigos y disponibilidad | Integrado: [detalle](../../frontend/src/modules/inventory/pages/ResourceDetailPage.vue); total exacto por lista de ejemplares, incluido RESERVADO |
| V11 | Partes y accesorios del artículo | Parcial/API F06: sección visible en detalle, sin asumir lista vacía |
| V12 | Historial del artículo | Parcial/API F08: consulta para personal; aviso de privacidad para usuario |
| V13 | Reserva de ejemplar y hora futura | Integrado: [reserva](../../frontend/src/modules/loans/components/ReservationDialog.vue); ID y límite confirmados por servidor |
| V14 | Salir, inicio, navegación y roles | Integrado: [layout](../../frontend/src/shared/layouts/AppLayout.vue) y política compartida |
| V15 | Activos, mora, contadores y recibir | Integrado: [operaciones](../../frontend/src/modules/loans/pages/LoanOperationsPage.vue); listas independientes |
| V16 | Checklist y puntualidad de recepción | Puntualidad derivada; checklist F06/F09 separado: [revisión](../../frontend/src/modules/loans/components/ReturnChecklist.vue) |
| V17 | Confirmar recepción, cerrar y errores | Integrado: [devolución](../../frontend/src/modules/loans/components/ReturnLoanDialog.vue); no promete sanción automática |
| V18 | Bandeja administrativa y pendientes | Parcial/API F04: [apelaciones](../../frontend/src/modules/trust/pages/AppealsPage.vue); cantidad desconocida si no se obtuvo lectura |
| V19 | Aprobar/rechazar y fundamento | Integrado sobre IDs obtenidos por la bandeja; resolución real ACEPTADA/RECHAZADA. Descubrimiento bloqueado por F04 |
| V20 | Usuarios, filtros, estado, correo y rol | Lista integrada: [usuarios](../../frontend/src/modules/users/pages/UsersManagementPage.vue); cuenta/correo/rol dependen de F10, teléfono no disponible |
| V21 | Cambio de rol | PATCH real con ID de cuenta verificado; descubrimiento bloqueado por F10. No se cambia tipo institucional ni se degradan administradores |
| V22 | Suspender/levantar | Parcial/API F11/F12: [acciones](../../frontend/src/modules/users/components/UserActionsDialog.vue); no sustituye sanción por login o vinculación |
| V23 | Historial completo de usuario | Préstamos/sanciones integrados e independientes: [historial](../../frontend/src/modules/users/components/UserHistoryDialog.vue). Detalles enriquecidos F05 |
| V24 | Gestión de catálogo e inventario | Integrado: [gestión](../../frontend/src/modules/inventory/pages/InventoryManagementPage.vue), reutiliza catálogo/adaptador |
| V25 | Crear y editar recurso | Integrado: [editor](../../frontend/src/modules/inventory/components/ResourceEditorDialog.vue), solo nombre/descripción/categoría |
| V26 | Código único y cantidad | Integrado: [ejemplares](../../frontend/src/modules/inventory/components/CopyManager.vue), código explícito y cantidad derivada. No libera ocupados |
| V27 | Tiempo máximo por artículo | Duración heredada visible; excepción individual F13 pendiente, no modifica política de toda categoría |
| V28 | Partes por coma y checklist | Lectura/escritura F06/F07 y revisión F09 pendientes; guardado separado, sin éxito compuesto ficticio |
| C01 | Recuperar/cancelar reservas y entregar | Acciones reales integradas; lectura F14 pendiente: [reservas](../../frontend/src/modules/loans/components/ReservationsPanel.vue) |
| C02 | Leer/aceptar versión de términos | POST real integrado con usuario, versión leída e instante; lectura F02 pendiente: [términos](../../frontend/src/modules/auth/components/TermsPanel.vue) |
| C03 | Revisar solicitud y crear acceso | Integrado: [solicitudes](../../frontend/src/modules/users/pages/RegistrationRequestsPage.vue). Aprobación no crea cuenta; alta administrativa separada con correo/clave explícitos y rol USUARIO |
| C04 | Renovación, notificaciones, pérdida/robo y motor de sanción | Fuera de las acciones de estas referencias; sin nueva UI ni rutas inventadas |

## Endpoints existentes usados

Los adaptadores de cada módulo concentran las rutas de negocio; los componentes no construyen URLs HTTP.

- Autenticación: POST /auth/authenticate; POST /users/registration-requests; POST /auth/accounts; PATCH /auth/accounts/:accountId.
- Usuario: GET /users; GET /users/:userId; GET /users/:userId/loan-eligibility; GET /users/:userId/trust; GET /users/:userId/sanctions.
- Solicitudes: GET /users/registration-requests; POST /users/registration-requests/:requestId/approve y /reject.
- Inventario: GET /inventory/categories; GET/POST /inventory/resources; GET/PATCH /inventory/resources/:resourceId; GET/POST /inventory/resources/:resourceId/copies; GET /inventory/copies/:copyId; PATCH /inventory/copies/:copyId/state.
- Préstamos: GET /loans/active y /loans/overdue; GET /loans/user/:userId/history; GET /loans/:loanId; POST /loans/:loanId/return; POST /loans/reservations; DELETE /loans/reservations/:reservationId; POST /loans/reservations/:reservationId/pickup.
- Confianza/términos: POST /sanctions/:sanctionId/appeals; PATCH /appeals/:appealId/resolution; POST /terms/acceptances.

No se pretende exponer las 53 operaciones del inventario backend como un backoffice nuevo: se conectan las necesarias para las acciones de la referencia y sus cuatro complementos.

## Semántica de errores y escrituras

- Un resultado desconocido nunca se presenta como cero, vacío o éxito. Los listados distinguen sin respuesta de respuesta vacía.
- Una incidencia de devolución exige texto; cualquier observación no vacía deja la copia NO_DISPONIBLE en el backend. Sin incidencia se omite la propiedad, no se envía «sin observaciones».
- El [bloqueo de devolución](../../frontend/src/modules/loans/api/loans-api.ts) del primer corte se refuerza. Red, 5xx o cuerpo no confirmatorio requieren consultar el préstamo. Solo una devolución finalizada válida y coincidente libera el bloqueo. Una lectura ACTIVO, un 404 o un ID ajeno no prueban que un envío previo haya fallado ni habilitan repetirlo.
- Accesorios, ejemplares, datos básicos y excepción de política se guardan por separado. El fallo de una etapa no deshace ni declara completas otras escrituras confirmadas.
- Sanción no equivale a cuenta deshabilitada o vinculación no vigente. Resolver apelación no borra el historial ni absuelve otras sanciones.
- ADMINISTRADOR no cancela reservas ajenas ni apela sanciones ajenas por ser administrador: las acciones personales conservan ownership.

## Correcciones obligatorias de revisión I1–I9 · 2026-10-28

Se conserva la implementación anterior. El Reviewer fue estático; los resultados siguientes corresponden a ejecuciones de esta corrección, no se atribuyen al Reviewer ni a una fase anterior no demostrada.

| Incidencia | Corrección y archivos principales | Pruebas nuevas concretas |
| --- | --- | --- |
| I1 | [Guardia de mutaciones](../../frontend/src/shared/api/mutation-guard.ts) captura clave y marcador por operación. Las reconciliaciones capturan la cuenta y los marcadores observados antes de la lectura. [Devoluciones](../../frontend/src/modules/loans/api/loans-api.ts) y [diálogo](../../frontend/src/modules/loans/components/ReturnLoanDialog.vue) conservan el titular durante toda la operación. | 5: 401 y relogin, cuentas sucesivas/respuestas inversas, lectura tardía de devolución, generación posterior de la misma cuenta y diálogo de devolución con 401. |
| I2 | [Adaptador de alumno](../../frontend/src/modules/users/api/student-api.ts) valida ID no vacío, estado PENDIENTE, titular y sanción; guarda confirmación reactiva en memoria y bloquea duplicados. [Inicio](../../frontend/src/modules/users/pages/StudentAppPage.vue) muestra el ID real, deshabilita reapelación y permite recuperar el motivo pendiente tras cerrar. Los motivos no se persisten en almacenamiento del navegador. | 8: null, titular ajeno, sanción ajena, estado incorrecto, confirmación/relogin, incertidumbre de red y dos montajes de confirmación/incertidumbre con conservación del texto y remontaje. |
| I3 | [Inventario](../../frontend/src/modules/inventory/api/inventory-api.ts) identifica altas por categoría/nombre/descripción normalizados y ejemplares por recurso/código. Las lecturas reconcilian únicamente coincidencias positivas exactas; ausencia o contenido diferente no liberan. La consulta positiva de un recurso conserva su ID en memoria para no repetir POST desde el editor. No se guardan credenciales. | 2: A incierta y B independiente, lectura ausente/diferente/positiva y recuperación del ID sin POST; códigos de ejemplar independientes. La identidad de recurso usa la unicidad categoría/nombre existente del servidor, además de comprobar descripción. |
| I4 | [Reserva](../../frontend/src/modules/loans/components/ReservationDialog.vue) ofrece cancelar la confirmación recibida con ID y titular reales, motivo opcional, confirmación humana y resultado validado. No depende del listado provisional ni inventa una lista. | 2: montaje POST exitoso → F14 404 → confirmación humana → DELETE del ID real; titular ajeno sin red y cancelación incierta sin duplicado. |
| I5 | [Política](../../frontend/src/modules/loans/return-policy.ts) exige instante actual controlable; [diálogo](../../frontend/src/modules/loans/components/ReturnLoanDialog.vue) elimina la fecha editable, actualiza el reloj y muestra zona. Captura milisegundos al confirmar, no al abrir. El servidor sigue siendo autoridad temporal. | 2: fechas futuras/antedatadas, incluso ±1 ms; montaje que cruza vencimiento y envía la hora exacta de confirmación. |
| I6 | [Destinos de catálogo](../../frontend/src/modules/inventory/catalog-query.ts), [tarjeta](../../frontend/src/modules/inventory/components/ResourceCard.vue) y [detalle](../../frontend/src/modules/inventory/pages/ResourceDetailPage.vue) conservan filtros y origen mediante destinos internos permitidos. Gestión regresa a inventario solo para administrador. | 2: categoría/disponibilidad/página y origen en ambos contextos; enlaces montados y router de memoria real de ida y retorno. |
| I7 | Comparación de solo lectura con [escritorio de referencia](../../frontend/src/modules/prototype/components/StudentDesktopPage.vue) y [referencia móvil](../../frontend/src/modules/prototype/pages/ApplicationPrototypePage.vue). [Layout](../../frontend/src/shared/layouts/AppLayout.vue): marca lateral y cabecera sobre contenido; [inicio](../../frontend/src/modules/users/pages/StudentAppPage.vue): tabla desktop y contador; [inventario](../../frontend/src/modules/inventory/pages/CatalogPage.vue): tabla desktop y tarjetas móviles; [detalle](../../frontend/src/modules/inventory/pages/ResourceDetailPage.vue): dos columnas y disponibilidad destacada; [tarjeta](../../frontend/src/modules/inventory/components/ResourceCard.vue): sin franja gráfica añadida; [usuarios](../../frontend/src/modules/users/pages/UsersManagementPage.vue): tarjetas móviles; [registro](../../frontend/src/modules/auth/components/FullRegistrationForm.vue): visibilidad de contraseña accesible. Estilos aislados, sin marco de teléfono ni identidades ficticias. | 4 montajes propios (layout, inventario, usuarios, contraseña), 1 compartido con I8 (inicio), y comprobación de columnas/disponibilidad dentro del montaje de I6. No se afirma equivalencia visual por píxeles. |
| I8 | [Disponibilidad global](../../frontend/src/modules/inventory/api/inventory-api.ts) usa GET /inventory/availability, fuente completa existente. Agrega solo ejemplares disponibles por categoría, separados de recursos registrados. Error/cuerpo incompatible se muestra como desconocido, nunca como cero. | 2 propias + montaje de inicio compartido con I7: agregación multirrecurso/multicategoría, categorías vacías, ocupados no sumados, errores y cuerpo inválido; 5 recursos registrados frente a 2 ejemplares disponibles. |
| I9 | [Calendario](../../frontend/src/shared/api/calendar.ts), [contratos](../../frontend/src/shared/api/provisional-contracts.ts) y [confianza](../../frontend/src/modules/trust/api/trust-api.ts): F11 solo ACTIVA/PROGRAMADA, fechas reales y periodo ordenado; respuesta coincidente en usuario, estado y fechas solicitadas. F05 exige el ID solicitado. | 3: finalizada/fecha imposible/periodo invertido; titular/estado/fechas ajenos y F05 ajena; confirmación activa y programada con periodo exacto. |

Las 31 pruebas nuevas están en [regresiones conductuales de esta corrección](../../frontend/tests/phase3-corrections.test.mjs). Se mantienen las 94 anteriores: 63 de políticas/adaptadores/regresiones y 31 compilaciones de componentes. Se actualizaron únicamente fixtures incompatibles con los requisitos: titular en confirmaciones, ID solicitado en detalle y reloj explícito en pruebas temporales. No se eliminaron aserciones para obtener resultados positivos.

### Ejecuciones y salidas

Desde el directorio [frontend](../../frontend/), sin instalaciones, backend ni peticiones externas:

| Comando | Salida comprobada |
| --- | --- |
| `node --test tests/*.test.mjs` | 125 pruebas, 125 aprobadas, 0 fallidas, 0 omitidas. 31 nuevas, de las cuales 11 montan componentes. En la terminal se usó además un envoltorio que enumera los mismos archivos y conserva el código de salida, abreviando solo las URLs base64 de módulos de pruebas en los errores. |
| `npm run typecheck` | Salida 2. Seis diagnósticos en [ApplicationPrototypePage.vue](../../frontend/src/modules/prototype/pages/ApplicationPrototypePage.vue): TS2322 en 759, 761, 762, 763 y 769; TS6133 en 965. No aparecen diagnósticos fuera de esa referencia. |
| `npm run build` | Salida 2, los mismos seis diagnósticos. No alcanza Vite. También se ejecutó antes de modificar código y ya mostraba exactamente esos seis diagnósticos; esto demuestra su existencia al inicio de esta sesión, no el estado de un commit histórico. |
| `node --input-type=module -e "import { build } from 'vite'; await build({ envFile: false, build: { write: false } });"` | Salida 0, 2055 módulos transformados. Usa la configuración existente y toda la aplicación; no lee archivos de entorno ni escribe artefactos. Empaquetado complementario, **no equivale al build oficial aprobado**. |

El [host de pruebas en memoria](../../frontend/tests/helpers/renderer.mjs) ejecuta render, directivas, eventos y ciclos de vida con el renderer Vue instalado; [el cargador](../../frontend/tests/helpers/modules.mjs) compila componentes reales. No hay biblioteca DOM ni runner de navegador instalado en frontend y no se añadieron dependencias. Estos montajes no acreditan layout CSS, tamaños 320–1440, zoom, comportamiento nativo del diálogo ni foco/teclado de navegador. Esa comprobación visual/manual sigue pendiente.

### Preservación y estado Git

- Se compararon las 235 entradas del registro externo autorizado mediante SHA-256: **235/235 al inicio y 235/235 al cierre**, sin discrepancias. No se amplió ni modificó ese registro. No se leyeron secretos ni se copiaron notas personales al repositorio.
- El estado inicial ya mostraba cambios locales y archivos sin seguimiento de la integración. Se conservaron; no se presenta el árbol como limpio ni se atribuyen todos los cambios a esta sesión.
- `git status --short`, `git diff --name-only` y `git diff --cached --name-only` se consultaron en el repositorio. El índice no muestra diferencias. `git diff --check` termina con salida 0; hay avisos de conversión LF/CRLF, no errores de espacios. Esa comprobación de Git cubre los archivos seguidos, no certifica por sí sola los nuevos.
- No se ejecutaron commits, push, merge, cambios de rama/índice/configuración Git, instalaciones globales, consultas al backend ni acceso a bases de datos. Backend, Prototype, dependencias protegidas y estilos globales permanecen sin cambios según las 235 huellas.

### Pendientes legítimos de servidor

Siguen faltando los 14 contratos provisionales propuestos, incluidos F04/F05/F11/F14; las pantallas no los simulan. La cancelación de la reserva confirmada usa el endpoint existente y no necesita F14. La consulta global de disponibilidad de I8 **sí existe**, no es un contrato nuevo.

El backend de inventario conserva escrituras públicas y la carrera de estado de copias; los cambios de rol/habilitación no revocan JWT ya emitidos; la serialización temporal de apelaciones conserva el riesgo documentado. La protección local no reemplaza idempotencia/transacciones/ownership del servidor ni se extiende entre pestañas o dispositivos. Las confirmaciones y motivos de apelación son memoria de la pestaña: una recarga pierde esos datos personales, pero el marcador de resultado incierto permanece; sin consulta titular implementada no se autoriza reenviar por ausencia de evidencia. No se ha modificado backend ni se declara solucionada su seguridad.

## Correctivo final R1–R3, I7 y reflow · 2026-10-28

Este bloque sucede a la validación independiente con capturas; no reemplaza ni atribuye resultados nuevos a las ejecuciones históricas anteriores.

| Requisito | Implementación y regresión |
| --- | --- |
| R1 · Recuperación de inventario | [Adaptador](../../frontend/src/modules/inventory/api/inventory-api.ts:127): conserva únicamente el ID recuperable de una intención. Antes de devolverlo vuelve a consultar el detalle y exige misma cuenta, ID y datos normalizados; una lectura fallida o diferente no envía un alta alternativa. La recuperación se consume al entregarla al editor. Una edición confirmada invalida recuperaciones relacionadas con ese ID. Se mantiene el bloqueo de envíos inciertos sin evidencia positiva. |
| R2 · Pestañas | [Operaciones](../../frontend/src/modules/loans/pages/LoanOperationsPage.vue:83): contenedor DOM estable controla visibilidad y conserva el componente y las operaciones pendientes. Ni montaje ni cambio de pestaña consultan F14. |
| R3 · Totales | [Inventario](../../frontend/src/modules/inventory/pages/CatalogPage.vue:135): el agregado que omite reservados no se presenta como total exacto; se informa desconocido y se remite al detalle, sin consultas de copias por fila. [Detalle](../../frontend/src/modules/inventory/pages/ResourceDetailPage.vue:67): la lista completa permite mostrar «1 disponible de 2 ejemplares totales»; carga/error no habilitan reserva con datos anteriores, y reservado nunca es una opción elegible. |
| I7 · Inicio | [Inicio personal](../../frontend/src/modules/users/pages/StudentAppPage.vue:83): saludo pequeño, nombre principal, habilitación y confianza compactas, perfil/razones/advertencias desplegables y cargas/reintentos independientes. Habilitación no significa cuenta de acceso activa. Sin búsqueda duplicada. Sanción ACTIVA antes de categorías; historial después de préstamos. Categorías reales sin iconos inferidos, grilla específica de hasta tres columnas y cantidades disponibles como dato principal. Tabla personal de 14 px con un contenedor, nombre/código juntos, vencimiento/estado prioritarios e inicio secundario; tarjetas móviles con inicio desplegable. |
| I7 · Layout y reflow | [Layout real](../../frontend/src/shared/layouts/AppLayout.vue:1): sidebar 232 px, cabecera desktop 72 px, búsqueda flexible de máximo 470 px en una fila y etiqueta accesible, logo blanco 36 × 36 con padding 4, navegación de 14 px con iconos. Escritorio desde 1024 px; móvil con accesos inferiores y Más para todos los destinos/cuenta, safe area y espacio para contenido/foco. El estado contextual del cuerpo neutraliza su mínimo solamente mientras está montada la aplicación real; se retira al salir. No se modifica la hoja global, no se oculta overflow global y no se usa un marco de teléfono. |

### Pruebas y resultados de este bloque

- [Nueve regresiones nuevas](../../frontend/tests/final-corrections.test.mjs): secuencia completa de editor A incierta → lectura → recuperación → renombre B → Nuevo A con otro ID → ejemplar asignado al ID nuevo; revalidación remota/fallo de lectura sin POST alternativo; invalidación de recuperación no consumida; DOM de pestañas con F14 pendiente conservado; detalle disponible+reservado y solo reservado; inventario sin total engañoso ni consultas masivas; cargas independientes y orden del inicio; navegación ADMIN y limpieza del estado contextual al desmontar.
- Las **125 pruebas anteriores se conservan**, más nueve: **134 aprobadas, cero fallidas/omitidas**. En las [regresiones previas](../../frontend/tests/phase3-corrections.test.mjs) se exige ahora la relectura de recuperación sin POST; el contador se comprueba en su fila, y el texto de cantidades se compara normalizando espacios entre nodos. No se eliminan casos ni se omiten aserciones.
- Comprobación de tipos y build oficial: **salida 2, exactamente los seis diagnósticos históricos de Prototype**, sin diagnósticos en aplicación real. No se silenciaron ni excluyeron. **El build oficial no está aprobado.**
- Empaquetado complementario con carga de entorno y escritura desactivadas: **salida 0, 2056 módulos**, sin instalaciones ni cambios de configuración/dependencias. No sustituye la comprobación de tipos ni el build oficial.
- Chrome local mediante CDP: **20/20 casos**, cero avisos/excepciones de producto. API interceptada, destinos externos bloqueados y cortafuegos local anterior al proxy; no se inició backend ni se usaron credenciales reales.
- **35 medidas de páginas reales** a 320/375/768/1024/1440: inicio, catálogo, detalle, reservas, usuarios, inventario y operaciones; sin overflow global. Otras cinco medidas de inicio al zoom nativo 200 %: sin overflow, incluso anchos físicos 320/375 que resultan en áreas cliente CSS 152/180. Cinco medidas adicionales de Prototype conservan su referencia. No se afirma haber medido todas las páginas al 200 %.
- Geometría de inicio: a 320, cliente y contenido **305/305 px**, categorías desde **258 px** y préstamos desde **563 px**, ambos en el primer viewport de 900 px aun con una categoría de nombre largo. A 1440, sidebar **232 px**, header **72 px**, búsqueda **470 × 42 px**, categorías desde **229 px** y préstamos desde **460 px**. Se inspeccionaron capturas reales a 320/1440 y 200 %, frente a las referencias preservadas; no es comparación por píxeles ni certificación estética global.
- Más muestra 3/4/7 destinos para USUARIO/OPERADOR/ADMINISTRADOR. Al navegar cierra y enfoca contenido. En una sonda móvil, el último control enfocado termina en **824 px**, antes del borde de navegación inferior en **835 px**. No se certifican todas las combinaciones de lector de pantalla/teclado/dispositivo.
- Salida mediante el enrutador instalado, sin recargar documento: Prototype y showcase recuperan mínimo de **320 px**, sin clase contextual real. La primera sonda usó una importación dinámica que no ejercitó ese enrutador; se conserva su fallo como incidencia del harness, no se oculta como éxito.
- **235/235 huellas protegidas** coincidentes. Sin modificaciones de backend, Prototype, estilos globales, manifiestos/configuración ni reglas de agentes; sin Git mutante, acceso a entorno, BD o servicios externos. Evidencias/capturas y scripts del harness permanecen fuera del repositorio, separadas de informes personales existentes. Índice sin diferencias; comprobación de espacios aprobada. Vite y Chrome de prueba cerrados, sin listeners ni perfil efímero.

Los límites de servidor de la sección anterior permanecen. El bloqueo local no aporta atomicidad ni idempotencia entre clientes; la revalidación no elimina carreras externas posteriores a la lectura. Los contratos provisionales siguen pendientes. Este cierre acredita las correcciones indicadas y las mediciones descritas, no una auditoría global ni un build oficial aprobado.
