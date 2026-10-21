-- HU-T15.5: el pedido que preparó un asistente y la persona confirma.
--
-- 1. La aceptación queda en el historial del pedido como su propio paso, con la forma de pago y la
--    edad confirmada, aparte de los cambios de estado: un pedido por WhatsApp sigue pendiente
--    después de aceptarse.
INSERT INTO ref_tipo_evento (id) VALUES ('aceptacion');

-- 2. Un pedido preparado que nadie confirmó se cancela a las 48 horas (CA2). Cancelar no es avanzar:
--    no exige la aceptación que nunca hubo. Pasar a cualquier otro estado la sigue exigiendo.
DROP TRIGGER pedido_aceptacion;
CREATE TRIGGER pedido_aceptacion BEFORE UPDATE OF estado ON pedido
WHEN NEW.estado NOT IN ('pendiente', 'cancelado') AND NEW.aceptado IS NULL
  AND EXISTS (SELECT 1 FROM ref_canal WHERE id = NEW.canal AND exige_aceptacion = 1)
BEGIN
  SELECT RAISE(ABORT, 'pedido-sin-aceptacion');
END;

-- 3. Los preparados sin confirmar, en un índice parcial: el tope de 50 por tienda (HU-T15.4 CA3) y la
--    tarea de cada hora leen solo esos, nunca los demás pedidos. Costo: una fila por preparado
--    mientras espera; se va al confirmarse o al cancelarse.
CREATE INDEX pedido_de_agente_por_confirmar ON pedido (org_id, creado)
  WHERE canal = 'agente' AND estado = 'pendiente' AND aceptado IS NULL;
