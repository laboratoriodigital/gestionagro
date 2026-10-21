/**
 * HU-T8.3: las fotos de un producto, desde el teléfono. La foto se comprime aquí y solo suben sus
 * derivadas (CA1); el texto alternativo es obligatorio y se pide antes de subir.
 */
import { Aviso } from '@ed1/ui/v2/componentes';
import { useEffect, useState } from 'preact/hooks';
import { type Conexion, pedirAlPanel } from '../api.ts';
import type { ProductoDelPanel } from '../catalogo.ts';
import { Confirmar } from '../componentes/index.ts';
import { abrirFoto, derivar, FotoInvalida, formularioDeFoto, huellaDe } from '../fotos.ts';

export function Fotos({
  conexion,
  producto,
  alCambiar,
  alVencer,
}: {
  conexion: Conexion;
  producto: ProductoDelPanel;
  alCambiar: () => void;
  alVencer: (motivo: string) => void;
}) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [alt, setAlt] = useState('');
  const [error, setError] = useState<{ campo: 'foto' | 'alt'; mensaje: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  // La vista previa es un `blob:` de este teléfono; se suelta al cambiar de foto.
  useEffect(() => {
    if (!archivo) return;
    const url = URL.createObjectURL(archivo);
    setVista(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  const subir = async () => {
    setAviso(null);
    if (!archivo) {
      setError({ campo: 'foto', mensaje: 'Elige una foto.' });
      return;
    }
    if (alt.trim().length < 3) {
      setError({
        campo: 'alt',
        mensaje: 'Describe la foto en pocas palabras, para quien no la puede ver.',
      });
      return;
    }
    setError(null);
    setSubiendo(true);
    try {
      const foto = await abrirFoto(archivo);
      try {
        const derivadas = await derivar(foto, foto.codificar);
        const r = await pedirAlPanel(conexion, 'medios/subir', {
          formulario: formularioDeFoto({
            producto: producto.id,
            huella: await huellaDe(archivo),
            alt: alt.trim(),
            original: { ancho: foto.ancho, alto: foto.alto },
            derivadas,
          }),
        });
        if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
        if (r.tipo !== 'ok') {
          const p = r.problemas?.[0];
          setError({ campo: p?.campo === 'alt' ? 'alt' : 'foto', mensaje: p?.mensaje ?? r.motivo });
          return;
        }
        setArchivo(null);
        setVista(null);
        setAlt('');
        setAviso('Foto subida. Se ve en la tienda la próxima vez que se publique.');
        alCambiar();
      } finally {
        foto.cerrar();
      }
    } catch (e) {
      setError({
        campo: 'foto',
        mensaje:
          e instanceof FotoInvalida ? e.message : 'No pudimos preparar la foto. Intenta otra vez.',
      });
    } finally {
      setSubiendo(false);
    }
  };

  // HU-T5.9: la foto de una combinación; al elegirla en la tienda, se muestra esta.
  const asignar = async (id: string, variante: string) => {
    const r = await pedirAlPanel(conexion, 'medios/variante', {
      cuerpo: { producto: producto.id, id, variante: variante || null },
    });
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') {
      setAviso(r.motivo);
      return;
    }
    setAviso('Listo: la tienda la muestra con esa combinación cuando publiques.');
    alCambiar();
  };
  const combinaciones = producto.variantes.filter((v) => v.valores.length > 0);

  const quitar = async (id: string) => {
    const r = await pedirAlPanel(conexion, 'medios/quitar', {
      cuerpo: { producto: producto.id, id },
    });
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') {
      setAviso(r.motivo);
      return;
    }
    alCambiar();
  };

  return (
    <section class="fotos" aria-labelledby="fotos-titulo">
      <h2 id="fotos-titulo">Fotos</h2>
      <p class="nota">
        Se comprimen en este teléfono antes de subir: la foto original no sale de aquí.
      </p>
      {producto.medios.length > 0 ? (
        <ul class="fotos__lista">
          {producto.medios.map((m) => (
            <li key={m.id} class="fotos__foto">
              {m.src ? (
                <img
                  src={m.src}
                  alt={m.alt}
                  width={160}
                  height={Math.round((160 * m.alto) / m.ancho)}
                />
              ) : null}
              <span class="nota">{m.alt}</span>
              {combinaciones.length > 0 ? (
                <label class="ed1-campo" for={`foto-de-${m.id}`}>
                  <span class="ed1-campo__etiqueta">Se muestra con</span>
                  <select
                    class="ed1-campo__control"
                    id={`foto-de-${m.id}`}
                    value={m.varianteId ?? ''}
                    onChange={(e) => void asignar(m.id, (e.target as HTMLSelectElement).value)}
                  >
                    <option value="">Todas las combinaciones</option>
                    {combinaciones.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.valores.join(' · ')}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <Confirmar
                abrir="Quitar foto"
                consecuencia="La foto deja de verse en este producto."
                confirmar="Sí, quitarla"
                alConfirmar={() => quitar(m.id)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p>Todavía no tiene fotos.</p>
      )}
      {aviso ? (
        <Aviso tono="info" titulo="Fotos">
          {aviso}
        </Aviso>
      ) : null}
      <div class={`ed1-campo${error?.campo === 'foto' ? ' ed1-campo--con-error' : ''}`}>
        <label class="ed1-campo__etiqueta" for="foto-nueva">
          Agregar una foto
        </label>
        <input
          class="ed1-campo__control"
          id="foto-nueva"
          type="file"
          accept="image/*"
          aria-invalid={error?.campo === 'foto' ? 'true' : undefined}
          aria-describedby={error?.campo === 'foto' ? 'foto-nueva-error' : undefined}
          onChange={(e) => {
            setError(null);
            setArchivo((e.target as HTMLInputElement).files?.[0] ?? null);
          }}
        />
        {error?.campo === 'foto' ? (
          <p class="ed1-campo__error" id="foto-nueva-error">
            {error.mensaje}
          </p>
        ) : null}
      </div>
      {vista ? <img class="fotos__vista" src={vista} alt="" /> : null}
      <div class={`ed1-campo${error?.campo === 'alt' ? ' ed1-campo--con-error' : ''}`}>
        <label class="ed1-campo__etiqueta" for="foto-alt">
          Describe la foto
        </label>
        <input
          class="ed1-campo__control"
          id="foto-alt"
          type="text"
          value={alt}
          aria-invalid={error?.campo === 'alt' ? 'true' : undefined}
          aria-describedby={`foto-alt-ayuda${error?.campo === 'alt' ? ' foto-alt-error' : ''}`}
          onInput={(e) => setAlt((e.target as HTMLInputElement).value)}
        />
        <p class="ed1-campo__ayuda" id="foto-alt-ayuda">
          Por ejemplo: «Camisa de lino arena, de frente». La leen quienes no ven la foto y Google.
        </p>
        {error?.campo === 'alt' ? (
          <p class="ed1-campo__error" id="foto-alt-error">
            {error.mensaje}
          </p>
        ) : null}
      </div>
      <button
        class="ed1-boton ed1-boton--secundario"
        type="button"
        disabled={subiendo}
        aria-busy={subiendo ? 'true' : undefined}
        onClick={() => void subir()}
      >
        {subiendo ? 'Subiendo la foto…' : 'Subir foto'}
      </button>
    </section>
  );
}
