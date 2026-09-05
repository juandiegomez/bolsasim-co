# ADR-0004: representación decimal y redondeo

- **Estado:** Accepted
- **Fecha:** 2026-09-05

## Contexto

Los números IEEE-754 no son adecuados para dinero y pueden introducir discrepancias no deterministas.

## Decisión

Usar decimal.js con 50 dígitos significativos. Dinero se persiste `numeric(24,2)`; cantidades y precios `numeric(28,8)`. Cantidades se redondean `ROUND_DOWN` a ocho lugares y liquidaciones monetarias `ROUND_HALF_UP` a dos. HTTP usa strings. Entradas con exceso de escala se rechazan.

## Consecuencias

No se convierte a `number` para cálculos; las gráficas reciben valores de presentación separados y no autoritativos. Cualquier cambio de escala o redondeo requiere ADR y migración evaluada.
