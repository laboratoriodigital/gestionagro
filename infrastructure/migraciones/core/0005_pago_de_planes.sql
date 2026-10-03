-- Pagar un plan en línea (HU-E0.7). Excepción del dueño a ARQUITECTURA §2.3 (3 oct 2026): el plan
-- Finca se cobra cuando un cliente lo pide, sin esperar los umbrales.
--
-- `plan_vence`: hasta cuándo vale el plan pagado (ISO). Null = no vence: el gratuito, o un plan
-- puesto a mano. Vencido, el directorio entrega «gratuito» y la finca no pierde nada: el plan solo
-- decide qué funciones se ven.
ALTER TABLE organizacion ADD COLUMN plan_vence TEXT;

-- Un cobro por intento. Es el CORE del ecosistema (ARQUITECTURA §14, HA3): el pago dice de qué
-- producto es y con qué proveedor se cobró (ED1 §5.3, adaptador), aunque hoy solo hay `agro` y
-- `bold`. `id` es el código de la orden en el proveedor. El monto lo calcula el CORE desde
-- planes.json, nunca la página. Sin datos de tarjeta ni del comprador: el proveedor los tiene, el
-- CORE solo la transacción. Solo sale de «esperando» una vez, así que confirmar dos veces no
-- extiende el plan dos veces. Sin noticias en 24 h queda «vencido», como en la Tienda.
CREATE TABLE pago (
  id TEXT PRIMARY KEY,
  producto TEXT NOT NULL CHECK (producto IN ('agro')),
  proveedor TEXT NOT NULL CHECK (proveedor IN ('bold')),
  org_id TEXT NOT NULL REFERENCES organizacion (id),
  usuario_id TEXT NOT NULL REFERENCES usuario (id),
  plan TEXT NOT NULL CHECK (plan IN ('finca', 'exportador', 'cadena')),
  meses INTEGER NOT NULL CHECK (meses > 0),
  monto_cop INTEGER NOT NULL CHECK (monto_cop > 0),
  ambiente TEXT NOT NULL CHECK (ambiente IN ('pruebas', 'produccion')),
  estado TEXT NOT NULL CHECK (estado IN ('esperando', 'aprobado', 'rechazado', 'revisar', 'vencido')),
  transaccion TEXT,
  motivo TEXT,
  creado TEXT NOT NULL,
  actualizado TEXT NOT NULL
);
-- Los cobros de una finca: la pantalla busca el último.
CREATE INDEX pago_org ON pago (org_id, creado);
-- La conciliación (cada 15 min) busca los que siguen esperando: un índice parcial, pequeño, porque
-- casi todos los cobros salen de «esperando» en minutos.
CREATE INDEX pago_esperando ON pago (creado) WHERE estado = 'esperando';
