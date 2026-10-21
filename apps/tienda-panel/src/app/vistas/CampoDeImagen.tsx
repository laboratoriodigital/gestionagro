/**
 * Un campo de imagen en Ajustes (HU-T5.13 y HU-T5.14): el logo, el ícono y la imagen del hero. Se
 * prepara en el teléfono igual que las fotos de un producto (HU-T8.3): sus tamaños, en WebP o JPEG,
 * y su huella. Se sube por `medios/marca` y el campo guarda lo que el horno necesita; se publica al
 * guardar la sección y publicar.
 */
import { useEffect, useState } from 'preact/hooks';
import { type Conexion, pedirAlPanel } from '../api.ts';
import { abrirFoto, derivar, FotoInvalida, formularioDeFoto, huellaDe } from '../fotos.ts';

export function CampoDeImagen({
  id,
  etiqueta,
  ayuda,
  valor,
  error,
  conexion,
  alCambiar,
}: {
  id: string;
  etiqueta: string;
  ayuda?: string | undefined;
  /** La imagen guardada, como texto JSON; vacío si no hay. */
  valor: string;
  error?: string | undefined;
  conexion: Conexion | undefined;
  alCambiar: (v: string) => void;
}) {
  const [vista, setVista] = useState<string | null>(null);
  const [estado, setEstado] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  useEffect(() => () => (vista ? URL.revokeObjectURL(vista) : undefined), [vista]);

  const elegir = async (archivo: File | undefined) => {
    if (!archivo || !conexion) return;
    setSubiendo(true);
    setEstado(null);
    try {
      const foto = await abrirFoto(archivo);
      try {
        const derivadas = await derivar(foto, foto.codificar);
        const huella = await huellaDe(archivo);
        const r = await pedirAlPanel<{ id: string; formato: 'webp' | 'jpeg'; anchos: number[] }>(
          conexion,
          'medios/marca',
          {
            formulario: formularioDeFoto({
              producto: '',
              huella,
              alt: etiqueta,
              original: { ancho: foto.ancho, alto: foto.alto },
              derivadas,
            }),
          },
        );
        if (r.tipo !== 'ok') {
          setEstado(r.tipo === 'sin-sesion' ? r.motivo : (r.problemas?.[0]?.mensaje ?? r.motivo));
          return;
        }
        setVista(URL.createObjectURL(archivo));
        alCambiar(
          JSON.stringify({
            huella: r.datos.id,
            formato: r.datos.formato,
            ancho: foto.ancho,
            alto: foto.alto,
            anchos: r.datos.anchos,
          }),
        );
        setEstado('Lista. Guarda esta sección y publica para que salga en tu tienda.');
      } finally {
        foto.cerrar();
      }
    } catch (e) {
      setEstado(
        e instanceof FotoInvalida ? e.message : 'No pudimos preparar la imagen. Intenta con otra.',
      );
    } finally {
      setSubiendo(false);
    }
  };

  const describe = [ayuda ? `${id}-ayuda` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');
  return (
    <div class={`ed1-campo campo-de-imagen${error ? ' ed1-campo--con-error' : ''}`}>
      <label class="ed1-campo__etiqueta" for={id}>
        {etiqueta}
      </label>
      {ayuda ? (
        <p class="ed1-campo__ayuda" id={`${id}-ayuda`}>
          {ayuda}
        </p>
      ) : null}
      {vista ? <img src={vista} alt="" /> : null}
      {valor && !vista ? <p class="nota">Ya tienes una. Elige otra para cambiarla.</p> : null}
      <input
        class="ed1-campo__control"
        id={id}
        type="file"
        accept="image/*"
        disabled={subiendo || !conexion}
        aria-busy={subiendo ? 'true' : undefined}
        {...(describe ? { 'aria-describedby': describe } : {})}
        onChange={(e) => void elegir((e.target as HTMLInputElement).files?.[0])}
      />
      {valor ? (
        <button
          class="ed1-boton ed1-boton--secundario"
          type="button"
          onClick={() => {
            setVista(null);
            setEstado('Se quita al guardar esta sección y publicar.');
            alCambiar('');
          }}
        >
          Quitar
        </button>
      ) : null}
      {subiendo ? <p role="status">Preparando la imagen…</p> : null}
      {estado ? <p role="status">{estado}</p> : null}
      {error ? (
        <p class="ed1-campo__error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
