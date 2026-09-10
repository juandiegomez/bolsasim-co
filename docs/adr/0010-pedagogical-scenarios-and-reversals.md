# ADR-0010: escenarios pedagógicos y anulaciones reversibles

- **Estado:** Accepted — alcance futuro posterior a Slice 4
- **Fecha:** 2026-09-10
- **Requirements:** PED-001, PED-002, PORT-002, SEC-001

## Contexto

BolsaSim CO se usa en clase. Un facilitador necesita conservar ejemplos y, a
la vez, deshacer una compra particular o reiniciar una práctica sin alterar
otros casos pedagógicos. El ledger autoritativo no puede satisfacerse mediante
borrado físico: se perdería la explicación de lo ocurrido.

## Decisión

- Un escenario agrupa un portafolio local y tiene estado `ACTIVE | ARCHIVED`.
  Solo uno puede estar activo para el usuario local.
- Una compra se anula mediante un `VOID_BUY` inmutable que apunta al `BUY`
  original. La proyección excluye ambos; no se permite anular dos veces ni el
  depósito inicial.
- Reiniciar archiva el escenario activo y crea uno nuevo con el depósito
  inicial configurado. Nunca borra escenarios ni movimientos.
- La interfaz usa “Deshacer compra”, “Conservar como ejemplo” y “Reiniciar
  práctica”. No habilita ventas, FX ni edición libre de precios/cantidades.

## Consecuencias

PORT-002 conserva un ledger inmutable y proyecciones reconstruibles. La
semántica se amplía para `VOID_BUY`, pero no se aplica al Slice 3. La futura
implementación requiere migración, OpenAPI, pruebas unitarias, integración de
concurrencia y E2E antes de verificar los requirements.
