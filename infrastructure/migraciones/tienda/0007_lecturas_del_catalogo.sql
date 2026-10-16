-- Lo que el panel lee con la tienda llena (bitácora tienda3 26). El plan gratuito de D1 da 5
-- millones de filas leídas al día para toda la cuenta, y cada fila que una consulta recorre cuenta,
-- también las de un índice.
--
-- 1. Las combinaciones de un producto, en su orden. Sin estadísticas, SQLite prefería recorrer
--    todas las combinaciones de la tienda por la llave primaria (`org_id`) antes que el UNIQUE
--    (org_id, producto_id, clave), que no da el orden: abrir o guardar un producto leía las
--    12.000 combinaciones. Costo: una fila de índice por combinación.
CREATE INDEX variante_por_producto ON variante (org_id, producto_id, posicion, clave);

-- 2. Las combinaciones agotadas del tablero: el índice solo tiene las agotadas, así que contarlas
--    lee esas y no todas. Costo: una fila por combinación agotada, que se escribe al agotarse.
CREATE INDEX variante_agotada ON variante (org_id, producto_id)
  WHERE activa = 1 AND stock IS NOT NULL AND stock <= reservado;

-- 3. Los productos en el orden del panel: la página de 50 recorre 50 filas del índice y no ordena
--    los 2.000 de la tienda. El de Productos incluye la papelera; el del inventario, no. Costo: dos
--    filas de índice por producto.
CREATE INDEX producto_en_orden ON producto (org_id, posicion, nombre, id);
CREATE INDEX producto_en_orden_por_slug ON producto (org_id, posicion, slug) WHERE borrado IS NULL;

-- 4. Cuántas combinaciones activas tiene cada producto, al día por los triggers de abajo. El total
--    del inventario es la suma por producto (una fila por producto) y no la cuenta de todas las
--    combinaciones (una fila por combinación). Costo: una escritura más en el producto cuando una
--    combinación nace, se borra o cambia de activa.
ALTER TABLE producto ADD COLUMN combinaciones INTEGER NOT NULL DEFAULT 0 CHECK (combinaciones >= 0);
UPDATE producto SET combinaciones = (
  SELECT count(*) FROM variante v
   WHERE v.org_id = producto.org_id AND v.producto_id = producto.id AND v.activa = 1
);
CREATE TRIGGER variante_cuenta_al_crear AFTER INSERT ON variante WHEN NEW.activa = 1
BEGIN
  UPDATE producto SET combinaciones = combinaciones + 1
   WHERE org_id = NEW.org_id AND id = NEW.producto_id;
END;
CREATE TRIGGER variante_cuenta_al_borrar AFTER DELETE ON variante WHEN OLD.activa = 1
BEGIN
  UPDATE producto SET combinaciones = combinaciones - 1
   WHERE org_id = OLD.org_id AND id = OLD.producto_id;
END;
CREATE TRIGGER variante_cuenta_al_cambiar AFTER UPDATE OF activa, producto_id ON variante
  WHEN OLD.activa <> NEW.activa OR OLD.producto_id <> NEW.producto_id
BEGIN
  UPDATE producto SET combinaciones = combinaciones - 1
   WHERE OLD.activa = 1 AND org_id = OLD.org_id AND id = OLD.producto_id;
  UPDATE producto SET combinaciones = combinaciones + 1
   WHERE NEW.activa = 1 AND org_id = NEW.org_id AND id = NEW.producto_id;
END;
