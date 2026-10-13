-- Tienda 3.0 · base de control `tienda_control` (una por despliegue del producto, sin shards).
-- Guarda lo que tiene que ser único en todo el producto: los nombres cortos y los hostnames.
-- El despacho no la lee en cada visita: lee el KV `TIENDA_HOSTS`, que se deriva de aquí (P2) y que
-- un cron reconstruye completo cada día para que una escritura perdida no quede para siempre.

-- El nombre corto es también el hostname de la tienda sin dominio propio: <slug>.laboratorio-digital.app
-- (ADR-27). Ese primer nivel lo comparten las tiendas y los proyectos nuevos del ecosistema, así que
-- un nombre lo toma una tienda o lo reserva la plataforma, nunca los dos (triggers del final).
CREATE TABLE slug (
  -- Sin «--»: ese espacio es de la plataforma (<slug>--staging).
  slug TEXT PRIMARY KEY CHECK (
    length(slug) BETWEEN 3 AND 40 AND slug NOT GLOB '*[^a-z0-9-]*' AND slug NOT GLOB '-*' AND slug NOT GLOB '*-'
    AND slug NOT GLOB '*--*'
  ),
  org_id TEXT NOT NULL UNIQUE,
  celda_id TEXT NOT NULL,
  creado TEXT NOT NULL
) WITHOUT ROWID;

-- Por qué un nombre no se puede tomar. `proyecto`: un proyecto del ecosistema vive o vivirá en
-- <nombre>.laboratorio-digital.app; `marca`: una marca ajena o del ecosistema (contra la suplantación).
-- Los de `proyecto` y `marca` los siembra el despliegue desde infrastructure/dominios.json (P2).
CREATE TABLE ref_motivo_reserva (
  id TEXT PRIMARY KEY
) WITHOUT ROWID;
INSERT INTO ref_motivo_reserva (id) VALUES ('infraestructura'), ('suplantacion'), ('proyecto'), ('marca');

CREATE TABLE slug_reservado (
  slug TEXT PRIMARY KEY CHECK (slug NOT GLOB '*[^a-z0-9-]*'),
  motivo TEXT NOT NULL REFERENCES ref_motivo_reserva (id)
) WITHOUT ROWID;
INSERT INTO slug_reservado (slug, motivo) VALUES
  ('www', 'infraestructura'), ('api', 'infraestructura'), ('panel', 'infraestructura'),
  ('img', 'infraestructura'), ('mcp', 'infraestructura'), ('origen', 'infraestructura'),
  ('correo', 'infraestructura'), ('estado', 'infraestructura'), ('cdn', 'infraestructura'),
  ('admin', 'suplantacion'), ('soporte', 'suplantacion'), ('ayuda', 'suplantacion'),
  ('pagos', 'suplantacion'), ('cuenta', 'suplantacion'), ('entrar', 'suplantacion'),
  ('seguridad', 'suplantacion'), ('abuse', 'suplantacion');

-- Un hostname que sirve a una tienda. `tipo`: de la plataforma (<slug>.laboratorio-digital.app) o
-- propio del comercio (hostname personalizado de Cloudflare for SaaS). `rol`: el canónico sirve;
-- un alias responde 301 al canónico. Un hostname retirado no se borra: volver a tomarlo exige
-- demostrar otra vez la propiedad (TXT), contra la toma de subdominios colgantes.
CREATE TABLE dominio (
  hostname TEXT PRIMARY KEY CHECK (
    hostname = lower(hostname) AND length(hostname) <= 253 AND hostname GLOB '*?.?*'
    AND hostname NOT GLOB '*[^a-z0-9.-]*' AND hostname NOT GLOB '.*' AND hostname NOT GLOB '*.'
  ),
  org_id TEXT NOT NULL,
  celda_id TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('plataforma', 'propio')),
  rol TEXT NOT NULL CHECK (rol IN ('canonico', 'alias')),
  estado TEXT NOT NULL CHECK (estado IN ('pendiente', 'validando', 'activo', 'error', 'retirado')),
  cf_hostname_id TEXT,                   -- id del hostname personalizado en Cloudflare for SaaS
  validacion TEXT CHECK (validacion IS NULL OR json_valid(validacion)),   -- registros TXT a crear
  motivo TEXT,
  creado TEXT NOT NULL,
  activado TEXT,
  retirado TEXT
) WITHOUT ROWID;
-- Un solo canónico activo por tienda. Costo: 1 fila por canónico activo.
CREATE UNIQUE INDEX dominio_un_canonico ON dominio (org_id) WHERE rol = 'canonico' AND estado = 'activo';
-- Los hostnames de una tienda, para el panel y para reconstruir el KV. Costo: 1 fila por hostname.
CREATE INDEX dominio_por_tienda ON dominio (org_id);

-- Un nombre reservado no lo toma una tienda, y uno que ya tiene tienda no se reserva: el despliegue
-- que intente reservarlo para un proyecto falla con el nombre (P1), en vez de quitarle la dirección.
CREATE TRIGGER slug_no_reservado BEFORE INSERT ON slug
WHEN EXISTS (SELECT 1 FROM slug_reservado WHERE slug = NEW.slug)
BEGIN
  SELECT RAISE(ABORT, 'slug-reservado');
END;
CREATE TRIGGER reserva_no_tomada BEFORE INSERT ON slug_reservado
WHEN EXISTS (SELECT 1 FROM slug WHERE slug = NEW.slug)
BEGIN
  SELECT RAISE(ABORT, 'slug-en-uso');
END;
