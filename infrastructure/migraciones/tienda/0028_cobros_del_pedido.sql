-- Los cobros de un pedido, del último al primero: el panel muestra el último al abrir el pedido, le
-- pregunta a Bold por él y, si venció sin pagarse, deja cancelar (validación del sprint PF3). Sin
-- este índice, cada pedido abierto leería todos los cobros de la tienda. Costo: una fila por cobro.
CREATE INDEX cobro_del_pedido ON cobro (org_id, pedido_id, creado);
