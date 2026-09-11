# ADR-0005: fuente de datos de mercado

- **Estado:** Accepted para demo educativa local no comercial y no productiva;
  no autorizado para redistribución o exhibición comercial
- **Fecha:** 2026-09-10
- **Alcance vigente:** [ADR-0013](0013-mvp-equity-free-universe.md)

## Contexto

El MVP exige precios reales gratuitos de instrumentos `EQUITY`. Deben ser
cierres diarios con procedencia y uso permitido. Los mocks no satisfacen
aceptación. El MVP ya no es exclusivo de Colombia; la cobertura colombiana fue
la primera hipótesis de evaluación, no una condición geográfica vigente. El
objetivo actual es una demo local, individual, pedagógica, no comercial y no
productiva para aprender a construir el simulador con IA y estudiar activos.

## Decisión

Mantener el contrato independiente, el adapter demo y el adapter de archivo
normalizado con manifiesto/checksum. Twelve Data queda seleccionada como fuente
para la evaluación e ingesta local controlada del alcance pedagógico vigente:
la cuenta evaluada tiene acceso técnico a tres Equity USD y la política oficial
de planes individuales incluye proyectos educativos y fases de desarrollo o
pruebas no productivas.

La ruta para la clase es obtener una muestra autorizada y convertirla al
dataset normalizado local del proyecto. No se hará que la aplicación dependa de
una llamada externa en cada pantalla ni se expondrá una clave en el navegador.
El modo `demo` seguirá siendo el predeterminado para desarrollo, pruebas y
clases reproducibles; el dataset real, cuando se genera, queda fuera del
control de versiones y se configura solo en la máquina autorizada.

La política oficial de Twelve Data declara aceptables los proyectos educativos
no comerciales y el desarrollo o pruebas no productivas para planes
individuales. No permite redistribuir los datos ni hacer exhibición comercial a
terceros. Esta ADR cubre la demo local pedagógica; cualquier repositorio con
datos reales, despliegue público, clase con distribución del dataset o uso
comercial requiere confirmación o licencia adicional. No se usará scraping.

## Consecuencias

El desarrollo determinista puede avanzar con datos demo. Los slices 2–4 no se
aceptan como MVP con mocks ni con promedios etiquetados como cierres. Para el
alcance local de esta ADR, la fuente queda aprobada técnicamente y la muestra
real local ya fue normalizada con checksum y verificada por los comandos
`npm run market:ingest` y `npm run market:verify`. El registro de evaluación y
sus criterios viven en
[`slice-six-plan.md`](../delivery/slice-six-plan.md).

Para activar una muestra real local debe existir evidencia de:

1. acceso reproducible para la cuenta y el alcance de la demo;
2. permiso de uso compatible con una clase local y, si aplica, con el modo de
   publicación previsto;
3. al menos tres acciones `EQUITY` activas accesibles sin plan pagado adicional,
   dentro de un perfil operable y con moneda explícita;
4. cierres diarios históricos suficientes para compra, evolución y simulación;
5. significado documentado de `UNADJUSTED_CLOSE`, fechas de sesión, zona
   horaria y limitaciones corporativas;
6. muestra normalizada, manifiesto, checksum y pruebas contractuales.

Los puntos 1–5 tienen evidencia para la muestra USD de la cuenta evaluada. El
punto 6 quedó completado localmente: `datasets/real` contiene la muestra
normalizada y su manifiesto con SHA-256, y `market:verify` ejercita el contrato
del adapter sin llamadas externas. `datasets/demo` continúa siendo la fuente
activa por defecto. Esta aceptación solo cubre la máquina o clase local
autorizada; no autoriza publicación ni redistribución de datos reales.

## Registro de evaluación pública — Slice 6A — 2026-09-11

La [página de cobertura de Colombia de Twelve Data](https://twelvedata.com/exchanges/xbog?group=core)
identifica `XBOG` como Colombia Stock Exchange, declara demora EOD, zona
horaria `America/New_York` y muestra `ECO` como símbolo de prueba. La
[documentación del endpoint EOD](https://support.twelvedata.com/en/articles/12682324-end-of-day-eod-pricing-market-data)
describe un cierre diario con fecha, exchange, MIC, moneda y `close`; la
[guía de uso histórico](https://support.twelvedata.com/en/articles/5214728-getting-historical-data)
documenta consultas por `start_date`/`end_date` y un máximo de 5.000 puntos por
solicitud.

Esta consulta pública no demuestra por sí sola acceso de una cuenta concreta a
la muestra mínima ni sustituye la revisión de condiciones de uso. La
[política de uso personal y comercial](https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage)
indica que los planes individuales permiten proyectos educativos y pruebas no
productivas, pero no redistribución ni exhibición comercial a terceros.

Resultado: para el alcance local pedagógico, Twelve Data queda aceptada como
fuente de evaluación e ingesta controlada. La muestra local quedó activada
mediante `market:ingest`/`market:verify`; el modo predeterminado no cambia.

## Registro de evaluación de cuenta — Slice 6A — 2026-09-11

Se evaluó una cuenta gratuita de Twelve Data sin registrar ni exponer su token.
El catálogo filtrado por `XBOG` devolvió instrumentos marcados como `BVC` con
`mic_code` `XBOG`, pero también mostró inconsistencias de clasificación, por
lo que el catálogo no se tomó como prueba suficiente de moneda o cobertura.

La consulta calificada `ECO:BVC` sí devolvió:

- `exchange`: `BVC`;
- `mic_code`: `XBOG`;
- `currency`: `COP`;
- `interval`: `1day`;
- 1.595 observaciones entre 2020-01-02 y 2026-09-09.

Las consultas calificadas de `BIC`, `ISA`, `GEB`, `CEL`, `ARG`, `ETB` y `BVC`
respondieron `404` con un mensaje del proveedor indicando disponibilidad desde
el plan Ultra o Enterprise. Esto demuestra que esas acciones colombianas no
forman parte del universo gratuito de la cuenta evaluada, pero no bloquea la
nueva política multi-mercado: aún falta evaluar otros mercados con `EQUITY`.

### Muestra global USD

La misma cuenta consultó `AAPL:NASDAQ`, `MSFT:NASDAQ` y `KO:NYSE` con
`interval=1day`, fechas `2020-01-01` a `2026-09-10` y `adjust=none`. Las tres
respuestas devolvieron USD, sus exchanges/MIC (`NASDAQ`/`XNGS` para las dos
primeras y `NYSE`/`XNYS` para la tercera), 1.680 observaciones entre
2020-01-02 y 2026-09-09, sin fechas duplicadas ni cierres inválidos. La
documentación de Twelve Data define [`adjust`](https://twelvedata.com/docs/discovery)
con los valores `all`, `splits`, `dividends` y `none`; por tanto, el smoke de
cuenta demuestra que la ruta técnica necesaria para solicitar la base
`UNADJUSTED_CLOSE` responde para una muestra Equity USD.

Esta evidencia resuelve la duda de cobertura y base de precio para la cuenta
evaluada, pero no autoriza por sí sola la publicación del dataset ni el cambio
del modo predeterminado. El plan Basic aparece documentado como de uso interno
no display y el uso individual no autoriza automáticamente redistribución o
exhibición pública. Debe confirmarse que el alcance real de BolsaSim (clase
local, demo compartida o publicación) es compatible con la licencia vigente.

Conclusión de cuenta: Twelve Data es técnicamente viable para un perfil Equity
USD y `UNADJUSTED_CLOSE`, y su uso encaja con el alcance local pedagógico
declarado. El dataset local con procedencia/checksum ya fue generado y
verificado; no se cambia el modo predeterminado y `datasets/demo` continúa
siendo la fuente activa por defecto. Los datos reales no se publican ni se
redistribuyen. La cobertura colombiana deja de ser un criterio obligatorio; el
alcance vigente está en
[ADR-0013](0013-mvp-equity-free-universe.md).
