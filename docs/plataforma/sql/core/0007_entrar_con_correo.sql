-- CORE · entrar con un enlace por correo (ED1 §5.2). Llega cuando haya proveedor de correo.
-- `identidad.proveedor` pasa de CHECK a tabla de referencia: el próximo proveedor (Microsoft,
-- Apple) es un INSERT, no otra reconstrucción. `identidad` es solo hija (de `usuario`), así que
-- rehacerla no deja contador diferido; la guarda va igual, por regla.

PRAGMA defer_foreign_keys = on;

CREATE TABLE proveedor_identidad (
  id TEXT PRIMARY KEY CHECK (id NOT GLOB '*[^a-z0-9-]*')
) WITHOUT ROWID;
INSERT INTO proveedor_identidad (id) VALUES ('google'), ('correo');

CREATE TABLE identidad_nueva (
  proveedor TEXT NOT NULL REFERENCES proveedor_identidad (id),
  sub TEXT NOT NULL,                     -- con 'correo', el correo normalizado (minúsculas, sin espacios)
  usuario_id TEXT NOT NULL REFERENCES usuario (id),
  creada TEXT,
  PRIMARY KEY (proveedor, sub)
);
INSERT INTO identidad_nueva (proveedor, sub, usuario_id) SELECT proveedor, sub, usuario_id FROM identidad;
DROP TABLE identidad;
ALTER TABLE identidad_nueva RENAME TO identidad;

-- Un enlace de entrada: un solo uso, 15 minutos, solo su huella en la base (como el código de
-- entrada de Google y las invitaciones). La vuelta es una pantalla permitida del producto.
CREATE TABLE enlace_correo (
  codigo_hash TEXT PRIMARY KEY,
  correo TEXT NOT NULL,
  producto TEXT NOT NULL REFERENCES producto (id),
  vuelta TEXT NOT NULL,
  creado TEXT NOT NULL,
  expira TEXT NOT NULL,
  usado TEXT
);
-- Tope de enlaces por correo y hora (antiabuso: 3). Costo: 1 fila por enlace enviado.
CREATE INDEX enlace_por_correo ON enlace_correo (correo, creado);

PRAGMA defer_foreign_keys = off;
CREATE TABLE _guarda_fk (huerfanas INTEGER NOT NULL CHECK (huerfanas = 0));
INSERT INTO _guarda_fk (huerfanas) SELECT COUNT(*) FROM pragma_foreign_key_check;
DROP TABLE _guarda_fk;
