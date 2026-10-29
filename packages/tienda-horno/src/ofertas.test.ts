/**
 * HU-P1.4 (sprint PF3): la oferta programada en la vitrina. El horno no lee el reloj: con la hora
 * que llega como dato, la combinación muestra el precio con la oferta y el de siempre tachado; fuera
 * de sus días, o sin la hora, el de siempre (CA3). Ningún dato real.
 */
import { describe, expect, it } from 'vitest';
import { conLasOfertas, hornear, type TiendaParaHornear } from './horno.ts';
import { ACENTOS_DE_LA_VITRINA } from './tema.ts';

const tienda = (ahora?: string): TiendaParaHornear => ({
  dominio: 'ensayo-uno--staging.mitiendapro.co',
  release: 'r1',
  nombre: 'Comercio Ensayo Uno',
  ...(ahora ? { ahora } : {}),
  apariencia: {
    acento: ACENTOS_DE_LA_VITRINA.cobre,
    tinta: 'negra',
    estilo: 'precision',
    portada: 'catalogo',
    proporcion: '1:1',
    modo: 'claro',
  },
  agentes: { search: 'yes', aiInput: 'yes', aiTrain: 'no' },
  productos: [
    {
      slug: 'bolsa-de-tela',
      nombre: 'Bolsa de tela',
      opciones: [],
      variantes: [{ id: 'v-bolsa', clave: '', precioCop: 50000, precioAntesCop: 60000, stock: 5 }],
      actualizado: '2026-10-20T15:00:00.000Z',
      oferta: { porcentaje: 20, desde: '2026-11-07', hasta: '2026-11-08' },
    },
  ],
});
const precio = (t: TiendaParaHornear) => t.productos[0]?.variantes[0];

describe('HU-P1.4 · la oferta programada en la vitrina', () => {
  it('en sus días: el precio con la oferta y el de siempre tachado', async () => {
    const t = tienda('2026-11-07T05:00:00.000Z');
    expect(precio(conLasOfertas(t))).toMatchObject({ precioCop: 40000, precioAntesCop: 50000 });
    const ficha = (await hornear(t)).get('/p/bolsa-de-tela/index.html')?.contenido ?? '';
    expect(ficha).toContain('Antes <s>$50.000</s>');
    expect(ficha).toContain('$40.000');
  });

  it('fuera de sus días, o sin la hora, el de siempre: el horno no lee el reloj', () => {
    for (const ahora of ['2026-11-07T04:59:59.000Z', '2026-11-09T05:00:00.000Z', undefined])
      expect(precio(conLasOfertas(tienda(ahora)))).toMatchObject({
        precioCop: 50000,
        precioAntesCop: 60000,
      });
  });
});
