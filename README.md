# BolsaSim CO

MVP de un simulador educativo de inversiones con capital ficticio y foco
exclusivo en instrumentos `EQUITY` disponibles gratuitamente en mercados
validados. Su origen es colombiano, pero el MVP no es exclusivo de Colombia.
Permite administrar un portafolio y responder qué habría ocurrido con una
inversión histórica. No ejecuta operaciones reales, no custodia dinero y no
presta asesoría financiera.

## Estado

**Cierre actual (2026-09-11): MVP educativo listo para demo local.** Los Slices
0–6 están implementados y verificados para el alcance definido: usuario local,
capital ficticio, acciones `EQUITY`, compras simuladas, simulación histórica,
escenarios pedagógicos y datos reales locales de Twelve Data con actualización
automática al iniciar la demo. Esta declaración no implica tiempo real,
producción, autenticación, trading real ni redistribución de datos. Consulta el
[acta de cierre del MVP](docs/delivery/mvp-closure.md) para alcance, evidencia,
procedimiento de clase y límites aceptados.

El **Slice 0 — Foundation** está verificado: aplicación Next.js ejecutable, configuración validada, health check, PostgreSQL/Drizzle, migraciones, suite completa y CI en verde. El **Slice 1 — Inicialización y saldo** materializa el ledger append-only, la inicialización idempotente de COP 10.000.000 y el dashboard de saldo. El **Slice 2 — Explorar y detalle** materializa el puerto `MarketDataProvider` con dataset demo etiquetado, búsqueda paginada, detalle con último cierre, histórico gráfico/tabular y caché en proceso. El **Slice 3 — Compra y dashboard** materializa previews idempotentes de compra, posiciones valoradas, movimientos del ledger y evolución diaria con aviso de incompletos. El **Slice 4 — Simulación histórica** materializa el calculador sin persistencia, resolución direccional de fechas, API y pantalla independiente con serie, tabla, supuestos y procedencia. El **Slice 5 — Escenarios pedagógicos** materializa reinicio de prácticas, archivo y anulaciones append-only con explicaciones contextuales. El **Slice 6B** añade la ruta dedicada de posiciones y su evidencia; el **Slice 6A** tiene una fuente aceptada, un dataset real local normalizado y verificación contractual para una muestra Equity USD, sin exclusividad colombiana.

Decisiones iniciales:

- demo local para un único usuario, sin autenticación;
- monolito modular full-stack en TypeScript;
- Next.js, PostgreSQL, Drizzle, Zod y `decimal.js` materializados en el Slice 0;
- capital inicial único predeterminado de COP 10.000.000;
- solo acciones `EQUITY` activas del universo gratuito validado, compras
  fraccionarias, fees en cero y sin ventas en el MVP;
- cada portafolio usa una única moneda de liquidación; COP y el depósito inicial
  de COP 10.000.000 siguen como perfil predeterminado, sin conversión FX;
- FX, crypto, ETFs, renta fija, fondos, índices, dividendos y eventos
  corporativos permanecen fuera del MVP; los tipos extensibles del modelo son
  reservados para futuros requirements;
- datos reales gratuitos aceptados para la demo local mediante una muestra
  normalizada y no redistribuible;
- fixtures de demostración únicamente para desarrollo, CI y demos reproducibles.

## Documentación

- [Especificación de producto](docs/product/product-spec.md)
- [Arquitectura](docs/architecture/system-architecture.md)
- [Informe de tecnologías y dependencias](docs/architecture/technology-report.md)
- [Modelo de dominio](docs/domain/domain-model.md)
- [Especificación de API](docs/api/api-spec.md) y [OpenAPI](docs/api/openapi.yaml)
- [Contrato de datos de mercado](docs/data/market-data-contract.md)
- [Procedimiento de ingesta local de Twelve Data](docs/data/twelve-data-local-ingestion.md)
- [Estrategia de pruebas](docs/testing/test-strategy.md)
- [Trazabilidad](docs/requirements/traceability.md)
- [Vertical slices](docs/delivery/vertical-slices.md)
- [Acta de cierre del MVP](docs/delivery/mvp-closure.md)
- [ADR-0012 superseded de alcance de activos](docs/adr/0012-mvp-equity-scope.md)
- [ADR de universo gratuito de Equity](docs/adr/0013-mvp-equity-free-universe.md)
- [Evaluación de Fase 0 y riesgos](docs/fase0/phase-zero-assessment.md)
- [ADRs](docs/adr/)

## Ejecución local

Requisitos: **Node.js 24.11.1**, **npm 11.6.2**, Docker Engine/Desktop iniciado y Docker Compose v2. Las dependencias exactas están en `package.json` y `package-lock.json`. PostgreSQL 17 se ejecuta en contenedor.

Desde la raíz (PowerShell):

```powershell
npm ci
Copy-Item .env.example .env
npm run db:up
npm run db:check
npm run db:migrate
npm run dev
```

Si `.env` ya existe, consérvalo y revisa las variables en vez de sobrescribirlo. En Linux/macOS, usa `cp .env.example .env`. Abre [http://127.0.0.1:3000](http://127.0.0.1:3000). El servidor escucha solo en loopback. Para producción local: `npm run build` seguido de `npm run start`.

Health: [GET /api/v1/health](http://127.0.0.1:3000/api/v1/health). Devuelve `status=ok`, `service=bolsasim-co`, `requestId`, `X-Request-Id` y `Cache-Control: no-store`. Es liveness, no comprueba la base ni datos de mercado. El comando `db:check` verifica PostgreSQL por separado.

El portafolio expone `POST /api/v1/portfolios/initialize` (idempotente; crea usuario local, portafolio y el depósito inicial único de COP 10.000.000) y `GET /api/v1/portfolio` (snapshot derivado del ledger). La página inicial muestra los estados de carga, inicialización, saldo y error.

El mercado expone `GET /api/v1/instruments` (listado/búsqueda con cursor y límite), `GET /api/v1/instruments/{id}`, `/price` (último cierre) y `/history` (serie diaria). La simulación histórica usa `POST /api/v1/historical-simulations` y la pantalla independiente `/simulator`; no crea movimientos del ledger. La fuente activa es el dataset demo commiteado en `datasets/demo` (manifiesto con checksums); conmutar a `MARKET_DATA_ADAPTER=file` permite usar un dataset real local previamente normalizado. Para adquirirlo desde Twelve Data se requiere una cuenta y `TWELVE_DATA_API_KEY`; la clave solo se usa en el proceso local de consulta/normalización, nunca en el navegador. Los datos reales de Twelve Data no se commitean ni redistribuyen. El detalle en `/instruments` muestra metadata, último cierre e histórico gráfico/tabular con la etiqueta de modo `demo` o `real` correspondiente.

#### Dataset real local de Twelve Data

Con una `TWELVE_DATA_API_KEY` válida en `.env`, `npm run market:ingest` consulta
la muestra educativa `AAPL:NASDAQ`, `MSFT:NASDAQ` y `KO:NYSE`, y genera
`datasets/real` con manifiesto y checksums. `npm run market:verify` comprueba el
adaptador, metadata, cobertura, resolución de fechas y checksums. El directorio
real está ignorado por Git y sujeto a las condiciones de Twelve Data.

Para usarlo localmente en la aplicación, configura en `.env`:

```dotenv
MARKET_DATA_ADAPTER=file
MARKET_DATA_FILE_PATH=datasets/real
MARKET_DATA_MANIFEST_PATH=datasets/real/manifest.json
SETTLEMENT_CURRENCY=USD
INITIAL_DEPOSIT_AMOUNT=1000000.00
```

Para una clase o demo con datos reales, `npm run demo:start` intenta actualizar
el snapshot una vez por día antes de iniciar Next.js. Si Twelve Data no está
disponible, conserva el último snapshot válido y la aplicación arranca con su
fecha de corte visible. La actualización ocurre solo en el proceso local del
presentador; los estudiantes no necesitan la API key ni ejecutar comandos.
`MARKET_DATA_AUTO_REFRESH=false` desactiva este intento sin cambiar el resto de
la configuración.

Si el `.env` conserva el alias legado `INITIAL_DEPOSIT_COP`, elimínalo o
ajústalo al mismo importe: ambos valores no pueden discrepar.

El modo `mock`/dataset demo continúa siendo el valor predeterminado para CI,
desarrollo reproducible y clases que no requieran datos del proveedor.

La compra simulada expone `POST /api/v1/buy-previews` (preview de cinco minutos con cantidad, débito, remanente y fees cero) y `POST /api/v1/buy-previews/{previewId}/confirm` con header `Idempotency-Key` (201 primera vez, 200 en replay; 409 ante conflictos; 410 si venció). El portafolio expone además `GET /api/v1/portfolio/evolution` (evolución diaria con arrastre de cierre; rango máximo 365 días) y `GET /api/v1/portfolio/transactions` (ledger paginado). El dashboard muestra métricas, posiciones, movimientos y evolución; un valor incompleto nunca se representa como cero.

### Configuración y bases locales

`DATABASE_URL` es obligatoria. Una URL inválida, otra zona horaria, un LOG_LEVEL no admitido o valores inválidos de `DEMO_USER_ID`/`SETTLEMENT_CURRENCY`/`INITIAL_DEPOSIT_AMOUNT`/`MARKET_DATA_*` impiden el arranque con `CONFIGURATION_INVALID` y nombres de variables, sin imprimir valores. APP_TIME_ZONE tiene default America/Bogota, LOG_LEVEL default info, el perfil COP y su depósito inicial son el default actual, y las variables de usuario local y mercado tienen los defaults documentados en `.env.example`. La aplicación ya valida perfiles de liquidación no COP; `INITIAL_DEPOSIT_COP` se conserva como alias legado para archivos locales existentes, mientras perfiles no COP deben usar `SETTLEMENT_CURRENCY` e `INITIAL_DEPOSIT_AMOUNT`. El adapter de mercado es `mock` por defecto (dataset demo); `file` exige `MARKET_DATA_FILE_PATH` y `MARKET_DATA_MANIFEST_PATH`.

Compose publica solo en 127.0.0.1: desarrollo en 5432 (`bolsasim`, volumen persistente), tests en 5433 (`bolsasim_test`, almacenamiento temporal). Las contraseñas del ejemplo son exclusivamente locales. Los tests exigen TEST_DATABASE_URL con nombre terminado en `_test`; no usan la URL de desarrollo como fallback. Si los puertos están ocupados, modifica el mapeo y las URLs locales coherentemente.

`npm run db:migrate` aplica el journal de Drizzle: `0000_foundation` (placeholder sin negocio), `0001_ledger`, `0002_slice_three_buy` y `0003_youthful_martin_li` (ledger, compras, escenarios y anulaciones); `0004_repair_ledger_sequence` corrige bases locales creadas con una versión anterior de `0002`, reconstruyendo el orden append-only sin borrar movimientos. Repetirla no agrega registros. No hay migración automática al iniciar HTTP. `npm run db:create` crea la base objetivo si no existe (la usa CI para la base runtime de E2E) y `npm run db:generate` prepara las migraciones de esquemas futuros. No usar `push` como reemplazo de migraciones versionadas.

`npm run db:stop` detiene ambos contenedores y conserva el volumen de desarrollo. Una recreación del contenedor de tests pierde sus datos temporales. No eliminar el volumen de desarrollo como parte de tests o resets automáticos.

### Validaciones

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm test` ejecuta unitarias, integración PostgreSQL y contrato OpenAPI. También existen `test:unit`, `test:integration` y `test:contract` para diagnóstico. `test:e2e` inicia el build de producción en 127.0.0.1:3100, comprueba shell/teclado/responsive, HTTP, exploración de mercado y el flujo completo de compra, y detiene su servidor. El puerto debe estar libre. En Linux, instalar Chromium con `npx playwright install --with-deps chromium`. Para aislar el estado, E2E usa la base dedicada `E2E_DATABASE_URL` (cópiala desde `.env.example` con `db:create`); el `globalSetup` la migra y trunca al iniciar la suite, y la base de desarrollo nunca es mutada por pruebas.

`npm run format` aplica Prettier; `format:check` solo verifica. `lint` incluye ESLint y Redocly OpenAPI; `typecheck` genera los tipos de rutas de Next.js antes de ejecutar TypeScript. CI en `.github/workflows/ci.yml` usa PostgreSQL real y ejecuta estos gates desde `npm ci`.

Errores DB: `DATABASE_UNAVAILABLE` o `MIGRATION_FAILED` con exit code 1. Verifica `docker compose ps` y las URLs sin pegar secretos en issues/logs. La ausencia de Docker o PostgreSQL no se oculta omitiendo tests.

### Alcance y evidencia

Consulta [ADR-0009](docs/adr/0009-slice-zero-foundation.md) para package manager, liveness y migración sin esquema de negocio, [validación del Slice 0](docs/testing/slice-zero-validation.md), [Slice 1](docs/testing/slice-one-validation.md), [Slice 2](docs/testing/slice-two-validation.md), [Slice 3](docs/testing/slice-three-validation.md), [Slice 4](docs/testing/slice-four-validation.md), [Slice 5](docs/testing/slice-five-validation.md) y [Slice 6](docs/testing/slice-six-validation.md) para evidencia y límites. ADR-0005 acepta Twelve Data para ingesta local educativa; el dataset demo sigue por defecto y el dataset real se habilita solo de forma local mediante `MARKET_DATA_ADAPTER=file`.

## Disclaimer y limitaciones

BolsaSim CO es un prototipo educativo para aprender sobre activos financieros,
arquitectura de software y uso de IA. Utiliza capital ficticio, no ejecuta
operaciones reales, no custodia dinero y no constituye una recomendación ni
asesoría financiera. Los resultados históricos no garantizan resultados
futuros.

El funcionamiento depende de infraestructura, configuración y servicios
externos. En particular:

- La demo por defecto depende de Node.js 24.11.1, npm 11.6.2, Docker Compose,
  PostgreSQL 17, las variables de entorno y las dependencias fijadas en
  `package-lock.json`.
- El modo de datos reales depende de una cuenta Twelve Data con acceso al
  universo seleccionado, una `TWELVE_DATA_API_KEY`, límites de API, cobertura
  histórica, disponibilidad de red y condiciones de uso compatibles. La clave
  no debe compartirse, registrarse en logs, exponerse al cliente ni commitearse.
- La aplicación actual no consulta Twelve Data directamente en cada pantalla:
  usa el fixture `datasets/demo` por defecto o un dataset real local cargado
  mediante `MARKET_DATA_ADAPTER=file`. El dataset real debe conservar su
  procedencia, checksum y restricciones de licencia, y está excluido de Git.
- El MVP es local, de usuario único y sin autenticación. No implementa ventas,
  trading real, FX, crypto, ETFs, renta fija, fondos, índices, dividendos,
  eventos corporativos ni backtesting avanzado.
- Los datos `demo` son ficticios y deben conservar esa etiqueta. Una falla de
  mercado, cobertura, entitlement, base de precio o base de datos es una
  limitación explícita; no se reemplaza silenciosamente por un precio cero o
  por datos inventados.

El detalle de las tecnologías, rutas y dependencias está en el [informe de
tecnologías y dependencias](docs/architecture/technology-report.md).
