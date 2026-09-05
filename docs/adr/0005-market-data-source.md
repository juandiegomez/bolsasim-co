# ADR-0005: fuente de datos de mercado

- **Estado:** Proposed — blocking
- **Fecha:** 2026-09-05

## Contexto

El MVP exige precios reales gratuitos de acciones colombianas. Deben ser cierres diarios con procedencia y uso permitido. Los mocks no satisfacen aceptación.

## Decisión propuesta

Implementar primero un contrato independiente, un mock explícito y un adapter de archivo normalizado con manifiesto/checksum. No seleccionar proveedor hasta verificar acceso gratuito, licencia/condiciones, cobertura, definición de cierre y muestra reproducible.

Twelve Data ubica la cobertura colombiana conocida en planes pagos. La fuente identificada de la Superfinanciera publica promedios diarios, no cierres. Ninguna se aprueba.

## Consecuencias

El desarrollo determinista puede avanzar con demo data. Los slices 2–4 no se aceptan como MVP con mocks ni con promedios etiquetados como cierres. Aprobar un candidato actualizará este ADR con evidencia, fecha de revisión, símbolos y limitaciones.
