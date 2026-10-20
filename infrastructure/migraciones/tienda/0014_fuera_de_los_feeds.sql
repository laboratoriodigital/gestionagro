-- Los feeds de productos (HU-T14.5): lo que la versión publicada dejó fuera de los feeds, y por qué
-- (sin foto o sin precio), en JSON. Lo calcula publicar, que ya lee la tienda entera; el panel lo
-- lee de una fila en vez de recorrer los productos. NULL si la versión no tiene feeds encendidos.
-- Costo: ninguna fila nueva.
ALTER TABLE publicacion ADD COLUMN fuera_de_los_feeds TEXT CHECK (fuera_de_los_feeds IS NULL OR json_valid(fuera_de_los_feeds));
