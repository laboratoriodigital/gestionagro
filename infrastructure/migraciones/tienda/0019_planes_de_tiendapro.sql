-- HU-T18.3: la copia del plan de cada tienda (`tienda.plan`) sigue al CORE (core 0011): Entrada e
-- Intermedio pasan a Pro, Alto a IA Pro. `plan_vence` no cambia: lo pagado se respeta. Sin esto, una
-- tienda con un plan viejo tendría los límites del gratuito hasta el próximo token o la próxima
-- vuelta del cron (un plan que funciones.json no nombra vale como el gratuito, P1).
-- Costo: una escritura por tienda con un plan viejo (hoy, solo las de staging).
UPDATE tienda SET plan = 'pro' WHERE plan IN ('entrada', 'intermedio');
UPDATE tienda SET plan = 'ia-pro' WHERE plan = 'alto';
