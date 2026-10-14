/**
 * HU-T4.3: la compuerta de publicación, sobre lo horneado de cada tienda. Una tienda completa pasa;
 * cada falta, una por una, la detiene con qué hacer y dónde, y todas salen a la vez (P15).
 */
import { ENSAYO_DOS } from '@ed1/tienda-schema/ensayos';
import { describe, expect, it } from 'vitest';
import { compuerta, type EntradaDeLaCompuerta, type ProductoParaLaCompuerta } from './compuerta.ts';
import { hornear, type TiendaParaHornear } from './horno.ts';

const AJUSTES = {
  identidad: { nombre: ENSAYO_DOS.nombre },
  contacto: { whatsapp: '+573000000002', whatsappVerificado: true },
  venta: { modo: 'whatsapp', formas: [{ forma: 'a_convenir' }] },
  legal: {
    razonSocial: 'Comercio Ensayo Dos',
    tipoPersona: 'natural',
    documento: { tipo: 'CC', numero: '1000000002' },
    direccionNotificacion: 'Calle de prueba 2',
    ciudad: 'Medellín',
    telefono: '+573000000002',
    correo: 'ensayo-dos@ejemplo.test',
  },
};

const PRODUCTOS: ProductoParaLaCompuerta[] = [
  {
    slug: 'pan-de-bono',
    nombre: 'Pan de bono',
    estado: 'activo',
    precioCop: 1500,
    fotos: 1,
    retracto: 'no_aplica',
    retractoMotivo: 'Alimento perecedero',
  },
];

async function entrada(
  cambios: Partial<EntradaDeLaCompuerta> = {},
  tienda: Partial<TiendaParaHornear> = {},
): Promise<EntradaDeLaCompuerta> {
  const archivos = await hornear({
    dominio: 'ensayo-dos--staging.laboratorio-digital.app',
    release: 'r1',
    nombre: ENSAYO_DOS.nombre,
    apariencia: {
      acento: '#5c5a17',
      tinta: 'negra',
      estilo: 'precision',
      portada: 'catalogo',
      proporcion: '1:1',
      modo: 'claro',
    },
    agentes: { search: 'yes', aiInput: 'yes', aiTrain: 'no' },
    productos: [
      {
        slug: 'pan-de-bono',
        nombre: 'Pan de bono',
        opciones: [],
        variantes: [{ id: 'v1', clave: '', precioCop: 1500, stock: null }],
        actualizado: '2026-10-13T15:00:00.000Z',
      },
    ],
    ...tienda,
  });
  return { ajustes: AJUSTES, productos: PRODUCTOS, archivos, ...cambios };
}

describe('la compuerta de publicación (HU-T4.3)', () => {
  it('una tienda completa pasa', async () => {
    expect(compuerta(await entrada())).toEqual({ ok: true, fallas: [] });
  });

  it.each([
    'razonSocial',
    'tipoPersona',
    'documento',
    'direccionNotificacion',
    'ciudad',
    'telefono',
    'correo',
  ])('❌ sin legal.%s no se publica, y dice qué hacer y dónde', async (campo) => {
    const { [campo as keyof typeof AJUSTES.legal]: _quitado, ...legal } = AJUSTES.legal;
    const r = compuerta(await entrada({ ajustes: { ...AJUSTES, legal } }));
    expect(r.ok).toBe(false);
    expect(r.fallas).toEqual([
      expect.objectContaining({ codigo: 'dato-faltante', donde: 'Ajustes › Datos legales' }),
    ]);
  });

  it('❌ un WhatsApp sin verificar', async () => {
    const r = compuerta(
      await entrada({ ajustes: { ...AJUSTES, contacto: { whatsapp: '+573000000002' } } }),
    );
    expect(r.fallas.map((f) => f.mensaje)).toEqual([
      'Confirma tu WhatsApp con el mensaje de prueba',
    ]);
  });

  it('❌ un corchete en un texto público', async () => {
    const r = compuerta(await entrada({}, { frase: 'El mejor [pan] de la ciudad' }));
    expect(r.fallas.map((f) => f.codigo)).toEqual(['texto-de-fabrica']);
  });

  it('❌ un producto activo sin foto, y uno sin retracto ni motivo', async () => {
    const r = compuerta(
      await entrada({
        productos: [{ ...PRODUCTOS[0], fotos: 0, retractoMotivo: ' ' } as ProductoParaLaCompuerta],
      }),
    );
    expect(r.fallas.map((f) => f.codigo).sort()).toEqual(['retracto', 'sin-foto']);
  });

  it('❌ ningún producto activo con precio', async () => {
    const r = compuerta(
      await entrada({
        productos: [{ ...PRODUCTOS[0], estado: 'borrador' } as ProductoParaLaCompuerta],
      }),
    );
    expect(r.fallas.map((f) => f.codigo)).toEqual(['sin-producto']);
  });

  it('❌ el pago en línea, mientras el cobro no exista (M3)', async () => {
    const r = compuerta(
      await entrada({
        ajustes: { ...AJUSTES, venta: { modo: 'ambos', formas: [{ forma: 'a_convenir' }] } },
      }),
    );
    expect(r.fallas.map((f) => f.codigo)).toEqual(['pago-en-linea']);
  });

  it('❌ un envío de más de 30 días que no lo dice', async () => {
    const r = compuerta(
      await entrada({
        envios: [{ nombre: 'Internacional', plazoDias: 45, texto: 'Llega pronto' }],
      }),
    );
    expect(r.fallas.map((f) => f.codigo)).toEqual(['envio']);
    expect(
      compuerta(
        await entrada({
          envios: [{ nombre: 'Internacional', plazoDias: 45, texto: 'Llega en 45 días' }],
        }),
      ).ok,
    ).toBe(true);
  });

  it('❌ un enlace interno roto o un pie sin la SIC', async () => {
    const base = await entrada();
    const archivos = new Map(base.archivos);
    const portada = archivos.get('/index.html');
    if (!portada) throw new Error('sin portada');
    archivos.set('/index.html', {
      ...portada,
      contenido: portada.contenido
        .replace('href="https://www.sic.gov.co"', 'href="https://ejemplo.test"')
        .replace('<main>', '<main><a href="/p/no-existe/">x</a>'),
    });
    expect(
      compuerta({ ...base, archivos })
        .fallas.map((f) => f.codigo)
        .sort(),
    ).toEqual(['enlace-roto', 'pie-legal']);
  });

  it('todas las fallas salen a la vez (P15)', async () => {
    const r = compuerta(await entrada({ ajustes: {}, productos: [] }, { frase: '{{frase}}' }));
    expect(r.fallas.length).toBeGreaterThan(8);
  });

  it('lo que se omite tiene nombre, y solo eso se omite', async () => {
    const sinFoto = [{ ...PRODUCTOS[0], fotos: 0 } as ProductoParaLaCompuerta];
    expect(compuerta(await entrada({ productos: sinFoto, omitir: ['sin-foto'] })).ok).toBe(true);
    expect(compuerta(await entrada({ productos: sinFoto, omitir: ['retracto'] })).ok).toBe(false);
  });
});
