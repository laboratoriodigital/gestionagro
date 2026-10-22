-- CORE · los planes de TiendaPro (HU-T18.3, D-T3 decidida por el dueño el 22 oct 2026): Gratis, Pro
-- e IA Pro. `entrada`, `intermedio` y `alto` quedan retirados por el catálogo (P21), y aquí las
-- tiendas que los tenían pasan al nuevo que los cubre: Entrada e Intermedio a Pro, Alto a IA Pro.
-- Lo pagado se respeta: `plan_vence` no cambia. Los pagos de antes siguen nombrando su plan, que
-- existe retirado.
--
-- Va antes que el catálogo en el despliegue: una organización nombra un plan que exista (FOREIGN KEY
-- (producto, plan)), así que los dos nuevos se aseguran aquí; el catálogo les pone después su
-- nombre y sus precios. En una base sin la Tienda no hace nada.
-- Costo: dos filas de `plan` y una escritura por tienda con un plan viejo (hoy, solo las de staging).
INSERT OR IGNORE INTO plan (producto, id, nombre, gratuito, estado)
  SELECT 'tienda', 'pro', 'Pro', 0, 'activo' WHERE EXISTS (SELECT 1 FROM producto WHERE id = 'tienda');
INSERT OR IGNORE INTO plan (producto, id, nombre, gratuito, estado)
  SELECT 'tienda', 'ia-pro', 'IA Pro', 0, 'activo' WHERE EXISTS (SELECT 1 FROM producto WHERE id = 'tienda');
UPDATE organizacion SET plan = 'pro' WHERE producto = 'tienda' AND plan IN ('entrada', 'intermedio');
UPDATE organizacion SET plan = 'ia-pro' WHERE producto = 'tienda' AND plan = 'alto';
