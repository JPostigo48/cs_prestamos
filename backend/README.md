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
