/**
 * HU-C5.8: el script del flujo `registrar-pago-en-efectivo` y la base D1 por la API de Cloudflare.
 * La lógica del pago se prueba en `apps/core/src/pago-en-efectivo.test.ts` contra el D1 local.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { baseD1Remota, idDeLaBaseD1 } from '../../scripts/lib/d1-remota.ts';
import { RAIZ } from '../../scripts/lib/repo.ts';
import { pedidoDelEntorno, resumen } from '../../scripts/registrar-pago-en-efectivo.ts';

const responder = (estado: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status: estado });

describe('la base D1 por la API de Cloudflare', () => {
  it('manda la sentencia con sus valores y devuelve filas y cambios', async () => {
    const pedidos: { url: string; cuerpo: unknown }[] = [];
    const db = baseD1Remota(
      async (url, init) => {
        pedidos.push({ url: String(url), cuerpo: JSON.parse(String(init?.body)) });
        return responder(200, {
          success: true,
          result: [{ results: [{ plan: 'gratis' }], meta: { changes: 1 } }],
        });
      },
      'tok',
      'cta',
      'base-1',
    );
    expect(
      await db.prepare('SELECT plan FROM organizacion WHERE id = ?').bind('p1').first(),
    ).toEqual({
      plan: 'gratis',
    });
    const [r] = await db.batch([db.prepare('UPDATE x SET y = ?').bind(2)]);
    expect(r?.meta.changes).toBe(1);
    expect(pedidos).toEqual([
      {
        url: 'https://api.cloudflare.com/client/v4/accounts/cta/d1/database/base-1/query',
        cuerpo: { sql: 'SELECT plan FROM organizacion WHERE id = ?', params: ['p1'] },
      },
      {
        url: 'https://api.cloudflare.com/client/v4/accounts/cta/d1/database/base-1/query',
        cuerpo: { sql: 'UPDATE x SET y = ?', params: [2] },
      },
    ]);
  });

  it('❌ un error de D1 se dice con su mensaje; una base que no existe, también', async () => {
    const db = baseD1Remota(
      async () =>
        responder(400, { success: false, errors: [{ message: 'CHECK constraint failed' }] }),
      'tok',
      'cta',
      'b',
    );
    await expect(db.prepare('INSERT …').run()).rejects.toThrow('CHECK constraint failed');
    await expect(
      idDeLaBaseD1(
        async () => responder(200, { result: [{ uuid: 'u', name: 'agro_core_staging' }] }),
        't',
        'c',
        'agro_core',
      ),
    ).rejects.toThrow('no hay una base D1 llamada agro_core');
    expect(
      await idDeLaBaseD1(
        async () => responder(200, { result: [{ uuid: 'u', name: 'agro_core' }] }),
        't',
        'c',
        'agro_core',
      ),
    ).toBe('u');
  });
});

describe('el script del flujo', () => {
  const entorno = {
    AMBIENTE: 'produccion',
    CLIENTE: ' dueno@parqueadero.co ',
    PRODUCTO: 'parqueadero',
    PLAN: 'parqueadero',
    MESES: '12',
    MONTO: '299.000',
    NOTA: 'Pagó el año en la oficina',
    REGISTRA: 'sebasurrego',
  };

  it('lee el pedido de las variables, con el monto en pesos como lo escribe el dueño', () => {
    expect(pedidoDelEntorno(entorno)).toEqual({
      cliente: 'dueno@parqueadero.co',
      producto: 'parqueadero',
      plan: 'parqueadero',
      meses: 12,
      monto_cop: 299000,
      nota: 'Pagó el año en la oficina',
      registra: 'sebasurrego',
      ambiente: 'produccion',
    });
    expect(pedidoDelEntorno({ ...entorno, MONTO: '' })).toMatchObject({ monto_cop: null });
    expect(pedidoDelEntorno({ ...entorno, AMBIENTE: 'staging' })).toMatchObject({
      ambiente: 'pruebas',
    });
  });

  it('❌ sin nota, con un monto raro o un ambiente desconocido, no sigue', () => {
    expect(pedidoDelEntorno({ ...entorno, NOTA: ' ' })).toBe('Falta NOTA');
    expect(pedidoDelEntorno({ ...entorno, MONTO: 'trescientos' })).toMatch(/MONTO/);
    expect(pedidoDelEntorno({ ...entorno, AMBIENTE: 'prod' })).toMatch(/AMBIENTE/);
  });

  it('el resumen dice qué cambia, en fechas de Bogotá, y avisa si se cobró distinto del precio', () => {
    const plan = {
      organizacion: { id: 'p1', nombre: 'Parqueadero Ensayo' },
      plan: 'parqueadero',
      meses: 12,
      monto_cop: 280000,
      precio_cop: 299000,
      antes: { plan: 'gratis', vence: null },
      desde: '2026-10-20T15:00:00.000Z',
      vence: '2027-10-21T03:00:00.000Z',
      credito_dias: 0,
    };
    const previa = resumen(plan, false);
    expect(previa).toContain('Vista previa: nada se escribió');
    expect(previa).toContain('parqueadero, 12 meses, $280.000');
    expect(previa).toContain('hasta el 20/10/2027');
    expect(previa).toContain('el precio del periodo es $299.000');
    expect(previa).toContain('«confirmar» en **si**');
    expect(resumen(plan, true)).toContain('Pago en efectivo registrado');
  });

  it('el flujo es solo a mano, no interpola entradas en `run` y deja «no» por omisión', () => {
    const f = parse(
      readFileSync(join(RAIZ, '.github/workflows/registrar-pago-en-efectivo.yml'), 'utf8'),
    ) as {
      on: Record<string, { inputs: Record<string, { default?: string }> }>;
      jobs: { registrar: { steps: { run?: string }[] } };
    };
    expect(Object.keys(f.on)).toEqual(['workflow_dispatch']);
    expect(f.on['workflow_dispatch']?.inputs['confirmar']?.default).toBe('no');
    for (const paso of f.jobs.registrar.steps) expect(paso.run ?? '').not.toContain('${{');
  });
});
