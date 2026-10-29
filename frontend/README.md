# Frontend

Aplicación Vue 3, TypeScript, Vue Router y Tailwind CSS con Vite. Requiere Node.js 20.19+ o 22.12+.

## Desarrollo

Desde la raíz:

```powershell
npm --prefix backend install
npm --prefix frontend install
npm run project:generate
npm run front
```

`npm run front` inicia Vite. `npm --prefix frontend run typecheck` comprueba TypeScript sin generar una versión de producción.

## Áreas

- `/login` autentica; `/register` conserva la solicitud básica y ofrece el alta integral como acción separada. `/login/google` usa autorización e intercambio OIDC reales del backend; requiere configuración Google y una cuenta aprobada. Véanse los [requisitos de activación](../docs/development/auth-integral.md).
- `/app` ofrece el panel personal, catálogo, detalle, reservas y términos; `/app/loans` integra operaciones y entregas para operador y administrador. Las rutas administrativas añaden apelaciones, usuarios e inventario.
- `/prototype` conserva la demostración con datos locales y su formulario visual original, sin solicitudes al backend. El acceso real usa un formulario aislado.
- `/project` y sus subrutas viven en `src/modules/project-showcase/`. Presentan planificación, diagramas, API, datos, equipo y flujo Git sin formar parte del dominio de préstamos.

El router compartido está en `src/router.ts`. `/app` requiere una sesión vigente, almacenada solo durante la sesión de la pestaña.

En desarrollo, Vite redirige `/api/*` a `http://localhost:3000/*`; el backend debe estar iniciado. En despliegues sin ese proxy se necesita uno equivalente o configurar la base pública de la API junto con CORS en el backend. La [guía de integración frontend](../docs/architecture/frontend-integration.md) conserva la evolución de la integración; el [cierre de contratos](../docs/development/phase3-closure.md) describe su estado vigente y requisitos externos. No hay renovación ni datos simulados de negocio en la aplicación real.

## Verificación offline

Desde la raíz del repositorio, el runner integrado de Node ejecuta las [pruebas frontend](tests/) con red interceptada exclusivamente en tests. No requiere servicios, base de datos ni generación de documentación:

```powershell
node --test frontend/tests/*.test.mjs
npm --prefix frontend run typecheck
npm --prefix frontend run build
```

El estado de cada comprobación y los diagnósticos de referencia que bloquean el build oficial se registran en la [guía de integración](../docs/architecture/frontend-integration.md#verificaciones-ejecutadas-y-límites). No se excluye la referencia del chequeo ni se relajan sus opciones para obtener un resultado verde.

Para probar el acceso con datos locales, ejecuta primero el seed del backend y usa la cuenta de prueba definida en `backend/prisma/seeds/auth.seed.ts` (usuario: `seed.usuario@unsa.edu.pe`, contraseña: `SeedUsuario-2026!`). Estas credenciales son exclusivamente de desarrollo.

## Datos y diagramas

`npm run project:generate` transforma los Markdown versionados de `docs/planning/` y las tecnologías del README principal en JSON bajo `frontend/public/generated/project/`. No modifica los documentos fuente. Para regenerar también los SVG de PlantUML, define `PLANTUML_JAR` con la ruta a un JAR local antes de ejecutar el comando:

```powershell
$env:PLANTUML_JAR = 'C:\herramientas\plantuml.jar'
npm run project:generate
```

Los SVG de UML se derivan de `docs/architecture/uml/*.puml`. Para exportar también las vistas de Structurizr, define `STRUCTURIZR_JAR` además de `PLANTUML_JAR`:

```powershell
$env:STRUCTURIZR_JAR = (Resolve-Path 'docs/architecture/structurizr/structurizr.war').Path
npm run project:generate
```

El generador transforma `workspace.dsl` a PlantUML en un directorio temporal y luego a SVG. Por ello las imágenes de Structurizr pueden diferir visualmente de Structurizr Local; el DSL sigue siendo la fuente estratégica. El frontend solo consume los SVG exportados, sin conectarse a PlantUML ni a Structurizr en ejecución.

`npm run project:generate` genera `backend/openapi.json` desde los controladores y DTO de NestJS y lo copia a `frontend/public/generated/project/openapi.json`. No inicia el servidor ni necesita conectarse a PostgreSQL. La sección `/project/api` permite consultar rutas, parámetros, cuerpos de solicitud, ejemplos JSON y el estado de cada operación; no mantiene una lista paralela de endpoints ni usa Swagger UI como interfaz final. Los ejemplos proceden de los DTO y son orientativos: hay que sustituir identificadores y otros datos antes de enviar una solicitud. Si cambia un contrato, hay que actualizar sus metadatos OpenAPI y regenerar el archivo para reflejarlo en el frontend.

`npm run project:check` comprueba, sin modificar archivos, que ambos JSON coincidan con los controladores y DTO actuales y que las operaciones marcadas como implementadas tengan esquema de respuesta. La misma comprobación se ejecuta en los pull requests.

El estado **Implementado en código** identifica operaciones con lógica desarrollada, pero no garantiza que se haya probado su integración con la base de datos. Toda operación sin esa confirmación explícita aparece como **Pendiente**, aunque su ruta ya esté declarada. La vista Equipo permite seleccionar un sprint: toma integrantes de `docs/planning/README.md` y responsabilidades, avances, pendientes y enlaces de evidencia de cada documento en `docs/planning/sprints/`. Los sprints planificados no se presentan como avances realizados.
