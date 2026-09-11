# Evidencia de validación — Slice 6

Fecha: 2026-09-11. Requirements: PORT-004, PORT-005, MDATA-001–002,
SCOPE-001, FIN-004, SEC-001, UI-001–002, OBS-001, SDD-001. El alcance revisado es únicamente
`EQUITY` activa con acceso gratuito validado, sin exclusividad geográfica. Cada
portafolio conserva una única moneda de liquidación. Ver
[ADR-0013](../adr/0013-mvp-equity-free-universe.md).

## Alcance materializado — Slice 6B

- `GET /api/v1/portfolio/positions` devuelve una lista derivada del mismo
  snapshot autoritativo usado por el dashboard.
- El serializador de posiciones es compartido por `/portfolio`, compras,
  escenarios y la ruta dedicada; dinero, cantidades y precios continúan como
  strings decimales exactos.
- Se cubren portafolio vacío, múltiples compras agregadas, valoración completa,
  ausencia de mercado sin precio cero y ledger persistido inconsistente.
- La ausencia de mercado conserva `PRICE_UNAVAILABLE`, valores financieros
  nulos e instrumento `UNAVAILABLE`; los datos corruptos producen
  `CORRUPT_LEDGER` como `Problem` HTTP.
- La confirmación de compra vuelve a usar el proveedor de mercado en su
  snapshot de respuesta, manteniendo consistencia con `/portfolio` y la ruta
  de posiciones.
- Todas las respuestas conservan `X-Request-Id` y `Cache-Control: no-store`.

## Arranque de demo con actualización local

`npm run demo:start` compara el `cutoffDate` del manifiesto con la fecha del
mercado, intenta actualizar y verificar el dataset real como máximo una vez por
día y luego inicia Next.js. El ensayo local detectó el snapshot hasta
2026-09-09, lo actualizó a 1.681 observaciones por instrumento hasta 2026-09-10,
verificó checksums y sirvió el nuevo cierre por HTTP. Ante un fallo externo
conserva el snapshot anterior; no hace fallback silencioso a `mock` ni expone la
API key al navegador. Esta automatización no cambia las reglas financieras ni
el ledger.

## Evidencia automatizada

| Gate                                      | Resultado                                                  |
| ----------------------------------------- | ---------------------------------------------------------- |
| `npm run format:check`                    | aprobado                                                   |
| `npm run lint`                            | aprobado                                                   |
| `npm run typecheck`                       | aprobado                                                   |
| `npm run test:unit`                       | 15 archivos, 70 pruebas aprobadas                          |
| `npm run test:integration`                | 4 archivos, 24 pruebas aprobadas                           |
| `npm run test:contract`                   | 5 archivos, 27 pruebas aprobadas                           |
| `npm run build`                           | aprobado                                                   |
| `npm run test:e2e`                        | 20 pruebas aprobadas con base dedicada                     |
| `npm run db:check` / `npm run db:migrate` | aprobados                                                  |
| `npm run market:ingest`                   | 3 Equity USD, 5.043 observaciones locales                  |
| `npm run market:verify`                   | checksums, metadata, fechas e histórico aprobados          |
| `PORT=3101 npm run demo:start`            | actualización real, verificación y arranque aprobados      |
| Smoke HTTP con adapter `file`             | `/instruments` devolvió 3 símbolos USD con `dataMode=real` |

La ruta dedicada fue ejecutada de forma aislada y dentro de la suite E2E
completa después de corregir la dependencia de mercado del snapshot de
trading.

La base de desarrollo necesitaba `0004_repair_ledger_sequence`: su journal
registraba la migración de compras, pero faltaba físicamente esa columna por
haber sido creada con una versión anterior del SQL. La migración agrega la
secuencia, asigna un orden determinista a los movimientos existentes y deja el
default preparado para nuevos append; no elimina datos.

## Estado de Slice 6A

La evaluación pública confirma que Twelve Data documenta múltiples mercados,
demora EOD y endpoints de EOD y series históricas. En la cuenta evaluada,
`ECO:BVC` respondió con `BVC`/`XBOG`/`COP` y 1.595 observaciones, mientras que
`BIC`, `ISA`, `GEB`, `CEL`, `ARG`, `ETB` y `BVC` quedaron limitados a Ultra o
Enterprise. Esto deja esas acciones colombianas fuera del universo gratuito,
pero ya no es un criterio de aceptación.

La muestra global `AAPL:NASDAQ`, `MSFT:NASDAQ` y `KO:NYSE` sí respondió con
USD y metadata de mercado consistente. Cada serie entregó 1.680 sesiones entre
2020-01-02 y 2026-09-09, sin duplicados ni cierres inválidos, usando
`adjust=none`. La cuenta, por tanto, ya demuestra tres Equity gratuitas en un
perfil operable y una ruta técnica compatible con `UNADJUSTED_CLOSE`.

Para el alcance actual, la política de planes individuales contempla proyectos
educativos no comerciales y desarrollo o pruebas no productivas. La
redistribución y la exhibición comercial a terceros no están autorizadas. ADR-
0005 queda aceptada para la demo local. La muestra fue normalizada con
`npm run market:ingest` y verificada con `npm run market:verify`; el modo
predeterminado no cambia y `datasets/real` permanece fuera de Git.

## Estado de requirements específicos

- `FIN-004` quedó implementado y verificado para perfiles configurados: el
  perfil COP sigue siendo el default y un perfil como USD usa su propia moneda
  en depósito, preview, compra y proyección, sin conversiones.
- `SCOPE-001` queda implementado y verificado para el alcance local: la cuenta
  demuestra al menos tres `EQUITY` gratuitas de cualquier mercado, el dataset
  tiene histórico suficiente, procedencia y checksum, y `market:verify` valida
  el adapter sin fallback silencioso. El código no convierte la presencia del
  símbolo en el catálogo en aprobación automática.

## Límites conocidos

- No se implementan ventas, FX, dividendos, trading real ni backtesting
  avanzado; tampoco se habilitan ETFs, renta fija, fondos, índices ni otros
  tipos de instrumento. La apertura es geográfica y se limita a `EQUITY`.
- `CORPORATE_ACTION_UNSUPPORTED` continúa reservado.
- La cobertura técnica global, la base `adjust=none`, el dataset normalizado,
  sus checksums y la compatibilidad con el alcance educativo local tienen
  evidencia. El smoke real se ejecuta bajo demanda y no forma parte de CI ni
  realiza llamadas externas; no se autoriza redistribución ni exhibición
  comercial.
- Los gates se ejecutaron con Node `v23.11.0` y npm `10.9.2` disponibles en
  esta máquina; el repositorio exige Node `24.11.1` y npm `11.6.2`.
