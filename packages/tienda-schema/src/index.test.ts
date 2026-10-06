import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACCIONES,
  accionesDeAjuste,
  aVersionVigente,
  type CargaTienda,
  decidir,
  ESQUEMAS,
  faltantes,
  MATRIZ,
  puede,
  revisarCarga,
  SECCIONES,
  seccionesParaHornear,
  VersionSinTraductor,
  validarSeccion,
} from './index.ts';

const SQL = readFileSync(
  join(import.meta.dirname, '../../../docs/tienda/sql/tienda/0001_tienda_v1.sql'),
  'utf8',
);

describe('las secciones de ajustes (TIENDA-3.0 §5.7)', () => {
  it('son las de ref_seccion_ajuste de la migración, con el mismo «publica» (P2)', () => {
    const insert =
      /INSERT INTO ref_seccion_ajuste \(id, publica\) VALUES([\s\S]*?);/.exec(SQL)?.[1] ?? '';
    const enSql = Object.fromEntries(
      [...insert.matchAll(/\('(\w+)', ([01])\)/g)].map((m) => [m[1], m[2] === '1']),
    );
    expect(Object.keys(enSql).length).toBeGreaterThan(0);
    expect(Object.fromEntries(Object.entries(SECCIONES).map(([s, v]) => [s, v.publica]))).toEqual(
      enSql,
    );
  });

  it('❌ vacío nunca es un valor de fábrica: contacto y legal no traen nada por defecto', () => {
    expect(ESQUEMAS.contacto[1].parse({})).toEqual({ whatsappVerificado: false });
    expect(ESQUEMAS.legal[1].parse({})).toEqual({});
    expect(ESQUEMAS.identidad[1].parse({})).toEqual({});
  });

  it('solo el aspecto y las señales para agentes tienen preferencias por defecto (D-T6)', () => {
    expect(ESQUEMAS.agentes[1].parse({})).toMatchObject({
      search: 'yes',
      aiInput: 'yes',
      aiTrain: 'no',
    });
    expect(ESQUEMAS.apariencia[1].parse({}).estilo).toBe('precision');
  });

  it('todos los problemas de una sección a la vez, con su campo (P15)', () => {
    const r = validarSeccion('legal', {
      telefono: '3001234567',
      correo: 'no-es-correo',
      documento: { tipo: 'RUT', numero: '1' },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const campos = r.problemas.map((p) => p.campo);
      expect(campos).toEqual(
        expect.arrayContaining([
          'legal.telefono',
          'legal.correo',
          'legal.documento.tipo',
          'legal.documento.numero',
        ]),
      );
    }
  });

  it('un WhatsApp que no es un celular de Colombia no se guarda', () => {
    expect(validarSeccion('contacto', { whatsapp: '+573001234567' }).ok).toBe(true);
    expect(validarSeccion('contacto', { whatsapp: '3001234567' }).ok).toBe(false);
    expect(validarSeccion('contacto', { whatsapp: '+5760012345' }).ok).toBe(false);
  });
});

describe('lo que falta para publicar (TIENDA-3.0 §10.2)', () => {
  const completo = {
    identidad: { nombre: 'Comercio Ensayo Dos' },
    venta: { modo: 'whatsapp', formas: [{ forma: 'a_convenir' }] },
    contacto: { whatsapp: '+573001234567', whatsappVerificado: true },
    legal: {
      razonSocial: 'Comercio Ensayo Dos S.A.S.',
      tipoPersona: 'juridica',
      documento: { tipo: 'NIT', numero: '900123456-7' },
      direccionNotificacion: 'Calle 1 # 2-3',
      ciudad: 'Medellín',
      telefono: '+576041234567',
      correo: 'hola@ensayo-dos.test',
    },
  };

  it('una tienda completa no tiene faltantes', () => {
    expect(faltantes(completo)).toEqual([]);
  });

  it('❌ sin nada, dice todo lo que falta, campo por campo', () => {
    expect(faltantes({})).toEqual([
      'identidad.nombre',
      'venta.modo',
      'venta.formas',
      'legal.razonSocial',
      'legal.tipoPersona',
      'legal.documento',
      'legal.direccionNotificacion',
      'legal.ciudad',
      'legal.telefono',
      'legal.correo',
    ]);
  });

  it('❌ con el modo WhatsApp, un número sin verificar detiene la publicación', () => {
    const sinVerificar = {
      ...completo,
      contacto: { whatsapp: '+573001234567', whatsappVerificado: false },
    };
    expect(faltantes(sinVerificar)).toEqual(['contacto.whatsappVerificado']);
    expect(faltantes({ ...completo, contacto: {} })).toEqual(['contacto.whatsapp']);
    expect(
      faltantes({
        ...completo,
        venta: { modo: 'en_linea', formas: [{ forma: 'en_linea' }] },
        contacto: {},
      }),
    ).toEqual([]);
  });

  it('❌ cobro y avisos nunca se hornean: los datos de la transferencia no llegan al sitio', () => {
    const ajustes = {
      identidad: { nombre: 'x' },
      cobro: { transferencia: { numero: '123456' } },
      avisos: { correo: 'a@b.co' },
    };
    const h = seccionesParaHornear(ajustes);
    expect(Object.keys(h)).toEqual(['identidad']);
    expect(JSON.stringify(h)).not.toContain('123456');
  });
});

describe('versiones de una sección', () => {
  it('traduce paso a paso con los traductores dados', () => {
    const traductores = {
      contacto: { 1: (d: Record<string, unknown>) => ({ ...d, nuevo: null }) },
    };
    expect(aVersionVigente('contacto', 1, { horario: 'x' }, traductores, 2)).toEqual({
      horario: 'x',
      nuevo: null,
    });
  });

  it('❌ si falta un paso, lanza en vez de inventar', () => {
    expect(() => aVersionVigente('contacto', 1, {}, {}, 2)).toThrow(VersionSinTraductor);
  });

  it('hoy todo está en la versión 1 y no hay nada que traducir', () => {
    expect(aVersionVigente('legal', 1, { ciudad: 'Cali' })).toEqual({ ciudad: 'Cali' });
  });
});

describe('la matriz de permisos (TIENDA-3.0 §12.1)', () => {
  it('el propietario puede todo', () => {
    for (const a of ACCIONES) expect(puede('propietario', a)).toBe(true);
  });

  it('❌ el colaborador no toca cobro, dominio, equipo, plan, datos personales ni el modo', () => {
    for (const a of [
      'cobro.gestionar',
      'dominios.gestionar',
      'equipo.gestionar',
      'plan.gestionar',
      'exportar.datos_personales',
      'titular.gestionar',
      'ajustes.modo_pedido',
    ]) {
      expect(puede('colaborador', a), a).toBe(false);
    }
    expect(puede('colaborador', 'pedidos.gestionar')).toBe(true);
    expect(puede('colaborador', 'publicar')).toBe(true);
  });

  it('❌ lo que no está en la matriz está negado', () => {
    expect(puede('colaborador', 'borrar.todo')).toBe(false);
    expect(puede('operario', 'pedidos.ver')).toBe(false);
    expect(Object.keys(MATRIZ)).toEqual([...ACCIONES]);
  });

  it('lo que mueve la plata pide haber entrado hace menos de 10 minutos (§12.3)', () => {
    const ahora = 1_800_000_000;
    expect(decidir('propietario', 'cobro.gestionar', ahora - 600, ahora)).toBe('permitido');
    expect(decidir('propietario', 'cobro.gestionar', ahora - 601, ahora)).toBe('reautenticar');
    expect(decidir('propietario', 'catalogo.editar', ahora - 100_000, ahora)).toBe('permitido');
    expect(decidir('colaborador', 'cobro.gestionar', ahora, ahora)).toBe('prohibido');
    expect(decidir('propietario', 'cobro.gestionar', ahora + 60, ahora)).toBe('reautenticar');
  });

  it('cambiar el WhatsApp o el modo pide más que cambiar el horario', () => {
    expect(
      accionesDeAjuste('contacto', { whatsapp: '+573001' }, { whatsapp: '+573001', horario: 'x' }),
    ).toEqual(['ajustes.editar']);
    expect(
      accionesDeAjuste('contacto', { whatsapp: '+573001' }, { whatsapp: '+573002' }),
    ).toContain('ajustes.contacto');
    expect(accionesDeAjuste('venta', undefined, { modo: 'en_linea' })).toContain(
      'ajustes.modo_pedido',
    );
    expect(accionesDeAjuste('cobro', {}, {})).toEqual(['cobro.gestionar']);
  });
});

describe('el formato de carga (TIENDA-3.0 §17.1)', () => {
  const base = (): Record<string, unknown> => ({
    formato: 'tienda-import/1',
    tienda: { slug: 'ensayo-uno', nombre: 'Comercio Ensayo Uno' },
    ajustes: { identidad: { nombre: 'Comercio Ensayo Uno' } },
    colecciones: [{ refExterna: 'C1', nombre: 'Vestidos', slug: 'vestidos' }],
    productos: [
      {
        refExterna: 'P001',
        nombre: 'Vestido',
        estado: 'activo',
        opciones: [
          { nombre: 'Talla', valores: ['S', 'M'] },
          { nombre: 'Color', valores: ['Rosa'] },
        ],
        variantes: [
          { valores: ['S', 'Rosa'], sku: 'VS-S', precioCop: 80_000, stock: 3 },
          {
            valores: ['M', 'Rosa'],
            sku: 'VS-M',
            precioCop: 80_000,
            precioAntesCop: 95_000,
            stock: null,
          },
        ],
        medios: [{ url: 'https://fotos.ejemplo.test/vestido.webp', alt: 'Vestido rosa' }],
        colecciones: ['C1'],
      },
    ],
  });

  it('una carga bien hecha pasa, con sus valores por defecto explícitos', () => {
    const r = revisarCarga(base());
    expect(r.ok).toBe(true);
    if (r.ok) {
      const p = (r.carga as CargaTienda).productos[0];
      expect(p?.retracto).toEqual({ aplica: true });
      expect(r.carga.pedidos).toEqual([]);
    }
    expect(revisarCarga({ ...base(), formato: 'tienda-export/1' }).ok).toBe(true);
  });

  it('❌ todos los problemas cruzados de una vez (P15)', () => {
    const c = base();
    const productos = c['productos'] as Array<Record<string, unknown>>;
    const p = productos[0] as Record<string, unknown>;
    p['colecciones'] = ['C9'];
    p['variantes'] = [
      { valores: ['S'], sku: 'X', precioCop: 1000, stock: 1 },
      { valores: ['XL', 'Rosa'], sku: 'X', precioCop: 1000, precioAntesCop: 900, stock: 1 },
    ];
    const r = revisarCarga(c);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const textos = r.problemas.map((x) => x.mensaje).join(' | ');
      expect(textos).toContain('el SKU X está repetido');
      expect(textos).toContain('tiene 1 valores y el producto 2 grupos');
      expect(textos).toContain('«XL» no es un valor de «Talla»');
      expect(textos).toContain('precio «antes»');
      expect(textos).toContain('la colección C9 no está');
    }
  });

  it('❌ no se cargan llaves ni la sección de cobro', () => {
    const c = base();
    c['ajustes'] = { cobro: { ambiente: 'produccion' } };
    const r = revisarCarga(c);
    expect(r.ok).toBe(false);
  });

  it('❌ un pedido histórico con datos personales no entra', () => {
    const c = base();
    c['pedidos'] = [
      {
        codigo: 'A2B3C4',
        creado: '2026-09-01T15:00:00Z',
        estado: 'entregado',
        formaPago: 'a_convenir',
        lineas: [{ nombre: 'Pan', precioCop: 5000, cantidad: 2 }],
        totales: { subtotal: 10_000, descuento: 0, envio: 0, total: 10_000 },
        contacto: { nombre: 'María' },
      },
    ];
    expect(revisarCarga(c).ok).toBe(false);
  });

  it('❌ un precio de 0, un slug con «--» o un código con letras ambiguas no entran', () => {
    const conPrecioCero = base();
    const pc = (conPrecioCero['productos'] as Array<Record<string, unknown>>)[0] as Record<
      string,
      unknown
    >;
    pc['variantes'] = [{ valores: ['S', 'Rosa'], precioCop: 0, stock: 1 }];
    expect(revisarCarga(conPrecioCero).ok).toBe(false);
    expect(revisarCarga({ ...base(), tienda: { slug: 'ensayo--uno', nombre: 'x' } }).ok).toBe(
      false,
    );
    const conCodigo = base();
    conCodigo['pedidos'] = [
      {
        codigo: 'ABCDIL',
        creado: '2026-09-01T15:00:00Z',
        estado: 'entregado',
        formaPago: 'efectivo',
        lineas: [{ nombre: 'Pan', precioCop: 5000, cantidad: 1 }],
        totales: { subtotal: 5000, descuento: 0, envio: 0, total: 5000 },
      },
    ];
    expect(revisarCarga(conCodigo).ok).toBe(false);
  });
});
