-- CORE · dimensión de producto (ARQUITECTURA-PLATAFORMA §4). Fase EXPANDIR de §7.4: el código v0
-- sigue funcionando entre la migración y el despliegue del Worker nuevo, porque cada columna nueva
-- trae el valor que el v0 supone ('agro', 'activa').
--
-- SQLite no cambia un CHECK ni agrega una columna con REFERENCES y valor por defecto distinto de
-- NULL sin rehacer la tabla. Se rehace con el patrón de 12 pasos de SQLite: crear la nueva, copiar,
-- borrar la vieja, renombrar la nueva. NUNCA al revés (renombrar la vieja primero): desde SQLite
-- 3.26 eso reescribe las claves foráneas de las demás tablas hacia la vieja.
-- `defer_foreign_keys` deja las claves foráneas para el final de la transacción de la migración.
--
-- Los catálogos (producto, tipos, roles, planes, precios) se siembran aquí solo con lo que ya
-- nombran las filas de hoy. El despliegue los pone al día desde infrastructure/productos.json y
-- content/<producto>/planes.json (P2), como hace con `celda` desde celdas.json.
--
-- Costo en filas escritas: cada fila copiada cuenta una vez por la tabla y una por índice. Con el
-- volumen de hoy (decenas de organizaciones y cientos de sesiones) son unos pocos miles.

PRAGMA defer_foreign_keys = on;

-- 1. Catálogos de producto ------------------------------------------------------------------

CREATE TABLE producto (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 2 AND 24 AND id NOT GLOB '*[^a-z0-9-]*'),
  nombre TEXT NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('activo', 'pausado', 'retirado')),
  actualizado TEXT NOT NULL
);

CREATE TABLE producto_tipo (
  producto TEXT NOT NULL REFERENCES producto (id),
  tipo TEXT NOT NULL CHECK (tipo NOT GLOB '*[^a-z_]*'),
  PRIMARY KEY (producto, tipo)
) WITHOUT ROWID;

-- `administra`: paga el plan, invita, cambia roles y quita personas (el «propietario» de hoy).
-- `invitable`: se puede dar con una invitación (el auditor llega con su enlace propio).
CREATE TABLE producto_rol (
  producto TEXT NOT NULL REFERENCES producto (id),
  rol TEXT NOT NULL CHECK (rol NOT GLOB '*[^a-z_]*'),
  administra INTEGER NOT NULL CHECK (administra IN (0, 1)),
  invitable INTEGER NOT NULL CHECK (invitable IN (0, 1)),
  PRIMARY KEY (producto, rol)
) WITHOUT ROWID;

CREATE TABLE plan (
  producto TEXT NOT NULL REFERENCES producto (id),
  id TEXT NOT NULL CHECK (id NOT GLOB '*[^a-z0-9_-]*'),
  nombre TEXT NOT NULL,
  gratuito INTEGER NOT NULL CHECK (gratuito IN (0, 1)),
  estado TEXT NOT NULL CHECK (estado IN ('activo', 'retirado')),
  PRIMARY KEY (producto, id)
) WITHOUT ROWID;

-- Precio de un plan por periodo de prepago (decisión del dueño, 5 oct 2026: mensual, trimestral
-- y anual). Un precio no se edita: uno nuevo entra con su `vigente_desde` y el anterior queda como
-- historia (P21). El cobro guarda el monto que cobró, así que la historia no cambia el pasado.
CREATE TABLE plan_precio (
  producto TEXT NOT NULL,
  plan TEXT NOT NULL,
  meses INTEGER NOT NULL CHECK (meses IN (1, 3, 12)),
  monto_cop INTEGER NOT NULL CHECK (monto_cop >= 1000),
  vigente_desde TEXT NOT NULL,
  PRIMARY KEY (producto, plan, meses, vigente_desde),
  FOREIGN KEY (producto, plan) REFERENCES plan (producto, id)
) WITHOUT ROWID;

INSERT INTO producto (id, nombre, estado, actualizado)
  VALUES ('agro', 'CultivoPro', 'activo', '2026-10-05T00:00:00.000Z');
INSERT INTO producto_tipo (producto, tipo)
  VALUES ('agro', 'finca'), ('agro', 'asesor'), ('agro', 'cadena');
INSERT INTO producto_rol (producto, rol, administra, invitable) VALUES
  ('agro', 'propietario', 1, 1),
  ('agro', 'supervisor', 0, 1),
  ('agro', 'operario', 0, 1),
  ('agro', 'asesor', 0, 1),
  ('agro', 'auditor', 0, 0);
INSERT INTO plan (producto, id, nombre, gratuito, estado) VALUES
  ('agro', 'gratuito', 'Gratis', 1, 'activo'),
  ('agro', 'finca', 'Finca', 0, 'activo'),
  ('agro', 'exportador', 'Exportador', 0, 'activo'),
  ('agro', 'cadena', 'Cadena', 0, 'activo');
INSERT INTO plan_precio (producto, plan, meses, monto_cop, vigente_desde)
  VALUES ('agro', 'finca', 1, 39000, '2026-10-03T00:00:00.000Z');

-- 2. Celda: cada celda es de un producto ---------------------------------------------------

CREATE TABLE celda_nueva (
  id TEXT PRIMARY KEY,
  producto TEXT NOT NULL DEFAULT 'agro' REFERENCES producto (id),
  url_api TEXT,
  clave_publica TEXT,
  clave_publica_anterior TEXT,
  estado TEXT NOT NULL CHECK (estado IN ('activa', 'fuera')),
  anillo_despliegue INTEGER NOT NULL,
  shards TEXT NOT NULL CHECK (json_valid(shards) AND json_type(shards) = 'array'),
  UNIQUE (id, producto)
);
INSERT INTO celda_nueva (id, producto, url_api, clave_publica, clave_publica_anterior, estado, anillo_despliegue, shards)
  SELECT id, 'agro', url_api, clave_publica, clave_publica_anterior, estado, anillo_despliegue, shards FROM celda;
DROP TABLE celda;
ALTER TABLE celda_nueva RENAME TO celda;

-- 3. Organización: producto, estado y claves foráneas compuestas ----------------------------
-- UNIQUE (id, producto) existe para que membresía, invitación, interés y pago puedan exigir, con
-- una clave foránea, que su producto sea el de la organización.

CREATE TABLE organizacion_nueva (
  id TEXT PRIMARY KEY,
  producto TEXT NOT NULL DEFAULT 'agro' REFERENCES producto (id),
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL,
  plan TEXT NOT NULL,
  plan_vence TEXT,
  estado TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'mudando', 'suspendida', 'baja')),
  celda_id TEXT NOT NULL,
  shard TEXT NOT NULL,
  anillo INTEGER NOT NULL CHECK (anillo IN (1, 2)),
  creado TEXT NOT NULL,
  UNIQUE (id, producto),
  FOREIGN KEY (producto, tipo) REFERENCES producto_tipo (producto, tipo),
  FOREIGN KEY (producto, plan) REFERENCES plan (producto, id),
  FOREIGN KEY (celda_id, producto) REFERENCES celda (id, producto)
);
INSERT INTO organizacion_nueva (id, producto, nombre, tipo, plan, plan_vence, estado, celda_id, shard, anillo, creado)
  SELECT id, 'agro', nombre, tipo, plan, plan_vence, 'activa', celda_id, shard, anillo, creado FROM organizacion;
DROP TABLE organizacion;
ALTER TABLE organizacion_nueva RENAME TO organizacion;
-- Asignación (asignacion.ts) cuenta organizaciones por celda y shard de un producto.
-- Costo: 1 fila más por organización creada.
CREATE INDEX organizacion_por_celda ON organizacion (producto, celda_id, shard);

-- 4. Membresía e invitación: el rol es del producto de la organización ----------------------

CREATE TABLE membresia_nueva (
  usuario_id TEXT NOT NULL REFERENCES usuario (id),
  org_id TEXT NOT NULL,
  producto TEXT NOT NULL DEFAULT 'agro',
  rol TEXT NOT NULL,
  creado TEXT NOT NULL,
  PRIMARY KEY (usuario_id, org_id),
  FOREIGN KEY (org_id, producto) REFERENCES organizacion (id, producto),
  FOREIGN KEY (producto, rol) REFERENCES producto_rol (producto, rol)
);
INSERT INTO membresia_nueva (usuario_id, org_id, producto, rol, creado)
  SELECT usuario_id, org_id, 'agro', rol, creado FROM membresia;
DROP TABLE membresia;
ALTER TABLE membresia_nueva RENAME TO membresia;
CREATE INDEX membresia_por_finca ON membresia (org_id);

CREATE TABLE invitacion_nueva (
  codigo_hash TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  producto TEXT NOT NULL DEFAULT 'agro',
  rol TEXT NOT NULL,
  expira TEXT NOT NULL,
  creada_por TEXT NOT NULL REFERENCES usuario (id),
  creada TEXT NOT NULL,
  usada_por TEXT REFERENCES usuario (id),
  usada TEXT,
  FOREIGN KEY (org_id, producto) REFERENCES organizacion (id, producto),
  FOREIGN KEY (producto, rol) REFERENCES producto_rol (producto, rol)
);
INSERT INTO invitacion_nueva (codigo_hash, org_id, producto, rol, expira, creada_por, creada, usada_por, usada)
  SELECT codigo_hash, org_id, 'agro', rol, expira, creada_por, creada, usada_por, usada FROM invitacion;
DROP TABLE invitacion;
ALTER TABLE invitacion_nueva RENAME TO invitacion;

-- 5. Interés y pago: el plan es del producto de la organización ------------------------------

CREATE TABLE interes_plan_nueva (
  usuario_id TEXT NOT NULL REFERENCES usuario (id),
  org_id TEXT NOT NULL,
  producto TEXT NOT NULL DEFAULT 'agro',
  plan TEXT NOT NULL,
  creado TEXT NOT NULL,
  PRIMARY KEY (usuario_id, org_id, plan),
  FOREIGN KEY (org_id, producto) REFERENCES organizacion (id, producto),
  FOREIGN KEY (producto, plan) REFERENCES plan (producto, id)
);
INSERT INTO interes_plan_nueva (usuario_id, org_id, producto, plan, creado)
  SELECT usuario_id, org_id, 'agro', plan, creado FROM interes_plan;
DROP TABLE interes_plan;
ALTER TABLE interes_plan_nueva RENAME TO interes_plan;

-- `periodo_desde` y `periodo_hasta`: lo que cubrió el pago, escrito al aprobarlo (nulos mientras
-- espera). Sirven al soporte («¿hasta cuándo pagué?») y a la facturación cuando llegue.
CREATE TABLE pago_nueva (
  id TEXT PRIMARY KEY,
  producto TEXT NOT NULL DEFAULT 'agro' REFERENCES producto (id),
  proveedor TEXT NOT NULL CHECK (proveedor IN ('bold')),
  org_id TEXT NOT NULL,
  usuario_id TEXT NOT NULL REFERENCES usuario (id),
  plan TEXT NOT NULL,
  meses INTEGER NOT NULL CHECK (meses IN (1, 3, 12)),
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
INSERT INTO pago_nueva (id, producto, proveedor, org_id, usuario_id, plan, meses, monto_cop, ambiente, estado, transaccion, motivo, creado, actualizado)
  SELECT id, producto, proveedor, org_id, usuario_id, plan, meses, monto_cop, ambiente, estado, transaccion, motivo, creado, actualizado FROM pago;
DROP TABLE pago;
ALTER TABLE pago_nueva RENAME TO pago;
CREATE INDEX pago_org ON pago (org_id, creado);
CREATE INDEX pago_esperando ON pago (creado) WHERE estado = 'esperando';

-- 6. Sesión: un refresh sirve a un solo producto ------------------------------------------
-- Un refresh robado del panel de la tienda no emite tokens del cuaderno, ni al revés.

CREATE TABLE sesion_nueva (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuario (id),
  producto TEXT NOT NULL DEFAULT 'agro' REFERENCES producto (id),
  refresh_hash TEXT NOT NULL UNIQUE,
  dispositivo TEXT NOT NULL,
  creado TEXT NOT NULL,
  expira TEXT NOT NULL,
  revocado TEXT
);
INSERT INTO sesion_nueva (id, usuario_id, producto, refresh_hash, dispositivo, creado, expira, revocado)
  SELECT id, usuario_id, 'agro', refresh_hash, dispositivo, creado, expira, revocado FROM sesion;
DROP TABLE sesion;
ALTER TABLE sesion_nueva RENAME TO sesion;
CREATE INDEX sesion_por_usuario ON sesion (usuario_id);

-- 7. Política aceptada por producto (expandir; `usuario.politica_*` se retira en una versión
--    posterior, cuando ningún código la lea: contraer).

CREATE TABLE aceptacion_politica (
  usuario_id TEXT NOT NULL REFERENCES usuario (id),
  producto TEXT NOT NULL REFERENCES producto (id),
  version TEXT NOT NULL,
  aceptada TEXT NOT NULL,
  PRIMARY KEY (usuario_id, producto, version)
) WITHOUT ROWID;
INSERT INTO aceptacion_politica (usuario_id, producto, version, aceptada)
  SELECT id, 'agro', politica_version, politica_aceptada FROM usuario
   WHERE politica_version IS NOT NULL AND politica_aceptada IS NOT NULL;

-- 8. Cierre. Apagar `defer_foreign_keys` dentro de la transacción PONE EN CERO el contador de
--    violaciones diferidas (SQLite, pragma.c): sin esto, rehacer una tabla padre con hijas falla
--    al confirmar aunque los datos estén bien; con esto, una violación real también pasaría
--    callada. Por eso la guarda: si queda una sola fila huérfana, el CHECK aborta la migración.
PRAGMA defer_foreign_keys = off;
CREATE TABLE _guarda_fk (huerfanas INTEGER NOT NULL CHECK (huerfanas = 0));
INSERT INTO _guarda_fk (huerfanas) SELECT COUNT(*) FROM pragma_foreign_key_check;
DROP TABLE _guarda_fk;
