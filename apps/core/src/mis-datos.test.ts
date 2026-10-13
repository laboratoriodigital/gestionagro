/**
 * HU-C7.7: tus datos (Ley 1581). Descargarlos, radicar con número y fecha límite en días hábiles
 * con festivos, y el aviso al dueño por Telegram, con un `fetch` falso.
 */
import type { BaseD1 } from '@ed1/d1';
import { firmanteDesde, firmarAcceso, generarClavePrivada } from '@ed1/tokens';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { catalogoDelRepositorio } from '../../../scripts/lib/registro-productos.ts';
import { baseDelCore, vaciarCore } from './base-de-prueba.ts';
import { sentenciasDelCatalogo } from './catalogo.ts';
import { reintentarAvisos } from './mis-datos.ts';
import { crearApp, type Env } from './worker.ts';

let db: BaseD1;
let cerrar: () => Promise<void>;
let clave: string;
/** Lunes 2 nov 2026, 10:00 de Bogotá: festivo (Todos los Santos, corrido al lunes). */
const AHORA = Date.UTC(2026, 10, 2, 15);
const CORE = 'https://agro-core-staging.example';
const CUENTA = 'https://cuenta.laboratorio-digital.com';
const FINCA = '0199a1b2-0000-7000-8000-00000000c771';
const AJENA = '0199a1b2-0000-7000-8000-00000000c772';

beforeAll(async () => {
  ({ db, cerrar } = await baseDelCore());
  clave = await generarClavePrivada();
}, 60_000);
afterAll(async () => cerrar?.());
beforeEach(async () => {
  await vaciarCore(db);
  for (const s of sentenciasDelCatalogo(catalogoDelRepositorio(), '2026-10-12T00:00:00.000Z'))
    await db.prepare(s).run();
  for (const s of [
    "INSERT INTO celda (id, url_api, estado, anillo_despliegue, shards) VALUES ('c0', 'https://api-c0', 'activa', 0, '[\"agro_c0_s1\"]')",
    "INSERT INTO usuario (id, nombre, email, creado) VALUES ('u-ana', 'Ana', 'ana@example.com', '2026-10-01'), ('u-otro', 'Otro', 'otro@example.com', '2026-10-01')",
    "INSERT INTO identidad (proveedor, sub, usuario_id) VALUES ('google', 'g-ana', 'u-ana'), ('google', 'g-otro', 'u-otro')",
    `INSERT INTO organizacion (id, nombre, tipo, plan, celda_id, shard, anillo, creado) VALUES ('${FINCA}', 'Finca La Esperanza', 'finca', 'gratuito', 'c0', 'agro_c0_s1', 1, '2026-10-01'), ('${AJENA}', 'Finca Ajena', 'finca', 'gratuito', 'c0', 'agro_c0_s1', 1, '2026-10-01')`,
    `INSERT INTO membresia (usuario_id, org_id, rol, creado) VALUES ('u-ana', '${FINCA}', 'propietario', '2026-10-01'), ('u-otro', '${AJENA}', 'propietario', '2026-10-01')`,
    `INSERT INTO pago (id, producto, proveedor, org_id, usuario_id, plan, meses, monto_cop, ambiente, estado, creado, actualizado) VALUES ('p-ana', 'agro', 'bold', '${FINCA}', 'u-ana', 'finca', 1, 39000, 'pruebas', 'aprobado', '2026-10-05', '2026-10-05'), ('p-otro', 'agro', 'bold', '${AJENA}', 'u-otro', 'finca', 1, 39000, 'pruebas', 'aprobado', '2026-10-05', '2026-10-05')`,
  ])
    await db.prepare(s).run();
});

const env = (telegram = true): Env => ({
  DB: db,
  CORE_JWT_PRIVATE_KEY: clave,
  GOOGLE_CLIENT_ID: 'cliente',
  GOOGLE_CLIENT_SECRET: 'secreto',
  ORIGENES_APP: 'https://agro.example',
  DESTINO: 'staging',
  ...(telegram ? { TELEGRAM_BOT_TOKEN: 'bot', TELEGRAM_CHAT_ID: 'chat' } : {}),
});

function telegramFalso(responde = 200) {
  const mensajes: string[] = [];
  const fn = (async (_url: string, init?: RequestInit) => {
    mensajes.push((JSON.parse(String(init?.body)) as { text: string }).text);
    return new Response('{}', { status: responde });
  }) as unknown as typeof fetch;
  return { fn, mensajes };
}

const deLaCuenta = async (usuario = 'u-ana') =>
  (
    await firmarAcceso(
      await firmanteDesde(clave),
      {
        sub: usuario,
        org: null,
        rol: null,
        celda: null,
        shard: null,
        anillo: null,
        aud: 'cuenta',
        plan: 'gratuito',
      },
      AHORA,
      2,
    )
  ).token;
async function pedir(
  ruta: string,
  cuerpo: unknown,
  fetchFn?: typeof fetch,
  e: Env = env(),
  usuario = 'u-ana',
) {
  const app = crearApp({ ahora: () => AHORA, ...(fetchFn ? { fetch: fetchFn } : {}) });
  return app.fetch(
    new Request(`${CORE}/api/core/cuenta/${ruta}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: CUENTA,
        authorization: `Bearer ${await deLaCuenta(usuario)}`,
      },
      body: JSON.stringify(cuerpo),
    }),
    e,
  );
}

describe('HU-C7.7 · tus datos', () => {
  it('CA1 · descargar mis datos: lo de la persona y los pagos de lo que administra', async () => {
    const r = await pedir('mis-datos', {});
    expect(r.headers.get('cache-control')).toBe('no-store');
    const d = (await r.json()) as Record<string, unknown>;
    expect(d['persona']).toMatchObject({ id: 'u-ana', email: 'ana@example.com' });
    expect(d['identidades']).toEqual([{ proveedor: 'google', sub: 'g-ana' }]);
    expect((d['espacios'] as { espacio: string }[]).map((e) => e.espacio)).toEqual([
      'Finca La Esperanza',
    ]);
    expect((d['pagos_de_lo_que_administras'] as { org_id: string }[]).map((p) => p.org_id)).toEqual(
      [FINCA],
    );
  });

  it('CA4 ❌ · nunca los de otra persona, ni con su id en el cuerpo', async () => {
    const r = await pedir('mis-datos', { usuario_id: 'u-otro', sub: 'u-otro' });
    const texto = await r.text();
    expect(texto).not.toContain('otro@example.com');
    expect(texto).not.toContain('p-otro');
    expect(texto).not.toContain(AJENA);
  });

  it('CA2 · una consulta tiene número y vence a los 10 días hábiles, saltando los festivos; le llega al dueño', async () => {
    const t = telegramFalso();
    const r = await pedir(
      'radicar',
      { tipo: 'consulta', texto: '¿Qué datos míos guardan y para qué?' },
      t.fn,
    );
    expect(r.status).toBe(201);
    const c = (await r.json()) as { numero: string; vence: string; mensaje: string };
    expect(c.numero).toMatch(/^LD-20261102-[0-9A-F]{6}$/);
    // Del 3 al 13 de noviembre son 9 hábiles; el 16 es festivo (Cartagena, corrido): vence el 17.
    expect(c.vence).toBe('2026-11-17');
    expect(c.mensaje).toContain('a más tardar el 17 nov 2026');
    expect(t.mensajes).toHaveLength(1);
    expect(t.mensajes[0]).toContain(c.numero);
    // El texto de la persona no viaja a Telegram.
    expect(t.mensajes[0]).not.toContain('Qué datos míos');
    expect(
      await db.prepare('SELECT avisado IS NOT NULL AS avisado FROM radicado_datos').first(),
    ).toEqual({ avisado: 1 });
  });

  it('CA3 · la supresión vence a los 15 hábiles y dice que los pagos se conservan', async () => {
    const r = await pedir(
      'radicar',
      { tipo: 'supresion', texto: 'Quiero que borren mis datos.' },
      telegramFalso().fn,
    );
    const c = (await r.json()) as { vence: string; mensaje: string };
    expect(c.vence).toBe('2026-11-24');
    expect(c.mensaje).toContain('como los pagos, se guarda el tiempo que exige');
  });

  it('si Telegram no responde, el radicado queda y el cron lo avisa después', async () => {
    const caido = telegramFalso(500);
    expect(
      (
        await pedir(
          'radicar',
          { tipo: 'reclamo', texto: 'Mis datos están mal escritos.' },
          caido.fn,
        )
      ).status,
    ).toBe(201);
    expect(await db.prepare('SELECT avisado FROM radicado_datos').first()).toEqual({
      avisado: null,
    });
    const bien = telegramFalso();
    expect(
      await reintentarAvisos(db, { token: 'bot', chat: 'chat' }, AHORA + 900_000, bien.fn),
    ).toBe(1);
    expect(
      await reintentarAvisos(db, { token: 'bot', chat: 'chat' }, AHORA + 1_800_000, bien.fn),
    ).toBe(0);
    expect(bien.mensajes).toHaveLength(1);
  });

  it('❌ · un tipo que no existe o un texto vacío no se radican; cada quien ve solo sus solicitudes', async () => {
    expect((await pedir('radicar', { tipo: 'queja', texto: 'Algo que decir aquí.' })).status).toBe(
      400,
    );
    expect((await pedir('radicar', { tipo: 'consulta', texto: 'corto' })).status).toBe(400);
    await pedir('radicar', { tipo: 'consulta', texto: 'Una consulta de Ana.' }, telegramFalso().fn);
    const mias = (await (await pedir('radicados', {})).json()) as { radicados: unknown[] };
    const delOtro = (await (await pedir('radicados', {}, undefined, env(), 'u-otro')).json()) as {
      radicados: unknown[];
    };
    expect(mias.radicados).toHaveLength(1);
    expect(delOtro.radicados).toHaveLength(0);
  });
});
