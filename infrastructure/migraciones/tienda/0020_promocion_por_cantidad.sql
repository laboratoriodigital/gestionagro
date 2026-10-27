-- La promoción por cantidad de un producto (HU-P1.2, sprint PF1): «lleva 3 y paga 2» o «10 % menos
-- desde 2 unidades», con fecha de fin si la tiene. Va en el producto, como JSON que valida
-- `@ed1/tienda-schema` (`promocionDelProducto`); la cotización la vuelve a leer y calcular con
-- `@ed1/dinero`, nunca la toma del navegador. Una columna que admite NULL: no reescribe filas.
ALTER TABLE producto ADD COLUMN promocion TEXT CHECK (promocion IS NULL OR json_valid(promocion));
