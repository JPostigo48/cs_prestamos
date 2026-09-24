# Sistema de gestión de préstamos universitarios

Sistema para registrar y controlar préstamos de libros, equipos y otros recursos académicos de una institución universitaria. Centraliza usuarios, recursos, ejemplares físicos y préstamos para consultar disponibilidad y conocer qué unidad tiene asignada cada usuario.

## Estado actual

El repositorio ya cuenta con una base técnica ejecutable del backend:

- API NestJS con TypeScript y organización modular basada en DDD/Clean Architecture;
- módulos `auth`, `users`, `inventory`, `loans` y `rules` conectados mediante NestJS;
- módulo `inventory` con comportamiento, persistencia Prisma y pruebas;
- esqueletos tipados de los demás módulos, cuyos casos de uso pendientes conservan `// TODO`;
- contrato Prisma, migraciones y seeds en [`backend/prisma/`](backend/prisma/);
- PostgreSQL reproducible mediante [`docker-compose.yml`](docker-compose.yml);
- build, lint y pruebas configurados en [`backend/package.json`](backend/package.json).

La aplicación frontend todavía no está integrada como proyecto ejecutable en el repositorio. El [análisis de requisitos](docs/requirements/README.md) y la [planificación](docs/planning/README.md) describen el alcance previsto; no debe interpretarse que toda funcionalidad documentada ya está implementada.

## Alcance planificado

- Solicitud, verificación y aprobación de cuentas para usuarios vinculados con la EPCC.
- Registro y consulta de recursos, sus ejemplares físicos y su disponibilidad.
- Registro de préstamos y devoluciones, considerando disponibilidad, habilitación del usuario y restricciones vigentes.
- Consulta de préstamos activos, vencimientos e historial por usuario.
- Autenticación y control de acceso según permisos.
- Gestión del porcentaje y nivel de confianza del usuario.
- Gestión dinámica de reglas, incumplimientos, sanciones, apelaciones y versiones de términos y condiciones.

La planificación contempla estudiantes, docentes y personal administrativo, tiempos de préstamo por categoría y restricciones configurables. Permanecen pendientes, entre otros valores, los umbrales y porcentaje inicial de confianza, las restricciones concretas por nivel y el posible límite de préstamos activos para estudiantes. El detalle vigente se mantiene en [`docs/requirements/`](docs/requirements/README.md).

## Tecnologías

| Área | Tecnología |
| --- | --- |
| Frontend planificado | Vue.js con TypeScript |
| Backend | NestJS con TypeScript |
| Persistencia | PostgreSQL y Prisma |
| Pruebas | Vitest |
| Comunicación | API HTTP |
| Modelado y documentación | DDD, Clean Architecture, UML, Structurizr y PlantUML |

## Organización actual

```text
.
├── backend/
│   ├── prisma/
│   │   ├── contract.prisma
│   │   ├── migrations/
│   │   ├── seed.ts
│   │   └── seeds/
│   └── src/
│       ├── modules/
│       │   ├── auth/
│       │   ├── inventory/
│       │   ├── loans/
│       │   ├── rules/
│       │   └── users/
│       └── shared/infrastructure/prisma/
├── docs/
│   ├── architecture/
│   │   ├── structurizr/
│   │   └── uml/
│   ├── planning/
│   └── requirements/
├── docker-compose.yml
├── sonar-project.properties
├── sonar.sh
└── README.md
```

[`backend/README.md`](backend/README.md) contiene los comandos de instalación, ejecución, generación de Prisma y validación.

## Arquitectura

El backend separa cada módulo en las capas que necesita:

- **Dominio:** entidades, reglas e interfaces de repositorios, sin dependencias de NestJS, Prisma o HTTP.
- **Aplicación:** casos de uso y puertos que dependen de abstracciones.
- **Infraestructura:** repositorios Prisma y adaptadores técnicos.
- **Presentación:** controllers y DTO de la API.

`PrismaService` y `PrismaModule` son infraestructura compartida. El contrato, las migraciones y los seeds permanecen fuera de `src/`, por lo que el trabajo de persistencia puede evolucionar sin alterar la separación de capas.

El [modelo UML](docs/architecture/uml/README.md) y las [vistas Structurizr](docs/architecture/structurizr/README.md) describen el diseño conceptual vigente: **Préstamos** es el contexto central; **Usuarios**, **Inventario** y **Confianza** son de soporte; **Autenticación** es genérico de apoyo; el límite de **Reglas y Términos** sigue por validar. Esta clasificación no implica microservicios.

La estructura de código integrada desde `develop` es anterior a la separación conceptual de `trust`: por ahora conserva contratos provisionales de confianza y sanciones en `users`, y de apelaciones en `rules`. No se considera la arquitectura objetivo ni se debe extender ese reparto accidental; su alineación con el contexto `trust` queda como trabajo pendiente.

## Reglas de dominio principales

- `Recurso` representa una entrada conceptual del catálogo y `Ejemplar` una copia física concreta.
- Un recurso tiene uno o más ejemplares; cada ejemplar pertenece exactamente a un recurso.
- Un recurso está disponible mientras exista al menos un ejemplar disponible.
- Cada préstamo identifica un usuario y un ejemplar concretos mediante sus identificadores.
- Un ejemplar no puede participar en préstamos activos o planificados con intervalos superpuestos.
- Registrar un préstamo y ocupar el ejemplar debe realizarse de forma consistente.
- La devolución finaliza el préstamo y libera el ejemplar solo cuando su estado permite continuar prestándolo.
- Los cambios en reglas no deben alterar retroactivamente penalizaciones, sanciones ni incumplimientos históricos.

## Pendientes conocidos

- Implementar la lógica de negocio marcada con `// TODO` en los módulos que hoy son esqueletos.
- Alinear el código con el bounded context `trust` definido por la documentación vigente.
- Integrar el proyecto frontend Vue.js.
- Definir credenciales, proveedor y flujo definitivo de autenticación.
- Definir los valores pendientes del modelo de confianza y las restricciones por tipo de usuario.
- Cerrar los contratos definitivos de la API y la estrategia transaccional para préstamos concurrentes.
- Revisar el contrato Prisma cuando las decisiones de dominio pendientes se resuelvan, sin reconstruir migraciones por motivos puramente arquitectónicos.
