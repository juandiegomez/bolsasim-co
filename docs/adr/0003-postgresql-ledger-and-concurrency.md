# ADR-0003: PostgreSQL, ledger y concurrencia

- **Estado:** Accepted
- **Fecha:** 2026-09-05

## Contexto

Saldo y posiciones deben reconstruirse; una compra concurrente no puede sobregirar. La persistencia local debe representar decimales exactamente.

## Decisión

Usar PostgreSQL y Drizzle. `transactions` es append-only y autoritativa; índices únicos protegen depósito e idempotencia. La confirmación bloquea el aggregate de portafolio dentro de una transacción, recalcula saldo y agrega la compra atómicamente. Proyecciones persistidas futuras serán descartables y reconstruibles.

## Consecuencias

Las pruebas de integración requieren PostgreSQL real, no una emulación en memoria. Una venta necesitará nuevas reglas y no se habilita porque el enum conceptual la reserve.
