/**
 * Datos de los dos parqueaderos de prueba (P4): Ensayo Uno, en Bogotá con póliza, y Ensayo Dos,
 * sin póliza. Ningún nombre real. Los usan las pruebas de este paquete, de las tarifas y de los
 * recibos.
 */
import type { AjusteRecibo, Sede, Tarifa } from './catalogos.ts';
import type { Registro } from './registro.ts';

export const DISPOSITIVO = 'caja-ensayo-1';
const ACTUALIZADO = '2026-10-06T11:00:00.000Z';

export const SEDE_ENSAYO_UNO: Sede = {
  id: '0199b8a0-0000-7000-8000-000000000001',
  org_id: null,
  version: 1,
  actualizado: ACTUALIZADO,
  entidad: 'sede',
  nombre: 'Parqueadero Ensayo Uno',
  nit: '900.000.000-0',
  direccion: 'Calle 1 # 2-3',
  ciudad: 'Bogotá',
  telefono: '3000000000',
  poliza: { aseguradora: 'Aseguradora', numero: '0000000' },
  registro: null,
  imprimir_siempre: true,
};

export const SEDE_ENSAYO_DOS: Sede = {
  ...SEDE_ENSAYO_UNO,
  id: '0199b8a0-0000-7000-8000-000000000002',
  nombre: 'Parqueadero Ensayo Dos',
  nit: '800123456-7',
  direccion: 'Carrera 10 # 20-30 Local 4',
  ciudad: 'Tunja',
  telefono: '+57 310 000 0000',
  poliza: null,
  imprimir_siempre: false,
};

/** Carro en Bogotá: $230 por minuto, el tope, y $30.000 por día (la maqueta de §6.2). */
export const TARIFA_CARRO: Tarifa = {
  id: '0199b8a0-0000-7000-8000-000000000011',
  org_id: null,
  version: 1,
  actualizado: ACTUALIZADO,
  entidad: 'tarifa',
  vehiculo: 'carro',
  modo: 'minuto',
  valor: 230,
  fraccion_min: null,
  gracia_min: 5,
  tope_dia: 30_000,
  plena: null,
  nocturna: null,
  perdido: 5_000,
  redondeo: 'ninguno',
  tope_minuto: 230,
  vigente_desde: ACTUALIZADO,
};

/** Moto: por minuto las primeras 3 horas y después el día completo, con noche fija. */
export const TARIFA_MOTO: Tarifa = {
  ...TARIFA_CARRO,
  id: '0199b8a0-0000-7000-8000-000000000012',
  vehiculo: 'moto',
  valor: 60,
  gracia_min: 0,
  tope_dia: null,
  plena: { desde_min: 180, valor: 12_000 },
  nocturna: { desde: '20:00', hasta: '05:30', valor: 8_000 },
  redondeo: 'abajo_50',
  tope_minuto: 161,
};

export const AJUSTE_ENSAYO: AjusteRecibo = {
  id: '0199b8a0-0000-7000-8000-000000000021',
  org_id: null,
  version: 1,
  actualizado: ACTUALIZADO,
  entidad: 'ajuste_recibo',
  pie: 'Lunes a viernes 5:30 a 20:00',
};

/** La entrada de la maqueta: ABC123, 6 oct 2026 a las 18:05 de Bogotá. */
export const ENTRADA_ENSAYO: Registro = {
  id: '0199bc3e-3b40-7000-8000-000000000101',
  org_id: null,
  tipo: 'entrada',
  v: 1,
  fecha_local: '2026-10-06',
  instante_evento: '2026-10-06T23:05:00.000Z',
  autor_usuario_id: null,
  dispositivo_id: DISPOSITIVO,
  origen: 'manual',
  anula_id: null,
  estadia_id: '0199bc3e-3b40-7000-8000-000000000101',
  serie: 'A',
  consecutivo: 123,
  datos: {
    placa: 'ABC123',
    vehiculo: 'carro',
    placa_confirmada: false,
    novedades: [{ tipo: 'rayon', parte: 'puerta trasera derecha', nota: null }],
    foto_ids: [],
    tarifa_id: TARIFA_CARRO.id,
    tarifa_version: 1,
    abonado_id: null,
  },
};

/** Su salida tres horas después: 180 minutos, $41.400 por minutos y el tope de $30.000. */
export const SALIDA_ENSAYO: Registro = {
  id: '0199bcf1-5a80-7000-8000-000000000102',
  org_id: null,
  tipo: 'salida',
  v: 1,
  fecha_local: '2026-10-06',
  instante_evento: '2026-10-07T02:05:00.000Z',
  autor_usuario_id: null,
  dispositivo_id: DISPOSITIVO,
  origen: 'manual',
  anula_id: null,
  estadia_id: ENTRADA_ENSAYO.id,
  serie: 'A',
  consecutivo: 124,
  datos: {
    entrada_numero: 'A-000123',
    placa: 'ABC123',
    vehiculo: 'carro',
    instante_entrada: '2026-10-06T23:05:00.000Z',
    minutos: 180,
    lineas: [{ concepto: 'tope_dia', minutos: 180, base: 41_400, valor: 30_000 }],
    subtotal: 30_000,
    redondeo: 0,
    total: 30_000,
    medio_pago: 'efectivo',
    recibido: 50_000,
    cambio: 20_000,
    motivo_cortesia: null,
    perdido: false,
    tarifa_id: TARIFA_CARRO.id,
    tarifa_version: 1,
  },
};
