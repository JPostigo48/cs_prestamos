# Contrato cliente para integración con registro

## Superficie compartida estable

- [apiRequest()](client.ts:26) conserva ruta, opciones, respuesta y tratamiento de autenticación existentes. No hay rutas nuevas, reintento automático ni cambios en registro/usuarios, arranque o filtros compartidos.
- [ApiError](client.ts:1) conserva la construcción con mensaje y estado. El tercer argumento opcional añade metadatos exclusivamente de capacidad: código literal SCHEMA_CAPABILITY_UNAVAILABLE, operación opcional y diagnóstico opcional SCHEMA_INCOMPLETE o SCHEMA_UNKNOWN. Las propiedades son de solo lectura; sin metadatos permanecen indefinidas.
- Solo HTTP 503 con ese código exacto activa la proyección segura. La operación debe ser un identificador de puntos, sin espacios, de hasta 96 caracteres. Mensajes arbitrarios, causas, SQL y diagnósticos no reconocidos no se copian. El cliente conserva su frase fija segura «La operación no está disponible temporalmente. Intente nuevamente más tarde.» seguida del código/operación; no lee el mensaje arbitrario del proveedor, aunque el diagnóstico sea reconocido. Los mensajes accionables del backend no alteran este saneamiento.
- No se interpreta todo 503 como migración pendiente, ni como validación. Los otros errores conservan mensaje, estado y notificación 401 existentes. El agente de registro puede seguir utilizando la llamada de dos argumentos y las firmas actuales, sin importar inventario o préstamos.
- Excepción mínima imprescindible en [errorMessage()](../composables/useRemote.ts:4): permite mostrar ese mensaje ya saneado exclusivamente para HTTP 503 con código de capacidad; antes lo ocultaba como error genérico de comunicación. No se modifica la lógica de cargas, cancelación, filtros o reintentos del composable.

## Cuerpos exactos del proveedor

Para una operación representativa, los cuerpos HTTP 503 serializados son:

```json
{
  "statusCode": 503,
  "code": "SCHEMA_CAPABILITY_UNAVAILABLE",
  "operation": "loans.close",
  "diagnostic": "SCHEMA_INCOMPLETE",
  "message": "Operación bloqueada por una actualización pendiente del sistema. Solicite al administrador completar la actualización y vuelva a intentarlo."
}
```

```json
{
  "statusCode": 503,
  "code": "SCHEMA_CAPABILITY_UNAVAILABLE",
  "operation": "loans.close",
  "diagnostic": "SCHEMA_UNKNOWN",
  "message": "No se pudo verificar la disponibilidad de esta operación. Vuelva a intentarlo; si persiste, contacte al administrador."
}
```

La operación depende del llamador real. No se añaden causas, SQL, tablas sensibles ni secretos. Un fallo de red no acredita una actualización pendiente. Para ambos cuerpos, el mensaje cliente exacto es «La operación no está disponible temporalmente. Intente nuevamente más tarde. [SCHEMA_CAPABILITY_UNAVAILABLE: loans.close]».

## Contratos de dominio

- [Inventario](../../modules/inventory/CLIENT-CONTRACT.md): ocupación/stock registrado no acredita aptitud; disponibilidad, condición y habilitación desconocidas permanecen nulas. Metadatos nuevos presentes se validan estrictamente. Las capacidades se combinan con permisos y estado, no los sustituyen.
- [Préstamos y confianza](../../modules/loans/CLIENT-CONTRACT.md): historial omitido o no consultable no prueba ausencia de cierre; sanción con episodio omitido no equivale a episodio nulo. Ante incertidumbre se conservan intención, cuerpo y UUID del cierre integral, sin alternativa básica.
- El [controlador de cierre](../../modules/loans/useLoanClosure.ts:7) conserva también el error seguro visible junto al aviso de intención preservada. El servidor sigue validando todas las garantías.

## Verificaciones finales

Reverificación del ajuste de mensajes accionables del proveedor: **71/71 pruebas
offline del proveedor y 14/14 de errores HTTP frontend aprobadas**, incluidos ambos
cuerpos serializados exactos, saneamiento con diagnóstico válido y fallo de red
sin clasificación de actualización pendiente. Tipos backend correctos. No cambió
código cliente; no se repitieron tipos frontend ni la suite completa en este ajuste.
Desde la raíz del repositorio:

```text
npm --prefix backend test -- test/schema-capabilities.offline.spec.ts
node --test frontend/tests/schema-api-errors.test.mjs
npm --prefix backend run typecheck
```

Los resultados siguientes corresponden a la verificación inicial, no a esta
reverificación focal:

Desde la raíz del repositorio, sin instalaciones, servicios, BD ni lectura de archivos de entorno:

```text
node --test frontend/tests/schema-api-errors.test.mjs frontend/tests/loans-schema-compatibility.test.mjs frontend/tests/inventory-compatibility.test.mjs
npm --prefix frontend run typecheck
node --test frontend/tests/*.test.mjs
git diff --check -- frontend
```

La comprobación focal contiene **97 pruebas nuevas** (52 inventario, 34 préstamos/confianza y 11 errores HTTP). Resultado inicial final: 97 aprobadas, ninguna fallida/omitida. Tipos y espacios correctos.

Suite completa: **451 pruebas, 441 aprobadas, 10 fallidas**, cero canceladas/omitidas. No está aprobada; los diez casos y sus diagnósticos están en el [informe de integración](../../modules/loans/CLIENT-CONTRACT.md:69). Se preservan esos casos y no se modifica el comportamiento ajeno al alcance para ponerlos verdes.

Desde el directorio frontend, el empaquetado usa la configuración existente con carga de entorno y escritura de artefactos desactivadas:

```text
node --input-type=module -e "import { build } from 'vite'; await build({ envFile: false, build: { write: false } });"
```

Resultado: **2144 módulos transformados**, salida correcta. Tipos comprobados por separado; no se ejecutó el script de build habitual que puede cargar entorno. Los artefactos preexistentes se preservaron.

Pruebas offline con respuestas JSON representativas de los DTO backend y renderizado Vue en memoria. No certifican navegador/CSS, concurrencia PostgreSQL ni migraciones reales. No se ejecutaron serializadores backend dentro de estas pruebas ni se regeneraron contratos OpenAPI.
