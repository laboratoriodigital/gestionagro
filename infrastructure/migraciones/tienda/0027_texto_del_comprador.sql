-- El texto que un producto le pide al comprador (HU-P1.5, sprint PF3): su etiqueta, su largo y si
-- es obligatorio. JSON que valida `@ed1/tienda-schema` (`pideTexto`). Lo que el comprador escribe
-- no va aquí: va cifrado en el sobre de la entrega del pedido (`pedido_contacto`). Una columna que
-- admite NULL: no reescribe filas.
ALTER TABLE producto ADD COLUMN pide_texto TEXT CHECK (pide_texto IS NULL OR json_valid(pide_texto));
