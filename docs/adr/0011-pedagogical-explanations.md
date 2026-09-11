# ADR-0011: explicaciones pedagógicas visibles en la interfaz

- **Estado:** Accepted
- **Fecha:** 2026-09-11
- **Requirement:** EDU-001

## Contexto

BolsaSim CO no solo debe mostrar resultados: debe ayudar a entender qué se
está observando y qué decisión representa cada paso. Identificadores técnicos
como `UNADJUSTED_CLOSE`, `providerId` o `demo` son útiles para trazabilidad,
pero no son explicaciones suficientes para una persona que está aprendiendo.

## Decisión

La interfaz conservará la metadata exacta, pero cada bloque técnico relevante
incluirá una explicación visible y ampliable mediante HTML `details/summary`.
Las explicaciones estarán junto al dato, funcionarán con teclado y no
dependerán de hover, color ni conocimiento previo.

Se explicarán como mínimo:

- fecha y significado del último cierre;
- moneda COP;
- base `UNADJUSTED_CLOSE` y sus límites;
- fuente y modo `demo`/`real`;
- cantidad, débito y remanente de una preview;
- efectivo, costo invertido, valor total y P&L;
- ubicación del historial y acción para deshacer una compra.

## Consecuencia

La metadata sigue siendo auditable y el usuario recibe contexto accionable sin
ocultar precisión. El contenido pedagógico se prueba por presencia y
accesibilidad en E2E; no se convierte en un tooltip exclusivo.
