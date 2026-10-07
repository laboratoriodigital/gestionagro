/**
 * El recibo en WhatsApp y en pantalla (PARQUEADERO §6.4 y §6.5). El texto sigue las reglas de
 * `@ed1/whatsapp`: el nombre del negocio sale de la sede, nada de emoji al principio y el enlace
 * solo en su línea. La pantalla muestra lo mismo que el papel, con tildes.
 */
import { formatearPesos } from '@ed1/dinero';
import { armarTexto } from '@ed1/whatsapp';
import {
  conceptoDeLinea,
  fechaHora,
  lineaDelAbono,
  lineasDeTarifa,
  NOMBRE_DEL_MEDIO,
  nombreDelVehiculo,
  type Recibo,
  TEXTO_LEGAL,
} from './recibo.ts';

/** El mensaje para el conductor, con el enlace completo del recibo (§6.4). */
export function textoWhatsApp(recibo: Recibo, enlace: string, desfaseMin = -300): string {
  const f = (ms: number) => fechaHora(ms, desfaseMin);
  const vehiculo = nombreDelVehiculo(recibo.vehiculo);
  const lineas: string[] = [];
  if (recibo.prueba) lineas.push('PRUEBA: NO VALE.');
  if (recibo.clase === 'entrada' || !recibo.salida) {
    const tarifa = lineasDeTarifa(recibo.tarifa).filter((l) => !l.startsWith('Gracia'));
    lineas.push(
      `Recibo de entrada ${recibo.numero} - ${recibo.sede.nombre}`,
      `Placa ${recibo.placa} - ${vehiculo} - ${f(recibo.entrada)}`,
      `Estado: ${recibo.estado.length ? recibo.estado.join('; ') : 'sin novedad'}.`,
      `${tarifa.join('. ')}.`,
    );
  } else {
    const s = recibo.salida;
    lineas.push(
      `Recibo de salida ${recibo.numero} - ${recibo.sede.nombre}`,
      `Placa ${recibo.placa} - ${vehiculo}`,
      `Entró ${f(recibo.entrada)}, salió ${f(s.instante)} (${s.minutos} min).`,
      `Total ${formatearPesos(s.total)} - Pago: ${NOMBRE_DEL_MEDIO[s.medio]}.`,
    );
    const abono = lineaDelAbono(s);
    if (abono) lineas.push(`${abono}.`);
  }
  lineas.push('Su recibo:', enlace, TEXTO_LEGAL.whatsapp);
  return armarTexto(lineas);
}

export interface VistaDeRecibo {
  readonly titulo: string;
  readonly filas: readonly (readonly [string, string])[];
  readonly legal: readonly string[];
}

/** Lo que muestra la pantalla del recibo, en filas de etiqueta y valor (§6.5). */
export function pantalla(recibo: Recibo, desfaseMin = -300): VistaDeRecibo {
  const f = (ms: number) => fechaHora(ms, desfaseMin);
  const $ = formatearPesos;
  const s = recibo.sede;
  const filas: [string, string][] = [
    ['Parqueadero', s.nombre],
    ['NIT', s.nit],
    ['Dirección', `${s.direccion}, ${s.ciudad}`],
    ['Teléfono', s.telefono],
    ['Placa', `${recibo.placa} · ${nombreDelVehiculo(recibo.vehiculo)}`],
    ['Entrada', f(recibo.entrada)],
  ];
  if (recibo.clase === 'entrada' || !recibo.salida) {
    filas.push(['Estado', recibo.estado.length ? recibo.estado.join('; ') : 'sin novedad']);
    filas.push(['Tarifa', lineasDeTarifa(recibo.tarifa).join(' · ')]);
  } else {
    const sa = recibo.salida;
    filas.push(['Recibo de entrada', sa.entradaNumero], ['Salida', f(sa.instante)]);
    filas.push(['Tiempo', `${sa.minutos} min`]);
    for (const l of sa.lineas) filas.push([conceptoDeLinea(l, recibo.tarifa), $(l.valor)]);
    if (sa.redondeo > 0) filas.push(['Redondeo', $(-sa.redondeo)]);
    filas.push(['Total', $(sa.total)], ['Pago', NOMBRE_DEL_MEDIO[sa.medio]]);
    const abono = lineaDelAbono(sa);
    if (abono) filas.push(['Abono', abono]);
    if (sa.recibido !== null && sa.cambio !== null) {
      filas.push(['Recibido', $(sa.recibido)], ['Cambio', $(sa.cambio)]);
    }
  }
  if (s.poliza) filas.push(['Póliza', `${s.poliza.aseguradora} ${s.poliza.numero}`]);
  return {
    titulo: `Recibo de ${recibo.clase} ${recibo.numero}`,
    filas,
    legal: [
      recibo.clase === 'entrada' ? TEXTO_LEGAL.entrada : TEXTO_LEGAL.noFactura,
      ...(recibo.pie ? [recibo.pie] : []),
    ],
  };
}
