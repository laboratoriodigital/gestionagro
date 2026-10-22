/**
 * HU-T6.4: las solicitudes con radicado. Contra el shard local con los comercios de prueba, por la
 * ruta de la API, como llega desde el despacho.
 */
import { DescifradoFallido, descifrarSobre } from '@ed1/cifrado';
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import {
  ENSAYO_DOS,
  ENSAYO_UNO,
  siembraDelControl,
  siembraDelShard,
} from '@ed1/tienda-schema/ensayos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deksDeLaTienda, kekDelEntorno } from './llaves.ts';
import { TIPOS_DE_SOLICITUD, vencimiento } from './solicitudes.ts';
import { CABECERA_DESPACHO, CABECERA_TIENDA, crearApp, type Env } from './worker.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const AHORA = '2026-10-14T15:00:00.000Z';
const SECRETO = 'secreto-de-prueba-del-despacho';
const UNO = ENSAYO_UNO.org;
const DOS = ENSAYO_DOS.org;
const HOST = 'ensayo-uno--staging.mitiendapro.co';
const KEK = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));

let shard: BaseD1;
let control: BaseD1;
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
}, 60_000);
afterAll(async () => {
  for (const c of cerrar) await c();
});

const env = (extra: Record<string, unknown> = {}): Env => ({
  CELDA: 'c1',
  SECRETO_DESPACHO: SECRETO,
  TIENDA_KEK_V1: KEK,
  tienda_c1_s1: shard,
  tienda_control: control,
  ...extra,
});
const post = (ruta: string, cuerpo: unknown, org = UNO, e: Env = env(), ahora = AHORA) =>
  crearApp({ ahora: () => Date.parse(ahora) }).request(
    `https://${HOST}${ruta}`,
    {
      method: 'POST',
      body: JSON.stringify(cuerpo),
      headers: {
        [CABECERA_DESPACHO]: SECRETO,
        [CABECERA_TIENDA]: JSON.stringify({ org, shard: 'tienda_c1_s1' }),
        'content-type': 'application/json',
      },
    },
    e,
  );

let n = 0;
/** Un secreto de enlace distinto por solicitud: cada uno es un formulario nuevo. */
const secreto = () => `solicitud${String(++n).padStart(13, '0')}`;
const solicitud = (extra: Record<string, unknown> = {}) => ({
  tipo: 'queja',
  texto: 'La camisa llegó con una costura abierta en la manga.',
  contacto: 'persona.ensayo@ejemplo.test',
  acepta: true,
  seguimiento: secreto(),
  ...extra,
});
interface Radicada {
  estado: string;
  radicado: string;
  numero: number;
  creada: string;
  vence: string;
}

it('la vitrina ofrece los mismos tipos que tiene ref_tipo_solicitud, ni uno más ni uno menos', async () => {
  const { results } = await shard
    .prepare('SELECT id FROM ref_tipo_solicitud ORDER BY id')
    .all<{ id: string }>();
  expect(results.map((r) => r.id)).toEqual([...TIPOS_DE_SOLICITUD].sort());
});

describe('radicar una solicitud (HU-T6.4 CA1)', () => {
  it('responde R-<consecutivo> con fecha, hora y vencimiento, y el siguiente es el que sigue', async () => {
    const a = (await (await post('/api/v1/solicitudes', solicitud())).json()) as Radicada;
    const b = (await (
      await post('/api/v1/solicitudes', solicitud({ tipo: 'peticion' }))
    ).json()) as Radicada;
    expect(a).toMatchObject({ estado: 'radicada', radicado: 'R-1', numero: 1, creada: AHORA });
    expect(a.vence).toBe('2026-11-05');
    expect(b).toMatchObject({ estado: 'radicada', radicado: 'R-2' });
  });

  it('cada tienda lleva su propio consecutivo', async () => {
    const r = (await (await post('/api/v1/solicitudes', solicitud(), DOS)).json()) as Radicada;
    expect(r.radicado).toBe('R-1');
  });

  it('reenviar el mismo formulario responde la misma solicitud, sin abrir otra', async () => {
    const una = solicitud();
    const a = (await (await post('/api/v1/solicitudes', una)).json()) as Radicada;
    const b = (await (await post('/api/v1/solicitudes', una)).json()) as Radicada;
    expect(b).toMatchObject({ estado: 'duplicada', radicado: a.radicado });
  });

  it('con un pedido de la tienda, la solicitud queda enlazada a él', async () => {
    await shard
      .prepare(
        `INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, forma_pago, subtotal_cop, descuento_cop,
           envio_cop, total_cop, cambiado_por, creado, actualizado)
         VALUES (?, 'p-sol', 'SXK234', 2001, 'pendiente', 'whatsapp', 'transferencia', 1000, 0, 0, 1000, 'comprador', ?, ?)`,
      )
      .bind(UNO, AHORA, AHORA)
      .run();
    const r = (await (
      await post('/api/v1/solicitudes', solicitud({ tipo: 'retracto', pedido: 'sxk234' }))
    ).json()) as Radicada;
    const fila = await shard
      .prepare('SELECT pedido_id FROM solicitud WHERE org_id = ? AND radicado = ?')
      .bind(UNO, r.numero)
      .first<{ pedido_id: string | null }>();
    expect(fila?.pedido_id).toBe('p-sol');
  });

  it('❌ sin la casilla marcada, sin texto o con un tipo que no existe, no se radica', async () => {
    for (const malo of [
      solicitud({ acepta: false }),
      solicitud({ acepta: undefined }),
      solicitud({ texto: 'corto' }),
      solicitud({ tipo: 'felicitacion' }),
    ]) {
      expect((await post('/api/v1/solicitudes', malo)).status).toBe(422);
    }
  });

  it('❌ sin la KEK no guarda nada y lo dice', async () => {
    const antes = await shard
      .prepare('SELECT COUNT(*) AS n FROM solicitud WHERE org_id = ?')
      .bind(UNO)
      .first<{ n: number }>();
    const r = await post(
      '/api/v1/solicitudes',
      solicitud(),
      UNO,
      env({ TIENDA_KEK_V1: undefined }),
    );
    expect(r.status).toBe(503);
    const despues = await shard
      .prepare('SELECT COUNT(*) AS n FROM solicitud WHERE org_id = ?')
      .bind(UNO)
      .first<{ n: number }>();
    expect(despues?.n).toBe(antes?.n);
  });
});

describe('el contacto se guarda cifrado (HU-T6.4 CA3)', () => {
  it('en claro solo quedan tipo, fechas y estado; el sobre se abre con la llave de la tienda', async () => {
    const r = (await (await post('/api/v1/solicitudes', solicitud())).json()) as Radicada;
    const fila = await shard
      .prepare(
        'SELECT id, sobre, iv, llave_version FROM solicitud WHERE org_id = ? AND radicado = ?',
      )
      .bind(UNO, r.numero)
      .first<{ id: string; sobre: ArrayBuffer; iv: ArrayBuffer; llave_version: number }>();
    if (!fila) throw new Error('no quedó la solicitud');
    const sobre = new Uint8Array(fila.sobre);
    expect(new TextDecoder().decode(sobre)).not.toContain('ejemplo.test');
    const kek = await kekDelEntorno(KEK);
    if (!kek) throw new Error('KEK de prueba ilegible');
    const deks = await deksDeLaTienda(shard, UNO, 'datos_personales', new Map([[kek.id, kek]]));
    const ctx = { org: UNO, tabla: 'solicitud', campo: 'sobre', id: fila.id };
    const partes = { sobre, iv: new Uint8Array(fila.iv), version: fila.llave_version };
    const claro = JSON.parse(await descifrarSobre(deks, ctx, partes)) as Record<string, unknown>;
    expect(claro).toMatchObject({ contacto: 'persona.ensayo@ejemplo.test', pedido: null });
    // Copiado a otra fila no se abre: el sobre está atado a su solicitud.
    await expect(descifrarSobre(deks, { ...ctx, id: 'otra' }, partes)).rejects.toThrow(
      DescifradoFallido,
    );
  });

  it('la tienda tiene una sola llave de datos personales, aunque radique muchas', async () => {
    const fila = await shard
      .prepare(
        "SELECT COUNT(*) AS n FROM llave WHERE org_id = ? AND proposito = 'datos_personales'",
      )
      .bind(UNO)
      .first<{ n: number }>();
    expect(fila?.n).toBe(1);
  });

  it('❌ más de 5 por minuto desde la misma IP: 429', async () => {
    let usadas = 0;
    const limitador = { limit: async () => ({ success: ++usadas <= 5 }) };
    const e = env({ LIMITE_SOLICITUDES: limitador });
    for (let i = 0; i < 5; i++)
      expect((await post('/api/v1/solicitudes', solicitud(), UNO, e)).status).toBe(200);
    expect((await post('/api/v1/solicitudes', solicitud(), UNO, e)).status).toBe(429);
  });
});

describe('el vencimiento, en días hábiles de Colombia (HU-T6.4 CA2 y CA3)', () => {
  // Miércoles 24 de marzo de 2027: la Semana Santa es el 25 y 26, y el lunes 22 fue San José.
  const MARZO = Date.parse('2027-03-24T15:00:00Z');

  it('15 días hábiles saltan los fines de semana y los festivos de Semana Santa', () => {
    expect(vencimiento('queja', 15, MARZO)).toBe('2027-04-16');
  });

  it('las consultas de datos: 10 días hábiles', () => {
    expect(vencimiento('datos_consulta', 10, MARZO)).toBe('2027-04-09');
  });

  it('el retracto: 15 días calendario, y si caen en festivo se corren al siguiente hábil', () => {
    // 10 de marzo + 15 = 25 de marzo de 2027, Jueves Santo: se corre al lunes 29.
    expect(vencimiento('retracto', 5, Date.parse('2027-03-10T15:00:00Z'))).toBe('2027-03-29');
    expect(vencimiento('retracto', 5, Date.parse('2027-03-01T15:00:00Z'))).toBe('2027-03-16');
  });

  it('cuenta desde el día en Colombia, no en UTC', () => {
    // 2 de noviembre a las 23:00 de Bogotá es 3 de noviembre en UTC.
    expect(vencimiento('peticion', 1, Date.parse('2026-11-03T04:00:00Z'))).toBe('2026-11-03');
  });
});

describe('seguir la solicitud (HU-T6.4 CA1)', () => {
  it('con su radicado y su secreto dice el estado; con cualquier otro, lo mismo que si no existiera', async () => {
    const una = solicitud();
    const r = (await (await post('/api/v1/solicitudes', una)).json()) as Radicada;
    const bien = await post('/api/v1/solicitudes/seguimiento', {
      radicado: r.numero,
      secreto: una.seguimiento,
    });
    expect(bien.status).toBe(200);
    expect(await bien.json()).toMatchObject({
      radicado: r.radicado,
      tipo: 'Queja',
      estado: 'radicada',
      vence: r.vence,
    });
    const otro = await post('/api/v1/solicitudes/seguimiento', {
      radicado: r.numero,
      secreto: 'zzzzzzzzzzzzzzzzzzzzzz',
    });
    const inexistente = await post('/api/v1/solicitudes/seguimiento', {
      radicado: 99999,
      secreto: una.seguimiento,
    });
    expect(otro.status).toBe(404);
    expect(inexistente.status).toBe(404);
    expect(await otro.json()).toEqual(await inexistente.json());
  });

  it('❌ desde otra tienda, el mismo enlace no encuentra nada', async () => {
    const una = solicitud();
    const r = (await (await post('/api/v1/solicitudes', una)).json()) as Radicada;
    const desdeDos = await post(
      '/api/v1/solicitudes/seguimiento',
      { radicado: r.numero, secreto: una.seguimiento },
      DOS,
    );
    expect(desdeDos.status).toBe(404);
  });
});
