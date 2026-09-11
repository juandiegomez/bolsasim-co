# Evidencia de validación — Slice 4

Fecha: 2026-09-10. Requirements: HIST-001, HIST-002, HIST-003, FIN-001–003, MDATA-001–002, UI-001–002.

## Alcance verificado

- Calculador puro `calculateHistoricalInvestment` con `Decimal`, cantidad hacia abajo a 8 decimales, dinero a 2 decimales, remanente y retorno bruto.
- Caso de uso sin dependencias de persistencia: resuelve fechas mediante `MarketDataProvider` y obtiene una serie homogénea.
- `POST /api/v1/historical-simulations` validado contra OpenAPI, con Problems para rangos inválidos y cobertura insuficiente.
- Página `/simulator` con estados de carga, vacío, error y éxito, metadata de mercado, etiqueta demo, supuestos, gráfica y tabla.
- La simulación no crea ni modifica movimientos del ledger.

## Evidencia automatizada

| Gate                       | Resultado                                            |
| -------------------------- | ---------------------------------------------------- |
| `npm run format:check`     | aprobado                                             |
| `npm run lint`             | aprobado                                             |
| `npm run typecheck`        | aprobado                                             |
| `npm run test:unit`        | 13 archivos, 58 pruebas aprobadas                    |
| `npm run test:contract`    | 5 archivos, 24 pruebas aprobadas                     |
| `npm run test:integration` | aprobado en la suite existente                       |
| `npm run test:e2e`         | 16 pruebas aprobadas con `E2E_DATABASE_URL` dedicada |
| `npm run build`            | aprobado                                             |

## Limitación conocida

La evidencia automatizada de este slice usa el dataset determinista `demo`,
etiquetado en todas las superficies; no presenta el dataset demo como mercado
real. Desde el cierre del Slice 6, Twelve Data está aceptada para ingesta local
educativa y existe una muestra real normalizada fuera de Git, verificada por
`npm run market:verify`.
