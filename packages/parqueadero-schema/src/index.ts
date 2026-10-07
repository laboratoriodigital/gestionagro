export type { ZodType } from 'zod';
export * from './catalogos.ts';
export {
  fechaLocal as esquemaFechaLocal,
  horaLocal as esquemaHoraLocal,
  id,
  instante,
  pesos as esquemaPesos,
  placa as esquemaPlaca,
  texto,
} from './comunes.ts';
export * from './exportacion.ts';
export * from './registro.ts';
export * from './tipos.ts';
export * from './topes.ts';
