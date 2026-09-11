# Dataset demo de mercado

Contenido inventado y determinista para el desarrollo y las pruebas de BolsaSim CO. **Nunca representa precios reales.** Está etiquetado `demo` en su manifiesto y toda la UI conserva esa etiqueta mientras este dataset sea la fuente activa.

- `manifest.json`: manifiesto versionado con fuente, checksum SHA-256 por archivo, cobertura, zona horaria, conjunto de monedas, definición de precio y limitaciones.
- `instruments.json`: cuatro instrumentos de referencia (tres en COP, uno en USD operable solo con un perfil USD; uno INACTIVE).
- `prices.json`: observaciones diarias etiquetadas `UNADJUSTED_CLOSE`. La serie canónica de `DEMO1` va de 100 a 120 entre 2026-08-03 y 2026-08-28, omite la sesión 2026-08-12 a propósito para modelar un hueco interno, y contiene valores con hasta 8 decimales.

El adapter de archivo valida los checksums al construir y el arranque falla si el manifiesto o el checksum no coinciden. Para usar datos reales, reemplazar este directorio por un dataset con manifiesto propio y conmutar `MARKET_DATA_ADAPTER=file` (ver [ADR-0005](../../docs/adr/0005-market-data-source.md)).
