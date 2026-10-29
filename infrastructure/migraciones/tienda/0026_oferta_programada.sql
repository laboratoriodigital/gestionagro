-- La oferta programada de un producto (HU-P1.4, sprint PF3): un porcentaje menos del primer día al
-- último, de Colombia. JSON que valida `@ed1/tienda-schema` (`ofertaProgramada`); la cotización la
-- vuelve a leer y calcula con `@ed1/dinero`. Una columna que admite NULL: no reescribe filas.
ALTER TABLE producto ADD COLUMN oferta TEXT CHECK (oferta IS NULL OR json_valid(oferta));

-- La tarea de cada hora busca las tiendas con una oferta que empieza hoy o terminó ayer, para
-- re-hornearlas: estos índices leen solo esos productos, no el catálogo de todo el shard.
CREATE INDEX producto_oferta_empieza ON producto (json_extract(oferta, '$.desde'))
  WHERE oferta IS NOT NULL;
CREATE INDEX producto_oferta_termina ON producto (json_extract(oferta, '$.hasta'))
  WHERE oferta IS NOT NULL;
