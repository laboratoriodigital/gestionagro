/**
 * Push y pull del parqueadero (HU-Q7.4, CA2 y CA4) contra el D1 local del shard de c2, con los
 * datos de Ensayo Uno y Ensayo Dos (P4). El límite de 50 consultas por invocación se cuenta aquí.
 */

import { registroBase } from '@ed1/parqueadero-schema';
import {
  AJUSTE_ENSAYO,
  DISPOSITIVO,
  ENTRADA_ENSAYO,
  SALIDA_ENSAYO,
  SEDE_ENSAYO_UNO,
  TARIFA_CARRO,
  TARIFA_MOTO,
} from '@ed1/parqueadero-schema/ensayos';
import type { RespuestaPull } from '@ed1/parqueadero-schema/sync';
import { type Ack, LOTE_MAXIMO } from '@ed1/sync';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  abrir,
  alta,
  anulacion,
  CAJERO,
  contando,
  deCatalogo,
  deRegistro,
  type Entorno,
  entrada,
  idDe,
  lote,
  ORG_DOS,
  ORG_UNO,
  PROPIETARIO,
  pedir,
  SHARD,
  T0,
  token,
  vaciarShard,
} from './prueba.fixture.ts';
import { CONSULTAS_POR_INVOCACION, motivoDeLaBase } from './push.ts';

let e: Entorno;
beforeAll(async () => {
  e = await abrir();
}, 60_000);
afterAll(async () => e?.cerrar());
beforeEach(async () => {
  await vaciarShard(e.db);
  await alta(e.db, ORG_UNO, DISPOSITIVO, 'A');
});

const subir = async (
  ops: unknown[],
  datos: Parameters<typeof token>[1] = {},
  extra: Parameters<typeof pedir>[4] = {},
) => {
  const r = await pedir(
    e,
    '/api/v1/sync/push',
    await token(e, datos),
    { method: 'POST', body: lote(ops) },
    extra,
  );
  return { status: r.status, cuerpo: (await r.json()) as { acks: Ack[]; estado?: string } };
};
const estados = (acks: Ack[]) => acks.map((a) => a.estado);
const bajar = async (cursor = 'registro=0&catalogo=0', datos: Parameters<typeof token>[1] = {}) =>
  (await (
    await pedir(e, `/api/v1/sync/pull?${cursor}`, await token(e, datos))
  ).json()) as RespuestaPull;
const cuarentena = async () =>
  (
    await e.db
      .prepare('SELECT id, org_id, motivo FROM cuarentena ORDER BY id')
      .all<{ id: string; org_id: string; motivo: string }>()
  ).results;

const DEL_DIA = [
  deCatalogo(SEDE_ENSAYO_UNO),
  deCatalogo(TARIFA_CARRO),
  deCatalogo(TARIFA_MOTO),
  deCatalogo(AJUSTE_ENSAYO),
  deRegistro(ENTRADA_ENSAYO),
  deRegistro(SALIDA_ENSAYO),
];

describe('CA2 · push: sin perder ni repetir', () => {
  it('el día de la caja entra entero, con el parqueadero del token; reenviarlo no duplica', async () => {
    const primero = await subir(DEL_DIA);
    expect(primero.status).toBe(200);
    expect(estados(primero.cuerpo.acks)).toEqual(Array(6).fill('aceptado'));
    const segundo = await subir(DEL_DIA);
    expect(estados(segundo.cuerpo.acks)).toEqual(Array(6).fill('duplicado'));
    const filas = await e.db
      .prepare('SELECT org_id, seq, serie, consecutivo FROM registro ORDER BY seq')
      .all();
    expect(filas.results).toEqual([
      { org_id: ORG_UNO, seq: 1, serie: 'A', consecutivo: 123 },
      { org_id: ORG_UNO, seq: 2, serie: 'A', consecutivo: 124 },
    ]);
    expect(await cuarentena()).toEqual([]);
  });

  it('un consecutivo repetido con otro id va a cuarentena, y el resto del lote entra', async () => {
    await subir([deRegistro(ENTRADA_ENSAYO)]);
    const repetida = entrada(500, { consecutivo: ENTRADA_ENSAYO.consecutivo });
    const r = await subir([deRegistro(entrada(1)), deRegistro(repetida), deRegistro(entrada(2))]);
    expect(r.cuerpo.acks).toEqual([
      { id: idDe(1), estado: 'aceptado' },
      {
        id: idDe(500),
        estado: 'cuarentena',
        motivo: 'Ese número de recibo ya lo tiene otro registro de este parqueadero',
      },
      { id: idDe(2), estado: 'aceptado' },
    ]);
    expect(await cuarentena()).toEqual([
      {
        id: idDe(500),
        org_id: ORG_UNO,
        motivo: 'Ese número de recibo ya lo tiene otro registro de este parqueadero',
      },
    ]);
    const n = await e.db.prepare('SELECT count(*) AS n FROM registro').first<{ n: number }>();
    expect(n?.n).toBe(3);
  });

  it('lo que la base rechaza va a cuarentena con su motivo: una serie ajena y una anulación de nada', async () => {
    const ajena = entrada(10, { dispositivo_id: 'caja-sin-alta' });
    const deNada = anulacion(11, entrada(999));
    const r = await subir([deRegistro(ajena), deRegistro(deNada), deRegistro(entrada(12))]);
    expect(r.cuerpo.acks).toEqual([
      {
        id: idDe(10),
        estado: 'cuarentena',
        motivo: 'La nube lo rechazó: la serie del recibo no es la del dispositivo que lo hizo',
      },
      {
        id: idDe(11),
        estado: 'cuarentena',
        motivo: 'La nube lo rechazó: anula un registro que este parqueadero no tiene',
      },
      { id: idDe(12), estado: 'aceptado' },
    ]);
  });

  it('una salida que llega antes que su entrada se acepta (sin clave foránea, P1)', async () => {
    const r = await subir([deRegistro(SALIDA_ENSAYO)]);
    expect(estados(r.cuerpo.acks)).toEqual(['aceptado']);
    expect(estados((await subir([deRegistro(ENTRADA_ENSAYO)])).cuerpo.acks)).toEqual(['aceptado']);
  });

  it('lo que no valida va a cuarentena con el motivo del esquema, y el resto entra', async () => {
    const sinPlaca = { ...deRegistro(entrada(20)), datos: { ...entrada(20), datos: {} } };
    const r = await subir([sinPlaca, deRegistro(entrada(21))]);
    expect(r.cuerpo.acks[0]).toMatchObject({ id: idDe(20), estado: 'cuarentena' });
    expect(r.cuerpo.acks[0]?.motivo).toMatch(/placa/);
    expect(r.cuerpo.acks[1]).toEqual({ id: idDe(21), estado: 'aceptado' });
  });

  it('un dato que dice ser de otro parqueadero, o un id que ya usa otro, va a cuarentena', async () => {
    await alta(e.db, ORG_DOS, DISPOSITIVO, 'A');
    await subir([deRegistro(entrada(30))], { org: ORG_DOS });
    const r = await subir([deRegistro(entrada(31, { org_id: ORG_DOS })), deRegistro(entrada(30))]);
    expect(r.cuerpo.acks).toEqual([
      { id: idDe(31), estado: 'cuarentena', motivo: 'El dato es de otro parqueadero' },
      { id: idDe(30), estado: 'cuarentena', motivo: 'Ese id ya lo usa otro parqueadero' },
    ]);
  });

  it('un reloj de la caja adelantado se guarda igual y se avisa', async () => {
    const adelantada = entrada(40, { instante_evento: new Date(T0 + 3_600_000).toISOString() });
    const r = await subir([deRegistro(adelantada)]);
    expect(r.cuerpo.acks).toEqual([{ id: idDe(40), estado: 'aceptado', aviso: 'reloj-corrido' }]);
  });

  it('un lote sin protocolo, sin caja, vacío o de más de 25 no se procesa', async () => {
    const t = await token(e);
    const enviar = async (cuerpo: string) =>
      (await pedir(e, '/api/v1/sync/push', t, { method: 'POST', body: cuerpo })).status;
    expect(await enviar('no es json')).toBe(400);
    expect(await enviar(JSON.stringify({ protocolo: 9, dispositivo: 'x', ops: [] }))).toBe(400);
    expect(await enviar(lote([deRegistro(entrada(1))], ''))).toBe(400);
    expect(await enviar(lote([]))).toBe(400);
    expect(
      await enviar(
        lote(Array.from({ length: LOTE_MAXIMO + 1 }, (_, i) => deRegistro(entrada(i + 1)))),
      ),
    ).toBe(413);
  });
});

describe('presupuesto de consultas (P17): 50 por invocación', () => {
  it('un lote de 25 que entra entero usa 27 consultas: la caja, lo que ya hay y las 25', async () => {
    const { db, cuenta } = contando(e.db);
    const ops = Array.from({ length: LOTE_MAXIMO }, (_, i) => deRegistro(entrada(i + 1)));
    const r = await pedir(
      e,
      '/api/v1/sync/push',
      await token(e),
      { method: 'POST', body: lote(ops) },
      {
        [SHARD]: db,
      },
    );
    const { acks } = (await r.json()) as { acks: Ack[] };
    expect(estados(acks)).toEqual(Array(LOTE_MAXIMO).fill('aceptado'));
    expect(cuenta.consultas).toBe(2 + LOTE_MAXIMO);
  });

  it('un lote de 25 con una mala no pasa de 50: lo que no alcanza vuelve como «reintentar» y entra después', async () => {
    await subir([deRegistro(ENTRADA_ENSAYO)]);
    const { db, cuenta } = contando(e.db);
    const ops = Array.from({ length: LOTE_MAXIMO }, (_, i) =>
      deRegistro(
        i === 12 ? entrada(900, { consecutivo: ENTRADA_ENSAYO.consecutivo }) : entrada(i + 1),
      ),
    );
    const r = await pedir(
      e,
      '/api/v1/sync/push',
      await token(e),
      { method: 'POST', body: lote(ops) },
      {
        [SHARD]: db,
      },
    );
    const { acks } = (await r.json()) as { acks: Ack[] };
    expect(cuenta.consultas).toBeLessThanOrEqual(CONSULTAS_POR_INVOCACION);
    expect(acks[12]).toMatchObject({ id: idDe(900), estado: 'cuarentena' });
    const reintentar = acks.filter((a) => a.estado === 'reintentar');
    expect(reintentar.length).toBeGreaterThan(0);
    expect(acks.filter((a) => a.estado === 'aceptado').length + reintentar.length).toBe(24);
    // La caja reenvía lo que volvió como «reintentar», y entra.
    const otra = await subir(ops.filter((o) => reintentar.some((a) => a.id === o.id)));
    expect(estados(otra.cuerpo.acks)).toEqual(reintentar.map(() => 'aceptado'));
    const n = await e.db.prepare('SELECT count(*) AS n FROM registro').first<{ n: number }>();
    expect(n?.n).toBe(25);
  });
});

describe('permisos en la celda (HU-Q7.8, WI-Q7.8.2)', () => {
  const cajero = { rol: 'cajero', sub: CAJERO };

  it('el cajero no cambia tarifas: va a cuarentena con a quién pedírselo', async () => {
    const r = await subir([deCatalogo(TARIFA_CARRO)], cajero);
    expect(r.cuerpo.acks[0]).toMatchObject({ estado: 'cuarentena' });
    expect(r.cuerpo.acks[0]?.motivo).toMatch(/Pídaselo a quien administra el parqueadero/);
  });

  it('el cajero anula lo suyo en los primeros 10 minutos, y no lo de otro', async () => {
    const suya = entrada(50, { autor_usuario_id: cajero.sub });
    const deOtro = entrada(51, { autor_usuario_id: PROPIETARIO });
    const r = await subir(
      [
        deRegistro(suya),
        deRegistro(deOtro),
        deRegistro(anulacion(52, suya, { autor_usuario_id: cajero.sub })),
        deRegistro(anulacion(53, deOtro, { autor_usuario_id: cajero.sub })),
      ],
      cajero,
    );
    expect(estados(r.cuerpo.acks)).toEqual(['aceptado', 'aceptado', 'aceptado', 'cuarentena']);
    expect(r.cuerpo.acks[3]?.motivo).toBe('Con el rol de cajero solo se anula un recibo propio.');
    // La de la celda también cuenta: su recibo ya subido, anulado tarde, no.
    const tarde = anulacion(54, suya, {
      autor_usuario_id: cajero.sub,
      instante_evento: new Date(Date.parse(suya.instante_evento) + 11 * 60_000).toISOString(),
    });
    const r2 = await subir([deRegistro(tarde)], cajero);
    expect(r2.cuerpo.acks[0]?.motivo).toMatch(/Pasaron más de 10 minutos/);
  });
});

describe('catálogos: la última que llega gana, sin perder la anterior', () => {
  it('dos cajas editan la tarifa sin señal: queda la segunda y la primera pasa al historial', async () => {
    await subir([deCatalogo(TARIFA_CARRO)]);
    const v2 = { ...TARIFA_CARRO, version: 2, valor: 240 };
    expect(estados((await subir([deCatalogo(v2)])).cuerpo.acks)).toEqual(['aceptado']);
    const otraV2 = { ...TARIFA_CARRO, version: 2, valor: 250 };
    const r = await pedir(e, '/api/v1/sync/push', await token(e), {
      method: 'POST',
      body: lote([deCatalogo(otraV2)], 'caja-ensayo-2'),
    });
    expect(estados(((await r.json()) as { acks: Ack[] }).acks)).toEqual(['aceptado']);
    const pull = await bajar();
    const tarifa = pull.catalogos.find((c) => c.datos.id === TARIFA_CARRO.id);
    expect(tarifa?.datos).toMatchObject({ version: 3, valor: 250, org_id: ORG_UNO });
    expect(tarifa?.reemplazo).toEqual({
      version: 2,
      dispositivo: DISPOSITIVO,
      por_usuario: PROPIETARIO,
    });
    const historial = await e.db
      .prepare('SELECT id, motivo FROM entidad_historial ORDER BY id')
      .all();
    expect(historial.results).toEqual([
      { id: `${TARIFA_CARRO.id}@v1`, motivo: 'edicion' },
      { id: `${TARIFA_CARRO.id}@v2`, motivo: 'conflicto' },
    ]);
    // Reenviar la versión que perdió no la vuelve a escribir.
    expect(estados((await subir([deCatalogo(v2)])).cuerpo.acks)).toEqual(['duplicado']);
  });
});

describe('pull: lo de la otra caja, con la forma que la caja guarda', () => {
  it('baja catálogos y registros de su parqueadero, y nada del otro', async () => {
    await subir(DEL_DIA);
    await alta(e.db, ORG_DOS, DISPOSITIVO, 'A');
    await subir([deRegistro(entrada(60))], { org: ORG_DOS });
    const pull = await bajar();
    expect(pull.catalogos.map((c) => c.entidad)).toEqual([
      'sede',
      'tarifa',
      'tarifa',
      'ajuste_recibo',
    ]);
    expect(pull.registros.map((r) => r.id)).toEqual([ENTRADA_ENSAYO.id, SALIDA_ENSAYO.id]);
    for (const r of pull.registros) {
      expect(registroBase.parse(r)).toEqual({ ...r });
      expect(r).not.toHaveProperty('seq');
      expect(r).not.toHaveProperty('instante_recibido');
    }
    expect(pull.registros[0]).toEqual({ ...ENTRADA_ENSAYO, org_id: ORG_UNO });
    expect(pull.cursor).toEqual({ registro: 2, catalogo: 4 });
    expect(pull.mas).toBe(false);
    const otro = await bajar('registro=0&catalogo=0', { org: ORG_DOS });
    expect(otro.registros.map((r) => r.id)).toEqual([idDe(60)]);
    expect(otro.catalogos).toEqual([]);
  });

  it('con el cursor al día no baja nada, y solo lee: dos consultas, ninguna escritura', async () => {
    await subir(DEL_DIA);
    const { db, cuenta } = contando(e.db);
    const r = await pedir(
      e,
      '/api/v1/sync/pull?registro=2&catalogo=4',
      await token(e),
      {},
      {
        [SHARD]: db,
      },
    );
    expect(await r.json()).toEqual({
      catalogos: [],
      registros: [],
      cursor: { registro: 2, catalogo: 4 },
      mas: false,
    });
    expect(cuenta).toEqual({ consultas: 2, escrituras: 0 });
  });

  it('un cursor que no es un número responde 400', async () => {
    expect((await pedir(e, '/api/v1/sync/pull?registro=-1', await token(e))).status).toBe(400);
    expect((await pedir(e, '/api/v1/sync/pull?catalogo=abc', await token(e))).status).toBe(400);
  });
});

describe('qué es un rechazo del dato y qué una falla de la base', () => {
  it('lee los mensajes de los dos instrumentos y no confunde una base caída con un dato malo', () => {
    expect(
      motivoDeLaBase(
        new Error(
          'D1_ERROR: UNIQUE constraint failed: registro.org_id, registro.serie, registro.consecutivo: SQLITE_CONSTRAINT',
        ),
      ),
    ).toBe('Ese número de recibo ya lo tiene otro registro de este parqueadero');
    expect(
      motivoDeLaBase(new Error('la serie del recibo no es la del dispositivo que lo hizo')),
    ).toBe('La nube lo rechazó: la serie del recibo no es la del dispositivo que lo hizo');
    expect(motivoDeLaBase(new Error('D1_ERROR: Network connection lost.'))).toBeNull();
    expect(motivoDeLaBase(new Error('D1 DB is overloaded'))).toBeNull();
  });
});
