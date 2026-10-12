/**
 * El soporte, medido (HU-Q10.3, estudio §10.4 y §16.3): cada atención a una sede es una fila de un
 * CSV que el dueño lleva fuera del repositorio, y el resumen del mes dice los minutos por sede. Es
 * la variable que decide si el negocio funciona: una hora de soporte al mes vale más que todo lo
 * demás de una sede.
 *
 * - **CA1:** solo fecha, sede, canal, minutos y causa. No hay columna libre: ningún dato del
 *   conductor (ni un número de teléfono en la sede) puede entrar.
 * - **CA2:** cada causa dice su runbook; las que no tienen uno lo dicen, para llevarlas al backlog.
 * - **CA3:** un mes sin filas de una sede no es cero, es «sin registros» (P1). Un mes de verdad sin
 *   atenciones se anota con una fila de causa `ninguna` y 0 minutos.
 */

export const CANALES_DE_SOPORTE = ['whatsapp', 'llamada', 'presencial', 'remoto'] as const;
export type CanalDeSoporte = (typeof CANALES_DE_SOPORTE)[number];

/** Cada causa con el runbook que la resuelve, o nulo si todavía no tiene uno. */
export const CAUSAS_DE_SOPORTE = {
  impresora: 'docs/runbooks/parqueadero-impresora-no-imprime.md',
  uso_de_la_caja: 'docs/runbooks/parqueadero-hoja-del-cajero.md',
  puesta_en_marcha: 'docs/runbooks/parqueadero-puesta-en-marcha.md',
  respaldo: 'docs/runbooks/parqueadero-restaurar-caja.md',
  caja_perdida: 'docs/runbooks/parqueadero-retirar-caja.md',
  cobro_y_tarifas: null,
  whatsapp: null,
  cuenta_y_nube: null,
  telefono_o_red: null,
  otra: null,
  ninguna: null,
} as const satisfies Record<string, string | null>;
export type CausaDeSoporte = keyof typeof CAUSAS_DE_SOPORTE;

export const COLUMNAS_DEL_SOPORTE = ['fecha', 'sede', 'canal', 'minutos', 'causa'] as const;

export interface Atencion {
  readonly fecha: string;
  readonly sede: string;
  readonly canal: CanalDeSoporte;
  readonly minutos: number;
  readonly causa: CausaDeSoporte;
}

export interface ErrorDelRegistro {
  /** La línea del archivo, desde 1. */
  readonly linea: number;
  readonly motivo: string;
}

const incluye = <T extends string>(lista: readonly T[], x: string): x is T =>
  (lista as readonly string[]).includes(x);

const fechaValida = (f: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(f) && new Date(`${f}T00:00:00Z`).toISOString().startsWith(f);

/** Lee el registro: `;` como lo guarda Excel en español (también `,`), con o sin BOM. */
export function leerRegistroDeSoporte(texto: string): {
  atenciones: Atencion[];
  errores: ErrorDelRegistro[];
} {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/);
  const errores: ErrorDelRegistro[] = [];
  const atenciones: Atencion[] = [];
  const separador = (lineas[0] ?? '').includes(';') ? ';' : ',';
  const cabecera = (lineas[0] ?? '').split(separador).map((c) => c.trim().toLowerCase());
  if (cabecera.join(';') !== COLUMNAS_DEL_SOPORTE.join(';')) {
    return {
      atenciones,
      errores: [
        { linea: 1, motivo: `La primera línea debe ser: ${COLUMNAS_DEL_SOPORTE.join(separador)}` },
      ],
    };
  }
  lineas.forEach((linea, i) => {
    if (i === 0 || linea.trim() === '') return;
    const n = i + 1;
    const celdas = linea.split(separador).map((c) => c.trim().replace(/^"(.*)"$/, '$1'));
    const mal = (motivo: string) => errores.push({ linea: n, motivo });
    if (celdas.length !== COLUMNAS_DEL_SOPORTE.length) {
      mal(
        `Tiene ${celdas.length} columnas y son ${COLUMNAS_DEL_SOPORTE.length}: el registro no lleva notas ni datos del conductor`,
      );
      return;
    }
    const [fecha = '', sede = '', canal = '', minutosTexto = '', causa = ''] = celdas;
    const antes = errores.length;
    if (!fechaValida(fecha)) mal(`La fecha «${fecha}» debe ser como 2026-10-09`);
    if (sede === '' || sede.length > 60) mal('La sede es su nombre, de 1 a 60 letras');
    else if (/\d{7,}/.test(sede.replace(/[\s.-]/g, '')))
      mal('La sede no lleva números de teléfono: solo su nombre');
    if (!incluye(CANALES_DE_SOPORTE, canal))
      mal(`El canal «${canal}» no es uno de: ${CANALES_DE_SOPORTE.join(', ')}`);
    if (!incluye(Object.keys(CAUSAS_DE_SOPORTE) as CausaDeSoporte[], causa))
      mal(`La causa «${causa}» no es una de: ${Object.keys(CAUSAS_DE_SOPORTE).join(', ')}`);
    const minutos = /^\d{1,3}$/.test(minutosTexto) ? Number(minutosTexto) : Number.NaN;
    if (!(minutos >= 0 && minutos <= 600)) mal('Los minutos son un número entero de 0 a 600');
    else if (causa === 'ninguna' && minutos !== 0)
      mal('Una fila «ninguna» dice que el mes no tuvo atenciones: va con 0 minutos');
    else if (causa !== 'ninguna' && minutos === 0)
      mal('Una atención dura al menos 1 minuto; un mes sin atenciones va con la causa «ninguna»');
    if (errores.length === antes) {
      atenciones.push({
        fecha,
        sede,
        canal: canal as CanalDeSoporte,
        minutos,
        causa: causa as CausaDeSoporte,
      });
    }
  });
  return { atenciones, errores };
}

export type SoporteDeLaSede =
  /** CA3: ninguna fila de la sede en el mes. No es cero. */
  | { readonly sede: string; readonly estado: 'sin_registros' }
  /** El dueño anotó que el mes no tuvo atenciones. */
  | { readonly sede: string; readonly estado: 'sin_atenciones'; readonly minutos: 0 }
  | {
      readonly sede: string;
      readonly estado: 'con_atenciones';
      readonly atenciones: number;
      readonly minutos: number;
      readonly porCausa: Readonly<Partial<Record<CausaDeSoporte, number>>>;
      readonly porCanal: Readonly<Partial<Record<CanalDeSoporte, number>>>;
    };

export interface ResumenDelSoporte {
  /** `2026-10`. */
  readonly mes: string;
  /** Todas las sedes del registro, también las que no tienen filas en el mes. */
  readonly sedes: readonly SoporteDeLaSede[];
  /** Las tres causas con más minutos en el mes, con su runbook (CA2). */
  readonly causas: readonly {
    readonly causa: CausaDeSoporte;
    readonly minutos: number;
    readonly atenciones: number;
    readonly runbook: string | null;
  }[];
}

export function resumenDelMes(atenciones: readonly Atencion[], mes: string): ResumenDelSoporte {
  const nombres = [...new Set(atenciones.map((a) => a.sede))].sort((a, b) => a.localeCompare(b));
  const delMes = atenciones.filter((a) => a.fecha.startsWith(`${mes}-`));
  const sedes = nombres.map((sede): SoporteDeLaSede => {
    const suyas = delMes.filter((a) => a.sede === sede);
    if (suyas.length === 0) return { sede, estado: 'sin_registros' };
    const reales = suyas.filter((a) => a.causa !== 'ninguna');
    if (reales.length === 0) return { sede, estado: 'sin_atenciones', minutos: 0 };
    const porCausa: Partial<Record<CausaDeSoporte, number>> = {};
    const porCanal: Partial<Record<CanalDeSoporte, number>> = {};
    for (const a of reales) {
      porCausa[a.causa] = (porCausa[a.causa] ?? 0) + a.minutos;
      porCanal[a.canal] = (porCanal[a.canal] ?? 0) + a.minutos;
    }
    return {
      sede,
      estado: 'con_atenciones',
      atenciones: reales.length,
      minutos: reales.reduce((s, a) => s + a.minutos, 0),
      porCausa,
      porCanal,
    };
  });

  const porCausa = new Map<CausaDeSoporte, { minutos: number; atenciones: number }>();
  for (const a of delMes) {
    if (a.causa === 'ninguna') continue;
    const c = porCausa.get(a.causa) ?? { minutos: 0, atenciones: 0 };
    porCausa.set(a.causa, { minutos: c.minutos + a.minutos, atenciones: c.atenciones + 1 });
  }
  const causas = [...porCausa]
    .sort(
      ([ca, a], [cb, b]) =>
        b.minutos - a.minutos || b.atenciones - a.atenciones || ca.localeCompare(cb),
    )
    .slice(0, 3)
    .map(([causa, c]) => ({ causa, ...c, runbook: CAUSAS_DE_SOPORTE[causa] }));
  return { mes, sedes, causas };
}

const pesos = (n: number) => `$${n.toLocaleString('es-CO')}`;

/** El resumen en texto, para la consola del dueño. `costoMinuto`: pesos por minuto, si lo sabe. */
export function textoDelResumen(r: ResumenDelSoporte, costoMinuto: number | null = null): string {
  const l: string[] = [`Soporte del parqueadero, ${r.mes}`, ''];
  if (r.sedes.length === 0) {
    l.push(
      'El registro no tiene ninguna atención todavía: sin registros no hay minutos que contar.',
    );
    return `${l.join('\n')}\n`;
  }
  for (const s of r.sedes) {
    if (s.estado === 'sin_registros') {
      l.push(
        `${s.sede}: sin registros este mes. No cuenta como cero: anote las atenciones, o una fila «ninguna» si no hubo.`,
      );
    } else if (s.estado === 'sin_atenciones') {
      l.push(`${s.sede}: 0 minutos (anotado: sin atenciones).`);
    } else {
      const costo = costoMinuto === null ? '' : `, ${pesos(s.minutos * costoMinuto)}`;
      const causas = Object.entries(s.porCausa)
        .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
        .map(([c, m]) => `${c} ${m}`)
        .join(', ');
      const canales = Object.entries(s.porCanal)
        .map(([c, m]) => `${c} ${m}`)
        .join(', ');
      l.push(
        `${s.sede}: ${s.minutos} minutos en ${s.atenciones} ${s.atenciones === 1 ? 'atención' : 'atenciones'}${costo}.`,
        `  Por causa: ${causas}.`,
        `  Por canal: ${canales}.`,
      );
    }
  }
  const sinRegistros = r.sedes.filter((s) => s.estado === 'sin_registros').length;
  if (sinRegistros > 0) {
    l.push('', `Mes incompleto: ${sinRegistros} de ${r.sedes.length} sedes sin registros.`);
  }
  if (r.causas.length > 0) {
    l.push('', 'Las causas con más minutos:');
    for (const c of r.causas) {
      l.push(
        `  ${c.causa}: ${c.minutos} minutos en ${c.atenciones}. ${c.runbook ? `Runbook: ${c.runbook}` : 'Sin runbook: llévela al backlog.'}`,
      );
    }
  }
  return `${l.join('\n')}\n`;
}

/** El mes anterior al de `hoy` (fecha de Bogotá): el resumen es de un mes cerrado. */
export function mesAnterior(hoy: string): string {
  const [a = 0, m = 1] = hoy.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
}
