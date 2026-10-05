// Prueba de las migraciones propuestas del CORE contra las reales 0001–0005 (node:sqlite).
// Uso: node probar-core.mjs <dir-migraciones-reales> <dir-propuestas>
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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

for (const f of readdirSync(reales).filter((x) => x.endsWith('.sql')).sort()) aplicar(join(reales, f));

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

for (const f of readdirSync(propuestas).filter((x) => x.endsWith('.sql')).sort()) {
  try {
    aplicar(join(propuestas, f));
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
INSERT INTO plan (producto, id, nombre, gratuito, estado) VALUES ('tienda', 'prueba', 'Prueba', 1, 'activo'), ('tienda', 'tienda', 'Tienda', 0, 'activo');
INSERT INTO plan_precio (producto, plan, meses, monto_cop, vigente_desde) VALUES ('tienda', 'tienda', 1, 39000, '2026-10-05T00:00:00.000Z'), ('tienda', 'tienda', 3, 111000, '2026-10-05T00:00:00.000Z'), ('tienda', 'tienda', 12, 390000, '2026-10-05T00:00:00.000Z');
INSERT INTO celda (id, producto, url_api, estado, anillo_despliegue, shards) VALUES ('c1', 'tienda', 'https://api-c1', 'activa', 0, '["tienda_c1_s1"]');
INSERT INTO organizacion (id, producto, nombre, tipo, plan, celda_id, shard, anillo, creado) VALUES ('t1', 'tienda', 'Comercio Ensayo Uno', 'comercio', 'prueba', 'c1', 'tienda_c1_s1', 1, '2026-10-05T00:00:00.000Z');
INSERT INTO membresia (usuario_id, org_id, producto, rol, creado) VALUES ('u2', 't1', 'tienda', 'propietario', '2026-10-05T00:00:00.000Z');
`);
ok(true, 'un segundo producto entra con datos, sin migración');

debeFallar("INSERT INTO membresia (usuario_id, org_id, producto, rol, creado) VALUES ('u1', 't1', 'tienda', 'operario', 'x')", 'un rol del agro en una tienda');
debeFallar("INSERT INTO membresia (usuario_id, org_id, rol, creado) VALUES ('u1', 't1', 'colaborador', 'x')", 'una membresía sin producto (v0) en una tienda');
debeFallar("INSERT INTO organizacion (id, producto, nombre, tipo, plan, celda_id, shard, anillo, creado) VALUES ('t2', 'tienda', 'X', 'comercio', 'finca', 'c1', 'tienda_c1_s1', 2, 'x')", 'una tienda con un plan del agro');
debeFallar("INSERT INTO organizacion (id, producto, nombre, tipo, plan, celda_id, shard, anillo, creado) VALUES ('t3', 'tienda', 'X', 'comercio', 'prueba', 'c0', 'agro_c0_s1', 2, 'x')", 'una tienda en una celda del agro');
debeFallar("INSERT INTO pago (id, producto, proveedor, org_id, usuario_id, plan, meses, monto_cop, ambiente, estado, creado, actualizado) VALUES ('p9', 'tienda', 'bold', 'o1', 'u1', 'tienda', 1, 39000, 'pruebas', 'esperando', 'x', 'x')", 'un pago de tienda a nombre de una finca');
debeFallar("INSERT INTO pago (id, producto, proveedor, org_id, usuario_id, plan, meses, monto_cop, ambiente, estado, creado, actualizado) VALUES ('p8', 'tienda', 'bold', 't1', 'u2', 'tienda', 2, 78000, 'pruebas', 'esperando', 'x', 'x')", 'un pago por 2 meses (solo 1, 3 o 12)');
debeFallar("INSERT INTO plan_precio (producto, plan, meses, monto_cop, vigente_desde) VALUES ('tienda', 'tienda', 1, 500, 'y')", 'un precio por debajo del mínimo de Bold');
debeFallar("INSERT INTO organizacion (id, producto, nombre, tipo, plan, celda_id, shard, anillo, creado) VALUES ('t4', 'tienda', 'X', 'finca', 'prueba', 'c1', 'tienda_c1_s1', 2, 'x')", 'una tienda de tipo finca');

console.log(fallas === 0 ? '\nTODO EN VERDE' : `\n${fallas} FALLA(S)`);
process.exit(fallas === 0 ? 0 : 1);
