# Evidencia de validación — Slice 5

Fecha: 2026-09-11. Requirements: PED-001, PED-002, PORT-002, SEC-001.

## Alcance verificado

- Cada reinicio archiva la práctica anterior, crea una práctica activa nueva con COP 10.000.000 y conserva ambos escenarios.
- Las previsualizaciones de una práctica archivada no pueden confirmarse.
- `VOID_BUY` es un movimiento append-only; conserva el `BUY` original y reconstruye efectivo y posiciones.
- La evolución diaria incluye la compra antes de la fecha efectiva de la anulación y la excluye desde esa fecha.
- La UI ofrece la confirmación “Conservar y empezar de nuevo”, lista prácticas archivadas y permite “Deshacer compra”.
- El bloqueo transaccional por usuario y escenario evita escenarios activos duplicados y dobles anulaciones del mismo BUY.

## Evidencia automatizada

| Gate                                      | Resultado                                            |
| ----------------------------------------- | ---------------------------------------------------- |
| `npm run format:check`                    | aprobado                                             |
| `npm run lint`                            | aprobado                                             |
| `npm run typecheck`                       | aprobado                                             |
| `npm run test:unit`                       | 60 pruebas aprobadas                                 |
| `npm run test:integration`                | 20 pruebas aprobadas                                 |
| `npm run test:contract`                   | 24 pruebas aprobadas                                 |
| `npm run test:e2e`                        | 17 pruebas aprobadas con `E2E_DATABASE_URL` dedicada |
| `npm run build`                           | aprobado                                             |
| `npm run db:check` / `npm run db:migrate` | aprobados                                            |

## Límite conocido

Los escenarios archivados son consultables y no mutables en este slice; no se agrega restauración ni edición histórica. El ledger sigue siendo la fuente autoritativa y no se ofrece borrado físico.
