/**
 * La pantalla Cobro (HU-T11.2, TIENDA-3.0 §9.2 y §9.7): el estado de las llaves de Bold en palabras,
 * pegarlas y probarlas, y lo que cobra Bold. Las llaves solo viajan en el cuerpo de la solicitud
 * que las guarda: nunca en un borrador del teléfono, en la dirección ni en un log (CA4).
 */
import { formatearPesos } from '@ed1/dinero';
import { type Conexion, pedirAlPanel } from './api.ts';
import { opNueva } from './catalogo.ts';
import { fechaLegible } from './terminos.ts';

export type Ambiente = 'pruebas' | 'produccion';
export const AMBIENTES: readonly Ambiente[] = ['pruebas', 'produccion'];
export const NOMBRE_DEL_AMBIENTE: Record<Ambiente, string> = {
  pruebas: 'Pruebas',
  produccion: 'Producción',
};

export interface LlaveVista {
  fin: string;
  guardada: string;
  verificada: string | null;
}

export interface CobroDelPanel {
  terminos: boolean;
  custodia: boolean;
  modo: 'whatsapp' | 'en_linea' | 'ambos';
  ambiente: Ambiente;
  llaves: Record<Ambiente, { identidad: LlaveVista | null; secreta: LlaveVista | null }>;
  faltan: string[];
  /** HU-T11.3: el cobro de prueba guiado. */
  prueba: {
    aprobada: string | null;
    ultimo: { id: string; estado: string; creado: string } | null;
  };
  /** La dirección que el comercio pega en Bold para los avisos (TIENDA §9.4). */
  avisos: string | null;
}

export const leerCobro = (c: Conexion) => pedirAlPanel<CobroDelPanel>(c, 'cobro');

export const guardarLlaves = (
  c: Conexion,
  d: { ambiente: Ambiente; identidad: string; secreta: string },
) =>
  pedirAlPanel<{ estado: 'guardado' }>(c, 'cobro/llaves', {
    cuerpo: { op: opNueva(), ...d },
  });

export const probarLlaves = (c: Conexion, ambiente: Ambiente) =>
  pedirAlPanel<{ estado: 'valida' | 'invalida' | 'sin-respuesta' | 'sin-llaves'; motivo: string }>(
    c,
    'cobro/probar',
    { cuerpo: { ambiente } },
  );

/** El día de un instante en Bogotá (UTC−5, sin horario de verano), en palabras. */
export const diaEnBogota = (iso: string) =>
  fechaLegible(new Date(Date.parse(iso) - 5 * 3_600_000).toISOString().slice(0, 10));

/** Las llaves de un ambiente, dichas para el comercio: cuáles están y si Bold las reconoció. */
export function llavesEnPalabras(
  l: CobroDelPanel['llaves'][Ambiente],
  dia: (iso: string) => string = diaEnBogota,
): string {
  if (!l.identidad && !l.secreta) return 'Sin llaves.';
  const partes: string[] = [];
  if (l.identidad) {
    partes.push(
      `La de identidad termina en ${l.identidad.fin}${
        l.identidad.verificada
          ? ` y Bold la reconoció el ${dia(l.identidad.verificada)}`
          : ', sin comprobar con Bold'
      }.`,
    );
  } else partes.push('Falta la de identidad.');
  partes.push(l.secreta ? `La secreta termina en ${l.secreta.fin}.` : 'Falta la secreta.');
  return partes.join(' ');
}

/**
 * HU-T11.3: en qué va la prueba, en palabras. Aprobada por la consulta y sin aviso es la señal de
 * que la dirección de los avisos en Bold está mal: el pago funcionó, el aviso no llegó.
 */
export function pruebaEnPalabras(p: CobroDelPanel['prueba']): {
  tono: 'exito' | 'aviso' | 'info';
  texto: string;
} {
  if (p.aprobada)
    return {
      tono: 'exito',
      texto: `Bold aprobó tu cobro de prueba y avisó el ${diaEnBogota(p.aprobada)}: tu llave secreta y los avisos funcionan.`,
    };
  const u = p.ultimo;
  if (!u) return { tono: 'info', texto: 'Todavía no has hecho el cobro de prueba.' };
  if (u.estado === 'aprobado' || u.estado === 'aprobado_sin_existencias')
    return {
      tono: 'aviso',
      texto:
        'Tu pago de prueba se aprobó, pero el aviso de Bold no llegó. Revisa en tu cuenta de Bold la dirección de los avisos (paso 2) y haz otro pago de prueba.',
    };
  if (u.estado === 'esperando')
    return {
      tono: 'info',
      texto: 'Tu pago de prueba está en curso. Cuando Bold avise, lo verás aquí.',
    };
  return {
    tono: 'aviso',
    texto: `Tu último pago de prueba quedó ${u.estado === 'rechazado' ? 'rechazado' : 'sin terminar'}: inténtalo otra vez.`,
  };
}

/** «la llave de identidad de pruebas y la llave secreta de pruebas». */
export function enLista(cosas: readonly string[]): string {
  if (cosas.length <= 1) return cosas.join('');
  return `${cosas.slice(0, -1).join(', ')} y ${cosas.at(-1)}`;
}

/**
 * Lo que cobra Bold en línea, antes del IVA de la comisión: la tabla de TIENDA-3.0 §9.7, que sale
 * del estudio §10.2 (una prueba las ata, P2). La paga el comercio.
 */
export const COMISIONES: readonly { medio: string; porcentaje: string; fijoCop: number | null }[] =
  [
    { medio: 'Tarjeta Visa o Mastercard', porcentaje: '2,99 %', fijoCop: 900 },
    { medio: 'PSE, Bancolombia y billeteras', porcentaje: '2,89 %', fijoCop: 900 },
    { medio: 'QR en línea', porcentaje: '2,89 %', fijoCop: null },
    { medio: 'Depósito inmediato', porcentaje: '3,59 %', fijoCop: 900 },
  ];

/** «2,99 % + $900», como en la tabla del diseño. */
export const comisionEnTexto = (c: (typeof COMISIONES)[number]) =>
  c.fijoCop === null ? c.porcentaje : `${c.porcentaje} + ${formatearPesos(c.fijoCop)}`;
