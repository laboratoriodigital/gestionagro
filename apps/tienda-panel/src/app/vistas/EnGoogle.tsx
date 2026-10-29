/**
 * HU-P4.4 (sprint PF3): cómo sale un producto o una página en Google. Los dos campos son
 * opcionales: sin ellos, la tienda usa el nombre y la descripción, como antes. La muestra se ve
 * como un resultado de Google y avisa cuando el texto pasa de lo que Google suele mostrar (CA2).
 */
import { LARGO_EN_GOOGLE } from '@ed1/tienda-schema/buscadores';
import { Texto } from '../componentes/index.ts';

export interface BuscadoresEnPantalla {
  titulo: string;
  descripcion: string;
}

/** El texto de la descripción sin las marcas de Markdown, como lo deja el horno. */
const sinMarcas = (md: string) =>
  md
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_#>`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const recortar = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function EnGoogle({
  id,
  valor,
  alCambiar,
  tituloDeFabrica,
  descripcionDeFabrica,
  direccion,
  errores,
}: {
  id: string;
  valor: BuscadoresEnPantalla;
  alCambiar: (v: BuscadoresEnPantalla) => void;
  /** El que usa la tienda si el comercio no escribe uno: «Camisa de lino · Mi tienda». */
  tituloDeFabrica: string;
  descripcionDeFabrica: string;
  /** La ruta en la tienda: `/p/camisa-de-lino/`. */
  direccion: string;
  errores: { titulo?: string | undefined; descripcion?: string | undefined };
}) {
  const titulo = valor.titulo.trim() || tituloDeFabrica;
  const descripcion = valor.descripcion.trim() || sinMarcas(descripcionDeFabrica).slice(0, 160);
  const largoTitulo = valor.titulo.trim().length;
  const largoDescripcion = valor.descripcion.trim().length;
  return (
    <details class="ed1-grupo en-google" id={id} open={largoTitulo + largoDescripcion > 0}>
      <summary class="ed1-grupo__titulo">Cómo sale en Google</summary>
      <figure class="en-google__muestra">
        <figcaption class="en-google__direccion">Así se vería en Google</figcaption>
        <p class="en-google__direccion">{direccion}</p>
        <p class="en-google__titulo">{recortar(titulo, LARGO_EN_GOOGLE.titulo)}</p>
        <p class="en-google__descripcion">
          {descripcion
            ? recortar(descripcion, LARGO_EN_GOOGLE.descripcion)
            : 'Sin descripción: Google toma un pedazo de la página.'}
        </p>
      </figure>
      <Texto
        id={`${id}-titulo`}
        etiqueta="Título para buscadores"
        opcional
        valor={valor.titulo}
        alCambiar={(v) => alCambiar({ ...valor, titulo: v })}
        error={errores.titulo}
        ayuda={
          largoTitulo > LARGO_EN_GOOGLE.titulo
            ? `Lleva ${largoTitulo} letras: Google muestra unas ${LARGO_EN_GOOGLE.titulo} y corta el resto.`
            : `Si lo dejas vacío, sale «${tituloDeFabrica}».`
        }
      />
      <div class={`ed1-campo${errores.descripcion ? ' ed1-campo--con-error' : ''}`}>
        <label class="ed1-campo__etiqueta" for={`${id}-descripcion`}>
          Descripción para buscadores<span class="ed1-campo__opcional"> (opcional)</span>
        </label>
        <textarea
          class="ed1-campo__control"
          id={`${id}-descripcion`}
          rows={3}
          value={valor.descripcion}
          aria-invalid={errores.descripcion ? 'true' : undefined}
          aria-describedby={`${id}-descripcion-ayuda${errores.descripcion ? ` ${id}-descripcion-error` : ''}`}
          onInput={(e) =>
            alCambiar({ ...valor, descripcion: (e.target as HTMLTextAreaElement).value })
          }
        />
        <p class="ed1-campo__ayuda" id={`${id}-descripcion-ayuda`}>
          {largoDescripcion > LARGO_EN_GOOGLE.descripcion
            ? `Lleva ${largoDescripcion} letras: Google muestra unas ${LARGO_EN_GOOGLE.descripcion} y corta el resto.`
            : 'Una o dos frases que inviten a entrar. Si la dejas vacía, sale el comienzo de la descripción.'}
        </p>
        {errores.descripcion ? (
          <p class="ed1-campo__error" id={`${id}-descripcion-error`}>
            {errores.descripcion}
          </p>
        ) : null}
      </div>
    </details>
  );
}
