# Evaluación de Fase 0

> **Registro histórico:** este documento describe el estado del repositorio el
> 2026-09-05, antes de la implementación. El MVP fue posteriormente construido
> y cerrado para demo educativa local; ver [acta de cierre](../delivery/mvp-closure.md)
> y la evidencia del Slice 6.

**Fecha de inspección:** 2026-09-05  
**Estado:** documentación completada; implementación no iniciada

## Inventario inicial

El repositorio partió de un único commit (`Initial commit`) con tres archivos versionados:

- `README.md`: título y descripción de una línea como prototipo para el Diplomado de BI&IA;
- `.gitignore`: plantilla orientada al ecosistema Node/Next.js;
- `LICENSE`: Apache License 2.0.

No existían `AGENTS.md`, specs, ADRs, código, manifiesto de dependencias, lockfile, migraciones, tests, CI ni `.env.example`. El `.gitignore` no se consideró evidencia de un stack seleccionado.

## Contradicciones encontradas

No había implementación o tests que contradijeran los requisitos. La descripción de «prototipo» era insuficiente, pero compatible con el MVP educativo. La especificación de Fase 0 reemplaza esa ambigüedad con alcance y reglas verificables.

Hay una tensión externa todavía sin resolver: el MVP exige cierres reales
gratuitos de `EQUITY`, pero las fuentes revisadas no han demostrado todavía de
forma simultánea gratuidad, cobertura suficiente, semántica de cierre y
permiso de uso. El MVP ya no exige un país concreto; ADR-0005 registra la
validación pendiente sin disfrazar fixtures como datos reales.

## Decisiones formalizadas

- demo local de un usuario y sin login;
- monolito modular TypeScript con PostgreSQL;
- ledger inmutable y proyecciones reconstruibles;
- precisión decimal, escalas y redondeos explícitos;
- compras con moneda explícita y fracciones, fees cero y retorno bruto;
- reglas direccionales para fechas históricas;
- contratos HTTP y de mercado independientes del proveedor;
- desarrollo en slices completos y trazabilidad por requirement ID.

## Riesgos técnicos y de producto

| Riesgo                                                | Impacto                                 | Mitigación / condición                                            |
| ----------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------- |
| No encontrar cierres `EQUITY` gratuitos y utilizables | Bloquea aceptación de slices de mercado | validar candidatos contra ADR-0005 antes de integrar              |
| Series incompletas o símbolos inconsistentes          | resultados históricos engañosos         | manifiesto, coverage, contract tests y errores explícitos         |
| Ajustes/dividendos desconocidos                       | retorno no comparable                   | una base homogénea, limitación visible y no afirmar retorno total |
| Splits sobre posiciones                               | cantidad/valor incorrectos              | suspender valoración hasta implementar política aprobada          |
| Concurrencia en compra                                | saldo negativo                          | transacción, bloqueo de aggregate, índices e integration tests    |
| Error decimal o serialización                         | discrepancias financieras               | decimal.js, `numeric`, strings HTTP y boundary tests              |
| Monolito acoplado a Next.js                           | difícil sustitución                     | reglas de imports, puertos y tests arquitectónicos                |
| Demo local desplegada sin seguridad                   | acceso no autorizado                    | no publicar; reemplazar ADR de identidad antes de despliegue      |
| Gráficas inaccesibles                                 | exclusión o mala interpretación         | tabla/resumen equivalente, teclado, foco y contraste              |
| Percepción de asesoría financiera                     | riesgo de confianza/producto            | disclaimer persistente y lenguaje no prescriptivo                 |

## Resultado de la fase

Los requisitos, contratos, arquitectura, dominio, pruebas, slices y ADRs necesarios para comenzar el Slice 0 están especificados. La matriz conserva `implemented=no` y `verified=no`: terminar documentación no equivale a implementar el MVP.

La selección de datos reales permanece abierta y no impide construir
infraestructura, ledger o mock contractual; sí impide declarar terminados para
MVP los slices 2, 3 y 4 hasta validar el universo gratuito de `EQUITY` y la
moneda de liquidación operable.
