# ADR-0004: representación decimal y redondeo

- **Estado:** Accepted
- **Fecha:** 2026-09-05

## Contexto

Los números IEEE-754 no son adecuados para dinero y pueden introducir discrepancias no deterministas.

## Decisión

Usar decimal.js con 50 dígitos significativos. Dinero se persiste `numeric(24,2)`; cantidades y precios `numeric(28,8)`. Cantidades se redondean `ROUND_DOWN` a ocho lugares y liquidaciones monetarias `ROUND_HALF_UP` a dos. HTTP usa strings. Entradas con exceso de escala se rechazan.

## Consecuencias

No se convierte a `number` para cálculos; las gráficas reciben valores de presentación separados y no autoritativos. Cualquier cambio de escala o redondeo requiere ADR y migración evaluada.

## Corrección de consistencia — 2026-09-10

La decisión normativa de este ADR es `numeric(28,8)` para cantidades y
precios: 20 dígitos enteros y 8 fraccionarios. El Slice 1 materializó por
error `numeric(24,8)` en la migración, el esquema y `Quantity`, contradiciendo
esta decisión y la arquitectura publicada. El Slice 3 corrige esa
materialización mediante migración; no cambia el redondeo ni la semántica
financiera ya aceptada.
