-- Dar de baja una tienda (HU-T13.7, TIENDA §14.2): cuándo la pidió el comercio y cuándo se borraron
-- sus llaves de datos personales y de índices (el borrado criptográfico, a los 30 días). La tarea
-- diaria busca las que esperan con el índice parcial: ninguna fila cuando no hay bajas.
ALTER TABLE tienda ADD COLUMN baja_pedida TEXT;
ALTER TABLE tienda ADD COLUMN datos_borrados TEXT;
CREATE INDEX tienda_baja_por_borrar ON tienda (baja_pedida) WHERE estado = 'baja' AND datos_borrados IS NULL;
