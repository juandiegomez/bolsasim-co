# ADR-0013: universo gratuito de Equity para el MVP

- **Estado:** Accepted
- **Fecha:** 2026-09-11
- **Supersedes:** [ADR-0012](0012-mvp-equity-scope.md) en lo relativo a la
  exclusividad colombiana y la moneda única COP

## Contexto

BolsaSim CO nació con foco en acciones colombianas, pero la cobertura gratuita
disponible de un proveedor no garantiza una muestra suficiente de ese mercado.
La cuenta evaluada de Twelve Data pudo consultar `ECO:BVC`, mientras que otras
acciones colombianas quedaron restringidas por plan. Mantener Colombia como
criterio obligatorio bloquearía el MVP por una decisión de mercado que ya no es
esencial para la funcionalidad educativa.

El producto sí necesita conservar límites financieros claros. Acciones en USD
u otra moneda no pueden mezclarse silenciosamente con un saldo COP, y admitir
FX, crypto, dividendos u otros activos introduciría reglas que no pertenecen a
este slice.

## Decisión

El MVP deja de ser exclusivo de Colombia y adopta el siguiente alcance:

- el único tipo de instrumento habilitado es `EQUITY`;
- el universo elegible es el conjunto de acciones activas que el proveedor
  configurado ofrece sin requerir un plan pagado adicional;
- no se impone un país, exchange o MIC específico; cada instrumento conserva
  su exchange, MIC y moneda explícitos;
- la aceptación de una fuente exige una muestra reproducible de al menos tres
  `EQUITY` activas con histórico EOD suficiente en un perfil operable;
- un perfil de portafolio tiene una única moneda de liquidación y solo permite
  compras de Equity en esa misma moneda; no hay conversión FX ni mezcla de
  monedas dentro del portafolio;
- COP y el depósito COP 10.000.000 continúan como perfil predeterminado por
  compatibilidad con el trabajo existente, pero no son una restricción
  geográfica del MVP;
- cualquier otra moneda requiere un perfil explícito y configuración/documentación
  compatible antes de habilitar sus operaciones;
- `ETF`, `FIXED_INCOME`, `FUND`, `INDEX`, `CURRENCY`, pares FX, crypto,
  dividendos, splits y otros eventos corporativos permanecen fuera del MVP.

### Definición de “gratuito y disponible”

Un instrumento cuenta como elegible solo si, con la cuenta y configuración
evaluadas:

1. el catálogo lo identifica de forma inequívoca;
2. precio EOD e histórico se obtienen sin contratar un plan pagado adicional;
3. la respuesta confirma símbolo, tipo, exchange/MIC, moneda y cobertura;
4. la serie cumple el contrato de fechas, positividad, unicidad y base de
   precio; y
5. las condiciones de uso permiten el alcance educativo local previsto.

La mera presencia en `/stocks`, `/exchanges` o `/symbol_search` no demuestra
acceso al precio histórico. Los errores de cobertura o entitlement se
conservan como errores explícitos y no activan un fallback demo silencioso.

## Consecuencias

- La muestra técnica de Twelve Data fue comprobada con `AAPL:NASDAQ`,
  `MSFT:NASDAQ` y `KO:NYSE` en USD usando `adjust=none`; la fuente está
  aceptada para la demo educativa local. El dataset real local ya cuenta con
  procedencia, checksum y verificación del adapter. La publicación o
  redistribución requiere autorización adicional.
- El requisito colombiano específico de ADR-0005 queda reemplazado por el
  criterio de universo gratuito de Equity; `ECO:BVC` es evidencia parcial, no
  un bloqueo del MVP.
- La configuración del depósito, las validaciones, la persistencia y la UI ya
  admiten perfiles como USD sin introducir FX; el modo predeterminado sigue
  siendo demo aunque el dataset real local puede activarse explícitamente.
- `demo` sigue siendo el modo predeterminado para CI y desarrollo.
- Una fuente real solo se aprueba con evidencia de acceso, semántica EOD,
  procedencia, checksum y licencia compatible; no se guardan secretos en el
  repositorio.
- Una futura ampliación a FX, crypto, dividendos u otros tipos requiere otro
  requirement y ADR; no está implícita en este cambio.
