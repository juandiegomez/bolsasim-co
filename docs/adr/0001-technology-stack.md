# ADR-0001: stack TypeScript full-stack

- **Estado:** Accepted
- **Fecha:** 2026-09-05

## Contexto

El repositorio no tenía stack. El MVP requiere UI financiera, API tipada, PostgreSQL, gráficos y pruebas, pero no análisis científico avanzado.

## Decisión

Usar Next.js con TypeScript estricto, PostgreSQL, Drizzle, Zod, decimal.js, Vitest, Playwright y Recharts. Las versiones se validarán y fijarán al crear infraestructura.

Slice 0 fija las versiones compatibles en package.json/package-lock.json y npm en ADR-0009. `pg` es el driver PostgreSQL, `@next/env` mantiene la misma carga de entorno en scripts/tests y Next.js, `tsx` ejecuta herramientas TS, `drizzle-kit` genera migraciones, ESLint/Prettier verifican calidad. Redocly valida OpenAPI; YAML/Ajv/ajv-formats permiten probar las respuestas contra el contrato. Recharts y Testing Library/axe se incorporan cuando exista UI que los necesite.

Frente a Next.js + FastAPI, un solo lenguaje reduce contratos duplicados, tooling y despliegue. FastAPI aportaría `Decimal`, Pydantic y OpenAPI natural, pero añade un segundo runtime sin una necesidad Python actual.

## Consecuencias

La disciplina arquitectónica debe impedir que el monolito mezcle UI, HTTP y dominio. OpenAPI seguirá siendo contrato explícito. Si surge procesamiento cuantitativo que justifique Python, se evaluará mediante otro ADR.
