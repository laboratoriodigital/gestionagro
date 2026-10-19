-- El re-horneado por anillos (HU-T4.6, TIENDA §10.6). Cada versión publicada guarda la release de la
-- vitrina con que se horneó (`/_t/<release>/`), para saber qué tiendas faltan cuando llega otra. La
-- tienda guarda su anillo de despliegue, que viene del CORE en el token (ARQUITECTURA §5.4): el 1,
-- las piloto, recibe primero cada release; las demás, pasadas 24 horas sin fallas. Costo: ninguna
-- fila nueva.
ALTER TABLE publicacion ADD COLUMN release TEXT CHECK (release IS NULL OR length(release) BETWEEN 1 AND 40);
ALTER TABLE tienda ADD COLUMN anillo INTEGER NOT NULL DEFAULT 2 CHECK (anillo >= 1);
