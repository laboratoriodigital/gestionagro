/**
 * HU-Q10.2: un parqueadero se va. Con el arnés de cajas contra la celda en memoria (D1 local),
 * Ensayo Dos sube lo suyo desde sus cajas, se exporta, el archivo abre en una caja nueva, se
 * verifica la huella y se purga sin tocar a Ensayo Uno, que comparte el shard (P4, P21).
 */
import 'fake-indexeddb/auto';
import { uuidv7 } from '@ed1/ids';
import {
  ENTRADA_ENSAYO,
  SALIDA_ENSAYO,
  SEDE_ENSAYO_DOS,
  TARIFA_CARRO,
} from '@ed1/parqueadero-schema/ensayos';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  abrir,
  type Entorno,
  ORG_DOS,
  ORG_UNO,
  vaciarShard,
} from '../../apps/parqueadero-api/src/prueba.fixture.ts';
import {
  guardarSede,
  guardarTarifa,
  registrarEntrada,
  restaurar,
} from '../../apps/parqueadero-sitio/src/caja/almacen.ts';
import { abrirBase } from '../../apps/parqueadero-sitio/src/caja/datos.ts';
import type { BaseD1 } from '../../packages/d1/src/index.ts';
import {
  BajaRechazada,
  type Consultor,
  consultorHttp,
  ensayarBaja,
  exportar,
  ORG_DEL_ENSAYO,
  purgar,
  sha256,
  verificarEntrega,
} from '../../scripts/lib/baja-parqueadero.ts';
import { caja, configurar, contar, red, turno } from './parqueadero-arnes.ts';

let e: Entorno;
beforeAll(async () => {
  e = await abrir();
}, 60_000);
afterAll(async () => e?.cerrar());
beforeEach(async () => vaciarShard(e.db));

/** El `Consultor` del script sobre el D1 local; `fallarEn` corta la escritura N (desde 1). */
function local(db: BaseD1, fallarEn?: number): Consultor {
  let escritas = 0;
  return {
    leer: async <T>(sql: string, params: readonly (string | number | null)[] = []) =>
      (
        await db
          .prepare(sql)
          .bind(...params)
          .all<T>()
      ).results,
    escribir: async (sentencias) => {
      for (const s of sentencias) {
        if (++escritas === fallarEn) throw new Error('se cortó la conexión');
        await db
          .prepare(s.sql)
          .bind(...s.params)
          .run();
      }
    },
  };
}

const AHORA = () => Date.UTC(2026, 9, 9, 15);
const sinMeta = <T extends object>(c: T) => {
  const {
    id: _i,
    org_id: _o,
    version: _v,
    actualizado: _a,
    entidad: _e,
    ...resto
  } = c as T & Record<'id' | 'org_id' | 'version' | 'actualizado' | 'entidad', unknown>;
  return resto;
};

/** Ensayo Dos con dos cajas en la nube y Ensayo Uno al lado, en el mismo shard. */
async function dosParqueaderos() {
  const uno = await caja(e, 'A', { org: ORG_UNO });
  await configurar(uno);
  await turno(uno);
  await registrarEntrada(
    uno.db,
    { placa: 'UNO111', vehiculo: 'carro', placaConfirmada: false, novedades: [], fotos: [] },
    uno.ctx,
  );
  await uno.sincronizar(red(e).fn);

  const a = await caja(e, 'A', { org: ORG_DOS });
  await guardarSede(a.db, sinMeta(SEDE_ENSAYO_DOS), null, a.ctx);
  const tarifa = await guardarTarifa(a.db, sinMeta(TARIFA_CARRO), null, a.ctx);
  await turno(a);
  for (const placa of ['DOS111', 'DOS222']) {
    await registrarEntrada(
      a.db,
      { placa, vehiculo: 'carro', placaConfirmada: false, novedades: [], fotos: [] },
      a.ctx,
    );
  }
  await a.sincronizar(red(e).fn);
  // La tarifa editada después de subirla: la celda guarda la versión anterior en su historial.
  await guardarTarifa(a.db, { ...sinMeta(TARIFA_CARRO), valor: 200 }, tarifa.id, a.ctx);
  await a.sincronizar(red(e).fn);
  const b = await caja(e, 'B', { org: ORG_DOS });
  await b.sincronizar(red(e).fn);
  await turno(b);
  await registrarEntrada(
    b.db,
    { placa: 'DOS333', vehiculo: 'carro', placaConfirmada: false, novedades: [], fotos: [] },
    b.ctx,
  );
  await b.sincronizar(red(e).fn);
  return { uno, a, b };
}

const retirarTodas = (org: string) =>
  e.db
    .prepare("UPDATE dispositivo SET estado = 'retirado', retirado = ? WHERE org_id = ?")
    .bind(new Date(AHORA()).toISOString(), org)
    .run();

const deDos = (tabla: string) => contar(e, tabla, `org_id = '${ORG_DOS}'`);
const deUno = (tabla: string) => contar(e, tabla, `org_id = '${ORG_UNO}'`);

describe('un parqueadero se va (HU-Q10.2)', () => {
  it('CA1: exporta todo, el archivo abre en una caja nueva, verifica la huella y purga solo ese parqueadero', async () => {
    await dosParqueaderos();
    const db = local(e.db);
    const registros = await deDos('registro');
    expect(registros).toBeGreaterThanOrEqual(5);
    const antesUno = { registro: await deUno('registro'), catalogo: await deUno('catalogo') };

    // Con cajas activas no exporta: algo podría llegar después.
    await expect(exportar(db, ORG_DOS, { celda: 'c2', ahora: AHORA })).rejects.toThrow(
      'primero retire sus cajas (A, B)',
    );
    await retirarTodas(ORG_DOS);
    const ex = await exportar(db, ORG_DOS, { celda: 'c2', ahora: AHORA });
    expect(ex.parqueadero).toBe('Parqueadero Ensayo Dos');
    expect(ex.archivo.tablas.registro.recuento).toBe(registros);
    expect(ex.archivo.tablas.historial.recuento).toBe(1);
    expect(ex.huella).toBe(await sha256(ex.texto));
    expect(ex.csv.split('\n').length).toBeGreaterThan(registros);

    // Lo que se entrega abre en una caja nueva con «Restaurar», con todo.
    const nueva = abrirBase(`baja-${uuidv7()}`);
    const r = await restaurar(nueva, JSON.parse(ex.texto));
    expect(r.agregados).toBeGreaterThan(0);
    expect(await nueva.registros.count()).toBe(registros);

    await verificarEntrega(ex.texto, ex.huella);
    const p = await purgar(db, ORG_DOS, {
      texto: ex.texto,
      huella: ex.huella,
      autor: 'Dueño de prueba',
      confirmar: 'Parqueadero Ensayo Dos',
      ahora: AHORA,
    });
    expect(p.borrados.registro).toBe(registros);
    for (const t of ['registro', 'catalogo', 'entidad_historial', 'cuarentena']) {
      expect(await deDos(t)).toBe(0);
    }
    // Las cajas retiradas se quedan, y la purga guarda la huella de lo entregado.
    expect(await deDos('dispositivo')).toBe(2);
    expect(
      await e.db
        .prepare('SELECT exportacion_huella AS h FROM purga WHERE org_id = ?')
        .bind(ORG_DOS)
        .first(),
    ).toEqual({ h: ex.huella });
    // Ensayo Uno, en el mismo shard, sigue entero.
    expect({ registro: await deUno('registro'), catalogo: await deUno('catalogo') }).toEqual(
      antesUno,
    );
  });

  it('no purga si el archivo no es el entregado, si llegó algo después o sin escribir el nombre', async () => {
    const { b } = await dosParqueaderos();
    const db = local(e.db);
    await retirarTodas(ORG_DOS);
    const ex = await exportar(db, ORG_DOS, { celda: 'c2', ahora: AHORA });
    const base = {
      texto: ex.texto,
      huella: ex.huella,
      autor: 'Dueño de prueba',
      confirmar: 'Parqueadero Ensayo Dos',
      ahora: AHORA,
    };
    const editado = ex.texto.replace('DOS111', 'DOS999');
    await expect(purgar(db, ORG_DOS, { ...base, texto: editado })).rejects.toThrow(
      'no es el que se entregó',
    );
    await expect(
      purgar(db, ORG_DOS, { ...base, texto: editado, huella: await sha256(editado) }),
    ).rejects.toThrow('no está entero');
    await expect(purgar(db, ORG_DOS, { ...base, confirmar: 'Parqueadero' })).rejects.toThrow(
      '«Parqueadero Ensayo Dos»',
    );
    await expect(purgar(db, ORG_DOS, { ...base, autor: ' ' })).rejects.toThrow('--autor');

    // Una caja que se reactiva y sube algo después de exportar: la celda ya no es el archivo.
    await e.db
      .prepare("UPDATE dispositivo SET estado = 'activo', retirado = NULL WHERE id = ?")
      .bind(b.dispositivo)
      .run();
    await expect(purgar(db, ORG_DOS, base)).rejects.toThrow('hay cajas sin retirar (B)');
    await registrarEntrada(
      b.db,
      { placa: 'TAR444', vehiculo: 'carro', placaConfirmada: false, novedades: [], fotos: [] },
      b.ctx,
    );
    await b.sincronizar(red(e).fn);
    await retirarTodas(ORG_DOS);
    await expect(purgar(db, ORG_DOS, base)).rejects.toThrow(
      '«registro» en la celda no es igual a lo entregado',
    );
    expect(await contar(e, 'purga', `org_id = '${ORG_DOS}'`)).toBe(0);
    expect(await deDos('registro')).toBeGreaterThan(0);
  });

  it('CA3 ❌: sin la fila de purga, D1 rechaza el DELETE', async () => {
    await dosParqueaderos();
    await expect(
      e.db.prepare('DELETE FROM registro WHERE org_id = ?').bind(ORG_DOS).run(),
    ).rejects.toThrow('purga autorizada');
    expect(await deDos('registro')).toBeGreaterThan(0);
  });

  it('una purga cortada a mitad se termina repitiendo el comando', async () => {
    await dosParqueaderos();
    await retirarTodas(ORG_DOS);
    const ex = await exportar(local(e.db), ORG_DOS, { celda: 'c2', ahora: AHORA });
    const o = {
      texto: ex.texto,
      huella: ex.huella,
      autor: 'Dueño de prueba',
      confirmar: 'Parqueadero Ensayo Dos',
      ahora: AHORA,
    };
    // La purga y el primer DELETE (catálogos) pasan; la conexión se corta antes del segundo.
    await expect(purgar(local(e.db, 3), ORG_DOS, o)).rejects.toThrow('se cortó');
    expect(await deDos('catalogo')).toBe(0);
    expect(await deDos('registro')).toBeGreaterThan(0);
    const otra = await purgar(local(e.db), ORG_DOS, o);
    expect(otra.yaHecha).toBe(false);
    expect(await deDos('registro')).toBe(0);
    expect((await purgar(local(e.db), ORG_DOS, o)).yaHecha).toBe(true);
    // Con otra huella, no.
    const otroTexto = `${ex.texto} `;
    await expect(
      purgar(local(e.db), ORG_DOS, { ...o, texto: otroTexto, huella: await sha256(otroTexto) }),
    ).rejects.toThrow('ya tiene una purga con otra huella');
  });

  it('CA2: el ensayo con Ensayo Dos corre de punta a punta y deja la celda como estaba', async () => {
    await dosParqueaderos();
    const antes = await contar(e, 'registro');
    let n = 0;
    const r = await ensayarBaja(
      local(e.db),
      {
        sede: SEDE_ENSAYO_DOS,
        tarifa: TARIFA_CARRO,
        registros: [ENTRADA_ENSAYO, SALIDA_ENSAYO],
      },
      {
        celda: 'c2',
        ahora: () => AHORA() + n++ * 1000,
        nuevoId: () => uuidv7(() => AHORA() + n++),
      },
    );
    expect(r.pasos).toHaveLength(6);
    expect(r.pasos[1]).toBe('CA3: sin la fila de purga, D1 rechazó el DELETE');
    expect(r.exportacion.archivo.tablas.historial.recuento).toBe(1);
    for (const t of ['registro', 'catalogo', 'dispositivo', 'purga']) {
      expect(await contar(e, t, `org_id = '${ORG_DEL_ENSAYO}'`)).toBe(0);
    }
    expect(await contar(e, 'registro')).toBe(antes);
  });
});

describe('el consultor de la API de D1', () => {
  it('manda la consulta con sus parámetros y dice el error de D1 en palabras', async () => {
    const pedidos: unknown[] = [];
    const fetchFn = (async (_url: string, init?: RequestInit) => {
      const cuerpo = JSON.parse(String(init?.body)) as { sql: string };
      pedidos.push(cuerpo);
      return cuerpo.sql.startsWith('DELETE')
        ? Response.json(
            { success: false, errors: [{ message: 'un registro solo se borra con una purga' }] },
            { status: 400 },
          )
        : Response.json({ success: true, result: [{ results: [{ n: 1 }] }] });
    }) as unknown as typeof fetch;
    const db = consultorHttp(fetchFn, { token: 't', cuenta: 'c', base: 'b' });
    expect(await db.leer('SELECT 1 AS n WHERE ? = ?', [1, 1])).toEqual([{ n: 1 }]);
    expect(pedidos[0]).toEqual({ sql: 'SELECT 1 AS n WHERE ? = ?', params: [1, 1] });
    await expect(
      db.escribir([{ sql: 'DELETE FROM registro WHERE org_id = ?', params: ['x'] }]),
    ).rejects.toThrow('D1: un registro solo se borra con una purga');
  });

  it('un id que no es de un parqueadero no llega a la base', async () => {
    const nunca: Consultor = {
      leer: async () => {
        throw new Error('no debía leer');
      },
      escribir: async () => {
        throw new Error('no debía escribir');
      },
    };
    await expect(
      exportar(nunca, "x' OR 1=1 --", { celda: 'c2', ahora: AHORA }),
    ).rejects.toBeInstanceOf(BajaRechazada);
  });
});
