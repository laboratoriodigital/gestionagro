-- Las versiones viejas del sitio se purgan de R2 (TIENDA §351, bitácora tienda3 28): las de más de
-- 90 días que no son la vigente ni una de las 5 anteriores. La fila queda, para la lista de
-- versiones del panel, con el instante en que se borraron su manifiesto y lo horneado: una versión
-- purgada ya no se puede volver a publicar. Costo: una escritura por versión purgada.
ALTER TABLE publicacion ADD COLUMN purgada TEXT;
