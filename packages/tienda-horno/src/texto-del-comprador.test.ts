/**
 * HU-P1.5 (sprint PF3): el texto del comprador en la ficha y en el carrito. La etiqueta se escapa,
 * el campo lleva su largo y si es obligatorio; el carrito guarda un texto por línea, y uno que no se
 * lee no rompe la página. Ningún dato real.
 */
import { describe, expect, it } from 'vitest';
import { hornear, type ProductoParaHornear } from './horno.ts';
import { ACENTOS_DE_LA_VITRINA } from './tema.ts';
import { agregar, carritoVacio, leerCarrito } from './vitrina/carrito.ts';

const azar = (n: number) => new Uint8Array(n).fill(7);
const producto = (extra: Partial<ProductoParaHornear> = {}): ProductoParaHornear => ({
  slug: 'taza',
  nombre: 'Taza',
  opciones: [],
  variantes: [{ id: 'v-taza', clave: '', precioCop: 30000, stock: 5 }],
  actualizado: '2026-10-20T15:00:00.000Z',
  ...extra,
});
const ficha = async (p: ProductoParaHornear) =>
  (
    await hornear({
      dominio: 'ensayo-uno--staging.mitiendapro.co',
      release: 'r1',
      nombre: 'Comercio Ensayo Uno',
      apariencia: {
        acento: ACENTOS_DE_LA_VITRINA.cobre,
        tinta: 'negra',
        estilo: 'precision',
        portada: 'catalogo',
        proporcion: '1:1',
        modo: 'claro',
      },
      agentes: { search: 'yes', aiInput: 'yes', aiTrain: 'no' },
      productos: [p],
    })
  ).get('/p/taza/index.html')?.contenido ?? '';

describe('HU-P1.5 · el texto del comprador en la ficha', () => {
  it('con su etiqueta escapada, su largo y si es obligatorio', async () => {
    const html = await ficha(
      producto({ pideTexto: { etiqueta: 'Nombre <para> grabar', largo: 30, obligatorio: true } }),
    );
    expect(html).toContain('<label for="texto-del-comprador">Nombre &lt;para&gt; grabar</label>');
    expect(html).toContain('maxlength="30" autocomplete="off" required data-texto-del-comprador');
    const opcional = await ficha(
      producto({ pideTexto: { etiqueta: 'Mensaje', largo: 120, obligatorio: false } }),
    );
    expect(opcional).toContain('(opcional)');
    expect(opcional).not.toContain(' required ');
  });

  it('un producto que no lo pide no lleva el campo', async () => {
    expect(await ficha(producto())).not.toContain('data-texto-del-comprador');
  });

  it('el carrito guarda un texto por línea; el nuevo reemplaza al anterior', () => {
    const uno = agregar(carritoVacio(azar), 'v-taza', 1, { texto: '  Ana  ' }).carrito;
    expect(uno.lineas).toEqual([{ variante: 'v-taza', cantidad: 1, texto: 'Ana' }]);
    const dos = agregar(uno, 'v-taza', 1, { texto: 'Luis' }).carrito;
    expect(dos.lineas).toEqual([{ variante: 'v-taza', cantidad: 2, texto: 'Luis' }]);
    expect(leerCarrito(JSON.stringify(dos), null, azar).carrito.lineas).toEqual(dos.lineas);
    const largo = { ...dos, lineas: [{ variante: 'v-taza', cantidad: 1, texto: 'x'.repeat(201) }] };
    expect(leerCarrito(JSON.stringify(largo), null, azar).aviso).toBe('ilegible');
  });
});
