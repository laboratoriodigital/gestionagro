-- Los eventos que cuadran con los pedidos (HU-T14.6, TIENDA §11.6): cada semana, por tienda, cuántos
-- pedidos y pagos hay en la base y cuántos contó la medición de la vitrina (HU-T14.1). Una fila por
-- tienda y semana; el tablero lee la última. Las ventas del tablero nunca salen de aquí (CA2).
CREATE TABLE cuadre_de_eventos (
  org_id TEXT NOT NULL REFERENCES tienda (org_id),
  semana TEXT NOT NULL CHECK (length(semana) = 10),  -- el primer día, AAAA-MM-DD de Colombia
  pedidos_base INTEGER NOT NULL CHECK (pedidos_base >= 0),
  pedidos_eventos INTEGER NOT NULL CHECK (pedidos_eventos >= 0),
  pagos_base INTEGER NOT NULL CHECK (pagos_base >= 0),
  pagos_eventos INTEGER NOT NULL CHECK (pagos_eventos >= 0),
  calculado TEXT NOT NULL,
  PRIMARY KEY (org_id, semana)
) WITHOUT ROWID;
