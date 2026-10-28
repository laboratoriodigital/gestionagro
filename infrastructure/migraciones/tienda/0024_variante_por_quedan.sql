-- «Por agotarse» (HU-P2.2, sprint PF2): las combinaciones que quedan en el mínimo de Avisos o por
-- debajo, sin estar agotadas. El índice ordena las que cuentan existencias por lo que les queda, así
-- contarlas lee solo esas y no el catálogo entero (con 12.000 combinaciones, el tablero leía 12.000
-- filas: bitácora tienda3 66). Costo: una entrada por combinación que cuenta existencias, que se
-- reescribe cuando cambian sus existencias o lo apartado.
CREATE INDEX variante_por_quedan ON variante (org_id, stock - reservado)
  WHERE activa = 1 AND stock IS NOT NULL;
