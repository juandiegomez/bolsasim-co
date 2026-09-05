# ADR-0009: alcance ejecutable del Slice 0

- **Estado:** Accepted — concreción de la solicitud de Fase 1
- **Fecha:** 2026-09-05
- **Requirements:** FND-001, SDD-001, FIN-001 (parcial), OBS-001 (parcial)

## Contexto y ambigüedades

La baseline aprobó Next.js/TypeScript, PostgreSQL/Drizzle, decimal.js, Zod, Vitest y Playwright. No fijó package manager ni versiones, ruta de salud o esquema del Slice 0. Crear ahora el ledger adelantaría el Slice 1. Los comandos npm existentes son la evidencia para fijar npm, sin comparar de nuevo frameworks.

## Decisión

- Node.js 24.11.1 y npm 11.6.2; dependencias exactas y package-lock.json. Usar `npm ci` para reproducir instalación.
- Next.js 16 y React 19, versiones exactas en package.json. ESLint, Prettier y TypeScript verifican calidad; Vitest prueba módulos, PostgreSQL y contrato HTTP; Playwright prueba el shell y HTTP reales. Recharts y herramientas de componentes se añaden cuando un slice las use.
- GET `/api/v1/health` comprueba liveness, sin acceder a base de datos o proveedor: `200 {status: "ok", service: "bolsasim-co", requestId}` y `Cache-Control: no-store`.
- `X-Request-Id` acepta de 1 a 128 caracteres ASCII alfanuméricos, guion, punto o guion bajo; inválido o ausente genera UUID. La respuesta propaga el ID; logs JSON y errores Problem no incluyen excepciones, URLs de conexión ni payloads sin filtrar.
- Validar al arrancar DATABASE_URL, APP_TIME_ZONE y LOG_LEVEL. DATABASE_URL es obligatoria y debe usar postgres/postgresql con host y base; APP_TIME_ZONE mantiene America/Bogota; LOG_LEVEL admite debug/info/warn/error. Las variables de negocio de `.env.example` quedan reservadas, sin consumidores del Slice 0.
- Pool `pg` con Drizzle, timeouts de conexión/consulta y cierre explícito en herramientas y tests. `db:check` verifica SELECT 1; migraciones explícitas, nunca automáticas al iniciar HTTP.
- Migración inicial `SELECT 1`: verifica el runner de Drizzle y su journal sin crear tablas especulativas. Solo Drizzle crea su tabla técnica de control. El esquema de negocio permanece vacío hasta Slice 1.
- Docker Compose ofrece PostgreSQL 17 para desarrollo y otra instancia/base separada para tests. Las pruebas exigen TEST_DATABASE_URL y nunca omiten integración por falta de servidor.
- Configurar decimal.js con 50 dígitos sin implementar Money, ledger ni motores. FIN-001 sigue parcial.
- CI reproduce install, format check, lint (incluye OpenAPI), typecheck, migraciones, pruebas y build; smoke E2E usa el build de producción. No seleccionar datos de mercado ni crear mocks innecesarios.

## Consecuencias y verificación

FND-001 se cumple con instalación limpia, arranque, errores de configuración sanitizados, HTTP real, conexión, migración repetible, tests y gates. OBS-001 y SDD-001 tienen evidencia local al Slice 0; no se infiere cumplimiento de rutas futuras. La ejecución remota de GitHub Actions se distingue de su configuración y reproducción local.

Fuentes técnicas consultadas: [instrumentation](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation), [entorno](https://nextjs.org/docs/pages/guides/environment-variables), [migraciones personalizadas](https://orm.drizzle.team/docs/kit-custom-migrations).

## Compatibilidad observada

La prueba de proceso mostró que Next.js 16.3.4 conserva el proceso abierto si solo falla `instrumentation.register`. Para cumplir fail-fast se valida también al cargar next.config.ts; instrumentation conserva validación y logging del servidor. `typecheck` y `build` cargan esta configuración y requieren las variables documentadas, aunque no conectan PostgreSQL.

`@next/env` se importa por default desde herramientas ESM para compatibilidad CommonJS. ESLint 9.39.5 satisface los peer ranges de los plugins React/JSX incluidos por Next.js; estos todavía no declaran ESLint 10. npm informa deprecación de ESLint 9, registrada para reevaluar cuando el conjunto de plugins soporte la siguiente versión.

`npm audit` informa cuatro avisos moderados en la cadena de desarrollo drizzle-kit → @esbuild-kit → esbuild (GHSA-67mh-4wv8-2f99). No se usa el servidor de esbuild ni Drizzle Studio; los comandos usan generación local y migración mediante ORM. No se fuerza el downgrade incompatible sugerido por npm ni se introduce una versión RC de Drizzle. Auditar esta dependencia al avanzar Slice 1; dependencias de producción se verifican por separado con `npm audit --omit=dev`.
