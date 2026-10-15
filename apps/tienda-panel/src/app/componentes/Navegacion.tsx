/**
 * La navegación del panel (HU-T3.5 CA1): abajo, al alcance del pulgar, en el teléfono; a un lado en
 * escritorio. Cuatro entradas; lo demás vive en «Más». La página actual lo dice con
 * `aria-current`, no solo con el color.
 */
export interface Seccion {
  texto: string;
  href: string;
}

export const SECCIONES: readonly Seccion[] = [
  { texto: 'Inicio', href: '/' },
  { texto: 'Pedidos', href: '/pedidos/' },
  { texto: 'Productos', href: '/productos/' },
  { texto: 'Más', href: '/mas/' },
];

export const esActual = (href: string, ruta: string): boolean =>
  href === '/' ? ruta === '/' : ruta.startsWith(href);

export function Navegacion({ ruta }: { ruta: string }) {
  return (
    <nav class="navegacion" aria-label="Panel">
      {SECCIONES.map((s) => (
        <a key={s.href} href={s.href} aria-current={esActual(s.href, ruta) ? 'page' : undefined}>
          {s.texto}
        </a>
      ))}
    </nav>
  );
}
