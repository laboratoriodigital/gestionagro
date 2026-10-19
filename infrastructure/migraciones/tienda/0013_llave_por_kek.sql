-- Rotar la KEK (HU-T17.6, TIENDA §14.2): la vuelta que reenvuelve las DEK busca las que envuelve una
-- KEK vieja, y el despliegue cuenta cuántas usa cada una antes de retirarla. Con el índice, las dos
-- leen solo esas filas, no la tabla entera. Costo: una entrada por DEK (tres por tienda a lo sumo).
CREATE INDEX llave_por_kek ON llave (kek_id);
