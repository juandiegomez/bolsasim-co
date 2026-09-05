# ADR-0007: caché en proceso para datos de mercado

- **Estado:** Accepted
- **Fecha:** 2026-09-05

## Contexto

Las consultas repetidas son lentas y pueden consumir límites del proveedor. La demo usa una sola instancia local.

## Decisión

Envolver `MarketDataProvider` con caché detrás de la misma interfaz. TTL: 300 segundos para último precio y 86.400 para históricos. Los archivos se identifican por checksum. No usar Redis ni fallback automático a mock.

## Consecuencias

Reiniciar vacía la caché, lo cual es aceptable. Respuestas conservan metadata/fecha. Una futura ejecución distribuida reevaluará almacenamiento e invalidación.
