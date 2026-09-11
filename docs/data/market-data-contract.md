# Contrato de datos de mercado

**Estado:** interfaz aceptada; proveedor real en evaluación, no seleccionado
**Requirements:** INST-001, HIST-002, HIST-003, MDATA-001, MDATA-002, PERF-001

## Propósito y frontera

`MarketDataProvider` desacopla aplicación y dominio de APIs, archivos o scrapers específicos. Ninguna UI llama directamente al proveedor. Todo adapter, incluido el mock, debe aprobar la misma suite contractual.

## Tipos comunes

```ts
type DataMode = "real" | "demo";
type PriceBasis = "UNADJUSTED_CLOSE" | "ADJUSTED_CLOSE";
type DateResolution = "ON_OR_AFTER" | "ON_OR_BEFORE";

interface MarketDataMetadata {
  providerId: string;
  mode: DataMode;
  retrievedAt: string; // ISO-8601 UTC
  priceBasis: PriceBasis;
  coverageFrom: string | null; // MarketDate
  coverageTo: string | null;
  adjustedPricePolicy: string;
  limitations: string[];
}

interface PriceObservation {
  instrumentId: string;
  sessionDate: string; // MarketDate
  close: string; // decimal > 0, max 8 places
  currency: string; // ISO 4217
  metadata: MarketDataMetadata;
}
```

La implementación usará tipos nominales en vez de strings libres. El contrato conceptual evita imponer detalles del framework.

## Operaciones

```ts
interface MarketDataProvider {
  listInstruments(
    filters: InstrumentFilters,
    cursor?: string,
  ): Promise<Page<InstrumentMetadata>>;
  searchInstruments(
    query: string,
    cursor?: string,
  ): Promise<Page<InstrumentMetadata>>;
  getInstrument(instrumentId: string): Promise<InstrumentMetadata>;
  getLatestPrice(
    instrumentId: string,
    basis: PriceBasis,
  ): Promise<PriceObservation>;
  getPriceOnDate(
    instrumentId: string,
    requestedDate: string,
    resolution: DateResolution,
    basis: PriceBasis,
  ): Promise<PriceObservation>;
  getHistoricalSeries(
    instrumentId: string,
    from: string,
    to: string,
    basis: PriceBasis,
  ): Promise<HistoricalSeries>;
}
```

`Page` incluye `items` y `nextCursor`; el cursor es opaco. `InstrumentMetadata` incluye ID interno, símbolo, nombre, exchange/MIC cuando esté disponible, moneda, tipo, estado y metadata de fuente. La implementación puede añadir una operación batch sin alterar la semántica de las anteriores.

## Resolución de fechas

- `ON_OR_AFTER`: primera observación disponible cuya sesión sea mayor o igual a la solicitada. Se usa para inicio histórico.
- `ON_OR_BEFORE`: última observación disponible cuya sesión sea menor o igual a la solicitada. Se usa para fin histórico y valoración diaria.
- Sin fecha final: última observación disponible dentro de la cobertura declarada.
- No se interpolan días ni precios.
- Una sesión ausente dentro de cobertura no se presume festivo si el proveedor reporta indisponibilidad o dataset incompleto.
- Si no existe observación en la dirección solicitada dentro del rango/coverage, retorna `NO_MARKET_SESSION` o `COVERAGE_INSUFFICIENT`, no cero.

La serie histórica es inclusiva en `from` y `to`, está ordenada ascendentemente, no tiene fechas duplicadas y contiene únicamente valores positivos en una moneda y base homogéneas.

## Ajustes y eventos corporativos

El histórico solicita `ADJUSTED_CLOSE` solo si el proveedor documenta qué eventos incluye y la muestra contractual lo verifica. De lo contrario usa `UNADJUSTED_CLOSE` y devuelve la limitación. Nunca mezclar bases en una simulación ni denominar «retorno total» un cálculo sin dividendos verificados.

Las compras usan `UNADJUSTED_CLOSE`. Si metadata confiable informa un split que afecte una posición y el dominio aún no lo soporta, la valoración se suspende con `CORPORATE_ACTION_UNSUPPORTED`.

## Errores

| Código                    | Significado                                                | Reintentable          |
| ------------------------- | ---------------------------------------------------------- | --------------------- |
| `INSTRUMENT_NOT_FOUND`    | ID desconocido                                             | no                    |
| `CURRENCY_MISMATCH`       | moneda inesperada                                          | no                    |
| `NO_MARKET_DATA`          | no existen observaciones                                   | no                    |
| `NO_MARKET_SESSION`       | ninguna sesión satisface la resolución                     | no                    |
| `INVALID_DATE_RANGE`      | inicio posterior a fin o fechas inválidas                  | no                    |
| `COVERAGE_INSUFFICIENT`   | dataset no cubre la solicitud                              | no                    |
| `UNSUPPORTED_PRICE_BASIS` | base no ofrecida                                           | no                    |
| `INVALID_PROVIDER_DATA`   | duplicados, moneda/base inconsistente o precio no positivo | no                    |
| `PROVIDER_UNAVAILABLE`    | timeout o falla temporal                                   | sí                    |
| `RATE_LIMITED`            | límite del proveedor                                       | sí, según retry-after |

Los adapters no traducen fallos a arrays vacíos cuando la diferencia afecte la interpretación.

## Adapter mock

Usa fixtures deterministas con `mode=demo`, providerId inequívoco y fechas fijas. Debe cubrir días hábiles, fin de semana, hueco de cobertura, decimales, precio faltante y bases no soportadas. La UI conserva la etiqueta demo mientras cualquier dato visible proceda de este adapter.

## Adapter de archivo real

Acepta un dataset normalizado y un manifiesto versionado que declare:

- nombre y URL de la fuente original;
- propietario/publicador y condiciones de uso verificadas;
- fecha de descarga y de corte;
- checksum criptográfico del archivo;
- instrumentos y cobertura;
- zona horaria, moneda, frecuencia y significado exacto de cada columna;
- definición de cierre o ajuste;
- transformaciones reproducibles y limitaciones.

El arranque falla si manifiesto, checksum o esquema no coinciden. No se incluye UI de importación en el MVP.

## Selección del proveedor real

La decisión está bloqueada. Para aceptar un candidato se exige:

1. acceso gratuito reproducible por API o archivo;
2. permiso de uso compatible con la demo;
3. muestra de acciones colombianas en COP;
4. cierres diarios con cobertura suficiente para los escenarios históricos;
5. metadata de fechas y definición de precio;
6. pruebas contractuales y registro de limitaciones.

Twelve Data es la primera candidata de evaluación porque documenta cobertura
de la Bolsa de Valores de Colombia (`XBOG`) y datos EOD, pero su acceso, costo y
condiciones de uso deben verificarse para la cuenta concreta. Los planes
personales pueden servir para uso educativo local, pero no autorizan por sí
solos la redistribución pública. La serie pública identificada de la
Superfinanciera describe precios promedio diarios y no puede etiquetarse como
cierre. Ninguna fuente se aprueba todavía; el detalle de la evaluación está en
[`slice-six-plan.md`](../delivery/slice-six-plan.md).

## Caché

El wrapper de caché conserva respuesta completa y metadata. TTL por defecto: 300 segundos para último precio y 86.400 para históricos. Archivos se invalidan por checksum. Errores no se cachean más allá de una protección breve definida al implementar; nunca provocan fallback silencioso a mock.
