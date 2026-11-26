# Registro y revisión: pendientes 11–18

**Integración documental posterior:** [OpenAPI regenerado y comprobaciones focales](final-contract-integration.md:1). La falta de regeneración indicada al final describe esta entrega original, no el estado posterior de los artefactos.

Corte ejecutado el 25/11/2026, aproximadamente 20:08–20:28 Lima (26/11 UTC).
Esta evidencia corresponde exclusivamente al trabajo de registro/revisión. No
se suman ni se atribuyen las corridas anteriores de préstamos, inventario o
compatibilidad. El árbol de trabajo ya contenía modificaciones de otros autores;
se conservaron, sin operaciones sobre índice, ramas o historial.

## Implementación y prueba por pendiente

| Pendiente | Implementación | Evidencia ejecutada |
| --- | --- | --- |
| 11 | La [bandeja](../../frontend/src/modules/users/pages/RegistrationRequestsPage.vue) compara la consulta normalizada completa: si es idéntica refresca explícitamente; si cambia, solo actualiza el origen observado. Conserva cancelación y generación del composable compartido, sin modificarlo. | [Pruebas montadas](../../frontend/tests/registration-review.test.mjs): ambos roles, vacío → nueva solicitud → mismos filtros sin remontar, un request al cambiar filtro, respuesta anterior tardía, página 2 sin filas mezcladas. |
| 12 | [Parser selectivo](../../backend/src/shared/infrastructure/http/request-body-parser.ts) instalado por el [arranque](../../backend/src/main.ts) antes de inicializar Nest, desactivando su parser automático. Solo POST de registro admite JSON hasta 15 MiB. | [HTTP real en memoria](../../backend/test/registration-transport.offline.spec.ts): con y sin prefijo, PDF exacto 10 MiB completo, JSON superior a 80 KiB, JPEG real exacto 60 KiB, excesos de un byte de ambos formatos, firma PDF falsa, exceso de transporte, JSON 413 sin HTML/stack, otras rutas a 100 KiB y raw body exacto. |
| 13 | [DTO](../../backend/src/modules/auth/presentation/dto/full-registration.dto.ts), [puerto](../../backend/src/modules/auth/application/ports/registration.port.ts), [entrada de usuarios](../../backend/src/modules/users/application/ports/users.inputs.ts), [política de campos nuevos](../../backend/src/modules/users/domain/policies/registration-fields.policy.ts), [registro integral](../../backend/src/modules/auth/application/use-cases/full-registration.use-case.ts) y [envío](../../backend/src/modules/users/application/use-cases/submit-registration-request.use-case.ts) exigen identificador y teléfono. El [formulario](../../frontend/src/modules/auth/components/FullRegistrationForm.vue) muestra errores por campo antes del envío. | DTO/HTTP y [llamadas directas](../../backend/test/registration-review.offline.spec.ts) rechazan omitido, nulo, vacío y blancos. Montajes verifican controles y errores accesibles; registro → adaptador → persistencia → bandeja se ejecuta con doble transaccional. |
| 14 | DTO y aplicación reutilizan la [política institucional existente](../../backend/src/modules/auth/domain/policies/institutional-email.policy.ts). Normalización exterior y minúsculas antes de validar. UI/API comparten una sola [política cliente](../../frontend/src/modules/auth/registration-policy.ts) y aviso anticipado de dominio exacto. | HTTP y cliente: mayúsculas + espacios exteriores aceptados; otros dominios, subdominios, sufijos engañosos, espacios interiores y múltiples arrobas rechazados. Se comprueba que la contraseña no cambia. |
| 15 | Contraseña de 8–128 caracteres, con al menos un carácter no blanco, sin transformación de su contenido. Validación en DTO, aplicación, formulario y API cliente. | Ocho espacios ASCII y blancos Unicode rechazados sin hash ni escritura. Se verifica el argumento exacto recibido por el hash y el cuerpo del formulario montado para los tres tipos institucionales, incluyendo espacios legítimos al inicio/final. |
| 16 | Preparar un PDF siempre solicita una firma nueva; no hay rama de reutilización de URL. El [endpoint protegido](../../backend/src/modules/users/presentation/controllers/registration-requests.controller.ts) emite no-store y conserva permisos y resolución de evidencia por solicitud/índice. | [Contratos HTTP](../../backend/test/auth-contracts.spec.ts): sin sesión 401, usuario 403, operador/admin 200, dos aperturas/preparaciones implican dos firmas, índice ajeno rechazado y cabeceras de no caché. Cliente verifica renovación y descarte anticipado. |
| 17 | Errores y reintento junto a la evidencia, fuera del modal. Ocupación por solicitud; cancelación al recargar/desmontar. Tras firmar, enlace nativo explícito a nueva pestaña con aislamiento del origen. [API PDF](../../frontend/src/modules/users/api/users-admin-api.ts) valida HTTPS y contrato de URL firmada de almacenamiento. | Montajes: error sin modal, reintento, doble clic sin firma duplicada, distintas solicitudes concurrentes, documentos de una solicitud serializados, aprobación/rechazo mientras firma, respuesta obsoleta descartada, URL insegura rechazada. No se abre ninguna ventana vacía. |
| 18 | [Listado](../../backend/src/modules/users/infrastructure/persistence/prisma/prisma-registration-request.repository.ts) ordena por fechaSolicitud DESC e id DESC antes de aplicar offset/límite. Total y página se derivan de la misma lectura ordenada dentro de la transacción. | Doble SQL: 45 filas con fecha idéntica + una posterior, inserción en orden inverso, filtros combinados, tres páginas, página vacía, orden exacto y lectura sin mutaciones. |

## Contrato del formulario

Todos los datos visibles son requeridos para un registro nuevo: nombre (2–180),
correo institucional (hasta 254), contraseña (8–128 y no solo blancos), tipo
institucional existente, identificador institucional (1–80), teléfono (1–20),
exactamente una evidencia y versión UUID de términos aceptada.

Nombre, identificador y teléfono se recortan solo en sus extremos. El correo se
recorta y convierte a minúsculas. La contraseña **no se recorta ni transforma**.
No se introduce una expresión normativa de DNI, código estudiantil o teléfono;
los identificadores válidos de profesores y administrativos siguen admitidos.

La aceptación conserva el contrato anterior: se envía la versión vigente que la
casilla de consentimiento habilitada confirma; no se agrega un booleano de
aceptación nuevo. La aplicación fija la fecha y el repositorio mantiene la
validación de versión vigente antes de persistir. La cuenta sigue pendiente de
revisión, sin emitir sesión ni devolver contraseña/hash.

Las [fixtures HTTP](../../backend/test/auth-contracts.spec.ts), las de
[persistencia](../../backend/src/modules/auth/registration-persistence.spec.ts),
las de [casos de uso](../../backend/src/modules/users/application/use-cases/registration-request.use-cases.spec.ts),
las [frontend de autenticación](../../frontend/tests/auth-user.test.mjs),
los [contratos cliente](../../frontend/tests/auth-contracts.test.mjs) y una fixture
de [regresiones](../../frontend/tests/review-regressions.test.mjs) se adaptaron
solo para proporcionar datos requeridos válidos. No se retiraron aserciones de
idempotencia, incertidumbre, permisos o credenciales.

## Transporte y errores

- Límite JSON de registro: **15 728 640 bytes** (15 MiB).
- PDF máximo: **10 485 760 bytes** (10 MiB), **13 981 016 bytes ASCII** en base64,
  más prefijo data URL y campos acotados. El límite del DTO para cada evidencia
  sigue siendo 14 000 000 caracteres y admite ese máximo.
- Imagen máxima: **61 440 bytes** (60 KiB), con comprobación real de formato.
- Otras rutas: **102 400 bytes** (100 KiB), tanto JSON como formulario URL-encoded.
- La ruta actual es POST /auth/registration-requests; el helper permite prefijo
  explícito y las pruebas también instalan /api. Acepta la barra final y la
  insensibilidad a mayúsculas propia del adaptador Express.
- No se ejecutan dos parsers JSON sobre el registro. La opción raw body del
  helper retiene los bytes verificados; no existía una configuración de webhooks
  en el arranque recibido y no se añadió un webhook de producción.
- El exceso JSON se transforma en excepción HTTP 413, procesada por el filtro
  global existente: respuesta JSON con estado, mensaje accionable, ruta y fecha;
  no HTML ni stack. JSON mal formado recibe 400. El frontend conserva el 413 y
  permite corregir el envío, sin marcarlo como resultado incierto.
- No se modificaron el filtro HTTP compartido, el cliente compartido ni su
  composable. El contrato especial del error de capacidad permanece intacto.

## PDF y caducidad

Cada pulsación de preparación solicita una firma nueva al endpoint autenticado.
No se reutiliza una firma por encontrarla en un mapa. Solo se conserva en memoria
el enlace preparado, nunca en logs ni almacenamiento persistente. La firma del
servicio existente dura 15 minutos; el cliente descarta el enlace a los 14 minutos
medidos conservadoramente **desde antes de iniciar la petición**, no desde recibir
la respuesta. Una preparación demasiado lenta se rechaza y el clic nativo también
comprueba ese plazo. Tras consumir el enlace se elimina sin impedir la navegación
nativa. No cambia la respuesta del endpoint ni se agrega un campo de expiración.

Se valida protocolo HTTPS, ausencia de credenciales/fragmento, ruta de objeto
firmado de almacenamiento, carpeta de evidencia de registro, nombre UUID PDF y
token no vacío. No se acepta una URL externa genérica ni una ruta de bucket
público. El despliegue conserva el bucket privado y TTL existentes: esta tarea
no modifica configuración de almacenamiento ni comprueba servicios reales.

## Orden y consistencia

**Actualización H4:** la materialización descrita en esta sección corresponde a
la entrega original y fue sustituida por el cambio acotado documentado abajo.

El runtime instalado no expone una opción de aislamiento en su transacción.
Para que count/list no procedan de dos snapshots READ COMMITTED diferentes, se
derivan total y página de **una única lectura de filas filtradas y ordenadas**;
después se cargan las evidencias de esa página mediante el mismo runtime de la
transacción. No se afirma aislamiento repetible para las consultas de evidencia.

El conteo anterior ya materializaba todas las coincidencias; ahora se elimina la
segunda lectura de solicitudes y se aplica el segmento de página en memoria.
Permanece coste O(n) de materialización para el total, no un conteo agregado
escalable. No se introduce SQL no soportado ni se simulan garantías PostgreSQL.
La paginación es offset: nuevas inserciones entre clics **pueden desplazar filas**;
no hay contrato de snapshot estático entre páginas.

### H4: conteo agregado y página limitada en una sentencia

El [listado](../../backend/src/modules/users/infrastructure/persistence/prisma/prisma-registration-request.repository.ts:347)
usa la API nativa de SQL parametrizado ya utilizada por el repositorio. Una CTE
comparte los criterios; otra selecciona únicamente la página ordenada por fecha
descendente e identificador descendente, con límite y desplazamiento en SQL.
El conteo agregado y el JSON estructurado de esa página se devuelven mediante
una sola sentencia, incluso cuando la página está vacía. No son dos lecturas
independientes ni se presupone un aislamiento configurable que el runtime no ofrece.

No se proyectan hashes ni filas completas fuera de la página. El conteo puede
recorrer todas las coincidencias en PostgreSQL; no se promete coste constante,
un plan concreto ni un benchmark real. La aplicación recibe solamente el total
y los elementos de la página. Se restaura el tipo temporal nativo de la fecha
tras decodificar JSON y se conserva el DTO. Los filtros opcionales nulos usan
parámetros con codec explícito: el constructor nativo rechaza nulos sin codec.

Las evidencias y la existencia de la versión de términos siguen consultándose
solo para los elementos de la página, con el runtime transaccional existente.
No se extiende la garantía de snapshot de total/página a esas consultas, ni a
peticiones de páginas diferentes. No cambia aprobación, rechazo, validación de
credenciales, transporte, firma de PDF ni tratamiento de riesgos previos.
Es una corrección de materialización/paginación, no una fuga de seguridad.

Las [pruebas H4](../../backend/test/registration-pagination.offline.spec.ts:1)
combinan el constructor nativo sin runtime/conexión con un doble semántico:
10 000 coincidencias, filtros combinados, solo 20 elementos/enriquecimientos,
fechas y DTO, parámetros separados del SQL, límite/desplazamiento en la CTE,
orden de agregación, vacío con total, cero coincidencias y errores sin fallback.
La [regresión existente](../../backend/test/registration-review.offline.spec.ts:29)
conserva 45 empates, una fecha posterior y recorrido exacto de tres páginas.
El doble no ejecuta ni certifica PostgreSQL, concurrencia o aislamiento real.

#### Verificación ejecutada de H4 (26/11/2026 UTC)

Desde el directorio del backend, con dependencias existentes:

- [`npm test -- --config vitest.config.registration-offline.ts`](../../backend/vitest.config.registration-offline.ts:1):
  línea base **6 suites, 85/85**; pasada final **7 suites, 98/98**, incluidos
  **13 casos H4**. Se conservan los 85 casos anteriores, adaptando únicamente
  las aserciones de construcción del listado al nuevo plan parametrizado.
- [`npm run typecheck`](../../backend/package.json:29): salida 0.
- [`node node_modules/typescript/lib/tsc.js --project tsconfig.build.json --noEmit`](../../backend/tsconfig.build.json:1):
  salida 0, sin emitir artefactos.
- Control focal de espacios mediante diff: salida 0. Git solo se utilizó para
  consulta de estado, archivos y diferencias; no se modificó índice ni historial.

La primera pasada ampliada detectó cuatro fallos por parámetros nulos sin
codec explícito en el constructor nativo; se corrigió la implementación, sin
retirar casos ni debilitar aserciones. No se ejecutaron pruebas con base de datos,
servicios externos, instalaciones, semillas ni migraciones. No se leyó entorno
ni secretos ni archivos personales ajenos al repositorio. No se modificó el
documento de integración final ni se atribuyen como propios sus resultados.

## Comandos y resultados reales

Desde la raíz del repositorio, con dependencias ya instaladas:

```text
npm --prefix backend test -- --config vitest.config.registration-offline.ts
node --test frontend/tests/registration-review.test.mjs frontend/tests/auth-contracts.test.mjs
node --test frontend/tests/*.test.mjs
npm --prefix backend run typecheck
npm --prefix frontend run typecheck
node backend/node_modules/typescript/lib/tsc.js --project backend/tsconfig.build.json --noEmit
```

- [Alcance backend offline explícito](../../backend/vitest.config.registration-offline.ts):
  **6 suites, 85/85 aprobadas** (42 transporte, 15 revisión, 8 contratos HTTP,
  8 persistencia, 8 autenticación, 4 casos de uso). No se ejecutó la suite backend
  predeterminada, ni se instanció AppModule ni un cliente real de base de datos.
- Frontend focal final: **23/23 aprobadas**, sin canceladas/omitidas; incluye las
  15 pruebas nuevas de revisión. Una corrida focal ampliada previa de 37 casos
  tuvo 36 aprobadas y el fallo histórico de imagen indicado abajo.
- Frontend completo final: **477 pruebas, 467 aprobadas, 10 fallidas**, ninguna
  cancelada/omitida. Salida 1; **la suite global no está verde**. No se reutilizan
  los conteos de la entrega anterior como resultados propios.
- Tipos backend/frontend: salida 0. Compilación con configuración de build
  backend sin emitir artefactos: salida 0.

Desde frontend se ejecutó el build en memoria:

```text
node --input-type=module -e "import { build } from 'vite'; await build({ envFile: false, build: { write: false } });"
```

Resultado: salida 0, **2145 módulos transformados**, sin cargar archivos de
entorno ni escribir el bundle. Comprobación focal de espacios mediante diff:
salida 0. No se ejecutaron instalaciones, semillas, migraciones ni generadores.

### Diez fallos globales conservados

Coinciden por nombre con el [baseline documentado](loan-integration-verification.md:233):

1. [Imagen: cancelar/cambiar selección](../../frontend/tests/auth-user.test.mjs:207): aserción antigua del mensaje de imagen, mientras el mensaje vigente también menciona PDF.
2. [Inicio con estados independientes](../../frontend/tests/final-corrections.test.mjs:157).
3. [REFLOW/contexto y destinos](../../frontend/tests/final-corrections.test.mjs:183).
4. [I6: ida/retorno con filtros](../../frontend/tests/phase3-corrections.test.mjs:165).
5. [I2: apelación incierta montada](../../frontend/tests/phase3-corrections.test.mjs:244).
6. [I2: apelación confirmada montada](../../frontend/tests/phase3-corrections.test.mjs:265).
7. [I6: enlaces montados y router](../../frontend/tests/phase3-corrections.test.mjs:322).
8. [I7/I8: inicio desktop/móvil](../../frontend/tests/phase3-corrections.test.mjs:345).
9. [I7: inventario desktop/móvil](../../frontend/tests/phase3-corrections.test.mjs:369).
10. [Política de tres roles y destinos](../../frontend/tests/real-integration.test.mjs:43).

## Límites y preservación

Sin esquema nuevo ni migración creada/aplicada. Sin modificación de datos
históricos, recursos de producción, proveedor de capacidades, préstamos,
contrato compartido de errores, entorno, secretos, servicios, índice o ramas.
No hubo commit, push, merge, reset ni checkout. No se regeneró OpenAPI ni sus
copias; sus metadatos fuente cambiaron y el integrador deberá regenerarlos después.

Las pruebas son HTTP/estado Vue y persistencia simulada en memoria: no acreditan
almacenamiento Supabase, permisos reales del bucket, aislamiento PostgreSQL,
renderizado/CSS ni comportamiento de bloqueadores de pestañas en un navegador
real. El enlace explícito proporciona el gesto nativo y un aviso de fallback;
no se intenta abrir una pestaña asíncrona ni una ventana vacía.
