# BolsaSim CO

MVP de un simulador educativo de inversiones orientado al mercado colombiano. Permite administrar un portafolio con capital ficticio y responder qué habría ocurrido con una inversión histórica. No ejecuta operaciones reales, no custodia dinero y no presta asesoría financiera.

## Estado

El **Slice 0 — Foundation** está verificado: aplicación Next.js ejecutable, configuración validada, health check, PostgreSQL/Drizzle, migraciones, suite completa y CI en verde. El **Slice 1 — Inicialización y saldo** materializa el ledger append-only, la inicialización idempotente de COP 10.000.000 y el dashboard de saldo. Compras, mercado e histórico todavía no están implementados; no hay proveedor de mercado aprobado (ADR-0005).

Decisiones iniciales:

- demo local para un único usuario, sin autenticación;
- monolito modular full-stack en TypeScript;
- Next.js, PostgreSQL, Drizzle, Zod y `decimal.js` materializados en el Slice 0;
- capital inicial único de COP 10.000.000;
- acciones en COP, compras fraccionarias, fees en cero y sin ventas en el MVP;
- datos reales gratuitos obligatorios para aceptar el MVP;
- fixtures de demostración únicamente para desarrollo, CI y demos reproducibles.

## Documentación

- [Especificación de producto](docs/product/product-spec.md)
- [Arquitectura](docs/architecture/system-architecture.md)
- [Modelo de dominio](docs/domain/domain-model.md)
- [Especificación de API](docs/api/api-spec.md) y [OpenAPI](docs/api/openapi.yaml)
- [Contrato de datos de mercado](docs/data/market-data-contract.md)
- [Estrategia de pruebas](docs/testing/test-strategy.md)
- [Trazabilidad](docs/requirements/traceability.md)
- [Vertical slices](docs/delivery/vertical-slices.md)
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

### Configuración y bases locales

`DATABASE_URL` es obligatoria. Una URL inválida, otra zona horaria, un LOG_LEVEL no admitido o valores inválidos de `DEMO_USER_ID`/`INITIAL_DEPOSIT_COP` impiden el arranque con `CONFIGURATION_INVALID` y nombres de variables, sin imprimir valores. APP_TIME_ZONE tiene default America/Bogota, LOG_LEVEL default info, y las variables de depósito y usuario local tienen los defaults documentados en `.env.example`. Las variables de mercado están reservadas y no activan funcionalidades.

Compose publica solo en 127.0.0.1: desarrollo en 5432 (`bolsasim`, volumen persistente), tests en 5433 (`bolsasim_test`, almacenamiento temporal). Las contraseñas del ejemplo son exclusivamente locales. Los tests exigen TEST_DATABASE_URL con nombre terminado en `_test`; no usan la URL de desarrollo como fallback. Si los puertos están ocupados, modifica el mapeo y las URLs locales coherentemente.

`npm run db:migrate` aplica el journal de Drizzle: `0000_foundation` (placeholder sin negocio) y `0001_ledger` (tablas `users`, `portfolios`, `transactions` con los índices de ADR-0003); repetirla no agrega registros. No hay migración automática al iniciar HTTP. `npm run db:create` crea la base objetivo si no existe (la usa CI para la base runtime de E2E) y `npm run db:generate` prepara las migraciones de esquemas futuros. No usar `push` como reemplazo de migraciones versionadas.

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

`npm test` ejecuta unitarias, integración PostgreSQL y contrato OpenAPI. También existen `test:unit`, `test:integration` y `test:contract` para diagnóstico. `test:e2e` inicia el build de producción en 127.0.0.1:3100, comprueba shell/teclado/responsive y HTTP, y detiene su servidor. El puerto debe estar libre. En Linux, instalar Chromium con `npx playwright install --with-deps chromium`.

`npm run format` aplica Prettier; `format:check` solo verifica. `lint` incluye ESLint y Redocly OpenAPI; `typecheck` genera los tipos de rutas de Next.js antes de ejecutar TypeScript. CI en `.github/workflows/ci.yml` usa PostgreSQL real y ejecuta estos gates desde `npm ci`.

Errores DB: `DATABASE_UNAVAILABLE` o `MIGRATION_FAILED` con exit code 1. Verifica `docker compose ps` y las URLs sin pegar secretos en issues/logs. La ausencia de Docker o PostgreSQL no se oculta omitiendo tests.

### Alcance y evidencia

Consulta [ADR-0009](docs/adr/0009-slice-zero-foundation.md) para package manager, liveness y migración sin esquema de negocio, [validación del Slice 0](docs/testing/slice-zero-validation.md) y [validación del Slice 1](docs/testing/slice-one-validation.md) para evidencia y límites. ADR-0005 permanece abierto; no bloquea la base ni el ledger.

## Aviso

BolsaSim CO utiliza capital ficticio. Sus resultados históricos no garantizan resultados futuros y la información presentada no constituye una recomendación ni asesoría financiera.
