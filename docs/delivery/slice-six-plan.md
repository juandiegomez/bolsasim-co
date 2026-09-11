# Plan de ejecución — Slice 6

**Estado:** aprobado para iniciar planificación y evaluación; implementación
pendiente
**Fecha:** 2026-09-10
**Dependencias:** Slices 0–5, ADR-0005, contrato de datos de mercado y
OpenAPI 3.1

## Objetivo

Cerrar los pendientes del MVP sin poner en riesgo la demo educativa:

1. determinar si existe una fuente autorizada de cierres diarios para acciones
   colombianas;
2. conservar una fuente demo reproducible mientras esa decisión se verifica;
3. completar la ruta dedicada de posiciones y su evidencia automatizada;
4. dejar documentados los límites que no deben confundirse con datos reales.

El usuario no necesita configurar una API para continuar usando el simulador en
clase.

## 6A — Evaluación y dataset real controlado

### Candidata inicial

Twelve Data documenta la Bolsa de Valores de Colombia con MIC `XBOG`, demora
EOD, un símbolo de Ecopetrol (`ECO`) y endpoints de precios diarios e histórico.
Esto la convierte en candidata técnica, no en proveedor aprobado. La cobertura
visible y el plan aplicable a la cuenta deben comprobarse antes de comprometer
el proyecto.

Fuentes de consulta:

- [Cobertura de Colombia en Twelve Data](https://twelvedata.com/exchanges/xbog?group=core)
- [Uso personal, educativo y comercial en Twelve Data](https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage)
- [Datos EOD y limitaciones de uso](https://support.twelvedata.com/en/articles/12682324-end-of-day-pricing-market-data)

### Orden de trabajo

1. Comprobar acceso de la cuenta a `XBOG` y a una muestra de al menos tres
   acciones colombianas activas en COP.
2. Solicitar o consultar fechas históricas suficientes para los escenarios del
   proyecto y verificar que el campo usado sea un cierre diario, no un promedio.
3. Registrar zona horaria, calendario de sesiones, moneda, base de precio,
   cobertura, límites, plan y condiciones de uso.
4. Convertir la muestra a `datasets/real` en el formato existente, con
   manifiesto, URL original, fecha de descarga, transformaciones y checksum.
5. Ejecutar la suite contractual del `MarketDataProvider` contra el dataset
   real y conservar `datasets/demo` como fixture de CI.
6. Actualizar ADR-0005 con una decisión `Accepted` solo si todos los criterios
   se cumplen. Si alguno falla, conservar el estado bloqueado y registrar la
   causa concreta.

### Límites explícitos

- El modo `demo` seguirá siendo el valor por defecto.
- No se hará scraping.
- No se pondrá una clave de proveedor en `NEXT_PUBLIC_*` ni en componentes de
  cliente.
- No se harán llamadas externas desde las pruebas deterministas.
- No se afirmará retorno total ni se incorporarán dividendos o splits mientras
  el dominio no los soporte.
- La ausencia, el límite o la inconsistencia del proveedor será un error
  explícito, nunca un array vacío, precio cero o fallback silencioso.

## 6B — Cierre de evidencia del MVP

### Trabajo incluido

- Implementar `GET /api/v1/portfolio/positions` usando la proyección existente.
- Mantener el contrato de posiciones consistente con `/portfolio`.
- Cubrir portafolio vacío, posición valorada, posición incompleta y error de
  mercado.
- Completar la evidencia de autoridad del servidor: los valores enviados por
  el cliente y las inconsistencias de datos persistidos no pueden convertirse
  en resultados financieros autoritativos silenciosamente.
- Añadir pruebas de contrato, integración y E2E.
- Actualizar OpenAPI, especificación de API, trazabilidad y evidencia del slice.
- Ejecutar format, lint, typecheck, tests unitarios, integración, contrato,
  E2E y build.

### Trabajo excluido

No se agregan ventas, nuevos instrumentos, autenticación, trading real,
backtesting avanzado ni una nueva ronda de diseño visual.

## Definition of Ready

- ADR-0005 y este plan son la referencia de la evaluación.
- La muestra y los símbolos a probar están identificados.
- El contrato de mercado y el esquema del dataset están disponibles.
- La ruta de posiciones ya está descrita en OpenAPI.
- Cada cambio tendrá IDs de requirement y pruebas esperadas.

## Definition of Done

- La decisión de fuente está aceptada con evidencia o permanece bloqueada con
  una razón verificable.
- El dataset real, si se acepta, tiene procedencia, condiciones y checksum.
- Demo y real están separados y etiquetados.
- La ruta de posiciones funciona sin duplicar reglas financieras.
- La trazabilidad distingue `implemented` de `verified`.
- Los gates aplicables pasan sin debilitar pruebas existentes.
