# El registro de los primeros turnos del parqueadero cero

**HU-Q6.4 CA2, BACKLOG-PARKING_MVP §8.3 y §8.4.** Una fila por turno, desde el primer turno real. Los primeros turnos corren **en paralelo con el talonario**: cada vehículo recibe el recibo de la caja y el de siempre, y al cierre se comparan.

**Sin datos de conductores (P13):** aquí no van placas, números de WhatsApp ni nombres. Tampoco los datos del parqueadero: viven en su caja, no en el repositorio (§1).

## Cuándo se deja el talonario

- Después de **tres turnos seguidos sin diferencia** entre la caja, el conteo y el talonario. Una diferencia explicada, como un error de conteo del cajero, se anota y no reinicia la cuenta.
- **Una diferencia sin explicar detiene la operación con la caja** hasta encontrar la causa, registro por registro contra el talonario. La causa va a la bitácora.
- El recibo en papel sigue en «Siempre, al registrar» dos semanas más, aunque se deje el talonario (D-Q9).

Turnos seguidos sin diferencia: **0 de 3**.

## Los turnos

| Fecha | Turno | Versión | Entradas | Salidas | Impresiones al primer intento | Recibos por WhatsApp | QR en pantalla | Diferencia con el talonario y su causa | Minutos de soporte | Lo que observó el cliente |
|---|---|---|---|---|---|---|---|---|---|---|

## Lo que se cambió durante los primeros turnos

Arreglos `0.3.x`, solo después de un cierre de turno, nunca en medio (§8.3). Cada uno con su PR y, si repite un patrón, su entrada en la bitácora.

| Fecha | Versión | Qué se arregló | Por qué |
|---|---|---|---|
