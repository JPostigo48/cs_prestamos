# Seguimiento semanal

Esta carpeta registra la evolución de los sprints por semana e integrante. Permite contrastar lo planificado con lo realizado y reconocer pendientes y bloqueos; **no es una métrica de productividad individual**. Los archivos Markdown son la fuente de verdad para la futura vista [`/project/team`](../roadmap.md).

## Archivos

Cada semana con información verificable se documenta en `week-XX.md`, con número de dos dígitos y front matter:

```yaml
---
week: 1
sprint: 1
start: YYYY-MM-DD
end: YYYY-MM-DD
status: in_progress
---
```

`week` y `sprint` son números; `start` y `end` son fechas reales en formato ISO; `status` usa `planned`, `in_progress` o `completed`. No se crean semanas con fechas o avances supuestos.

## Contenido de cada semana

Después del encabezado `# Semana N`, incluir una sección por integrante: Juan Carlos Postigo Cabana, Ronald Reynaldo Valdez Agüero, Mauricio Alejandro Farfán Huayta y Luis Antonio Chipana Chura. Cada sección contiene `### Planificado`, `### Realizado`, `### Pendiente` y `### Bloqueos`. Registrar únicamente información aportada o verificable; cuando no exista, indicarlo sin inferir cumplimiento ni asignar tareas nuevas.

Vincular, cuando corresponda, IDs del [backlog](../backlog.md), el [sprint](../README.md#organización), ramas o Pull Requests documentados. Al cierre de una semana, cada integrante comunica el estado de su área y Juan Carlos consolida el archivo. El resumen del sprint sigue siendo su propio documento; estos registros no lo sustituyen.
