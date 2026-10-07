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
El registro público crea exclusivamente cuentas `USUARIO`; los roles
`OPERADOR` y `ADMINISTRADOR` deben asignarse mediante una operación administrativa
o un seed controlado.

Configura en `.env`:

```text
DATABASE_URL=postgresql://...
JWT_SECRET=un-secreto-largo-y-aleatorio
JWT_EXPIRES_IN=3600s
PORT=3000
```

El JWT contiene `accountId`, `userId`, `userType` y `role`. Las rutas protegidas
deben usar `AuthGuard`; para autorización por rol se combinan `@Roles(...)` y
`RolesGuard`.

Endpoints disponibles:

- `POST /auth/accounts`: autorregistro de una cuenta `USUARIO`.
- `POST /auth/authenticate`: autenticación y emisión del JWT.
- `GET /auth/accounts/:accountId`: consulta propia o administrativa.
- `PATCH /auth/accounts/:accountId`: cambio administrativo de rol o habilitación;
  requiere `ADMINISTRADOR`.

La actualización administrativa registra el cambio en `AuditoriaUsuario`.
La protección de Users, Rules, Inventory y Loans debe aplicarse según la matriz
de permisos de cada módulo; no se introduce una dependencia inversa hacia Auth.

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
