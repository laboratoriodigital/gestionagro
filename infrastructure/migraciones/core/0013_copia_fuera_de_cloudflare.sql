-- CORE · la copia semanal fuera de Cloudflare (HU-C11.4, ADR-30, decisión del dueño del 23 oct
-- 2026: en el cron del CORE). Cada semana, cada base del destino (la del CORE y los shards de cada
-- celda, de celdas.json) se exporta, se cifra antes de salir y se sube al Google Drive del dueño.
-- Una fila por base y semana dice cómo va: el cron de cada 15 minutos hace una base por vuelta, para
-- caber en los 10 ms de CPU y las 50 llamadas por invocación del plan gratuito.
--
-- `base = '_cierre'` es la vuelta que rota las copias viejas y mira la cuota de Drive cuando ya
-- están todas. Sin datos de nadie: nombres de bases, tamaños, huellas y recuentos por tabla.
-- Costo: unas 5 filas por semana y base (crear, empezar, cerrar).

CREATE TABLE copia_base (
  semana TEXT NOT NULL,
  base TEXT NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('pendiente', 'hecha', 'fallida')),
  intentos INTEGER NOT NULL DEFAULT 0,
  bytes INTEGER,
  -- SHA-256 del volcado en claro; la copia lo lleva adentro y el simulacro lo compara.
  huella TEXT,
  -- Filas por tabla del volcado, en JSON: lo que el simulacro cuenta al restaurar (CA2).
  filas TEXT CHECK (filas IS NULL OR json_valid(filas)),
  archivo TEXT,
  motivo TEXT,
  actualizado TEXT NOT NULL,
  PRIMARY KEY (semana, base)
) WITHOUT ROWID;
