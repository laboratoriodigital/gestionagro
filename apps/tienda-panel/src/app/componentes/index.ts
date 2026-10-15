/**
 * Los componentes propios del panel de la Tienda (HU-T3.5). Los de base son los de `@ed1/ui` v2
 * (`Aviso`, `Boton`, `Campo`, `ResumenDeErrores`, `Contenido`, `Tarjeta`); aquí solo lo de la
 * Tienda (CA2).
 */
export { Barra } from './Barra.tsx';
export { Confirmar } from './Confirmar.tsx';
export { DatoTapado, type TipoDeDato } from './DatoTapado.tsx';
export { Estado } from './Estado.tsx';
export { ESTADOS_DE_PEDIDO, estadoDePedido, type Tono } from './estados.ts';
export { type Regla, validarTodo } from './formulario.ts';
export { type DatosDeFila, Fila, Lista } from './Lista.tsx';
export { esActual, Navegacion, SECCIONES, type Seccion } from './Navegacion.tsx';
export { taparCelular, taparCorreo, taparNombre } from './tapado.ts';
