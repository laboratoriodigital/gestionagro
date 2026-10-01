-- Shard de una celda, protocolo de sincronización v1 (HU-E5.1, ARQUITECTURA §5.5 a §5.7).
-- Se aplica igual a cada shard (`agro_c{N}_s{k}`) con `wrangler d1 migrations apply`, desde
-- scripts/desplegar.ts. Nunca se edita una migración aplicada: un cambio es un archivo nuevo
-- (expandir → migrar → contraer, §7.4).
--
-- Reglas que esta migración cumple y las pruebas vigilan:
-- - Toda tabla lleva `org_id`: la API lo toma del token y lo pone en cada consulta (§5.7).
-- - Los datos de campo nunca se descartan: lo que no valida va a `cuarentena` (P1).
-- - `seq` es el cursor del pull (§5.6): monotónico por organización, lo asigna la celda al
--   escribir. El servidor no guarda cursores por teléfono.
-- - Cada índice es una fila escrita más por INSERT (bitácora agro, «Lo que el terreno enseñó»).
--   Su costo va al lado. Una escritura de `registro` cuesta 3 filas: la tabla, su clave e
--   `registro_pull`, como supone §6.2.

-- Registros de campo: inmutables. Corregir es un registro nuevo con `anula_id` (ADR-4).
-- `id` es el UUIDv7 del teléfono: la clave primaria hace que reenviar el mismo lote no duplique
-- (INSERT OR IGNORE, HU-E5.2).
CREATE TABLE registro (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  finca_id TEXT NOT NULL,
  area_ids TEXT NOT NULL CHECK (json_valid(area_ids) AND json_type(area_ids) = 'array'),
  ciclo_id TEXT,
  tipo TEXT NOT NULL,
  v INTEGER NOT NULL CHECK (v >= 1),
  fecha_agronomica TEXT NOT NULL,
  instante_evento TEXT NOT NULL,
  instante_recibido TEXT NOT NULL,
  autor_usuario_id TEXT,
  persona_ids TEXT NOT NULL CHECK (json_valid(persona_ids) AND json_type(persona_ids) = 'array'),
  dispositivo_id TEXT NOT NULL,
  origen TEXT NOT NULL CHECK (origen IN ('manual', 'tablero', 'dispositivo', 'importacion')),
  anula_id TEXT,
  datos TEXT NOT NULL CHECK (json_valid(datos))
);
-- Pull: «cambios de esta organización después de <seq>», y el máximo `seq` al asignar uno nuevo.
-- Costo: 1 fila por registro.
CREATE UNIQUE INDEX registro_pull ON registro (org_id, seq);

-- Catálogos (finca, área, ciclo, persona, insumo, cultivo, valor de jornal, tipo de labor,
-- categoría de calidad): mutables, la última escritura gana y la versión anterior va a
-- `entidad_historial` (ADR-4). Una tabla para todos, con `entidad`: los catálogos ya viajan así
-- en la cola de salida del teléfono, y una tabla por catálogo serían nueve migraciones por cada
-- cambio del protocolo.
CREATE TABLE catalogo (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  entidad TEXT NOT NULL CHECK (
    entidad IN (
      'finca', 'area', 'ciclo', 'persona', 'insumo', 'cultivo', 'valor_jornal', 'tipo_labor',
      'categoria_calidad'
    )
  ),
  version INTEGER NOT NULL CHECK (version >= 1),
  v INTEGER NOT NULL CHECK (v >= 1),
  datos TEXT NOT NULL CHECK (json_valid(datos)),
  actualizado TEXT NOT NULL,
  dispositivo_id TEXT NOT NULL
);
-- Pull de catálogos. Costo: 1 fila por escritura (y 2 al actualizar, que mueve `seq`).
CREATE UNIQUE INDEX catalogo_pull ON catalogo (org_id, seq);

-- Versiones reemplazadas de un catálogo, también las que perdieron un conflicto (HU-E5.4).
-- Sin índice por ahora: se lee cuando alguien abre el historial de una entidad, que es raro.
-- El índice por `entidad_id` se decide con HU-E5.4 si hace falta.
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

-- Operaciones que no validaron: se guardan con su motivo en palabras y el teléfono las muestra
-- en rojo (HU-E3.14, HU-E5.2). `id` es el de la operación: reenviarla no duplica.
-- Sin índice extra: el teléfono recibe el motivo en la respuesta del push.
CREATE TABLE cuarentena (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  dispositivo_id TEXT NOT NULL,
  recibido TEXT NOT NULL,
  motivo TEXT NOT NULL,
  operacion TEXT NOT NULL
);
