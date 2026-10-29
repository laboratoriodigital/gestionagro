-- El título y la descripción para buscadores de una página propia (HU-P4.4, sprint PF3). Los del
-- producto van en `producto.seo`, que ya existía; la página no tenía dónde. JSON que valida
-- `@ed1/tienda-schema` (`buscadores`). Una columna que admite NULL: no reescribe filas.
ALTER TABLE pagina ADD COLUMN seo TEXT CHECK (seo IS NULL OR json_valid(seo));
