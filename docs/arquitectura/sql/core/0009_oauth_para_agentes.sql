-- CORE · servidor de autorización OAuth 2.1 para agentes (MCP), ARQUITECTURA-PLATAFORMA §5.4.
-- Una concesión = una persona autoriza a un cliente (agente) sobre una organización y un recurso
-- (RFC 8707), con alcances del producto. Ningún alcance mueve dinero (lo exige `alcance`).

CREATE TABLE alcance (
  producto TEXT NOT NULL REFERENCES producto (id),
  id TEXT NOT NULL CHECK (id NOT GLOB '*[^a-z0-9:._-]*'),
  descripcion TEXT NOT NULL,
  mueve_dinero INTEGER NOT NULL DEFAULT 0 CHECK (mueve_dinero = 0),
  PRIMARY KEY (producto, id)
) WITHOUT ROWID;

-- `id`: con CIMD, la URL HTTPS del documento de metadatos del cliente; con registro dinámico
-- (RFC 7591), uno generado.
CREATE TABLE cliente_oauth (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('cimd', 'dcr')),
  nombre TEXT NOT NULL,
  uri TEXT,
  redirect_uris TEXT NOT NULL CHECK (json_valid(redirect_uris) AND json_type(redirect_uris) = 'array'),
  estado TEXT NOT NULL CHECK (estado IN ('activo', 'bloqueado')),
  creado TEXT NOT NULL,
  ultimo_uso TEXT
);

CREATE TABLE concesion_oauth (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuario (id),
  org_id TEXT NOT NULL,
  producto TEXT NOT NULL,
  cliente_id TEXT NOT NULL REFERENCES cliente_oauth (id),
  recurso TEXT NOT NULL,                 -- el servidor MCP o la API (RFC 8707 «resource»)
  alcances TEXT NOT NULL CHECK (json_valid(alcances) AND json_type(alcances) = 'array'),
  creada TEXT NOT NULL,
  revocada TEXT,
  ultimo_uso TEXT,
  FOREIGN KEY (org_id, producto) REFERENCES organizacion (id, producto)
);
-- «Aplicaciones conectadas» del propietario y revocar por organización. Costo: 1 fila por concesión.
CREATE INDEX concesion_por_org ON concesion_oauth (org_id);

CREATE TABLE codigo_oauth (
  codigo_hash TEXT PRIMARY KEY,
  concesion_id TEXT NOT NULL REFERENCES concesion_oauth (id),
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,          -- PKCE S256, obligatorio
  expira TEXT NOT NULL,
  usado TEXT
);

CREATE TABLE refresco_oauth (
  refresh_hash TEXT PRIMARY KEY,
  concesion_id TEXT NOT NULL REFERENCES concesion_oauth (id),
  creado TEXT NOT NULL,
  expira TEXT NOT NULL,
  rotado TEXT                            -- usado una vez: reusarlo revoca la concesión (robo)
);
-- Revocar todos los refresh de una concesión. Costo: 1 fila por refresh emitido.
CREATE INDEX refresco_por_concesion ON refresco_oauth (concesion_id);
