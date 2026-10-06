/**
 * Componentes del sistema de diseño v2 (HU-C6.3, ADR-29). Se entregan como HTML estático: una app
 * de Astro los usa sin `client:*`, y no envían JavaScript. Su estilo está en
 * `@ed1/ui/v2/componentes.css`, que va con `tokens.css` y `fuentes.css`.
 */
export {
  Aviso,
  Boton,
  Etiqueta,
  type PropsDeBoton,
  Tarjeta,
  type TonoDeAviso,
} from './basicos.tsx';
export { Contenido, type EstadoDeContenido } from './contenido.tsx';
export { Campo, Grupo, type PropsDeCampo, ResumenDeErrores } from './formulario.tsx';
export { Confirmacion, Encabezado, type Enlace, PaginaDeError, Pie } from './marco.tsx';
