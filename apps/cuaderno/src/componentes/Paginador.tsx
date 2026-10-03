/**
 * Paginación de listas largas (revisión del dueño, 3 oct 2026): «Del 1 al 25 de 816», anterior y
 * siguiente, la página actual y cuántos ver por página. Una sola copia para Registrar, Historial y
 * Lotes (P2). Los botones son de 48 px y el texto dice dónde se está, sin depender del color.
 */
import { useEffect, useState } from 'preact/hooks';

export const TAMANOS = [10, 25, 50, 100] as const;

export function usarPaginacion(total: number, porPaginaInicial: number) {
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(porPaginaInicial);
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  // Si el filtro deja menos registros, no se queda en una página que ya no existe.
  useEffect(() => {
    if (pagina > paginas) setPagina(paginas);
  }, [paginas]);
  const actual = Math.min(pagina, paginas);
  return {
    pagina: actual,
    porPagina,
    paginas,
    desde: (actual - 1) * porPagina,
    hasta: Math.min(total, actual * porPagina),
    irA: (p: number) => setPagina(Math.min(Math.max(1, p), paginas)),
    reiniciar: () => setPagina(1),
    cambiarTamano: (n: number) => {
      setPorPagina(n);
      setPagina(1);
    },
  };
}

export type Paginacion = ReturnType<typeof usarPaginacion>;

export function Paginador(props: {
  id: string;
  total: number;
  p: Paginacion;
  /** Qué se cuenta: «registros», «lotes». */
  que: string;
}) {
  const { p } = props;
  if (props.total === 0) return null;
  return (
    <nav
      class="paginador"
      aria-label={`Páginas de ${props.que}`}
      data-prueba={`paginador-${props.id}`}
    >
      <p class="ayuda" aria-live="polite">
        Del {p.desde + 1} al {p.hasta} de {props.total} {props.que}
      </p>
      <div class="paginador-botones">
        <button
          type="button"
          class="secundario"
          disabled={p.pagina <= 1}
          onClick={() => p.irA(p.pagina - 1)}
        >
          Anterior
        </button>
        <span class="paginador-pagina">
          Página {p.pagina} de {p.paginas}
        </span>
        <button
          type="button"
          class="secundario"
          disabled={p.pagina >= p.paginas}
          onClick={() => p.irA(p.pagina + 1)}
        >
          Siguiente
        </button>
      </div>
      <div class="campo paginador-tamano">
        <label for={`por-pagina-${props.id}`}>Ver por página</label>
        <select
          id={`por-pagina-${props.id}`}
          value={String(p.porPagina)}
          onChange={(e) => p.cambiarTamano(Number((e.currentTarget as HTMLSelectElement).value))}
        >
          {TAMANOS.map((n) => (
            <option key={n} value={String(n)}>
              {n}
            </option>
          ))}
        </select>
      </div>
    </nav>
  );
}
