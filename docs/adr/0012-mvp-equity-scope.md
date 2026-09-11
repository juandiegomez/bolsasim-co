# ADR-0012: alcance de activos del MVP y Slice 6

- **Estado:** Superseded by [ADR-0013](0013-mvp-equity-free-universe.md)
- **Fecha:** 2026-09-11

> Este ADR conserva la decisión intermedia de limitar el MVP a acciones
> colombianas en COP. La decisión vigente elimina la exclusividad geográfica
> y mantiene únicamente la restricción de tipo `EQUITY`; consultar ADR-0013.

Las decisiones y consecuencias de este documento son históricas y no deben
usarse para bloquear el MVP vigente. La aceptación actual de Twelve Data, el
dataset local USD y los límites de uso están en ADR-0005 y ADR-0013.

## Contexto

El modelo de dominio conserva una lista extensible de tipos de instrumento,
pero el MVP fue diseñado alrededor de un portafolio local con efectivo COP,
acciones colombianas y compras simuladas. La evaluación de Twelve Data mostró
que ampliar el producto a otros mercados o tipos de activo solo para sortear
una restricción del plan gratuito introduciría decisiones financieras nuevas.

En particular, FX requiere pares base/cotizada y conversión; crypto requiere
reglas de mercado continuo; los dividendos y splits requieren eventos
corporativos y efectos explícitos en el ledger. Ninguna de esas decisiones está
aprobada por los requirements actuales.

## Decisión

El alcance operativo del MVP y del Slice 6 queda reafirmado así:

- solo instrumentos de tipo `EQUITY`;
- solo instrumentos denominados en `COP`;
- objetivo de mercado: acciones colombianas, con exchange/MIC y procedencia
  verificables;
- el portafolio mantiene una única moneda base COP;
- se permiten únicamente compras simuladas `BUY`, con las reglas ya aprobadas;
- `ETF`, `FIXED_INCOME`, `FUND`, `INDEX`, `CURRENCY`, pares FX, crypto,
  dividendos, splits y otros eventos corporativos permanecen fuera del MVP;
- los tipos extensibles que aparecen en contratos o tipos internos son
  reservados para futuras decisiones, no capacidades habilitadas;
- una fuente con cobertura gratuita de otro activo o mercado no sustituye el
  criterio de aceptación de acciones colombianas en COP.

La evaluación histórica de Twelve Data descrita aquí no cambia la decisión
vigente. Aunque `ECO:BVC` fue la única acción colombiana disponible en la
prueba inicial, la muestra global `AAPL`, `MSFT` y `KO` satisface el criterio
actual de ADR-0013, que elimina la exclusividad geográfica.

## Consecuencias

- El modo `demo` continúa siendo la única fuente activa por defecto.
- `datasets/real` puede existir localmente y Twelve Data está aprobada para la
  muestra educativa local según ADR-0005 y ADR-0013.
- No se agregan FX, crypto, dividendos ni otros instrumentos como workaround.
- Las compras, posiciones, evolución y simulación conservan su semántica COP.
- Cualquier ampliación futura deberá aportar requirements, contrato, ADR,
  reglas monetarias, errores, fixtures y pruebas antes de implementarse.
- El cierre completo de Slice 6 se determina por ADR-0013 y su evidencia, no por
  la decisión histórica de este ADR.
