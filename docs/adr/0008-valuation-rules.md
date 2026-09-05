# ADR-0008: reglas de valoración y retorno

- **Estado:** Accepted
- **Fecha:** 2026-09-05

## Contexto

La aplicación debe distinguir precio solicitado, sesión efectiva, cierres ajustados y falta de datos, evitando resultados engañosos.

## Decisión

Compras usan cierre sin ajustar y retorno bruto con fees cero. El inicio histórico resuelve `ON_OR_AFTER`; el final `ON_OR_BEFORE`, o última sesión disponible. Histórico prefiere ajustado solo con semántica verificada y nunca mezcla bases. Valoración diaria arrastra el último cierre anterior e informa su fecha. Ausencia previa deja el total incompleto. Un split conocido no soportado suspende la valoración.

## Consecuencias

No se afirma retorno total ni se acreditan dividendos. Los datos faltantes no valen cero. Incorporar eventos corporativos, fees o FX exige requisitos y revisión de esta decisión.
