-- Seguir una solicitud con un enlace que no se puede adivinar (HU-T6.4, TIENDA-3.0 §8.6), como el
-- pedido (HU-T6.3): el secreto nace en el navegador del comprador y aquí solo queda su SHA-256 en
-- hexadecimal. Nulo para lo que radica el comercio desde el panel, que no tiene enlace.
-- La misma huella hace idempotente el envío: reenviar el mismo formulario no abre otra solicitud.
ALTER TABLE solicitud ADD COLUMN seguimiento_huella TEXT CHECK (
  seguimiento_huella IS NULL OR (length(seguimiento_huella) = 64 AND seguimiento_huella NOT GLOB '*[^0-9a-f]*')
);
-- Costo: 1 fila por solicitud web. Lo usan el reenvío y el seguimiento, siempre con su tienda.
CREATE UNIQUE INDEX solicitud_por_huella ON solicitud (org_id, seguimiento_huella)
  WHERE seguimiento_huella IS NOT NULL;
