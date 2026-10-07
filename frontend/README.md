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

- `/login` conserva el avance de acceso como **prototipo visual** en `src/modules/auth/`. No autentica usuarios ni registra cuentas contra la API.
- `/project` y sus subrutas viven en `src/modules/project-showcase/`. Presentan planificación, diagramas, API, datos, equipo y flujo Git sin formar parte del dominio de préstamos.

El router compartido está en `src/router.ts`; los cambios que afecten a la navegación funcional deben coordinarse con su responsable.

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

`npm run project:generate` genera `backend/openapi.json` desde los controladores y DTO de NestJS y lo copia a `frontend/public/generated/project/openapi.json`. No inicia el servidor ni necesita conectarse a PostgreSQL. La sección `/project/api` permite consultar rutas, parámetros, cuerpos de solicitud y el estado de cada operación; no mantiene una lista paralela de endpoints ni usa Swagger UI como interfaz final.

El estado **Implementado en código** identifica operaciones con lógica desarrollada, pero no garantiza que se haya probado su integración con la base de datos. Toda operación sin esa confirmación explícita aparece como **Pendiente**, aunque su ruta ya esté declarada. Los avances semanales se leen de `docs/planning/progress/week-XX.md`; si aún no existen, la vista de equipo muestra ese estado sin inventar registros.
