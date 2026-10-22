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

- `/login` autentica con `POST /auth/authenticate`; `/register` envía solicitudes de registro y `/app` muestra el panel del usuario con datos de la API.
- `/prototype` conserva la demostración con datos locales. Comparte el formulario visual de acceso con `/login`, pero no realiza solicitudes al backend.
- `/project` y sus subrutas viven en `src/modules/project-showcase/`. Presentan planificación, diagramas, API, datos, equipo y flujo Git sin formar parte del dominio de préstamos.

El router compartido está en `src/router.ts`. `/app` requiere una sesión vigente, almacenada solo durante la sesión de la pestaña.

En desarrollo, Vite redirige `/api/*` a `http://localhost:3000/*`; el backend debe estar iniciado. En despliegues sin ese proxy se necesita uno equivalente o configurar `VITE_API_BASE_URL` junto con CORS en el backend. Google y los paneles de operador y administrador aún no están integrados. El panel de usuario consulta perfil, habilitación, confianza, sanciones, préstamos e inventario. Las reservas y renovaciones todavía no se ofrecen desde esta interfaz.

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
