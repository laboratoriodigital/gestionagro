/**
 * HU-C5.6: la celda al día con los planes, con un CORE falso en lugar del service binding y el D1
 * local del shard. Lo que esta prueba no ve: el RPC de verdad entre dos Workers (P17); eso lo dice
 * la primera vuelta en staging, en el log de la celda («planes: …»).
 */
import { uuidv7 } from '@ed1/agro-schema';
import type { BaseD1 } from '@ed1/d1';
import { baseLocal, vaciar } from '@ed1/d1/local';
import { firmanteDesde, firmarAcceso, generarClavePrivada } from '@ed1/tokens';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CLAVE_AVISO_PLANES,
  type ContextoDePlanes,
  type PlanDeOrganizacion,
  type ServicioDelCore,
  sincronizarPlanes,
  VENTANA_DE_CAMBIOS_MS,
} from './planes.ts';
import type { KvDeFlags } from './vigia.ts';
import { crearApp, type Env, TABLAS_DEL_SHARD, vueltaDePlanes } from './worker.ts';

const SHARD = 'agro_c0_s1';
/** 15:00 UTC: una vuelta de cada hora. */
const HORA = Date.UTC(2026, 11, 1, 15);
/** 06:00 UTC: la vuelta completa. */
const MADRUGADA = Date.UTC(2026, 11, 1, 6);
const ORG_A = uuidv7(() => HORA - 2);
const ORG_B = uuidv7(() => HORA - 1);

let db: BaseD1;
let cerrar: () => Promise<void>;
beforeAll(async () => {
  ({ db, cerrar } = await baseLocal({
    configuracion: 'apps/api-celda/wrangler.c0.jsonc',
    binding: SHARD,
    base: 'celda',
  }));
}, 60_000);
afterAll(async () => cerrar?.());
beforeEach(async () => vaciar(db, [...TABLAS_DEL_SHARD]));

/** Un CORE falso: responde lo que se le diga, o falla; anota cada pedido. */
function coreFalso(respuesta: PlanDeOrganizacion[] | Error) {
  const pedidos: { celda: string; desde: string | null }[] = [];
  const core: ServicioDelCore = {
    planes: async (celda, desde) => {
      pedidos.push({ celda, desde });
      if (respuesta instanceof Error) throw respuesta;
      return respuesta;
    },
  };
  return { core, pedidos };
}

function kvFalso(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial));
  const kv: KvDeFlags = {
    get: async (k) => datos.get(k) ?? null,
    put: async (k, v) => {
      datos.set(k, v);
    },
  };
  return { kv, datos };
}

function telegramFalso() {
  const mensajes: string[] = [];
  const fn = (async (_url: string, init?: RequestInit) => {
    mensajes.push((JSON.parse(String(init?.body)) as { text: string }).text);
    return new Response('{}', { status: 200 });
  }) as typeof fetch;
  return { fn, mensajes };
}

const contexto = (extra: Partial<ContextoDePlanes>): ContextoDePlanes => ({
  celda: 'c0',
  destino: 'produccion',
  core: undefined,
  shards: new Map([[SHARD, db]]),
  flags: undefined,
  telegram: { token: 'bot', chat: 'chat' },
  ...extra,
});

const copia = async () =>
  (
    await db
      .prepare('SELECT org_id, plan, plan_vence FROM plan_de_org ORDER BY org_id')
      .all<{ org_id: string; plan: string; plan_vence: string | null }>()
  ).results;

const FINCA_A: PlanDeOrganizacion = {
  org_id: ORG_A,
  shard: SHARD,
  plan: 'finca',
  plan_vence: '2027-06-01T05:00:00.000Z',
};
const GRATIS_B: PlanDeOrganizacion = {
  org_id: ORG_B,
  shard: SHARD,
  plan: 'gratuito',
  plan_vence: null,
};

describe('HU-C5.6 · la celda al día con los planes', () => {
  it('cada hora pide los cambios de las últimas 3 horas y los copia en su shard', async () => {
    const { core, pedidos } = coreFalso([FINCA_A]);
    const v = await sincronizarPlanes(contexto({ core }), HORA);
    expect(pedidos).toEqual([
      { celda: 'c0', desde: new Date(HORA - VENTANA_DE_CAMBIOS_MS).toISOString() },
    ]);
    expect(v).toMatchObject({ completa: false, recibidos: 1, escritos: 1, fallas: [] });
    expect(await copia()).toEqual([
      { org_id: ORG_A, plan: 'finca', plan_vence: '2027-06-01T05:00:00.000Z' },
    ]);
  });

  it('a las 06:00 UTC pide todas, y baja al gratuito la que el CORE dio por vencida', async () => {
    await sincronizarPlanes(contexto({ core: coreFalso([FINCA_A, GRATIS_B]).core }), HORA);
    const { core, pedidos } = coreFalso([{ ...FINCA_A, plan: 'gratuito', plan_vence: null }]);
    const v = await sincronizarPlanes(contexto({ core }), MADRUGADA);
    expect(pedidos).toEqual([{ celda: 'c0', desde: null }]);
    expect(v).toMatchObject({ completa: true, escritos: 1 });
    expect(await copia()).toEqual([
      { org_id: ORG_A, plan: 'gratuito', plan_vence: null },
      { org_id: ORG_B, plan: 'gratuito', plan_vence: null },
    ]);
  });

  it('lo que no cambió no se vuelve a escribir: cada fila cuenta en la cuota de D1', async () => {
    const { core } = coreFalso([FINCA_A, GRATIS_B]);
    expect((await sincronizarPlanes(contexto({ core }), HORA)).escritos).toBe(2);
    const marca = await db
      .prepare('SELECT actualizado FROM plan_de_org WHERE org_id = ?')
      .bind(ORG_A)
      .first();
    const otra = await sincronizarPlanes(contexto({ core }), HORA + 3_600_000);
    expect(otra).toMatchObject({ recibidos: 2, escritos: 0 });
    expect(
      await db.prepare('SELECT actualizado FROM plan_de_org WHERE org_id = ?').bind(ORG_A).first(),
    ).toEqual(marca);
  });

  it('CA3 ❌ · sin CORE la copia queda como estaba y el dueño lo sabe una sola vez', async () => {
    await sincronizarPlanes(contexto({ core: coreFalso([FINCA_A]).core }), HORA);
    const { kv, datos } = kvFalso();
    const telegram = telegramFalso();
    const caido = coreFalso(new Error('connection refused')).core;

    const v = await sincronizarPlanes(contexto({ core: caido, flags: kv }), MADRUGADA, telegram.fn);
    expect(v.fallas).toEqual(['el CORE no respondió (connection refused)']);
    expect(v.aviso).toBe('enviado');
    // El plan nunca baja «por si acaso».
    expect(await copia()).toEqual([
      { org_id: ORG_A, plan: 'finca', plan_vence: '2027-06-01T05:00:00.000Z' },
    ]);
    expect(telegram.mensajes).toHaveLength(1);
    expect(telegram.mensajes[0]).toContain('Cada organización sigue con el plan que tenía');

    // La hora siguiente, con la misma falla, no se repite.
    const otra = await sincronizarPlanes(contexto({ core: caido, flags: kv }), HORA, telegram.fn);
    expect(otra.aviso).toBe('sin-aviso');
    expect(telegram.mensajes).toHaveLength(1);

    // Cuando el CORE vuelve, se dice una vez y se borra la firma.
    const vuelta = await sincronizarPlanes(
      contexto({ core: coreFalso([FINCA_A]).core, flags: kv }),
      HORA + 3_600_000,
      telegram.fn,
    );
    expect(vuelta.aviso).toBe('recuperado');
    expect(telegram.mensajes[1]).toContain('volvieron a ponerse al día');
    expect(datos.get(CLAVE_AVISO_PLANES)).toBe('');
  });

  it('CA3 ❌ · una celda sin el binding, o un shard que no tiene, se nombran', async () => {
    const sinCore = await sincronizarPlanes(contexto({}), HORA);
    expect(sinCore.fallas).toEqual(['la celda no tiene el service binding CORE']);
    const ajeno = await sincronizarPlanes(
      contexto({ core: coreFalso([{ ...FINCA_A, shard: 'agro_c0_s9' }, GRATIS_B]).core }),
      HORA,
    );
    expect(ajeno.fallas).toEqual([
      '1 organizaciones del shard agro_c0_s9, que esta celda no tiene',
    ]);
    // Lo del shard que sí tiene se copia igual.
    expect((await copia()).map((f) => f.org_id)).toEqual([ORG_B]);
  });

  it('en bloqueo la vuelta no escribe ni llama al CORE', async () => {
    const { core, pedidos } = coreFalso([FINCA_A]);
    const { kv } = kvFalso({ nivel: 'bloqueo' });
    const env: Env = { CELDA: 'c0', CORE: core, FLAGS: kv, [SHARD]: db };
    expect(await vueltaDePlanes(env, HORA)).toBeNull();
    expect(pedidos).toEqual([]);
    expect(await copia()).toEqual([]);
  });

  it('CA4 · ninguna solicitud de un usuario hace que la celda llame al CORE', async () => {
    const { core, pedidos } = coreFalso(new Error('no debía llamarse'));
    const firmante = await firmanteDesde(await generarClavePrivada());
    const env: Env = {
      CELDA: 'c0',
      PRODUCTO: 'agro',
      CORE_CLAVES: JSON.stringify([firmante.publica]),
      ORIGENES_APP: 'https://agro.ejemplo.test',
      CORE: core,
      [SHARD]: db,
    };
    const { token } = await firmarAcceso(
      firmante,
      { sub: 'u1', org: ORG_A, rol: 'propietario', celda: 'c0', shard: SHARD, anillo: 1 },
      HORA,
    );
    const app = crearApp({ ahora: () => HORA });
    const autorizado = { authorization: `Bearer ${token}` };
    const respuestas = [
      await app.fetch(new Request('https://api.ejemplo.test/api/salud'), env),
      await app.fetch(
        new Request('https://api.ejemplo.test/api/v1/yo', { headers: autorizado }),
        env,
      ),
      await app.fetch(
        new Request('https://api.ejemplo.test/api/v1/sync/pull?registro=-1&catalogo=0', {
          headers: autorizado,
        }),
        env,
      ),
      await app.fetch(
        new Request('https://api.ejemplo.test/api/v1/sync/push', {
          method: 'POST',
          headers: { ...autorizado, 'content-type': 'application/json' },
          body: JSON.stringify({ protocolo: 1, dispositivo: 'telefono-a', app: '0.1.0', ops: [] }),
        }),
        env,
      ),
    ];
    // La salud y la sesión responden; el pull y el push pueden rechazar el pedido vacío: lo que
    // importa es que ninguno pasó por el CORE.
    expect(respuestas.map((r) => r.status).slice(0, 2)).toEqual([200, 200]);
    expect(pedidos).toEqual([]);
  });
});
