---
document: git-workflow
version: v0.0.1
status: in_progress
owner: Juan Carlos Postigo Cabana
---

# Flujo de trabajo con Git

GitFlow simplificado adaptado al tamaño del equipo y del proyecto: dos ramas permanentes, ramas temporales por tarea, integración mediante Pull Request y un tag por versión cerrada.

## Ramas permanentes

### `main`

- Contiene únicamente versiones estables.
- No se trabaja directamente sobre ella.
- Recibe `develop` cuando se cierra satisfactoriamente un sprint.
- Cada estado estable relevante se identifica con un tag.

### `develop`

- Rama de integración del trabajo del sprint.
- Recibe las funcionalidades terminadas.
- Las ramas temporales parten de `develop` y regresan a `develop` mediante Pull Request.

> **Estado actual del repositorio:** `develop` ya existe y contiene la base técnica integrada del backend. La rama histórica `feature/mi_database` fue incorporada en `develop`; su referencia remota todavía puede eliminarse una vez que el equipo confirme que ya no la necesita (ver `ARCH-05` en el [backlog](backlog.md)).

## Ramas temporales

| Prefijo | Uso |
| --- | --- |
| `feat/` | Nueva funcionalidad. |
| `fix/` | Corrección de un defecto. |
| `chore/` | Configuración, herramientas, tareas de soporte. |
| `docs/` | Documentación. |
| `refactor/` | Reorganización sin cambio de comportamiento. |
| `test/` | Pruebas. |
| `hotfix/` | Corrección urgente sobre una versión publicada. Opcional, todavía no utilizado. |

El nombre describe la tarea, en inglés, en minúsculas y con guiones: `feat/inventory-ui`, `chore/database-bootstrap`, `docs/project-planning`.

## Reglas de ramas

1. Nadie desarrolla directamente en `main`.
2. Se evita desarrollar directamente en `develop`.
3. Una rama representa una funcionalidad o tarea, **no** un integrante.
4. Toda rama temporal parte de `develop`.
5. Al terminar el trabajo se abre un Pull Request hacia `develop`.
6. Después del merge, la rama temporal puede eliminarse.
7. No se mantienen ramas de funcionalidad indefinidamente.
8. Los cambios se integran progresivamente durante el sprint.
9. No se dejan todos los merges para el último día.
10. Al cerrar un sprint estable: `develop` → `main`.
11. Después del merge a `main` se crea el tag correspondiente a la versión terminada.
12. Antes de comenzar una tarea nueva se actualiza `develop` y la rama se crea desde su estado reciente.
13. Si una rama permanece activa varios días y `develop` cambia de forma relevante, se actualiza antes de abrir el Pull Request.

## Convención de commits

El proyecto usa una convención propia basada en Conventional Commits. **Todos los commits comienzan obligatoriamente por la versión objetivo a la que contribuyen.**

```text
<versión> <tipo>: <descripción>
```

```text
v0.1.0 feat: crea vista inicial del inventario
```

### Tipos permitidos

`feat` · `fix` · `docs` · `refactor` · `test` · `chore` · `style`

### Descripción

- En español.
- En presente.
- Indica claramente qué cambio introduce.
- Evita mensajes genéricos.

**No se aceptan** mensajes como `cambios`, `avance`, `actualización`, `cosas del frontend`, `fix`, `commit final`, `prueba` o `final`.

### Ejemplos válidos

```text
v0.1.0 chore: configura proyecto inicial del backend
v0.1.0 feat: agrega endpoints mock para desarrollo
v0.1.0 docs: documenta contratos iniciales de la API
v0.1.0 style: adapta layout principal a dispositivos móviles
v0.1.0 fix: corrige navegación del frontend
v0.1.0 refactor: reorganiza módulo de inventario
v0.1.0 test: agrega pruebas de disponibilidad
```

## Versión objetivo por sprint

| Sprint | Versión objetivo | Prefijo obligatorio en commits |
| --- | --- | --- |
| 0 — Planificación y arquitectura | `v0.0.1` | `v0.0.1` |
| 1 — Base técnica | `v0.1.0` | `v0.1.0` |
| 2 — Primer flujo funcional | `v0.2.0` | `v0.2.0` |
| 3 — Reglas de dominio y consolidación | `v0.3.0` | `v0.3.0` |

## Relación entre sprint, commits y tag

La versión escrita al comienzo de cada commit representa la versión del proyecto a la cual contribuye ese cambio. El tag identifica el punto exacto del historial que representa la versión estable publicada. **El prefijo de versión de los commits no reemplaza al tag.**

Ejemplo durante el Sprint 1, con commits en ramas distintas:

```text
v0.1.0 chore: configura proyecto inicial del backend
v0.1.0 feat: agrega rutas iniciales de la API
v0.1.0 feat: implementa layout principal
v0.1.0 feat: crea vista inicial del inventario
v0.1.0 fix: corrige consumo de recursos
```

```text
feat/* · chore/* · fix/* · docs/*
            ↓  Pull Request
         develop
            ↓  cierre del Sprint 1
          main
            ↓
        tag v0.1.0
```

## Versionado y tags

```text
rama temporal
     ↓
  commits con prefijo de versión
     ↓
Pull Request
     ↓
  develop
     ↓
cierre del sprint
     ↓
    main
     ↓
    tag
```

Ejemplo completo del Sprint 2:

```text
feat/loan-flow
     ↓
v0.2.0 feat: implementa creación de préstamos
v0.2.0 feat: implementa consulta de préstamos
v0.2.0 fix: corrige validación del intervalo
     ↓
develop
     ↓
main
     ↓
tag v0.2.0
```

### Correcciones posteriores a una versión cerrada

Una vez publicada una versión, no se siguen agregando cambios con ese mismo número si corresponden a una corrección posterior de la versión estable. En ese caso se incrementa el PATCH:

```text
v0.1.1 fix: corrige validación de disponibilidad
```

La corrección estable puede producir su propio tag: `v0.1.1`.

- **MINOR** (`v0.1.0`, `v0.2.0`, `v0.3.0`): avance funcional previsto de cada sprint.
- **PATCH** (`v0.1.1`, …): correcciones posteriores a una versión ya cerrada.
- **MAJOR** (`v1.0.0`): primera versión considerada completa y estable. Todavía no planificada.

## Pull Requests

Los Pull Requests ordinarios van de la rama temporal hacia `develop`. Al cerrar el sprint se abre el Pull Request de `develop` hacia `main`.

Cada Pull Request indica al menos:

- versión objetivo;
- sprint;
- objetivo del cambio;
- cambios principales;
- módulos afectados;
- cómo probar;
- dependencias;
- pendientes conocidos.

Ejemplo de cabecera:

```text
Versión objetivo: v0.1.0
Sprint: 1
Rama: feat/inventory-ui
Destino: develop
```

Los Pull Requests se mantienen pequeños y enfocados. Un Pull Request que toca varios módulos a la vez suele indicar que la rama debió dividirse.

## Control de conflictos

1. Una rama representa una funcionalidad o tarea, no un integrante.
2. Mauricio y Luis **no** dividen el trabajo como «escritorio» y «responsive».
3. Cada responsable frontend implementa el responsive sobre su propia área.
4. Mauricio mantiene principalmente: layout, `shared/`, diseño global, navegación y sistema visual.
5. Luis trabaja principalmente sobre módulos funcionales dentro de `frontend/src/modules/`.
6. Juan Carlos mantiene: planificación, documentación de sprints, endpoints, contratos de API, coordinación del backend y, posteriormente, el frontend de planificación.
7. Ronald mantiene principalmente: PostgreSQL, migraciones, persistencia e integridad de datos.
8. Los cambios sobre elementos globales se coordinan previamente.
9. Se evita que dos integrantes modifiquen simultáneamente el router global, la configuración global, `shared/`, el esquema central de base de datos o los contratos de API comunes.
10. Los Pull Requests se mantienen pequeños.
11. La integración es progresiva durante el sprint.
12. No se dejan todos los merges para el último día.

### Reparto de archivos por responsable

| Área | Responsable principal | Quién debe coordinar antes de tocarla |
| --- | --- | --- |
| `docs/planning/` | Juan Carlos | Cualquiera que necesite registrar un cambio de planificación. |
| `docs/architecture/` | Juan Carlos | Ronald, cuando el esquema obligue a revisar el modelo. |
| `backend/src/` (estructura, rutas, contratos) | Juan Carlos | Ronald, al integrar repositorios reales. |
| Esquema, migraciones y datos iniciales | Ronald | Juan Carlos, cuando un caso de uso requiera un cambio de esquema. |
| `frontend/src/app/`, `router/`, `layouts/`, `shared/` | Mauricio | Luis, antes de añadir o modificar un componente compartido o una ruta. |
| `frontend/src/modules/*` | Luis | Mauricio, si el módulo necesita un componente nuevo en `shared/`. |

Si Luis necesita un componente compartido, lo acuerda antes con Mauricio en lugar de crearlo dentro de su módulo o modificar `shared/` por su cuenta.

## Definition of Done

Una tarea se considera terminada cuando:

- cumple el alcance acordado;
- compila cuando corresponde;
- pasa lint si existe;
- pasa las pruebas pertinentes si existen;
- respeta la arquitectura y las convenciones del proyecto;
- no introduce errores conocidos;
- utiliza commits con el prefijo de versión correcto;
- tiene la documentación afectada actualizada;
- tiene un Pull Request creado;
- ese Pull Request ha sido revisado;
- el merge en `develop` está realizado.

### Tarea puramente documental

- contenido terminado;
- coherente con los documentos vigentes;
- Markdown válido;
- versión correcta en los commits;
- Pull Request revisado;
- merge en `develop`.
