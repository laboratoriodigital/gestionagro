/**
 * HU-T13.6: suspender con un clic y los hostnames colgantes, sobre la base local con los dos
 * comercios de prueba. Suspender a uno no toca al otro (CA3). Ningún dominio es real.
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import {
  ENSAYO_DOS,
  ENSAYO_UNO,
  hostDeStaging,
  siembraDelControl,
  siembraDelShard,
} from '@ed1/tienda-schema/ensayos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cambiarSuspension, hostnamesColgantes } from './suspension.ts';
import { crearApp, type Env } from './worker.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const AHORA = '2026-10-20T15:00:00.000Z';
const SECRETO = 'secreto-de-prueba-de-la-suspension';

let shard: BaseD1;
let control: BaseD1;
const cerrar: (() => Promise<void>)[] = [];
const hosts = new Map<string, string>();
const kv = { put: async (k: string, v: string) => void hosts.set(k, v) };

const puntero = (slug: string) => JSON.parse(hosts.get(`h:${hostDeStaging(slug)}`) ?? '{}');
const estadoDe = async (org: string) =>
  (
    await shard
      .prepare('SELECT estado FROM tienda WHERE org_id = ?')
      .bind(org)
      .first<{ estado: string }>()
  )?.estado;

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

const pedir = (cuerpo: unknown, secreto = SECRETO) =>
  crearApp({ ahora: () => Date.parse(AHORA) }).request(
    '/api/despliegue/tienda-estado',
    {
      method: 'POST',
      headers: {
        'x-despacho': SECRETO,
        'x-despliegue': secreto,
        'content-type': 'application/json',
      },
      body: JSON.stringify(cuerpo),
    },
    {
      SECRETO_DESPACHO: SECRETO,
      CELDA: 'c1',
      tienda_c1_s1: shard,
      tienda_control: control,
      TIENDA_HOSTS: kv,
    } as unknown as Env,
  );

describe('suspender con un clic (HU-T13.6)', () => {
  it('CA1 y CA3: Ensayo Uno queda suspendida en todas sus direcciones; Ensayo Dos, igual que antes', async () => {
    const antesDos = await estadoDe(ENSAYO_DOS.org);
    const r = await pedir({
      org: ENSAYO_UNO.org,
      accion: 'suspender',
      motivo: 'reporte de suplantación',
    });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ estado: 'ok', ahora: 'suspendida' });
    expect(await estadoDe(ENSAYO_UNO.org)).toBe('suspendida');
    expect(puntero(ENSAYO_UNO.slug)).toMatchObject({ org: ENSAYO_UNO.org, estado: 'suspendida' });
    expect(await estadoDe(ENSAYO_DOS.org)).toBe(antesDos);
    expect(hosts.has(`h:${hostDeStaging(ENSAYO_DOS.slug)}`)).toBe(false);
    const registro = await shard
      .prepare(
        "SELECT accion, actor, despues FROM registro WHERE org_id = ? AND accion LIKE 'tienda.%'",
      )
      .bind(ENSAYO_UNO.org)
      .all<{ accion: string; actor: string; despues: string }>();
    expect(registro.results).toEqual([
      expect.objectContaining({ accion: 'tienda.suspender', actor: 'sistema:operador' }),
    ]);
    expect(JSON.parse(registro.results[0]?.despues ?? '{}').motivo).toBe('reporte de suplantación');
  });

  it('levantarla la deja como estaba, y repetir no cambia nada', async () => {
    expect(
      await (
        await pedir({ org: ENSAYO_UNO.org, accion: 'levantar', motivo: 'revisada, sin falla' })
      ).json(),
    ).toMatchObject({ estado: 'ok', ahora: 'borrador' });
    expect(puntero(ENSAYO_UNO.slug).estado).toBe('borrador');
    expect(
      await (
        await pedir({ org: ENSAYO_UNO.org, accion: 'levantar', motivo: 'otra vez igual' })
      ).json(),
    ).toMatchObject({ estado: 'sin-cambio' });
  });

  it('❌ sin el secreto, sin motivo o con una tienda que no existe: nada cambia', async () => {
    expect(
      (await pedir({ org: ENSAYO_UNO.org, accion: 'suspender', motivo: 'x'.repeat(10) }, 'otro'))
        .status,
    ).toBe(404);
    expect((await pedir({ org: ENSAYO_UNO.org, accion: 'suspender', motivo: '' })).status).toBe(
      422,
    );
    expect(
      (await pedir({ org: 'no-existe', accion: 'suspender', motivo: 'motivo de prueba' })).status,
    ).toBe(404);
    expect(await estadoDe(ENSAYO_UNO.org)).toBe('borrador');
  });

  it('❌ una tienda dada de baja no se suspende ni se levanta', async () => {
    await shard
      .prepare("UPDATE tienda SET estado = 'baja' WHERE org_id = ?")
      .bind(ENSAYO_DOS.org)
      .run();
    try {
      const r = await cambiarSuspension({
        shards: [['tienda_c1_s1', shard]],
        control,
        celda: 'c1',
        hosts: kv,
        org: ENSAYO_DOS.org,
        accion: 'suspender',
        motivo: 'motivo de prueba',
        instante: AHORA,
      });
      expect(r).toMatchObject({ estado: 'sin-cambio', ahora: 'baja' });
    } finally {
      await shard
        .prepare("UPDATE tienda SET estado = 'borrador' WHERE org_id = ?")
        .bind(ENSAYO_DOS.org)
        .run();
    }
  });
});

describe('los hostnames colgantes (HU-T13.6 CA2)', () => {
  it('avisa de los retirados que todavía apuntan aquí; uno que no responde no cuenta', async () => {
    for (const [h, estado] of [
      ['www.colgante.example', 'retirado'],
      ['www.limpio.example', 'retirado'],
      ['www.mudo.example', 'retirado'],
      ['www.activo.example', 'activo'],
    ] as const) {
      await control
        .prepare(
          `INSERT INTO dominio (hostname, org_id, celda_id, tipo, rol, estado, creado, retirado)
           VALUES (?, ?, 'c1', 'propio', 'alias', ?, ?, ?)`,
        )
        .bind(h, ENSAYO_UNO.org, estado, AHORA, estado === 'retirado' ? AHORA : null)
        .run();
    }
    const preguntados: string[] = [];
    const r = await hostnamesColgantes(control, async (url) => {
      const nombre = new URL(url).searchParams.get('name') ?? '';
      preguntados.push(nombre);
      if (nombre === 'www.mudo.example') throw new Error('sin red');
      const data =
        nombre === 'www.colgante.example' ? 'origen.laboratorio-digital.app.' : 'otro.example.';
      return Response.json({ Answer: [{ data }] });
    });
    expect(r).toEqual({ revisados: 3, colgantes: ['www.colgante.example'] });
    // ❌ Un dominio activo no se pregunta: es de una tienda que lo usa.
    expect(preguntados).not.toContain('www.activo.example');
  });
});
