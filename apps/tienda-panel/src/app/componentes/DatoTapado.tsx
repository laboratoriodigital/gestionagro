import { taparCelular, taparCorreo, taparNombre } from './tapado.ts';

export type TipoDeDato = 'nombre' | 'celular' | 'correo';

const TAPAR: Record<TipoDeDato, (v: string) => string> = {
  nombre: taparNombre,
  celular: taparCelular,
  correo: taparCorreo,
};

/**
 * Un dato de una persona, tapado (TIENDA §12.5). El valor completo nunca llega al HTML: se tapa
 * antes de pintarlo.
 */
export function DatoTapado({ tipo, valor }: { tipo: TipoDeDato; valor: string }) {
  return <span class={`tapado${tipo === 'nombre' ? '' : ' cifra'}`}>{TAPAR[tipo](valor)}</span>;
}
