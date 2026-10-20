/**
 * HU-T13.5 CA1: los periodos de los planes y pagarlos con el CORE. El CORE es un `fetch` de mentira;
 * ningún dato es real.
 */
import { describe, expect, it } from 'vitest';
import { almacenEnMemoria } from './almacen.ts';
import {
  confirmarCobro,
  crearCobro,
  diasParaVencer,
  ordenDeLaVuelta,
  planesDeLaTienda,
} from './plan.ts';
import type { Sesion } from './sesion.ts';

const CORE = 'https://core.ejemplo.test';
const AHORA = 1_800_000_000_000;
const tienda = `x.${btoa(JSON.stringify({ aud: 'tienda' }))}.y`;
const ORDEN = 'tienda-0199f000-0000-7000-8000-00000000a1a1';

const sesion = (o: Partial<Sesion> = {}): Sesion => ({
  acceso: tienda,
  acceso_vence: AHORA + 60_000,
  refresh: 'r',
  refresh_vence: AHORA + 86_400_000,
  usuario: { nombre: 'Ensayo Dos', email: 'ensayo.dos@ejemplo.test' },
  organizaciones: [],
  org_id: 'o',
  ...o,
});

function red(respuestas: Record<string, (() => Response)[]>) {
  const pedidos: { url: string; cuerpo: unknown }[] = [];
  const fetchFn = (async (url: string, init?: RequestInit) => {
    pedidos.push({ url, cuerpo: init?.body ? JSON.parse(String(init.body)) : null });
    const r = respuestas[url]?.shift();
    if (!r) throw new Error(`sin respuesta para ${url}`);
    return r();
  }) as unknown as typeof fetch;
  return { pedidos, fetchFn };
}
const json = (estado: number, cuerpo: unknown) => () =>
  new Response(JSON.stringify(cuerpo), { status: estado });

describe('los planes y sus periodos (HU-T13.5 CA1)', () => {
  it('cada plan pago tiene 1, 3, 6 y 12 meses, con el total, el valor por mes y lo que se ahorra', () => {
    const planes = planesDeLaTienda();
    expect(planes.map((p) => p.id)).toEqual(['gratis', 'entrada', 'intermedio', 'alto']);
    expect(planes.find((p) => p.id === 'gratis')?.periodos).toEqual([]);
    const entrada = planes.find((p) => p.id === 'entrada');
    expect(entrada?.periodos.map((p) => p.meses)).toEqual([1, 3, 6, 12]);
    expect(entrada?.periodos.find((p) => p.meses === 6)).toEqual({
      meses: 6,
      total: 161000,
      porMes: 26833,
      ahorro: 29900 * 6 - 161000,
    });
    for (const p of planes.filter((x) => !x.gratuito)) {
      for (const periodo of p.periodos) expect(periodo.total).toBeGreaterThan(0);
    }
  });

  it('los días que le quedan al plan; sin vencimiento, null', () => {
    expect(diasParaVencer(null, AHORA)).toBeNull();
    expect(diasParaVencer(new Date(AHORA + 36 * 3_600_000).toISOString(), AHORA)).toBe(2);
    expect(diasParaVencer(new Date(AHORA - 1).toISOString(), AHORA)).toBe(0);
  });
});

describe('pagar el plan en el CORE (HU-T13.5 CA1)', () => {
  it('el cobro lleva el plan, los meses y la vuelta, nunca el monto', async () => {
    const almacen = almacenEnMemoria({ sesion: sesion() });
    const cobro = {
      orden: ORDEN,
      pruebas: true,
      libreria: 'https://checkout.bold.co/x.js',
      checkout: {},
    };
    const { pedidos, fetchFn } = red({ [`${CORE}/api/core/pago/crear`]: [json(200, cobro)] });
    const r = await crearCobro(
      { almacen, core: CORE, fetchFn, ahora: () => AHORA },
      'entrada',
      6,
      'https://panel.ejemplo.test/mas/plan/',
    );
    expect(r).toEqual({ tipo: 'ok', datos: cobro });
    expect(pedidos[0]?.cuerpo).toEqual({
      plan: 'entrada',
      meses: 6,
      vuelta: 'https://panel.ejemplo.test/mas/plan/',
    });
  });

  it('❌ si el CORE no deja (otro rol, otro periodo), su motivo llega en palabras', async () => {
    const almacen = almacenEnMemoria({ sesion: sesion() });
    const { fetchFn } = red({
      [`${CORE}/api/core/pago/crear`]: [
        json(403, { estado: 'prohibido', motivo: 'El plan lo paga quien administra la finca.' }),
      ],
    });
    expect(
      await crearCobro({ almacen, core: CORE, fetchFn, ahora: () => AHORA }, 'entrada', 6, 'x'),
    ).toEqual({ tipo: 'problema', motivo: 'El plan lo paga quien administra la finca.' });
  });

  it('al volver aprobado, la sesión se renueva para traer el plan nuevo', async () => {
    const almacen = almacenEnMemoria({ sesion: sesion() });
    const { pedidos, fetchFn } = red({
      [`${CORE}/api/core/pago/confirmar`]: [
        json(200, { estado: 'aprobado', motivo: null, plan: 'entrada', plan_vence: '2027-04-20' }),
      ],
      [`${CORE}/api/core/auth/refrescar`]: [
        json(200, { ...sesion(), acceso_vence: AHORA + 3_600_000 }),
      ],
    });
    const r = await confirmarCobro({ almacen, core: CORE, fetchFn, ahora: () => AHORA }, ORDEN);
    expect(r).toMatchObject({ tipo: 'ok', datos: { estado: 'aprobado', plan: 'entrada' } });
    expect(pedidos.map((p) => p.url)).toEqual([
      `${CORE}/api/core/pago/confirmar`,
      `${CORE}/api/core/auth/refrescar`,
    ]);
    expect(pedidos[0]?.cuerpo).toEqual({ orden: ORDEN });
  });

  it('❌ solo una orden de la Tienda en la vuelta cuenta', () => {
    expect(ordenDeLaVuelta(`?pago=${ORDEN}&bold-tx-status=approved`)).toBe(ORDEN);
    expect(ordenDeLaVuelta('?pago=agro-0199f000-0000-7000-8000-00000000a1a1')).toBeNull();
    expect(ordenDeLaVuelta('?pago=<script>')).toBeNull();
    expect(ordenDeLaVuelta('')).toBeNull();
  });
});
