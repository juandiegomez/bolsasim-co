# ADR-0005: fuente de datos de mercado

- **Estado:** Proposed — blocking; evaluación iniciada
- **Fecha:** 2026-09-10

## Contexto

El MVP exige precios reales gratuitos de acciones colombianas. Deben ser cierres diarios con procedencia y uso permitido. Los mocks no satisfacen aceptación.

## Decisión propuesta

Mantener el contrato independiente, el adapter demo y el adapter de archivo
normalizado con manifiesto/checksum. La primera candidata a evaluar es Twelve
Data: su documentación identifica la Bolsa de Valores de Colombia (`XBOG`),
datos EOD y símbolos colombianos. Esto es una pista técnica, no una aprobación:
la página de cobertura muestra restricciones de plan y el acceso, el costo y
las condiciones deben verificarse para la cuenta concreta.

La ruta preferida para la clase es obtener una muestra autorizada y convertirla
al dataset normalizado del proyecto. No se hará que la aplicación dependa de
una llamada externa en cada pantalla ni se expondrá una clave en el navegador.
El modo `demo` seguirá siendo el predeterminado para desarrollo, pruebas y
clases reproducibles.

El uso educativo local puede ser compatible con planes personales de Twelve
Data, pero esos planes no autorizan automáticamente la redistribución o la
exhibición pública a terceros. Si se pretende publicar la aplicación, se
requiere permiso o licencia compatible. Como alternativa, se investigará un
archivo autorizado directamente por la BVC; no se usará scraping.

## Consecuencias

El desarrollo determinista puede avanzar con datos demo. Los slices 2–4 no se
aceptan como MVP con mocks ni con promedios etiquetados como cierres. El
registro de evaluación y sus criterios viven en
[`slice-six-plan.md`](../delivery/slice-six-plan.md).

Solo se aprobará una fuente cuando exista evidencia de:

1. acceso reproducible para la cuenta y el alcance de la demo;
2. permiso de uso compatible con una clase local y, si aplica, con el modo de
   publicación previsto;
3. al menos tres acciones colombianas activas denominadas en COP;
4. cierres diarios históricos suficientes para compra, evolución y simulación;
5. significado documentado de `UNADJUSTED_CLOSE`, fechas de sesión, zona
   horaria y limitaciones corporativas;
6. muestra normalizada, manifiesto, checksum y pruebas contractuales.

Hasta cumplir todos los puntos, ADR-0005 permanece bloqueado y el dataset demo
continúa siendo la única fuente activa por defecto.
