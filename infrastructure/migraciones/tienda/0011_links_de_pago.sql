-- Los links de pago (HU-T11.8, TIENDA §9.6): el pedido que llegó por el chat se cobra en línea con un
-- link de Bold. El cobro guarda el id del link (`LNK_…`), para preguntarle a Bold por él, y su
-- dirección, para volver a mandarla mientras siga vigente. NULL en los cobros del botón.
-- Costo: ninguna fila nueva.
ALTER TABLE cobro ADD COLUMN link TEXT;
ALTER TABLE cobro ADD COLUMN link_url TEXT CHECK (link_url IS NULL OR link_url GLOB 'https://*');
