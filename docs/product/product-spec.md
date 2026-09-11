# Product Spec — BolsaSim CO MVP

**Estado:** aprobado para Fase 0  
**Audiencia:** producto, ingeniería, QA y agentes de IA  
**Zona horaria de presentación:** `America/Bogota`
**Decisión de alcance vigente:** [ADR-0013](../adr/0013-mvp-equity-free-universe.md)

## Decisión de alcance de activos — Slice 6

El MVP y el Slice 6 se mantienen deliberadamente limitados al tipo de
instrumento `EQUITY`, pero ya no son exclusivos de Colombia. El universo
operable lo determina la cobertura gratuita realmente accesible del proveedor
validado, sin asumir un país, exchange o MIC concreto.

Cada portafolio utiliza una única moneda de liquidación explícita. El perfil
COP y el depósito inicial de COP 10.000.000 siguen siendo el valor
predeterminado por compatibilidad; una moneda distinta requiere un perfil y
configuración compatibles. No se mezclan monedas ni se hace conversión FX.

La lista de tipos extensibles del modelo no habilita otros activos en la
experiencia ni en las operaciones actuales. `ETF`, renta fija, fondos, índices,
pares FX, crypto, dividendos, splits y otros eventos corporativos requieren
requirements y decisiones propias antes de incorporarse.

La disponibilidad gratuita se valida por instrumento y serie EOD, no solo por
la presencia del símbolo en un catálogo. La evaluación de Twelve Data se
registra en [ADR-0005](../adr/0005-market-data-source.md); `ECO:BVC` es
evidencia parcial y la muestra de aceptación puede provenir de cualquier
mercado que cumpla el perfil elegido.

## Problema y usuario objetivo

Quien aprende sobre inversiones carece de una experiencia sencilla donde pueda
practicar con capital ficticio y entender el efecto histórico de una compra sin
conectar una cuenta de corretaje ni arriesgar dinero.

El usuario principal es un estudiante o persona interesada en explorar inversiones. Usa una demo local, individual y sin login. El actor operativo es el desarrollador que configura la aplicación y carga una fuente de mercado real validada.

## Objetivos y métricas iniciales

El MVP debe permitir completar, sin ayuda externa, estos recorridos:

1. consultar un portafolio inicial en su moneda configurada (COP
   10.000.000 por defecto);
2. encontrar una acción `EQUITY` del universo gratuito soportado y entender la
   fecha, mercado, moneda y procedencia de su precio;
3. previsualizar y confirmar una compra simulada, observando el saldo y posición resultantes;
4. calcular el resultado histórico de una inversión y entender sus supuestos.

Métricas iniciales para una demo instrumentada posteriormente:

- 95% de recorridos E2E críticos completan sin error no controlado;
- 100% de operaciones confirmadas pueden reconstruirse desde el ledger;
- 100% de precios visibles incluyen fecha, moneda, fuente y modo real/demo;
- cero discrepancias de centavos en los casos financieros de referencia;
- cero secretos o datos inventados presentados como reales.

Estas métricas son criterios técnicos iniciales, no objetivos comerciales aún.

## Alcance

- Usuario local único, portafolio único y depósito inicial idempotente.
- Efectivo y acciones `Equity` del universo gratuito validado, con moneda
  explícita y compatible con la moneda de liquidación del portafolio; no se
  habilitan otros tipos de instrumento en el MVP.
- No se impone exclusividad geográfica, pero un portafolio no mezcla monedas ni
  convierte divisas automáticamente.
- Búsqueda, listado, detalle, último cierre e histórico diario de instrumentos soportados.
- Compra simulada por monto, con fracciones de hasta ocho decimales.
- Ledger de `INITIAL_DEPOSIT` y `BUY`; `SELL` solo reservado conceptualmente.
- Dashboard con efectivo, inversión, valor total, P&L, rentabilidad, evolución, posiciones y movimientos.
- Simulación histórica independiente del portafolio.
- Datos reales gratuitos mediante API o archivo validado; mocks visibles para desarrollo y CI.
- Fees configurables en arquitectura y fijados en cero para el MVP, en la
  moneda de liquidación del portafolio.

## No objetivos

Dinero real, depósitos o retiros bancarios, brokers, ventas, short selling,
margen, FX, crypto, ETFs, renta fija, fondos, índices, instrumentos distintos
de acciones, dividendos acreditados, splits, ajustes automáticos por eventos
corporativos, autenticación, despliegue público, recomendaciones
personalizadas, trading intradía, estrategias, indicadores avanzados,
rebalanceo, optimización, Monte Carlo y derivados.

### Extensión pedagógica planificada

Después de la simulación histórica, la demo permitirá escenarios de clase
archivables, reinicio de una práctica y anulación reversible de compras
individuales. No elimina movimientos ni habilita ventas: conserva el historial
para explicar el ejercicio y reconstruye las proyecciones excluyendo compras
anuladas. Ver ADR-0010 y Slice 5.

### EDU-001 — Entender cada paso

La interfaz debe explicar en lenguaje sencillo los datos de mercado,
previsualización y portafolio sin ocultar la metadata técnica. La explicación
debe estar junto al dato, ser ampliable con teclado y no depender de hover.
Como mínimo debe aclarar fecha del cierre, moneda, base de precio, fuente y
modo demo/real, cantidad, débito, remanente, métricas del portafolio y dónde
consultar o deshacer una compra.

## User journeys

### J1 — Consultar portafolio

Al abrir la demo, el sistema crea una sola vez el depósito inicial. El dashboard muestra valor total, efectivo, costo invertido, P&L y rentabilidad. Si una posición no puede valorarse, se muestra como incompleta con su causa y no como cero.

### J2 — Explorar y comprar

El usuario busca por símbolo o nombre, abre el detalle, consulta el último cierre y solicita invertir un monto. El servidor genera una previsualización válida cinco minutos. Al confirmar con idempotencia, vuelve a validar fondos y disponibilidad, registra el movimiento atómicamente y actualiza las proyecciones.

### J3 — Simular inversión histórica

El usuario elige instrumento, monto, fecha inicial y fecha final opcional. El inicio se resuelve hacia la siguiente sesión y el final hacia la anterior. El resultado informa fechas efectivas, base de precios, cantidad, remanente, valor final, P&L, porcentaje, serie y supuestos. No modifica el portafolio.

## Reglas de negocio

- **PORT-001:** el depósito inicial ocurre una sola vez por portafolio, en su
  moneda de liquidación; el perfil predeterminado usa COP 10.000.000.
- **PORT-002:** el ledger es inmutable y autoritativo; efectivo y posiciones se derivan de él.
- **PORT-003:** una compra requiere instrumento activo `Equity` del universo
  validado, moneda igual a la de liquidación del portafolio, monto positivo,
  precio válido, fondos suficientes, previsualización vigente e idempotencia.
  Validación y escritura son atómicas y no hacen conversión FX.
- **PORT-004:** una posición derivada informa cantidad, costo, precio fechado, valor y P&L; falta de precio produce estado incompleto.
- **PORT-005:** la evolución reconstruye efectivo y posiciones por día, usa el último cierre conocido anterior o igual y revela la fecha arrastrada.
- **INST-001:** todo instrumento tiene ID interno, símbolo, nombre, exchange,
  moneda, tipo y estado; cualquier exchange es válido si pertenece al universo
  gratuito validado y el tipo es `EQUITY`.
- **HIST-001:** la simulación separa parámetros y resultado, no se persiste y declara procedencia y supuestos.
- **HIST-002:** fecha inicial usa primera sesión posterior o igual; fecha final usa última sesión anterior o igual; sin final se usa la última disponible.
- **HIST-003:** la serie usa una sola base de precio. No se afirma retorno total si dividendos y ajustes no están verificados.
- **PED-001:** cada usuario local puede conservar escenarios archivados y solo uno permanece activo; los escenarios archivados son consultables y no mutables.
- **PED-002:** deshacer una compra registra `VOID_BUY` apuntando al `BUY` original. La compra no se borra; el snapshot actual y la evolución desde la fecha de anulación la excluyen.
- **FIN-001:** dinero, precios y cantidades usan decimal exacto y moneda explícita.
- **FIN-002:** cantidad se redondea hacia abajo a 8 decimales; dinero se liquida `ROUND_HALF_UP` a 2.
- **FIN-003:** fees son cero y los resultados se etiquetan como retorno bruto.
- **FIN-004:** cada portafolio declara una moneda de liquidación; las compras,
  posiciones y totales deben usarla y una moneda diferente se rechaza sin FX.
- **SCOPE-001:** el MVP admite `EQUITY` activa de cualquier mercado incluido en
  el universo gratuito validado; no admite otros tipos de activo.
- **MDATA-001:** todo precio incluye fuente, modo, fecha de sesión, moneda, timestamp de obtención y base.
- **MDATA-002:** ausencia de datos genera error controlado; no se interpola ni se sustituye por cero o mock.
- **UI-001:** cada experiencia soporta loading, vacío, error, éxito y datos incompletos aplicables.
- **UI-002:** la interfaz declara capital ficticio, naturaleza educativa y fecha/procedencia de datos.
- **SEC-001:** cálculos y validaciones financieras autoritativas ocurren en servidor y no se exponen secretos.
- **OBS-001:** cada respuesta HTTP contiene `requestId` y los errores usan códigos estables y logs estructurados.

## Requisitos funcionales y no funcionales

Son funcionales `PORT-001` a `PORT-005`, `INST-001`, `HIST-001` a `HIST-003`,
`MDATA-001`, `MDATA-002`, `SCOPE-001`, `UI-001` y `UI-002`: describen
capacidades observables del portafolio, mercado, simulador e interfaz.

Son reglas financieras transversales `FIN-001` a `FIN-004`. Son no funcionales
`SEC-001`, `OBS-001`, `PERF-001` y `SDD-001`:

- **PERF-001:** evitar consultas repetidas mediante caché de cinco minutos para últimos precios y 24 horas para históricos; paginar listados y no bloquear la UI durante I/O.
- **SDD-001:** no iniciar producción de una feature sin Definition of Ready; todo cambio mantiene requisitos, contratos, ADRs, pruebas y comportamiento sincronizados.

Objetivos no funcionales adicionales: TypeScript estricto, dominio independiente del framework, persistencia exacta, pruebas deterministas, logs sin secretos, WCAG 2.1 AA cuando aplique y diseño usable desde laptop hasta móvil.

## Criterios de aceptación

| ID            | Evidencia esperada                                                                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| PORT-001      | Inicializar dos veces deja un solo depósito en la moneda configurada; el perfil predeterminado conserva COP 10.000.000.                  |
| PORT-002      | Reproducir transacciones en orden reconstruye exactamente saldo y posiciones.                                                            |
| PORT-003      | Comprar un monto en la moneda del portafolio deja el remanente exacto; exceso, moneda incompatible y concurrencia no sobregiran.         |
| PORT-004      | Precio ausente produce valoración incompleta y un error categorizado, nunca `0`.                                                         |
| PORT-005      | Cada punto revela fecha de valoración y distingue huecos sin precio anterior.                                                            |
| INST-001      | Búsqueda y detalle devuelven metadata completa y solo acciones `EQUITY` activas del universo gratuito y moneda compatible son operables. |
| HIST-001      | Ejecutar una simulación no crea transacciones.                                                                                           |
| HIST-002      | Un fin de semana usa las sesiones efectivas según la regla direccional.                                                                  |
| HIST-003      | COP 1.000.000 a precios 100 y 120 produce 10.000 unidades, COP 1.200.000 y 20%.                                                          |
| PED-001       | Reiniciar archiva la práctica anterior, crea una nueva con COP 10.000.000 y conserva el escenario anterior como ejemplo de solo lectura. |
| PED-002       | Deshacer una compra conserva ambos movimientos, restaura el snapshot actual y excluye la compra desde la fecha del `VOID_BUY`.           |
| FIN-001/002   | Casos con decimales cumplen escala y redondeo sin `number` financiero.                                                                   |
| FIN-004       | El portafolio expone o deriva una moneda de liquidación única; compras en otra moneda se rechazan sin conversión.                        |
| SCOPE-001     | El catálogo operativo puede ser multi-mercado, pero solo contiene `EQUITY` gratuita validada; otros tipos quedan fuera.                  |
| MDATA-001/002 | Respuestas muestran metadata; errores del proveedor no activan mocks silenciosamente.                                                    |
| UI-001/002    | Los cinco estados y avisos son navegables por teclado y comprensibles sin depender del color.                                            |
| SEC-001       | Alterar precio o saldo en cliente no altera el cálculo confirmado por servidor.                                                          |
| OBS-001       | Error HTTP y log correlacionado comparten `requestId` sin secretos.                                                                      |
| PERF-001      | Solicitudes equivalentes dentro del TTL reutilizan datos y listados respetan límites/cursor.                                             |
| SDD-001       | El PR referencia requirements, contratos, ADRs y evidencia de gates aplicables.                                                          |

## Edge cases y errores

- monto cero, negativo, fuera de rango o con más de dos decimales;
- precio no positivo o con escala inválida;
- compra cuyo importe efectivo redondea a cero;
- fondos exactamente iguales, insuficientes o consumidos concurrentemente;
- previsualización inexistente, vencida, ya utilizada o confirmada dos veces; misma clave de idempotencia aplicada a otra preview;
- instrumento inexistente, inactivo, no `Equity` o en moneda diferente;
- proveedor caído, limitado, con datos duplicados, desordenados o fuera de cobertura;
- fecha inicial posterior a la final y rango sin sesiones válidas;
- compra inexistente, depósito inicial, compra ya anulada o compra de un escenario archivado;
- dos reinicios o anulaciones concurrentes no crean escenarios activos duplicados ni dos `VOID_BUY` para el mismo `BUY`;
- una anulación en una fecha posterior conserva la compra en puntos de evolución anteriores y la excluye desde su fecha efectiva;
- posición con split conocido sin tratamiento: valoración suspendida y limitación visible;
- portafolio sin posiciones, histórico sin movimientos y denominador cero: rentabilidad «no aplica».

## Experiencia, accesibilidad y disclaimer

El dashboard prioriza métricas y evolución en resoluciones habituales de laptop; tablet y móvil preservan jerarquía. Gráficas tienen resumen o tabla accesible. HTML semántico, labels, foco visible, navegación por teclado, contraste WCAG 2.1 AA cuando aplique y texto/iconografía adicional al color.

Texto visible: “Simulador con capital ficticio. Los resultados históricos no garantizan resultados futuros y no constituyen asesoría financiera.” Los datos demo llevan una etiqueta persistente.

## Definition of Ready y Done

Ready requiere descripción, IDs, criterios, reglas, errores, contratos afectados y pruebas esperadas. Done requiere implementación tipada, validaciones, pruebas unitarias e integración aplicable, estados UI, documentación sincronizada, format, lint, typecheck, tests y build aprobados, y criterios verificados sin regresiones conocidas.
