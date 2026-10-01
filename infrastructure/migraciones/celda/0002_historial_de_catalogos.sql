-- Al actualizar un catálogo, la versión anterior pasa a `entidad_historial` (HU-E5.2, ADR-4).
-- En un trigger y no en el código, para que actualizar sea UNA sentencia: el push hace una
-- escritura por operación y un lote de 25 cabe en las 50 consultas por invocación de D1 gratuito.
-- Costo: la fila del historial y su clave, solo cuando un catálogo cambia de versión.
CREATE TRIGGER catalogo_a_historial
BEFORE UPDATE OF version ON catalogo
BEGIN
  INSERT OR IGNORE INTO entidad_historial
    (id, org_id, entidad, entidad_id, version, datos, reemplazada, motivo)
  VALUES
    (OLD.id || '@v' || OLD.version, OLD.org_id, OLD.entidad, OLD.id, OLD.version, OLD.datos,
     NEW.actualizado, 'edicion');
END;
