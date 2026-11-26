# Revisión de compatibilidad: cuatro hallazgos

Comprobación del 25/11/2026, hora local de Lima. Se preservaron los cambios
iniciales del usuario; no se hicieron commits, checkout ni modificaciones del índice.

## Cambios y pruebas

- [Proveedor](../backend/src/shared/infrastructure/prisma/schema-capabilities.ts:125): exige los tres CHECKs de efecto/importes/duración, rangos/conservación y contexto de episodio, con definiciones compatibles y validadas, sin depender del nombre. [Fixtures independientes](../backend/test/helpers/episode-checks.ts:4), [casos del proveedor](../backend/test/schema-capabilities.offline.spec.ts:116) y [cero escrituras](../backend/test/loans-schema-compatibility.offline.spec.ts:138), incluida revalidación transaccional.
- [Detalles de ejemplares](../frontend/src/modules/inventory/useCopyDetails.ts:6): revalidación explícita desde los dos listados operativos, descarte de capacidades obsoletas y protección frente a respuestas tardías. No cambia ni reenvía solicitudes de escritura ni borra UUIDs.
- [Categorías](../frontend/src/modules/inventory/api/categories-api.ts:56): confirmación y conciliación descriptivas solo del nombre/descripción enviados; edición completa estricta. El [editor](../frontend/src/modules/inventory/components/CategoryEditorDialog.vue:24) conserva dos días/24 horas y el modo enviado ante respuesta incierta.
- [Job](../backend/src/modules/loans/infrastructure/loan-overdue.service.ts:38): conserva el fallo del recorrido entre ticks y no confunde cola vacía con recuperación. [Pruebas de 100/102 candidatos](../backend/test/loan-overdue-job.offline.spec.ts:123), varios recorridos, recordatorio acotado y una sola recuperación real.

## Ejecuciones

Desde backend:

- [node node_modules/vitest/vitest.mjs run --config vitest.config.loans-offline.ts](../backend/vitest.config.loans-offline.ts): **476/476**, 18 suites, ninguna fallida.
- [node node_modules/typescript/bin/tsc --noEmit --incremental false](../backend/package.json): correcto, sin emisión ni cargador de entorno.

Desde frontend:

- [node --test tests/compatibility-review.test.mjs tests/inventory-compatibility.test.mjs tests/loans-schema-compatibility.test.mjs tests/categories.test.mjs tests/operator-visual.test.mjs tests/user-visual.test.mjs](../frontend/tests/compatibility-review.test.mjs): **129/129**, incluidas ocho regresiones nuevas.
- [node node_modules/vue-tsc/bin/vue-tsc.js --noEmit --incremental false](../frontend/package.json): correcto.
- [node --test --test-reporter=tap tests/*.test.mjs](../frontend/tests/): **459 pruebas, 449 aprobadas, 10 fallidas**, cero omitidas/canceladas. La suite global **no está aprobada**.
- Comprobación de espacios de los diffs afectados: correcta.

## Comparación histórica de los diez fallos

Commit completo: **5d910793c0701e236ae68bae35000bc0358a233a**.

Se creó un arnés temporal dentro del frontend. Los hooks del cargador y las
lecturas de fuentes sustituyeron en memoria pruebas, helpers y fuentes por su
contenido obtenido con lectura de Git. Se usaron las dependencias locales
existentes. No se materializaron fuentes históricas ni se alteraron archivos
excluidos, rama o índice. Se ejecutaron únicamente estas cuatro suites históricas:

| Suite actual enlazada | Fallos reproducidos por nombre, mensaje de error y código |
| --- | --- |
| [Imagen de registro](../frontend/tests/auth-user.test.mjs:203) | Invalidación de lectura pendiente: 1. |
| [Correcciones finales](../frontend/tests/final-corrections.test.mjs:157) | I7 inicio y REFLOW layout: 2. |
| [Fase 3](../frontend/tests/phase3-corrections.test.mjs:165) | I6 ida/retorno, I2 incertidumbre, I2 ID confirmado, I6 enlaces/router, I7/I8 inicio, I7 inventario: 6. |
| [Integración](../frontend/tests/real-integration.test.mjs:43) | Política de roles/rutas/destinos: 1. |

Resultado histórico focal: **63 pruebas, 53 aprobadas, 10 fallidas**, cero
omitidas/canceladas. Coincidencia de nombre, mensaje y código: **10/10**.
Esto acredita la reproducción de esos diez casos en ese commit, **no** una
suite global histórica completa ni equivalencia de todas las trazas o causas.
No se repararon esos fallos ni se debilitaron sus aserciones.

Huellas SHA-256 de los logs temporales, registrados antes de eliminarlos:

- Global actual, última pasada: 5f30e2850a8b4afaf44d8be7e21def0a538eef91ba3a9294b5c7e04c5149b0a5.
- Histórico focal: 3fcb60952a3aa5f809546e7b9fdc1dd5f28b049c53b8399cb2123ba0dba3f9e0.

## Preservación y límites

Preflight antes de editar: ambas capturas existentes conservaron tamaño y
SHA-256 al terminar; no se ejecutó el generador de capturas.

| Artefacto | Bytes | SHA-256 inicial = final |
| --- | --- | --- |
| [Captura 1440](../frontend/tests/artifacts/loan-closure-1440.png) | 107994 | 39937db584fc249954c288d1d471d4f6d1d7f04c2c1dacfb4d08751f481725ed |
| [Captura 375](../frontend/tests/artifacts/loan-closure-375.png) | 52896 | f2b3ae6ec273f312efc6a72fc5c52ae3489fc692817c6ee635573d2f21e06575 |

Sin modificaciones de autenticación, usuarios, arranque, OpenAPI, entorno,
seeds ni recursos externos. Sin instalaciones, build, servicios o conexiones
de base de datos. Las pruebas usan dobles/AST y renderizado Vue en memoria:
no prueban DDL, bloqueo o aislamiento PostgreSQL reales, navegador ni CSS.
El parser de CHECKs admite deliberadamente solo la gramática y casts seguros
de estas restricciones; expresiones equivalentes de forma no reconocida se
consideran incompatibles de manera conservadora.
