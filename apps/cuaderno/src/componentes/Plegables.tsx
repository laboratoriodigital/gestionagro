/**
 * Listas plegables (revisión del dueño, 3 oct 2026): con muchas naves, camas y surcos la página se
 * alargaba. Cada elemento se abre y se cierra por su cuenta, y hay «Abrir todas» y «Cerrar todas».
 * Una sola copia para Áreas, Carencias y Lotes (P2). Usa `<details>`: funciona con teclado y con
 * lector de pantalla sin nada extra.
 *
 * Con pocos elementos arrancan abiertos (no hay nada que ahorrar); con muchos, cerrados.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';

/** Hasta cuántos elementos arrancan abiertos. */
export const ABIERTAS_HASTA = 6;

export function usarPlegables(
  ids: readonly string[],
  abiertasPorDefecto = ids.length <= ABIERTAS_HASTA,
) {
  const clave = ids.join('|');
  const [abiertas, setAbiertas] = useState<Set<string>>(
    () => new Set(abiertasPorDefecto ? ids : []),
  );
  // Llega un elemento nuevo (otra área, otro lote): sigue la regla de la lista.
  useEffect(() => {
    setAbiertas((antes) => {
      const conocidos = new Set(clave ? clave.split('|') : []);
      const nuevas = new Set([...antes].filter((id) => conocidos.has(id)));
      if (abiertasPorDefecto) for (const id of conocidos) if (!antes.has(id)) nuevas.add(id);
      return nuevas;
    });
  }, [clave]);
  return {
    abierta: (id: string) => abiertas.has(id),
    poner: (id: string, abierta: boolean) =>
      setAbiertas((antes) => {
        if (antes.has(id) === abierta) return antes;
        const nuevas = new Set(antes);
        if (abierta) nuevas.add(id);
        else nuevas.delete(id);
        return nuevas;
      }),
    abrirTodas: () => setAbiertas(new Set(ids)),
    cerrarTodas: () => setAbiertas(new Set()),
    todasAbiertas: ids.length > 0 && ids.every((id) => abiertas.has(id)),
    ningunaAbierta: ids.every((id) => !abiertas.has(id)),
  };
}

export type Plegables = ReturnType<typeof usarPlegables>;

export function ControlesPlegables(props: { p: Plegables; que: string; id: string }) {
  return (
    <div class="acciones controles-plegables" data-prueba={`plegables-${props.id}`}>
      <button
        type="button"
        class="secundario"
        disabled={props.p.todasAbiertas}
        onClick={props.p.abrirTodas}
        aria-label={`Abrir todas las ${props.que}`}
      >
        Abrir todas
      </button>
      <button
        type="button"
        class="secundario"
        disabled={props.p.ningunaAbierta}
        onClick={props.p.cerrarTodas}
        aria-label={`Cerrar todas las ${props.que}`}
      >
        Cerrar todas
      </button>
    </div>
  );
}

/** Un elemento plegable: el resumen siempre a la vista, el detalle al abrirlo. */
export function Plegable(props: {
  id: string;
  p: Plegables;
  resumen: ComponentChildren;
  children: ComponentChildren;
  clase?: string;
  prueba?: string;
}) {
  return (
    <details
      class={`plegable ${props.clase ?? ''}`}
      open={props.p.abierta(props.id)}
      onToggle={(e) => props.p.poner(props.id, (e.currentTarget as HTMLDetailsElement).open)}
      data-prueba={props.prueba}
    >
      <summary>{props.resumen}</summary>
      {props.children}
    </details>
  );
}
