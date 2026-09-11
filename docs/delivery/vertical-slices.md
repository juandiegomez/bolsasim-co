# Backlog de vertical slices

## Slice 0 — Infraestructura ejecutable

**Propósito:** convertir las decisiones de Fase 0 en una aplicación vacía verificable.  
**IDs:** SDD-001, FIN-001, OBS-001.

**Concreción Fase 1:** FND-001 agrupa los criterios de infraestructura de este slice, según [ADR-0009](../adr/0009-slice-zero-foundation.md). La migración inicial no crea tablas de negocio. Health es `/api/v1/health` (liveness). FIN-001 y OBS-001 solo se verifican en el alcance fundacional; no implican dominio financiero completo.

Entregables: Next.js/TypeScript estricto, gestor y lockfile, validación de entorno, PostgreSQL/Drizzle, decimal.js configurado, estructura modular, health check, logging/request ID y CI con scripts reales.

Aceptación: instalación limpia; migración y health check local; format, lint, typecheck, prueba mínima y build pasan; ningún precio o funcionalidad de producto simulada.

## Slice 1 — Inicialización y saldo

**IDs:** PORT-001, PORT-002, FIN-001, FIN-002, UI-001, UI-002.

Desde migración del ledger y usuario local hasta dashboard con saldo. Inicialización idempotente de COP 10.000.000, reconstrucción desde movimientos, estado loading/error/success y aviso del simulador.

Aceptación: dos inicializaciones producen un depósito; recarga conserva saldo; corrupción falla explícitamente; pruebas unitarias, integración y E2E pasan.

## Slice 2 — Explorar y detalle

**IDs:** INST-001, MDATA-001, MDATA-002, PERF-001, UI-001, UI-002.

Implementar puerto, mock, adapter de archivo validado, caché, búsqueda paginada, detalle, último cierre e histórico gráfico/tabular. Antes de aceptar el slice para MVP debe aprobarse una fuente real gratuita en ADR-0005.

Aceptación: metadata completa y etiqueta real/demo; fechas y base visibles; búsquedas vacías y fallos controlados; contract tests comunes; sin fallback silencioso.

## Slice 3 — Compra y dashboard

**IDs:** PORT-003, PORT-004, PORT-005, FIN-001–003, SEC-001, OBS-001.

Implementar cálculo, previews, confirmación idempotente y transaccional, posiciones, métricas, evolución y movimientos recientes. UI muestra resumen, aproximación, efectivo y confirmación.

Aceptación: caso COP 2 millones correcto; insuficiencia y concurrencia sin sobregiro; preview vencida y key conflictiva controladas; P&L incompleto ante falta de precio; suite financiera y E2E pasan.

## Slice 4 — Simulación histórica

**IDs:** HIST-001–003, FIN-001–003, MDATA-001–002, UI-001–002.

Implementar formulario independiente, resolución direccional de fechas, calculador, serie de evolución, gráfica/tabla y supuestos. No persiste ni toca ledger.

Aceptación: fixture 100→120 produce 20%; fin de semana resuelve correctamente; base homogénea; rango/cobertura/datos faltantes controlados; snapshot del ledger no cambia.

## Slice 5 — Escenarios pedagógicos

**IDs:** PED-001, PED-002, PORT-002, SEC-001.

Implementar escenarios locales archivables, reinicio de práctica y anulación
reversible de compras. No borra movimientos: registra `VOID_BUY`, reconstruye
las proyecciones y conserva ejemplos de clase. ADR-0010 define la decisión.

Aceptación: deshacer una compra restaura efectivo y posición sin borrar el
historial; doble anulación falla explícitamente; reiniciar crea una práctica
nueva en COP 10.000.000 y archiva la anterior; pruebas de proyección,
integración y E2E pasan.

La evolución conserva una compra en las fechas anteriores al `VOID_BUY` y la
excluye desde su fecha efectiva en adelante; `ledgerSequence` resuelve
movimientos del mismo día.

## Slice 6 — Cierre del MVP y datos de mercado

El Slice 6 se divide en dos entregas consecutivas. El plan detallado está en
[`slice-six-plan.md`](slice-six-plan.md). Las mejoras visuales adicionales se
reservan para la clase y no bloquean este slice.

### Slice 6A — Fuente real controlada

**IDs:** MDATA-001, MDATA-002, INST-001, HIST-002, HIST-003, PORT-004,
PORT-005, SEC-001, SDD-001.

Evaluar Twelve Data como candidata y, si cumple los criterios de ADR-0005,
obtener una muestra autorizada y convertirla al adapter de archivo normalizado.
El dataset demo continúa siendo el predeterminado para desarrollo, CI y clase.
No se implementa scraping ni se expone una clave de proveedor en cliente.

Aceptación: proveedor, plan, licencia, cobertura y semántica de cierre quedan
registrados; existen al menos tres acciones colombianas en COP; la muestra
normalizada tiene manifiesto y checksum; las pruebas contractuales pasan; una
falla de proveedor o ausencia de cobertura produce un error explícito y nunca
activa el mock silenciosamente. Si no se demuestra permiso o acceso suficiente,
el bloqueo queda documentado y no se fuerza la aprobación.

### Slice 6B — Completar evidencia del MVP

**IDs:** PORT-004, PORT-005, MDATA-002, SEC-001, UI-001, UI-002, OBS-001,
SDD-001.

Implementar la ruta dedicada `GET /api/v1/portfolio/positions` reutilizando la
proyección existente, sin crear reglas financieras nuevas. Completar OpenAPI,
serialización, estados vacío/completo/incompleto/error y pruebas de contrato,
integración y E2E. Después actualizar trazabilidad y registrar la validación
final del MVP con los límites que permanezcan.

Aceptación: la ruta devuelve las mismas posiciones autoritativas del snapshot,
con errores y estados de valoración consistentes; cubre portafolio vacío,
múltiples compras y precio ausente; no modifica el ledger; todos los gates del
repositorio pasan.

## Definition of Ready por slice

- IDs y criterios sin decisiones pendientes;
- contratos y errores identificados;
- ADRs aceptados o bloqueos declarados;
- fixtures y escenarios esperados definidos;
- dependencias justificadas.

## Definition of Done por slice

- comportamiento usable de persistencia a UI;
- tipos, validaciones, errores y estados completos;
- documentación, OpenAPI y trazabilidad sincronizados;
- format, lint, typecheck, pruebas aplicables y build en verde;
- criterios demostrados y sin regresiones conocidas.

## Orden y bloqueos

El orden previsto es 0 → 1 → 2 → 3 → 4 → 5 → 6A → 6B. Puede desarrollarse el
slice 2 con mock, pero no aceptarse para MVP hasta resolver ADR-0005. La compra
depende de cotizaciones confiables del slice 2. No se inicia una venta ni otro
activo como trabajo preparatorio.
