# Plan de ejecución — Slice 6

**Estado:** Slice 6A y 6B implementados y validados para la demo educativa
local; Twelve Data tiene una muestra Equity USD normalizada y verificada;
arranque automático de demo verificado en local; publicación/redistribución
fuera de alcance
**Fecha:** 2026-09-11
**Dependencias:** Slices 0–5, ADR-0005, contrato de datos de mercado y
OpenAPI 3.1

## Objetivo

Cerrar los pendientes del MVP sin poner en riesgo la demo educativa:

1. determinar si existe una fuente autorizada de cierres diarios para
   instrumentos `EQUITY` accesibles gratuitamente, sin exclusividad de país;
2. conservar una fuente demo reproducible mientras esa decisión se verifica;
3. completar la ruta dedicada de posiciones y su evidencia automatizada;
4. dejar documentados los límites que no deben confundirse con datos reales.

El usuario no necesita configurar una API para continuar usando el simulador en
clase.

## Decisión de alcance

El Slice 6 admite únicamente instrumentos `EQUITY` activos del universo
gratuito validado del proveedor, sin exclusividad de país, exchange o MIC.
`ETF`, renta fija, fondos, índices, pares FX, crypto, dividendos, splits y
otros eventos corporativos quedan fuera del MVP y requieren requirements,
contratos, reglas financieras, ADRs y pruebas propios.

Cada portafolio conserva una única moneda de liquidación explícita. COP y el
depósito inicial de COP 10.000.000 siguen como perfil predeterminado por
compatibilidad, pero no definen el país del MVP. Una Equity en otra moneda
requiere un perfil compatible; no se mezclan monedas ni se hace conversión FX.

Los tipos adicionales que aparecen en el modelo o OpenAPI son extensibles y
reservados; no son capacidades habilitadas. La decisión vigente está registrada
en [ADR-0013](../adr/0013-mvp-equity-free-universe.md), que supersede el
alcance geográfico de ADR-0012.

## 6A — Evaluación y dataset real controlado

### Candidata inicial

Twelve Data documenta múltiples mercados, demora EOD y endpoints de precios
diarios e histórico. La cuenta evaluada ya demostró una muestra técnica de tres
Equity USD con `adjust=none`. La fuente queda aceptada para la demo educativa
local, no productiva y no comercial; su uso público o redistribución no está
aprobado.

Fuentes de consulta:

- [Cobertura de mercados de Twelve Data](https://twelvedata.com/exchanges?level=overview)
- [Cobertura de Colombia en Twelve Data](https://twelvedata.com/exchanges/xbog?group=core)
- [Planes y límites de Twelve Data](https://twelvedata.com/pricing)
- [Uso personal, educativo y comercial en Twelve Data](https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage)
- [Datos EOD y limitaciones de uso](https://support.twelvedata.com/en/articles/12682324-end-of-day-eod-pricing-market-data)

### Orden de trabajo

1. Comprobar acceso de la cuenta a una muestra de al menos tres acciones
   `EQUITY` activas accesibles sin plan pagado adicional, preferiblemente dentro
   de un mismo perfil de moneda. La muestra puede pertenecer a cualquier país
   o exchange.
2. Solicitar o consultar fechas históricas suficientes para los escenarios del
   proyecto y verificar que el campo usado sea un cierre diario, no un promedio.
3. Registrar zona horaria, calendario de sesiones, moneda, base de precio,
   cobertura, límites, plan y condiciones de uso.
4. Usar el perfil de moneda de liquidación ya implementado para operar la
   muestra, conservando COP como valor predeterminado y sin agregar FX.
5. Convertir la muestra a `datasets/real` en el formato existente, con
   manifiesto, URL original, fecha de descarga, transformaciones y checksum.
6. Ejecutar `npm run market:verify`, que verifica el contrato del
   `MarketDataProvider` contra el dataset real local, y conservar `datasets/demo`
   como fixture de CI.
7. Mantener ADR-0005 aceptada para el alcance local. Si se pretende publicar,
   redistribuir o comercializar, detener esa ampliación y registrar la licencia
   adicional requerida.

### Resultado de la cuenta evaluada — 2026-09-11

La cuenta gratuita consultó `ECO:BVC` correctamente: `BVC`, `XBOG`, `COP`,
`1day`, 1.595 observaciones entre 2020-01-02 y 2026-09-09. Las consultas de
`BIC:BVC`, `ISA:BVC`, `GEB:BVC`, `CEL:BVC`, `ARG:BVC`, `ETB:BVC` y `BVC:BVC`
respondieron `404` indicando disponibilidad desde Ultra o Enterprise. Esto deja
esas acciones fuera del universo gratuito evaluado, pero ya no es un criterio
obligatorio.

La muestra global ya fue comprobada en la misma cuenta con `AAPL:NASDAQ`,
`MSFT:NASDAQ` y `KO:NYSE`. Con `interval=1day`, `adjust=none` y el rango
2020-01-01 a 2026-09-10, cada símbolo devolvió USD, 1.680 sesiones entre
2020-01-02 y 2026-09-09, sin fechas duplicadas ni cierres inválidos. Esto
demuestra cobertura técnica suficiente en un perfil USD y permite continuar
sin exigir instrumentos colombianos.

La prueba cierra el acceso técnico de 6A para la demo local: el uso educativo
no comercial y no productivo está contemplado por la política de planes
individuales. `npm run market:ingest` conserva la procedencia y transforma los
cierres `adjust=none` al formato normalizado; `npm run market:verify` valida
manifiesto, checksum y operaciones del adapter. La redistribución o exhibición
comercial requiere autorización adicional. `datasets/demo` continúa siendo la
fuente activa por defecto.

### Límites explícitos

- El modo `demo` seguirá siendo el valor por defecto.
- No se hará scraping.
- No se pondrá una clave de proveedor en `NEXT_PUBLIC_*` ni en componentes de
  cliente.
- No se harán llamadas externas desde las pruebas deterministas.
- No se afirmará retorno total ni se incorporarán dividendos o splits mientras
  el dominio no los soporte.
- No se agregarán FX, crypto, ETFs ni otros instrumentos como workaround; la
  apertura vigente es geográfica y se limita a `EQUITY`.
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

No se agregan ventas, instrumentos distintos de `EQUITY`, FX, crypto,
dividendos, autenticación, trading real, backtesting avanzado ni una nueva
ronda de diseño visual.

## Definition of Ready

- ADR-0005 y este plan son la referencia de la evaluación.
- La muestra y los símbolos a probar están identificados.
- El contrato de mercado y el esquema del dataset están disponibles.
- La ruta de posiciones ya está descrita en OpenAPI.
- Cada cambio tendrá IDs de requirement y pruebas esperadas.

## Definition of Done

- La decisión de fuente está aceptada para el alcance local con evidencia de
  acceso, condiciones y límites.
- La evidencia de acceso debe demostrar al menos tres `EQUITY` gratuitas en un
  perfil de moneda operable; no exige que sean colombianas.
- El dataset real local tiene procedencia, condiciones y checksum.
- Demo y real están separados y etiquetados.
- La ruta de posiciones funciona sin duplicar reglas financieras.
- La trazabilidad distingue `implemented` de `verified`.
- Los gates aplicables pasan sin debilitar pruebas existentes.
