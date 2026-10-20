/**
 * HU-T14.6: los eventos que cuadran con los pedidos, sobre el shard local con los dos comercios de
 * prueba. La base dice sus pedidos de la vitrina y sus pagos de la semana; Analytics Engine es un
 * `fetch` de mentira. Aceptación de M5: la diferencia se ve con los comercios de prueba. Ningún dato
 * es de una persona.
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import { ENSAYO_DOS, ENSAYO_UNO, siembraDelShard } from '@ed1/tienda-schema/ensayos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eventosDeLaSemana, ultimoCuadre, ventanaDeLaSemana } from './cuadre.ts';
import { tablero } from './panel-tablero.ts';
import { CUADRE_DE_EVENTOS, type EntornoDeTareas, siguienteTurno } from './tareas.ts';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const DIA_MS = 24 * 3_600_000;
/** Martes 20 de octubre de 2026, mediodía en Colombia. */
const HOY = Date.parse('2026-10-20T12:00:00-05:00');
/** La hora en que le toca a Ensayo Uno, y su semana. */
const TURNO = siguienteTurno(ENSAYO_UNO.org, 'semana', HOY);
const SEMANA = ventanaDeLaSemana(TURNO);

let shard: BaseD1;
let cerrar: () => Promise<void>;
let numero = 5000;

async function pedido(org: string, creado: string, canal: string, estado = 'confirmado') {
  const n = ++numero;
  const id = `pe-cuadre-${n}`;
  await shard
    .prepare(
      `INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, forma_pago, subtotal_cop, total_cop,
         terminos_huella, aceptado, cambiado_por, creado, actualizado)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1000, 1000, ?, ?, 'sistema', ?, ?)`,
    )
    .bind(
      org,
      id,
      `C${[...String(n).padStart(5, '0')].map((d) => CROCKFORD[Number(d) + 10]).join('')}`,
      n,
      estado,
      canal,
      canal === 'en_linea' ? 'en_linea' : 'a_convenir',
      'a'.repeat(64),
      creado,
      creado,
      creado,
    )
    .run();
  return id;
}

async function pago(org: string, pedidoId: string, estado: string, cuando: string) {
  await shard
    .prepare(
      `INSERT INTO cobro (org_id, id, pedido_id, proveedor, ambiente, monto_cop, estado, token_huella, vence, creado, actualizado)
       VALUES (?, ?, ?, 'bold', 'pruebas', 1000, ?, ?, ?, ?, ?)`,
    )
    .bind(
      org,
      `CB-${pedidoId.replace(/\D/g, '')}`,
      pedidoId,
      estado,
      'c'.repeat(64),
      cuando,
      cuando,
      cuando,
    )
    .run();
}

beforeAll(async () => {
  const s = await baseLocal({
    configuracion: 'apps/tienda-api/wrangler.c1.jsonc',
    binding: 'tienda_c1_s1',
    base: 'tienda',
  });
  shard = s.db;
  cerrar = s.cerrar;
  for (const sql of siembraDelShard([ENSAYO_UNO, ENSAYO_DOS], '2026-10-01T05:00:00.000Z'))
    await shard.prepare(sql.replace(/;$/, '')).run();
  // Ensayo Uno, en la semana de su turno: 4 pedidos de la vitrina (uno en línea, pagado) y 1
  // anotado en el panel, que la medición no puede ver. Uno de antes y uno de después no cuentan.
  const desde = Date.parse(SEMANA.desde);
  const dia = (n: number, horas = 10) =>
    new Date(desde + n * DIA_MS + horas * 3_600_000).toISOString();
  for (const d of [0, 2, 6]) await pedido(ENSAYO_UNO.org, dia(d), 'whatsapp');
  const enLinea = await pedido(ENSAYO_UNO.org, dia(3), 'en_linea', 'pagado');
  await pago(ENSAYO_UNO.org, enLinea, 'aprobado', dia(3, 11));
  await pedido(ENSAYO_UNO.org, dia(4), 'panel');
  await pedido(ENSAYO_UNO.org, new Date(desde - 60_000).toISOString(), 'whatsapp');
  await pedido(
    ENSAYO_UNO.org,
    new Date(Date.parse(SEMANA.hasta) + 60_000).toISOString(),
    'whatsapp',
  );
}, 60_000);
afterAll(async () => cerrar());

/** Analytics Engine de mentira: guarda la consulta y responde lo que se le diga. */
function analytics(datos: Record<string, unknown>[], estado = 200) {
  const consultas: string[] = [];
  const fetchFn = (async (url: string, init?: RequestInit) => {
    expect(url).toBe(
      'https://api.cloudflare.com/client/v4/accounts/cuenta-e2e/analytics_engine/sql',
    );
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer token-de-metricas');
    consultas.push(String(init?.body));
    return new Response(JSON.stringify({ data: datos }), { status: estado });
  }) as unknown as typeof fetch;
  return { consultas, fetchFn };
}
const medicion = (fetchFn: typeof fetch, dataset = 'tienda_eventos_staging') => ({
  token: 'token-de-metricas',
  cuenta: 'cuenta-e2e',
  dataset,
  fetch: fetchFn,
});

describe('la semana del cuadre (HU-T14.6)', () => {
  it('son los 7 días de Colombia anteriores a hoy, a cualquier hora de hoy', () => {
    const esperado = {
      semana: '2026-10-13',
      desde: '2026-10-13T05:00:00.000Z',
      hasta: '2026-10-20T05:00:00.000Z',
    };
    expect(ventanaDeLaSemana(HOY)).toEqual(esperado);
    expect(ventanaDeLaSemana(Date.parse('2026-10-20T00:00:00-05:00'))).toEqual(esperado);
    expect(ventanaDeLaSemana(Date.parse('2026-10-20T23:59:00-05:00'))).toEqual(esperado);
  });

  it('pregunta a Analytics Engine solo por sus tiendas, con los eventos de pedir y de pagar', async () => {
    const a = analytics([{ org: ENSAYO_UNO.org, pedidos: 3.0, pagos: 2.0 }]);
    const r = await eventosDeLaSemana(
      medicion(a.fetchFn),
      [ENSAYO_UNO.org, "x'); DROP TABLE"],
      ventanaDeLaSemana(HOY),
    );
    expect(r.get(ENSAYO_UNO.org)).toEqual({ pedidos: 3, pagos: 2 });
    const [sql] = a.consultas;
    expect(sql).toContain('SUM(_sample_interval * double3) AS pedidos');
    expect(sql).toContain('SUM(_sample_interval * double5) AS pagos');
    expect(sql).toContain(`index1 IN ('${ENSAYO_UNO.org}')`);
    expect(sql).toContain("timestamp >= toDateTime('2026-10-13 05:00:00')");
    expect(sql).not.toContain('DROP');
    await expect(
      eventosDeLaSemana(
        medicion(analytics([], 403).fetchFn, 'tienda_eventos'),
        [ENSAYO_UNO.org],
        ventanaDeLaSemana(HOY),
      ),
    ).rejects.toThrow('Analytics Engine respondió 403');
  });
});

describe('el cuadre en el tablero (HU-T14.6)', () => {
  it('CA1 y aceptación de M5: cada semana, la base frente a la medición, en los dos sentidos', async () => {
    const a = analytics([{ org: ENSAYO_UNO.org, pedidos: 3, pagos: 2 }]);
    const e = {
      shards: [['tienda_c1_s1', shard]],
      metricas: { token: 'token-de-metricas', cuenta: 'cuenta-e2e' },
      datasetDeEventos: 'tienda_eventos_staging',
      fetch: a.fetchFn,
    } as unknown as EntornoDeTareas;
    expect(await CUADRE_DE_EVENTOS.correr(e, TURNO)).toMatch(/^1 tienda/);
    // 4 pedidos de la vitrina en la base y 3 en la medición: 1 sin medir. 1 pago aprobado y 2
    // contados: 1 intento de más.
    expect(await ultimoCuadre(shard, ENSAYO_UNO.org)).toMatchObject({
      semana: SEMANA.semana,
      pedidos: { base: 4, eventos: 3 },
      pagos: { base: 1, eventos: 2 },
    });
    // Otra tienda, sin su turno, no se cuadra.
    expect(await ultimoCuadre(shard, ENSAYO_DOS.org)).toBeNull();
  });

  it('❌ CA2: las ventas del tablero no cambian con el cuadre', async () => {
    const q = {
      db: shard,
      org: ENSAYO_UNO.org,
      actor: 'usuario:x',
      instante: new Date(HOY).toISOString(),
    };
    const con = await tablero(q, HOY);
    expect(con.cuadre).not.toBeNull();
    await shard
      .prepare('DELETE FROM cuadre_de_eventos WHERE org_id = ?')
      .bind(ENSAYO_UNO.org)
      .run();
    const sin = await tablero(q, HOY);
    expect(sin.cuadre).toBeNull();
    expect({ ...sin, cuadre: con.cuadre }).toEqual(con);
  });

  it('❌ sin el token de métricas no cuadra nada, y lo dice', async () => {
    const e = { shards: [['tienda_c1_s1', shard]] } as unknown as EntornoDeTareas;
    expect(await CUADRE_DE_EVENTOS.correr(e, HOY)).toBe(
      'sin el token de métricas o el dataset: nada que cuadrar',
    );
  });
});
