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
} as const;

export type NombreDeIcono = keyof typeof TRAZOS;

export function Icono({ nombre }: { nombre: NombreDeIcono }) {
  return (
    <svg class="icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={TRAZOS[nombre]} />
    </svg>
  );
}
