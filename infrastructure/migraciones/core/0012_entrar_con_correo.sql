-- CORE · entrar con un enlace por correo y los correos del CORE (HU-C10.2, HU-C10.3, PLATAFORMA
-- §4.11, ED1 §5.2). Es el borrador `docs/plataforma/sql/core/0010_entrar_con_correo.sql` con el
-- número de su turno (los números siguen el orden de construcción, PLATAFORMA §4.5) y dos cosas
-- que el borrador no tenía: la política que se aceptó al pedir el enlace, y la tabla de los correos.
--
-- `identidad.proveedor` pasa de CHECK a tabla de referencia (R1, ADR-25): el próximo proveedor
-- (Microsoft, Apple) es un INSERT, no otra reconstrucción. `identidad` es solo hija (de `usuario`),
-- así que rehacerla no deja contador diferido; la guarda va igual, por regla (receta R5, §4.4).
-- Fase EXPANDIR: el Worker de antes sigue funcionando, porque solo escribe `google`.
--
-- Costo: una escritura por fila de `identidad` (hoy, cientos) y por su clave primaria.

PRAGMA defer_foreign_keys = on;

CREATE TABLE proveedor_identidad (
  id TEXT PRIMARY KEY CHECK (id NOT GLOB '*[^a-z0-9-]*')
) WITHOUT ROWID;
INSERT INTO proveedor_identidad (id) VALUES ('google'), ('correo');

CREATE TABLE identidad_nueva (
  proveedor TEXT NOT NULL REFERENCES proveedor_identidad (id),
  -- Con `correo`, el correo normalizado (minúsculas, sin espacios). Con `google`, el `sub`.
  sub TEXT NOT NULL,
  usuario_id TEXT NOT NULL REFERENCES usuario (id),
  creada TEXT,
  PRIMARY KEY (proveedor, sub)
);
INSERT INTO identidad_nueva (proveedor, sub, usuario_id) SELECT proveedor, sub, usuario_id FROM identidad;
DROP TABLE identidad;
ALTER TABLE identidad_nueva RENAME TO identidad;

-- La primera vez que alguien entra con correo se busca si ya tiene cuenta con ese correo (entró con
-- Google): así es la misma persona y no una cuenta nueva. Costo: una fila escrita más por usuario
-- nuevo, que son decenas al mes; sin él, cada primera entrada con correo recorre `usuario`.
CREATE INDEX usuario_por_correo ON usuario (lower(email));

-- Un enlace de entrada: un solo uso, 15 minutos, solo su huella en la base (como el código de
-- entrada de Google y las invitaciones). La vuelta es una pantalla permitida del producto, y la
-- política, la versión vigente que la persona aceptó al pedirlo (HU-E0.5 CA3).
CREATE TABLE enlace_correo (
  codigo_hash TEXT PRIMARY KEY,
  correo TEXT NOT NULL,
  producto TEXT NOT NULL REFERENCES producto (id),
  vuelta TEXT NOT NULL,
  politica TEXT NOT NULL,
  creado TEXT NOT NULL,
  expira TEXT NOT NULL,
  usado TEXT
);
-- Tope de enlaces por correo y hora (CA3: 3). Costo: 1 fila más por enlace enviado.
CREATE INDEX enlace_por_correo ON enlace_correo (correo, creado);

-- Cada correo que el CORE intenta mandar, una fila (HU-C10.3). `clave` dice qué correo es: dos
-- corridas del cron no mandan dos avisos (CA2), y un enlace no sale dos veces. `dia` (UTC) lleva la
-- cuenta del cupo diario, que el CORE comparte con la Tienda (PLATAFORMA §4.11). Solo lo que salió
-- o está saliendo gasta cupo; lo `fallido` se puede volver a intentar. Sin el correo de nadie: la
-- clave nombra la organización o la huella del enlace.
CREATE TABLE correo_del_core (
  clave TEXT PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('enlace', 'aviso')),
  dia TEXT NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('enviando', 'enviado', 'fallido')),
  motivo TEXT,
  intentos INTEGER NOT NULL DEFAULT 1,
  creado TEXT NOT NULL,
  actualizado TEXT NOT NULL
);
-- El cupo del día se cuenta en cada envío. Costo: 1 fila más por correo.
CREATE INDEX correo_por_dia ON correo_del_core (dia, estado);

-- Los avisos de vencimiento (HU-C10.3) buscan cada hora los planes que vencen en 7 días: sin este
-- índice, cada vuelta recorre todas las organizaciones. Parcial: solo cuesta en las que pagan, al
-- pagar (una fila más por pago aprobado).
CREATE INDEX organizacion_por_vencimiento ON organizacion (plan_vence) WHERE plan_vence IS NOT NULL;

PRAGMA defer_foreign_keys = off;
CREATE TABLE _guarda_fk (huerfanas INTEGER NOT NULL CHECK (huerfanas = 0));
INSERT INTO _guarda_fk (huerfanas) SELECT COUNT(*) FROM pragma_foreign_key_check;
DROP TABLE _guarda_fk;
