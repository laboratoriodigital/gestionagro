-- Los dominios propios que esperan a Cloudflare (HU-T13.1, TIENDA §4.2 paso 4): la tarea de cada
-- hora pregunta por los que están pendientes o validando, y con el índice lee solo esas filas, no
-- todos los hostnames de la celda. Costo: una entrada por dominio que espera; ninguna cuando no hay.
CREATE INDEX dominio_por_validar ON dominio (creado) WHERE estado IN ('pendiente', 'validando');
