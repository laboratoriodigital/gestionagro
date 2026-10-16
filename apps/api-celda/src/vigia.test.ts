/**
 * Vigía de cuota (HU-E8.2) con métricas simuladas: la API GraphQL de Cloudflare se reemplaza por
 * un `fetch` falso que responde por dataset. Lo que esta prueba no ve: que los nombres de los
 * datasets y campos sean los que Cloudflare acepta hoy. Eso lo dice la primera vuelta en staging,
 * que deja en el log cualquier error de la API con su fuente (P17).
 */
import { describe, expect, it } from 'vitest';
import {
  CLAVE_NIVEL,
  CUOTAS_GRATUITAS,
  decidirNivel,
  escalonDeFilas,
  filasPorProducto,
  type KvDeFlags,
  medir,
  nivelPorUso,
  OTRAS_BASES,
  resumen,
  ventanas,
  vigilar,
} from './vigia.ts';
import { vueltaDelVigia } from './worker.ts';

const AHORA = Date.UTC(2026, 9, 1, 15, 30);

type Respuestas = Partial<Record<'workers' | 'd1' | 'kv' | 'r2', unknown[] | { error: string }>>;

/** GraphQL falso: responde según el dataset que pide la consulta. */
function graphql(r: Respuestas = {}) {
  const pedidos: { query: string; variables: Record<string, string>; autorizacion: string }[] = [];
  const fn = (async (_url: string, init?: RequestInit) => {
    const cuerpo = JSON.parse(String(init?.body)) as {
      query: string;
      variables: Record<string, string>;
    };
    pedidos.push({
      ...cuerpo,
      autorizacion: new Headers(init?.headers).get('authorization') ?? '',
    });
    const [clave, campo] = cuerpo.query.includes('workersInvocationsAdaptive')
      ? (['workers', 'workersInvocationsAdaptive'] as const)
      : cuerpo.query.includes('d1AnalyticsAdaptiveGroups')
        ? (['d1', 'd1AnalyticsAdaptiveGroups'] as const)
        : cuerpo.query.includes('kvOperationsAdaptiveGroups')
          ? (['kv', 'kvOperationsAdaptiveGroups'] as const)
          : (['r2', 'r2OperationsAdaptiveGroups'] as const);
    const dato = r[clave] ?? [];
    if (!Array.isArray(dato)) {
      return Response.json({ data: null, errors: [{ message: dato.error }] });
    }
    return Response.json({ data: { viewer: { accounts: [{ [campo]: dato }] } }, errors: null });
  }) as unknown as typeof fetch;
  return { fn, pedidos };
}

function kvFalso(inicial: string | null = null) {
  let valor = inicial;
  const escrituras: string[] = [];
  const kv: KvDeFlags = {
    get: async (clave) => (clave === CLAVE_NIVEL ? valor : null),
    put: async (_clave, v) => {
      valor = v;
      escrituras.push(v);
    },
  };
  return { kv, escrituras };
}

const d1 = (rowsWritten: number, rowsRead = 0) => [{ sum: { rowsRead, rowsWritten } }];

describe('niveles de ARQUITECTURA §8.2', () => {
  it.each([
    [0, 'normal'],
    [59.9, 'normal'],
    [60, 'alerta'],
    [74.9, 'alerta'],
    [75, 'ahorro'],
    [90, 'esencial'],
    [100, 'bloqueo'],
    [130, 'bloqueo'],
  ] as const)('%s %% → %s', (p, nivel) => {
    expect(nivelPorUso(p)).toBe(nivel);
  });
});

describe('CA1 · mide toda la cuenta desde que se reinicia cada cuota', () => {
  it('las diarias desde las 00:00 UTC; las de R2, desde el día 1 del mes', async () => {
    expect(ventanas(AHORA)).toEqual({
      dia: '2026-10-01T00:00:00.000Z',
      mes: '2026-10-01T00:00:00.000Z',
      hasta: '2026-10-01T15:30:00.000Z',
    });
    const { fn, pedidos } = graphql();
    await medir(fn, 'token-metricas', 'cuenta-1', Date.UTC(2026, 9, 17, 3));
    expect(pedidos).toHaveLength(4);
    for (const p of pedidos) {
      expect(p.autorizacion).toBe('Bearer token-metricas');
      expect(p.variables['cuenta']).toBe('cuenta-1');
    }
    const desdes = pedidos.map((p) => p.variables['desde']);
    expect(desdes.filter((d) => d === '2026-10-17T00:00:00.000Z')).toHaveLength(3);
    expect(desdes).toContain('2026-10-01T00:00:00.000Z'); // R2, mensual
  });

  it('calcula el % de cada cuota, sumando todos los Workers y bases de la cuenta', async () => {
    const { fn } = graphql({
      workers: [{ sum: { requests: 30_000 } }, { sum: { requests: 20_000 } }],
      d1: [...d1(40_000, 1_000_000), ...d1(20_000)],
      kv: [
        { sum: { requests: 2_000 }, dimensions: { actionType: 'read' } },
        { sum: { requests: 100 }, dimensions: { actionType: 'write' } },
        { sum: { requests: 300 }, dimensions: { actionType: 'list' } },
      ],
      r2: [
        { sum: { requests: 10_000 }, dimensions: { actionType: 'PutObject' } },
        { sum: { requests: 50_000 }, dimensions: { actionType: 'GetObject' } },
        { sum: { requests: 999 }, dimensions: { actionType: 'DeleteObject' } },
      ],
    });
    const m = await medir(fn, 't', 'c', AHORA);
    expect(m.fallas).toEqual([]);
    expect(m.uso).toEqual({
      workers_solicitudes: 50,
      d1_filas_leidas: 20,
      d1_filas_escritas: 60,
      kv_lecturas: 2,
      kv_escrituras: 30, // el mayor de escribir, borrar y listar
      r2_clase_a: 1,
      r2_clase_b: 0.5,
    });
    expect(decidirNivel(m, 'normal')).toBe('alerta'); // manda la cuota más usada
  });

  it('❌ R2 casi agotado no mueve el nivel: es del mes y cobra, no se detiene (bitácora tienda3 27)', async () => {
    const { kv, escrituras } = kvFalso();
    const { fn } = graphql({
      d1: d1(1_000),
      r2: [{ sum: { requests: 950_000 }, dimensions: { actionType: 'PutObject' } }],
    });
    const v = await vigilar(kv, 't', 'c', AHORA, fn);
    expect(v.uso.r2_clase_a).toBe(95);
    expect(v.nivel).toBe('normal');
    expect(escrituras).toEqual([]);
    expect(resumen(v)).toContain('operaciones clase A de R2 95 %');
  });
});

describe('CA2 · escribe el nivel solo cuando cambia', () => {
  it('24 vueltas con el mismo consumo: una sola escritura', async () => {
    const { kv, escrituras } = kvFalso();
    const { fn } = graphql({ d1: d1(80_000) });
    for (let h = 0; h < 24; h++) await vigilar(kv, 't', 'c', AHORA + h * 3_600_000, fn);
    expect(escrituras).toEqual(['ahorro']);
  });

  it('sube y vuelve a «normal» cuando la cuota se reinicia', async () => {
    const { kv, escrituras } = kvFalso('esencial');
    const v = await vigilar(kv, 't', 'c', AHORA, graphql({ d1: d1(1_000) }).fn);
    expect(v).toMatchObject({ antes: 'esencial', nivel: 'normal', escrito: true });
    expect(escrituras).toEqual(['normal']);
  });
});

describe('CA3 · si no puede leer, lo dice como alerta, nunca como normal', () => {
  it('sin token: alerta, con el motivo', async () => {
    const { kv } = kvFalso();
    const v = await vigilar(kv, undefined, 'c', AHORA, graphql().fn);
    expect(v.nivel).toBe('alerta');
    expect(resumen(v)).toContain('falta el token de métricas');
  });

  it('una fuente con error: al menos alerta, nombra la fuente y su mensaje', async () => {
    const { kv } = kvFalso();
    const v = await vigilar(kv, 't', 'c', AHORA, graphql({ kv: { error: 'unknown field' } }).fn);
    expect(v.nivel).toBe('alerta');
    expect(v.fallas).toEqual(['KV: unknown field']);
  });

  it('con una fuente sin leer, nunca baja un nivel más alto que ya estaba', async () => {
    const { kv, escrituras } = kvFalso('esencial');
    const v = await vigilar(kv, 't', 'c', AHORA, graphql({ d1: { error: 'timeout' } }).fn);
    expect(v.nivel).toBe('esencial');
    expect(escrituras).toEqual([]);
  });

  it('una respuesta que no trae la cuenta es una falla, no un cero', async () => {
    const fn = (async () =>
      Response.json({
        data: { viewer: { accounts: [] } },
        errors: null,
      })) as unknown as typeof fetch;
    const m = await medir(fn, 't', 'c', AHORA);
    expect(m.uso).toEqual({});
    expect(m.fallas).toHaveLength(4);
  });
});

describe('la vuelta del Cron Trigger', () => {
  it('sin KV de flags no hace nada y lo dice', async () => {
    expect(await vueltaDelVigia({}, AHORA, graphql().fn)).toBeNull();
  });

  it('con KV, mide y escribe el nivel', async () => {
    const { kv, escrituras } = kvFalso();
    const v = await vueltaDelVigia(
      { FLAGS: kv, CF_METRICAS_TOKEN: 't', CF_CUENTA: 'c' },
      AHORA,
      graphql({ workers: [{ sum: { requests: CUOTAS_GRATUITAS.workers_solicitudes.limite } }] }).fn,
    );
    expect(v?.nivel).toBe('bloqueo');
    expect(escrituras).toEqual(['bloqueo']);
  });
});

describe('el plan de la celda', () => {
  it('con un plan cuyas cuotas no conoce, no mide contra las del gratuito: alerta y lo dice', async () => {
    const { kv } = kvFalso();
    const { fn, pedidos } = graphql();
    const v = await vigilar(kv, 't', 'c', AHORA, fn, 'cliente');
    expect(pedidos).toEqual([]);
    expect(v.nivel).toBe('alerta');
    expect(v.fallas).toEqual(['las cuotas del plan «cliente» no están definidas en el vigía']);
  });
});

describe('HU-Q7.13 · las filas de D1 de la cuenta, por producto', () => {
  const MAPA = {
    productoDeBase: {
      'base-agro': 'agro',
      'base-core': 'core',
      'base-parqueadero': 'parqueadero',
      'base-parqueadero-staging': 'parqueadero (staging)',
    },
    presupuestos: { parqueadero: 70_000 },
  };
  const deBase = (base: string, rowsWritten: number) => ({
    sum: { rowsRead: 0, rowsWritten },
    dimensions: { databaseId: base },
  });

  it.each([
    [0, 0],
    [49.9, 0],
    [50, 50],
    [74.9, 50],
    [75, 75],
    [90, 90],
    [130, 90],
  ] as const)('%s %% → escalón %s', (p, escalon) => {
    expect(escalonDeFilas(p)).toBe(escalon);
  });

  it('pregunta por base y suma por producto; lo que el mapa no conoce va en «otras bases»', async () => {
    const { fn, pedidos } = graphql({
      d1: [
        deBase('base-agro', 1_000),
        deBase('base-core', 500),
        deBase('base-parqueadero', 30_000),
        deBase('base-parqueadero', 10_000),
        deBase('base-rara', 200),
      ],
    });
    const { kv } = kvFalso();
    const v = await vigilar(kv, 't', 'c', AHORA, fn, 'free', null, MAPA);
    expect(pedidos.find((p) => p.query.includes('d1AnalyticsAdaptiveGroups'))?.query).toContain(
      'dimensions { databaseId }',
    );
    expect(v.filas).toEqual({
      escalon: 0,
      porProducto: [
        ['parqueadero', 40_000],
        ['agro', 1_000],
        ['core', 500],
        [OTRAS_BASES, 200],
      ],
      sobrePresupuesto: [],
    });
    expect(filasPorProducto({ x: 3 }, {})).toEqual({ [OTRAS_BASES]: 3 });
  });

  it('CA3 ❌: con el límite de la cuenta al 95 %, avisa y dice quién pasó sus filas (staging cuenta)', async () => {
    const { fn } = graphql({
      d1: [
        deBase('base-parqueadero', 60_000),
        deBase('base-parqueadero-staging', 20_000),
        deBase('base-agro', 15_000),
      ],
    });
    const { kv } = kvFalso();
    const v = await vigilar(kv, 't', 'c', AHORA, fn, 'free', null, MAPA);
    expect(v.uso.d1_filas_escritas).toBe(95);
    expect(v.nivel).toBe('esencial');
    expect(v.filas?.escalon).toBe(90);
    expect(v.filas?.sobrePresupuesto).toEqual(['parqueadero']);
  });

  it('sin mapa también mide: todo va en «otras bases» y el escalón sale igual', async () => {
    const { fn } = graphql({ d1: [deBase('base-agro', 52_000)] });
    const v = await vigilar(kvFalso().kv, 't', 'c', AHORA, fn);
    expect(v.filas).toEqual({
      escalon: 50,
      porProducto: [[OTRAS_BASES, 52_000]],
      sobrePresupuesto: [],
    });
  });
});
