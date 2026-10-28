-- Los productos digitales (HU-P6.1 y HU-P6.2, sprint PF2, pedido del dueño del 26 oct 2026).
--
-- - Un producto es físico o digital. El digital no cuenta existencias ni pide envío.
-- - Cada combinación de un producto digital tiene su archivo en el bucket privado DIGITALES, con
--   su clave `<org>/<variante>/<id>`. Aquí van solo sus datos: nombre, tipo, tamaño y huella; el
--   contenido nunca pasa por la base ni por el horno. Topes del dueño: 50 MB por archivo y 1 GB por
--   tienda. Los archivos no se respaldan: son del comercio (decisión del 27 oct 2026).
-- - `descarga`: un enlace temporal por pedido y combinación, con la huella de su secreto (el secreto
--   solo lo ve el comprador), su vencimiento de 7 días y sus usos, hasta 5.
ALTER TABLE producto ADD COLUMN tipo TEXT NOT NULL DEFAULT 'fisico' CHECK (tipo IN ('fisico', 'digital'));

CREATE TABLE archivo_digital (
  org_id TEXT NOT NULL REFERENCES tienda (org_id),
  variante_id TEXT NOT NULL,
  clave TEXT NOT NULL CHECK (length(clave) BETWEEN 10 AND 200),
  nombre TEXT NOT NULL CHECK (length(nombre) BETWEEN 1 AND 120),
  tipo TEXT NOT NULL CHECK (tipo IN ('application/pdf', 'application/zip', 'audio/mpeg', 'video/mp4', 'image/jpeg', 'image/png')),
  bytes INTEGER NOT NULL CHECK (bytes BETWEEN 1 AND 50000000),
  huella TEXT NOT NULL CHECK (length(huella) = 64 AND huella NOT GLOB '*[^0-9a-f]*'),
  creado TEXT NOT NULL,
  PRIMARY KEY (org_id, variante_id)
) WITHOUT ROWID;

CREATE TABLE descarga (
  org_id TEXT NOT NULL REFERENCES tienda (org_id),
  huella TEXT NOT NULL CHECK (length(huella) = 64 AND huella NOT GLOB '*[^0-9a-f]*'),
  pedido_id TEXT NOT NULL,
  variante_id TEXT NOT NULL,
  vence TEXT NOT NULL,
  usos INTEGER NOT NULL DEFAULT 0 CHECK (usos BETWEEN 0 AND 5),
  creado TEXT NOT NULL,
  PRIMARY KEY (org_id, huella)
) WITHOUT ROWID;
CREATE INDEX descarga_por_pedido ON descarga (org_id, pedido_id, variante_id);
