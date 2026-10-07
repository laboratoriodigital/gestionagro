// Prueba del esquema propuesto del shard de parqueaderos con node:sqlite.
// Cada «lote» se corre como corre un batch de D1: todo o nada.
// Uso, desde la raíz del repositorio:
//   node docs/parking/sql/probar-parqueadero.mjs docs/parking/sql/parqueadero/0001_parqueadero_v1.sql
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const [archivo] = process.argv.slice(2);
let fallas = 0;
let total = 0;
const ok = (cond, msg) => {
  total++;
  if (!cond) fallas++;
  console.log(`${cond ? 'ok  ' : 'FALLA'} ${msg}`);
};

const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON');
db.exec('BEGIN');
db.exec(readFileSync(archivo, 'utf8'));
db.exec('COMMIT');
ok(true, 'el esquema se aplica');

const lote = (sentencias) => {
  db.exec('BEGIN');
  try {
    for (const [sql, ...p] of sentencias) db.prepare(sql).run(...p);
    db.exec('COMMIT');
    return { ok: true };
  } catch (e) {
    db.exec('ROLLBACK');
    return { ok: false, error: e.message };
  }
};
const una = (sql, ...p) => lote([[sql, ...p]]);
const fila = (sql, ...p) => db.prepare(sql).get(...p);
const T = '2026-10-06T23:00:00.000Z';
const mas = (min) => new Date(Date.parse(T) + min * 60000).toISOString();

// ── Forma del esquema ──────────────────────────────────────────────────────────────────────────

const tablas = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
  .all()
  .map((t) => t.name);
const sinOrg = tablas
  .filter((t) => !t.startsWith('ref_'))
  .filter((t) => !db.prepare(`SELECT name FROM pragma_table_info('${t}')`).all().some((c) => c.name === 'org_id'));
ok(sinOrg.length === 0, `toda tabla de datos lleva org_id ${sinOrg.join(', ')}`);

const conCascada = db
  .prepare("SELECT name FROM sqlite_master WHERE sql LIKE '%CASCADE%'")
  .all();
ok(conCascada.length === 0, 'ninguna clave foránea con ON DELETE CASCADE (R4)');

const indices = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_autoindex_%' ORDER BY name")
  .all()
  .map((i) => i.name)
  .join(',');
ok(
  indices === 'catalogo_pull,dispositivo_serie,registro_numero,registro_pull',
  `solo los índices justificados, cada uno con su costo: ${indices}`,
);

// ── Dos parqueaderos de prueba con datos distintos (P4) ────────────────────────────────────────

const disp = (org, id, serie, estado = 'activo', retirado = null) => [
  'INSERT INTO dispositivo (org_id, id, serie, nombre, estado, creado, retirado) VALUES (?, ?, ?, ?, ?, ?, ?)',
  org, id, serie, `Caja ${serie}`, estado, T, retirado,
];
const semilla = lote([
  disp('P1', 'tel-1', 'A'),
  disp('P1', 'pc-1', 'B'),
  disp('P2', 'tel-9', 'A'),
]);
ok(semilla.ok, `semilla: Parqueadero Ensayo Uno con dos cajas y Ensayo Dos con una ${semilla.error ?? ''}`);
ok(!una(...disp('P1', 'tel-2', 'A')).ok, 'dos dispositivos del mismo parqueadero no comparten serie');
ok(!una(...disp('P1', 'tel-3', 'a')).ok, 'la serie va en mayúsculas y sin símbolos');
ok(!una(...disp('P1', 'tel-4', 'C', 'retirado', null)).ok, 'un dispositivo retirado dice cuándo');

// Un registro como lo escribe el push: seq siguiente de su organización; si el id ya está, nada.
// ON CONFLICT (id) y no OR IGNORE: un número repetido con otro id tiene que fallar, no perderse.
const reg = (r) => [
  `INSERT INTO registro (id, org_id, seq, tipo, v, fecha_local, instante_evento, instante_recibido,
     dispositivo_id, origen, anula_id, estadia_id, serie, consecutivo, datos)
   VALUES (?, ?, (SELECT COALESCE(MAX(seq), 0) + 1 FROM registro WHERE org_id = ?), ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
   ON CONFLICT (id) DO NOTHING`,
  r.id, r.org ?? 'P1', r.org ?? 'P1', r.tipo, r.fecha ?? '2026-10-06', r.t ?? T, r.recibido ?? T,
  r.disp ?? 'tel-1', r.origen ?? 'manual', r.anula ?? null, r.estadia ?? null, r.serie ?? null,
  r.n ?? null, JSON.stringify(r.datos ?? {}),
];
const entrada = (id, n, extra = {}) =>
  reg({ id, tipo: 'entrada', estadia: id, serie: 'A', n, datos: { placa: 'ABC123', tipo_vehiculo: 'carro' }, ...extra });

// ── Recibos y su número ────────────────────────────────────────────────────────────────────────

ok(una(...entrada('e1', 1)).ok, 'una entrada con su número A-1');
ok(una(...entrada('e1', 1)).ok, 'reenviar la misma entrada no falla');
ok(fila("SELECT COUNT(*) n FROM registro WHERE id = 'e1'").n === 1, '…y no la duplica');
const repetido = una(...entrada('e2', 1));
ok(!repetido.ok && /UNIQUE/.test(repetido.error), `otro id con el mismo número falla (va a cuarentena): ${repetido.error}`);
ok(una(...entrada('e3', 1, { org: 'P2', disp: 'tel-9' })).ok, 'el mismo número A-1 en otro parqueadero sí entra');
const sinNumero = una(...reg({ id: 'e4', tipo: 'entrada', estadia: 'e4' }));
ok(!sinNumero.ok && /necesita serie y consecutivo/.test(sinNumero.error), `una entrada sin número falla: ${sinNumero.error}`);
const entregaConNumero = una(...reg({ id: 'r1', tipo: 'entrega_recibo', estadia: 'e1', serie: 'A', n: 2 }));
ok(!entregaConNumero.ok && /no lleva número/.test(entregaConNumero.error), 'una entrega de recibo no consume número');
const estadiaAjena = una(...entrada('e5', 3, { estadia: 'e1' }));
ok(!estadiaAjena.ok && /estadia_id = id/.test(estadiaAjena.error), 'una entrada abre su propia estadía');
const medioNumero = una(...reg({ id: 'e6', tipo: 'entrada', estadia: 'e6', serie: 'A' }));
ok(!medioNumero.ok, 'serie sin consecutivo falla');

// ── Series por dispositivo ─────────────────────────────────────────────────────────────────────

const serieAjena = una(...entrada('e7', 10, { disp: 'pc-1' }));
ok(!serieAjena.ok && /serie del recibo/.test(serieAjena.error), 'la PC no puede numerar con la serie del teléfono');
ok(una(...reg({ id: 'e8', tipo: 'entrada', estadia: 'e8', disp: 'pc-1', serie: 'B', n: 1, datos: { placa: 'XYZ98D', tipo_vehiculo: 'moto' } })).ok, 'la PC numera con su serie B');
ok(una("UPDATE dispositivo SET estado = 'retirado', retirado = ? WHERE org_id = 'P1' AND id = 'pc-1'", mas(60)).ok, 'la PC se retira');
ok(una(...reg({ id: 'e9', tipo: 'entrada', estadia: 'e9', disp: 'pc-1', serie: 'B', n: 2, t: mas(30), recibido: mas(90) })).ok,
  'un recibo hecho sin red antes del retiro llega después y entra (P1)');

// ── Estadías: la salida puede llegar primero ───────────────────────────────────────────────────

ok(una(...reg({ id: 's1', tipo: 'salida', estadia: 'e20', disp: 'tel-1', serie: 'A', n: 5, datos: { total_cop: 4600 } })).ok,
  'una salida cuya entrada todavía no llega se acepta');
ok(una(...entrada('e20', 4, { t: mas(-20) })).ok, '…y la entrada llega después');
ok(fila("SELECT COUNT(*) n FROM registro WHERE org_id = 'P1' AND estadia_id = 'e20'").n === 2, 'la estadía agrupa entrada y salida');
ok(una(...reg({ id: 'r2', tipo: 'entrega_recibo', estadia: 'e20', datos: { recibo_id: 's1', canal: 'whatsapp' } })).ok,
  'la entrega por WhatsApp se registra, sin número de teléfono');

// ── Anulaciones ────────────────────────────────────────────────────────────────────────────────

const anulaSinNada = una(...reg({ id: 'a1', tipo: 'anulacion', estadia: 'e1' }));
ok(!anulaSinNada.ok && /necesita el registro/.test(anulaSinNada.error), 'una anulación sin lo que anula falla');
const anulaAjeno = una(...reg({ id: 'a2', tipo: 'anulacion', anula: 'e3', estadia: 'e3' }));
ok(!anulaAjeno.ok && /no tiene/.test(anulaAjeno.error), 'no se anula un registro de otro parqueadero');
ok(una(...reg({ id: 'a3', tipo: 'anulacion', anula: 'e1', estadia: 'e1', datos: { motivo: 'placa mal digitada' } })).ok,
  'se anula una entrada propia, con motivo');
ok(fila("SELECT datos FROM registro WHERE id = 'e1'").datos.includes('ABC123'), 'la entrada anulada sigue ahí: nadie borra');

// ── Inmutabilidad y purga ──────────────────────────────────────────────────────────────────────

const cambiar = una("UPDATE registro SET datos = '{}' WHERE id = 'e1'");
ok(!cambiar.ok && /no se modifica/.test(cambiar.error), 'un registro no se modifica');
const borrar = una("DELETE FROM registro WHERE org_id = 'P1'");
ok(!borrar.ok && /purga autorizada/.test(borrar.error), 'sin purga autorizada no se borra nada');
ok(fila("SELECT COUNT(*) n FROM registro WHERE org_id = 'P1'").n > 0, '…y no se borró nada (todo o nada)');
ok(!una("INSERT INTO purga (org_id, autorizada, autor, exportacion_huella) VALUES ('P1', ?, 'operador', 'corta')", T).ok,
  'la purga exige la huella SHA-256 de la exportación');
ok(una("INSERT INTO purga (org_id, autorizada, autor, exportacion_huella) VALUES ('P1', ?, 'operador', ?)", T, 'f'.repeat(64)).ok,
  'purga autorizada para Ensayo Uno');
ok(!una("DELETE FROM registro WHERE org_id = 'P2'").ok, 'la purga de uno no abre el borrado del otro');
ok(una("DELETE FROM registro WHERE org_id = 'P1'").ok, 'con la purga, se retiran los registros de Ensayo Uno');
ok(fila("SELECT COUNT(*) n FROM registro WHERE org_id = 'P2'").n === 1, 'los de Ensayo Dos siguen intactos');

// ── Lo que crece entra con un INSERT (R1), y lo inválido no entra ──────────────────────────────

ok(!una(...reg({ id: 'x1', tipo: 'validacion_convenio', org: 'P2', disp: 'tel-9' })).ok, 'un tipo que no existe no entra');
ok(una("INSERT INTO ref_tipo_registro (id, lleva_numero, abre_estadia, pide_anula) VALUES ('validacion_convenio', 0, 0, 0)").ok,
  'un tipo nuevo es un INSERT, no rehacer la tabla');
ok(una(...reg({ id: 'x2', tipo: 'validacion_convenio', org: 'P2', disp: 'tel-9', estadia: 'e3' })).ok, '…y desde ahí entra');
ok(!una(...reg({ id: 'x3', tipo: 'nota', org: 'P2', disp: 'tel-9', fecha: '06/10/2026' })).ok, 'la fecha local va como AAAA-MM-DD');
ok(!una(...reg({ id: 'x4', tipo: 'nota', org: 'P2', disp: 'tel-9', origen: 'adivinado' })).ok, 'un origen desconocido no entra');
const jsonMalo = lote([[reg({ id: 'x5', tipo: 'nota', org: 'P2', disp: 'tel-9' })[0], 'x5', 'P2', 'P2', 'nota', '2026-10-06', T, T, 'tel-9', 'manual', null, null, null, null, '{malo']]);
ok(!jsonMalo.ok, 'datos que no son JSON no entran');

// ── Orden y secuencia ──────────────────────────────────────────────────────────────────────────

const seqs = db.prepare("SELECT seq FROM registro WHERE org_id = 'P2' ORDER BY seq").all().map((r) => r.seq);
ok(seqs.join(',') === '1,2', `seq crece por parqueadero sin huecos que importen: ${seqs.join(',')}`);
ok(!una("INSERT INTO registro (id, org_id, seq, tipo, v, fecha_local, instante_evento, instante_recibido, dispositivo_id, origen, datos) VALUES ('x6', 'P2', 1, 'nota', 1, '2026-10-06', ?, ?, 'tel-9', 'manual', '{}')", T, T).ok,
  'dos registros no comparten seq en un parqueadero');

// ── Un lote del push con una operación mala: todo o nada, y después una por una ───────────────

const push = [
  reg({ id: 'p1', tipo: 'entrada', estadia: 'p1', org: 'P2', disp: 'tel-9', serie: 'A', n: 2 }),
  reg({ id: 'p2', tipo: 'entrada', estadia: 'p2', org: 'P2', disp: 'tel-9', serie: 'A', n: 2 }),
  reg({ id: 'p3', tipo: 'entrada', estadia: 'p3', org: 'P2', disp: 'tel-9', serie: 'A', n: 3 }),
];
const enLote = lote(push);
ok(!enLote.ok && fila("SELECT COUNT(*) n FROM registro WHERE id IN ('p1', 'p2', 'p3')").n === 0,
  'un número repetido tumba el lote entero (como un batch de D1)');
const cuarentena = [];
for (const op of push) {
  const r = una(...op);
  if (!r.ok) {
    cuarentena.push(op[1]);
    una('INSERT INTO cuarentena (id, org_id, dispositivo_id, recibido, motivo, operacion) VALUES (?, ?, ?, ?, ?, ?)',
      op[1], 'P2', 'tel-9', T, `Número de recibo repetido (A-2): ${r.error}`, JSON.stringify({ id: op[1] }));
  }
}
ok(cuarentena.join(',') === 'p2', 'reintentado de a una, entran dos y la repetida va a cuarentena');
ok(fila("SELECT motivo FROM cuarentena WHERE id = 'p2'").motivo.startsWith('Número de recibo repetido'), 'la cuarentena dice el motivo en palabras');

// ── Catálogos ──────────────────────────────────────────────────────────────────────────────────

const cat = (id, entidad, version, datos, extra = {}) => [
  `INSERT INTO catalogo (id, org_id, seq, entidad, version, v, datos, actualizado, dispositivo_id, reemplazo)
   VALUES (?, 'P2', (SELECT COALESCE(MAX(seq), 0) + 1 FROM catalogo WHERE org_id = 'P2'), ?, ?, 1, ?, ?, 'tel-9', ?)
   ON CONFLICT (id) DO UPDATE SET version = excluded.version, datos = excluded.datos, actualizado = excluded.actualizado,
     dispositivo_id = excluded.dispositivo_id, reemplazo = excluded.reemplazo,
     seq = (SELECT COALESCE(MAX(seq), 0) + 1 FROM catalogo WHERE org_id = 'P2')`,
  id, entidad, version, JSON.stringify(datos), extra.t ?? T, extra.reemplazo ?? null,
];
ok(una(...cat('t-carro', 'tarifa', 1, { tipo_vehiculo: 'carro', por_minuto_cop: 200 })).ok, 'una tarifa nace en versión 1');
ok(una(...cat('t-carro', 'tarifa', 2, { tipo_vehiculo: 'carro', por_minuto_cop: 230 }, { t: mas(5) })).ok, 'se edita a la versión 2');
ok(fila("SELECT motivo FROM entidad_historial WHERE id = 't-carro@v1'").motivo === 'edicion', 'la versión 1 queda en el historial como edición');
ok(una(...cat('t-carro', 'tarifa', 3, { tipo_vehiculo: 'carro', por_minuto_cop: 220 }, { t: mas(6), reemplazo: JSON.stringify({ version: 2, dispositivo: 'tel-9' }) })).ok,
  'una edición que gana un conflicto');
ok(fila("SELECT motivo FROM entidad_historial WHERE id = 't-carro@v2'").motivo === 'conflicto', 'la versión que perdió queda como conflicto');
const baja = una(...cat('t-carro', 'tarifa', 2, { tipo_vehiculo: 'carro' }, { t: mas(7) }));
ok(!baja.ok && /solo sube/.test(baja.error), 'la versión no baja');
ok(!una(...cat('x-cat', 'impresora', 1, {})).ok, 'una entidad que no existe no entra (la impresora es del dispositivo, no se sincroniza)');
ok(fila("SELECT COUNT(*) n FROM catalogo WHERE org_id = 'P2'").n === 1, 'una tarifa, una fila: el historial guarda lo anterior');

console.log(fallas === 0 ? `TODO EN VERDE (${total} comprobaciones)` : `${fallas} FALLAS de ${total}`);
process.exit(fallas === 0 ? 0 : 1);
