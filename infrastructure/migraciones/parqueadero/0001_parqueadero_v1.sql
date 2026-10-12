-- Parqueadero · shard de una celda de parqueaderos (`parqueadero_c{N}_s{k}`), migración 0001.
-- Fuente del diseño: docs/parking/ARQUITECTURA-PARQUEADERO.md §7 y anexo A. La prueba
-- tests/repo/shard-parqueadero.test.ts la corre con node:sqlite y con el D1 local de workerd, y el
-- despliegue la aplica a las bases de las celdas del parqueadero (HU-Q7.2). Ya aplicada, no se
-- edita: un cambio es una migración nueva.
--
-- Es el modelo de la celda agro (infrastructure/migraciones/celda/0001 a 0003) con lo que el
-- parqueadero necesita encima. Reglas de este esquema (las vigilan pruebas):
-- 1. Toda tabla de datos lleva `org_id`. La API lo toma del token (aud = parqueadero), nunca del
--    cuerpo de la solicitud.
-- 2. Dinero en pesos enteros (`*_cop`) dentro de `datos`, validado con zod en el teléfono y en la API
--    (packages/parqueadero-schema). Nunca REAL. Un valor ilegible no es cero (P1).
-- 3. Instantes en UTC ISO-8601 (TEXT). La fecha local de Bogotá va aparte en `fecha_local` (P8).
-- 4. Lo que va a crecer (tipos de registro, catálogos, orígenes) es una tabla de referencia con
--    clave foránea, no un CHECK (R1): agregar un tipo es un INSERT.
-- 5. Ninguna clave foránea lleva ON DELETE CASCADE (R4).
-- 6. Los registros son inmutables: corregir es anular con un registro nuevo (ADR-4). La base
--    rechaza UPDATE, y DELETE solo pasa con una purga autorizada después de exportar (P21).
-- 7. Cada índice dice su costo en filas escritas.
-- 8. Ningún dato de contacto del conductor llega aquí: el número de WhatsApp no sale del
--    dispositivo en el MVP ni en M1 (ADR-38). La foto del vehículo vive en R2, no en D1.

-- ── Referencias ────────────────────────────────────────────────────────────────────────────────

CREATE TABLE ref_tipo_registro (
  id TEXT PRIMARY KEY,
  lleva_numero INTEGER NOT NULL CHECK (lleva_numero IN (0, 1)),  -- 1: es un recibo con consecutivo
  abre_estadia INTEGER NOT NULL CHECK (abre_estadia IN (0, 1)),  -- 1: su id es el de la estadía
  pide_anula INTEGER NOT NULL CHECK (pide_anula IN (0, 1))       -- 1: no existe sin lo que anula
) WITHOUT ROWID;
INSERT INTO ref_tipo_registro (id, lleva_numero, abre_estadia, pide_anula) VALUES
  ('entrada', 1, 1, 0),          -- recibo de entrada (Ley 1480 art. 18)
  ('salida', 1, 0, 0),           -- liquidación y cobro; puede llegar antes que su entrada
  ('pago_abonado', 1, 0, 0),     -- recibo de una mensualidad
  ('anulacion', 0, 0, 1),        -- anula otro registro, con motivo
  ('entrega_recibo', 0, 0, 0),   -- cómo se entregó un recibo: papel, WhatsApp, pantalla, copia
  ('turno_apertura', 0, 0, 0),
  ('turno_cierre', 0, 0, 0),
  ('movimiento_caja', 0, 0, 0),  -- gasto o ingreso manual de la caja
  ('nota', 0, 0, 0);

CREATE TABLE ref_entidad (
  id TEXT PRIMARY KEY
) WITHOUT ROWID;
INSERT INTO ref_entidad (id) VALUES
  ('sede'),           -- datos legales del parqueadero: razón social, NIT, dirección, póliza, registro
  ('tarifa'),         -- por tipo de vehículo, con su vigencia
  ('abonado'),        -- mensualidad por placa
  ('ajuste_recibo'),  -- encabezado, pie, textos legales, ancho del papel
  ('punto');          -- puesto de trabajo: entrada, salida o ambos

CREATE TABLE ref_origen (
  id TEXT PRIMARY KEY
) WITHOUT ROWID;
INSERT INTO ref_origen (id) VALUES ('manual'), ('tablero'), ('importacion'), ('sistema');

-- ── Dispositivos ───────────────────────────────────────────────────────────────────────────────

-- Cada teléfono o PC que registra. La serie numera sus recibos sin coordinarse con nadie
-- (A-000123, B-000045): dos cajas sin red no pueden repetir un número. La llave pública es la del
-- par Ed25519 que el dispositivo generó; la celda la certifica para firmar recibos sin red (ADR-36).
-- Costo: la tabla (clave primaria) y `dispositivo_serie`: 2 filas por alta, que es rara.
CREATE TABLE dispositivo (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  serie TEXT NOT NULL CHECK (length(serie) BETWEEN 1 AND 3 AND serie NOT GLOB '*[^A-Z0-9]*'),
  nombre TEXT NOT NULL,
  llave_publica TEXT,                     -- base64url, 32 bytes; nula hasta la primera certificación
  certificado_hasta TEXT,                 -- vencimiento del último certificado emitido
  estado TEXT NOT NULL CHECK (estado IN ('activo', 'retirado')),
  creado TEXT NOT NULL,
  retirado TEXT,
  PRIMARY KEY (org_id, id),
  CHECK ((estado = 'retirado') = (retirado IS NOT NULL))
) WITHOUT ROWID;
CREATE UNIQUE INDEX dispositivo_serie ON dispositivo (org_id, serie);

-- ── Registros (inmutables) ─────────────────────────────────────────────────────────────────────

-- `id` es el UUIDv7 del dispositivo: reenviar el mismo lote no duplica (INSERT OR IGNORE).
-- `estadia_id` agrupa todo lo de una estadía: la entrada (estadia_id = id), la salida, las
-- entregas de sus recibos y sus anulaciones. Sin clave foránea: una salida hecha sin red en otra
-- caja puede llegar antes que su entrada, y eso no es un error (P1: nunca se descarta).
CREATE TABLE registro (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  tipo TEXT NOT NULL REFERENCES ref_tipo_registro (id),
  v INTEGER NOT NULL CHECK (v >= 1),
  fecha_local TEXT NOT NULL CHECK (fecha_local GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  instante_evento TEXT NOT NULL,          -- reloj del dispositivo
  instante_recibido TEXT NOT NULL,        -- reloj de la celda
  autor_usuario_id TEXT,                  -- nulo en lo que se hizo sin cuenta y se reclamó después
  dispositivo_id TEXT NOT NULL,
  origen TEXT NOT NULL REFERENCES ref_origen (id),
  anula_id TEXT,
  estadia_id TEXT,
  serie TEXT,
  consecutivo INTEGER CHECK (consecutivo IS NULL OR consecutivo >= 1),
  datos TEXT NOT NULL CHECK (json_valid(datos)),
  CHECK ((serie IS NULL) = (consecutivo IS NULL))
);
-- Pull: «cambios de esta organización después de <seq>». Costo: 1 fila por registro.
CREATE UNIQUE INDEX registro_pull ON registro (org_id, seq);
-- Un número de recibo no se repite en un parqueadero. También es la búsqueda por número del
-- recibo automático por WhatsApp (M3). Costo: 1 fila, solo en los registros con número.
CREATE UNIQUE INDEX registro_numero ON registro (org_id, serie, consecutivo)
  WHERE consecutivo IS NOT NULL;

-- Lo que la base garantiza de un registro, con la tabla de referencia (R1).
CREATE TRIGGER registro_reglas
BEFORE INSERT ON registro
BEGIN
  SELECT RAISE(ABORT, 'este tipo de registro es un recibo y necesita serie y consecutivo')
   WHERE NEW.consecutivo IS NULL
     AND (SELECT lleva_numero FROM ref_tipo_registro WHERE id = NEW.tipo) = 1;
  SELECT RAISE(ABORT, 'este tipo de registro no lleva número de recibo')
   WHERE NEW.consecutivo IS NOT NULL
     AND (SELECT lleva_numero FROM ref_tipo_registro WHERE id = NEW.tipo) = 0;
  SELECT RAISE(ABORT, 'una entrada abre su propia estadía: estadia_id = id')
   WHERE (SELECT abre_estadia FROM ref_tipo_registro WHERE id = NEW.tipo) = 1
     AND (NEW.estadia_id IS NULL OR NEW.estadia_id <> NEW.id);
  SELECT RAISE(ABORT, 'una anulación necesita el registro que anula')
   WHERE (SELECT pide_anula FROM ref_tipo_registro WHERE id = NEW.tipo) = 1
     AND NEW.anula_id IS NULL;
  -- Se anula lo que esta organización tiene. La celda manda el registro original antes que su
  -- anulación (el orden de la cola de salida), así que esto no deja datos de campo afuera.
  SELECT RAISE(ABORT, 'anula un registro que este parqueadero no tiene')
   WHERE NEW.anula_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM registro WHERE id = NEW.anula_id AND org_id = NEW.org_id);
  -- La serie es la del dispositivo que la tiene asignada, aunque ya esté retirado: un recibo
  -- hecho sin red antes del retiro llega después y se acepta (P1).
  SELECT RAISE(ABORT, 'la serie del recibo no es la del dispositivo que lo hizo')
   WHERE NEW.serie IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM dispositivo
        WHERE org_id = NEW.org_id AND id = NEW.dispositivo_id AND serie = NEW.serie
     );
END;

CREATE TRIGGER registro_inmutable
BEFORE UPDATE ON registro
BEGIN
  SELECT RAISE(ABORT, 'un registro no se modifica: se anula con otro (ADR-4)');
END;

-- Retirar los datos de un parqueadero que se va, después de entregarle la exportación (P21).
-- `exportacion_huella` es el SHA-256 del archivo que se verificó antes de borrar.
CREATE TABLE purga (
  org_id TEXT PRIMARY KEY,
  autorizada TEXT NOT NULL,
  autor TEXT NOT NULL,
  exportacion_huella TEXT NOT NULL CHECK (length(exportacion_huella) = 64)
) WITHOUT ROWID;

CREATE TRIGGER registro_sin_borrado
BEFORE DELETE ON registro
BEGIN
  SELECT RAISE(ABORT, 'un registro solo se borra con una purga autorizada después de exportar')
   WHERE NOT EXISTS (SELECT 1 FROM purga WHERE org_id = OLD.org_id);
END;

-- ── Catálogos (mutables, la última escritura gana, con historial) ──────────────────────────────

CREATE TABLE catalogo (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  entidad TEXT NOT NULL REFERENCES ref_entidad (id),
  version INTEGER NOT NULL CHECK (version >= 1),
  v INTEGER NOT NULL CHECK (v >= 1),
  datos TEXT NOT NULL CHECK (json_valid(datos)),
  actualizado TEXT NOT NULL,
  dispositivo_id TEXT NOT NULL,
  reemplazo TEXT CHECK (reemplazo IS NULL OR json_valid(reemplazo))
);
-- Pull de catálogos. Costo: 1 fila por escritura (2 al actualizar, que mueve `seq`).
CREATE UNIQUE INDEX catalogo_pull ON catalogo (org_id, seq);

CREATE TABLE entidad_historial (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  entidad TEXT NOT NULL,
  entidad_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  datos TEXT NOT NULL CHECK (json_valid(datos)),
  reemplazada TEXT NOT NULL,
  motivo TEXT NOT NULL CHECK (motivo IN ('edicion', 'conflicto'))
);

-- Actualizar un catálogo es una sola sentencia: la versión anterior pasa al historial aquí.
-- Costo: la fila del historial y su clave, solo cuando cambia la versión.
CREATE TRIGGER catalogo_a_historial
BEFORE UPDATE OF version ON catalogo
BEGIN
  SELECT RAISE(ABORT, 'un catálogo no cambia de parqueadero ni de entidad')
   WHERE NEW.org_id <> OLD.org_id OR NEW.entidad <> OLD.entidad;
  SELECT RAISE(ABORT, 'la versión de un catálogo solo sube')
   WHERE NEW.version <= OLD.version;
  INSERT OR IGNORE INTO entidad_historial
    (id, org_id, entidad, entidad_id, version, datos, reemplazada, motivo)
  VALUES
    (OLD.id || '@v' || OLD.version, OLD.org_id, OLD.entidad, OLD.id, OLD.version, OLD.datos,
     NEW.actualizado, CASE WHEN NEW.reemplazo IS NULL THEN 'edicion' ELSE 'conflicto' END);
END;

-- ── Cuarentena ─────────────────────────────────────────────────────────────────────────────────

-- Lo que no valida se guarda con su motivo en palabras y el dispositivo lo muestra en rojo (P1).
-- `id` es el de la operación: reenviarla no duplica. Sin índice extra.
CREATE TABLE cuarentena (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  dispositivo_id TEXT NOT NULL,
  recibido TEXT NOT NULL,
  motivo TEXT NOT NULL,
  operacion TEXT NOT NULL CHECK (json_valid(operacion))
);
