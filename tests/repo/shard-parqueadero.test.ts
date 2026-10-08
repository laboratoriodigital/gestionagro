import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BaseD1 } from '../../packages/d1/src/index.ts';
import {
  baseLocal,
  type Instrumento,
  migraciones,
  sentenciasDe,
} from '../../packages/d1/src/local.ts';

/**
 * El shard del parqueadero (`infrastructure/migraciones/parqueadero`, HU-Q7.2): las 56
 * comprobaciones que antes corría `docs/parking/sql/probar-parqueadero.mjs` con node:sqlite, ahora
 * con los dos instrumentos (HU-C11.7, P17): la base en proceso y el D1 local de workerd. Cada
 * «lote» es un `batch` de D1: todo o nada. Las comprobaciones dependen unas de otras, en orden.
 */

const CONFIGURACION = 'apps/parqueadero-api/wrangler.c2.jsonc';
const BINDING = 'parqueadero_c2_s1';
const COMPROBACIONES = 56;

type Sentencia = readonly [string, ...unknown[]];
type Resultado = { ok: true; error?: undefined } | { ok: false; error: string };

const T = '2026-10-06T23:00:00.000Z';
const mas = (min: number) => new Date(Date.parse(T) + min * 60000).toISOString();

const disp = (org: string, id: string, serie: string, estado = 'activo', retirado = null) =>
  [
    'INSERT INTO dispositivo (org_id, id, serie, nombre, estado, creado, retirado) VALUES (?, ?, ?, ?, ?, ?, ?)',
    org,
    id,
    serie,
    `Caja ${serie}`,
    estado,
    T,
    retirado,
  ] as const;

interface Reg {
  id: string;
  tipo: string;
  org?: string;
  fecha?: string;
  t?: string;
  recibido?: string;
  disp?: string;
  origen?: string;
  anula?: string;
  estadia?: string;
  serie?: string;
  n?: number;
  datos?: unknown;
}

// Un registro como lo escribe el push: seq siguiente de su organización; si el id ya está, nada.
// ON CONFLICT (id) y no OR IGNORE: un número repetido con otro id tiene que fallar, no perderse.
const SQL_REGISTRO = `INSERT INTO registro (id, org_id, seq, tipo, v, fecha_local, instante_evento, instante_recibido,
     dispositivo_id, origen, anula_id, estadia_id, serie, consecutivo, datos)
   VALUES (?, ?, (SELECT COALESCE(MAX(seq), 0) + 1 FROM registro WHERE org_id = ?), ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
   ON CONFLICT (id) DO NOTHING`;
const reg = (r: Reg): Sentencia => [
  SQL_REGISTRO,
  r.id,
  r.org ?? 'P1',
  r.org ?? 'P1',
  r.tipo,
  r.fecha ?? '2026-10-06',
  r.t ?? T,
  r.recibido ?? T,
  r.disp ?? 'tel-1',
  r.origen ?? 'manual',
  r.anula ?? null,
  r.estadia ?? null,
  r.serie ?? null,
  r.n ?? null,
  JSON.stringify(r.datos ?? {}),
];
const entrada = (id: string, n: number, extra: Partial<Reg> = {}) =>
  reg({
    id,
    tipo: 'entrada',
    estadia: id,
    serie: 'A',
    n,
    datos: { placa: 'ABC123', tipo_vehiculo: 'carro' },
    ...extra,
  });

const SQL_CATALOGO = `INSERT INTO catalogo (id, org_id, seq, entidad, version, v, datos, actualizado, dispositivo_id, reemplazo)
   VALUES (?, 'P2', (SELECT COALESCE(MAX(seq), 0) + 1 FROM catalogo WHERE org_id = 'P2'), ?, ?, 1, ?, ?, 'tel-9', ?)
   ON CONFLICT (id) DO UPDATE SET version = excluded.version, datos = excluded.datos, actualizado = excluded.actualizado,
     dispositivo_id = excluded.dispositivo_id, reemplazo = excluded.reemplazo,
     seq = (SELECT COALESCE(MAX(seq), 0) + 1 FROM catalogo WHERE org_id = 'P2')`;
const cat = (
  id: string,
  entidad: string,
  version: number,
  datos: unknown,
  extra: { t?: string; reemplazo?: string } = {},
): Sentencia => [
  SQL_CATALOGO,
  id,
  entidad,
  version,
  JSON.stringify(datos),
  extra.t ?? T,
  extra.reemplazo ?? null,
];

describe('las migraciones del shard se parten bien', () => {
  it('un trigger después de una línea en blanco llega entero', () => {
    const sql =
      'SELECT 1;\n\nCREATE TRIGGER t\nBEFORE UPDATE ON x\nBEGIN\n  SELECT 1;\n  SELECT 2;\nEND;';
    expect(sentenciasDe(sql)).toEqual([
      'SELECT 1',
      'CREATE TRIGGER t\nBEFORE UPDATE ON x\nBEGIN\n  SELECT 1;\n  SELECT 2;\nEND',
    ]);
  });

  it('un «;» seguido de un comentario cierra la sentencia', () => {
    const sql = "INSERT INTO t VALUES\n  ('a'),  -- uno; dos\n  ('b');  -- fin\nSELECT 1;";
    expect(sentenciasDe(sql)).toEqual([
      "INSERT INTO t VALUES\n  ('a'),  -- uno; dos\n  ('b')",
      'SELECT 1',
    ]);
    expect(migraciones('parqueadero').length).toBeGreaterThan(0);
  });
});

describe.each<Instrumento>(['sqlite', 'workerd'])(
  'el shard del parqueadero en %s (HU-Q7.2)',
  (instrumento) => {
    let db: BaseD1;
    let cerrar: () => Promise<void>;
    let total = 0;
    const ok = (cond: boolean, msg: string) => {
      total++;
      expect(cond, msg).toBe(true);
    };
    const lote = async (sentencias: readonly Sentencia[]): Promise<Resultado> => {
      try {
        await db.batch(sentencias.map(([sql, ...p]) => db.prepare(sql).bind(...p)));
        return { ok: true };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    };
    const una = (sql: string, ...p: unknown[]) => lote([[sql, ...p]]);
    const fila = async <F = Record<string, unknown>>(sql: string, ...p: unknown[]) =>
      (await db
        .prepare(sql)
        .bind(...p)
        .first<F>()) as F;
    const n = async (sql: string) => (await fila<{ n: number }>(sql)).n;

    beforeAll(async () => {
      ({ db, cerrar } = await baseLocal({
        configuracion: CONFIGURACION,
        binding: BINDING,
        base: 'parqueadero',
        instrumento,
      }));
    }, 60_000);
    afterAll(async () => cerrar?.());

    it('el esquema se aplica y tiene su forma', async () => {
      ok(true, 'el esquema se aplica');
      const tablas = (
        await db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations'",
          )
          .all<{ name: string }>()
      ).results.map((t) => t.name);
      const sinOrg: string[] = [];
      for (const t of tablas.filter((nombre) => !nombre.startsWith('ref_'))) {
        const columnas = (
          await db.prepare(`SELECT name FROM pragma_table_info('${t}')`).all<{ name: string }>()
        ).results;
        if (!columnas.some((c) => c.name === 'org_id')) sinOrg.push(t);
      }
      ok(sinOrg.length === 0, `toda tabla de datos lleva org_id ${sinOrg.join(', ')}`);
      const conCascada = (
        await db.prepare("SELECT name FROM sqlite_master WHERE sql LIKE '%CASCADE%'").all()
      ).results;
      ok(conCascada.length === 0, 'ninguna clave foránea con ON DELETE CASCADE (R4)');
      const indices = (
        await db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_autoindex_%' AND tbl_name NOT LIKE '_cf_%' ORDER BY name",
          )
          .all<{ name: string }>()
      ).results
        .map((i) => i.name)
        .join(',');
      ok(
        indices === 'catalogo_pull,dispositivo_serie,registro_numero,registro_pull',
        `solo los índices justificados, cada uno con su costo: ${indices}`,
      );
    });

    it('dos parqueaderos de prueba con datos distintos (P4)', async () => {
      const semilla = await lote([
        disp('P1', 'tel-1', 'A'),
        disp('P1', 'pc-1', 'B'),
        disp('P2', 'tel-9', 'A'),
      ]);
      ok(
        semilla.ok,
        `semilla: Parqueadero Ensayo Uno con dos cajas y Ensayo Dos con una ${semilla.error ?? ''}`,
      );
      ok(
        !(await una(...disp('P1', 'tel-2', 'A'))).ok,
        'dos dispositivos del mismo parqueadero no comparten serie',
      );
      ok(!(await una(...disp('P1', 'tel-3', 'a'))).ok, 'la serie va en mayúsculas y sin símbolos');
      ok(
        !(await una(...disp('P1', 'tel-4', 'C', 'retirado', null))).ok,
        'un dispositivo retirado dice cuándo',
      );
    });

    it('recibos y su número', async () => {
      ok((await una(...entrada('e1', 1))).ok, 'una entrada con su número A-1');
      ok((await una(...entrada('e1', 1))).ok, 'reenviar la misma entrada no falla');
      ok((await n("SELECT COUNT(*) n FROM registro WHERE id = 'e1'")) === 1, '…y no la duplica');
      const repetido = await una(...entrada('e2', 1));
      ok(
        !repetido.ok && /UNIQUE/.test(repetido.error),
        `otro id con el mismo número falla (va a cuarentena): ${repetido.error}`,
      );
      ok(
        (await una(...entrada('e3', 1, { org: 'P2', disp: 'tel-9' }))).ok,
        'el mismo número A-1 en otro parqueadero sí entra',
      );
      const sinNumero = await una(...reg({ id: 'e4', tipo: 'entrada', estadia: 'e4' }));
      ok(
        !sinNumero.ok && /necesita serie y consecutivo/.test(sinNumero.error),
        `una entrada sin número falla: ${sinNumero.error}`,
      );
      const entregaConNumero = await una(
        ...reg({ id: 'r1', tipo: 'entrega_recibo', estadia: 'e1', serie: 'A', n: 2 }),
      );
      ok(
        !entregaConNumero.ok && /no lleva número/.test(entregaConNumero.error),
        'una entrega de recibo no consume número',
      );
      const estadiaAjena = await una(...entrada('e5', 3, { estadia: 'e1' }));
      ok(
        !estadiaAjena.ok && /estadia_id = id/.test(estadiaAjena.error),
        'una entrada abre su propia estadía',
      );
      const medioNumero = await una(
        ...reg({ id: 'e6', tipo: 'entrada', estadia: 'e6', serie: 'A' }),
      );
      ok(!medioNumero.ok, 'serie sin consecutivo falla');
    });

    it('series por dispositivo', async () => {
      const serieAjena = await una(...entrada('e7', 10, { disp: 'pc-1' }));
      ok(
        !serieAjena.ok && /serie del recibo/.test(serieAjena.error),
        'la PC no puede numerar con la serie del teléfono',
      );
      ok(
        (
          await una(
            ...reg({
              id: 'e8',
              tipo: 'entrada',
              estadia: 'e8',
              disp: 'pc-1',
              serie: 'B',
              n: 1,
              datos: { placa: 'XYZ98D', tipo_vehiculo: 'moto' },
            }),
          )
        ).ok,
        'la PC numera con su serie B',
      );
      ok(
        (
          await una(
            "UPDATE dispositivo SET estado = 'retirado', retirado = ? WHERE org_id = 'P1' AND id = 'pc-1'",
            mas(60),
          )
        ).ok,
        'la PC se retira',
      );
      ok(
        (
          await una(
            ...reg({
              id: 'e9',
              tipo: 'entrada',
              estadia: 'e9',
              disp: 'pc-1',
              serie: 'B',
              n: 2,
              t: mas(30),
              recibido: mas(90),
            }),
          )
        ).ok,
        'un recibo hecho sin red antes del retiro llega después y entra (P1)',
      );
    });

    it('estadías: la salida puede llegar primero', async () => {
      ok(
        (
          await una(
            ...reg({
              id: 's1',
              tipo: 'salida',
              estadia: 'e20',
              disp: 'tel-1',
              serie: 'A',
              n: 5,
              datos: { total_cop: 4600 },
            }),
          )
        ).ok,
        'una salida cuya entrada todavía no llega se acepta',
      );
      ok((await una(...entrada('e20', 4, { t: mas(-20) }))).ok, '…y la entrada llega después');
      ok(
        (await n("SELECT COUNT(*) n FROM registro WHERE org_id = 'P1' AND estadia_id = 'e20'")) ===
          2,
        'la estadía agrupa entrada y salida',
      );
      ok(
        (
          await una(
            ...reg({
              id: 'r2',
              tipo: 'entrega_recibo',
              estadia: 'e20',
              datos: { recibo_id: 's1', canal: 'whatsapp' },
            }),
          )
        ).ok,
        'la entrega por WhatsApp se registra, sin número de teléfono',
      );
    });

    it('anulaciones', async () => {
      const anulaSinNada = await una(...reg({ id: 'a1', tipo: 'anulacion', estadia: 'e1' }));
      ok(
        !anulaSinNada.ok && /necesita el registro/.test(anulaSinNada.error),
        'una anulación sin lo que anula falla',
      );
      const anulaAjeno = await una(
        ...reg({ id: 'a2', tipo: 'anulacion', anula: 'e3', estadia: 'e3' }),
      );
      ok(
        !anulaAjeno.ok && /no tiene/.test(anulaAjeno.error),
        'no se anula un registro de otro parqueadero',
      );
      ok(
        (
          await una(
            ...reg({
              id: 'a3',
              tipo: 'anulacion',
              anula: 'e1',
              estadia: 'e1',
              datos: { motivo: 'placa mal digitada' },
            }),
          )
        ).ok,
        'se anula una entrada propia, con motivo',
      );
      ok(
        (
          await fila<{ datos: string }>("SELECT datos FROM registro WHERE id = 'e1'")
        ).datos.includes('ABC123'),
        'la entrada anulada sigue ahí: nadie borra',
      );
    });

    it('inmutabilidad y purga', async () => {
      const cambiar = await una("UPDATE registro SET datos = '{}' WHERE id = 'e1'");
      ok(!cambiar.ok && /no se modifica/.test(cambiar.error), 'un registro no se modifica');
      const borrar = await una("DELETE FROM registro WHERE org_id = 'P1'");
      ok(
        !borrar.ok && /purga autorizada/.test(borrar.error),
        'sin purga autorizada no se borra nada',
      );
      ok(
        (await n("SELECT COUNT(*) n FROM registro WHERE org_id = 'P1'")) > 0,
        '…y no se borró nada (todo o nada)',
      );
      const purga =
        "INSERT INTO purga (org_id, autorizada, autor, exportacion_huella) VALUES ('P1', ?, 'operador', ?)";
      ok(!(await una(purga, T, 'corta')).ok, 'la purga exige la huella SHA-256 de la exportación');
      ok((await una(purga, T, 'f'.repeat(64))).ok, 'purga autorizada para Ensayo Uno');
      ok(
        !(await una("DELETE FROM registro WHERE org_id = 'P2'")).ok,
        'la purga de uno no abre el borrado del otro',
      );
      ok(
        (await una("DELETE FROM registro WHERE org_id = 'P1'")).ok,
        'con la purga, se retiran los registros de Ensayo Uno',
      );
      ok(
        (await n("SELECT COUNT(*) n FROM registro WHERE org_id = 'P2'")) === 1,
        'los de Ensayo Dos siguen intactos',
      );
    });

    it('lo que crece entra con un INSERT (R1), y lo inválido no entra', async () => {
      const enP2 = { org: 'P2', disp: 'tel-9' };
      ok(
        !(await una(...reg({ id: 'x1', tipo: 'validacion_convenio', ...enP2 }))).ok,
        'un tipo que no existe no entra',
      );
      ok(
        (
          await una(
            "INSERT INTO ref_tipo_registro (id, lleva_numero, abre_estadia, pide_anula) VALUES ('validacion_convenio', 0, 0, 0)",
          )
        ).ok,
        'un tipo nuevo es un INSERT, no rehacer la tabla',
      );
      ok(
        (await una(...reg({ id: 'x2', tipo: 'validacion_convenio', estadia: 'e3', ...enP2 }))).ok,
        '…y desde ahí entra',
      );
      ok(
        !(await una(...reg({ id: 'x3', tipo: 'nota', fecha: '06/10/2026', ...enP2 }))).ok,
        'la fecha local va como AAAA-MM-DD',
      );
      ok(
        !(await una(...reg({ id: 'x4', tipo: 'nota', origen: 'adivinado', ...enP2 }))).ok,
        'un origen desconocido no entra',
      );
      const [sql, ...p] = reg({ id: 'x5', tipo: 'nota', ...enP2 });
      ok(!(await una(sql, ...p.slice(0, -1), '{malo')).ok, 'datos que no son JSON no entran');
    });

    it('orden y secuencia', async () => {
      const seqs = (
        await db
          .prepare("SELECT seq FROM registro WHERE org_id = 'P2' ORDER BY seq")
          .all<{ seq: number }>()
      ).results.map((r) => r.seq);
      ok(
        seqs.join(',') === '1,2',
        `seq crece por parqueadero sin huecos que importen: ${seqs.join(',')}`,
      );
      ok(
        !(
          await una(
            "INSERT INTO registro (id, org_id, seq, tipo, v, fecha_local, instante_evento, instante_recibido, dispositivo_id, origen, datos) VALUES ('x6', 'P2', 1, 'nota', 1, '2026-10-06', ?, ?, 'tel-9', 'manual', '{}')",
            T,
            T,
          )
        ).ok,
        'dos registros no comparten seq en un parqueadero',
      );
    });

    it('un lote del push con una operación mala: todo o nada, y después una por una', async () => {
      const enP2 = { org: 'P2', disp: 'tel-9', serie: 'A' };
      const push = [
        reg({ id: 'p1', tipo: 'entrada', estadia: 'p1', n: 2, ...enP2 }),
        reg({ id: 'p2', tipo: 'entrada', estadia: 'p2', n: 2, ...enP2 }),
        reg({ id: 'p3', tipo: 'entrada', estadia: 'p3', n: 3, ...enP2 }),
      ];
      const enLote = await lote(push);
      ok(
        !enLote.ok &&
          (await n("SELECT COUNT(*) n FROM registro WHERE id IN ('p1', 'p2', 'p3')")) === 0,
        'un número repetido tumba el lote entero (como un batch de D1)',
      );
      const cuarentena: unknown[] = [];
      for (const op of push) {
        const r = await una(...op);
        if (!r.ok) {
          cuarentena.push(op[1]);
          await una(
            'INSERT INTO cuarentena (id, org_id, dispositivo_id, recibido, motivo, operacion) VALUES (?, ?, ?, ?, ?, ?)',
            op[1],
            'P2',
            'tel-9',
            T,
            `Número de recibo repetido (A-2): ${r.error}`,
            JSON.stringify({ id: op[1] }),
          );
        }
      }
      ok(
        cuarentena.join(',') === 'p2',
        'reintentado de a una, entran dos y la repetida va a cuarentena',
      );
      ok(
        (
          await fila<{ motivo: string }>("SELECT motivo FROM cuarentena WHERE id = 'p2'")
        ).motivo.startsWith('Número de recibo repetido'),
        'la cuarentena dice el motivo en palabras',
      );
    });

    it('catálogos', async () => {
      const historial = async (id: string) =>
        (await fila<{ motivo: string }>('SELECT motivo FROM entidad_historial WHERE id = ?', id))
          .motivo;
      ok(
        (await una(...cat('t-carro', 'tarifa', 1, { tipo_vehiculo: 'carro', por_minuto_cop: 200 })))
          .ok,
        'una tarifa nace en versión 1',
      );
      ok(
        (
          await una(
            ...cat(
              't-carro',
              'tarifa',
              2,
              { tipo_vehiculo: 'carro', por_minuto_cop: 230 },
              { t: mas(5) },
            ),
          )
        ).ok,
        'se edita a la versión 2',
      );
      ok(
        (await historial('t-carro@v1')) === 'edicion',
        'la versión 1 queda en el historial como edición',
      );
      ok(
        (
          await una(
            ...cat(
              't-carro',
              'tarifa',
              3,
              { tipo_vehiculo: 'carro', por_minuto_cop: 220 },
              { t: mas(6), reemplazo: JSON.stringify({ version: 2, dispositivo: 'tel-9' }) },
            ),
          )
        ).ok,
        'una edición que gana un conflicto',
      );
      ok(
        (await historial('t-carro@v2')) === 'conflicto',
        'la versión que perdió queda como conflicto',
      );
      const baja = await una(
        ...cat('t-carro', 'tarifa', 2, { tipo_vehiculo: 'carro' }, { t: mas(7) }),
      );
      ok(!baja.ok && /solo sube/.test(baja.error), 'la versión no baja');
      ok(
        !(await una(...cat('x-cat', 'impresora', 1, {}))).ok,
        'una entidad que no existe no entra (la impresora es del dispositivo, no se sincroniza)',
      );
      ok(
        (await n("SELECT COUNT(*) n FROM catalogo WHERE org_id = 'P2'")) === 1,
        'una tarifa, una fila: el historial guarda lo anterior',
      );
    });

    it(`son ${COMPROBACIONES} comprobaciones, todas en verde`, () => {
      expect(total).toBe(COMPROBACIONES);
    });
  },
);
