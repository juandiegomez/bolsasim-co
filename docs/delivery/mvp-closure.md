# Cierre del MVP educativo

**Estado:** listo para demo educativa local
**Fecha:** 2026-09-11
**Versión del proyecto:** 0.1.0

## Declaración de cierre

BolsaSim CO queda listo para una clase o demostración local sobre inversiones,
con capital ficticio y acciones `EQUITY` disponibles gratuitamente en el
universo validado. El proyecto permite explorar instrumentos, simular compras,
consultar posiciones y evolución, ejecutar simulaciones históricas y conservar
escenarios pedagógicos.

«Listo» significa usable y verificable para el alcance educativo local. No
significa que sea un broker, una aplicación productiva, un sistema de datos en
tiempo real ni un producto de asesoría financiera.

## Alcance terminado

| Área       | Resultado                                                                                                                                    |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundation | Next.js, TypeScript estricto, PostgreSQL, Drizzle, configuración, migraciones, health check, logging y CI.                                   |
| Portafolio | Depósito idempotente, ledger append-only, compras fraccionarias, idempotencia, posiciones, P&L y evolución diaria.                           |
| Mercado    | Catálogo, detalle, cierres diarios, histórico, metadata, caché y errores explícitos.                                                         |
| Simulación | Simulación histórica independiente, fechas direccionales, serie, tabla y supuestos.                                                          |
| Pedagogía  | Escenarios archivables, reinicio, anulación reversible y explicaciones contextuales.                                                         |
| Slice 6    | Ruta dedicada de posiciones, fuente Twelve Data aceptada para uso local, dataset real USD normalizado y actualización automática de la demo. |
| UX         | Indicadores semánticos de ganancia/pérdida, porcentaje visible como `<0.01%` cuando corresponde y señales textuales accesibles.              |

## Datos y operación de la clase

El flujo recomendado para el presentador es:

```text
npm ci
npm run db:up
npm run db:check
npm run db:migrate
npm run demo:start
```

Con `MARKET_DATA_ADAPTER=file`, `demo:start` compara la fecha de corte local
con la fecha del mercado, intenta una ingesta y verificación como máximo una
vez por día y después inicia Next.js. La API key permanece en el proceso local
del presentador. Los estudiantes no necesitan configurar Twelve Data ni
ejecutar comandos.

Si Twelve Data no está disponible, se conserva el último snapshot válido. La
fecha de corte permanece visible. Si aún no existe un snapshot real válido, la
primera ingesta requiere conectividad, credenciales y acceso al universo
seleccionado.

El modo `mock` y `datasets/demo` continúan disponibles para CI, desarrollo
reproducible y clases que no necesiten datos externos. `demo:start` no cambia a
`mock` silenciosamente.

## Evidencia de cierre

Los gates se ejecutaron con Node `v24.20.0` y npm `11.19.0`, compatibles con
`.nvmrc` y `package.json`:

- `npm run format:check`: aprobado.
- `npm run lint`: aprobado, incluido OpenAPI/Redocly.
- `npm run typecheck`: aprobado.
- `npm run test`: 15 archivos unitarios/70 pruebas, 4 archivos de integración/24 pruebas y 5 archivos de contrato/27 pruebas aprobadas.
- `npm run build`: aprobado.
- `npm run test:e2e`: 20 pruebas aprobadas con base dedicada y fixture demo.
- `npm run db:check` y `npm run db:migrate`: aprobados.
- `npm run market:verify`: tres Equity USD, 5.043 observaciones, checksums y metadata aprobados.
- `npm run demo:start`: actualización real desde el snapshot del 2026-09-09 hasta el 2026-09-10, verificación y arranque HTTP aprobados.
- Smoke HTTP real: `/instruments` expuso AAPL, MSFT y KO con `dataMode=real`; `/price` devolvió el cierre del 2026-09-10.

La evidencia detallada del Slice 6 está en
[`slice-six-validation.md`](../testing/slice-six-validation.md). La matriz de
requirements conserva el detalle histórico y distingue requisitos funcionales
del MVP de objetivos transversales que siguen siendo parciales por diseño.

## Límites aceptados

- Usuario local único y sin autenticación.
- Capital ficticio; no custodia ni mueve dinero real.
- Cierres diarios `UNADJUSTED_CLOSE`, no cotizaciones intradía ni tiempo real.
- Twelve Data requiere cuenta, API key, cuota, red, cobertura y condiciones de
  uso compatibles. El dataset real es local, ignorado por Git y no se
  redistribuye.
- No se incluyen ventas, FX, crypto, ETFs, renta fija, fondos, índices,
  dividendos, splits, otros eventos corporativos, trading real, recomendaciones
  ni backtesting avanzado.
- Los objetivos de producción pública, multiusuario, autenticación completa,
  observabilidad operativa integral y accesibilidad automatizada exhaustiva
  requieren trabajo posterior; no bloquean este MVP educativo local.

## Siguiente etapa

El MVP no tiene trabajo funcional obligatorio pendiente. Cualquier ampliación
debe iniciar un nuevo slice con requirements, contrato, ADR, pruebas y una
revisión de las condiciones de datos. Antes de publicar o redistribuir la
aplicación o datos reales se debe revisar la licencia y autorización aplicable.
