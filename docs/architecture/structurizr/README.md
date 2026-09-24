# Diseño DDD en Structurizr

[`workspace.dsl`](workspace.dsl) contiene las vistas estratégicas e internas del dominio para el sistema de gestión de préstamos universitarios. Las vistas se basan en el [README del proyecto](../../../README.md), el [análisis de requisitos](../../requirements/README.md) y el [modelo UML conceptual](../uml/README.md). No representan funcionalidades implementadas, servicios desplegados, tablas, clases ni contratos de API.

## Vistas disponibles

| Vista | Propósito |
| --- | --- |
| `MapaContextosDDD` | Mapa estratégico principal de bounded contexts y dependencias de alto nivel. |
| `InteraccionContextosDDD` | Colaboración conceptual entre contextos, sin mostrar agregados internos. |
| `InternaPrestamos` | Agregado `Préstamo`, intervalo, estado, devolución y referencias externas por ID. |
| `InternaInventario` | Categorías, recursos, ejemplares, estado, observaciones y disponibilidad derivada. |
| `InternaUsuarios` | Solicitudes de registro, evidencias e identidad institucional del usuario. |
| `InternaReglasTerminos` | Reglas versionadas, incumplimientos, términos y aceptaciones históricas. |
| `InternaAutenticacion` | Cuenta de acceso, roles y diferencia entre rol de acceso y tipo institucional. |
| `InternaConfianza` | Perfil de confianza, restricciones, sanciones, apelaciones y referencias externas por identificador. |

## Criterio de separación

El mapa general se mantiene como vista estratégica principal. La vista de interacción explica colaboración entre contextos sin abrir sus estructuras internas. Las vistas internas se dividen por contexto para evitar un diagrama único demasiado grande y para mantener relaciones cortas y legibles.

Structurizr se usa aquí para explicar límites de dominio, responsabilidades, agregados e invariantes. El detalle de atributos, multiplicidades finas y clases conceptuales completas permanece en PlantUML.

## Contextos representados

- **Préstamos (loans) — central:** registra préstamos y devoluciones; coordina las condiciones para ocupar un ejemplar.
- **Inventario (inventory) — soporte:** gestiona recursos, ejemplares físicos y disponibilidad.
- **Usuarios (users) — soporte:** gestiona solicitudes, vinculación institucional e identidad del usuario.
- **Confianza (trust) — soporte:** mantiene porcentaje, nivel, restricciones, sanciones y apelaciones; referencia a Usuarios, Reglas y Autenticación mediante identificadores.
- **Reglas y Términos — área de dominio con límite por validar:** administra reglas vigentes, versiones, incumplimientos y términos aceptados.
- **Autenticación (auth) — genérico de apoyo:** proporciona identidad autenticada, rol y control de acceso.

Esta clasificación orienta responsabilidades del dominio. No define microservicios, bases de datos separadas ni mecanismos de integración.

## Lectura de las vistas internas

- Los elementos `Aggregate` representan límites de consistencia.
- Los elementos `Aggregate Root` representan el punto de acceso del agregado.
- Las referencias como `usuarioId`, `ejemplarId` o `versionReglaId` indican cruces por identificador, no carga directa de objetos de otros contextos.
- Las invariantes se muestran como reglas breves dentro de la vista donde aportan más contexto.

## Ejecución local

Requisito: Java disponible. Desde la raíz del repositorio, en PowerShell:

```powershell
java -jar .\docs\architecture\structurizr\structurizr.war validate -workspace .\docs\architecture\structurizr\workspace.dsl
java -jar .\docs\architecture\structurizr\structurizr.war local .\docs\architecture\structurizr
```

Abrir <http://localhost:8080> y seleccionar la vista requerida. Para detener el proceso, usar `Ctrl+C`.

`workspace.dsl` es la fuente versionada. Los archivos generados por Structurizr Local, como `workspace.json`, no sustituyen al DSL.
