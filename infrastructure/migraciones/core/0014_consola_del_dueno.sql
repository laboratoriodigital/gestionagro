-- CORE · la consola del dueño v0 (HU-C13.2 y HU-C13.3, decisión D-C8 del 23 oct 2026). Solo índices:
-- la consola lee lo que ya existe y no tiene tablas propias. Cada vista queda en `auditoria`.
--
-- Costo: una fila escrita más por cada pago que cambia de estado, por cada cuenta nueva y por cada
-- espacio nuevo, que son decenas al mes. Sin ellos, cada vista de la consola recorre `pago`,
-- `usuario` y `organizacion` enteras.

-- Lo que entró (aprobados por fecha) y lo que hay que revisar (`revisar`, `esperando`).
CREATE INDEX pago_por_estado ON pago (estado, actualizado);
-- Cuentas nuevas por semana.
CREATE INDEX usuario_por_creado ON usuario (creado);
-- Espacios nuevos por producto y semana.
CREATE INDEX organizacion_por_creado ON organizacion (producto, creado);
