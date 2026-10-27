-- Las compras sin terminar (HU-P1.1, sprint PF1): el carrito de quien marcó «Recordarme mi compra si
-- no la termino» y dejó su WhatsApp o su correo. Solo en los planes que lo incluyen
-- (`compras_sin_terminar` en funciones.json), y solo con la casilla, que nunca viene marcada.
--
-- - El contacto va cifrado con la llave de datos personales de la tienda (`sobre`, `iv` y
--   `llave_version`, como `pedido_contacto`); ningún otro dato de la persona.
-- - Una fila por carrito (su código de 6 caracteres): si cambia el carrito, se actualiza la misma.
-- - `vence` es 30 días después de dejarla; la purga diaria la borra entonces, o antes si ya hay un
--   pedido con ese código (la compra se terminó). `escrito` es cuando el comercio dijo «Ya le escribí».
-- Costo: una fila por carrito marcado, y una escritura por cada vez que cambia.
CREATE TABLE compra_pendiente (
  org_id TEXT NOT NULL REFERENCES tienda (org_id),
  codigo TEXT NOT NULL CHECK (length(codigo) = 6 AND codigo NOT GLOB '*[^0-9A-HJKMNP-TV-Z]*'),
  lineas TEXT NOT NULL CHECK (json_valid(lineas)),  -- [{variante, cantidad}], sin precios
  total_cop INTEGER NOT NULL CHECK (total_cop >= 0),  -- el de la cotización del servidor
  sobre BLOB NOT NULL,
  iv BLOB NOT NULL,
  llave_version INTEGER NOT NULL,
  creado TEXT NOT NULL,
  actualizado TEXT NOT NULL,
  vence TEXT NOT NULL,
  escrito TEXT,
  PRIMARY KEY (org_id, codigo)
) WITHOUT ROWID;
CREATE INDEX compra_pendiente_por_vence ON compra_pendiente (org_id, vence);
