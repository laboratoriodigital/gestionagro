/**
 * Una lista del panel (HU-T3.5 CA1 y CA2): tarjetas en el teléfono y una tabla en escritorio, con
 * la misma marcación; lo cambia la hoja de estilos. Los estados «cargando», «vacío» y «error» son
 * los de `Contenido` de `@ed1/ui` v2, que esta lista reusa.
 *
 * Una fila es un enlace entero, con su dato exacto (número, hora), su monto, su estado y quién: así
 * se lee igual de pie en la bodega que sentado en el computador. Nada en ella fija un ancho: con
 * 300 filas a 360 px, nada empuja la página más allá del teléfono (CA3).
 */
import { Contenido, type EstadoDeContenido } from '@ed1/ui/v2/componentes';
import type { ComponentChildren } from 'preact';

export interface DatosDeFila {
  href: string;
  /** Lo exacto, en monoespaciada: «#1045 · 10:42». */
  dato: string;
  monto?: string;
  estado?: ComponentChildren;
  detalle?: string;
}

export function Fila({ f }: { f: DatosDeFila }) {
  return (
    <a class="fila" href={f.href}>
      <span class="fila__dato cifra">{f.dato}</span>
      {f.monto ? <span class="fila__monto cifra">{f.monto}</span> : null}
      {f.estado ?? null}
      {f.detalle ? <span class="fila__detalle">{f.detalle}</span> : null}
    </a>
  );
}

export function Lista<T>({
  titulo,
  estado,
  vacio,
  fila,
}: {
  titulo: string;
  estado: EstadoDeContenido<T>;
  vacio: { porque: string; accion?: ComponentChildren };
  fila: (e: T) => DatosDeFila;
}) {
  return (
    <div class="filas">
      <Contenido
        titulo={titulo}
        estado={estado}
        vacio={vacio}
        elemento={(e: T) => <Fila f={fila(e)} />}
      />
    </div>
  );
}
