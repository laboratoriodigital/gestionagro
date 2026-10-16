-- Los correos de la tienda (HU-T14.3, TIENDA-3.0 §15.5): el resumen diario al comercio, el acuse al
-- comprador y el resultado del cobro de prueba. Cada correo tiene una clave que no se repite
-- (`resumen:<día>`, `acuse:<pedido>`, `prueba:<cobro>`): dos corridas del mismo día no mandan dos.
-- Solo `enviado` es enviado (P1): un correo que no salió queda `fallido` con su motivo y no cuenta
-- para el tope del día. `enviando` sí cuenta, para que dos envíos a la vez no pasen el tope.
-- Nada del contenido se guarda: ni el destinatario ni el texto, que pueden ser datos personales.
-- Costo: una fila por correo y una o dos escrituras más; a lo sumo el tope por tienda por día.
CREATE TABLE correo (
  org_id TEXT NOT NULL REFERENCES tienda (org_id),
  clave TEXT NOT NULL CHECK (length(clave) BETWEEN 3 AND 120),
  tipo TEXT NOT NULL CHECK (tipo IN ('resumen', 'acuse', 'prueba')),
  dia TEXT NOT NULL CHECK (dia GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),  -- de Bogotá
  estado TEXT NOT NULL CHECK (estado IN ('enviando', 'enviado', 'fallido')),
  intentos INTEGER NOT NULL DEFAULT 1 CHECK (intentos BETWEEN 1 AND 3),
  motivo TEXT CHECK (motivo IS NULL OR motivo IN ('no-disponible', 'tope', 'rechazado', 'falla', 'invalido')),
  detalle TEXT CHECK (detalle IS NULL OR length(detalle) <= 300),
  proveedor_id TEXT CHECK (proveedor_id IS NULL OR length(proveedor_id) <= 100),
  creado TEXT NOT NULL,
  actualizado TEXT NOT NULL,
  PRIMARY KEY (org_id, clave),
  CHECK ((estado = 'fallido') = (motivo IS NOT NULL)),
  CHECK (estado <> 'enviado' OR proveedor_id IS NOT NULL)
) WITHOUT ROWID;
-- El tope del día de cada tienda, y el de la celda entera (que suma los shards).
CREATE INDEX correo_por_dia ON correo (dia, org_id, estado);
