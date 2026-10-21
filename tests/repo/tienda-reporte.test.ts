/**
 * HU-T14.7: la Tienda en el reporte semanal del dueño, sin la cuenta. La API de D1 es un `fetch` de
 * mentira que responde por base. Solo conteos: ninguna consulta lee un dato de una persona, y una
 * base que no responde no tumba el reporte (P1).
 */
import { describe, expect, it } from 'vitest';
import { laTiendaEnLaSemana } from '../../scripts/lib/reporte-tienda.ts';

const AHORA = Date.parse('2026-10-26T13:00:00.000Z');
const BASES = { shards: ['tienda_c1_s1'], control: 'tienda_control', core: 'agro_core' };
const R2 = { uso: { espacio: 1.2, clase_a: 3.4, clase_b: 0.5 }, fallas: [] };

function d1(porBase: Record<string, Record<string, number> | 'falla'>) {
  const consultas: { base: string; sql: string; params: unknown[] }[] = [];
  const fetchFn = (async (url: string, init?: RequestInit) => {
    const lista = /\/d1\/database\?name=([^&]+)$/.exec(url);
    if (lista) {
      const nombre = decodeURIComponent(lista[1] ?? '');
      return Response.json({ result: [{ uuid: `id-${nombre}`, name: nombre }] });
    }
    const base = /\/d1\/database\/id-([^/]+)\/query$/.exec(url)?.[1] ?? '';
    const cuerpo = JSON.parse(String(init?.body)) as { sql: string; params: unknown[] };
    consultas.push({ base, ...cuerpo });
    const fila = porBase[base];
    if (!fila || fila === 'falla') return new Response('{}', { status: 500 });
    return Response.json({ result: [{ results: [fila] }] });
  }) as unknown as typeof fetch;
  return { consultas, fetchFn };
}

describe('la Tienda en el reporte semanal (HU-T14.7)', () => {
  it('CA1: tiendas, pedidos, cobros, pago real, soporte y costo del mes, con sus umbrales', async () => {
    const { fetchFn, consultas } = d1({
      tienda_c1_s1: {
        abiertas: 3,
        nuevas: 1,
        publicadas: 2,
        pedidos: 12,
        vendidos: 9,
        cobros: 4,
        sin_cerrar: 0,
      },
      agro_core: { tiendas: 5, pagaron: 1 },
      tienda_control: { atendidos: 2, minutos: 50 },
    });
    const s = await laTiendaEnLaSemana(fetchFn, 'token', 'cuenta', BASES, AHORA, R2);
    expect(s.titulo).toBe('Tienda');
    expect(s.lineas).toEqual([
      '- Tiendas abiertas: 3 (nuevas esta semana: 1; con su catálogo publicado: 2)',
      '- Pedidos de la semana: 12, de ellos vendidos: 9',
      expect.stringMatching(
        /^- Cobros en línea reales: 4 · sin estado final después de 24 horas: 0 \(umbral: Ningún caso fallido/,
      ),
      expect.stringMatching(
        /^- Pago real: 1 de 5 tiendas pagaron su plan \(umbral: Al menos 3 de cada 10/,
      ),
      expect.stringMatching(
        /^- Soporte: 50 minutos con 2 comercio\(s\), 25 por comercio \(umbral: Hasta 30 minutos/,
      ),
      expect.stringMatching(
        /^- Costo del mes: R2 usa espacio 1.2 %, escrituras 3.4 %, lecturas 0.5 % de lo gratis/,
      ),
      expect.stringMatching(/^- Umbrales de validación: todavía en propuesta/),
    ]);
    // La semana: los 7 días anteriores, y el soporte por día de Colombia.
    expect(consultas.find((c) => c.base === 'tienda_c1_s1')?.params).toEqual([
      '2026-10-19T13:00:00.000Z',
      '2026-10-25T13:00:00.000Z',
    ]);
    expect(consultas.find((c) => c.base === 'tienda_control')?.params).toEqual(['2026-10-19']);
  });

  it('❌ CA2: ninguna consulta lee un dato de una persona; solo cuenta', async () => {
    const { fetchFn, consultas } = d1({});
    await laTiendaEnLaSemana(fetchFn, 'token', 'cuenta', BASES, AHORA, R2);
    expect(consultas.length).toBeGreaterThan(0);
    for (const { sql } of consultas) {
      expect(sql).not.toMatch(/pedido_contacto|celular|correo|direccion|nombre|codigo|cifrado/i);
      // Cada columna que sale es un conteo o una suma.
      const columnas = [...sql.matchAll(/\)\s+AS\s+([a-z_]+)/gi)].length;
      const agregados = [...sql.matchAll(/(count|sum)\(/gi)].length;
      expect(agregados).toBeGreaterThanOrEqual(columnas);
    }
  });

  it('❌ una base que no responde lo dice, y lo demás sale igual (P1)', async () => {
    const { fetchFn } = d1({
      tienda_c1_s1: 'falla',
      agro_core: { tiendas: 0, pagaron: 0 },
      tienda_control: { atendidos: 0, minutos: 0 },
    });
    const s = await laTiendaEnLaSemana(fetchFn, 'token', 'cuenta', BASES, AHORA, {
      uso: {},
      fallas: ['operaciones: HTTP 403'],
    });
    expect(s.lineas).toEqual([
      '- Las tiendas: no se pudo leer (D1 respondió 500 (tienda_c1_s1)).',
      expect.stringMatching(/^- Pago real: 0 de 0 tiendas/),
      '- Soporte: nada anotado esta semana (se anota con el flujo «anotar-soporte-tienda»)',
      '- Costo del mes: no se pudo leer R2 (operaciones: HTTP 403).',
      expect.stringMatching(/^- Umbrales de validación/),
    ]);
    expect((await laTiendaEnLaSemana(fetchFn, '', 'cuenta', BASES, AHORA, R2)).lineas).toEqual([
      'No se pudo leer: falta el secreto CF_API_TOKEN.',
    ]);
  });
});
