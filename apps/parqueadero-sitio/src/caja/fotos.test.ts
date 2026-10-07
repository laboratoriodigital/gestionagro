import { describe, expect, it } from 'vitest';
import { comprimir, type Lienzo } from './fotos.ts';

/** Un lienzo que da un tamaño por calidad y, como Safari, PNG cuando se le pide WebP. */
function lienzo(conWebp: boolean, tamano: (calidad: number) => number) {
  const pedidos: string[] = [];
  const falso: Lienzo = {
    toBlob(alTerminar, tipo, calidad) {
      pedidos.push(`${tipo}@${calidad}`);
      const real = tipo === 'image/webp' && !conWebp ? 'image/png' : tipo;
      alTerminar(new Blob([new Uint8Array(tamano(calidad))], { type: real }));
    },
  };
  return { falso, pedidos };
}

describe('la foto del vehículo (HU-Q3.3 CA1 y CA4)', () => {
  it('WebP de unos 100 KB donde el navegador lo produce', async () => {
    const { falso, pedidos } = lienzo(true, (c) => (c > 0.6 ? 180_000 : 90_000));
    const foto = await comprimir(falso);
    expect(foto.tipo).toBe('image/webp');
    expect(foto.datos.size).toBe(90_000);
    expect(pedidos).toEqual(['image/webp@0.7', 'image/webp@0.5']);
  });

  it('un toBlob que devuelve PNG, como Safari, guarda un JPEG con su formato real (CA4 ❌)', async () => {
    const { falso } = lienzo(false, () => 80_000);
    const foto = await comprimir(falso);
    expect(foto.tipo).toBe('image/jpeg');
    expect(foto.datos.type).toBe('image/jpeg');
  });

  it('si ni la calidad más baja llega, guarda la más liviana', async () => {
    const { falso } = lienzo(true, (c) => Math.round(c * 1_000_000));
    expect((await comprimir(falso)).datos.size).toBe(350_000);
  });
});
