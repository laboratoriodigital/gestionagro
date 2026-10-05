-- Tienda 3.0 · base de control `tienda_control` (una por despliegue del producto, sin shards).
-- Guarda lo que tiene que ser único en todo el producto: los nombres cortos y los hostnames.
-- El despacho no la lee en cada visita: lee el KV `TIENDA_HOSTS`, que se deriva de aquí (P2) y que
-- un cron reconstruye completo cada día para que una escritura perdida no quede para siempre.

CREATE TABLE slug (
  slug TEXT PRIMARY KEY CHECK (
    length(slug) BETWEEN 3 AND 40 AND slug NOT GLOB '*[^a-z0-9-]*' AND slug NOT GLOB '-*' AND slug NOT GLOB '*-'
  ),
  org_id TEXT NOT NULL UNIQUE,
  celda_id TEXT NOT NULL,
  creado TEXT NOT NULL
) WITHOUT ROWID;

-- Nombres que nadie puede tomar (rutas y marcas del ecosistema).
CREATE TABLE slug_reservado (
  slug TEXT PRIMARY KEY,
  motivo TEXT NOT NULL
) WITHOUT ROWID;
INSERT INTO slug_reservado (slug, motivo) VALUES
  ('www', 'infraestructura'), ('api', 'infraestructura'), ('panel', 'infraestructura'),
  ('img', 'infraestructura'), ('mcp', 'infraestructura'), ('origen', 'infraestructura'),
  ('admin', 'suplantacion'), ('soporte', 'suplantacion'), ('pagos', 'suplantacion');

-- Un hostname que sirve a una tienda. `tipo`: de la plataforma (<slug>.<dominio de tiendas>) o
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
