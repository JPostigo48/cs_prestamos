# Análisis de requisitos

Esta carpeta es la fuente principal del análisis de requisitos actual del sistema de gestión de préstamos universitarios. Su contenido documenta la planificación del dominio y no implica que las funcionalidades descritas estén implementadas.

## Organización

| Documento | Contenido |
| --- | --- |
| [Requisitos funcionales](functional.md) | Capacidades previstas, organizadas por dominio o módulo. |
| [Requisitos no funcionales](non-functional.md) | Atributos de calidad, capacidad y consistencia esperados. |
| [Reglas de negocio](business-rules.md) | Restricciones y condiciones que rigen el dominio. |
| [Modelo de confianza](trust-model.md) | Porcentaje, niveles, sanciones, apelaciones y decisiones pendientes de la confianza del usuario. |
| [Términos y condiciones](terms-and-conditions.md) | Gestión dinámica, versionado y aceptación de las reglas de uso. |

Cada documento mantiene una responsabilidad específica. Cuando un requisito necesita desarrollo conceptual, se referencia el documento correspondiente en lugar de duplicar su contenido.

## Estado de la planificación

Los documentos reflejan las definiciones disponibles en esta etapa. Los valores o comportamientos todavía no acordados se identifican expresamente como pendientes y no deben inferirse durante el diseño o la implementación.

El [modelo de dominio UML](../architecture/uml/README.md) está alineado con esta planificación. Las [vistas DDD en Structurizr](../architecture/structurizr/README.md) representan la división estratégica, la interacción entre contextos y las vistas internas por contexto.

## Trazabilidad y convenciones

- `RF-xx` identifica un requisito funcional.
- `RNF-xx` identifica un requisito no funcional.
- `RN-xx` identifica una regla de negocio.
- Los identificadores se consideran referencias estables para documentación, diseño, pruebas y seguimiento; cualquier cambio debe evitar renumeraciones innecesarias.
- El modelo de confianza y los términos y condiciones son documentos conceptuales: complementan los requisitos, pero no crean requisitos adicionales por sí mismos.

La separación por archivos y el uso de identificadores estables permiten que, en el futuro, esta documentación pueda servir como fuente para una visualización interactiva desde el frontend. Esa visualización no forma parte de la implementación actual.
