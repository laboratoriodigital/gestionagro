/**
 * Validación del 20 oct 2026 en la vitrina: el precio de antes tachado, «Quedan N» y «Últimas
 * unidades», y las fotos que se pasan con el dedo en la tarjeta y con miniaturas en la ficha.
 * Ningún dato real.
 */
import { describe, expect, it } from 'vitest';
import {
  hornear,
  POCAS_UNIDADES,
  type ProductoParaHornear,
  type TiendaParaHornear,
} from './horno.ts';
import { ACENTOS_DE_LA_VITRINA } from './tema.ts';

const foto = (h: string) => ({
  huella: h.repeat(64),
  alt: '',
  ancho: 1600,
  alto: 1600,
  anchos: [400, 800, 1600],
});

const producto = (extra: Partial<ProductoParaHornear> = {}): ProductoParaHornear => ({
  slug: 'bolsa-de-tela',
  nombre: 'Bolsa de tela',
  opciones: [],
  variantes: [{ id: 'v-bolsa', clave: '', precioCop: 35000, precioAntesCop: 45000, stock: 2 }],
  actualizado: '2026-10-20T15:00:00.000Z',
  ...extra,
});

const tienda = (productos: ProductoParaHornear[]): TiendaParaHornear => ({
  dominio: 'ensayo-uno--staging.laboratorio-digital.app',
  release: 'r1',
  org: 'org-ensayo',
  medios: 'img--staging.laboratorio-digital.app',
  nombre: 'Comercio Ensayo Uno',
  apariencia: {
    acento: ACENTOS_DE_LA_VITRINA.cobre,
    tinta: 'azul',
    estilo: 'editorial',
    portada: 'catalogo',
    proporcion: '1:1',
    modo: 'telefono',
  },
  agentes: { search: 'yes', aiInput: 'yes', aiTrain: 'no' },
  productos,
});

describe('el precio de antes y las pocas unidades', () => {
  it('la ficha y la tarjeta tachan el precio de antes, y dicen cuántas quedan si son pocas', async () => {
    const a = await hornear(tienda([producto()]));
    const ficha = a.get('/p/bolsa-de-tela/index.html')?.contenido ?? '';
    expect(ficha).toContain('<p class="precio__antes" data-antes>Antes <s>$45.000</s></p>');
    expect(ficha).toContain('<p class="quedan" data-quedan>Quedan 2</p>');
    expect(ficha).toContain('"precioAntesCop":45000');
    expect(ficha).toContain('"quedan":2');
    const portada = a.get('/index.html')?.contenido ?? '';
    expect(portada).toContain('<span class="precio__antes">Antes <s>$45.000</s></span>');
    expect(portada).toContain('<span class="tarjeta__quedan">Últimas unidades</span>');
  });

  it('❌ un precio de antes igual o menor no se muestra, ni pocas unidades con existencias de sobra', async () => {
    const a = await hornear(
      tienda([
        producto({
          variantes: [
            {
              id: 'v-bolsa',
              clave: '',
              precioCop: 35000,
              precioAntesCop: 35000,
              stock: POCAS_UNIDADES + 1,
            },
          ],
        }),
      ]),
    );
    const ficha = a.get('/p/bolsa-de-tela/index.html')?.contenido ?? '';
    expect(ficha).toContain('<p class="precio__antes" data-antes hidden>');
    expect(ficha).toContain('<p class="quedan" data-quedan hidden>');
    expect(ficha).not.toContain('precioAntesCop');
    expect(a.get('/index.html')?.contenido).not.toContain('Últimas unidades');
  });

  it('❌ sin contar las existencias de alguna combinación, no son «últimas unidades»', async () => {
    const a = await hornear(
      tienda([
        producto({
          opciones: [{ nombre: 'Color', valores: ['Cruda', 'Negra'] }],
          variantes: [
            { id: 'v-cruda', clave: 'Cruda', precioCop: 35000, stock: 1 },
            { id: 'v-negra', clave: 'Negra', precioCop: 35000, stock: null },
          ],
        }),
      ]),
    );
    expect(a.get('/index.html')?.contenido).not.toContain('Últimas unidades');
  });
});

describe('las fotos', () => {
  it('con varias, la tarjeta deja pasarlas y la ficha trae miniaturas para elegir', async () => {
    const a = await hornear(tienda([producto({ fotos: [foto('a'), foto('b'), foto('c')] })]));
    const portada = a.get('/index.html')?.contenido ?? '';
    expect(portada).toContain('<span class="tarjeta__fotos">');
    expect(portada).toContain('<span class="tarjeta__cuantas">3 fotos</span>');
    // Solo la primera con prioridad; las demás cargan cuando se ven.
    expect(portada.match(/fetchpriority="high"/g)?.length ?? 0).toBeLessThanOrEqual(1);
    const ficha = a.get('/p/bolsa-de-tela/index.html')?.contenido ?? '';
    expect(ficha).toContain('<span class="ficha__foto" id="foto-2">');
    expect(ficha).toContain(
      '<nav class="ficha__miniaturas" aria-label="Fotos de Bolsa de tela"><a href="#foto-1" data-miniatura="0" aria-current="true" aria-label="Foto 1 de 3">',
    );
  });

  it('con una sola, ni tira ni miniaturas', async () => {
    const a = await hornear(tienda([producto({ fotos: [foto('a')] })]));
    expect(a.get('/index.html')?.contenido).not.toContain('tarjeta__fotos');
    expect(a.get('/p/bolsa-de-tela/index.html')?.contenido).not.toContain('ficha__miniaturas');
  });
});
