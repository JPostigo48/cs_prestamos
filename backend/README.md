# Backend

API del sistema de gestión de préstamos universitarios, desarrollada con NestJS, TypeScript y Prisma 8.

El contexto funcional y las decisiones de dominio se documentan en el [`README.md` principal](../README.md) y en [`docs/`](../docs/).

## Estructura

```text
src/
├── modules/
│   ├── auth/
│   ├── inventory/
│   ├── loans/
│   ├── rules/
│   └── users/
├── shared/
│   └── infrastructure/prisma/
├── app.module.ts
└── main.ts
```

Cada módulo incorpora únicamente las capas que necesita:

- `domain`: entidades, reglas e interfaces de repositorios, sin dependencias de NestJS, Prisma o HTTP.
- `application`: casos de uso y puertos de entrada o salida.
- `infrastructure`: implementaciones concretas y adaptadores.
- `presentation`: controllers y DTOs HTTP.

`PrismaService` y `PrismaModule` son infraestructura compartida y no se duplican en los módulos.

## Prisma

El proyecto utiliza Prisma 8 contract-first. La fuente del modelo es [`prisma/contract.prisma`](prisma/contract.prisma), no `schema.prisma`.

```bash
npm run prisma:generate
npm run prisma:seed
```

`prisma/seed.ts` orquesta los seeds ubicados en `prisma/seeds/`. El contrato, las migraciones y los seeds permanecen fuera de `src/`.

## Instalación

```bash
npm install
```

## Ejecución

```bash
npm run start
npm run start:dev
npm run start:debug
npm run start:prod
```

## Validación

```bash
npm run prisma:generate
npm run build
npm run lint
npm test
npm run test:e2e
npm run test:cov
```

Las variables locales se configuran en archivos `.env`, que no deben versionarse.

## Autenticación

Auth acepta únicamente correos normalizados (sin espacios y en minúsculas) cuyo
dominio exacto sea `@unsa.edu.pe`. Las contraseñas se almacenan con Argon2id.
El registro público crea una solicitud integral pendiente; su aprobación crea
atómicamente el usuario con vinculación vigente, cuenta habilitada `USUARIO`
y aceptación de términos, conservando el correo y hash originales. Los roles
`OPERADOR` y `ADMINISTRADOR` deben asignarse mediante una operación administrativa
o un seed controlado.

Configura en `.env`:

```text
DATABASE_URL=postgresql://...
JWT_SECRET=un-secreto-largo-y-aleatorio
JWT_EXPIRES_IN=3600s
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-clave-privada
# Opcional: por defecto utiliza el bucket loan-evidence
REGISTRATION_EVIDENCE_BUCKET=loan-evidence
PORT=3000
```

Las evidencias de préstamos usan el bucket privado `loan-evidence` de Supabase
Storage. El backend guarda en Neon los metadatos y la ruta del objeto, y genera
URLs firmadas de corta duración al consultarlas. Se aceptan imágenes JPEG, PNG
y WebP de hasta 5 MB por archivo. La clave `SUPABASE_SERVICE_ROLE_KEY` solo
debe existir en el backend y nunca en el frontend.

Para aplicar el cambio de esquema en Neon, revisa y ejecuta la migración
[`20261101T2231_add_phone_and_loan_evidence`](prisma/migrations/app/20261101T2231_add_phone_and_loan_evidence/migration.ts)
con el procedimiento autorizado del proyecto. La migración agrega el teléfono
opcional del usuario y la tabla `evidencias_prestamo`.

El JWT contiene `accountId`, `userId`, `userType` y `role`. Las rutas protegidas
deben usar `AuthGuard`; para autorización por rol se combinan `@Roles(...)` y
`RolesGuard`.

Endpoints disponibles:

- `POST /auth/registration-requests`: única entrada pública de registro completo
  para estudiantes, profesores (`DOCENTE`) y administrativos. Requiere contraseña
  elegida por el solicitante, versión de términos aceptada e imagen PNG/JPEG de
  hasta 60 KiB o PDF de hasta 10 MiB (carné o constancia de matrícula vigente
  para estudiantes). Los PDFs se almacenan en el bucket privado configurado por
  `REGISTRATION_EVIDENCE_BUCKET`; Neon conserva la ruta, nombre, MIME, tamaño y
  hash en `evidencias_vinculacion`.
  El servidor decodifica la imagen completa de forma estricta con Sharp: máximo
  4 millones de píxeles, 4096 por lado, una página y 2 segundos de procesamiento.
  Se reutiliza el decodificador ya presente en el árbol de dependencias, ahora
  declarado para producción con su lock; no basta comprobar la firma binaria.
  La aprobación vuelve a validar la evidencia persistida antes de cualquier alta.
  La autenticidad y vigencia documental requieren revisión humana, no automática.
  Solo se persiste el hash Argon2id, sin mostrarlo en respuestas ni auditorías.
  Todos los campos del alta nueva son requeridos, incluidos identificador y
  teléfono; no se rellenan filas antiguas ni se cambia su nulabilidad. Nombre,
  identificador y teléfono se recortan exteriormente; correo se recorta y pasa
  a minúsculas antes de validar el dominio exacto. La contraseña de 8–128 no
  admite solo blancos y nunca se recorta. El parser JSON permite 15 MiB solo
  en la ruta de registro; otras rutas mantienen 100 KiB, con exceso 413 JSON.
  Revisión PDF: firma nueva por preparación, endpoint protegido sin caché y
  enlace nativo explícito seguro, con errores visibles junto a la evidencia.
  [Contrato, matriz 11–18 y límites verificados](../docs/development/registration-review-verification.md:9).
  [Integración documental y OpenAPI vigente](../docs/development/final-contract-integration.md:1).
- `POST /users/registration-requests`: retirado; responde 410 y remite a la entrada
  integral. Las consultas, aprobación y rechazo siguen disponibles.
- `POST /users/registration-requests/:requestId/approve`: OPERADOR o
  ADMINISTRADOR; toda aprobación crea acceso y no recibe contraseña administrativa.
  Un legado sin correo, credenciales, aceptación o evidencia válidos responde 409
  sin escrituras; debe rechazarse con motivo y reenviarse completo. Listado y
  detalle exponen solo motivos seguros de bloqueo en `approvalBlockers`.
- `POST /auth/accounts`: alta administrativa de cuenta `USUARIO`, solo para
  ADMINISTRADOR; se conserva para usos ajenos a la aprobación de solicitudes.
- `POST /auth/authenticate`: autenticación y emisión del JWT.
- `GET /auth/accounts/:accountId`: consulta propia o administrativa.
- `PATCH /auth/accounts/:accountId`: cambio administrativo de rol o habilitación;
  requiere `ADMINISTRADOR`.
- `POST /loans/:loanId/evidence`: carga una o varias imágenes mediante
  `multipart/form-data`, usando los campos `type`, `description` y `files`.
- `GET /loans/:loanId/evidence`: consulta las evidencias con URLs firmadas;
  requiere autorización sobre el préstamo.

La actualización administrativa registra el cambio en `AuditoriaUsuario`.
La protección de Users, Rules, Inventory y Loans debe aplicarse según la matriz
de permisos de cada módulo; no se introduce una dependencia inversa hacia Auth.

### Datos de desarrollo

El seed es no destructivo: conserva los datos existentes y solo agrega usuarios
o cuentas seed cuando no existen. No elimina préstamos, devoluciones, usuarios,
recursos, ejemplares ni categorías. Las cuentas de desarrollo son:

| Rol | Correo | Contraseña |
|---|---|---|
| USUARIO | `seed.usuario@unsa.edu.pe` | `SeedUsuario-2026!` |
| OPERADOR | `seed.operador@unsa.edu.pe` | `SeedOperador-2026!` |
| ADMINISTRADOR | `seed.admin@unsa.edu.pe` | `SeedAdministrador-2026!` |

Estas credenciales son exclusivamente para desarrollo local o entornos de
prueba. Deben reemplazarse antes de usar un entorno compartido o productivo.

## Préstamos y devoluciones

`POST /loans` requiere un JWT válido y recibe únicamente `copyId` y `startsAt`.
El usuario se obtiene de `@CurrentUser()` y no puede ser enviado por el cliente.
El caso de uso verifica elegibilidad, disponibilidad, fecha de inicio, duración
máxima de la categoría y solapamientos.

`POST /loans/:loanId/return` requiere rol `OPERADOR` o `ADMINISTRADOR`. Al
registrar la devolución se finaliza el préstamo, se libera el ejemplar y, si se
envía una observación, se marca como `NO_DISPONIBLE` y se crea una observación
de inventario.

Las consultas de préstamos activos y vencidos requieren `OPERADOR` o
`ADMINISTRADOR`. El historial y el detalle solo pueden consultarse para el
propio usuario, salvo esos roles operativos.
