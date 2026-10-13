/**
 * El plan del parqueadero en la caja (HU-Q7.10): los periodos salen de planes.json, el monto nunca
 * viaja desde la caja, la vuelta de Bold no se cree y el texto dice hasta cuándo sigue la nube.
 */
import { describe, expect, it } from 'vitest';
import {
  confirmarCobro,
  crearCobro,
  ErrorDePago,
  ordenDeLaVuelta,
  PLAN_CON_NUBE,
  periodosDe,
  textoDelPlan,
} from './plan.ts';
import { senalDeLaNube } from './senales.ts';

const CORE = 'https://core.ejemplo.test';
const AHORA = Date.UTC(2026, 9, 12, 15);
const DIA = 86_400_000;

describe('los periodos del plan (CA1)', () => {
  it('salen de cobro en planes.json, con lo que sale al mes y lo que ahorra', () => {
    expect(PLAN_CON_NUBE).toBe('parqueadero');
    expect(periodosDe()).toEqual([
      { meses: 1, total: 59_000, porMes: 59_000, ahorro: 0 },
      { meses: 3, total: 168_000, porMes: 56_000, ahorro: 9_000 },
      { meses: 6, total: 318_000, porMes: 53_000, ahorro: 36_000 },
      { meses: 12, total: 590_000, porMes: 49_167, ahorro: 118_000 },
    ]);
  });

  it('el plan gratuito no tiene nada que pagar', () => {
    expect(periodosDe('gratis')).toEqual([]);
  });
});

describe('el cobro lo arma el CORE', () => {
  it('la caja pide el plan y los meses, nunca el monto, con su acceso', async () => {
    let enviado: { url?: string; cuerpo?: unknown; autorizacion?: string | undefined } = {};
    const fetchFn = (async (url: string, init?: RequestInit) => {
      enviado = {
        url,
        cuerpo: JSON.parse(String(init?.body)),
        autorizacion: (init?.headers as Record<string, string> | undefined)?.['authorization'],
      };
      return Response.json({ orden: 'o', pruebas: true, libreria: 'x', checkout: {} });
    }) as unknown as typeof fetch;
    await crearCobro(CORE, 'acceso-1', 3, 'https://caja.test/caja/', fetchFn);
    expect(enviado).toEqual({
      url: `${CORE}/api/core/pago/crear`,
      cuerpo: { plan: 'parqueadero', meses: 3, vuelta: 'https://caja.test/caja/' },
      autorizacion: 'Bearer acceso-1',
    });
  });

  it('❌ lo que el CORE rechaza llega con su motivo; sin señal, lo dice', async () => {
    const rechaza = (async () =>
      Response.json({ motivo: 'Solo quien administra puede pagar.' }, { status: 403 })) as never;
    await expect(confirmarCobro(CORE, 'a', 'o', rechaza)).rejects.toThrow(
      'Solo quien administra puede pagar.',
    );
    const sinRed = (async () => {
      throw new TypeError('Failed to fetch');
    }) as never;
    await expect(crearCobro(CORE, 'a', 1, 'v', sinRed)).rejects.toBeInstanceOf(ErrorDePago);
  });

  it('❌ la vuelta solo acepta una orden con la forma de las del parqueadero', () => {
    const orden = 'parqueadero-01926a1b-2c3d-7e4f-8a9b-0c1d2e3f4a5b';
    expect(ordenDeLaVuelta(`?pago=${orden}`)).toBe(orden);
    expect(ordenDeLaVuelta('?pago=agro-01926a1b-2c3d-7e4f-8a9b-0c1d2e3f4a5b')).toBeNull();
    expect(ordenDeLaVuelta('?pago=parqueadero-<script>')).toBeNull();
    expect(ordenDeLaVuelta('')).toBeNull();
  });
});

describe('lo que la caja dice del plan (CA1 y CA2)', () => {
  const org = { org_id: 'o', nombre: 'Ensayo Uno', rol: 'propietario' };

  it('el gratuito dice que la caja funciona completa y qué trae la nube', () => {
    expect(textoDelPlan({ ...org, plan: 'gratis', plan_vence: null }, AHORA)).toContain(
      'la caja funciona completa en este teléfono',
    );
    // Una sesión de antes de HU-C5.5 no trae el plan: cuenta como el gratuito.
    expect(textoDelPlan(org, AHORA)).toContain('Plan Gratis');
  });

  it('pagado y sin vencimiento, que trae la nube', () => {
    expect(textoDelPlan({ ...org, plan: 'parqueadero', plan_vence: null }, AHORA)).toBe(
      'Plan Parqueadero: con la nube y las varias cajas.',
    );
  });

  it('pagado, hasta cuándo sigue la nube; a menos de una semana, cuántos días faltan', () => {
    const vence = new Date(AHORA + 40 * DIA).toISOString();
    expect(textoDelPlan({ ...org, plan: 'parqueadero', plan_vence: vence }, AHORA)).toBe(
      'Plan Parqueadero: la nube sigue hasta el 21/11/2026.',
    );
    const pronto = new Date(AHORA + 5 * DIA).toISOString();
    expect(
      textoDelPlan(
        { ...org, plan: 'parqueadero', plan_vence: pronto, aviso: 'vence-en-7-dias' },
        AHORA,
      ),
    ).toContain('(en 5 días)');
  });

  it('en gracia, que el pago venció y la nube sigue unos días', () => {
    const vence = new Date(AHORA + 3 * DIA).toISOString();
    expect(
      textoDelPlan({ ...org, plan: 'parqueadero', plan_vence: vence, aviso: 'en-gracia' }, AHORA),
    ).toContain('venció. La nube sigue hasta el 15/10/2026');
  });

  it('la cabecera lo dice solo con la nube al día; una pausa por el plan gana', () => {
    const vacio = { tipo: 'sin-vincular' } as const;
    expect(senalDeLaNube(true, 0, vacio, 'en-gracia')).toEqual({
      texto: 'Plan vencido: la nube sigue unos días',
      tono: 'aviso',
    });
    expect(senalDeLaNube(true, 0, vacio, 'vence-en-1-dia')?.texto).toBe(
      'Todo en la nube · el plan vence pronto',
    );
    expect(senalDeLaNube(true, 2, vacio, 'en-gracia')?.texto).toBe('2 en este dispositivo');
    const pausa = {
      tipo: 'resultado' as const,
      envio: { estado: 'sin-plan' as const, enviados: 0, rechazados: 0, motivo: '' },
      cuando: 0,
    };
    expect(senalDeLaNube(true, 0, pausa, 'en-gracia')?.texto).toBe(
      'Nube en pausa: el plan no está al día',
    );
  });
});
