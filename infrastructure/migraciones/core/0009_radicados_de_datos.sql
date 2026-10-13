-- CORE · Tus datos (HU-C7.7, Ley 1581 de 2012 y Decreto 1377 de 2013): las consultas, reclamos y
-- supresiones que la persona radica desde su cuenta, con su número y su fecha límite.
-- Plazos de la ley, en días hábiles de Colombia con sus festivos (`@ed1/calendario`): consulta, 10
-- (art. 14); reclamo y supresión, 15 (art. 15). La fecha límite se guarda: si la ley cambia, lo ya
-- radicado conserva la suya.
-- Solo tablas nuevas: no se reconstruye ninguna, así que no hace falta la receta (§4.4).
CREATE TABLE radicado_datos (
  id TEXT PRIMARY KEY,
  -- El número que ve la persona y que le llega al dueño: «LD-AAAAMMDD-XXXXXX».
  numero TEXT NOT NULL UNIQUE,
  usuario_id TEXT NOT NULL REFERENCES usuario (id),
  tipo TEXT NOT NULL CHECK (tipo IN ('consulta', 'reclamo', 'supresion')),
  texto TEXT NOT NULL CHECK (length(texto) BETWEEN 10 AND 2000),
  creado TEXT NOT NULL,
  -- Fecha civil de Bogotá (`AAAA-MM-DD`): el último día para responder.
  vence TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'respondido')),
  -- Cuándo salió el aviso al dueño por Telegram; nulo mientras no salga, y el cron lo reintenta.
  avisado TEXT
);
-- «Tus solicitudes» de la persona. Costo: 1 fila por radicado.
CREATE INDEX radicado_por_usuario ON radicado_datos (usuario_id, creado);
-- El cron busca los avisos pendientes: un índice parcial, casi siempre vacío.
CREATE INDEX radicado_sin_aviso ON radicado_datos (creado) WHERE avisado IS NULL;
