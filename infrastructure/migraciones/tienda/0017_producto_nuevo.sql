-- «Nuevo» en un producto (HU-T5.10, validación del 20 oct 2026): la tarjeta y la ficha llevan su
-- etiqueta. «Destacado» ya existía (va primero en la portada). Una columna con valor por defecto:
-- no reescribe filas.
ALTER TABLE producto ADD COLUMN nuevo INTEGER NOT NULL DEFAULT 0 CHECK (nuevo IN (0, 1));
