import { formatearPesos } from '@ed1/dinero';
import { htmlDeBloques, lineasDeHoja } from '@ed1/impresion';
import type { Registro, Sede } from '@ed1/parqueadero-schema';
import {
  AJUSTE_ENSAYO,
  ENTRADA_ENSAYO,
  SALIDA_ENSAYO,
  SEDE_ENSAYO_DOS,
  SEDE_ENSAYO_UNO,
  TARIFA_CARRO,
  TARIFA_MOTO,
} from '@ed1/parqueadero-schema/ensayos';
import { describe, expect, it } from 'vitest';
import {
  armarRecibo,
  enlaceCompleto,
  enlaceCorto,
  faltantesDeSede,
  fechaHora,
  leerEnlace,
  lineasDePapel,
  nombresDeCampos,
  pantalla,
  papel,
  type Recibo,
  ReciboIncompleto,
  TEXTO_LEGAL,
  textoDeResponsabilidad,
  textoWhatsApp,
} from './index.ts';

const COLUMNAS = 32;

/** Entrada de moto con dos novedades y su salida con noche, redondeo y datáfono. */
const ENTRADA_MOTO: Registro = {
  ...ENTRADA_ENSAYO,
  id: '0199bc3e-3b40-7000-8000-000000000111',
  estadia_id: '0199bc3e-3b40-7000-8000-000000000111',
  instante_evento: '2026-10-07T00:00:00.000Z',
  consecutivo: 7,
  datos: {
    placa: 'XYZ12A',
    vehiculo: 'moto',
    placa_confirmada: false,
    novedades: [
      { tipo: 'espejo', parte: 'izquierdo', nota: 'roto' },
      { tipo: 'otro', parte: null, nota: 'casco en la maleta' },
    ],
    foto_ids: [],
    tarifa_id: TARIFA_MOTO.id,
    tarifa_version: 1,
    abonado_id: null,
  },
};

const SALIDA_MOTO: Registro = {
  ...SALIDA_ENSAYO,
  id: '0199bcf1-5a80-7000-8000-000000000112',
  estadia_id: ENTRADA_MOTO.id,
  instante_evento: '2026-10-07T12:00:00.000Z',
  consecutivo: 8,
  datos: {
    entrada_numero: 'A-000007',
    placa: 'XYZ12A',
    vehiculo: 'moto',
    instante_entrada: '2026-10-07T00:00:00.000Z',
    minutos: 720,
    lineas: [
      { concepto: 'tiempo', minutos: 60, base: 3_600, valor: 3_600 },
      { concepto: 'nocturna', minutos: 570, base: 8_000, valor: 8_000 },
      { concepto: 'tiempo', minutos: 90, base: 5_400, valor: 5_400 },
    ],
    subtotal: 17_000,
    redondeo: 0,
    total: 17_000,
    medio_pago: 'datafono',
    recibido: null,
    cambio: null,
    motivo_cortesia: null,
    perdido: false,
    tarifa_id: TARIFA_MOTO.id,
    tarifa_version: 1,
  },
};

const catalogos = (sede: Sede, tarifa = TARIFA_CARRO) => ({ sede, tarifa, ajuste: AJUSTE_ENSAYO });

/** Los recibos de prueba: entrada y salida de Ensayo Uno (con póliza) y Ensayo Dos (sin). */
const RECIBOS: readonly [string, Recibo][] = [
  [
    'entrada de Ensayo Uno',
    armarRecibo(ENTRADA_ENSAYO, catalogos(SEDE_ENSAYO_UNO), { prueba: false }),
  ],
  [
    'salida de Ensayo Uno',
    armarRecibo(SALIDA_ENSAYO, catalogos(SEDE_ENSAYO_UNO), { prueba: false }),
  ],
  [
    'entrada de moto de Ensayo Dos',
    armarRecibo(ENTRADA_MOTO, catalogos(SEDE_ENSAYO_DOS, TARIFA_MOTO), { prueba: true }),
  ],
  [
    'salida de moto de Ensayo Dos',
    armarRecibo(SALIDA_MOTO, catalogos(SEDE_ENSAYO_DOS, TARIFA_MOTO), { prueba: true }),
  ],
];

/** El elemento `i` de una lista de prueba; lanza si no está, en vez de `!`. */
function en<T>(lista: readonly T[], i: number): T {
  const x = lista[i];
  if (x === undefined) throw new Error(`No hay elemento ${i}`);
  return x;
}

const textoDePapel = (r: Recibo, pagina: 'cp850' | 'transliterar' = 'cp850') =>
  lineasDePapel(
    papel(r, {
      columnas: COLUMNAS,
      paginaDeCodigos: pagina,
      qr: r.clase === 'entrada' ? enlaceCorto(r) : null,
    }),
    COLUMNAS,
  );

describe('la maqueta de §6.2 y del anexo B', () => {
  it('el recibo de entrada', () => {
    expect(textoDePapel(en(RECIBOS, 0)[1], 'transliterar')).toEqual([
      'PARQUEADERO ENSAYO UNO',
      'NIT 900.000.000-0',
      'Tel 3000000000',
      'Calle 1 # 2-3, Bogota',
      '-'.repeat(32),
      'RECIBO DE ENTRADA       A-000123',
      '06/10/2026 18:05',
      'Placa ABC123               Carro',
      'Estado: rayon puerta trasera',
      'derecha',
      '-'.repeat(32),
      'Tarifa: $230 por minuto',
      'Gracia: 5 min',
      'Tope por dia: $30.000',
      'Tope legal: $230 por minuto',
      'Poliza: Aseguradora 0000000',
      '-'.repeat(32),
      `[QR https://parqueadero.laboratorio-digital.app/r/#c.A-000123.ABC123.c.${Date.UTC(2026, 9, 6, 23, 5) / 1000}]`,
      'Codigo para la salida',
      '-'.repeat(32),
      'Conserve este recibo. El',
      'parqueadero responde por el',
      'vehiculo (Ley 1480, art. 18).',
      'Lunes a viernes 5:30 a 20:00',
      'Pida su recibo por WhatsApp.',
    ]);
  });

  it('el recibo de salida', () => {
    expect(textoDePapel(en(RECIBOS, 1)[1], 'transliterar')).toEqual([
      'PARQUEADERO ENSAYO UNO',
      'NIT 900.000.000-0',
      'Tel 3000000000',
      'Calle 1 # 2-3, Bogota',
      '-'.repeat(32),
      'RECIBO DE SALIDA        A-000124',
      'Entrada A-000123',
      'Placa ABC123               Carro',
      'Entro           06/10/2026 18:05',
      'Salio           06/10/2026 21:05',
      'Tiempo                   180 min',
      '-'.repeat(32),
      'Por 180 min              $41.400',
      'Tope por dia aplicado    $30.000',
      'TOTAL                    $30.000',
      'Pago: efectivo',
      'Recibido $50.000  Cambio $20.000',
      '-'.repeat(32),
      'Poliza: Aseguradora 0000000',
      'Este recibo no es factura.',
      'Lunes a viernes 5:30 a 20:00',
      'Pida su recibo por WhatsApp.',
    ]);
  });
});

/** La hoja del diálogo del sistema (HU-Q2.5): los mismos bloques del papel, en HTML. */
const textoDeHoja = async (r: Recibo) =>
  lineasDeHoja(
    await htmlDeBloques(
      papel(r, {
        columnas: COLUMNAS,
        paginaDeCodigos: 'cp850',
        qr: r.clase === 'entrada' ? enlaceCorto(r) : null,
      }),
      { paginaDeCodigos: 'cp850', qr: 'imagen', columnas: COLUMNAS, avanceFinal: 0 },
    ),
  );

describe('los campos de la ley en cada salida (HU-Q1.4 CA1, §6.1; HU-Q2.5 CA3)', () => {
  // La hoja HTML pasa la misma prueba que el papel: es otra salida del mismo recibo (HU-Q2.5 CA3).
  it.each(
    RECIBOS.flatMap(([nombre, r]) => [
      [`${nombre} · papel`, r, 'papel'] as const,
      [`${nombre} · hoja del sistema`, r, 'hoja'] as const,
    ]),
  )('%s', async (_, r, impreso) => {
    const papelTexto = (impreso === 'papel' ? textoDePapel(r) : await textoDeHoja(r)).join('\n');
    const enlace = await enlaceCompleto(r);
    const leido = await leerEnlace(enlace);
    const whatsapp = textoWhatsApp(r, enlace);
    const vista = pantalla(r);
    const pantallaTexto = vista.filas.map((f) => f.join(': ')).join('\n');
    const s = r.sede;
    const hora = fechaHora(r.entrada);

    // Del prestador: todo en papel y pantalla, el nombre en WhatsApp; el enlace lleva el recibo entero.
    for (const campo of [s.nit, s.telefono, s.direccion]) {
      expect(papelTexto).toContain(campo);
      expect(pantallaTexto).toContain(campo);
    }
    expect(papelTexto).toContain(s.nombre.toUpperCase());
    expect(whatsapp).toContain(s.nombre);
    expect(leido.forma === 'completa' && leido.recibo).toEqual(r);
    for (const texto of [papelTexto, whatsapp, vista.titulo]) {
      expect(texto).toContain(r.numero);
    }
    for (const texto of [papelTexto, whatsapp, pantallaTexto]) {
      expect(texto).toContain(hora);
      expect(texto).toContain(r.placa);
    }
    if (r.clase === 'entrada') {
      for (const e of r.estado) expect(papelTexto.replaceAll('\n', ' ')).toContain(e);
      expect(whatsapp).toContain('Estado:');
      expect(papelTexto).toContain(`Tarifa: ${formatearPesos(r.tarifa.valor)}`);
      expect(whatsapp).toContain(`Tarifa: ${formatearPesos(r.tarifa.valor)}`);
      expect(papelTexto).toContain('Ley 1480');
    } else {
      const sa = r.salida;
      if (!sa) throw new Error('una salida sin salida');
      for (const texto of [papelTexto, whatsapp, pantallaTexto]) {
        expect(texto).toContain(fechaHora(sa.instante));
        expect(texto).toContain(`${sa.minutos} min`);
        expect(texto).toContain(formatearPesos(sa.total));
      }
      expect(papelTexto).toContain('Pago:');
      expect(whatsapp).toContain('Pago:');
      expect(papelTexto).toContain('no es factura');
    }
    // La póliza, si la sede la tiene (Decreto 461 de 2019).
    if (s.poliza) {
      expect(papelTexto).toContain(s.poliza.numero);
      expect(pantallaTexto).toContain(s.poliza.numero);
    } else {
      expect(papelTexto).not.toContain('Póliza');
    }
    expect(whatsapp).toContain('\nSu recibo:\nhttps://');
  });
});

describe('paridad (HU-Q1.4 CA2, §6.6)', () => {
  it.each(RECIBOS)('%s: papel, enlace y WhatsApp dicen lo mismo', async (_, r) => {
    const enlace = await enlaceCompleto(r);
    const leido = await leerEnlace(enlace);
    if (leido.forma !== 'completa') throw new Error('debía ser la forma completa');
    const papelTexto = textoDePapel(r).join('\n');
    const whatsapp = textoWhatsApp(r, enlace);
    const d = leido.recibo;
    const total = d.salida ? formatearPesos(d.salida.total) : null;
    for (const texto of [papelTexto, whatsapp]) {
      expect(texto).toContain(d.numero);
      expect(texto).toContain(d.placa);
      expect(texto).toContain(fechaHora(d.entrada));
      if (total) expect(texto).toContain(total);
    }
  });
});

describe('32 columnas y sin basura (HU-Q1.4 CA2)', () => {
  const LARGA: Sede = {
    ...SEDE_ENSAYO_UNO,
    nombre: 'Parqueadero Ensayo Uno de Nombre Más Lar',
    direccion: 'Avenida Carrera 68 # 100-200 Interior 4 Bodega 12 Sótano B',
    ciudad: 'San José de Cúcuta Norte de S',
    poliza: { aseguradora: 'Aseguradora Ñandú del Pacífico', numero: 'POL-2026-000000123456789' },
  };
  const largos = [
    ...RECIBOS.map(([, r]) => r),
    armarRecibo(ENTRADA_MOTO, catalogos(LARGA, TARIFA_MOTO), { prueba: false }),
    armarRecibo(SALIDA_MOTO, catalogos(LARGA, TARIFA_MOTO), { prueba: false }),
  ];

  it.each(['cp850', 'transliterar'] as const)('ninguna línea pasa de 32 con %s', (pagina) => {
    for (const r of largos) {
      for (const linea of textoDePapel(r, pagina).filter((l) => !l.startsWith('[QR'))) {
        expect(linea.length, `«${linea}»`).toBeLessThanOrEqual(COLUMNAS);
      }
    }
  });

  it('transliterando, tildes y eñes salen como letras sin tilde, nunca como basura', () => {
    const texto = textoDePapel(en(largos, 4), 'transliterar').join('\n');
    const corrido = texto.replaceAll('\n', ' ');
    expect(texto).toMatch(/^[\n\x20-\x7E]*$/);
    expect(corrido).toContain('Nandu del Pacifico');
    expect(corrido).toContain('San Jose de Cucuta');
  });

  it('control: una línea de 33 columnas se ve', () => {
    const r = { ...en(largos, 0), sede: { ...en(largos, 0).sede, nombre: 'X'.repeat(33) } };
    const lineas = lineasDePapel([{ tipo: 'texto', texto: r.sede.nombre }], COLUMNAS);
    expect(lineas.some((l) => l.length > COLUMNAS)).toBe(true);
    // Y `papel` la parte.
    expect(textoDePapel(r).every((l) => l.startsWith('[QR') || l.length <= COLUMNAS)).toBe(true);
  });
});

describe('sin datos legales no hay recibo (HU-Q3.2 CA2 y CA3)', () => {
  it('una caja vacía no arma recibo, y dice todo lo que falta', () => {
    expect(() =>
      armarRecibo(ENTRADA_ENSAYO, { sede: null, tarifa: null, ajuste: null }, { prueba: true }),
    ).toThrow(
      'Antes del primer recibo falta: el nombre, el NIT, la dirección, la ciudad, el teléfono, la póliza y la tarifa',
    );
  });

  it('la póliza falta mientras no se diga si hay; «no tiene» es una respuesta', () => {
    const borrador = { ...SEDE_ENSAYO_UNO, nit: '  ', poliza: undefined };
    expect(nombresDeCampos(faltantesDeSede(borrador))).toEqual(['el NIT', 'la póliza']);
    expect(faltantesDeSede({ ...SEDE_ENSAYO_UNO, poliza: null })).toEqual([]);
  });

  it('ReciboIncompleto nombra cada campo', () => {
    try {
      armarRecibo(
        ENTRADA_ENSAYO,
        { sede: { ...SEDE_ENSAYO_UNO, nit: '' }, tarifa: TARIFA_CARRO, ajuste: null },
        { prueba: true },
      );
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ReciboIncompleto);
      expect((e as ReciboIncompleto).faltan).toEqual(['el NIT']);
    }
  });
});

describe('el texto de responsabilidad de la sede (HU-Q4.5 CA1)', () => {
  const PROPIO =
    'Después de 45 días el parqueadero no se hace responsable del vehículo, moto, bicicleta, etc.';
  const conTexto = (registro: Registro, responsabilidad: string | null) =>
    armarRecibo(
      registro,
      { ...catalogos(SEDE_ENSAYO_UNO), ajuste: { ...AJUSTE_ENSAYO, responsabilidad } },
      { prueba: false },
    );
  const unaLinea = (r: Recibo) => textoDePapel(r).join(' ');

  it('sin texto propio, la entrada dice la sugerencia de la ley en papel y pantalla', () => {
    const r = conTexto(ENTRADA_ENSAYO, null);
    expect(textoDeResponsabilidad(r)).toBe(TEXTO_LEGAL.entrada);
    expect(unaLinea(r)).toContain('(Ley 1480, art. 18).');
    expect(pantalla(r).legal).toContain(TEXTO_LEGAL.entrada);
  });

  it('con texto propio, la entrada dice el de la sede, y no la sugerencia', () => {
    const r = conTexto(ENTRADA_ENSAYO, PROPIO);
    expect(unaLinea(r)).toContain(PROPIO);
    expect(unaLinea(r)).not.toContain('Ley 1480');
    expect(pantalla(r).legal).toEqual([PROPIO, AJUSTE_ENSAYO.pie]);
  });

  it('la salida no cambia: sigue diciendo que no es factura', () => {
    const r = conTexto(SALIDA_ENSAYO, PROPIO);
    expect(unaLinea(r)).not.toContain(PROPIO);
    expect(unaLinea(r)).toContain('no es factura');
  });

  it('las 200 letras caben en 32 columnas, partidas por palabras', () => {
    const largo = `${PROPIO} ${PROPIO}`.slice(0, 200);
    const lineas = textoDePapel(conTexto(ENTRADA_ENSAYO, largo));
    // El QR no es texto: la impresora lo dibuja.
    for (const l of lineas.filter((x) => !x.startsWith('[QR '))) {
      expect(l.length).toBeLessThanOrEqual(COLUMNAS);
    }
    expect(lineas.join(' ')).toContain(largo.split(' ').slice(-3).join(' '));
  });
});
