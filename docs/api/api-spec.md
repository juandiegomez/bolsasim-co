# Especificación de API

**Contrato normativo:** [`openapi.yaml`](openapi.yaml)  
**Versión:** `v1`  
**Estado:** aprobado para implementación inicial

## Convenciones

- Base local: `/api/v1`.
- JSON UTF-8; fechas de mercado `YYYY-MM-DD`; instantes ISO-8601 UTC.
- Dinero, precios, cantidades y porcentajes se transportan como strings decimales.
- Cada respuesta incluye `X-Request-Id`. El cliente puede enviarlo; el servidor valida el formato o genera uno.
- Errores usan `Problem` con `code`, `message`, `requestId` y detalles seguros opcionales.
- Listados usan cursor opaco y `nextCursor`; `limit` por defecto 20 y máximo 100.
- `Idempotency-Key` es obligatorio al confirmar compra, máximo 128 caracteres.

El alcance operativo vigente de `v1` es `EQUITY` activa con acceso gratuito
validado, sin exclusividad geográfica. Cada portafolio tiene una única moneda
de liquidación y el monto de una compra debe coincidir con ella; el perfil COP
es el predeterminado y no se hace conversión FX. Los tipos adicionales que
puedan aparecer en el modelo o en esquemas extensibles no son operables. FX,
crypto, ETFs, renta fija, fondos, índices, dividendos y eventos corporativos
requieren una versión documental y contractual propia.

## Recursos y operaciones

En Slice 0 solo está en alcance `GET /api/v1/health`: liveness sin I/O externo. Devuelve 200 con `status=ok`, `service=bolsasim-co`, `requestId`, `X-Request-Id` y `Cache-Control: no-store`. No acredita disponibilidad de PostgreSQL; usar `npm run db:check`. Error inesperado: 500 Problem con `code=INTERNAL_ERROR`, mensaje seguro y mismo requestId. ADR-0009 define validación del ID. El resto del contrato sigue especificado para slices posteriores.

| Método | Ruta                                | Requirement   | Comportamiento                                          |
| ------ | ----------------------------------- | ------------- | ------------------------------------------------------- |
| POST   | `/portfolios/initialize`            | PORT-001      | crea idempotentemente usuario/portafolio/depósito local |
| GET    | `/portfolio`                        | PORT-002/004  | snapshot actual y estado de valoración                  |
| GET    | `/portfolio/positions`              | PORT-004      | posiciones derivadas                                    |
| GET    | `/portfolio/evolution`              | PORT-005      | serie diaria fechada                                    |
| GET    | `/portfolio/transactions`           | PORT-002      | ledger paginado                                         |
| GET    | `/instruments`                      | INST-001      | lista/búsqueda paginada                                 |
| GET    | `/instruments/{id}`                 | INST-001      | metadata del instrumento                                |
| GET    | `/instruments/{id}/price`           | MDATA-001     | último cierre                                           |
| GET    | `/instruments/{id}/history`         | MDATA-001/002 | serie inclusiva                                         |
| POST   | `/buy-previews`                     | PORT-003      | calcula preview por cinco minutos                       |
| POST   | `/buy-previews/{id}/confirm`        | PORT-003      | confirma atómica e idempotentemente                     |
| POST   | `/historical-simulations`           | HIST-001–003  | calcula sin persistencia ni efecto en ledger            |
| GET    | `/scenarios`                        | PED-001       | lista prácticas activas y archivadas                    |
| POST   | `/scenarios/reset`                  | PED-001       | archiva la práctica activa y crea otra                  |
| POST   | `/portfolio/transactions/{id}/void` | PED-002       | registra `VOID_BUY` sin borrar el `BUY` original        |

## Autoridad y consistencia

El cliente solo aporta instrumento, monto, fechas e intención de confirmación. El servidor obtiene el precio, calcula cantidad/importes, lee el saldo y aplica la transacción. La confirmación usa la preview almacenada: no acepta precio ni cantidad en el body. Ante repetición de la misma clave y operación devuelve el resultado original; misma clave con intención diferente retorna `409 IDEMPOTENCY_CONFLICT`.

Ejemplo de preview en el perfil predeterminado: `{"instrumentId":"11111111-1111-1111-1111-111111111111","amount":{"amount":"2000000.00","currency":"COP"}}`. La respuesta devuelve strings decimales, por ejemplo `quantity: "800.00000000"`, junto con precio, fecha de sesión, fuente, remanente, fees y vencimiento. Ninguno de esos resultados calculados se reenvía para confirmar. Un perfil con otra moneda debe enviar esa moneda de forma explícita y no puede mezclarla con COP.

Ejemplo histórico: un monto `1000000.00`, precio inicial `100.00000000` y final `120.00000000` produce cantidad `10000.00000000`, valor final `1200000.00`, P&L `200000.00` y retorno `20.00`, sujeto a las fechas efectivas y base indicadas en la respuesta.

Una anulación conserva el `BUY` y agrega un movimiento `VOID_BUY` con
`reversalOfTransactionId`. El snapshot actual excluye la compra anulada. La
evolución diaria la incluye antes de la fecha efectiva del `VOID_BUY` y la
excluye desde esa fecha en adelante.

## Errores HTTP

- `400`: formato, escala, rango o parámetro inválido.
- `404`: recurso o instrumento inexistente.
- `409`: fondos, moneda/estado, idempotencia o preview consumida.
- `410`: preview vencida.
- `422`: solicitud válida sintácticamente que viola una regla financiera.
- `429`: límite del proveedor.
- `502/503`: datos inválidos o proveedor indisponible.
- `500`: error inesperado sin detalles internos.

La ausencia legítima de resultados de búsqueda devuelve `200` con `items=[]`; la ausencia inesperada de precios devuelve un Problem.

## Compatibilidad

Cambios incompatibles requieren una nueva versión de API y ADR. Agregar campos opcionales es compatible si no cambia semántica. El OpenAPI se valida en CI cuando exista tooling y genera o verifica tipos de frontera; los tipos generados no entran al dominio.
