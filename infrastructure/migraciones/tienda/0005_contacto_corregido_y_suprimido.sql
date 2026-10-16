-- Los derechos del titular (HU-T7.3): corregir o suprimir el contacto de un pedido queda en su
-- historia, y también la purga del contacto vencido. El pedido se queda como prueba de la venta.
-- Costo: dos filas de referencia.
INSERT INTO ref_tipo_evento (id) VALUES ('contacto_corregido'), ('contacto_suprimido');
