// Prueba de las migraciones del CORE (node:sqlite): siembra datos con el esquema v0 (las reales
// 0001–0005), y después aplica en orden el resto de las reales (la 0006 desde HU-C2.2) y las
// propuestas. Uso: node probar-core.mjs <dir-migraciones-reales> <dir-propuestas>
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const [reales, propuestas] = process.argv.slice(2);
const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON');

let fallas = 0;
const ok = (cond, msg) => {
  if (!cond) fallas++;
  console.log(`${cond ? 'ok  ' : 'FALLA'} ${msg}`);
};
const debeFallar = (sql, msg) => {
  try {
    db.exec(sql);
    ok(false, `${msg} (no falló)`);
  } catch (e) {
    ok(true, `${msg} → ${e.message}`);
  }
};
// Como wrangler: cada archivo en una transacción.
const aplicar = (archivo) => {
  db.exec('BEGIN');
  try {
    db.exec(readFileSync(archivo, 'utf8'));
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw new Error(`${archivo}: ${e.message}`);
  }
};

// El esquema v0 es hasta la 0005: los datos de abajo se escriben como los escribe ese código.
const esV0 = (f) => f.slice(0, 4) <= '0005';
const sqlDe = (dir) => readdirSync(dir).filter((x) => x.endsWith('.sql'));
const delV0 = sqlDe(reales).filter(esV0).sort().map((f) => join(reales, f));
const despuesDelV0 = [
  ...sqlDe(reales).filter((f) => !esV0(f)).map((f) => join(reales, f)),
  ...sqlDe(propuestas).map((f) => join(propuestas, f)),
].sort((a, b) => basename(a).localeCompare(basename(b)));
for (const archivo of delV0) aplicar(archivo);

// Datos de hoy, escritos como los escribe el código v0.
db.exec(`
INSERT INTO celda (id, url_api, estado, anillo_despliegue, shards) VALUES ('c0', 'https://api-c0', 'activa', 0, '["agro_c0_s1"]');
INSERT INTO usuario (id, nombre, email, creado, politica_version, politica_aceptada) VALUES
  ('u1', 'Persona Uno', 'uno@example.com', '2026-10-01T00:00:00.000Z', '1', '2026-10-01T00:00:00.000Z'),
  ('u2', 'Persona Dos', 'dos@example.com', '2026-10-01T00:00:00.000Z', NULL, NULL);
INSERT INTO identidad (proveedor, sub, usuario_id) VALUES ('google', 'g1', 'u1'), ('google', 'g2', 'u2');
INSERT INTO organizacion (id, nombre, tipo, plan, celda_id, shard, anillo, creado, plan_vence) VALUES
  ('o1', 'Finca Ensayo Uno', 'finca', 'finca', 'c0', 'agro_c0_s1', 1, '2026-10-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z'),
  ('o2', 'Finca Ensayo Dos', 'finca', 'gratuito', 'c0', 'agro_c0_s1', 1, '2026-10-02T00:00:00.000Z', NULL);
INSERT INTO membresia (usuario_id, org_id, rol, creado) VALUES
  ('u1', 'o1', 'propietario', '2026-10-01T00:00:00.000Z'),
  ('u2', 'o1', 'operario', '2026-10-01T00:00:00.000Z'),
  ('u2', 'o2', 'propietario', '2026-10-02T00:00:00.000Z');
INSERT INTO invitacion (codigo_hash, org_id, rol, expira, creada_por, creada) VALUES
  ('h1', 'o1', 'supervisor', '2026-10-09T00:00:00.000Z', 'u1', '2026-10-02T00:00:00.000Z');
INSERT INTO interes_plan (usuario_id, org_id, plan, creado) VALUES ('u1', 'o1', 'exportador', '2026-10-02T00:00:00.000Z');
INSERT INTO pago (id, producto, proveedor, org_id, usuario_id, plan, meses, monto_cop, ambiente, estado, creado, actualizado) VALUES
  ('agro-1', 'agro', 'bold', 'o1', 'u1', 'finca', 1, 39000, 'produccion', 'aprobado', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z'),
  ('agro-2', 'agro', 'bold', 'o1', 'u1', 'finca', 1, 39000, 'produccion', 'esperando', '2026-10-04T00:00:00.000Z', '2026-10-04T00:00:00.000Z');
INSERT INTO sesion (id, usuario_id, refresh_hash, dispositivo, creado, expira) VALUES
  ('s1', 'u1', 'r1', 'tel-1', '2026-10-01T00:00:00.000Z', '2026-12-01T00:00:00.000Z'),
  ('s2', 'u2', 'r2', 'tel-2', '2026-10-01T00:00:00.000Z', '2026-12-01T00:00:00.000Z');
`);

const tablas = ['celda', 'usuario', 'identidad', 'organizacion', 'membresia', 'invitacion', 'interes_plan', 'pago', 'sesion'];
const contar = () => Object.fromEntries(tablas.map((t) => [t, db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n]));
const antes = contar();

for (const archivo of despuesDelV0) {
  const f = basename(archivo);
  try {
    aplicar(archivo);
    ok(true, `migración ${f} aplicada`);
  } catch (e) {
    ok(false, e.message);
  }
}

const despues = contar();
for (const t of tablas) ok(antes[t] === despues[t], `${t}: ${antes[t]} filas antes, ${despues[t]} después`);
ok(db.prepare('PRAGMA foreign_key_check').all().length === 0, 'PRAGMA foreign_key_check sin violaciones');
ok(db.prepare('PRAGMA integrity_check').get().integrity_check === 'ok', 'PRAGMA integrity_check = ok');
ok(db.prepare('PRAGMA foreign_keys').get().foreign_keys === 1, 'las claves foráneas siguen activas');
const o1 = db.prepare("SELECT * FROM organizacion WHERE id = 'o1'").get();
ok(o1.producto === 'agro' && o1.estado === 'activa' && o1.plan_vence === '2026-11-01T00:00:00.000Z', 'o1 conserva plan_vence y toma producto/estado');
ok(db.prepare("SELECT COUNT(*) n FROM aceptacion_politica WHERE usuario_id = 'u1' AND producto = 'agro'").get().n === 1, 'la política aceptada pasa a aceptacion_politica');
const fksMembresia = db.prepare('PRAGMA foreign_key_list(membresia)').all().map((r) => `${r.table}.${r.to}`);
ok(fksMembresia.includes('organizacion.id') && !fksMembresia.some((x) => x.includes('_nueva')), `membresia apunta a organizacion, no a una tabla _nueva (${fksMembresia.join(', ')})`);
const indices = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_autoindex%' ORDER BY name").all().map((r) => r.name);
console.log('     índices:', indices.join(', '));

// El código v0 sigue escribiendo como antes (fase expandir).
try {
  db.exec(`
  INSERT INTO organizacion (id, nombre, tipo, plan, celda_id, shard, anillo, creado) VALUES ('o3', 'Finca Ensayo Tres', 'finca', 'gratuito', 'c0', 'agro_c0_s1', 2, '2026-10-05T00:00:00.000Z');
  INSERT INTO membresia (usuario_id, org_id, rol, creado) VALUES ('u1', 'o3', 'propietario', '2026-10-05T00:00:00.000Z');
  INSERT INTO pago (id, producto, proveedor, org_id, usuario_id, plan, meses, monto_cop, ambiente, estado, creado, actualizado) VALUES ('agro-3', 'agro', 'bold', 'o3', 'u1', 'finca', 1, 39000, 'pruebas', 'esperando', '2026-10-05T00:00:00.000Z', '2026-10-05T00:00:00.000Z');
  INSERT INTO sesion (id, usuario_id, refresh_hash, dispositivo, creado, expira) VALUES ('s3', 'u1', 'r3', 'sin-canjear', '2026-10-05T00:00:00.000Z', '2026-10-05T00:02:00.000Z');
  INSERT OR IGNORE INTO interes_plan (usuario_id, org_id, plan, creado) VALUES ('u1', 'o3', 'finca', '2026-10-05T00:00:00.000Z');
  `);
  ok(true, 'las escrituras del código v0 (sin producto) siguen pasando');
} catch (e) {
  ok(false, `escrituras v0: ${e.message}`);
}

// Un segundo producto, como lo sembraría el despliegue desde productos.json.
db.exec(`
INSERT INTO producto (id, nombre, estado, actualizado) VALUES ('tienda', 'Tienda', 'activo', '2026-10-05T00:00:00.000Z');
INSERT INTO producto_tipo (producto, tipo) VALUES ('tienda', 'comercio');
INSERT INTO producto_rol (producto, rol, administra, invitable) VALUES ('tienda', 'propietario', 1, 1), ('tienda', 'colaborador', 0, 1);
INSERT INTO plan (producto, id, nombre, gratuito, estado) VALUES ('tienda', 'gratis', 'Gratis', 1, 'activo'), ('tienda', 'entrada', 'Entrada', 0, 'activo');
INSERT INTO plan_precio (producto, plan, meses, monto_cop, vigente_desde) VALUES
  ('tienda', 'entrada', 1, 29900, '2026-10-05T00:00:00.000Z'), ('tienda', 'entrada', 3, 85000, '2026-10-05T00:00:00.000Z'),
  ('tienda', 'entrada', 6, 161000, '2026-10-05T00:00:00.000Z'), ('tienda', 'entrada', 12, 299000, '2026-10-05T00:00:00.000Z');
INSERT INTO celda (id, producto, url_api, estado, anillo_despliegue, shards) VALUES ('c1', 'tienda', 'https://api-c1', 'activa', 0, '["tienda_c1_s1"]');
INSERT INTO organizacion (id, producto, nombre, tipo, plan, celda_id, shard, anillo, creado) VALUES ('t1', 'tienda', 'Comercio Ensayo Uno', 'comercio', 'gratis', 'c1', 'tienda_c1_s1', 1, '2026-10-05T00:00:00.000Z');
INSERT INTO membresia (usuario_id, org_id, producto, rol, creado) VALUES ('u2', 't1', 'tienda', 'propietario', '2026-10-05T00:00:00.000Z');
`);
ok(true, 'un segundo producto entra con datos, sin migración');
const periodos = db.prepare('SELECT group_concat(meses) m FROM (SELECT meses FROM periodo ORDER BY meses)').get().m;
ok(periodos === '1,3,6,12', `periodos sembrados: ${periodos} (mensual, trimestral, semestral y anual)`);
ok(db.prepare("SELECT COUNT(*) n FROM plan_precio WHERE producto = 'tienda' AND plan = 'entrada'").get().n === 4, 'un plan con precio en los cuatro periodos');
try {
  db.exec(`
  INSERT INTO periodo (meses, nombre) VALUES (24, 'bienal');
  INSERT INTO plan_precio (producto, plan, meses, monto_cop, vigente_desde) VALUES ('tienda', 'entrada', 24, 560000, '2026-10-05T00:00:00.000Z');
  `);
  ok(true, 'un periodo nuevo entra con dos INSERT, sin rehacer ninguna tabla (R1)');
} catch (e) {
  ok(false, `periodo nuevo: ${e.message}`);
}

debeFallar("INSERT INTO membresia (usuario_id, org_id, producto, rol, creado) VALUES ('u1', 't1', 'tienda', 'operario', 'x')", 'un rol del agro en una tienda');
debeFallar("INSERT INTO membresia (usuario_id, org_id, rol, creado) VALUES ('u1', 't1', 'colaborador', 'x')", 'una membresía sin producto (v0) en una tienda');
debeFallar("INSERT INTO organizacion (id, producto, nombre, tipo, plan, celda_id, shard, anillo, creado) VALUES ('t2', 'tienda', 'X', 'comercio', 'finca', 'c1', 'tienda_c1_s1', 2, 'x')", 'una tienda con un plan del agro');
debeFallar("INSERT INTO organizacion (id, producto, nombre, tipo, plan, celda_id, shard, anillo, creado) VALUES ('t3', 'tienda', 'X', 'comercio', 'gratis', 'c0', 'agro_c0_s1', 2, 'x')", 'una tienda en una celda del agro');
debeFallar("INSERT INTO pago (id, producto, proveedor, org_id, usuario_id, plan, meses, monto_cop, ambiente, estado, creado, actualizado) VALUES ('p9', 'tienda', 'bold', 'o1', 'u1', 'entrada', 1, 29900, 'pruebas', 'esperando', 'x', 'x')", 'un pago de tienda a nombre de una finca');
debeFallar("INSERT INTO pago (id, producto, proveedor, org_id, usuario_id, plan, meses, monto_cop, ambiente, estado, creado, actualizado) VALUES ('p8', 'tienda', 'bold', 't1', 'u2', 'entrada', 2, 59800, 'pruebas', 'esperando', 'x', 'x')", 'un pago por 2 meses (no es un periodo)');
debeFallar("INSERT INTO plan_precio (producto, plan, meses, monto_cop, vigente_desde) VALUES ('tienda', 'entrada', 1, 500, 'y')", 'un precio por debajo del mínimo de Bold');
debeFallar("INSERT INTO organizacion (id, producto, nombre, tipo, plan, celda_id, shard, anillo, creado) VALUES ('t4', 'tienda', 'X', 'finca', 'gratis', 'c1', 'tienda_c1_s1', 2, 'x')", 'una tienda de tipo finca');
debeFallar("INSERT INTO alcance (producto, id, descripcion, mueve_dinero) VALUES ('tienda', 'tienda:cobro:llaves', 'Cambiar las llaves de cobro', 1)", 'un alcance para agentes que mueve dinero');
debeFallar("INSERT INTO identidad (proveedor, sub, usuario_id) VALUES ('desconocido', 'x1', 'u1')", 'un proveedor de identidad que no está en la tabla de referencia');

// La guarda con datos reales: una fila vieja que no cabe en el modelo nuevo (un pago de 2 meses, que
// el v0 permitía con CHECK (meses > 0)) detiene la 0006 entera, en vez de pasar callada (§4.4, W4).
const db2 = new DatabaseSync(':memory:');
db2.exec('PRAGMA foreign_keys = ON');
const aplicarEn = (base, archivo) => {
  base.exec('BEGIN');
  try {
    base.exec(readFileSync(archivo, 'utf8'));
    base.exec('COMMIT');
  } catch (e) {
    base.exec('ROLLBACK');
    throw e;
  }
};
for (const archivo of delV0) aplicarEn(db2, archivo);
db2.exec(`
INSERT INTO celda (id, url_api, estado, anillo_despliegue, shards) VALUES ('c0', 'https://api-c0', 'activa', 0, '["agro_c0_s1"]');
INSERT INTO usuario (id, nombre, email, creado) VALUES ('u1', 'Persona Uno', 'uno@example.com', '2026-10-01T00:00:00.000Z');
INSERT INTO organizacion (id, nombre, tipo, plan, celda_id, shard, anillo, creado) VALUES ('o1', 'Finca Ensayo Uno', 'finca', 'finca', 'c0', 'agro_c0_s1', 1, '2026-10-01T00:00:00.000Z');
INSERT INTO pago (id, producto, proveedor, org_id, usuario_id, plan, meses, monto_cop, ambiente, estado, creado, actualizado) VALUES ('agro-9', 'agro', 'bold', 'o1', 'u1', 'finca', 2, 78000, 'pruebas', 'aprobado', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z');
`);
const archivo0006 = despuesDelV0.find((x) => basename(x).startsWith('0006'));
try {
  aplicarEn(db2, archivo0006);
  ok(false, 'un pago viejo de 2 meses detiene la 0006 (pasó)');
} catch (e) {
  const intacta = db2.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name = 'periodo'").get().n === 0;
  ok(/huerfanas = 0/.test(e.message) && intacta, `un pago viejo de 2 meses detiene la 0006 entera y la base queda como estaba → ${e.message}`);
}

console.log(fallas === 0 ? '\nTODO EN VERDE' : `\n${fallas} FALLA(S)`);
process.exit(fallas === 0 ? 0 : 1);
