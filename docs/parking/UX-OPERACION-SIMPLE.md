# Operación simple de la caja

Decisión del dueño, 12 oct 2026: el cliente actual trabaja sin turnos. La operación diaria es registrar una entrada por placa, entregar el recibo y buscar el vehículo para cobrar su salida.

## Lo que cambia

- Una sede nueva empieza en **Sin turnos**. No pide cajero, base, apertura ni cierre; no crea registros de turno automáticamente. Las entradas, salidas, mensualidades y anulaciones conservan sus consecutivos, controles y respaldo.
- **Con turnos** sigue disponible en Ajustes, con el PIN existente. Las sedes antiguas que no tienen `usa_turnos` conservan su comportamiento. Para desactivarlo hay que cerrar primero el turno abierto.
- El inicio muestra Nueva entrada, Escanear recibo y los vehículos adentro. Los ajustes, abonados, reportes, respaldo, avisos y detalles de impresora están en **Más opciones**. Las señales de impresora, hora, respaldo y entregas siguen visibles.
- En la entrada se escribe la placa con el teclado del teléfono o PC; el teclado de la caja queda disponible al desplegarlo. El tipo se propone por la placa y Sin novedad ya está seleccionado. Fotos y WhatsApp se despliegan cuando se necesitan; su autorización sigue siendo obligatoria al guardar un número.
- En la salida está seleccionado Efectivo. Recibido vacío significa pago exacto, indicado junto al campo. Escribir el valor permite calcular el cambio; un valor inválido o insuficiente bloquea el cobro. Otros medios conservan su selección explícita.
- Reportes, sin turnos, cuenta entradas, salidas, mensualidades y dinero por medio para el día de Bogotá, y permite descargar CSV. Excluye recibos anulados, incluso si se anulan después de ese día. No muestra diferencias ni conteos de caja que nadie realizó. Los totales se actualizan durante la operación; la cuarentena sigue avisada.

## Datos y compatibilidad

`sede.usa_turnos` es opcional en el catálogo. `false` permite operación continua; omitido o `true` en una sede existente conserva el control de turnos. Viaja con el catálogo, su historial, la sincronización y el respaldo. No cambia los formatos de registro ni de recibo.

Esta decisión actualiza la obligatoriedad de turnos de ARQUITECTURA §5 y HU-Q3.9 CA4 del MVP para las sedes que eligen Sin turnos. El piloto se compara por **día de operación** y el respaldo se hace al terminar el día. Los procedimientos de turno siguen aplicando a las sedes que los usan.

La versión de la API que acepta este campo debe publicarse antes o junto con la caja que lo escribe; una API anterior con esquema estricto podría rechazarlo. La caja local no necesita API.

## Validación

Recorrido sin conexión en Ensayo Uno y Ensayo Dos, a 360 y 1280 px: entrada por placa, recibo digital, búsqueda, cobro exacto y reporte. Pruebas del almacén cubren consecutivos, placas duplicadas, PIN de anulación, corrección del reporte al anular al día siguiente y restauración del modo de operación. Las pruebas previas siguen cubriendo apertura, cierre y conteo de las sedes con turnos.

Control negativo: se modificó temporalmente `usaTurnos` para exigir turnos también a las sedes con `usa_turnos: false`. La prueba «registra, cobra, anula y respalda sin aperturas ficticias» falló con `SinTurno` al registrar la entrada; al restaurar la condición pasó. El defecto no se incluye en el cambio.
