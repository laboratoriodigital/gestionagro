-- CORE v0 (HU-E4.1, ARQUITECTURA §5.4, ADR-9). Solo las tablas de §5.4: una prueba lo exige.
-- Se aplica con `wrangler d1 migrations apply` desde scripts/desplegar.ts. Nunca se edita una
-- migración aplicada: un cambio es un archivo nuevo (expandir → migrar → contraer, §7.4).
--
-- Instantes en texto ISO 8601 UTC. Cada índice cuesta una fila escrita más por INSERT
-- (ARQUITECTURA §6.2), así que cada uno dice por qué existe. Sin índice:
-- - organizacion por celda_id: la regla de asignación cuenta organizaciones solo al crear una,
--   y una celda tiene cientos, no millones (§6.2). Recorrer la tabla es más barato que el índice.
-- - membresia por org_id: listar el equipo llega con HU-E4.4; el índice se decide ahí.

-- Directorio de celdas. Se llena desde infrastructure/celdas.json en cada despliegue (P2):
-- estado, anillo y shards salen de allí; la URL de la API (HU-E5.1) y las claves públicas
-- (HU-E4.2) se agregan cuando existan. Una celda nunca se borra: si sale de celdas.json queda
-- «fuera», porque hay organizaciones que la nombran (P21).
CREATE TABLE celda (
  id TEXT PRIMARY KEY,
  url_api TEXT,
  clave_publica TEXT,
  clave_publica_anterior TEXT,
  estado TEXT NOT NULL CHECK (estado IN ('activa', 'fuera')),
  anillo_despliegue INTEGER NOT NULL,
  shards TEXT NOT NULL CHECK (json_valid(shards) AND json_type(shards) = 'array')
);

CREATE TABLE usuario (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  creado TEXT NOT NULL
);

-- Quién es la persona para Google: el `sub`, no el email (el email puede cambiar).
-- La clave primaria es la búsqueda del login; no hace falta otro índice.
CREATE TABLE identidad (
  proveedor TEXT NOT NULL CHECK (proveedor IN ('google')),
  sub TEXT NOT NULL,
  usuario_id TEXT NOT NULL REFERENCES usuario (id),
  PRIMARY KEY (proveedor, sub)
);

-- Refresh token: solo su hash. UNIQUE porque el refresh se busca por él (HU-E4.2); se rota a lo
-- sumo una vez al día por dispositivo, así que el índice cuesta poco.
CREATE TABLE sesion (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuario (id),
  refresh_hash TEXT NOT NULL UNIQUE,
  dispositivo TEXT NOT NULL,
  creado TEXT NOT NULL,
  expira TEXT NOT NULL,
  revocado TEXT
);

-- celda_id, shard y anillo los pone la regla de asignación (apps/core/src/asignacion.ts), nunca
-- una persona (CA3).
CREATE TABLE organizacion (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('finca', 'asesor', 'cadena')),
  plan TEXT NOT NULL CHECK (plan IN ('gratuito', 'finca', 'exportador', 'cadena')),
  celda_id TEXT NOT NULL REFERENCES celda (id),
  shard TEXT NOT NULL,
  anillo INTEGER NOT NULL CHECK (anillo IN (1, 2)),
  creado TEXT NOT NULL
);

-- Roles de ARQUITECTURA §9. La clave primaria sirve para «organizaciones de un usuario», que es
-- lo que pide el login (directorio).
CREATE TABLE membresia (
  usuario_id TEXT NOT NULL REFERENCES usuario (id),
  org_id TEXT NOT NULL REFERENCES organizacion (id),
  rol TEXT NOT NULL CHECK (rol IN ('propietario', 'supervisor', 'operario', 'asesor', 'auditor')),
  creado TEXT NOT NULL,
  PRIMARY KEY (usuario_id, org_id)
);

-- Código de un solo uso: solo su hash, que es también la búsqueda al aceptar (HU-E4.4).
CREATE TABLE invitacion (
  codigo_hash TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizacion (id),
  rol TEXT NOT NULL CHECK (rol IN ('propietario', 'supervisor', 'operario', 'asesor', 'auditor')),
  expira TEXT NOT NULL,
  creada_por TEXT NOT NULL REFERENCES usuario (id),
  creada TEXT NOT NULL,
  usada_por TEXT REFERENCES usuario (id),
  usada TEXT
);
