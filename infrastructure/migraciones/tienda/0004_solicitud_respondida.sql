-- Una solicitud no se cierra sin respuesta (HU-T9.7 CA3, TIENDA-3.0 §8.6). El panel lo revisa antes;
-- la base lo vuelve a revisar, como con la contraentrega sin recaudo: una ruta nueva que se olvide
-- de revisarlo no cierra una solicitud que nadie respondió.
-- Costo: ninguna fila; corre solo cuando cambia el estado de una solicitud.
CREATE TRIGGER solicitud_cerrada_respondida BEFORE UPDATE OF estado ON solicitud
  WHEN NEW.estado = 'cerrada' AND NEW.respondida IS NULL
BEGIN
  SELECT RAISE(ABORT, 'solicitud_cerrada_respondida');
END;
