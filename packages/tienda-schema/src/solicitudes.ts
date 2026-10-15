/**
 * Los tipos de solicitud (HU-T6.4, TIENDA-3.0 §8.6): los de `ref_tipo_solicitud`, con el nombre que
 * ve el comprador. Una sola lista para la API, que los valida, y el horno, que los ofrece en
 * `/solicitud/` (P2); una prueba de la API la ata a la tabla.
 */
export const TIPOS_DE_SOLICITUD = [
  'peticion',
  'queja',
  'reclamo',
  'retracto',
  'reversion',
  'datos_consulta',
  'datos_reclamo',
] as const;
export type TipoDeSolicitud = (typeof TIPOS_DE_SOLICITUD)[number];

export const NOMBRE_DEL_TIPO: Record<TipoDeSolicitud, string> = {
  peticion: 'Pregunta o petición',
  queja: 'Queja',
  reclamo: 'Reclamo',
  retracto: 'Retracto de una compra',
  reversion: 'Reversión de un pago',
  datos_consulta: 'Consulta sobre mis datos',
  datos_reclamo: 'Corregir o borrar mis datos',
};
