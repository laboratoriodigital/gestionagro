/**
 * Los íconos del cuaderno (HU-E0.11): trazos simples de 24 × 24 dibujados aquí, sin librería ni
 * fuente de íconos. Acompañan a un texto, nunca lo reemplazan: van con `aria-hidden`.
 */
const TRAZOS = {
  inicio: 'M4 11 12 4l8 7v9h-5v-6H9v6H4z',
  carencias: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  anotar: 'M12 5v14M5 12h14',
  historial: 'M9 7h11M9 12h11M9 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01',
  mas: 'M4 7h16M4 12h16M4 17h16',
  clima: 'M10 4a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z',
  riego: 'M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z',
  labor: 'M4 20l8-8M12 12l2-6 4 4-6 2z',
  aplicacion: 'M8 10h7v10H8zM10 10V6h4l2 2M17 5h2M17 9h2',
  cosecha: 'M3 10h18l-2 10H5zM8 10l4-6 4 6',
  monitoreo: 'M11 5a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM15.5 15.5 20 20',
  // Las secciones de «Más» (HU-E0.11).
  areas: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  personas:
    'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3.3 2.7-5 6-5s6 1.7 6 5M16 5.5a3 3 0 0 1 0 5.5M18 15c2 .6 3 2.2 3 5',
  insumos: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M7.5 15h9',
  lotes: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2',
  rendimiento: 'M4 20h16M7 16v-4M12 16V8M17 16v-7',
  costos:
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .9-3 2s1.3 1.7 3 2 3 .9 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6.5V8M12 16v1.5',
  respaldo: 'M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-1 9M12 12v8M9 15l3-3 3 3',
  cuenta: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6 8-6s8 2 8 6',
} as const;

export type NombreDeIcono = keyof typeof TRAZOS;

export function Icono({ nombre }: { nombre: NombreDeIcono }) {
  return (
    <svg class="icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={TRAZOS[nombre]} />
    </svg>
  );
}
