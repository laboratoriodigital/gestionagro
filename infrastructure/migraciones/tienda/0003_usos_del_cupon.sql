-- Los usos del cupón (HU-T10.1 CA2, TIENDA-3.0 §5.3 y §7.3). Un uso cuenta cuando el pedido sale
-- del inventario (confirmado o pagado: `ref_estado_pedido.descuenta` pasa de 0 a 1) y se devuelve
-- si el pedido se cancela. En la 2.0 nadie los sumaba y un cupón de 50 usos no se agotaba nunca
-- (bitácora ecommerce 41).
--
-- Un pedido que se cotizó con el cupón vigente se respeta aunque otro haya gastado el último uso
-- antes de confirmarlo (Ley 1480 art. 26: el precio informado obliga): no falla ni el pago ni la
-- confirmación, y ese pedido no cuenta. `cupon_contado` dice si este pedido gastó un uso, para que
-- cancelarlo devuelva exactamente lo que gastó.
ALTER TABLE pedido ADD COLUMN cupon_contado INTEGER NOT NULL DEFAULT 0 CHECK (cupon_contado IN (0, 1));

CREATE TRIGGER pedido_cupon_cuenta AFTER UPDATE OF estado ON pedido
WHEN NEW.cupon_codigo IS NOT NULL AND NEW.cupon_contado = 0
  AND (SELECT descuenta FROM ref_estado_pedido WHERE id = OLD.estado) = 0
  AND (SELECT descuenta FROM ref_estado_pedido WHERE id = NEW.estado) = 1
BEGIN
  UPDATE pedido SET cupon_contado = 1
   WHERE org_id = NEW.org_id AND id = NEW.id
     AND EXISTS (SELECT 1 FROM cupon c WHERE c.org_id = NEW.org_id AND c.codigo = NEW.cupon_codigo
                   AND (c.usos_maximos IS NULL OR c.usos < c.usos_maximos));
  UPDATE cupon SET usos = usos + 1
   WHERE org_id = NEW.org_id AND codigo = NEW.cupon_codigo
     AND (usos_maximos IS NULL OR usos < usos_maximos);
END;

CREATE TRIGGER pedido_cupon_devuelve AFTER UPDATE OF estado ON pedido
WHEN NEW.estado = 'cancelado' AND OLD.estado <> 'cancelado' AND NEW.cupon_contado = 1
BEGIN
  UPDATE cupon SET usos = usos - 1
   WHERE org_id = NEW.org_id AND codigo = NEW.cupon_codigo AND usos > 0;
  UPDATE pedido SET cupon_contado = 0 WHERE org_id = NEW.org_id AND id = NEW.id;
END;
