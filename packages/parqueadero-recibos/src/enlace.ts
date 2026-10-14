/**
 * El enlace del recibo (PARQUEADERO §6.3, HU-Q1.5), en dos formas:
 *
 * - **Completa:** `…/r/#1.<datos>[.<firma>.<certificado>]`. `datos` es un JSON de claves cortas,
 *   comprimido con deflate (zlib, que trae su suma Adler-32) y en base64url. Es el formato del QR
 *   firmado del agro, que `@ed1/firma` heredó (HU-Q8.1). La versión 2 (HU-Q4.5) es la 1 con el
 *   texto de responsabilidad que escribió la sede; solo la lleva una entrada con texto propio, así
 *   que los demás recibos siguen saliendo en la 1. La versión 3 (HU-Q13.1 y HU-Q13.2) es la 1 con
 *   lo que haga falta de esto: el texto de responsabilidad, la tarifa de domingos y festivos y las
 *   horas de reloj; solo la lleva un recibo que tiene alguna de las dos últimas.
 * - **Firma** (M2, HU-Q8.2, ADR-36): la caja firma `<versión>.<datos>` con su llave Ed25519 y le
 *   pega el certificado que le dio la celda (`@ed1/firma`). `verificarRecibo` da los cuatro casos
 *   de PARQUEADERO §6.3. Un enlace sin firma, como los de M0, sigue abriendo igual.
 * - **Corta:** `…/r/#c.<número>.<placa>.<tipo>.<hora>`, la del papel: cabe en un QR de versión 7.
 *
 * El fragmento no llega a ningún servidor (P13). El enlace es un contrato desde el primer recibo:
 * una versión del formato no cambia, se agrega la siguiente, y un fragmento alterado se lee como
 * un error con su motivo, nunca como otro recibo (HU-Q1.5 CA3).
 */

import {
  base64url,
  desdeBase64url as bytesDe,
  esCanonico,
  type LlavePublica,
  type VerificarEd25519,
  verificarCadena,
} from '@ed1/firma';
import {
  CONCEPTOS,
  MEDIOS_DE_PAGO,
  MODOS,
  NOMBRES_DE_VEHICULO,
  VEHICULOS,
  type Vehiculo,
} from '@ed1/parqueadero-schema';
import { z } from 'zod';
import type { Recibo } from './recibo.ts';

/** Donde vive la página del recibo (ADR-40). */
export const ORIGEN_DEL_RECIBO = 'https://parqueadero.laboratorio-digital.app/r/';

export type MotivoDeEnlace =
  /** No tiene la forma de ninguna versión. */
  | 'forma'
  /** Una versión que esta página no conoce. */
  | 'version'
  | 'base64'
  /** No se descomprime, o su suma no coincide: un byte cambió. */
  | 'compresion'
  /** Se lee, pero no es un recibo. */
  | 'contenido';

export class EnlaceInvalido extends Error {
  readonly motivo: MotivoDeEnlace;
  constructor(motivo: MotivoDeEnlace, detalle: string) {
    super(`Enlace de recibo inválido (${motivo}): ${detalle}`);
    this.name = 'EnlaceInvalido';
    this.motivo = motivo;
  }
}

const LETRA_DEL_VEHICULO = Object.fromEntries(
  NOMBRES_DE_VEHICULO.map((v) => [VEHICULOS[v].letra, v]),
) as Record<string, Vehiculo>;
const LETRAS = NOMBRES_DE_VEHICULO.map((v) => VEHICULOS[v].letra) as [string, ...string[]];

const numero = z.string().regex(/^[A-Z0-9]{1,3}-\d{6,}$/);
const placa = z.string().regex(/^[A-Z0-9]{1,10}$/);
const segundos = z
  .int()
  .min(0)
  .max(2 ** 40);
const pesos = z.int().min(0);
const cadena = z.string().min(1).max(200);
/** Un índice de una lista fija: el formato guarda posiciones, no palabras. */
const indice = (lista: readonly unknown[]) =>
  z
    .int()
    .min(0)
    .max(lista.length - 1);
/** 0 = no hay: los montos y minutos que se guardan así nunca valen 0 (anexo A, `tarifa`). */
const opcional = z.int().min(0);

/**
 * La versión 1 del formato. Cada byte cuenta: el enlace completo de la salida tiene que caber en
 * un QR de versión 13 (HU-Q1.5 CA2). Por eso lleva posiciones en vez de palabras, 0 en vez de
 * `null` y nada que se pueda calcular (el subtotal, el redondeo y el cambio salen de las líneas,
 * del total y de lo recibido). No se cambia: se agrega la versión 2.
 */
const compactoV1 = z.strictObject({
  /** 0 entrada, 1 salida. */
  k: indice([0, 1]),
  n: numero,
  p: placa,
  t: z.enum(LETRAS),
  e: segundos,
  sd: z.tuple([cadena, cadena, cadena, cadena, cadena]),
  po: z.union([z.literal(0), z.tuple([cadena, cadena])]),
  es: z.array(cadena).max(6),
  /** modo, valor, fracción, gracia, tope diario, plena, noche, tope por minuto. */
  tf: z.tuple([
    indice(MODOS),
    pesos,
    opcional,
    z.int().min(0),
    opcional,
    z.union([z.literal(0), z.tuple([z.int(), pesos])]),
    z.union([z.literal(0), z.tuple([cadena, cadena, pesos])]),
    opcional,
  ]),
  /** Segundos después de la entrada, minutos, líneas, total, medio, recibido, número de entrada. */
  s: z.union([
    z.literal(0),
    z.tuple([
      z.int().min(0),
      z.int().min(0),
      z
        .array(z.tuple([indice(CONCEPTOS), z.int().min(0), pesos, pesos]))
        .min(1)
        .max(64),
      pesos,
      indice(MEDIOS_DE_PAGO),
      z.union([z.literal(-1), pesos]),
      numero,
    ]),
  ]),
  pi: z.union([z.literal(0), cadena]),
  pr: indice([0, 1]),
});

type CompactoV1 = z.infer<typeof compactoV1>;

/** La versión 2 (HU-Q4.5): la 1 y el texto de responsabilidad de la sede. Solo en la entrada. */
const compactoV2 = z.strictObject({ ...compactoV1.shape, lg: cadena });

type CompactoV2 = z.infer<typeof compactoV2>;

/**
 * La versión 3 (HU-Q13.1 y HU-Q13.2): la 1, el texto de responsabilidad si la entrada lo tiene, la
 * tarifa de domingos y festivos (`fs`: valor y plena) y las horas de reloj (`h: 1`).
 */
const compactoV3 = z.strictObject({
  ...compactoV1.shape,
  lg: cadena.optional(),
  fs: z.tuple([pesos, z.union([z.literal(0), z.tuple([z.int(), pesos])])]).optional(),
  h: z.literal(1).optional(),
});

type CompactoV3 = z.infer<typeof compactoV3>;

const aSegundos = (ms: number) => Math.floor(ms / 1000);

function compactar(r: Recibo): CompactoV1 {
  const t = r.tarifa;
  const s = r.sede;
  const sa = r.salida;
  return {
    k: r.clase === 'entrada' ? 0 : 1,
    n: r.numero,
    p: r.placa,
    t: VEHICULOS[r.vehiculo].letra,
    e: aSegundos(r.entrada),
    sd: [s.nombre, s.nit, s.direccion, s.ciudad, s.telefono],
    po: s.poliza ? [s.poliza.aseguradora, s.poliza.numero] : 0,
    es: [...r.estado],
    tf: [
      MODOS.indexOf(t.modo),
      t.valor,
      t.fraccion_min ?? 0,
      t.gracia_min,
      t.tope_dia ?? 0,
      t.plena ? [t.plena.desde_min, t.plena.valor] : 0,
      t.nocturna ? [t.nocturna.desde, t.nocturna.hasta, t.nocturna.valor] : 0,
      t.tope_minuto ?? 0,
    ],
    s: sa
      ? [
          aSegundos(sa.instante) - aSegundos(r.entrada),
          sa.minutos,
          sa.lineas.map((l) => [CONCEPTOS.indexOf(l.concepto), l.minutos, l.base, l.valor]),
          sa.total,
          MEDIOS_DE_PAGO.indexOf(sa.medio),
          sa.recibido ?? -1,
          sa.entradaNumero,
        ]
      : 0,
    pi: r.pie ?? 0,
    pr: r.prueba ? 1 : 0,
  };
}

const nulo = (x: number) => (x === 0 ? null : x);

function expandir(c: CompactoV1 | CompactoV2 | CompactoV3): Recibo {
  const festivo = 'fs' in c && c.fs ? c.fs : null;
  const [modo, valor, fraccion, gracia_min, topeDia, plena, nocturna, topeMinuto] = c.tf;
  const entrada = c.e * 1000;
  let salida: Recibo['salida'] = null;
  if (c.s !== 0) {
    const [despues, minutos, l, total, medio, recibido, entradaNumero] = c.s;
    const lineas = l.map(([concepto, m, base, v]) => ({
      concepto: CONCEPTOS[concepto] ?? 'tiempo',
      minutos: m,
      base,
      valor: v,
    }));
    const subtotal = lineas.reduce((a, x) => a + x.valor, 0);
    if (subtotal < total || (recibido !== -1 && recibido < total)) {
      throw new EnlaceInvalido('contenido', 'el total no cuadra con las líneas o lo recibido');
    }
    salida = {
      instante: entrada + despues * 1000,
      entradaNumero,
      minutos,
      lineas,
      subtotal,
      redondeo: subtotal - total,
      total,
      medio: MEDIOS_DE_PAGO[medio] ?? 'efectivo',
      recibido: recibido === -1 ? null : recibido,
      cambio: recibido === -1 ? null : recibido - total,
    };
  }
  return {
    clase: c.k === 0 ? 'entrada' : 'salida',
    numero: c.n,
    sede: {
      nombre: c.sd[0],
      nit: c.sd[1],
      direccion: c.sd[2],
      ciudad: c.sd[3],
      telefono: c.sd[4],
      poliza: c.po === 0 ? null : { aseguradora: c.po[0], numero: c.po[1] },
    },
    placa: c.p,
    vehiculo: LETRA_DEL_VEHICULO[c.t] ?? 'carro',
    entrada,
    estado: c.es,
    tarifa: {
      modo: MODOS[modo] ?? 'minuto',
      valor,
      fraccion_min: nulo(fraccion),
      gracia_min,
      tope_dia: nulo(topeDia),
      plena: plena === 0 ? null : { desde_min: plena[0], valor: plena[1] },
      nocturna:
        nocturna === 0 ? null : { desde: nocturna[0], hasta: nocturna[1], valor: nocturna[2] },
      tope_minuto: nulo(topeMinuto),
      ...(festivo
        ? {
            festivo: {
              valor: festivo[0],
              plena: festivo[1] === 0 ? null : { desde_min: festivo[1][0], valor: festivo[1][1] },
            },
          }
        : {}),
    },
    salida,
    pie: c.pi === 0 ? null : c.pi,
    responsabilidad: 'lg' in c && c.lg !== undefined ? c.lg : null,
    prueba: c.pr === 1,
    ...('h' in c && c.h === 1 ? { hora12: true } : {}),
  };
}

/** Lee base64url y exige la forma canónica: dos textos distintos nunca dan los mismos bytes. */
function desdeBase64url(valor: string): Uint8Array<ArrayBuffer> {
  if (!esCanonico(valor)) throw new EnlaceInvalido('base64', 'no es base64url canónico');
  return bytesDe(valor);
}

async function pasar(bytes: Uint8Array<ArrayBuffer>, t: TransformStream): Promise<Uint8Array> {
  const flujo = new Blob([bytes]).stream().pipeThrough(t);
  return new Uint8Array(await new Response(flujo).arrayBuffer());
}

/**
 * El fragmento completo sin firma (M0): `1.<datos>`, o `2.<datos>` si la entrada lleva el texto de
 * responsabilidad de la sede (HU-Q4.5). La salida no lo lleva: su enlace cabe en el QR (CA2). Un
 * recibo con tarifa de festivos u horas de reloj sale en la 3 (HU-Q13), con lo que lleve de los tres.
 */
export async function fragmentoCompleto(recibo: Recibo): Promise<string> {
  const propio = recibo.clase === 'entrada' ? recibo.responsabilidad : null;
  const f = recibo.tarifa.festivo;
  const extra: Partial<CompactoV3> = {
    ...(f
      ? { fs: [f.valor, f.plena ? [f.plena.desde_min, f.plena.valor] : 0] as CompactoV3['fs'] }
      : {}),
    ...(recibo.hora12 ? { h: 1 as const } : {}),
  };
  const nueva = Object.keys(extra).length > 0;
  const version = nueva ? 3 : propio === null ? 1 : 2;
  const datos = {
    ...compactar(recibo),
    ...(propio === null ? {} : { lg: propio }),
    ...extra,
  };
  const json = new TextEncoder().encode(JSON.stringify(datos));
  return `${version}.${base64url(await pasar(json, new CompressionStream('deflate')))}`;
}

/** `origen`: el de producción; staging pasa el suyo para que sus recibos de PRUEBA abran allá. */
export async function enlaceCompleto(recibo: Recibo, origen = ORIGEN_DEL_RECIBO): Promise<string> {
  return `${origen}#${await fragmentoCompleto(recibo)}`;
}

/** La forma del papel: `c.A-000123.ABC123.c.1759791900`. */
export function enlaceCorto(
  recibo: Pick<Recibo, 'numero' | 'placa' | 'vehiculo' | 'entrada'>,
  origen = ORIGEN_DEL_RECIBO,
): string {
  const t = VEHICULOS[recibo.vehiculo].letra;
  return `${origen}#c.${recibo.numero}.${recibo.placa}.${t}.${aSegundos(recibo.entrada)}`;
}

/** Lo que trae un enlace firmado, para verificarlo (`verificarRecibo`). */
export interface Firmado {
  readonly firma: string;
  readonly certificado: string;
  /** Lo que firmó la caja: `<versión>.<datos>`, tal como llegó. */
  readonly mensaje: Uint8Array<ArrayBuffer>;
}

export type Lectura =
  | {
      readonly forma: 'completa';
      readonly recibo: Recibo;
      /** Sin firma (M0, o una caja que no puede firmar), o lo que trae para verificar (M2). */
      readonly firma: 'sin_firma' | Firmado;
    }
  | {
      readonly forma: 'corta';
      readonly numero: string;
      readonly placa: string;
      readonly vehiculo: Vehiculo;
      readonly entrada: number;
    };

/** Lee un enlace o su fragmento. Lanza `EnlaceInvalido` con el motivo, nunca otro recibo. */
export async function leerEnlace(enlace: string): Promise<Lectura> {
  const fragmento = enlace.includes('#') ? enlace.slice(enlace.indexOf('#') + 1) : enlace;
  const partes = fragmento.split('.');
  const version = partes[0];

  if (version === 'c') {
    const [, n = '', p = '', t = '', s = ''] = partes;
    if (
      partes.length !== 5 ||
      !numero.safeParse(n).success ||
      !placa.safeParse(p).success ||
      !(t in LETRA_DEL_VEHICULO) ||
      !/^\d{1,13}$/.test(s)
    ) {
      throw new EnlaceInvalido('forma', 'la forma corta es c.<número>.<placa>.<tipo>.<hora>');
    }
    return {
      forma: 'corta',
      numero: n,
      placa: p,
      vehiculo: LETRA_DEL_VEHICULO[t] ?? 'carro',
      entrada: Number(s) * 1000,
    };
  }
  if (version !== '1' && version !== '2' && version !== '3') {
    throw new EnlaceInvalido('version', `versión «${version}» desconocida`);
  }
  if (partes.length !== 2 && partes.length !== 4) {
    throw new EnlaceInvalido(
      'forma',
      `la forma completa es ${version}.<datos>[.<firma>.<certificado>]`,
    );
  }

  const comprimido = desdeBase64url(partes[1] ?? '');
  let json: string;
  try {
    json = new TextDecoder('utf-8', { fatal: true }).decode(
      await pasar(comprimido, new DecompressionStream('deflate')),
    );
  } catch {
    throw new EnlaceInvalido('compresion', 'no se pudo descomprimir: el enlace cambió');
  }
  let datos: unknown;
  try {
    datos = JSON.parse(json);
  } catch {
    throw new EnlaceInvalido('contenido', 'no es JSON');
  }
  const r = (version === '1' ? compactoV1 : version === '2' ? compactoV2 : compactoV3).safeParse(
    datos,
  );
  if (!r.success || (r.data.k === 0) !== (r.data.s === 0) || (version === '2' && r.data.k !== 0)) {
    throw new EnlaceInvalido('contenido', `no es un recibo de la versión ${version}`);
  }
  return {
    forma: 'completa',
    recibo: expandir(r.data),
    firma:
      partes.length === 4
        ? {
            firma: partes[2] ?? '',
            certificado: partes[3] ?? '',
            mensaje: new TextEncoder().encode(`${version}.${partes[1]}`),
          }
        : 'sin_firma',
  };
}

/** Lo que la caja firma de un enlace completo sin firma: su fragmento, `<versión>.<datos>`. */
export function mensajeAFirmar(enlace: string): Uint8Array<ArrayBuffer> {
  const fragmento = enlace.includes('#') ? enlace.slice(enlace.indexOf('#') + 1) : enlace;
  if (!/^[123]\.[A-Za-z0-9_-]+$/.test(fragmento)) {
    throw new EnlaceInvalido('forma', 'solo se firma un enlace completo sin firma');
  }
  return new TextEncoder().encode(fragmento);
}

/** El enlace completo con la firma de la caja y su certificado (HU-Q8.2 CA1). */
export function conFirma(enlace: string, firma: Uint8Array, certificado: string): string {
  mensajeAFirmar(enlace);
  return `${enlace}.${base64url(firma)}.${certificado}`;
}

/** La serie del número de un recibo: `A` de `A-000123`. */
export const serieDe = (n: string): string => n.slice(0, n.indexOf('-'));

/** Cuándo dice el recibo que se emitió, en segundos: la salida, o la entrada. */
export const emitidoEn = (recibo: Recibo): number =>
  Math.floor((recibo.salida?.instante ?? recibo.entrada) / 1000);

export type Verificacion =
  /** «Copia digital del recibo»: sin sello, sin alarma (M0 o una caja sin firma). */
  | { readonly estado: 'sin-firma' }
  | { readonly estado: 'verificado'; readonly serie: string }
  /** En ámbar: la caja firmó después de que venció su certificado (§11.4 punto 2). */
  | { readonly estado: 'vencido'; readonly serie: string }
  /** El certificado es de una celda que esta página no conoce: se muestra como sin firma. */
  | { readonly estado: 'sin-verificar' }
  /** En rojo: «Este recibo fue modificado». */
  | { readonly estado: 'modificado' };

/**
 * Los casos de PARQUEADERO §6.3. La cadena es la de `@ed1/firma`, y además la serie del
 * certificado tiene que ser la del número del recibo: una caja solo responde por sus números.
 */
export async function verificarRecibo(
  lectura: Extract<Lectura, { forma: 'completa' }>,
  llaves: readonly LlavePublica[],
  verificar: VerificarEd25519,
): Promise<Verificacion> {
  if (lectura.firma === 'sin_firma') return { estado: 'sin-firma' };
  const c = await verificarCadena({
    ...lectura.firma,
    llaves,
    emitido: emitidoEn(lectura.recibo),
    verificar,
  });
  if (c.estado === 'modificado') return { estado: 'modificado' };
  if (c.certificado.serie !== serieDe(lectura.recibo.numero)) return { estado: 'modificado' };
  if (c.estado === 'llave-desconocida') return { estado: 'sin-verificar' };
  return { estado: c.estado, serie: c.certificado.serie };
}
