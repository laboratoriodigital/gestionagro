/**
 * La navegación del panel (HU-T3.5 CA1): abajo, al alcance del pulgar, en el teléfono; a un lado en
 * escritorio. Cuatro entradas; lo demás vive en «Más». La página actual lo dice con
 * `aria-current`, no solo con el color.
 *
 * HU-P3.3: quien solo despacha no edita productos: su tercera entrada es el inventario, que ve.
 */
import { puede } from '@ed1/tienda-schema/permisos';

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

/** Las entradas de un rol: sin editar el catálogo, «Productos» lleva al inventario. */
export const seccionesDe = (rol: string): readonly Seccion[] =>
  puede(rol, 'catalogo.editar')
    ? SECCIONES
    : SECCIONES.map((s) =>
        s.href === '/productos/' ? { texto: 'Inventario', href: '/productos/inventario/' } : s,
      );

export function Navegacion({ ruta, rol }: { ruta: string; rol: string }) {
  return (
    <nav class="navegacion" aria-label="Panel">
      {seccionesDe(rol).map((s) => (
        <a key={s.href} href={s.href} aria-current={esActual(s.href, ruta) ? 'page' : undefined}>
          {s.texto}
        </a>
      ))}
    </nav>
  );
}
