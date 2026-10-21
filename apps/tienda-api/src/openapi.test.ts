/**
 * HU-T15.2: la OpenAPI de la API pública sale de los esquemas zod, y su contrato solo crece (CA2).
 * `contrato/openapi-v1.json` es la versión publicada: con `ACTUALIZAR_DORADOS=1` se reescribe, salvo
 * que lo nuevo rompa a un cliente de la anterior.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { apiPublica, cambiosQueRompen } from './openapi.ts';

const CONTRATO = join(import.meta.dirname, '..', 'contrato', 'openapi-v1.json');
const actual = apiPublica();
const texto = `${JSON.stringify(actual, null, 2)}\n`;

describe('la OpenAPI de la API pública (HU-T15.2)', () => {
  it('es OpenAPI 3.1 con cada ruta pública, su cuerpo y sus límites', () => {
    expect(actual['openapi']).toBe('3.1.0');
    const paths = actual['paths'] as Record<string, Record<string, Record<string, unknown>>>;
    expect(Object.keys(paths).sort()).toEqual([
      '/api/v1/avisame',
      '/api/v1/cotizar',
      '/api/v1/pedidos',
      '/api/v1/seguimiento',
      '/api/v1/solicitudes',
      '/api/v1/solicitudes/seguimiento',
      '/api/v1/tienda',
    ]);
    const pedidos = paths['/api/v1/pedidos']?.['post'] as {
      requestBody: { content: { 'application/json': { schema: Record<string, unknown> } } };
      responses: Record<string, { headers?: unknown }>;
    };
    const esquema = pedidos.requestBody.content['application/json'].schema;
    expect(esquema['required']).toEqual(
      expect.arrayContaining(['codigo', 'lineas', 'forma', 'acepta', 'terminos']),
    );
    expect((esquema['properties'] as Record<string, unknown>)['acepta']).toEqual({
      type: 'boolean',
      const: true,
    });
    expect(pedidos.responses['429']?.headers).toBeDefined();
  });

  it('❌ lo que es del navegador o de Bold no se publica: cobros, su estado, el aviso y la medición', () => {
    const rutas = Object.keys(actual['paths'] as object);
    for (const r of ['/api/v1/cobros', '/api/v1/cobros/estado', '/api/v1/avisos/bold', '/_m']) {
      expect(rutas).not.toContain(r);
    }
  });

  it('es la del contrato publicado; un cambio que lo rompe no se acepta (CA2)', () => {
    const anterior = existsSync(CONTRATO) ? JSON.parse(readFileSync(CONTRATO, 'utf8')) : null;
    if (anterior) expect(cambiosQueRompen(anterior, actual)).toEqual([]);
    if (process.env['ACTUALIZAR_DORADOS'] === '1') writeFileSync(CONTRATO, texto);
    else expect(readFileSync(CONTRATO, 'utf8')).toBe(texto);
  });
});

describe('qué rompe el contrato (CA2)', () => {
  const base = () =>
    JSON.parse(JSON.stringify(apiPublica())) as {
      paths: Record<
        string,
        Record<
          string,
          { requestBody?: { content: { 'application/json': { schema: Record<string, unknown> } } } }
        >
      >;
    };
  const cuerpo = (d: ReturnType<typeof base>, ruta: string) =>
    d.paths[ruta]?.['post']?.requestBody?.content['application/json'].schema as {
      properties: Record<string, Record<string, unknown>>;
      required: string[];
    };

  it('agregar una ruta o un campo opcional no rompe', () => {
    const nuevo = base();
    nuevo.paths['/api/v1/nueva'] = { get: {} };
    cuerpo(nuevo, '/api/v1/cotizar').properties['nuevo'] = { type: 'string' };
    expect(cambiosQueRompen(apiPublica(), nuevo)).toEqual([]);
  });

  it('❌ quitar una ruta, quitar un campo, volverlo obligatorio o quitar un valor rompe', () => {
    const nuevo = base();
    delete nuevo.paths['/api/v1/avisame'];
    delete cuerpo(nuevo, '/api/v1/cotizar').properties['cupon'];
    cuerpo(nuevo, '/api/v1/cotizar').required.push('envio');
    const forma = cuerpo(nuevo, '/api/v1/pedidos').properties['forma'] as { enum: string[] };
    forma.enum = forma.enum.filter((f) => f !== 'efectivo');
    cuerpo(nuevo, '/api/v1/seguimiento').properties['codigo'] = { type: 'number' };
    expect(cambiosQueRompen(apiPublica(), nuevo)).toEqual([
      'POST /api/v1/cotizar.cupon: se quitó',
      'POST /api/v1/cotizar.envio: ahora es obligatorio',
      'POST /api/v1/pedidos.forma: ya no acepta "efectivo"',
      'POST /api/v1/seguimiento.codigo: el tipo pasó de "string" a "number"',
      'POST /api/v1/avisame: se quitó',
    ]);
  });
});
