/**
 * HU-T11.1: el adaptador de Bold, fuera del CORE. Las llaves llegan en cada llamada (CA1), la firma
 * de integridad es la de Bold y cada estado se traduce en un solo sitio; uno que no se conoce es
 * «revisar», nunca «aprobado» (CA3). Con un `fetch` de mentira: nada sale a la red.
 */
import { describe, expect, it } from 'vitest';
import {
  ErrorDeBold,
  ESTADOS_BOLD,
  estadoDeBold,
  firmaDeIntegridad,
  type LlavesBold,
  proveedorBold,
} from './index.ts';

const LLAVES: LlavesBold = {
  identidad: 'identidad-de-prueba',
  secreta: 'llave-secreta-de-prueba',
  ambiente: 'pruebas',
};

/** Un Bold de mentira que responde lo que se le diga y anota con qué llave le preguntaron. */
function boldFalso(status: number, cuerpo: unknown) {
  const llamadas: { url: string; autorizacion: string | null }[] = [];
  const fetchFalso = (async (url: string, init?: RequestInit) => {
    llamadas.push({
      url,
      autorizacion: new Headers(init?.headers).get('authorization'),
    });
    return Response.json(cuerpo, { status });
  }) as unknown as typeof fetch;
  return { llamadas, fetchFalso };
}

describe('HU-T11.1 · @ed1/pagos: Bold con las llaves en cada llamada', () => {
  it('la firma de integridad es SHA-256 de orden + monto + COP + llave secreta', async () => {
    // Calculada aparte: sha256('ped-0001129000COPllave-secreta-de-prueba').
    expect(await firmaDeIntegridad('ped-0001', 129000, LLAVES.secreta)).toBe(
      'fdba8ff8838f9012a8179e0c2e7c01dd18e16d7390b9bc222b810a60f349d07a',
    );
  });

  it('CA1: el cobro va firmado con las llaves que se le pasan, y la consulta pregunta con su identidad', async () => {
    const b = boldFalso(200, { payload: { payment_status: 'APPROVED', total: 129000 } });
    const del = (identidad: string) => proveedorBold({ ...LLAVES, identidad }, b.fetchFalso);
    const cobro = await del('identidad-comercio-uno').prepararCobro({
      orden: 'ped-0001',
      monto: 129000,
      descripcion: 'x'.repeat(150),
      vuelta: 'https://ensayo-uno--staging.laboratorio-digital.app/pedido/pago/',
    });
    expect(cobro.checkout).toMatchObject({
      orderId: 'ped-0001',
      currency: 'COP',
      amount: '129000',
      apiKey: 'identidad-comercio-uno',
      integritySignature: 'fdba8ff8838f9012a8179e0c2e7c01dd18e16d7390b9bc222b810a60f349d07a',
    });
    expect(cobro.checkout['description']).toHaveLength(100);
    expect(JSON.stringify(cobro)).not.toContain(LLAVES.secreta);

    await del('identidad-comercio-uno').consultar('ped-0001');
    await del('identidad-comercio-dos').consultar('ped-0002');
    expect(b.llamadas.map((l) => l.autorizacion)).toEqual([
      'x-api-key identidad-comercio-uno',
      'x-api-key identidad-comercio-dos',
    ]);
    expect(b.llamadas[1]?.url).toBe('https://payments.api.bold.co/v2/payment-voucher/ped-0002');
  });

  it.each([
    ['APPROVED', 'aprobado'],
    ['REJECTED', 'rechazado'],
    ['FAILED', 'rechazado'],
    ['VOIDED', 'rechazado'],
    ['PENDING', 'esperando'],
    ['PROCESSING', 'esperando'],
    ['NO_TRANSACTION_FOUND', 'esperando'],
  ])('Bold dice %s: %s', async (crudo, estado) => {
    const b = boldFalso(200, { payload: { payment_status: crudo, total: 129000 } });
    expect(await proveedorBold(LLAVES, b.fetchFalso).consultar('ped-0001')).toMatchObject({
      estado,
      crudo,
    });
  });

  it('❌ CA3: un estado que no se conoce es «revisar», nunca «aprobado»', async () => {
    for (const crudo of [
      'APPROVED_PARTIALLY',
      'AUTHORIZED',
      'CAPTURED',
      'REFUNDED',
      'constructor',
    ]) {
      expect(estadoDeBold(crudo), crudo).toBe('revisar');
      const b = boldFalso(200, { payload: { payment_status: crudo, total: 129000 } });
      const r = await proveedorBold(LLAVES, b.fetchFalso).consultar('ped-0001');
      expect(r).toMatchObject({ estado: 'revisar', crudo: crudo.toUpperCase() });
    }
    // Lo que se aprueba es exactamente lo que está en la lista, y solo eso.
    expect(Object.entries(ESTADOS_BOLD).filter(([, e]) => e === 'aprobado')).toEqual([
      ['APPROVED', 'aprobado'],
    ]);
  });

  it('404 es «todavía no sé nada»: sigue esperando; otro error de Bold se lanza, no se traduce', async () => {
    const no = boldFalso(404, {});
    expect(await proveedorBold(LLAVES, no.fetchFalso).consultar('ped-0001')).toEqual({
      estado: 'esperando',
      total: null,
      transaccion: null,
      crudo: 'NO_TRANSACTION_FOUND',
    });
    const caido = boldFalso(500, { error: 'x' });
    await expect(proveedorBold(LLAVES, caido.fetchFalso).consultar('ped-0001')).rejects.toThrow(
      'Bold respondió 500',
    );
  });

  it('un 429 sale como ErrorDeBold con su estado, para saltar esa tienda (HU-T11.6)', async () => {
    const lleno = boldFalso(429, { error: 'too many' });
    const e = await proveedorBold(LLAVES, lleno.fetchFalso)
      .consultar('ped-0001')
      .catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErrorDeBold);
    expect((e as ErrorDeBold).estado).toBe(429);
  });
});
