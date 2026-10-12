-- CORE · servidor de autorización OAuth 2.1 para agentes (MCP): PLATAFORMA §5.4, ADR-41, HU-C9.2.
-- Era la 0009 del diseño: los números siguen el orden en que se construyen, y entrar con correo
-- (la 0008 del diseño) todavía no llega (PLATAFORMA §4.5).
--
-- Una concesión = una persona autoriza a un cliente (agente) sobre una organización y un recurso
-- (RFC 8707), con alcances del producto. Ningún alcance mueve dinero: lo exige la base.
-- Solo tablas nuevas: no se reconstruye ninguna, así que no hace falta la receta (§4.4).

-- Los alcances de cada producto, de `infrastructure/productos.json`, copiados por el despliegue
-- como el resto del catálogo (HU-C2.3). Uno que sale del archivo queda `retirado`, nunca se borra:
-- una concesión puede nombrarlo (P21). El id lleva el producto delante (`agro:registros:leer`).
CREATE TABLE alcance (
  producto TEXT NOT NULL REFERENCES producto (id),
  id TEXT NOT NULL CHECK (id GLOB producto || ':*' AND id NOT GLOB '*[^a-z0-9:._-]*'),
  descripcion TEXT NOT NULL,
  mueve_dinero INTEGER NOT NULL DEFAULT 0 CHECK (mueve_dinero = 0),
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'retirado')),
  PRIMARY KEY (producto, id)
) WITHOUT ROWID;

-- `id`: con CIMD, la URL HTTPS del documento de metadatos del cliente; con registro dinámico
-- (RFC 7591), uno generado. Un cliente bloqueado no obtiene códigos (HU-C9.3).
CREATE TABLE cliente_oauth (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('cimd', 'dcr')),
  nombre TEXT NOT NULL,
  uri TEXT,
  redirect_uris TEXT NOT NULL CHECK (json_valid(redirect_uris) AND json_type(redirect_uris) = 'array'),
  estado TEXT NOT NULL CHECK (estado IN ('activo', 'bloqueado')),
  creado TEXT NOT NULL,
  ultimo_uso TEXT,
  -- Registro dinámico: huella de la IP con la fecha del día, nunca la IP. Solo sirve para el tope
  -- de registros por hora (HU-C9.3); al día siguiente ya no se puede relacionar.
  origen_hash TEXT
);
-- El tope por IP cuenta los registros de la última hora. Costo: 1 fila por cliente registrado.
CREATE INDEX cliente_por_origen ON cliente_oauth (origen_hash, creado) WHERE origen_hash IS NOT NULL;

CREATE TABLE concesion_oauth (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuario (id),
  org_id TEXT NOT NULL,
  producto TEXT NOT NULL,
  cliente_id TEXT NOT NULL REFERENCES cliente_oauth (id),
  -- El servidor MCP o la API (RFC 8707 «resource»).
  recurso TEXT NOT NULL,
  alcances TEXT NOT NULL CHECK (json_valid(alcances) AND json_type(alcances) = 'array'),
  creada TEXT NOT NULL,
  revocada TEXT,
  ultimo_uso TEXT,
  FOREIGN KEY (org_id, producto) REFERENCES organizacion (id, producto)
);
-- «Aplicaciones conectadas» y revocar por organización. Costo: 1 fila por concesión.
CREATE INDEX concesion_por_org ON concesion_oauth (org_id);

CREATE TABLE codigo_oauth (
  codigo_hash TEXT PRIMARY KEY,
  concesion_id TEXT NOT NULL REFERENCES concesion_oauth (id),
  redirect_uri TEXT NOT NULL,
  -- PKCE S256, obligatorio: 43 caracteres de base64url.
  code_challenge TEXT NOT NULL CHECK (length(code_challenge) = 43),
  expira TEXT NOT NULL,
  usado TEXT
);

CREATE TABLE refresco_oauth (
  refresh_hash TEXT PRIMARY KEY,
  concesion_id TEXT NOT NULL REFERENCES concesion_oauth (id),
  creado TEXT NOT NULL,
  expira TEXT NOT NULL,
  -- Usado una vez: reusarlo revoca la concesión entera, porque es señal de robo (§5.4).
  rotado TEXT
);
-- Revocar todos los refresh de una concesión. Costo: 1 fila por refresh emitido.
CREATE INDEX refresco_por_concesion ON refresco_oauth (concesion_id);
