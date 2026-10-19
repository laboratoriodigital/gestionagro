/**
 * HU-T12.2 (WI-T12.2.2): `scripts/tienda/cargar.ts` revisa y, solo con `--aplicar`, aplica parte por
 * parte por la API del panel, con el token en una variable de entorno. Contra un panel de mentira.
 */
import { describe, expect, it } from 'vitest';
import { cargar } from '../../scripts/tienda/cargar.ts';

function panel(respuestas: { revisar: [number, object]; partes?: [number, object][] }) {
  const pedidas: { ruta: string; cuerpo: { parte?: number }; auth: string | null }[] = [];
  let parte = 0;
  const f = async (url: string, init?: RequestInit) => {
    const ruta = new URL(url).pathname;
    pedidas.push({
      ruta,
      cuerpo: JSON.parse(String(init?.body ?? '{}')) as { parte?: number },
      auth: new Headers(init?.headers).get('authorization'),
    });
    const [estado, cuerpo] = ruta.endsWith('/revisar')
      ? respuestas.revisar
      : (respuestas.partes?.[parte++] ?? [500, {}]);
    return Response.json(cuerpo, { status: estado });
  };
  return { f, pedidas };
}

const lineas = () => {
  const dichas: string[] = [];
  return { dichas, decir: (l: string) => dichas.push(l) };
};
const resumen = { productos: 2, variantes: 3, colecciones: 1, pedidos: 1, partes: 2, fotos: 1 };

describe('scripts/tienda/cargar.ts (HU-T12.2)', () => {
  it('sin --aplicar solo revisa: no pide aplicar nada', async () => {
    const p = panel({ revisar: [200, { ok: true, resumen }] });
    const l = lineas();
    const salida = await cargar({
      carga: {},
      panel: 'https://panel.test/',
      token: 't',
      aplicar: false,
      fetch: p.f,
      decir: l.decir,
    });
    expect(salida).toBe(0);
    expect(p.pedidas.map((x) => x.ruta)).toEqual(['/api/panel/v1/importar/revisar']);
    expect(p.pedidas[0]?.auth).toBe('Bearer t');
    expect(l.dichas.join('\n')).toContain('1 fotos para subir después de aplicar');
  });

  it('con --aplicar va parte por parte hasta que no sigue ninguna', async () => {
    const p = panel({
      revisar: [200, { ok: true, resumen }],
      partes: [
        [200, { ok: true, siguiente: 1 }],
        [200, { ok: true, siguiente: null }],
      ],
    });
    const salida = await cargar({
      carga: {},
      panel: 'https://panel.test',
      token: 't',
      aplicar: true,
      fetch: p.f,
      decir: () => undefined,
    });
    expect(salida).toBe(0);
    expect(p.pedidas.filter((x) => x.ruta.endsWith('/aplicar')).map((x) => x.cuerpo.parte)).toEqual(
      [0, 1],
    );
  });

  it('❌ con problemas los dice todos y no aplica', async () => {
    const p = panel({
      revisar: [
        422,
        {
          ok: false,
          problemas: [
            { campo: 'productos.0', mensaje: 'algo' },
            { campo: '', mensaje: 'otro' },
          ],
        },
      ],
    });
    const l = lineas();
    const salida = await cargar({
      carga: {},
      panel: 'https://panel.test',
      token: 't',
      aplicar: true,
      fetch: p.f,
      decir: l.decir,
    });
    expect(salida).toBe(1);
    expect(l.dichas).toEqual([
      '❌ El archivo tiene 2 problema(s):',
      '  - productos.0: algo',
      '  - (el archivo): otro',
    ]);
    expect(p.pedidas).toHaveLength(1);
  });

  it('❌ una parte que falla lo dice y se detiene', async () => {
    const p = panel({
      revisar: [200, { ok: true, resumen }],
      partes: [[500, { motivo: 'Esta parte no se aplicó' }]],
    });
    const l = lineas();
    const salida = await cargar({
      carga: {},
      panel: 'https://panel.test',
      token: 't',
      aplicar: true,
      fetch: p.f,
      decir: l.decir,
    });
    expect(salida).toBe(1);
    expect(l.dichas.at(-1)).toBe(
      '❌ La parte 1 no se aplicó (500: Esta parte no se aplicó). Vuelve a correr el comando.',
    );
  });
});

describe('scripts/tienda/cargar.ts: las fotos, después de aplicar (HU-T12.3)', () => {
  it('❌ CA3: si una foto falta, la carga queda aplicada, lo dice y sale con 1', async () => {
    const p = panel({
      revisar: [200, { ok: true, resumen: { ...resumen, partes: 1, fotos: 1 } }],
      partes: [[200, { ok: true, siguiente: null }]],
    });
    const l = lineas();
    const salida = await cargar({
      carga: {
        formato: 'tienda-import/1',
        tienda: { slug: 'ensayo-uno', nombre: 'Comercio Ensayo Uno' },
        ajustes: {},
        productos: [
          {
            refExterna: 'camisa',
            nombre: 'Camisa de lino',
            estado: 'activo',
            opciones: [],
            variantes: [{ valores: [], precioCop: 129000, stock: 3 }],
            medios: [{ url: 'https://fotos.test/no-esta.jpg', alt: 'Camisa de frente' }],
          },
        ],
      },
      panel: 'https://panel.test',
      token: 't',
      aplicar: true,
      fetch: async (url, init) =>
        url.startsWith('https://fotos.test/')
          ? new Response('no', { status: 404 })
          : p.f(url, init),
      decir: l.decir,
    });
    expect(salida).toBe(1);
    expect(l.dichas).toContain('✅ Tienda cargada.');
    expect(l.dichas).toContain(
      '  ❌ Camisa de lino (camisa): https://fotos.test/no-esta.jpg: no se pudo bajar (HTTP 404)',
    );
    expect(p.pedidas.map((x) => x.ruta)).toEqual([
      '/api/panel/v1/importar/revisar',
      '/api/panel/v1/importar/aplicar',
    ]);
  });
});
