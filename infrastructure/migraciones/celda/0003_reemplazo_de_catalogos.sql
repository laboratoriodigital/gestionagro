-- Dos teléfonos editan lo mismo sin señal (HU-E5.4). Gana la última edición que llega a la celda:
-- se guarda con una versión nueva y la anterior pasa a `entidad_historial` como «conflicto».
-- `reemplazo` dice a quién se le reemplazó la suya (versión, teléfono y cuenta que ganó), para que
-- ese teléfono lo avise al bajar y ofrezca volver a ponerla. Nulo en una edición normal.
-- Sin índice: viaja con la fila en el pull, nunca se busca por él.
ALTER TABLE catalogo ADD COLUMN reemplazo TEXT CHECK (reemplazo IS NULL OR json_valid(reemplazo));

-- El trigger de la migración 0002 anotaba toda versión anterior como «edicion»; ahora distingue
-- la que perdió un conflicto. Se reemplaza el trigger, no se edita la migración aplicada.
DROP TRIGGER catalogo_a_historial;
CREATE TRIGGER catalogo_a_historial
BEFORE UPDATE OF version ON catalogo
BEGIN
  INSERT OR IGNORE INTO entidad_historial
    (id, org_id, entidad, entidad_id, version, datos, reemplazada, motivo)
  VALUES
    (OLD.id || '@v' || OLD.version, OLD.org_id, OLD.entidad, OLD.id, OLD.version, OLD.datos,
     NEW.actualizado, CASE WHEN NEW.reemplazo IS NULL THEN 'edicion' ELSE 'conflicto' END);
END;
