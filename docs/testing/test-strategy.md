# Estrategia de pruebas

## Objetivos

Demostrar que el ledger reconstruye el portafolio, las operaciones nunca sobregiran, las matemáticas decimales son deterministas, las fechas se resuelven según contrato y UI/API expresan correctamente fallos y procedencia.

Cada prueba crítica incluye el requirement ID en `describe`, nombre o metadata. Fixtures usan reloj fijo y la etiqueta demo. No hay llamadas de red en la suite determinista.

## Pirámide y herramientas propuestas

- **Unitarias (Vitest):** value objects, invariantes, proyectores, compra, simulación y mapeo de errores.
- **Componentes (Testing Library + axe):** estados UI, teclado, labels, foco y mensajes no dependientes del color.
- **Integración (Vitest + PostgreSQL real efímero):** repositorios, migraciones, transacciones, aislamiento, HTTP y logs.
- **Contrato:** suite reutilizable contra mock, archivo y proveedor real; este último corre separadamente con configuración explícita.
- **E2E (Playwright):** cuatro recorridos verticales en viewport desktop, tablet y un smoke móvil.

Las versiones se decidirán al crear infraestructura y se fijarán en lockfile.

## Casos financieros críticos

| Caso / ID                     | Entrada                                                          | Resultado                                           |
| ----------------------------- | ---------------------------------------------------------------- | --------------------------------------------------- |
| Compra exacta PORT-003        | saldo 10.000.000; monto 2.000.000; fees 0; precio divisor exacto | débito 2.000.000; saldo 8.000.000                   |
| Fondos insuficientes PORT-003 | monto/débito > saldo                                             | error; cero movimientos añadidos                    |
| Concurrencia PORT-003         | dos confirmaciones que individualmente caben y juntas no         | máximo una aplica; saldo nunca negativo             |
| Idempotencia PORT-003         | misma key y payload repetidos                                    | misma respuesta; una compra                         |
| Conflicto PORT-003            | misma key, payload distinto                                      | `IDEMPOTENCY_CONFLICT`                              |
| Histórico HIST-003            | 1.000.000; precio 100 → 120                                      | 10.000 unidades; 1.200.000 final; 200.000 P&L; 20%  |
| Fecha no bursátil HIST-002    | inicio sábado y fin domingo con sesiones vecinas                 | inicio siguiente; fin anterior                      |
| Sin datos MDATA-002           | ninguna observación válida                                       | error controlado; nunca precio 0                    |
| Fracción FIN-002              | división periódica                                               | floor a 8; dinero half-up a 2; remanente preservado |
| Escala FIN-002                | dinero con 3 decimales                                           | rechazo, no redondeo silencioso                     |
| Moneda INST-001/FIN-004       | instrumento en moneda distinta al perfil del portafolio          | no operable y operación rechazada sin conversión FX |

## Unitarias

- creación y operaciones de `Money`, `Quantity` y `UnitPrice`, límites de `numeric` y serialización string;
- depósito inicial repetido, secuencias corruptas y orden determinista del ledger;
- preview a cinco minutos usando reloj inyectado, incluyendo el instante exacto de expiración;
- P&L/retorno, denominador cero, remanentes y precios extremos válidos;
- series ajustadas/no ajustadas homogéneas y rechazo de mezcla;
- split no soportado suspende valoración.

## Integración y persistencia

- índice único del depósito y rollback completo ante error;
- append-only del ledger según permisos de aplicación;
- bloqueo/aislamiento ante compras concurrentes;
- persistencia exacta y round-trip de decimales;
- paginación estable por cursor;
- request ID generado o propagado en respuesta/error y logs;
- manipulación del precio o saldo enviado por cliente no afecta confirmación.

No sustituir PostgreSQL por una base en memoria para pruebas de semántica transaccional.

## Contrato de mercado

Todos los adapters verifican orden, unicidad, positividad, moneda, base, coverage, metadata y ambas reglas de fecha. El adapter real añade el smoke local opt-in `npm run market:verify`, que valida disponibilidad de la muestra y el dataset normalizado sin convertir la inestabilidad externa en fallo del CI determinista. Un dataset real local se prueba por checksum y manifiesto; no se versiona ni se redistribuye.

## E2E y accesibilidad

1. inicializar y recargar conservando saldo;
2. buscar, abrir detalle y reconocer fecha/fuente/modo;
3. previsualizar, confirmar, actualizar dashboard y ver movimiento;
4. simular rango con fin de semana y revisar gráfica/tabla/supuestos;
5. fondos insuficientes, expiración, proveedor indisponible y datos incompletos;
6. navegación completa por teclado, foco visible, nombres accesibles y contraste automatizable.

## Fixtures

Ubicación prevista: `tests/fixtures/market/`. Cada conjunto incluye `manifest.json`, observaciones y README. Fechas y valores son inventados y etiquetados `demo`. El fixture canónico incluye precios 100 y 120, un fin de semana entre ellos, un hueco anterior a cobertura y un instrumento USD para probar incompatibilidad con el perfil COP predeterminado.

## Gates y CI

Slice 0 materializa instalación con lockfile, format check, lint (incluido OpenAPI), typecheck, PostgreSQL/migraciones, unitarias, integración, contrato, build y E2E sobre producción en `.github/workflows/ci.yml`. Un fallo bloquea Done; no se eliminan tests, assertions o validaciones para obtener verde. La baseline de Fase 0 era documental; la evidencia consolidada de los Slices 1–6 está en sus reportes de validación y en el acta de cierre del MVP.

Los tests actuales viven en `tests/unit`, `tests/integration`, `tests/contract` y `tests/e2e`. El contrato health se valida con los schemas OpenAPI mediante Ajv; no se duplican schemas en tests. Integración exige TEST_DATABASE_URL dedicada, nunca usa fallback. Vitest separa proyectos y falla cuando falta la base. E2E prueba el servidor Next.js compilado y no reutiliza servidores del usuario.

## Evidencia y trazabilidad

Actualizar la matriz solo después de ejecutar la prueba correspondiente. El reporte de cada slice enumera comandos, resultado, IDs cubiertos y limitaciones. Cobertura porcentual orienta, pero no reemplaza los escenarios críticos ni las mutaciones financieras relevantes.
