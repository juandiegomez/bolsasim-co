# ADR-0003: PostgreSQL, ledger y concurrencia

- **Estado:** Accepted
- **Fecha:** 2026-09-05

## Contexto

Saldo y posiciones deben reconstruirse; una compra concurrente no puede sobregirar. La persistencia local debe representar decimales exactamente.

## Decisión

Usar PostgreSQL y Drizzle. `transactions` es append-only y autoritativa; índices únicos protegen depósito e idempotencia. La confirmación bloquea el aggregate de portafolio dentro de una transacción, recalcula saldo y agrega la compra atómicamente. Proyecciones persistidas futuras serán descartables y reconstruibles.

## Consecuencias

Las pruebas de integración requieren PostgreSQL real, no una emulación en memoria. Una venta necesitará nuevas reglas y no se habilita porque el enum conceptual la reserve.

Consolidación de Slice 3: el orden de reproducción del ledger es el orden de append; `transactions.ledger_sequence` (bigserial) es el desempate autoritativo cuando `executedAt` y `createdAt` coinciden, porque el `id` UUID no garantiza orden de inserción. El BUY conserva la metadata de mercado usada (`market_data` jsonb) y la clave de idempotencia; un índice único parcial sobre la clave evita reusos entre previews y su violación se traduce a `IDEMPOTENCY_CONFLICT`.
