# Lectura pública de términos — fase 1

La autoridad de negocio es [requirements](../requirements/terms-and-conditions.md), complementada por [reglas de negocio](../requirements/business-rules.md) y [confianza](../requirements/trust-model.md). Este documento describe exclusivamente almacenamiento y lectura.

- [`GET /terms/current`](../../backend/src/modules/rules/presentation/controllers/public-terms.controller.ts): público, mayor número de términos publicado en la base real, igual que elegibilidad. El contrato actual no tiene publicación programada ni estados de vigencia; no se inventan. Desempate estable por identificador.
- [`GET /terms/versions/:versionId`](../../backend/src/modules/rules/presentation/controllers/public-terms.controller.ts): público, UUID de una versión exacta. Ambas rutas responden 404 ante ausencia; la histórica responde 400 ante UUID inválido.
- Conservan los campos `id`, `number`, `title`, `content` compatibles con F02. Añaden `publishedAt` desde `createdAt`, `policiesStatus` y `policies`: identidad y número de versión de regla, categoría, gravedad, criterios tipados, efecto de confianza, puntos, suspensión y consecuencia persistidos. No devuelven usuarios, aceptaciones, auditorías ni descripciones JSON sin filtrar.
- `penaltyPoints: null` indica descuento no aplicable para configuración o efecto a cero; cero numérico sí es cero. La suspensión se interpreta por su tipo; un plazo ausente no se convierte en cero. La fecha ausente permanece desconocida.

## Asociación inmutable sin migración

El esquema Prisma 8 existente no tiene una relación términos–versiones de regla. Para la versión inicial del [seed reutilizado](rules-seed.md), la compatibilidad está cerrada por número y título exactos a sus UUID iniciales; se verifica el formato y la revisión de cada fila. Los valores de política se leen de esas filas, nunca del catálogo en memoria. Ni los punteros vigentes ni el estado activo anexan versiones futuras o excluyen las versiones históricas desactivadas.

Para una publicación posterior, el contenido persistido puede incluir un comentario de manifiesto `<!-- epcc.policy-versions/v1: ["UUID-de-version-real", "otro-UUID-real"] -->`. Debe enumerar las versiones exactas, con UUID válidos y sin duplicados, antes de publicar; no se cambia un término ya aceptado. El texto completo sigue disponible para aceptación; Showcase oculta solo ese comentario técnico al presentar las secciones. La ruta de creación y la aceptación existentes no se modifican en esta fase.

`COMPLETE` significa que todas las referencias del manifiesto pudieron proyectarse; no certifica aprobación institucional ni la ejecución de un motor. Sin vínculo válido se devuelve `UNAVAILABLE`; con referencias ausentes o metadatos inválidos, `INCOMPLETE`, sin relleno local. Publicar futuras matrices sin manifiesto requiere completar ese vínculo mediante una nueva versión, nunca inferirlo desde políticas actuales.

## Showcase y validación

La [página T&C](../../frontend/src/modules/project-showcase/pages/ProjectTermsPage.vue) usa el cliente API compartido, cancelación de solicitudes, errores, ausencia y reintento. Los acordeones nativos admiten teclado; muestran familias estructuradas y todas las secciones del contenido documental, incluidas acumulación, apelación y aceptación. No contiene valores de políticas ni un motor de sanciones. No modifica Prototype ni interfaces de usuarios reales.

Generar contratos mediante [`npm run project:generate`](../../package.json); el generador OpenAPI bloquea la carga de secretos y no inicializa proveedores ni conexiones. Las pruebas focales de [lectura/semilla](../../backend/src/modules/rules/public-terms.spec.ts) y [Showcase](../../frontend/tests/project-terms.test.mjs) solo usan memoria/red simulada.

**Neon pendiente:** esta fase no escribe ni ejecuta el seed. No se encontró una conexión ya provista al proceso; se requiere proporcionarla de forma opaca para ejecutar la comprobación de lectura y conocer faltantes/conflictos exactos. No se han cargado secretos. Después del resumen, el responsable debe autorizar una sola aplicación focalizada según [rules-seed](rules-seed.md#ejecución-autorizada-pendiente); nunca usar el seed general de demos.
