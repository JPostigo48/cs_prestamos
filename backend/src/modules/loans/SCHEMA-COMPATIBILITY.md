# Compatibilidad física de préstamos, reservas y reglas

## Alcance

Contrato backend para la integración frontend durante una migración incompleta.
No redefine políticas, puntos, registro ni autenticación. Se reutiliza el
[proveedor compartido](../../shared/infrastructure/prisma/schema-capabilities.ts:164)
y se conserva el [contrato de inventario](../inventory/SCHEMA-COMPATIBILITY.md).
No se infiere disponibilidad desde el registro de migraciones ni desde una
excepción genérica: se inspeccionan objetos físicos y restricciones reales.

## Lecturas de préstamos e historial

Detalle, activos, vencidos, historial por usuario e historial paginado por recurso
conservan su forma y agregan por préstamo
[closureHistory](domain/entities/loan.ts:33):

| Valor | Interpretación obligatoria del cliente |
| --- | --- |
| AVAILABLE | Se pueden leer las columnas de asociación y resultado del cierre. Un cierre nulo significa que no se encontró un cierre integral persistido para ese préstamo. Puede existir devolución antigua. |
| UNAVAILABLE | El esquema conocido no permite consultar el historial de cierres. Un cierre nulo **no acredita ausencia de cierre**. Mostrar «Historial de cierre no disponible», no «Sin consecuencias». |

Con historial disponible se restaura el resultado original, incluyendo
consecuencias, recompensa y ejemplar; no se recalculan ni sustituyen por una
devolución básica. Con historial no disponible se conservan préstamo, devolución
e inspección antiguas, pero no se consultan cierres ni se inventan consecuencias.
El estado del préstamo no se reescribe por compatibilidad.

La capacidad de lectura comprueba exactamente asociación y resultado: una tabla
parcial con ambas columnas sigue siendo legible aunque falten otras columnas,
índices o claves necesarios para escribir. Si falta cualquiera de ellas, no se
consulta esa tabla. No se exige el bundle completo de escritura para leer.

El cierre integral y su replay también incluyen AVAILABLE, de forma consistente
con GET y sin alterar los efectos ni la clave del resultado persistido.

Metadata desconocida —por conectividad, permisos, consulta SQL u otra causa—
produce 503, **nunca** una respuesta que aparente cierre ausente. No se expone un
tercer estado de historial con información inventada. La ausencia del campo en
una respuesta de mutación o en un servidor anterior tampoco prueba capacidad.

## Lecturas de reglas

El detalle de sanción requiere todas las columnas de ajustes que proyecta o usa
para filtrar/ordenar. La política de devolución requiere las columnas concretas
de episodios y ajustes usadas para sus consecuencias. Si faltan, responde 503:
no devuelve un detalle reducido ni una mora cero fabricada. Las restricciones
de escritura faltantes, por sí solas, no impiden esas lecturas si sus columnas
reales están presentes. Las lecturas antiguas de reglas, incumplimientos y
apelaciones que no usan esos objetos mantienen su comportamiento.

Las lecturas usan la recuperación compartida de una sola repetición tras
SQLSTATE de tabla/columna ausente, invalidando caché y recreando la lectura fuera
de transacciones fallidas. Red, permisos y otros errores SQL no activan fallback
de esquema ni prueban que falte una migración.

## Escrituras: error y atomicidad

La [respuesta compartida](../../shared/infrastructure/prisma/schema-capabilities.ts:34)
es HTTP 503, con statusCode 503, code SCHEMA_CAPABILITY_UNAVAILABLE,
operation identificando la operación y diagnostic SCHEMA_INCOMPLETE o
SCHEMA_UNKNOWN. El mensaje es seguro y accionable según el diagnóstico, sin SQL,
tablas sensibles ni secretos. Los [dos cuerpos JSON exactos](../../../docs/loan-episodes-integration.md:248)
del proveedor distinguen actualización pendiente de disponibilidad no verificable;
red y permisos no prueban una actualización pendiente.

| Operación | Garantías físicas requeridas |
| --- | --- |
| Reservar, recoger, cancelar reserva, vencer reservas, sincronizar mora | Estado físico del ejemplar y episodios/ajustes. La cancelación también revalida mora y puede liberar ejemplar. |
| Cerrar préstamo integralmente, por devolución o incidente | Las anteriores más persistencia/idempotencia y estado de cierre. |
| Sancionar, registrar incumplimiento, levantar sanción | Episodios/ajustes y liberación física de reservas. |
| Presentar o resolver apelación | Episodios/ajustes, incluida restitución exacta del descuento. |
| Liberación interna por sanción | Estado físico, dentro de la transacción del coordinador. |

La [selección de dependencias](infrastructure/loan-schema.ts:10) es concreta.
No se bloquea la mora porque falte una tabla de cierres que no utiliza, ni una
apelación por una columna física de inventario que no necesita. La rehabilitación
de ejemplares sigue protegida por inventario, sin una segunda implementación.

El bundle de episodios exige también los tres CHECKs de ajustes y contexto:
efecto con importes/duración, rangos y conservación de saldos, y asociación
completa del episodio. El [evaluador](../../shared/infrastructure/prisma/schema-capabilities.ts:125)
requiere restricciones validadas de la tabla correcta y compara la estructura
de sus expresiones, no sus nombres. El [parser restringido](../../shared/infrastructure/prisma/schema-check-expression.ts:4)
preserva precedencia y agrupación; admite la expansión de rangos y casts sin
pérdida del deparser. Sintaxis no reconocida falla de forma conservadora.

Se verifica antes de cualquier escritura, incluyendo actualizaciones neutras de
bloqueo, y se vuelve a inspeccionar dentro de cada transacción, sin reutilizar
la caché exterior. La presentación de apelación también es transaccional.
Una excepción de capacidad aborta la unidad; no se devuelve como error de
negocio que permita confirmar escrituras previas. Una desaparición de objeto
durante escritura provoca rollback y 503, sin reintento ni escritura alternativa.
No se acepta devolución básica, no se omite sincronización de mora y no se
relajan idempotencia, restitución, estado físico ni consecuencias.

Ante 503 el frontend debe mantener la intención y la clave de solicitud,
informar indisponibilidad temporal y no presentar éxito ni habilitar una ruta
básica alternativa. No interpretar 503 como validación de datos ni como causa
única «migración pendiente». Tras incertidumbre de transporte, conciliar con la
lectura persistida; solo interpretar ausencia de cierre con historial AVAILABLE.

## Jobs y operación

El job de mora verifica episodios y liberación **antes** de candidatos. Su
consulta de candidatos usa solo identificador, titular, estado y vencimiento
antiguos; que esa consulta funcione no prueba capacidad de escribir episodios.
El vencimiento de reservas verifica sus garantías antes de consultar candidatos.

Los jobs conservan cursor, exclusión de ejecuciones solapadas y transacciones
por unidad. Ante indisponibilidad no ejecutan una versión básica del proceso.
Se reintenta automáticamente en ciclos de un minuto: la caché conocida del
proveedor caduca a los 30 segundos; metadata desconocida no queda cacheada.
No hay pausa permanente ni necesidad de reiniciar después de completar esquema.

Los [logs acotados](infrastructure/loan-job-monitor.ts:5) registran transición a
pausa, recordatorio como máximo cada 15 minutos y reanudación tras ciclo correcto.
Los fallos por unidad se agregan, no se registra una línea por préstamo/reserva.
El fallo del recorrido se conserva entre ticks mientras continúa el cursor.
Una cola vacía después de 100 unidades fallidas no acredita recuperación;
solo se anuncia tras completar un recorrido posterior sin fallos, incluso si
ese nuevo recorrido acredita que ya no existen candidatos.
El diagnóstico seguro distingue esquema incompleto/desconocido, objeto ausente,
permisos, conexión, otro SQL y fallo operativo. Metadata desconocida no conserva
su causa en la API compartida: no se atribuye falsamente a red o migración.
Los códigos internos no contienen mensajes SQL, URLs, parámetros ni titulares.

## Verificación offline y límites

La [suite focal](../../../test/loans-schema-compatibility.offline.spec.ts)
ejecuta AST SQL nativo con dobles que rechazan objetos ausentes, esquemas
antiguo/completo/parcial, metadata desconocida, cero escrituras, rollback sin
fallback, expiración de caché y logs de pausa/reanudación. La
[fixture completa](../../../test/helpers/loan-schema.ts) declara las garantías
físicas explícitamente; no conecta una base de datos.

No simula aislamiento PostgreSQL ni carreras DDL reales. No se ejecutan
migraciones, seeds, servicios, instalaciones o cambios de producción. La
documentación no sustituye ni regenera OpenAPI en este alcance.

La [configuración offline focal](../../../vitest.config.loans-offline.ts) bloquea
el cargador de entorno incluso en imports transitivos y utiliza el pool de VM
para evitar el fallo de registro de suites importadas de Vitest en este Windows.
Se ejecuta con el script de pruebas del backend, pasando --config y esa
configuración. No modifica el ejecutor habitual ni instala dependencias.

Verificación del 25/11/2026: 439 pruebas aprobadas en 18 suites, incluidas las
27 pruebas nuevas de compatibilidad; comprobación TypeScript sin errores.

Revisión posterior: **476/476 en 18 suites**, tipos correctos. Incluye fixtures
independientes de expresiones, CHECKs ausentes/alterados/no validados, cero
escrituras antes y dentro de transacción, y recorridos fallidos de 100/102
candidatos durante varios ticks. [Evidencias y límites](../../../../docs/compatibility-review-verification.md).
