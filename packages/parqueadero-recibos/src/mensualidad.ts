/**
 * El recibo de una mensualidad (HU-Q8.4 CA1): el papel de un registro `pago_abonado`, con el mismo
 * encabezado de la sede y el mismo número de la caja que los de entrada y salida. Es solo papel (o
 * la hoja del diálogo de impresión): no lleva enlace a `/r/` ni va por WhatsApp, porque la caja no
 * guarda el número del abonado (dueño, 9 oct 2026). Sin los datos legales de la sede no sale.
 */
import { formatearPesos } from '@ed1/dinero';
import { type Bloque, lineaPar, type PaginaDeCodigos, prepararTexto } from '@ed1/impresion';
import {
  type DatosDePagoAbonado,
  numeroDeRecibo,
  type Registro,
  type Sede,
} from '@ed1/parqueadero-schema';
import { partir } from './papel.ts';
import {
  faltantesDeSede,
  fechaHora,
  NOMBRE_DEL_MEDIO,
  nombreDelVehiculo,
  nombresDeCampos,
  ReciboIncompleto,
  TEXTO_LEGAL,
} from './recibo.ts';

/** `31/10/2026`. */
const dia = (f: string) => f.split('-').reverse().join('/');

export function papelDeLaMensualidad(
  pago: Registro,
  sede: Sede | null,
  o: {
    readonly columnas: number;
    readonly paginaDeCodigos: PaginaDeCodigos;
    readonly pie?: string | null;
    readonly desfaseMin?: number;
  },
): Bloque[] {
  if (pago.tipo !== 'pago_abonado' || pago.serie === null || pago.consecutivo === null) {
    throw new TypeError('Solo un pago de mensualidad con su número tiene este recibo');
  }
  const faltan = nombresDeCampos(faltantesDeSede(sede));
  if (faltan.length > 0 || !sede) throw new ReciboIncompleto(faltan);
  const d = pago.datos as DatosDePagoAbonado;
  const col = o.columnas;
  const preparar = (t: string) => prepararTexto(t, o.paginaDeCodigos);
  const bloques: Bloque[] = [];
  const texto = (t: string, extra: { alinear?: 'centro'; negrita?: boolean } = {}) => {
    for (const linea of partir(preparar(t), col))
      bloques.push({ tipo: 'texto', texto: linea, ...extra });
  };
  const par = (izquierda: string, derecha: string, negrita = false) => {
    for (const linea of lineaPar(preparar(izquierda), preparar(derecha), col)) {
      for (const corta of linea.length <= col ? [linea] : partir(linea, col)) {
        bloques.push({ tipo: 'texto', texto: corta, negrita });
      }
    }
  };
  const regla = () => bloques.push({ tipo: 'regla' });

  texto(sede.nombre.toUpperCase(), { alinear: 'centro', negrita: true });
  texto(`NIT ${sede.nit}`, { alinear: 'centro' });
  texto(`Tel ${sede.telefono}`, { alinear: 'centro' });
  texto(`${sede.direccion}, ${sede.ciudad}`, { alinear: 'centro' });
  regla();
  par('MENSUALIDAD', numeroDeRecibo(pago.serie, pago.consecutivo), true);
  texto(fechaHora(Date.parse(pago.instante_evento), o.desfaseMin));
  par(`Placa ${d.placa}`, nombreDelVehiculo(d.vehiculo));
  par('Desde', dia(d.desde));
  par('Hasta (incluido)', dia(d.hasta));
  regla();
  par('TOTAL', formatearPesos(d.valor), true);
  texto(`Pago: ${NOMBRE_DEL_MEDIO[d.medio_pago]}`);
  regla();
  texto(TEXTO_LEGAL.noFactura);
  if (o.pie) texto(o.pie, { alinear: 'centro' });
  return bloques;
}
