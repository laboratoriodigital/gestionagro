-- Tienda 3.0 · shard de una celda de tiendas (`tienda_c{N}_s{k}`), migración 0001.
-- Fuente del diseño: docs/ARQUITECTURA-TIENDA-3.0.md §5. Probada con node:sqlite 3.50 (falta D1).
--
-- Reglas de este esquema (las vigilan pruebas, como en la celda agro):
-- 1. Toda tabla lleva `org_id`. El panel lo toma del token; lo público, del Host ya resuelto por
--    el despacho. Nunca del cuerpo de la solicitud.
-- 2. Dinero en pesos enteros (`*_cop INTEGER`). Nunca REAL. Un precio ilegible no es cero (P1).
-- 3. Instantes en UTC ISO-8601 (TEXT). La fecha comercial local (America/Bogota) se deriva (P8).
-- 4. Lo que va a crecer (estados, secciones) es una tabla de referencia con clave foránea, no un
--    CHECK: agregar un valor es un INSERT, no rehacer la tabla. Lo cerrado (sí/no, ambiente) es CHECK.
-- 5. Ninguna clave foránea lleva ON DELETE CASCADE: DROP TABLE hace un DELETE implícito y, en D1,
--    borraría las hijas al rehacer una tabla padre.
-- 6. Nada se borra en caliente: `borrado` marca la papelera y un cron purga a los 30 días (P21).
-- 7. Cada índice dice su costo (filas escritas de más por INSERT).
-- 8. Los datos personales del comprador no están en claro: `pedido_contacto.sobre` va cifrado con la
--    llave de datos personales de la tienda (AES-256-GCM, cifrado de sobre).

-- 0. Referencias ---------------------------------------------------------------------------

CREATE TABLE ref_seccion_ajuste (
  id TEXT PRIMARY KEY,
  publica INTEGER NOT NULL CHECK (publica IN (0, 1))   -- 1: se hornea en el sitio público
) WITHOUT ROWID;
INSERT INTO ref_seccion_ajuste (id, publica) VALUES
  ('identidad', 1), ('contacto', 1), ('apariencia', 1), ('venta', 1), ('cobro', 0),
  ('legal', 1), ('medicion', 1), ('agentes', 1), ('avisos', 0);

CREATE TABLE ref_estado_pedido (
  id TEXT PRIMARY KEY,
  descuenta INTEGER NOT NULL CHECK (descuenta IN (0, 1)),   -- 1: las unidades ya salieron del inventario
  terminal INTEGER NOT NULL CHECK (terminal IN (0, 1))
) WITHOUT ROWID;
INSERT INTO ref_estado_pedido (id, descuenta, terminal) VALUES
  ('pendiente', 0, 0),     -- llegó (WhatsApp, agente, panel) y nadie lo ha confirmado
  ('por_pagar', 0, 0),     -- espera un pago en línea; sus unidades están apartadas
  ('confirmado', 1, 0),    -- el comercio lo confirmó (pago por fuera, contraentrega)
  ('pagado', 1, 0),        -- pago en línea aprobado
  ('despachado', 1, 0),
  ('entregado', 1, 1),
  ('cancelado', 0, 1),
  ('devuelto', 0, 1);

CREATE TABLE ref_transicion_pedido (
  de TEXT NOT NULL REFERENCES ref_estado_pedido (id),
  a TEXT NOT NULL REFERENCES ref_estado_pedido (id),
  PRIMARY KEY (de, a)
) WITHOUT ROWID;
INSERT INTO ref_transicion_pedido (de, a) VALUES
  ('pendiente', 'por_pagar'), ('pendiente', 'confirmado'), ('pendiente', 'cancelado'),
  ('por_pagar', 'pagado'), ('por_pagar', 'pendiente'), ('por_pagar', 'cancelado'),
  ('confirmado', 'despachado'), ('confirmado', 'cancelado'),
  ('pagado', 'despachado'), ('pagado', 'cancelado'),
  ('despachado', 'entregado'), ('despachado', 'devuelto'),
  ('entregado', 'devuelto');

CREATE TABLE ref_estado_cobro (
  id TEXT PRIMARY KEY,
  abierto INTEGER NOT NULL CHECK (abierto IN (0, 1))
) WITHOUT ROWID;
INSERT INTO ref_estado_cobro (id, abierto) VALUES
  ('esperando', 1), ('aprobado', 0), ('aprobado_sin_existencias', 0), ('rechazado', 0),
  ('vencido', 0), ('revisar', 0), ('reembolsado', 0);

-- Los avisos de Bold pueden llegar repetidos o en desorden (una anulación antes que la venta):
-- solo estas transiciones existen. Un pago que llega después de vencer el apartado pasa de
-- `vencido` a `aprobado` (si aún hay unidades) o a `aprobado_sin_existencias`.
CREATE TABLE ref_transicion_cobro (
  de TEXT NOT NULL REFERENCES ref_estado_cobro (id),
  a TEXT NOT NULL REFERENCES ref_estado_cobro (id),
  PRIMARY KEY (de, a)
) WITHOUT ROWID;
INSERT INTO ref_transicion_cobro (de, a) VALUES
  ('esperando', 'aprobado'), ('esperando', 'aprobado_sin_existencias'), ('esperando', 'rechazado'),
  ('esperando', 'vencido'), ('esperando', 'revisar'),
  ('vencido', 'aprobado'), ('vencido', 'aprobado_sin_existencias'), ('vencido', 'revisar'),
  ('aprobado', 'reembolsado'), ('aprobado_sin_existencias', 'reembolsado'), ('revisar', 'reembolsado'),
  ('revisar', 'aprobado');

-- Solicitudes del comprador con radicado (Ley 1480 art. 50 lit. g, modificado por la Ley 2439 de
-- 2024) y de los titulares de datos (Ley 1581 arts. 14 y 15). `dias_habiles` y `prorroga` son los
-- plazos de respuesta; el vencimiento se calcula en código con el calendario de festivos de Colombia.
CREATE TABLE ref_tipo_solicitud (
  id TEXT PRIMARY KEY,
  dias_habiles INTEGER NOT NULL CHECK (dias_habiles > 0),
  prorroga INTEGER NOT NULL DEFAULT 0 CHECK (prorroga >= 0)
) WITHOUT ROWID;
INSERT INTO ref_tipo_solicitud (id, dias_habiles, prorroga) VALUES
  ('peticion', 15, 0), ('queja', 15, 0), ('reclamo', 15, 0),
  ('retracto', 5, 0),            -- plazo del comprador para ejercerlo (art. 47); el reembolso: 15 días calendario
  ('reversion', 15, 0),          -- participantes del proceso de pago (Decreto 587 de 2016)
  ('datos_consulta', 10, 5),     -- Ley 1581 art. 14
  ('datos_reclamo', 15, 8);      -- Ley 1581 art. 15

-- 1. La tienda y sus ajustes ----------------------------------------------------------------

-- Una fila por organización `tienda` del CORE que vive en este shard.
CREATE TABLE tienda (
  org_id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE CHECK (
    length(slug) BETWEEN 3 AND 40 AND slug NOT GLOB '*[^a-z0-9-]*' AND slug NOT GLOB '-*' AND slug NOT GLOB '*-'
  ),
  nombre TEXT NOT NULL CHECK (length(nombre) BETWEEN 1 AND 80),
  estado TEXT NOT NULL CHECK (estado IN ('borrador', 'abierta', 'cerrada', 'suspendida', 'baja')),
  plan TEXT NOT NULL,                   -- copia del CORE (llega firmada en el token o por el cron)
  plan_vence TEXT,
  ultimo_numero INTEGER NOT NULL DEFAULT 1000 CHECK (ultimo_numero >= 1000),
  ultima_solicitud INTEGER NOT NULL DEFAULT 0 CHECK (ultima_solicitud >= 0),
  version_publicada INTEGER,            -- la que sirve el despacho; NULL = nunca publicada
  creado TEXT NOT NULL,
  actualizado TEXT NOT NULL
);

-- Ajustes por sección, validados por esquema en código (`packages/tienda-schema`, P2). Un documento
-- por sección: guardar una sección es atómico y su `esquema` permite traducir versiones viejas
-- al leerlas, como `aVersionVigente` del agro. Lo secreto nunca va aquí (ver `credencial`).
CREATE TABLE ajuste (
  org_id TEXT NOT NULL REFERENCES tienda (org_id),
  seccion TEXT NOT NULL REFERENCES ref_seccion_ajuste (id),
  esquema INTEGER NOT NULL CHECK (esquema >= 1),
  datos TEXT NOT NULL CHECK (json_valid(datos) AND json_type(datos) = 'object'),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  actualizado TEXT NOT NULL,
  actualizado_por TEXT NOT NULL,
  PRIMARY KEY (org_id, seccion)
) WITHOUT ROWID;

-- Llaves de datos de la tienda (DEK), envueltas con la llave maestra (KEK) del Worker. Una por
-- propósito: borrar la de `datos_personales` al dar de baja una tienda deja ilegibles todos sus
-- datos de compradores de una vez (borrado criptográfico), sin tocar las credenciales.
CREATE TABLE llave (
  org_id TEXT NOT NULL REFERENCES tienda (org_id),
  proposito TEXT NOT NULL CHECK (proposito IN ('credenciales', 'datos_personales', 'indices')),
  version INTEGER NOT NULL CHECK (version >= 1),
  envuelta BLOB NOT NULL,               -- DEK cifrada con la KEK (AES-KW o AES-GCM)
  kek_id TEXT NOT NULL,                 -- qué KEK la envuelve: permite rotar la KEK reenvolviendo
  creada TEXT NOT NULL,
  retirada TEXT,
  PRIMARY KEY (org_id, proposito, version)
) WITHOUT ROWID;

-- Credenciales del comercio con su proveedor de pagos. Cifradas con la DEK `credenciales`;
-- AAD = org_id|proveedor|ambiente|campo, para que un cifrado no sirva copiado a otra fila.
CREATE TABLE credencial (
  org_id TEXT NOT NULL REFERENCES tienda (org_id),
  proveedor TEXT NOT NULL CHECK (proveedor IN ('bold')),
  ambiente TEXT NOT NULL CHECK (ambiente IN ('pruebas', 'produccion')),
  campo TEXT NOT NULL CHECK (campo IN ('identidad', 'secreta')),
  cifrado BLOB NOT NULL,
  iv BLOB NOT NULL CHECK (length(iv) = 12),
  llave_version INTEGER NOT NULL,
  huella TEXT NOT NULL,                 -- últimos 4 caracteres, para reconocerla en el panel
  guardada TEXT NOT NULL,
  verificada TEXT,                      -- última prueba exitosa contra el proveedor
  PRIMARY KEY (org_id, proveedor, ambiente, campo)
) WITHOUT ROWID;

-- 2. Catálogo -------------------------------------------------------------------------------

CREATE TABLE coleccion (
  org_id TEXT NOT NULL REFERENCES tienda (org_id),
  id TEXT NOT NULL,
  slug TEXT NOT NULL CHECK (slug NOT GLOB '*[^a-z0-9-]*' AND length(slug) BETWEEN 1 AND 80),
  nombre TEXT NOT NULL,
  descripcion_md TEXT NOT NULL DEFAULT '',
  posicion INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1,
  actualizado TEXT NOT NULL,
  borrado TEXT,
  PRIMARY KEY (org_id, id)
) WITHOUT ROWID;
-- Costo: 1 fila por colección creada.
CREATE UNIQUE INDEX coleccion_slug ON coleccion (org_id, slug) WHERE borrado IS NULL;

-- Las opciones (hasta 3 grupos de hasta 20 valores) van en `opciones` como JSON validado: son
-- pocas, se leen siempre con el producto y no se consultan solas. Cada combinación vendible es una
-- `variante`. Un producto sin opciones tiene una sola variante: así precio, inventario y fotos
-- viven siempre en el mismo sitio.
CREATE TABLE producto (
  org_id TEXT NOT NULL REFERENCES tienda (org_id),
  id TEXT NOT NULL,
  slug TEXT NOT NULL CHECK (slug NOT GLOB '*[^a-z0-9-]*' AND length(slug) BETWEEN 1 AND 100),
  nombre TEXT NOT NULL CHECK (length(nombre) BETWEEN 1 AND 140),
  descripcion_md TEXT NOT NULL DEFAULT '' CHECK (length(descripcion_md) <= 20000),
  estado TEXT NOT NULL CHECK (estado IN ('borrador', 'activo', 'archivado')),
  opciones TEXT NOT NULL DEFAULT '[]' CHECK (
    json_valid(opciones) AND json_type(opciones) = 'array' AND json_array_length(opciones) <= 3
  ),
  requiere_envio INTEGER NOT NULL DEFAULT 1 CHECK (requiere_envio IN (0, 1)),
  iva_pct INTEGER CHECK (iva_pct IS NULL OR iva_pct IN (0, 5, 19)),   -- NULL: el comercio no lo declara
  destacado INTEGER NOT NULL DEFAULT 0 CHECK (destacado IN (0, 1)),
  -- Ley 1480 art. 47: el retracto aplica salvo las excepciones de la ley (perecederos,
  -- personalizados, de uso personal…); el comercio marca el producto y dice cuál.
  retracto TEXT NOT NULL DEFAULT 'aplica' CHECK (retracto IN ('aplica', 'no_aplica')),
  retracto_motivo TEXT,
  solo_mayores INTEGER NOT NULL DEFAULT 0 CHECK (solo_mayores IN (0, 1)),   -- art. 52: verificar edad
  posicion INTEGER NOT NULL DEFAULT 0,
  seo TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(seo)),
  ref_externa TEXT,                     -- id en el sistema de origen (carga desde la 2.0, CSV)
  version INTEGER NOT NULL DEFAULT 1,
  creado TEXT NOT NULL,
  actualizado TEXT NOT NULL,
  borrado TEXT,
  PRIMARY KEY (org_id, id),
  CHECK (retracto = 'aplica' OR retracto_motivo IS NOT NULL)
) WITHOUT ROWID;
-- Costo: 1 fila por producto creado. La ficha se sirve horneada; esto lo usan el horno y el panel.
CREATE UNIQUE INDEX producto_slug ON producto (org_id, slug) WHERE borrado IS NULL;
-- Costo: 1 fila por producto que trae `ref_externa` (solo las cargas). Hace idempotente la carga.
CREATE UNIQUE INDEX producto_ref_externa ON producto (org_id, ref_externa) WHERE ref_externa IS NOT NULL;

CREATE TABLE coleccion_producto (
  org_id TEXT NOT NULL,
  coleccion_id TEXT NOT NULL,
  producto_id TEXT NOT NULL,
  posicion INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (org_id, coleccion_id, producto_id),
  FOREIGN KEY (org_id, coleccion_id) REFERENCES coleccion (org_id, id),
  FOREIGN KEY (org_id, producto_id) REFERENCES producto (org_id, id)
) WITHOUT ROWID;

-- `stock` NULL: la variante no lleva inventario (se vende sin contar). `reservado` lo mantienen
-- los triggers de `apartado`; el CHECK es la guarda contra la sobreventa: dos compradores por la
-- última unidad hacen que el segundo lote falle completo (D1 escribe de a uno por base).
CREATE TABLE variante (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  producto_id TEXT NOT NULL,
  clave TEXT NOT NULL,                  -- valores de las opciones en orden, unidos por «|»; '' sin opciones
  sku TEXT,
  precio_cop INTEGER NOT NULL CHECK (precio_cop >= 0),
  precio_antes_cop INTEGER CHECK (precio_antes_cop IS NULL OR precio_antes_cop > precio_cop),
  stock INTEGER CHECK (stock IS NULL OR stock >= 0),
  reservado INTEGER NOT NULL DEFAULT 0 CHECK (reservado >= 0),
  umbral_bajo INTEGER CHECK (umbral_bajo IS NULL OR umbral_bajo >= 0),
  activa INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1)),
  posicion INTEGER NOT NULL DEFAULT 0,
  cambio_motivo TEXT,                   -- lo pone quien cambia `stock`; lo lee el trigger del libro
  cambio_ref TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  actualizado TEXT NOT NULL,
  PRIMARY KEY (org_id, id),
  UNIQUE (org_id, producto_id, clave),
  FOREIGN KEY (org_id, producto_id) REFERENCES producto (org_id, id),
  CHECK (stock IS NULL OR reservado <= stock)
) WITHOUT ROWID;
-- El UNIQUE de arriba cuesta 1 fila por variante y sirve para leer las variantes de un producto.
-- Costo: 1 fila por variante con SKU. El comercio busca por SKU en el panel.
CREATE UNIQUE INDEX variante_sku ON variante (org_id, sku) WHERE sku IS NOT NULL;

-- Fotos: el navegador las comprime y el API las guarda en R2 por su huella (contenido
-- direccionado: la misma foto no se guarda dos veces). `variante_id` NULL = foto general.
CREATE TABLE medio (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL CHECK (length(id) = 64 AND id NOT GLOB '*[^0-9a-f]*'),   -- SHA-256 del original
  producto_id TEXT NOT NULL,
  variante_id TEXT,
  posicion INTEGER NOT NULL DEFAULT 0,
  alt TEXT NOT NULL DEFAULT '',
  ancho INTEGER NOT NULL CHECK (ancho > 0),
  alto INTEGER NOT NULL CHECK (alto > 0),
  formatos TEXT NOT NULL CHECK (json_valid(formatos)),   -- {"400": bytes, "800": bytes, "1600": bytes}
  creado TEXT NOT NULL,
  PRIMARY KEY (org_id, producto_id, id),
  FOREIGN KEY (org_id, producto_id) REFERENCES producto (org_id, id),
  FOREIGN KEY (org_id, variante_id) REFERENCES variante (org_id, id)
) WITHOUT ROWID;

-- Libro de inventario: cada cambio de `stock` deja su fila (lo escribe un trigger, así ningún
-- camino lo olvida). Responde «¿por qué tengo 3?» y permite reconciliar.
CREATE TABLE movimiento_inventario (
  org_id TEXT NOT NULL,
  id INTEGER PRIMARY KEY,               -- rowid: orden de llegada
  variante_id TEXT NOT NULL,
  delta INTEGER NOT NULL CHECK (delta <> 0),
  stock_resultante INTEGER,
  motivo TEXT NOT NULL CHECK (motivo IN ('venta', 'cancelacion', 'devolucion', 'ajuste', 'carga', 'conteo')),
  ref TEXT,                              -- pedido o importación que lo causó
  instante TEXT NOT NULL,
  FOREIGN KEY (org_id, variante_id) REFERENCES variante (org_id, id)
);
-- Costo: 1 fila por movimiento. El panel lee el libro de una variante.
CREATE INDEX movimiento_por_variante ON movimiento_inventario (org_id, variante_id, id);

-- Avísame: cuántas personas esperan una variante agotada, sin datos de nadie (heredado de la 2.0:
-- el contacto queda en el WhatsApp del comercio).
CREATE TABLE interes_reposicion (
  org_id TEXT NOT NULL,
  variante_id TEXT NOT NULL,
  personas INTEGER NOT NULL CHECK (personas >= 1),
  desde TEXT NOT NULL,
  ultimo TEXT NOT NULL,
  PRIMARY KEY (org_id, variante_id),
  FOREIGN KEY (org_id, variante_id) REFERENCES variante (org_id, id)
) WITHOUT ROWID;

-- 3. Venta: envíos y cupones ----------------------------------------------------------------

CREATE TABLE envio_opcion (
  org_id TEXT NOT NULL REFERENCES tienda (org_id),
  id TEXT NOT NULL,
  nombre TEXT NOT NULL,
  precio_cop INTEGER NOT NULL CHECK (precio_cop >= 0),
  gratis_desde_cop INTEGER CHECK (gratis_desde_cop IS NULL OR gratis_desde_cop > 0),
  ciudades TEXT CHECK (ciudades IS NULL OR (json_valid(ciudades) AND json_type(ciudades) = 'array')),  -- NULL: todas
  dias_min INTEGER CHECK (dias_min IS NULL OR dias_min >= 0),
  dias_max INTEGER CHECK (dias_max IS NULL OR dias_max >= 0),
  activa INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1)),
  posicion INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  borrado TEXT,
  PRIMARY KEY (org_id, id),
  CHECK (dias_min IS NULL OR dias_max IS NULL OR dias_min <= dias_max)
) WITHOUT ROWID;

CREATE TABLE cupon (
  org_id TEXT NOT NULL REFERENCES tienda (org_id),
  codigo TEXT NOT NULL CHECK (codigo = upper(codigo) AND length(codigo) BETWEEN 3 AND 24 AND codigo NOT GLOB '*[^A-Z0-9-]*'),
  tipo TEXT NOT NULL CHECK (tipo IN ('porcentaje', 'valor', 'envio_gratis')),
  valor INTEGER NOT NULL CHECK (valor >= 0),
  minimo_cop INTEGER NOT NULL DEFAULT 0 CHECK (minimo_cop >= 0),
  desde TEXT,
  hasta TEXT,
  usos_maximos INTEGER CHECK (usos_maximos IS NULL OR usos_maximos > 0),
  usos INTEGER NOT NULL DEFAULT 0 CHECK (usos >= 0),   -- solo pedidos confirmados o pagados
  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1,
  borrado TEXT,
  PRIMARY KEY (org_id, codigo),
  CHECK (tipo <> 'porcentaje' OR valor BETWEEN 1 AND 100),
  CHECK (usos_maximos IS NULL OR usos <= usos_maximos)
) WITHOUT ROWID;

-- 4. Pedidos --------------------------------------------------------------------------------

-- `codigo`: 6 letras y números sin ambiguos (base32 de Crockford). Lo genera el navegador una vez
-- por carrito: reenviar el mismo pedido no lo duplica. `numero`: el consecutivo humano (#1001).
-- `cambiado_por` lo escribe quien cambia el estado; el trigger lo lleva al historial.
CREATE TABLE pedido (
  org_id TEXT NOT NULL REFERENCES tienda (org_id),
  id TEXT NOT NULL,
  codigo TEXT NOT NULL CHECK (length(codigo) = 6 AND codigo NOT GLOB '*[^0-9A-HJKMNP-TV-Z]*'),
  numero INTEGER NOT NULL CHECK (numero > 1000),
  estado TEXT NOT NULL REFERENCES ref_estado_pedido (id),
  canal TEXT NOT NULL CHECK (canal IN ('whatsapp', 'en_linea', 'panel', 'agente', 'carga')),
  subtotal_cop INTEGER NOT NULL CHECK (subtotal_cop >= 0),
  descuento_cop INTEGER NOT NULL DEFAULT 0 CHECK (descuento_cop >= 0),
  envio_cop INTEGER NOT NULL DEFAULT 0 CHECK (envio_cop >= 0),
  total_cop INTEGER NOT NULL CHECK (total_cop >= 0),
  cupon_codigo TEXT,
  envio_opcion_id TEXT,
  envio_nombre TEXT,                     -- copia: el nombre de la opción el día del pedido
  ciudad TEXT,                           -- en claro: decide envío y estadística; sola no identifica
  seguimiento_huella TEXT CHECK (seguimiento_huella IS NULL OR (length(seguimiento_huella) = 64 AND seguimiento_huella NOT GLOB '*[^0-9a-f]*')),
  atencion TEXT CHECK (atencion IS NULL OR atencion IN ('sin_existencias', 'monto', 'datos')),
  transportadora TEXT,
  guia TEXT,
  agente TEXT,                           -- identidad del agente si llegó por MCP y la firmó (Web Bot Auth)
  -- Prueba de la aceptación (Ley 1480 arts. 48 y 50): la huella de los términos y la política que
  -- vio la persona (sus textos quedan en R2 por su huella, sin vencimiento) y el instante en que
  -- marcó la casilla, que nunca viene marcada. El pedido que prepara un agente no la tiene hasta
  -- que la persona lo confirma.
  terminos_huella TEXT CHECK (terminos_huella IS NULL OR (length(terminos_huella) = 64 AND terminos_huella NOT GLOB '*[^0-9a-f]*')),
  aceptado TEXT,
  acepta_novedades INTEGER NOT NULL DEFAULT 0 CHECK (acepta_novedades IN (0, 1)),
  cambiado_por TEXT NOT NULL,            -- 'comprador' | 'sistema' | 'usuario:<id>' | 'agente:<id>'
  version INTEGER NOT NULL DEFAULT 1,
  creado TEXT NOT NULL,
  actualizado TEXT NOT NULL,
  PRIMARY KEY (org_id, id),
  UNIQUE (org_id, codigo),
  UNIQUE (org_id, numero),
  CHECK (total_cop = subtotal_cop - descuento_cop + envio_cop),
  CHECK ((terminos_huella IS NULL) = (aceptado IS NULL)),
  CHECK (estado = 'pendiente' OR canal IN ('panel', 'carga') OR aceptado IS NOT NULL)
) WITHOUT ROWID;
-- Los dos UNIQUE cuestan 2 filas por pedido: el código lo pide el comprador (seguimiento) y el
-- número el comercio. Costo: 1 fila más por pedido. El panel lista por estado y fecha.
CREATE INDEX pedido_por_estado ON pedido (org_id, estado, creado);

CREATE TABLE pedido_linea (
  org_id TEXT NOT NULL,
  pedido_id TEXT NOT NULL,
  linea INTEGER NOT NULL CHECK (linea BETWEEN 1 AND 50),
  producto_id TEXT NOT NULL,
  variante_id TEXT NOT NULL,
  nombre TEXT NOT NULL,                  -- copias del día del pedido: cambiar el producto no cambia
  opciones TEXT NOT NULL DEFAULT '',     -- lo que se vendió («Talla: M · Color: Rosa»)
  sku TEXT,
  precio_unitario_cop INTEGER NOT NULL CHECK (precio_unitario_cop >= 0),
  cantidad INTEGER NOT NULL CHECK (cantidad BETWEEN 1 AND 999),
  total_cop INTEGER NOT NULL CHECK (total_cop >= 0),
  descontado INTEGER NOT NULL DEFAULT 0 CHECK (descontado IN (0, 1)),   -- ya salió del inventario
  PRIMARY KEY (org_id, pedido_id, linea),
  FOREIGN KEY (org_id, pedido_id) REFERENCES pedido (org_id, id),
  FOREIGN KEY (org_id, variante_id) REFERENCES variante (org_id, id),
  CHECK (total_cop = precio_unitario_cop * cantidad)
) WITHOUT ROWID;

-- Datos personales del comprador: un sobre cifrado (nombre, celular, correo, dirección, notas).
-- Solo los descifra el API para un usuario del comercio, y cada lectura queda en `registro`.
-- `celular_indice` es un HMAC con la DEK `indices`: permite buscar «los pedidos de este celular»
-- sin guardar el celular en claro.
CREATE TABLE pedido_contacto (
  org_id TEXT NOT NULL,
  pedido_id TEXT NOT NULL,
  sobre BLOB NOT NULL,
  iv BLOB NOT NULL CHECK (length(iv) = 12),
  llave_version INTEGER NOT NULL,
  celular_indice TEXT,
  creado TEXT NOT NULL,
  purgar_despues TEXT NOT NULL,          -- retención declarada en la política de la tienda
  PRIMARY KEY (org_id, pedido_id),
  FOREIGN KEY (org_id, pedido_id) REFERENCES pedido (org_id, id)
) WITHOUT ROWID;
-- Costo: 1 fila por pedido con celular. Búsqueda por celular en el panel.
CREATE INDEX contacto_por_celular ON pedido_contacto (org_id, celular_indice) WHERE celular_indice IS NOT NULL;

-- Historial del pedido: lo escribe el trigger en cada cambio de estado, y el API para notas.
CREATE TABLE pedido_evento (
  org_id TEXT NOT NULL,
  id INTEGER PRIMARY KEY,
  pedido_id TEXT NOT NULL,
  instante TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('estado', 'nota', 'pago', 'envio', 'contacto_leido')),
  de TEXT,
  a TEXT,
  actor TEXT NOT NULL,
  detalle TEXT CHECK (detalle IS NULL OR json_valid(detalle)),
  FOREIGN KEY (org_id, pedido_id) REFERENCES pedido (org_id, id)
);
-- Costo: 1 fila por evento. La ficha del pedido muestra su historia.
CREATE INDEX evento_por_pedido ON pedido_evento (org_id, pedido_id, id);

-- 5. Cobro en línea y apartados -------------------------------------------------------------

-- Un intento de pago. `id` es la referencia que viaja a Bold (`<codigo>-<intento>`).
-- `token_huella`: huella del token opaco con que la página pregunta por el pago.
CREATE TABLE cobro (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL CHECK (id NOT GLOB '*[^0-9A-Z-]*'),
  pedido_id TEXT NOT NULL,
  proveedor TEXT NOT NULL CHECK (proveedor IN ('bold')),
  ambiente TEXT NOT NULL CHECK (ambiente IN ('pruebas', 'produccion')),
  monto_cop INTEGER NOT NULL CHECK (monto_cop >= 1000),
  estado TEXT NOT NULL REFERENCES ref_estado_cobro (id),
  estado_proveedor TEXT,
  transaccion TEXT,
  medio TEXT,
  token_huella TEXT NOT NULL UNIQUE,
  consultas INTEGER NOT NULL DEFAULT 0,
  ultima_consulta TEXT,
  vence TEXT NOT NULL,                   -- hasta cuándo valen sus apartados
  creado TEXT NOT NULL,
  actualizado TEXT NOT NULL,
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id, pedido_id) REFERENCES pedido (org_id, id)
) WITHOUT ROWID;
-- Un pedido tiene a lo sumo un cobro esperando. Costo: 1 fila por cobro mientras espera.
CREATE UNIQUE INDEX cobro_uno_esperando ON cobro (org_id, pedido_id) WHERE estado = 'esperando';
-- Conciliación por cron: los que esperan, del más viejo al más nuevo. Costo: igual que el anterior.
CREATE INDEX cobro_esperando ON cobro (creado) WHERE estado = 'esperando';

-- Unidades apartadas para un cobro. Los triggers mantienen `variante.reservado`.
CREATE TABLE apartado (
  org_id TEXT NOT NULL,
  id INTEGER PRIMARY KEY,
  cobro_id TEXT NOT NULL,
  variante_id TEXT NOT NULL,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  estado TEXT NOT NULL CHECK (estado IN ('activo', 'consumido', 'liberado', 'vencido')),
  vence TEXT NOT NULL,
  creado TEXT NOT NULL,
  cerrado TEXT,
  FOREIGN KEY (org_id, cobro_id) REFERENCES cobro (org_id, id),
  FOREIGN KEY (org_id, variante_id) REFERENCES variante (org_id, id)
);
-- Liberar por variante los vencidos antes de apartar (vencimiento perezoso) y barrer por cron.
-- Costo: 1 fila por apartado activo.
CREATE INDEX apartado_activo ON apartado (org_id, variante_id, vence) WHERE estado = 'activo';

-- Avisos firmados del proveedor (webhooks), para no aplicar dos veces el mismo.
CREATE TABLE aviso_proveedor (
  org_id TEXT NOT NULL,
  proveedor TEXT NOT NULL,
  aviso_id TEXT NOT NULL,
  recibido TEXT NOT NULL,
  cobro_id TEXT,
  tipo TEXT NOT NULL,
  resultado TEXT NOT NULL CHECK (resultado IN ('aplicado', 'repetido', 'ignorado', 'error')),
  PRIMARY KEY (org_id, proveedor, aviso_id)
) WITHOUT ROWID;

-- Solicitudes con radicado. El contenido puede traer datos personales: va cifrado como el contacto.
CREATE TABLE solicitud (
  org_id TEXT NOT NULL REFERENCES tienda (org_id),
  id TEXT NOT NULL,
  radicado INTEGER NOT NULL CHECK (radicado >= 1),   -- consecutivo de la tienda; se muestra con fecha y hora
  tipo TEXT NOT NULL REFERENCES ref_tipo_solicitud (id),
  pedido_id TEXT,
  canal TEXT NOT NULL CHECK (canal IN ('web', 'whatsapp', 'correo', 'panel')),
  estado TEXT NOT NULL CHECK (estado IN ('radicada', 'en_tramite', 'respondida', 'cerrada')),
  sobre BLOB NOT NULL,
  iv BLOB NOT NULL CHECK (length(iv) = 12),
  llave_version INTEGER NOT NULL,
  creada TEXT NOT NULL,
  vence TEXT NOT NULL,                   -- calculado con días hábiles y festivos de Colombia
  respondida TEXT,
  cerrada TEXT,
  PRIMARY KEY (org_id, id),
  UNIQUE (org_id, radicado),
  FOREIGN KEY (org_id, pedido_id) REFERENCES pedido (org_id, id)
) WITHOUT ROWID;
-- El UNIQUE cuesta 1 fila por solicitud. Costo: 1 fila más. El panel lista las abiertas por vencimiento.
CREATE INDEX solicitud_abierta ON solicitud (org_id, vence) WHERE estado IN ('radicada', 'en_tramite');

-- 6. Contenido, publicación y operación -----------------------------------------------------

CREATE TABLE pagina (
  org_id TEXT NOT NULL REFERENCES tienda (org_id),
  id TEXT NOT NULL,
  slug TEXT NOT NULL CHECK (slug NOT GLOB '*[^a-z0-9-]*'),
  titulo TEXT NOT NULL,
  cuerpo_md TEXT NOT NULL CHECK (length(cuerpo_md) <= 50000),
  visible INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1,
  actualizado TEXT NOT NULL,
  borrado TEXT,
  PRIMARY KEY (org_id, id)
) WITHOUT ROWID;
CREATE UNIQUE INDEX pagina_slug ON pagina (org_id, slug) WHERE borrado IS NULL;

-- Cada publicación es una versión inmutable del sitio en R2 (`sitios/<org>/<version>/`).
-- Volver atrás es apuntar el despacho a una versión anterior: no se hornea de nuevo.
CREATE TABLE publicacion (
  org_id TEXT NOT NULL REFERENCES tienda (org_id),
  version INTEGER NOT NULL CHECK (version >= 1),
  estado TEXT NOT NULL CHECK (estado IN ('en_cola', 'horneando', 'lista', 'publicada', 'reemplazada', 'fallida')),
  motivo TEXT,
  archivos INTEGER,
  bytes INTEGER,
  huella TEXT,                           -- SHA-256 del manifiesto: misma huella, mismo sitio
  pedida_por TEXT NOT NULL,
  pedida TEXT NOT NULL,
  publicada TEXT,
  PRIMARY KEY (org_id, version)
) WITHOUT ROWID;
-- Una sola publicación en curso por tienda. Costo: 1 fila mientras hornea.
CREATE UNIQUE INDEX publicacion_en_curso ON publicacion (org_id) WHERE estado IN ('en_cola', 'horneando');

-- Lo que hizo cada quien (heredado de la pestaña Registro de la 2.0, en serio).
CREATE TABLE registro (
  org_id TEXT NOT NULL,
  id INTEGER PRIMARY KEY,
  instante TEXT NOT NULL,
  actor TEXT NOT NULL,
  accion TEXT NOT NULL,
  entidad TEXT NOT NULL,
  entidad_id TEXT,
  antes TEXT CHECK (antes IS NULL OR json_valid(antes)),
  despues TEXT CHECK (despues IS NULL OR json_valid(despues))
);
-- Costo: 1 fila por acción registrada. El panel muestra el registro de la tienda.
CREATE INDEX registro_por_tienda ON registro (org_id, id);

-- Escrituras del panel con clave `op` (8–64 caracteres): repetir no aplica dos veces.
CREATE TABLE operacion (
  org_id TEXT NOT NULL,
  op TEXT NOT NULL CHECK (length(op) BETWEEN 8 AND 64),
  ruta TEXT NOT NULL,
  respuesta TEXT NOT NULL CHECK (json_valid(respuesta)),
  creada TEXT NOT NULL,
  PRIMARY KEY (org_id, op)
) WITHOUT ROWID;

CREATE TABLE importacion (
  org_id TEXT NOT NULL REFERENCES tienda (org_id),
  id TEXT NOT NULL,
  formato TEXT NOT NULL CHECK (formato IN ('tienda-import/1')),
  estado TEXT NOT NULL CHECK (estado IN ('revisando', 'lista', 'aplicando', 'aplicada', 'fallida')),
  resumen TEXT CHECK (resumen IS NULL OR json_valid(resumen)),
  problemas TEXT CHECK (problemas IS NULL OR json_valid(problemas)),
  pedida_por TEXT NOT NULL,
  creada TEXT NOT NULL,
  terminada TEXT,
  PRIMARY KEY (org_id, id)
) WITHOUT ROWID;

-- 7. Triggers -------------------------------------------------------------------------------

-- Apartar suma a `reservado`; si no alcanza, el CHECK de `variante` aborta el lote completo.
CREATE TRIGGER apartado_suma AFTER INSERT ON apartado
WHEN NEW.estado = 'activo'
BEGIN
  UPDATE variante SET reservado = reservado + NEW.cantidad
   WHERE org_id = NEW.org_id AND id = NEW.variante_id;
END;

-- Cerrar un apartado (consumido, liberado o vencido) resta de `reservado`.
CREATE TRIGGER apartado_resta AFTER UPDATE OF estado ON apartado
WHEN OLD.estado = 'activo' AND NEW.estado <> 'activo'
BEGIN
  UPDATE variante SET reservado = reservado - OLD.cantidad
   WHERE org_id = OLD.org_id AND id = OLD.variante_id;
END;

-- Un apartado no cambia de variante ni de cantidad, ni vuelve a estar activo.
CREATE TRIGGER apartado_inmutable BEFORE UPDATE ON apartado
WHEN NEW.cantidad <> OLD.cantidad OR NEW.variante_id <> OLD.variante_id OR NEW.org_id <> OLD.org_id
  OR (OLD.estado <> 'activo' AND NEW.estado <> OLD.estado)
BEGIN
  SELECT RAISE(ABORT, 'apartado-inmutable');
END;

-- Solo las transiciones de `ref_transicion_pedido`.
CREATE TRIGGER pedido_transicion BEFORE UPDATE OF estado ON pedido
WHEN NEW.estado <> OLD.estado
  AND NOT EXISTS (SELECT 1 FROM ref_transicion_pedido WHERE de = OLD.estado AND a = NEW.estado)
BEGIN
  SELECT RAISE(ABORT, 'transicion-de-pedido-invalida');
END;

-- Solo las transiciones de `ref_transicion_cobro`.
CREATE TRIGGER cobro_transicion BEFORE UPDATE OF estado ON cobro
WHEN NEW.estado <> OLD.estado
  AND NOT EXISTS (SELECT 1 FROM ref_transicion_cobro WHERE de = OLD.estado AND a = NEW.estado)
BEGIN
  SELECT RAISE(ABORT, 'transicion-de-cobro-invalida');
END;

-- Ningún cambio de estado queda sin historial (P1).
CREATE TRIGGER pedido_historial AFTER UPDATE OF estado ON pedido
WHEN NEW.estado <> OLD.estado
BEGIN
  INSERT INTO pedido_evento (org_id, pedido_id, instante, tipo, de, a, actor)
  VALUES (NEW.org_id, NEW.id, NEW.actualizado, 'estado', OLD.estado, NEW.estado, NEW.cambiado_por);
END;

-- Ningún cambio de inventario queda sin su fila en el libro.
CREATE TRIGGER variante_libro AFTER UPDATE OF stock ON variante
WHEN NEW.stock IS NOT OLD.stock AND NEW.stock IS NOT NULL AND OLD.stock IS NOT NULL
BEGIN
  INSERT INTO movimiento_inventario (org_id, variante_id, delta, stock_resultante, motivo, ref, instante)
  VALUES (NEW.org_id, NEW.id, NEW.stock - OLD.stock, NEW.stock, coalesce(NEW.cambio_motivo, 'ajuste'), NEW.cambio_ref, NEW.actualizado);
END;
