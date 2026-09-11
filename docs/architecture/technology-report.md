# Informe de tecnologías y dependencias

**Proyecto:** BolsaSim CO
**Propósito:** prototipo educativo de un simulador de inversiones
**Fecha:** 2026-09-11
**Fuente de versiones:** `package.json`, `package-lock.json`, `compose.yaml` y
la configuración del repositorio

## Alcance del informe

Este documento explica qué tecnologías utiliza el proyecto, dónde se usan y
para qué sirven. No implica que todas las capacidades de una dependencia estén
habilitadas en el MVP. El alcance funcional sigue limitado a acciones
`EQUITY` activas, capital ficticio, compras simuladas y simulación histórica.

La aplicación es un monolito modular local:

```text
Navegador
  -> Next.js / React / UI
  -> route handlers HTTP + Zod
  -> casos de uso
  -> dominio financiero exacto
  -> PostgreSQL/Drizzle       (ledger y configuración operativa)
  -> MarketDataProvider        (dataset demo o archivo real local)

Twelve Data + API key
  -> consulta/normalización local
  -> dataset real excluido de Git
```

La API key de Twelve Data no es una dependencia necesaria para ejecutar la demo
por defecto: `MARKET_DATA_ADAPTER=mock` usa `datasets/demo`. La key se requiere
para adquirir o validar datos reales localmente y nunca debe llegar al cliente,
al repositorio ni a los logs.

## Runtime y plataforma

| Tecnología o dependencia | Versión fijada      | Dónde se usa                                 | Para qué se usa y límite                                                                                                                   |
| ------------------------ | ------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Node.js                  | `24.11.1` requerida | Runtime, scripts y tooling                   | Ejecuta Next.js, pruebas y comandos del proyecto.                                                                                          |
| npm                      | `11.6.2` requerida  | Instalación y scripts                        | Instala dependencias con `npm ci`; `package-lock.json` fija el árbol.                                                                      |
| TypeScript               | `5.9.3`             | `src/`, `tests/`, `scripts/`, configuración  | Tipado estricto de dominio, casos de uso, adapters, UI y pruebas.                                                                          |
| Next.js                  | `16.3.4`            | `src/app/`, `src/proxy.ts`, `next.config.ts` | Framework full-stack: páginas, route handlers HTTP, build y servidor local.                                                                |
| React                    | `19.2.8`            | `src/components/`, páginas Next.js           | Componentes interactivos de exploración, detalle, simulador y dashboard.                                                                   |
| `react-dom`              | `19.2.8`            | Integración Next.js/React                    | Renderizado de la interfaz React.                                                                                                          |
| Docker Compose           | v2 requerida        | `compose.yaml`                               | Levanta PostgreSQL de desarrollo y una instancia/base separada para tests.                                                                 |
| PostgreSQL               | `17` en contenedor  | Persistencia local                           | Guarda usuarios locales, portafolios, ledger, previews e idempotencia. No se reemplaza por una base en memoria en pruebas transaccionales. |

## Backend, dominio y persistencia

| Tecnología o dependencia | Versión fijada | Dónde se usa                                       | Para qué se usa y límite                                                                |
| ------------------------ | -------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `pg`                     | `8.23.0`       | `src/infrastructure/database/client.ts`            | Driver PostgreSQL, pool, timeouts y conexiones reales.                                  |
| Drizzle ORM              | `0.45.2`       | `src/infrastructure/database/`                     | Consultas tipadas, transacciones, bloqueo del portafolio y acceso al ledger.            |
| Drizzle Kit              | `0.31.10`      | `drizzle.config.ts`, `drizzle/`, scripts           | Genera y ejecuta migraciones versionadas. No se usa `push` como sustituto.              |
| `decimal.js`             | `10.6.0`       | `src/domain/decimal.ts`, `money.ts`, `quantity.ts` | Aritmética decimal exacta; evita `number`, `float` y `double` para valores financieros. |
| Zod                      | `4.5.4`        | `src/infrastructure/config/`, handlers HTTP        | Valida entorno y payloads en la frontera. El dominio vuelve a validar invariantes.      |
| `@next/env`              | `16.3.4`       | Configuración, scripts y tests                     | Carga `.env` de forma consistente fuera y dentro del runtime Next.js.                   |
| `tsx`                    | `4.23.13`      | `scripts/database.ts` y comandos                   | Ejecuta herramientas TypeScript como `db:check` y `db:migrate`.                         |

Los scripts `scripts/ingest-twelve-data.ts` y
`scripts/verify-market-dataset.ts` automatizan, respectivamente, la consulta
local con la API key y la comprobación del dataset real ya normalizado.
`scripts/start-demo.ts`, expuesto como `npm run demo:start`, intenta esa
actualización una vez por día antes de iniciar Next.js y conserva el último
snapshot si el proveedor no está disponible. La ingesta no forma parte del
request path de Next.js.

## Tipado y resolución del árbol npm

| Dependencia           | Versión fijada | Uso                                                                                                                                               |
| --------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@types/node`         | `24.13.3`      | Tipos de Node.js para scripts, runtime y APIs del servidor.                                                                                       |
| `@types/pg`           | `8.23.1`       | Tipos del driver PostgreSQL.                                                                                                                      |
| `@types/react`        | `19.2.18`      | Tipos de componentes, props y JSX de React.                                                                                                       |
| `@types/react-dom`    | `19.2.7`       | Tipos de integración de React DOM.                                                                                                                |
| Override de `esbuild` | `0.25.12`      | Corrige la versión transitiva usada por `drizzle-kit` mediante `package.json`; forma parte de la mitigación de seguridad documentada en ADR-0009. |

Las reglas financieras viven en `src/domain/`: dinero, cantidades, precios,
transacciones, proyecciones, compras y simulaciones. `src/application/`
coordina casos de uso y puertos. `src/infrastructure/` implementa PostgreSQL,
mercado, caché, reloj, identidad local y logging. `src/app/` y
`src/components/` son la superficie HTTP y visual. Las dependencias apuntan
hacia dentro; el dominio no importa Next.js, Drizzle, Zod HTTP ni Twelve Data.

## Mercado y visualización

| Tecnología o dependencia | Versión fijada                                | Dónde se usa                                                | Para qué se usa y límite                                                                                                                                                        |
| ------------------------ | --------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Twelve Data              | Servicio externo; versión de API según cuenta | Proceso local de evaluación/ingesta documentado en ADR-0005 | Proporciona históricos EOD para la muestra Equity autorizada. Requiere cuenta, `TWELVE_DATA_API_KEY`, cuotas, red y entitlement. No hay una llamada directa desde la UI actual. |
| `MarketDataProvider`     | Puerto del proyecto                           | `src/application/ports/market-data-provider.ts`             | Aísla el dominio de Twelve Data, archivos o fixtures. Obliga a metadata, moneda, sesiones, base de precio y errores explícitos.                                                 |
| Adapter de archivo       | Código propio                                 | `src/infrastructure/market/file-dataset-provider.ts`        | Valida manifiesto, checksum SHA-256, moneda, fechas, precios y base. Carga `datasets/demo` o un dataset real local.                                                             |
| Caché en proceso         | Código propio                                 | `src/infrastructure/market/cache/`                          | TTL de último precio e históricos; no usa Redis y no hace fallback silencioso entre fuentes.                                                                                    |
| Recharts                 | `3.10.1`                                      | `src/components/`, históricos y dashboard                   | Gráficas de precios, simulación y evolución. No calcula reglas financieras ni valores autoritativos.                                                                            |

El tipo de activo habilitado es únicamente `EQUITY`. El portafolio mantiene una
sola moneda de liquidación; COP es el perfil predeterminado y USD u otra moneda
requiere configuración compatible. FX, crypto, ETFs, renta fija, fondos,
índices, dividendos y otros eventos corporativos no están implementados.

## Calidad, contratos y pruebas

| Tecnología o dependencia | Versión fijada      | Dónde se usa                                           | Para qué se usa y límite                                                                |
| ------------------------ | ------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Vitest                   | `5.0.0`             | `tests/unit/`, `tests/integration/`, `tests/contract/` | Pruebas unitarias, integración con PostgreSQL y contratos HTTP.                         |
| Playwright               | `1.63.0`            | `tests/e2e/`                                           | Pruebas E2E contra el build real de Next.js y Chromium. Requiere instalar el navegador. |
| Ajv                      | `8.20.0`            | Tests de contrato                                      | Valida respuestas HTTP contra los schemas publicados en OpenAPI.                        |
| `ajv-formats`            | `3.0.0`             | Tests de contrato                                      | Añade validadores de formatos usados por OpenAPI.                                       |
| YAML                     | `2.9.0`             | Tests de contrato                                      | Lee `docs/api/openapi.yaml` para compilar los contratos.                                |
| Redocly CLI              | `2.51.2`            | `npm run lint:api`                                     | Comprueba que el documento OpenAPI sea válido.                                          |
| ESLint                   | `9.39.5`            | `eslint.config.mjs`, `npm run lint`                    | Reglas estáticas para TypeScript, React y Next.js.                                      |
| `eslint-config-next`     | `16.3.4`            | Configuración ESLint                                   | Reglas específicas de Next.js y React.                                                  |
| Prettier                 | `3.9.6`             | `npm run format` y `format:check`                      | Formato consistente de código y documentación.                                          |
| TypeScript route typegen | incluido en Next.js | `npm run typecheck`                                    | Genera y verifica tipos de rutas antes de `tsc --noEmit`.                               |

La suite exige PostgreSQL real para integración, una base terminada en `_test`
para `TEST_DATABASE_URL` y una base dedicada para E2E. No se omiten pruebas
porque falte infraestructura.

## Automatización y control de cambios

| Tecnología o dependencia | Dónde se usa               | Para qué se usa                                                                             |
| ------------------------ | -------------------------- | ------------------------------------------------------------------------------------------- |
| GitHub Actions           | `.github/workflows/ci.yml` | Ejecuta instalación, formato, lint, typecheck, PostgreSQL, migraciones, tests, build y E2E. |
| `package-lock.json`      | raíz del repo              | Reproduce versiones directas y transitivas instaladas por npm.                              |
| Migraciones Drizzle      | `drizzle/`                 | Versionan la evolución de esquema y se aplican explícitamente.                              |
| `.env` / `.env.example`  | raíz del repo              | Configuración local y plantilla sin secretos reales. `.env` está ignorado por Git.          |

## Dependencias operativas externas

La ejecución local depende de lo siguiente, además de los paquetes npm:

1. Node.js y npm en las versiones indicadas.
2. Docker Engine/Desktop y Docker Compose para PostgreSQL 17.
3. Variables `DATABASE_URL`, `TEST_DATABASE_URL` y, para E2E, una base
   `E2E_DATABASE_URL` dedicada.
4. Para datos reales: cuenta Twelve Data, `TWELVE_DATA_API_KEY`, acceso al
   símbolo y al histórico, cuota de API, conexión de red y condiciones de uso
   compatibles con una demo educativa local.
5. Para E2E: Chromium instalado con `npx playwright install chromium`.
6. Para instalación o consultas externas: conexión al registro npm o al API
   del proveedor correspondiente.

La demo puede ejecutarse sin la dependencia externa de Twelve Data utilizando
el adapter `mock` y los datos ficticios versionados de `datasets/demo`.

## Límites de seguridad y uso

- La API key nunca se coloca en `NEXT_PUBLIC_*`, componentes de cliente,
  commits, issues ni logs.
- Los datos reales de Twelve Data se generan y conservan localmente; el
  directorio `datasets/real/` está excluido de Git y no debe redistribuirse.
- La cuenta individual de Twelve Data se documenta para uso personal/interno,
  educativo no comercial y desarrollo o pruebas no productivas. La publicación,
  redistribución o exhibición comercial requiere autorización adicional.
- El proyecto no es un broker, asesor, custodio ni sistema de trading real.
  Las compras son simulaciones con capital ficticio.

Las decisiones de arquitectura y las excepciones están en
[`docs/adr/`](../adr/). La especificación funcional, los contratos y la
trazabilidad son la fuente de verdad por encima de esta explicación técnica.
