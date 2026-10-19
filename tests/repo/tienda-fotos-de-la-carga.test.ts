/**
 * HU-T12.3: las fotos de una carga, con `sharp` de verdad (también en el trabajo `scripts-windows`,
 * CA2), un servidor de fotos y un panel de mentira. Lo que llega al panel es lo que mandaría el
 * teléfono: las derivadas, con el nombre por la huella del original.
 */
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { cargaTienda } from '../../packages/tienda-schema/src/carga.ts';
import { esDelFormato } from '../../packages/tienda-schema/src/medios.ts';
import { subirFotosDeLaCarga } from '../../scripts/tienda/fotos-de-la-carga.ts';

const carga = cargaTienda.parse({
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
      medios: [
        { url: 'https://fotos.test/buena.jpg', alt: 'Camisa de lino arena, de frente' },
        { url: 'https://fotos.test/no-esta.jpg', alt: 'La que no está' },
        { url: 'https://fotos.test/no-es-foto.jpg', alt: 'Un texto' },
        { url: 'https://fotos.test/chiquita.jpg', alt: 'Muy pequeña' },
      ],
    },
  ],
});

describe('scripts/tienda/fotos-de-la-carga.ts (HU-T12.3)', () => {
  it('CA1 y CA3: baja, hace las derivadas y las sube como el teléfono; las que fallan se dicen y las demás siguen', async () => {
    const original = await sharp({
      create: { width: 1800, height: 1200, channels: 3, background: '#c8b89a' },
    })
      .jpeg()
      .toBuffer();
    const chiquita = await sharp({
      create: { width: 300, height: 200, channels: 3, background: '#000000' },
    })
      .jpeg()
      .toBuffer();
    const recibidas: FormData[] = [];
    const fetchFalso = async (url: string, init?: RequestInit) => {
      if (url === 'https://fotos.test/buena.jpg') return new Response(new Uint8Array(original));
      if (url === 'https://fotos.test/chiquita.jpg') return new Response(new Uint8Array(chiquita));
      if (url === 'https://fotos.test/no-es-foto.jpg') return new Response('hola');
      if (url === 'https://panel.test/api/panel/v1/medios/subir') {
        expect(new Headers(init?.headers).get('authorization')).toBe('Bearer token-del-operador');
        recibidas.push(init?.body as FormData);
        return Response.json({ estado: 'guardado' });
      }
      return new Response('no', { status: 404 });
    };
    const dichas: string[] = [];
    const r = await subirFotosDeLaCarga({
      carga,
      panel: 'https://panel.test/',
      token: 'token-del-operador',
      fetch: fetchFalso,
      decir: (l) => void dichas.push(l),
    });
    expect(r).toEqual({ subidas: 1, faltaron: 3 });
    expect(dichas).toEqual([
      '  ❌ Camisa de lino (camisa): https://fotos.test/no-esta.jpg: no se pudo bajar (HTTP 404)',
      expect.stringMatching(
        /^ {2}❌ Camisa de lino \(camisa\): https:\/\/fotos\.test\/no-es-foto\.jpg: no se pudo abrir como foto/,
      ),
      '  ❌ Camisa de lino (camisa): https://fotos.test/chiquita.jpg: La foto mide 300 px de ancho: necesita al menos 400. Elige una más grande.',
      '⚠️ 1 fotos subidas; faltaron 3: vuelve a correr el comando cuando las arregles.',
    ]);
    const [f] = recibidas;
    if (!f) throw new Error('no llegó ninguna foto al panel');
    expect(f.get('producto')).toBe('imp-p-camisa');
    expect(f.get('huella')).toBe(createHash('sha256').update(original).digest('hex'));
    expect(f.get('alt')).toBe('Camisa de lino arena, de frente');
    expect([f.get('formato'), f.get('ancho'), f.get('alto')]).toEqual(['webp', '1800', '1200']);
    for (const ancho of [400, 800, 1600]) {
      const d = f.get(`d${ancho}`);
      if (!(d instanceof Blob)) throw new Error(`falta la derivada de ${ancho}`);
      const bytes = new Uint8Array(await d.arrayBuffer());
      expect(esDelFormato(bytes, 'webp'), `d${ancho}`).toBe(true);
      const m = await sharp(bytes).metadata();
      expect([m.width, m.height], `d${ancho}`).toEqual([ancho, Math.round((1200 * ancho) / 1800)]);
    }
    // El original no sale de la máquina: solo sus derivadas.
    expect([...f.keys()].sort()).toEqual(
      ['alt', 'alto', 'ancho', 'd1600', 'd400', 'd800', 'formato', 'huella', 'producto'].sort(),
    );
  });
});
