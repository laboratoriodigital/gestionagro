-- Los términos de la nube y el contrato de transmisión que cada caja aceptó (HU-Q7.11 CA1;
-- PARQUEADERO §13.2; `content/parqueadero/privacidad/terminos.json`): la versión y el instante en que
-- se aceptaron en la caja, en UTC. Nulos en una caja que todavía no los registra; la celda no la
-- deja sincronizar sin la versión vigente. Sin índice: se leen con la fila de la caja.
ALTER TABLE dispositivo ADD COLUMN terminos_version TEXT
  CHECK (terminos_version IS NULL OR length(terminos_version) BETWEEN 1 AND 20);
ALTER TABLE dispositivo ADD COLUMN terminos_aceptados TEXT
  CHECK ((terminos_version IS NULL) = (terminos_aceptados IS NULL));
