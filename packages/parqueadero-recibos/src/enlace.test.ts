import {
  AJUSTE_ENSAYO,
  ENTRADA_ENSAYO,
  SALIDA_ENSAYO,
  SEDE_ENSAYO_UNO,
  TARIFA_CARRO,
} from '@ed1/parqueadero-schema/ensayos';
import { correction, generate } from 'lean-qr';
import { describe, expect, it } from 'vitest';
import {
  armarRecibo,
  EnlaceInvalido,
  enlaceCompleto,
  enlaceCorto,
  fragmentoCompleto,
  leerEnlace,
  type MotivoDeEnlace,
  type Recibo,
} from './index.ts';

const CATALOGOS = { sede: SEDE_ENSAYO_UNO, tarifa: TARIFA_CARRO, ajuste: AJUSTE_ENSAYO };
const ENTRADA = armarRecibo(ENTRADA_ENSAYO, CATALOGOS, { prueba: false });
const SALIDA = armarRecibo(SALIDA_ENSAYO, CATALOGOS, { prueba: false });

/**
 * El recibo de prueba de nombre y dirección largos (§6.3): los dos en el máximo que deja la sede
 * (40 y 60 letras), con póliza, y la salida con su liquidación.
 */
const SEDE_LARGA = {
  ...SEDE_ENSAYO_UNO,
  nombre: 'Parqueadero Ensayo Uno de Nombre Muy Lar',
  direccion: 'Avenida Carrera 68 # 100-200 Interior 4 Bodega 12 Sotano B',
};
const LARGO_ENTRADA = armarRecibo(
  ENTRADA_ENSAYO,
  { ...CATALOGOS, sede: SEDE_LARGA },
  { prueba: false },
);
const LARGO = armarRecibo(SALIDA_ENSAYO, { ...CATALOGOS, sede: SEDE_LARGA }, { prueba: false });

/** Uno con todo lleno: no tiene que caber en la 13, pero se lee igual. */
const LLENO: Recibo = {
  ...LARGO,
  sede: {
    ...LARGO.sede,
    ciudad: 'San Jose de Cucuta Norte de Sa',
    poliza: { aseguradora: 'Aseguradora del Pacifico Sur', numero: 'POL-2026-0000001234' },
  },
  placa: 'ABCDEF1234',
  tarifa: {
    ...LARGO.tarifa,
    plena: { desde_min: 180, valor: 15_000 },
    nocturna: { desde: '20:00', hasta: '05:30', valor: 8_000 },
  },
  pie: 'Lunes a viernes 5:30 a 20:00, sábados 6:00',
  prueba: true,
};

/** La versión más chica de QR que lo lleva con corrección L; lanza si pasa de `maxima`. */
const versionDeQr = (texto: string, maxima: number) =>
  (generate(texto, {
    minCorrectionLevel: correction.L,
    maxCorrectionLevel: correction.L,
    maxVersion: maxima,
  }).size -
    17) /
  4;

describe('el enlace del recibo (HU-Q1.5 CA1)', () => {
  it.each([
    ['entrada', ENTRADA],
    ['salida', SALIDA],
    ['entrada larga', LARGO_ENTRADA],
    ['salida larga', LARGO],
    ['salida con todo lleno', LLENO],
    [
      'entrada con todo lleno',
      { ...LLENO, clase: 'entrada', salida: null, estado: ['espejo izquierdo roto'] } as Recibo,
    ],
  ])('la forma completa de la %s se lee como el mismo recibo, sin firma', async (_, r) => {
    const leido = await leerEnlace(await enlaceCompleto(r));
    expect(leido).toEqual({ forma: 'completa', recibo: r, firma: 'sin_firma' });
  });

  it('la forma corta lleva número, placa, tipo y hora', async () => {
    const corto = enlaceCorto(ENTRADA);
    expect(corto).toBe(
      'https://parqueadero.laboratorio-digital.app/r/#c.A-000123.ABC123.c.1791327900',
    );
    expect(await leerEnlace(corto)).toEqual({
      forma: 'corta',
      numero: 'A-000123',
      placa: 'ABC123',
      vehiculo: 'carro',
      entrada: ENTRADA.entrada,
    });
  });

  it('con firma y certificado (M2), esta versión dice que no los verifica', async () => {
    const leido = await leerEnlace(`${await fragmentoCompleto(ENTRADA)}.AAAA.BBBB`);
    expect(leido.forma === 'completa' && leido.firma).toBe('sin_verificar');
  });
});

describe('cabe en el QR (HU-Q1.5 CA2)', () => {
  it('la corta, en la versión 7 con corrección L', () => {
    expect(versionDeQr(enlaceCorto(LARGO_ENTRADA), 7)).toBeLessThanOrEqual(7);
  });

  it.each([
    ['entrada', LARGO_ENTRADA],
    ['salida', LARGO],
  ])('la completa de la %s larga, sin firma, en la versión 13', async (_, r) => {
    expect(versionDeQr(await enlaceCompleto(r), 13)).toBeLessThanOrEqual(13);
  });

  it('control: la completa no cabe en la versión 7', async () => {
    expect(() => versionDeQr(`${'x'.repeat(200)}`, 7)).toThrow();
    expect(() => versionDeQr(enlaceCorto(LARGO_ENTRADA), 1)).toThrow();
  });
});

const motivoDe = async (enlace: string): Promise<MotivoDeEnlace | 'leyo'> => {
  try {
    await leerEnlace(enlace);
    return 'leyo';
  } catch (e) {
    if (e instanceof EnlaceInvalido) return e.motivo;
    throw e;
  }
};

describe('un enlace alterado es un error con su motivo, nunca otro recibo (HU-Q1.5 CA3)', () => {
  it.each([
    ['una versión desconocida', '2.abc', 'version'],
    ['sin datos', '1', 'forma'],
    ['con tres partes', '1.abc.def', 'forma'],
    ['base64 roto', '1.ab$c', 'base64'],
    ['base64 de largo imposible', '1.abcde', 'base64'],
    ['bytes que no son deflate', '1.AAAAAAAA', 'compresion'],
    ['una corta sin hora', 'c.A-000123.ABC123.c', 'forma'],
    ['una corta con un tipo que no existe', 'c.A-000123.ABC123.z.1791327900', 'forma'],
  ] as const)('%s', async (_, fragmento, motivo) => {
    expect(await motivoDe(`https://parqueadero.laboratorio-digital.app/r/#${fragmento}`)).toBe(
      motivo,
    );
  });

  it('cambiar cualquier carácter de los datos da un error, o el mismo recibo', async () => {
    const fragmento = await fragmentoCompleto(SALIDA);
    const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let errores = 0;
    for (let i = 2; i < fragmento.length; i++) {
      const original = fragmento[i] ?? 'A';
      const otro = alfabeto[(alfabeto.indexOf(original) + 17) % alfabeto.length] ?? 'A';
      const alterado = `${fragmento.slice(0, i)}${otro}${fragmento.slice(i + 1)}`;
      try {
        const leido = await leerEnlace(alterado);
        expect(leido.forma === 'completa' && leido.recibo).toEqual(SALIDA);
      } catch (e) {
        expect(e).toBeInstanceOf(EnlaceInvalido);
        errores++;
      }
    }
    expect(errores).toBe(fragmento.length - 2);
  });

  it('un JSON que no es recibo, comprimido bien, es «contenido»', async () => {
    const bytes = new TextEncoder().encode('{"k":"e"}');
    const flujo = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
    const comprimido = new Uint8Array(await new Response(flujo).arrayBuffer());
    let b = '';
    for (const x of comprimido) b += String.fromCharCode(x);
    const datos = btoa(b).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
    expect(await motivoDe(`1.${datos}`)).toBe('contenido');
  });
});

/**
 * Un enlace de cada versión del formato, como salió el primer día. Tienen que seguir abriendo
 * siempre: el enlace es un contrato desde el primer recibo (plan §3.3).
 */
const GUARDADOS = {
  entradaV1:
    'https://parqueadero.laboratorio-digital.app/r/#1.eJxNT0Fqw0AM_IqYXuUi7xKC95aE3nropaeQg4jVNDR4Xa1dCKWP6Rv6hHysbEKhGgQaRsxIn3hDEsaAhFUjIm2IYIyVrjc3MiFhD4YhtcuujWHZiTBKj7TFk_r7bNqbZ3oYip4zPQ8ZjE7kXm7dCBgbPZ2MWrqj0FTXdT7k6fINRpS_wo4x5mq7KnaYXfvsCsY_2UqVXc-Xn4HG2XxSmlyLuVJvbvtXrWvTC9JWOERh4QVfI7giRNkxyvXp8YiEx3mwQkofR_M6LVIUUgqSpJ49OpJ8_QIijk6e',
  salidaV1:
    'https://parqueadero.laboratorio-digital.app/r/#1.eJxNT0FqwzAQ_IqYXtdlJNkk1i0JvfXQS09GB1GrISRYrmwXSulj-pZ-rMghpbsss8vODjufOMNpwQCHXUVSmxqCsYz7gzYWghkOLxBEOL1ptTWblhRMPVyHp5Dflhj6mJN6GKbwkdTzkCBoyXteqyIEh3C5RKXVnTJVUd2nY5p_viGwvAW8YExFdjfF45JDn3KA4N86TnCdF8yvcB3FWAqlkVVDShpLLygszS0pekvpOrNirWvyyvX-76ZZ8Wbfrk-c4PC4DHFSQb2fYi5d4yxVUIaOxdCY4fj1C1ivTjo',
  corta: 'https://parqueadero.laboratorio-digital.app/r/#c.A-000123.ABC123.c.1791327900',
};

describe('los enlaces guardados siguen abriendo (HU-Q1.5 CA3)', () => {
  it('versión 1, entrada y salida', async () => {
    expect(await leerEnlace(GUARDADOS.entradaV1)).toEqual({
      forma: 'completa',
      recibo: ENTRADA,
      firma: 'sin_firma',
    });
    expect(await leerEnlace(GUARDADOS.salidaV1)).toEqual({
      forma: 'completa',
      recibo: SALIDA,
      firma: 'sin_firma',
    });
  });

  it('la forma corta', async () => {
    expect((await leerEnlace(GUARDADOS.corta)).forma).toBe('corta');
  });
});
