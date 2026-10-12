/**
 * El recibo de entrada de la maqueta de PARQUEADERO §6.2, de un parqueadero de prueba (P4). Sus
 * bytes de referencia están en `referencia/recibo-ensayo-uno.hex`: si el codificador o el perfil
 * cambian un byte, la prueba lo dice antes que el papel (§15.1).
 */
import type { Bloque } from './documento.ts';

export const RECIBO_ENSAYO_UNO: readonly Bloque[] = [
  { tipo: 'texto', texto: 'PARQUEADERO ENSAYO UNO', alinear: 'centro', negrita: true },
  {
    tipo: 'texto',
    texto: 'NIT 900.000.000-0\nTel 3000000000\nCalle 1 # 2-3, Bogotá',
    alinear: 'centro',
  },
  { tipo: 'regla' },
  { tipo: 'par', izquierda: 'RECIBO DE ENTRADA', derecha: 'A-000123' },
  { tipo: 'texto', texto: '06/10/2026 18:05' },
  { tipo: 'par', izquierda: 'Placa ABC123', derecha: 'Carro' },
  { tipo: 'texto', texto: 'Estado: rayón puerta trasera derecha' },
  { tipo: 'regla' },
  {
    tipo: 'texto',
    texto: 'Tarifa: $230 por minuto\nTope por día: $30.000\nPóliza: Aseguradora 0000000',
  },
  { tipo: 'regla' },
  { tipo: 'qr', valor: 'https://parqueadero.laboratorio-digital.app/r/#c.123.ABC123.c.1759791900' },
  { tipo: 'texto', texto: 'Código para la salida', alinear: 'centro' },
  { tipo: 'regla' },
  {
    tipo: 'texto',
    texto: 'Conserve este recibo. El\nparqueadero responde por el\nvehículo (Ley 1480, art. 18).',
  },
  { tipo: 'texto', texto: 'Pida su recibo por WhatsApp.', alinear: 'centro' },
];
