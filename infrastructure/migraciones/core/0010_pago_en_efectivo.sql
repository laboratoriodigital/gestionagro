-- CORE · pago en efectivo (HU-C5.8). El cliente le paga el plan al dueño en mano y el dueño lo
-- registra desde GitHub (flujo `registrar-pago-en-efectivo`, docs/runbooks/pago-en-efectivo.md).
-- El pago queda en la misma tabla, con `proveedor = 'efectivo'`: «Tus pagos», la auditoría y la
-- vuelta de cada hora hacia las celdas lo leen como cualquier otro.
--
-- SQLite no cambia un CHECK sin rehacer la tabla: el patrón de 12 pasos de la 0006 (crear la nueva,
-- copiar, borrar la vieja, renombrar la nueva; nunca al revés). Fase EXPANDIR: el Worker de antes
-- sigue funcionando, porque solo se agrega un valor permitido. Costo: una escritura por fila de
-- `pago` y por índice; hoy son decenas.

PRAGMA defer_foreign_keys = on;

CREATE TABLE pago_nueva (
  id TEXT PRIMARY KEY,
  producto TEXT NOT NULL DEFAULT 'agro' REFERENCES producto (id),
  proveedor TEXT NOT NULL CHECK (proveedor IN ('bold', 'efectivo')),
  org_id TEXT NOT NULL,
  usuario_id TEXT NOT NULL REFERENCES usuario (id),
  plan TEXT NOT NULL,
  meses INTEGER NOT NULL REFERENCES periodo (meses),
  monto_cop INTEGER NOT NULL CHECK (monto_cop > 0),
  ambiente TEXT NOT NULL CHECK (ambiente IN ('pruebas', 'produccion')),
  estado TEXT NOT NULL CHECK (estado IN ('esperando', 'aprobado', 'rechazado', 'revisar', 'vencido')),
  transaccion TEXT,
  motivo TEXT,
  periodo_desde TEXT,
  periodo_hasta TEXT,
  creado TEXT NOT NULL,
  actualizado TEXT NOT NULL,
  FOREIGN KEY (org_id, producto) REFERENCES organizacion (id, producto),
  FOREIGN KEY (producto, plan) REFERENCES plan (producto, id)
);
INSERT INTO pago_nueva (id, producto, proveedor, org_id, usuario_id, plan, meses, monto_cop, ambiente, estado, transaccion, motivo, periodo_desde, periodo_hasta, creado, actualizado)
  SELECT id, producto, proveedor, org_id, usuario_id, plan, meses, monto_cop, ambiente, estado, transaccion, motivo, periodo_desde, periodo_hasta, creado, actualizado FROM pago;
DROP TABLE pago;
ALTER TABLE pago_nueva RENAME TO pago;
CREATE INDEX pago_org ON pago (org_id, creado);
CREATE INDEX pago_esperando ON pago (creado) WHERE estado = 'esperando';
