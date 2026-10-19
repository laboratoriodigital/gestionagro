-- El cobro de prueba guiado (HU-T11.3, TIENDA §9.2): la primera vez que un aviso firmado de Bold
-- aprueba un cobro del ambiente de pruebas queda en la fila de la tienda, con su cobro. Prueba de una
-- vez la llave secreta (Bold aceptó la firma de integridad) y el aviso (llegó y se verificó). Sin
-- eso la tienda no pasa a cobrar en producción. Costo: ninguna fila nueva.
ALTER TABLE tienda ADD COLUMN prueba_aprobada TEXT;
ALTER TABLE tienda ADD COLUMN prueba_cobro TEXT;
-- El último cobro de prueba, para que el panel diga en qué va la prueba sin recorrer los cobros de
-- producción. Costo: 1 fila por cobro del ambiente de pruebas.
CREATE INDEX cobro_de_prueba ON cobro (org_id, creado) WHERE ambiente = 'pruebas';
-- En qué ambiente cobra cada versión publicada: el de los ajustes al publicarla, o 'ninguno' si no
-- ofrecía pagar en línea. El cobro usa el de la versión que la tienda muestra, así la franja «en
-- pruebas» y el cobro de verdad nunca se contradicen, y «Volver a esta» vuelve también al suyo. NULL:
-- una versión de antes de esta historia, que usa el de los ajustes. Costo: ninguna fila nueva.
ALTER TABLE publicacion ADD COLUMN cobro_ambiente TEXT CHECK (cobro_ambiente IS NULL OR cobro_ambiente IN ('pruebas', 'produccion', 'ninguno'));
