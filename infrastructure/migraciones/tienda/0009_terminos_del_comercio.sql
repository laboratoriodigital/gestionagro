-- Los términos del servicio y el contrato de transmisión que acepta el comercio (HU-T7.2), y la
-- cláusula de custodia de sus llaves de Bold (HU-T11.2, TIENDA §9.2). La fila de la tienda guarda
-- la huella del texto aceptado, cuándo y quién: publicar y conectar el cobro la comparan con la del
-- texto vigente sin recorrer el registro, que también guarda cada aceptación con su huella.
-- Costo: ninguna fila nueva; se escribe una vez por versión aceptada.
ALTER TABLE tienda ADD COLUMN terminos_huella TEXT CHECK (terminos_huella IS NULL OR (length(terminos_huella) = 64 AND terminos_huella NOT GLOB '*[^0-9a-f]*'));
ALTER TABLE tienda ADD COLUMN terminos_aceptados TEXT;
ALTER TABLE tienda ADD COLUMN terminos_por TEXT;
ALTER TABLE tienda ADD COLUMN custodia_huella TEXT CHECK (custodia_huella IS NULL OR (length(custodia_huella) = 64 AND custodia_huella NOT GLOB '*[^0-9a-f]*'));
ALTER TABLE tienda ADD COLUMN custodia_aceptada TEXT;
ALTER TABLE tienda ADD COLUMN custodia_por TEXT;
