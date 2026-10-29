/**
 * HU-P4.1 (sprint PF3): los temas listos, arriba de «Apariencia». Elegir uno llena el color, la
 * tinta, el estilo, la portada y la forma de las fotos en el formulario; nada se guarda hasta
 * «Guardar», y cada campo se puede cambiar después. Después de guardar, la vista previa de
 * «Publicar» muestra la tienda con el tema.
 */
import { TEMAS_LISTOS, temaDe, valoresDelTema } from '@ed1/tienda-schema/temas';

export function TemasListos({
  valores,
  alElegir,
}: {
  valores: Record<string, string>;
  alElegir: (campos: Record<string, string>) => void;
}) {
  const actual = temaDe(valores);
  return (
    <fieldset class="ed1-grupo temas">
      <legend class="ed1-grupo__titulo">Temas listos</legend>
      <p class="ed1-campo__ayuda">
        Elige uno y ajusta lo que quieras abajo. Se ve en tu tienda al guardar y abrir la{' '}
        <a href="/mas/publicar/">vista previa</a>.
      </p>
      <ul class="temas__lista">
        {TEMAS_LISTOS.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              class="tema"
              aria-pressed={actual?.id === t.id ? 'true' : 'false'}
              onClick={() => alElegir(valoresDelTema(t, valores['modo']))}
            >
              <span
                class={`tema__muestra tema__muestra--${t.estilo}`}
                style={{ '--muestra': valoresDelTema(t, valores['modo'])['acento'] }}
                aria-hidden="true"
              >
                Aa
              </span>
              <span class="tema__nombre">{t.nombre}</span>
              <span class="tema__para">{t.para}</span>
            </button>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
