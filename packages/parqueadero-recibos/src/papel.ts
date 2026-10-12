/**
 * El recibo en papel térmico de 58 mm (PARQUEADERO §6.2, anexo B): bloques de `@ed1/impresion`
 * con cada línea ya armada a su ancho. Ninguna línea pasa de las columnas de la impresora (32 en
 * la fuente A): se parte por palabras aquí, no en la impresora (bitácora parqueadero 3).
 *
 * Con la impresora marcada «transliterar», el texto sale sin tildes ni eñes antes de medirlo:
 * lo que se mide es lo que se imprime (HU-Q1.4 CA2).
 */
import { formatearPesos } from '@ed1/dinero';
import { type Bloque, lineaPar, type PaginaDeCodigos, prepararTexto } from '@ed1/impresion';
import {
  conceptoDeLinea,
  fechaHora,
  lineaDelAbono,
  lineasDeTarifa,
  NOMBRE_DEL_MEDIO,
  nombreDelVehiculo,
  type Recibo,
  TEXTO_LEGAL,
  textoDeResponsabilidad,
} from './recibo.ts';

export interface OpcionesDePapel {
  readonly columnas: number;
  readonly paginaDeCodigos: PaginaDeCodigos;
  /** Lo que lleva el QR del papel: el enlace corto (§6.3). Solo en la entrada. */
  readonly qr: string | null;
  readonly desfaseMin?: number;
}

/** Parte un texto en líneas de `columnas` por palabras; una palabra más larga se corta. */
export function partir(texto: string, columnas: number): string[] {
  const lineas: string[] = [];
  for (const parrafo of texto.split('\n')) {
    let actual = '';
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      let p = palabra;
      while (p.length > columnas) {
        if (actual) lineas.push(actual);
        lineas.push(p.slice(0, columnas));
        p = p.slice(columnas);
        actual = '';
      }
      if (!actual) actual = p;
      else if (actual.length + 1 + p.length <= columnas) actual += ` ${p}`;
      else {
        lineas.push(actual);
        actual = p;
      }
    }
    lineas.push(actual);
  }
  return lineas;
}

/** Los bloques del recibo. Solo `texto` de una línea, `regla` y `qr`: lo que se ve es lo que sale. */
export function papel(recibo: Recibo, o: OpcionesDePapel): Bloque[] {
  const col = o.columnas;
  const $ = formatearPesos;
  const preparar = (t: string) => prepararTexto(t, o.paginaDeCodigos);
  const bloques: Bloque[] = [];
  const texto = (t: string, extra: { alinear?: 'centro'; negrita?: boolean } = {}) => {
    for (const linea of partir(preparar(t), col))
      bloques.push({ tipo: 'texto', texto: linea, ...extra });
  };
  const par = (izquierda: string, derecha: string, negrita = false) => {
    for (const linea of lineaPar(preparar(izquierda), preparar(derecha), col)) {
      // Una línea que cabe conserva sus espacios; solo se parte la que no cabe.
      for (const corta of linea.length <= col ? [linea] : partir(linea, col)) {
        bloques.push({ tipo: 'texto', texto: corta, negrita });
      }
    }
  };
  const regla = () => bloques.push({ tipo: 'regla' });
  const f = (ms: number) => fechaHora(ms, o.desfaseMin);
  const s = recibo.sede;

  texto(s.nombre.toUpperCase(), { alinear: 'centro', negrita: true });
  texto(`NIT ${s.nit}`, { alinear: 'centro' });
  texto(`Tel ${s.telefono}`, { alinear: 'centro' });
  texto(`${s.direccion}, ${s.ciudad}`, { alinear: 'centro' });
  regla();

  const vehiculo = nombreDelVehiculo(recibo.vehiculo);
  if (recibo.clase === 'entrada' || !recibo.salida) {
    par('RECIBO DE ENTRADA', recibo.numero, true);
    texto(f(recibo.entrada));
    par(`Placa ${recibo.placa}`, vehiculo);
    texto(`Estado: ${recibo.estado.length ? recibo.estado.join('; ') : 'sin novedad'}`);
    regla();
    for (const l of lineasDeTarifa(recibo.tarifa)) texto(l);
    if (s.poliza) texto(`Póliza: ${s.poliza.aseguradora} ${s.poliza.numero}`);
    regla();
    if (o.qr) {
      bloques.push({ tipo: 'qr', valor: o.qr });
      texto('Código para la salida', { alinear: 'centro' });
      regla();
    }
    texto(textoDeResponsabilidad(recibo));
  } else {
    const sa = recibo.salida;
    par('RECIBO DE SALIDA', recibo.numero, true);
    texto(`Entrada ${sa.entradaNumero}`);
    par(`Placa ${recibo.placa}`, vehiculo);
    par('Entró', f(recibo.entrada));
    par('Salió', f(sa.instante));
    par('Tiempo', `${sa.minutos} min`);
    regla();
    for (const l of sa.lineas) {
      if (l.concepto === 'plena' || l.concepto === 'tope_dia') {
        par(conceptoDeLinea({ ...l, concepto: 'tiempo' }, recibo.tarifa), $(l.base));
      }
      par(conceptoDeLinea(l, recibo.tarifa), $(l.valor));
    }
    if (sa.redondeo > 0) par('Redondeo', $(-sa.redondeo));
    par('TOTAL', $(sa.total), true);
    texto(`Pago: ${NOMBRE_DEL_MEDIO[sa.medio]}`);
    const abono = lineaDelAbono(sa);
    if (abono) texto(abono);
    if (sa.recibido !== null && sa.cambio !== null) {
      par(`Recibido ${$(sa.recibido)}`, `Cambio ${$(sa.cambio)}`);
    }
    regla();
    if (s.poliza) texto(`Póliza: ${s.poliza.aseguradora} ${s.poliza.numero}`);
    texto(TEXTO_LEGAL.noFactura);
  }
  if (recibo.pie) texto(recibo.pie, { alinear: 'centro' });
  texto(TEXTO_LEGAL.pedirWhatsApp, { alinear: 'centro' });
  return bloques;
}

/** El papel como texto, para las pruebas y la vista previa: la regla con guiones, el QR marcado. */
export function lineasDePapel(bloques: readonly Bloque[], columnas: number): string[] {
  return bloques.flatMap((b): string[] => {
    switch (b.tipo) {
      case 'texto':
        return b.texto.split('\n');
      case 'par':
        return lineaPar(b.izquierda, b.derecha, columnas);
      case 'regla':
        return ['-'.repeat(columnas)];
      case 'qr':
        return [`[QR ${b.valor}]`];
      default:
        return Array.from({ length: b.lineas }, () => '');
    }
  });
}
