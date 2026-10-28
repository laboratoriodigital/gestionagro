-- El alcance de un cupón (HU-P1.3, sprint PF2): los productos y las categorías en que aplica, como
-- JSON `{"productos": [...], "colecciones": [...]}`. NULL: aplica a todo el carrito, como antes.
-- La cotización lo vuelve a leer: el descuento nunca pasa del valor de esos productos. Una columna
-- que admite NULL: no reescribe filas.
ALTER TABLE cupon ADD COLUMN alcance TEXT CHECK (alcance IS NULL OR json_valid(alcance));
