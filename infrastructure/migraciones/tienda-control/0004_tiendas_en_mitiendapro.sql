-- HU-T18.1 (D-T15): las tiendas viven en mitiendapro.co. La dirección de plataforma de cada tienda
-- pasa de <nombre>.laboratorio-digital.app a <nombre>.mitiendapro.co, con el mismo nombre, su rol y
-- su estado. Solo staging tuvo tiendas en la zona anterior: producción no tiene filas que mover.
--
-- La de antes no queda como fila: el despacho la reconoce por su zona y la lleva a la nueva con un
-- 301, y deja pasar su API (un aviso de Bold registrado con ella sigue llegando). Así cada tienda
-- tiene una sola dirección de plataforma, y quien la lee (el panel, el KV, la vuelta al plan
-- gratuito) no tiene que elegir entre dos. Los nombres de primer nivel no cambian: `slug` no se toca.
--
-- Costo: una escritura por tienda de staging, y la de su índice. La entrada vieja de TIENDA_HOSTS se
-- queda (el despacho ya no la consulta); la nueva la escriben la publicación y la tarea diaria.
UPDATE dominio
SET hostname = substr(hostname, 1, length(hostname) - length('laboratorio-digital.app')) || 'mitiendapro.co'
WHERE tipo = 'plataforma' AND hostname GLOB '*.laboratorio-digital.app';
