/**
 * La consola del dueño v0 (EC13) contra un D1 local: quién la ve (D-C8), que cada vista quede en la
 * auditoría y lo que dice cada bloque, con el reloj movido en los bordes del día de Bogotá (P8).
 */
import type { BaseD1 } from '@ed1/d1';
import { firmanteDesde, firmarAcceso, generarClavePrivada } from '@ed1/tokens';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cargarCeldas } from '../../../scripts/lib/celdas.ts';
import {
  cargarProductos as cargarRegistro,
  catalogoDelRepositorio,
} from '../../../scripts/lib/registro-productos.ts';
import { baseDelCore, vaciarCore } from './base-de-prueba.ts';
import { sentenciasDelCatalogo } from './catalogo.ts';
import { sentenciasDeCeldas } from './celdas.ts';
import { ventanas } from './consola.ts';
import { crearOrganizacion, usuarioDeIdentidad } from './repositorio.ts';
import { crearApp, type Env } from './worker.ts';

const CUENTA = 'https://cuenta.laboratorio-digital.com';
const DUENO = 'dueno@ensayo.example';
const OTRA = 'cliente@ensayo.example';
const H = 60 * 60 * 1000;
const DIA = 24 * H;
/** Viernes 23 oct 2026, 10:00 a. m. de Bogotá. */
const T0 = Date.UTC(2026, 9, 23, 15);

let db: BaseD1;
let cerrar: () => Promise<void>;
let clave: string;
beforeAll(async () => {
  ({ db, cerrar } = await baseDelCore());
  clave = await generarClavePrivada();
}, 60_000);
afterAll(async () => cerrar?.());

let reloj = T0;
let env: Env;
let dueno = '';
let cliente = '';
let tienda = '';
const app = crearApp({ ahora: () => reloj });

/** Un token como el que da el CORE al entrar a la consola: `aud`, y cuándo entró. */
const token = async (sub: string, o: { aud?: string; entro?: number } = {}) =>
  (
    await firmarAcceso(
      await firmanteDesde(clave),
      {
        sub,
        org: null,
        rol: null,
        celda: null,
        shard: null,
        anillo: null,
        aud: o.aud ?? 'consola',
        auth_time: Math.floor((o.entro ?? reloj) / 1000),
      },
      reloj,
    )
  ).token;
const pedir = (bloque: string, t?: string) =>
  app.fetch(
    new Request(`${CUENTA}/api/core/consola/${bloque}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: CUENTA,
        ...(t ? { authorization: `Bearer ${t}` } : {}),
      },
      body: '{}',
    }),
    env,
  );
const iso = (ms: number) => new Date(ms).toISOString();
const vistas = async () =>
  (
    await db
      .prepare("SELECT count(*) AS n FROM auditoria WHERE accion = 'consola_vista'")
      .first<{ n: number }>()
  )?.n ?? 0;

let pagos = 0;
async function pago(
  estado: string,
  actualizado: number,
  o: { cop?: number; proveedor?: string; org?: string; creado?: number } = {},
) {
  pagos++;
  await db
    .prepare(
      `INSERT INTO pago (id, producto, proveedor, org_id, usuario_id, plan, meses, monto_cop, ambiente, estado, creado, actualizado)
       VALUES (?, 'tienda', ?, ?, ?, 'pro', 1, ?, 'produccion', ?, ?, ?)`,
    )
    .bind(
      `pago-${pagos}`,
      o.proveedor ?? 'bold',
      o.org ?? tienda,
      cliente,
      o.cop ?? 24_900,
      estado,
      iso(o.creado ?? actualizado),
      iso(actualizado),
    )
    .run();
}

beforeEach(async () => {
  await vaciarCore(db);
  await db.prepare('DELETE FROM copia_base').run();
  for (const s of [
    ...sentenciasDelCatalogo(catalogoDelRepositorio(cargarRegistro()), '2026-10-06T00:00:00.000Z'),
    ...sentenciasDeCeldas(cargarCeldas().celdas, 'staging'),
  ])
    await db.prepare(s).run();
  reloj = T0;
  pagos = 0;
  dueno = (
    await usuarioDeIdentidad(
      db,
      { sub: 'g-dueno', nombre: 'Dueña', email: 'Dueno@Ensayo.example' },
      () => T0,
    )
  ).id;
  cliente = (
    await usuarioDeIdentidad(
      db,
      { sub: 'g-cliente', nombre: 'Rosa Cliente', email: OTRA },
      () => T0,
    )
  ).id;
  tienda = (
    await crearOrganizacion(
      db,
      {
        propietarioId: cliente,
        nombre: 'Panadería Ensayo',
        tipo: 'tienda',
        producto: 'tienda',
        rolQueAdministra: 'propietario',
      },
      () => T0 - 3 * DIA,
    )
  ).id;
  env = {
    DB: db,
    CORE_JWT_PRIVATE_KEY: clave,
    GOOGLE_CLIENT_ID: 'cliente',
    GOOGLE_CLIENT_SECRET: 'secreto',
    ORIGENES_APP: 'https://agro.ejemplo.test',
    CONSOLA_CORREOS: ` ${DUENO.toUpperCase()} , otra-persona@ensayo.example`,
  };
});

describe('HU-C13.1 · quién ve la consola (D-C8)', () => {
  it('CA1 y CA2: el dueño, con el token de la consola y su correo en la lista, sin importar mayúsculas', async () => {
    const r = await pedir('hoy', await token(dueno));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ estado: 'ok' });
  });

  it('CA2 y CA3 ❌: a quien no está en la lista, o trae el token de otra app, se le dice lo mismo y sin un dato', async () => {
    const respuestas = [
      await pedir('hoy', await token(cliente)),
      await pedir('hoy', await token(dueno, { aud: 'cuenta' })),
    ];
    const cuerpos = await Promise.all(respuestas.map((r) => r.text()));
    expect(respuestas.map((r) => r.status)).toEqual([403, 403]);
    expect(cuerpos[0]).toBe(cuerpos[1]);
    expect(JSON.parse(cuerpos[0] ?? '{}')).toEqual({
      estado: 'prohibido',
      motivo: 'Esta página no es para tu cuenta.',
    });
    expect((await pedir('hoy')).status).toBe(401);
  });

  it('CA3 ❌: sin CONSOLA_CORREOS nadie la ve (P1)', async () => {
    const { CONSOLA_CORREOS: _, ...sinLista } = env;
    env = sinLista;
    expect((await pedir('hoy', await token(dueno))).status).toBe(403);
  });

  it('CA3 ❌: con una entrada de hace más de 12 h, el dueño vuelve a entrar', async () => {
    const r = await pedir('hoy', await token(dueno, { entro: T0 - 12 * H - 1000 }));
    expect(r.status).toBe(403);
    expect(await r.json()).toMatchObject({ estado: 'entrar-de-nuevo' });
    expect((await pedir('hoy', await token(dueno, { entro: T0 - 12 * H + 60_000 }))).status).toBe(
      200,
    );
  });

  it('CA4: cada bloque entregado queda en la auditoría con quién y qué; lo rechazado, no', async () => {
    for (const b of ['hoy', 'crecio', 'revisar', 'roto']) {
      expect((await pedir(b, await token(dueno))).status).toBe(200);
    }
    await pedir('hoy', await token(cliente));
    const filas = await db
      .prepare(
        "SELECT usuario_id, producto, org_id, detalle FROM auditoria WHERE accion = 'consola_vista' ORDER BY id",
      )
      .all<{ usuario_id: string; producto: string; org_id: string | null; detalle: string }>();
    expect(filas.results.map((f) => JSON.parse(f.detalle).bloque)).toEqual([
      'hoy',
      'crecio',
      'revisar',
      'roto',
    ]);
    expect(new Set(filas.results.map((f) => `${f.usuario_id}|${f.producto}|${f.org_id}`))).toEqual(
      new Set([`${dueno}|consola|null`]),
    );
  });
});

describe('HU-C13.2 · hoy: lo que entró y lo que vence', () => {
  it('CA1: suma lo aprobado de hoy, de los 7 días y del mes, por producto y medio, en días de Bogotá', async () => {
    const { hoy: inicioDeHoy } = ventanas(T0);
    await pago('aprobado', inicioDeHoy + 60_000); // hoy, 0:01 a. m. de Bogotá
    await pago('aprobado', inicioDeHoy - 60_000, { cop: 142_000 }); // ayer, 11:59 p. m.
    await pago('aprobado', T0 - 10 * DIA, { proveedor: 'efectivo', cop: 50_000 }); // 13 oct
    await pago('aprobado', Date.UTC(2026, 8, 30, 12)); // septiembre: fuera
    const r = (await (await pedir('hoy', await token(dueno))).json()) as {
      entro: Record<
        string,
        {
          total_cop: number;
          detalle: { producto: string; medio: string; pagos: number; cop: number }[];
        }
      >;
    };
    expect(r.entro['hoy']?.total_cop).toBe(24_900);
    expect(r.entro['semana']?.total_cop).toBe(24_900 + 142_000);
    expect(r.entro['mes']?.total_cop).toBe(24_900 + 142_000 + 50_000);
    expect(r.entro['mes']?.detalle).toEqual([
      { producto: 'TiendaPro', medio: 'Bold', pagos: 2, cop: 166_900 },
      { producto: 'TiendaPro', medio: 'Efectivo', pagos: 1, cop: 50_000 },
    ]);
  });

  it('CA3 ❌: lo que está en revisión, o esperando hace más de 1 h, sale aparte y no se suma', async () => {
    await pago('revisar', T0 - 2 * H);
    await pago('esperando', T0 - 2 * H);
    await pago('esperando', T0 - 10 * 60_000); // alguien pagando ahora: ni se suma ni se revisa
    const r = (await (await pedir('hoy', await token(dueno))).json()) as {
      entro: { mes: { total_cop: number } };
      para_revisar: { estado: string }[];
    };
    expect(r.entro.mes.total_cop).toBe(0);
    expect(r.para_revisar.map((p) => p.estado)).toEqual(['revisar', 'esperando']);
  });

  it('CA2: lo que vence en 7 días y lo que está en gracia, con el espacio y sin personas', async () => {
    await db
      .prepare("UPDATE organizacion SET plan = 'pro', plan_vence = ? WHERE id = ?")
      .bind(iso(T0 + 3 * DIA), tienda)
      .run();
    const r = (await (await pedir('hoy', await token(dueno))).json()) as {
      vencen: { espacio: string; producto: string; plan: string; aviso: string }[];
    };
    expect(r.vencen).toEqual([
      expect.objectContaining({
        espacio: 'Panadería Ensayo',
        producto: 'TiendaPro',
        plan: 'Pro',
        aviso: 'vence-en-7-dias',
      }),
    ]);
    await db
      .prepare('UPDATE organizacion SET plan_vence = ? WHERE id = ?')
      .bind(iso(T0 - 2 * DIA), tienda)
      .run();
    const enGracia = (await (await pedir('hoy', await token(dueno))).json()) as {
      vencen: { aviso: string }[];
    };
    expect(enGracia.vencen.map((v) => v.aviso)).toEqual(['en-gracia']);
  });
});

describe('HU-C13.3 · lo que creció y lo que convierte', () => {
  it('CA1 y CA2: cuentas y espacios por semana, espacios por plan y quién pagó por primera vez', async () => {
    await pago('aprobado', T0 - DIA);
    const r = (await (await pedir('crecio', await token(dueno))).json()) as {
      cuentas_nuevas: { semana: string; n: number }[];
      espacios_nuevos: { producto: string; semanas: { n: number }[] }[];
      por_plan: { producto: string; plan: string; espacios: number }[];
      pagaron_por_primera_vez: { producto: string; espacios: number }[];
    };
    expect(r.cuentas_nuevas).toHaveLength(8);
    expect(r.cuentas_nuevas.at(-1)).toEqual({ semana: '2026-10-19', n: 2 });
    expect(r.espacios_nuevos).toEqual([expect.objectContaining({ producto: 'TiendaPro' })]);
    expect(r.espacios_nuevos[0]?.semanas.at(-1)?.n).toBe(1);
    expect(r.por_plan).toEqual([expect.objectContaining({ producto: 'TiendaPro', espacios: 1 })]);
    expect(r.pagaron_por_primera_vez).toEqual([{ producto: 'TiendaPro', espacios: 1 }]);
  });

  it('CA3 ❌: en toda la respuesta no hay un correo ni el nombre de una persona', async () => {
    const texto = await (await pedir('crecio', await token(dueno))).text();
    for (const dato of [DUENO, OTRA, 'Dueña', 'Rosa Cliente', '@']) {
      expect(texto).not.toContain(dato);
    }
  });
});

describe('HU-C13.4 · lo que hay que revisar y lo que se rompió', () => {
  it('CA3: los radicados abiertos con su plazo, en rojo los de 3 días hábiles o menos', async () => {
    for (const [numero, vence] of [
      ['LD-1', '2026-10-27'],
      ['LD-2', '2026-11-20'],
    ] as const) {
      await db
        .prepare(
          `INSERT INTO radicado_datos (id, numero, usuario_id, tipo, texto, creado, vence) VALUES (?, ?, ?, 'consulta', 'Quiero saber qué datos tienen', ?, ?)`,
        )
        .bind(numero, numero, cliente, iso(T0), vence)
        .run();
    }
    const r = (await (await pedir('revisar', await token(dueno))).json()) as {
      radicados: { numero: string; dias_habiles: number; urgente: boolean }[];
    };
    // Del viernes 23 al martes 27 hay 2 días hábiles (lunes y martes).
    expect(r.radicados).toEqual([
      expect.objectContaining({ numero: 'LD-1', dias_habiles: 2, urgente: true }),
      expect.objectContaining({ numero: 'LD-2', urgente: false }),
    ]);
    expect(JSON.stringify(r)).not.toContain('Quiero saber');
  });

  it('CA1 y CA2: la copia de la semana base por base, y los correos del día con el cupo', async () => {
    await db
      .prepare(
        `INSERT INTO copia_base (semana, base, estado, intentos, motivo, actualizado) VALUES
         ('2026-10-19', 'agro_core', 'hecha', 1, NULL, ?), ('2026-10-19', 'tienda_c1_s1', 'fallida', 3, 'Drive respondió 403', ?)`,
      )
      .bind(iso(T0), iso(T0))
      .run();
    await db
      .prepare(
        `INSERT INTO correo_del_core (clave, tipo, dia, estado, motivo, creado, actualizado) VALUES
         ('a', 'enlace', '2026-10-23', 'enviado', NULL, ?, ?), ('b', 'aviso', '2026-10-23', 'fallido', 'tope', ?, ?)`,
      )
      .bind(iso(T0), iso(T0), iso(T0), iso(T0))
      .run();
    const r = (await (await pedir('roto', await token(dueno))).json()) as {
      copia: { semana: string; bases: { base: string; estado: string; motivo: string | null }[] };
      correos: {
        usados: number;
        cupo: number;
        por_estado: { estado: string; motivo: string | null }[];
      };
    };
    expect(r.copia.semana).toBe('2026-10-19');
    expect(r.copia.bases.map((b) => `${b.base} ${b.estado}`)).toEqual([
      'agro_core hecha',
      'tienda_c1_s1 fallida',
    ]);
    expect(r.copia.bases[1]?.motivo).toBe('Drive respondió 403');
    expect(r.correos).toMatchObject({ usados: 1, cupo: 100 });
  });

  it('CA4 ❌: un bloque que no se pudo leer dice la causa, nunca ceros, y no queda como visto', async () => {
    const real = env.DB;
    env = {
      ...env,
      DB: {
        prepare: (sql: string) => {
          if (sql.includes('copia_base')) throw new Error('D1_ERROR: no such table');
          return real.prepare(sql);
        },
        batch: (s) => real.batch(s),
      },
    };
    const r = await pedir('roto', await token(dueno));
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({ estado: 'no-se-pudo' });
    expect(await vistas()).toBe(0);
  });
});
