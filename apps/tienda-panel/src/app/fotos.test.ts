/**
 * HU-T8.3: las derivadas se hacen en el teléfono. `codificar` es de mentira: aquí no hay canvas, y
 * así se puede ser Safari, que devuelve PNG cuando se le pide WebP (CA3).
 */
import { describe, expect, it } from 'vitest';
import { type Codificar, derivar, FotoInvalida, formularioDeFoto } from './fotos.ts';

/** Un navegador que codifica lo que sabe: lo demás lo devuelve en PNG, como `toBlob`. */
const navegador =
  (sabe: string[], pedidos: string[] = []): Codificar =>
  async (ancho, alto, tipo) => {
    pedidos.push(`${ancho}x${alto} ${tipo}`);
    return new Blob([new Uint8Array(10)], { type: sabe.includes(tipo) ? tipo : 'image/png' });
  };

describe('las derivadas de una foto', () => {
  it('CA1: 400, 800 y 1600 px en WebP, con la proporción del original', async () => {
    const r = await derivar({ ancho: 3000, alto: 4000 }, navegador(['image/webp', 'image/jpeg']));
    expect(r.formato).toBe('webp');
    expect(r.derivadas.map((d) => [d.ancho, d.alto, d.blob.type])).toEqual([
      [400, 533, 'image/webp'],
      [800, 1067, 'image/webp'],
      [1600, 2133, 'image/webp'],
    ]);
  });

  it('CA1: solo las que alcanza el original; uno de menos de 400 px se rechaza con palabras', async () => {
    const r = await derivar({ ancho: 900, alto: 900 }, navegador(['image/webp']));
    expect(r.derivadas.map((d) => d.ancho)).toEqual([400, 800]);
    await expect(derivar({ ancho: 320, alto: 480 }, navegador(['image/webp']))).rejects.toThrow(
      FotoInvalida,
    );
  });

  it('❌ CA3: con un `toBlob` que devuelve PNG (Safari), todo sale en JPEG, nunca un «.webp» que no lo es', async () => {
    const pedidos: string[] = [];
    const r = await derivar({ ancho: 2000, alto: 1000 }, navegador(['image/jpeg'], pedidos));
    expect(r.formato).toBe('jpeg');
    expect(r.derivadas.every((d) => d.blob.type === 'image/jpeg')).toBe(true);
    const f = formularioDeFoto({
      producto: 'p-camisa',
      huella: 'a'.repeat(64),
      alt: 'Camisa',
      original: { ancho: 2000, alto: 1000 },
      derivadas: r,
    });
    expect(f.get('formato')).toBe('jpeg');
    expect((f.get('d400') as File).name).toBe('400.jpeg');
    expect((f.get('d400') as File).type).toBe('image/jpeg');
    // Pidió WebP una vez, vio PNG y no siguió pidiéndolo.
    expect(pedidos).toEqual([
      '400x200 image/webp',
      '400x200 image/jpeg',
      '800x400 image/jpeg',
      '1600x800 image/jpeg',
    ]);
  });

  it('❌ un navegador que no hace ni WebP ni JPEG no sube nada', async () => {
    await expect(derivar({ ancho: 800, alto: 800 }, navegador([]))).rejects.toThrow(
      /no pudo comprimir/,
    );
  });
});
