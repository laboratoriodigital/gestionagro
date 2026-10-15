/**
 * HU-T9.7: las solicitudes en el panel. Se radican por la ruta pública, como llegan desde la
 * tienda, y se atienden por la API del panel con tokens del CORE firmados de verdad, contra el
 * shard local con los comercios de prueba. Ningún dato es de una persona real.
 */
import { sumarDiasCalendario } from '@ed1/calendario';
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import {
  ENSAYO_DOS,
  ENSAYO_UNO,
  siembraDelControl,
  siembraDelShard,
} from '@ed1/tienda-schema/ensayos';
import { type Firmante, firmanteDesde, firmarAcceso, generarClavePrivada } from '@ed1/tokens';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FilaDeSolicitud, ReembolsoPendiente } from './panel-solicitudes.ts';
import { CABECERA_DESPACHO, CABECERA_TIENDA, crearApp, type Env } from './worker.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const SECRETO = 'secreto-de-prueba-de-las-solicitudes';
/** Jueves 15 de octubre de 2026, 10:00 en Colombia. */
const T0 = Date.UTC(2026, 9, 15, 15);
const AHORA = new Date(T0).toISOString();
const DIA = 86_400_000;
const PERSONA = '0199e0a0-0000-7000-8000-0000000000d7';
const UNO = ENSAYO_UNO.org;
const HOST = 'ensayo-uno--staging.laboratorio-digital.app';
const KEK = btoa(String.fromCharCode(...new Uint8Array(32).fill(9)));

let shard: BaseD1;
let control: BaseD1;
let firmante: Firmante;
const cerrar: (() => Promise<void>)[] = [];

beforeAll(async () => {
  const s = await baseLocal({
    configuracion: CONFIGURACION,
    binding: 'tienda_c1_s1',
    base: 'tienda',
  });
  const c = await baseLocal({
    configuracion: CONFIGURACION,
    binding: 'tienda_control',
    base: 'tienda-control',
  });
  shard = s.db;
  control = c.db;
  cerrar.push(s.cerrar, c.cerrar);
  for (const sql of siembraDelShard([ENSAYO_UNO, ENSAYO_DOS], AHORA))
    await shard.prepare(sql.replace(/;$/, '')).run();
  for (const sql of siembraDelControl([ENSAYO_UNO, ENSAYO_DOS], 'c1', AHORA))
    await control.prepare(sql.replace(/;$/, '')).run();
  firmante = await firmanteDesde(await generarClavePrivada());
}, 120_000);
afterAll(async () => {
  for (const c of cerrar) await c();
});

const env = (): Env => ({
  CELDA: 'c1',
  PRODUCTO: 'tienda',
  SECRETO_DESPACHO: SECRETO,
  CORE_CLAVES: JSON.stringify([firmante.publica]),
  TIENDA_KEK_V1: KEK,
  tienda_c1_s1: shard,
  tienda_control: control,
});

type Rol = 'propietario' | 'colaborador' | 'auditor';
const token = async (rol: Rol, ahora: number) =>
  (
    await firmarAcceso(
      firmante,
      {
        sub: PERSONA,
        org: UNO,
        rol,
        celda: 'c1',
        shard: 'tienda_c1_s1',
        anillo: 1,
        aud: 'tienda',
        plan: 'entrada',
        auth_time: Math.floor(ahora / 1000),
      },
      ahora,
      2,
    )
  ).token;

const panel = async (ruta: string, cuerpo?: unknown, o: { ahora?: number; rol?: Rol } = {}) => {
  const ahora = o.ahora ?? T0;
  return crearApp({ ahora: () => ahora, enSegundoPlano: () => undefined }).request(
    `/api/panel/v1/${ruta}`,
    {
      method: cuerpo === undefined ? 'GET' : 'POST',
      headers: {
        [CABECERA_DESPACHO]: SECRETO,
        authorization: `Bearer ${await token(o.rol ?? 'colaborador', ahora)}`,
        'content-type': 'application/json',
      },
      ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
    },
    env(),
  );
};

let n = 0;
/** Radica por la ruta pública, como la tienda; `ahora` es el instante en que llegó. */
const radicar = async (tipo: string, ahora = T0) => {
  const r = await crearApp({ ahora: () => ahora }).request(
    `https://${HOST}/api/v1/solicitudes`,
    {
      method: 'POST',
      body: JSON.stringify({
        tipo,
        texto: 'La camisa llegó con una costura abierta en la manga.',
        contacto: '3001234567',
        acepta: true,
        seguimiento: `solicitudpanel${String(++n).padStart(8, '0')}`,
      }),
      headers: {
        [CABECERA_DESPACHO]: SECRETO,
        [CABECERA_TIENDA]: JSON.stringify({ org: UNO, shard: 'tienda_c1_s1' }),
        'content-type': 'application/json',
      },
    },
    env(),
  );
  expect(r.status).toBe(200);
  return (await r.json()) as { radicado: string; vence: string };
};

const lista = async (ahora = T0) =>
  (await (await panel('solicitudes', undefined, { ahora })).json()) as {
    solicitudes: FilaDeSolicitud[];
    reembolsos: ReembolsoPendiente[];
  };
const idDe = async (radicado: string) =>
  (await lista()).solicitudes.find((s) => s.radicado === radicado)?.id ?? '';
let ops = 0;
const op = () => `op-solicitud-${++ops}`.padEnd(16, '0');
const frases = async () =>
  (
    (await (await panel('registro')).json()) as {
      filas: { frase: string }[];
    }
  ).filas.map((f) => f.frase);

/** La fecha de Colombia de un instante. */
const dia = (ms: number) => new Date(ms - 5 * 3_600_000).toISOString().slice(0, 10);
/** El mediodía en Colombia del día `AAAA-MM-DD`. */
const mediodia = (fecha: string) => Date.parse(`${fecha}T17:00:00Z`);

describe('las solicitudes en el panel (HU-T9.7)', () => {
  it('CA1: la lista dice cada una con su vencimiento, y avisa a 3 días y el día que vence', async () => {
    const queja = await radicar('queja', T0 - 20 * DIA);
    const consulta = await radicar('datos_consulta', T0);
    const ahora = (await lista()).solicitudes;
    expect(ahora.map((s) => s.radicado)).toEqual([queja.radicado, consulta.radicado]);
    const q = ahora[0] as FilaDeSolicitud;
    expect(q).toMatchObject({
      tipo: 'Queja',
      estado: 'radicada',
      vence: queja.vence,
      reloj: 'respuesta',
    });
    expect(q.dias).toBe(Math.round((Date.parse(queja.vence) - Date.parse(dia(T0))) / DIA));

    // A 3 días, avisa; el día que vence, «hoy»; antes de los 3 días, nada.
    const conDias = async (antes: number) =>
      (await lista(mediodia(queja.vence) - antes * DIA))?.solicitudes.find(
        (s) => s.radicado === queja.radicado,
      );
    expect(await conDias(4)).toMatchObject({ dias: 4, alerta: null });
    expect(await conDias(3)).toMatchObject({ dias: 3, alerta: 'pronto' });
    expect(await conDias(0)).toMatchObject({ dias: 0, alerta: 'hoy' });
  });

  it('❌ CA3: una vencida sin respuesta queda arriba, con su aviso', async () => {
    const vieja = await radicar('peticion', T0 - 60 * DIA);
    const s = (await lista()).solicitudes;
    expect(s[0]).toMatchObject({ radicado: vieja.radicado, alerta: 'vencida' });
    expect(s[0]?.dias).toBeLessThan(0);
  });

  it('CA2: el retracto lleva el reloj del reembolso, 15 días calendario', async () => {
    const r = await radicar('retracto', T0);
    const fila = (await lista()).solicitudes.find((s) => s.radicado === r.radicado);
    // 15 días después del jueves 15 de octubre es el viernes 30: hábil, no se corre.
    expect(fila).toMatchObject({ reloj: 'reembolso', vence: '2026-10-30', dias: 15 });
  });

  it('CA2: un pago aprobado sin existencias lleva su reloj de 15 días', async () => {
    const aprobado = new Date(T0 - 13 * DIA).toISOString();
    await shard.batch([
      shard
        .prepare(
          `INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, forma_pago, subtotal_cop, total_cop,
             atencion, terminos_huella, aceptado, cambiado_por, creado, actualizado)
           VALUES (?, 'pe-sinexist', 'S1NEX1', 1901, 'pagado', 'en_linea', 'en_linea', 129000, 129000,
             'sin_existencias', ?, ?, 'sistema', ?, ?)`,
        )
        .bind(UNO, 'a'.repeat(64), aprobado, aprobado, aprobado),
      shard
        .prepare(
          `INSERT INTO cobro (org_id, id, pedido_id, proveedor, ambiente, monto_cop, estado, token_huella, vence, creado, actualizado)
           VALUES (?, 'CB-SINEXIST', 'pe-sinexist', 'bold', 'pruebas', 129000, 'aprobado_sin_existencias', ?, ?, ?, ?)`,
        )
        .bind(UNO, 'b'.repeat(64), aprobado, aprobado, aprobado),
      // Un pago aprobado con existencias no debe nada: no lleva reloj.
      shard
        .prepare(
          `INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, forma_pago, subtotal_cop, total_cop,
             terminos_huella, aceptado, cambiado_por, creado, actualizado)
           VALUES (?, 'pe-aprobado', 'APR0B1', 1902, 'pagado', 'en_linea', 'en_linea', 99000, 99000,
             ?, ?, 'sistema', ?, ?)`,
        )
        .bind(UNO, 'a'.repeat(64), aprobado, aprobado, aprobado),
      shard
        .prepare(
          `INSERT INTO cobro (org_id, id, pedido_id, proveedor, ambiente, monto_cop, estado, token_huella, vence, creado, actualizado)
           VALUES (?, 'CB-APROBADO', 'pe-aprobado', 'bold', 'pruebas', 99000, 'aprobado', ?, ?, ?, ?)`,
        )
        .bind(UNO, 'c'.repeat(64), aprobado, aprobado, aprobado),
    ]);
    expect((await lista()).reembolsos).toEqual([
      {
        pedidoId: 'pe-sinexist',
        pedido: 1901,
        aprobado,
        vence: sumarDiasCalendario(dia(T0 - 13 * DIA), 15),
        dias: 2,
        alerta: 'pronto',
      },
    ]);
  });

  it('CA1: abrirla dice lo que contó la persona y queda en el registro', async () => {
    const r = await radicar('reclamo');
    const id = await idDe(r.radicado);
    const v = await panel('solicitudes/ver', { id });
    expect(v.status).toBe(200);
    expect(await v.json()).toMatchObject({
      estado: 'ok',
      contacto: '3001234567',
      texto: 'La camisa llegó con una costura abierta en la manga.',
      respuesta: null,
      solicitud: { radicado: r.radicado, tipo: 'Reclamo' },
    });
    expect((await frases())[0]).toBe(`Tú abriste la solicitud ${r.radicado}`);
    // La lista nunca lleva el contacto.
    expect(JSON.stringify(await lista())).not.toContain('3001234567');
  });

  it('CA1: responder la guarda cifrada y la deja respondida; cerrar la cierra', async () => {
    const r = await radicar('queja');
    const id = await idDe(r.radicado);
    const respuesta = 'Te enviamos una camisa nueva esta semana; la guía te llega por WhatsApp.';
    const opR = op();
    const g = await panel('solicitudes/responder', { op: opR, id, respuesta });
    expect(g.status).toBe(200);
    // Repetir la misma operación no responde dos veces.
    expect((await panel('solicitudes/responder', { op: opR, id, respuesta })).status).toBe(200);
    const fila = await shard
      .prepare('SELECT estado, respondida, sobre FROM solicitud WHERE org_id = ? AND id = ?')
      .bind(UNO, id)
      .first<{ estado: string; respondida: string; sobre: ArrayBuffer }>();
    expect(fila).toMatchObject({ estado: 'respondida', respondida: AHORA });
    expect(
      new TextDecoder().decode(new Uint8Array(fila?.sobre ?? new ArrayBuffer(0))),
    ).not.toContain('camisa nueva');
    expect(await (await panel('solicitudes/ver', { id })).json()).toMatchObject({
      respuesta: { texto: respuesta, instante: AHORA },
      solicitud: { estado: 'respondida', alerta: null },
    });

    // Otra persona que respondía a la vez no la pisa.
    const otra = await panel('solicitudes/responder', {
      op: op(),
      id,
      respuesta: `${respuesta} Otra.`,
    });
    expect(otra.status).toBe(409);

    expect((await panel('solicitudes/cerrar', { op: op(), id })).status).toBe(200);
    const s = (await lista()).solicitudes.find((x) => x.id === id);
    expect(s).toMatchObject({ estado: 'cerrada', alerta: null });
    expect((await frases()).slice(0, 3)).toEqual([
      `Tú cerraste la solicitud ${r.radicado}`,
      `Tú abriste la solicitud ${r.radicado}`,
      `Tú respondiste la solicitud ${r.radicado}`,
    ]);
  });

  it('❌ CA3: sin responder no se cierra, ni por la API ni en la base', async () => {
    const r = await radicar('peticion');
    const id = await idDe(r.radicado);
    const antes = await frases();
    const c = await panel('solicitudes/cerrar', { op: op(), id });
    expect(c.status).toBe(422);
    expect(await c.json()).toMatchObject({
      problemas: [{ mensaje: 'Primero respóndela: una solicitud no se cierra sin respuesta.' }],
    });
    expect(await frases()).toEqual(antes);
    await expect(
      shard
        .prepare("UPDATE solicitud SET estado = 'cerrada' WHERE org_id = ? AND id = ?")
        .bind(UNO, id)
        .run(),
    ).rejects.toThrow(/solicitud_cerrada_respondida/);
    expect((await lista()).solicitudes.find((x) => x.id === id)?.estado).toBe('radicada');
  });

  it('❌ una respuesta corta no se guarda; un rol fuera de la matriz no las ve', async () => {
    const id = await idDe((await radicar('queja')).radicado);
    const corta = await panel('solicitudes/responder', { op: op(), id, respuesta: 'Listo' });
    expect(corta.status).toBe(422);
    expect(await corta.json()).toMatchObject({
      problemas: [{ campo: 'respuesta', mensaje: 'la respuesta necesita al menos 10 caracteres' }],
    });
    expect((await panel('solicitudes', undefined, { rol: 'auditor' })).status).toBe(403);
    expect((await panel('solicitudes/ver', { id }, { rol: 'auditor' })).status).toBe(403);
  });
});
