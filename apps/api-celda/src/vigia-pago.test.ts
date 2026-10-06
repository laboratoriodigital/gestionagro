/**
 * HU-C11.1: el vigía con Workers Paid. Las cuentas se hacen a mano en cada caso, con los precios
 * de `CUOTAS_PAGO`, para que un cambio de precio o de fórmula se vea en la prueba.
 */
import { describe, expect, it } from 'vitest';
import { CLAVE_NIVEL, type KvDeFlags, vigilar } from './vigia.ts';
import {
  BASE_USD_MES,
  costoHastaHoy,
  decidirConPago,
  escalonDeAviso,
  parteDelMes,
  presupuestoDe,
  proyectar,
} from './vigia-pago.ts';

const DIA = 24 * 60 * 60 * 1000;
/** 16 de noviembre a las 00:00 UTC: pasaron 15 de 30 días, la mitad del mes. */
const MITAD = Date.UTC(2026, 10, 16);

function kvMapa(inicial: Record<string, string> = {}) {
  const valores = new Map(Object.entries(inicial));
  const escrituras: string[] = [];
  const kv: KvDeFlags = {
    get: async (clave) => valores.get(clave) ?? null,
    put: async (clave, v) => {
      valores.set(clave, v);
      escrituras.push(`${clave}=${v}`);
    },
  };
  return { kv, valores, escrituras };
}

/** GraphQL falso que guarda desde cuándo pidió cada fuente. */
function metricas(d1Escritas: number, workers = 0) {
  const desde: string[] = [];
  const fn = (async (_url: string, init?: RequestInit) => {
    const { query, variables } = JSON.parse(String(init?.body)) as {
      query: string;
      variables: { desde: string };
    };
    desde.push(variables.desde);
    const fila = query.includes('workersInvocations')
      ? { workersInvocationsAdaptive: [{ sum: { requests: workers } }] }
      : query.includes('d1Analytics')
        ? { d1AnalyticsAdaptiveGroups: [{ sum: { rowsRead: 0, rowsWritten: d1Escritas } }] }
        : query.includes('kvOperations')
          ? { kvOperationsAdaptiveGroups: [] }
          : { r2OperationsAdaptiveGroups: [] };
    return Response.json({ data: { viewer: { accounts: [fila] } }, errors: null });
  }) as unknown as typeof fetch;
  return { fn, desde };
}

describe('HU-C11.1 · la cuenta del mes', () => {
  it('la parte del mes nunca es menos de un día: la primera hora no se multiplica por 720', () => {
    expect(parteDelMes(Date.UTC(2026, 10, 1, 1))).toBeCloseTo(1 / 30, 6);
    expect(parteDelMes(MITAD)).toBeCloseTo(0.5, 6);
  });

  it('dentro de lo incluido, el mes cuesta la base', () => {
    // 20 millones de filas escritas a la mitad del mes: 40 proyectadas, de 50 incluidas.
    const p = proyectar({ d1_filas_escritas: 20_000_000 }, MITAD);
    expect(p).toEqual({ usoDelIncluido: { d1_filas_escritas: 40 }, usdProyectado: BASE_USD_MES });
  });

  it('por encima, suma cada millón adicional a su precio', () => {
    // 40 millones a la mitad: 80 proyectadas, 30 por encima de 50, a USD 1 el millón.
    // 8 millones de solicitudes: 16 proyectadas, 6 por encima de 10, a USD 0,30.
    const p = proyectar({ d1_filas_escritas: 40_000_000, workers_solicitudes: 8_000_000 }, MITAD);
    expect(p.usdProyectado).toBe(5 + 30 + 1.8);
    expect(p.usoDelIncluido).toEqual({ d1_filas_escritas: 80, workers_solicitudes: 80 });
    // Lo ya debido no se proyecta: todavía no pasó de lo incluido.
    expect(costoHastaHoy({ d1_filas_escritas: 40_000_000 })).toBe(5);
  });

  it.each([
    [49.9, 0],
    [50, 50],
    [75, 75],
    [90, 90],
    [130, 90],
  ])('al %s %% de lo incluido, el aviso es del escalón %s', (pct, escalon) => {
    expect(escalonDeAviso(pct)).toBe(escalon);
  });
});

describe('HU-C11.1 · presupuesto: avisar con la proyección, apagar con lo gastado', () => {
  const presupuesto = { usdMes: 20, alAgotarse: ['ks:agro-fotos'] };

  it('una proyección sobre el presupuesto avisa, pero no apaga lo que todavía no costó', () => {
    const d = decidirConPago({ d1_filas_escritas: 40_000_000 }, MITAD, presupuesto);
    expect(d.usdProyectado).toBe(35);
    expect(d.sobrePresupuesto).toBe(true);
    expect(d.apagar).toEqual([]);
  });

  it('CA3 · con el 100 % del presupuesto ya gastado, apaga lo declarado', () => {
    // 70 millones escritas: 20 por encima de lo incluido, USD 20 sobre la base: el 100 %.
    const d = decidirConPago(
      { d1_filas_escritas: 70_000_000 },
      Date.UTC(2026, 10, 25),
      presupuesto,
    );
    expect(d.apagar).toEqual(['ks:agro-fotos']);
  });

  it('sin presupuesto declarado no apaga nada y no lo inventa (P1)', () => {
    expect(decidirConPago({ d1_filas_escritas: 900_000_000 }, MITAD, null).apagar).toEqual([]);
    expect(presupuestoDe(undefined, 'ks:agro-fotos')).toBeNull();
    expect(presupuestoDe('cero', undefined)).toBeNull();
    expect(presupuestoDe('15', 'ks:a-x, ks:a-y')).toEqual({
      usdMes: 15,
      alAgotarse: ['ks:a-x', 'ks:a-y'],
    });
  });
});

describe('HU-C11.1 · una vuelta del vigía con Workers Paid', () => {
  const presupuesto = { usdMes: 20, alAgotarse: ['ks:agro-fotos'] };

  it('mide todo desde el día 1 del mes y no degrada por cuotas diarias: con Paid no hay corte', async () => {
    const { kv, escrituras } = kvMapa({ [CLAVE_NIVEL]: 'normal' });
    // 200.000 filas en un día serían el 200 % del gratuito; con Paid es poco.
    const { fn, desde } = metricas(200_000);
    const v = await vigilar(kv, 't', 'c', MITAD, fn, 'paid', presupuesto);
    expect(new Set(desde)).toEqual(new Set(['2026-11-01T00:00:00.000Z']));
    expect(v.nivel).toBe('normal');
    expect(v.uso).toEqual({});
    expect(v.pago).toMatchObject({ usdProyectado: 5, escalon: 0, apagadas: [] });
    expect(escrituras).toEqual([]);
  });

  it('CA3 · al agotar el presupuesto apaga lo declarado, una sola vez', async () => {
    const { kv, valores, escrituras } = kvMapa({ [CLAVE_NIVEL]: 'normal' });
    const { fn } = metricas(70_000_000);
    const ahora = MITAD + 9 * DIA;
    expect((await vigilar(kv, 't', 'c', ahora, fn, 'paid', presupuesto)).pago?.apagadas).toEqual([
      'ks:agro-fotos',
    ]);
    expect(valores.get('ks:agro-fotos')).toBe('apagado');
    expect((await vigilar(kv, 't', 'c', ahora, fn, 'paid', presupuesto)).pago?.apagadas).toEqual(
      [],
    );
    expect(escrituras).toEqual(['ks:agro-fotos=apagado']);
  });

  it('si no pudo medir, no apaga nada: no sabe cuánto se gastó', async () => {
    const { kv, valores } = kvMapa({ [CLAVE_NIVEL]: 'normal' });
    const falla = (async () =>
      Response.json({ errors: [{ message: 'sin permiso' }] })) as unknown as typeof fetch;
    const v = await vigilar(kv, 't', 'c', MITAD, falla, 'paid', {
      usdMes: 0.01,
      alAgotarse: ['ks:agro-fotos'],
    });
    expect(v.nivel).toBe('alerta');
    expect(v.pago?.apagadas).toEqual([]);
    expect(valores.has('ks:agro-fotos')).toBe(false);
  });
});
