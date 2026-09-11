# Ingesta local de Twelve Data

Este procedimiento materializa el alcance del Slice 6A: una muestra local,
educativa, no comercial y no productiva de tres acciones `EQUITY` en USD. No
convierte a Twelve Data en una dependencia de cada pantalla ni autoriza
publicar o redistribuir sus datos.

## Requisitos

- Cuenta de Twelve Data con acceso a la muestra evaluada.
- `TWELVE_DATA_API_KEY` en `.env` local. No debe estar en `NEXT_PUBLIC_*`, logs,
  commits o capturas compartidas.
- Node/npm y demás dependencias del proyecto instalados con `npm ci`.

## Generar y verificar

Desde la raíz del repositorio:

```text
npm run market:ingest
npm run market:verify
```

`market:ingest` carga `.env`, consulta `/time_series` una vez por símbolo con
`exchange`, `interval=1day`, rango `2020-01-01` a `2026-09-10` y `adjust=none`.
Valida respuesta, metadata, moneda USD, tipo Equity, fechas, cierres positivos,
unicidad y precisión decimal antes de escribir.

El resultado local es:

- `datasets/real/instruments.json`: instrumentos normalizados;
- `datasets/real/prices.json`: observaciones con `sessionDate`, `close` y
  moneda explícita;
- `datasets/real/manifest.json`: fuente, URL, fecha de descarga, fecha de
  corte, zona horaria, definición del precio, transformaciones, limitaciones y
  SHA-256 de cada archivo de datos.

El proveedor evaluado entregó `AAPL`, `MSFT` y `KO`, 1.680 sesiones por símbolo
entre 2020-01-02 y 2026-09-09, en USD y `America/New_York`. Los resultados pueden
cambiar si Twelve Data cambia cobertura, cuota, histórico, entitlement o
términos.

`market:verify` construye el adapter de archivo real y verifica la lista de
instrumentos activos, metadata `real`, provider `twelve-data-local`, checksums,
último precio, histórico de más de 1.000 sesiones y consulta `ON_OR_BEFORE`.
No realiza consultas externas.

## Activar la aplicación localmente

Después de una ingesta válida, `.env` puede seleccionar el dataset real:

```dotenv
MARKET_DATA_ADAPTER=file
MARKET_DATA_FILE_PATH=datasets/real
MARKET_DATA_MANIFEST_PATH=datasets/real/manifest.json
SETTLEMENT_CURRENCY=USD
INITIAL_DEPOSIT_AMOUNT=1000000.00
```

El modo demo continúa siendo el default para CI y desarrollo reproducible.
`datasets/real/` está excluido de Git intencionalmente. Si se copia el proyecto
a otro equipo autorizado, la ingesta debe repetirse con su propia cuenta y
clave; no se debe compartir el directorio generado como si fuera un fixture
del repositorio.

## Arranque automático para una clase

Con el dataset real ya generado y la clave en `.env`, el presentador puede
usar:

```text
npm run demo:start
```

El comando compara la fecha de corte del manifiesto con la fecha del mercado,
intenta una ingesta y verificación como máximo una vez por día y después inicia
Next.js. Si la red, la cuota o el acceso de Twelve Data fallan, conserva el
último snapshot local y permite continuar con la demo. No consulta el proveedor
desde el navegador, no cambia a `mock` silenciosamente y no requiere una clave
en los equipos de los estudiantes. El cierre nuevo solo aparece cuando Twelve
Data ya publicó la sesión diaria; si no existe, la fecha de corte anterior se
mantiene visible.
