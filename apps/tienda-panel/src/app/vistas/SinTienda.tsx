/**
 * Sin tienda (HU-T8.1): la cuenta entró bien, pero todavía no tiene una tienda. No es un error.
 * HU-T13.4: desde aquí el comercio abre la suya, en minutos y desde el teléfono: el nombre, la
 * dirección (que dice al escribir si está libre) y la verificación de Turnstile. Después vienen los
 * términos, los datos legales, el WhatsApp, el primer producto y publicar, en el panel de siempre.
 */
import { leerDireccion, sugerirDireccion } from '@ed1/tienda-schema/alta';
import { ResumenDeErrores } from '@ed1/ui/v2/componentes';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { abrirMiTienda, consultarDireccion, type Disponibilidad } from '../alta.ts';
import type { Conexion } from '../api.ts';
import type { Sesion } from '../sesion.ts';

declare global {
  interface Window {
    turnstile?: {
      render(
        el: HTMLElement,
        o: {
          sitekey: string;
          language: string;
          callback: (t: string) => void;
          'expired-callback': () => void;
          'error-callback': () => void;
        },
      ): string;
      reset(id?: string): void;
    };
  }
}

/** El id de la caja de la verificación, al que lleva el resumen de errores. */
const CAMPO_DE_LA_VERIFICACION = 'verificacion';

/** El programa de Turnstile, una sola vez, solo cuando hace falta. */
function cargarTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  return new Promise((listo, mal) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => listo();
    s.onerror = () => mal(new Error('Turnstile no cargó'));
    document.head.append(s);
  });
}

/**
 * La verificación de Turnstile. Si su programa no carga, o la verificación falla o vence, lo dice:
 * sin eso, el comercio toca la casilla y no pasa nada (validación del 20 oct 2026).
 */
function Turnstile({
  clave,
  alResolver,
  alFallar,
}: {
  clave: string;
  alResolver: (t: string | null) => void;
  alFallar: (mensaje: string) => void;
}) {
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let vivo = true;
    cargarTurnstile().then(
      () => {
        if (vivo && caja.current && window.turnstile)
          window.turnstile.render(caja.current, {
            sitekey: clave,
            language: 'es',
            callback: alResolver,
            'expired-callback': () => alResolver(null),
            'error-callback': () => {
              alResolver(null);
              alFallar(
                'No pudimos confirmar que eres una persona. Recarga la página e intenta otra vez.',
              );
            },
          });
      },
      () => alFallar('No cargó la verificación. Revisa la señal y recarga la página.'),
    );
    return () => {
      vivo = false;
    };
  }, [clave, alResolver, alFallar]);
  // Nunca `id="turnstile"`: el navegador lo volvería `window.turnstile` y taparía el programa.
  return <div ref={caja} class="turnstile" id={CAMPO_DE_LA_VERIFICACION} tabIndex={-1} />;
}

function AbrirMiTienda({
  conexion,
  alAbrir,
  alVencer,
}: {
  conexion: Conexion;
  alAbrir: (sesion: Sesion) => void;
  alVencer: (motivo: string) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [slug, setSlug] = useState('');
  const [tocada, setTocada] = useState(false);
  const [libre, setLibre] = useState<Disponibilidad | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<{ campo: string; mensaje: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  // La dirección sale del nombre hasta que el comercio la escribe a su gusto.
  useEffect(() => {
    if (!tocada) setSlug(sugerirDireccion(nombre));
  }, [nombre, tocada]);
  useEffect(() => {
    if (!slug) {
      setLibre(null);
      return;
    }
    const leida = leerDireccion(slug);
    if (!leida.ok) {
      setLibre({ disponible: false, motivo: leida.motivo, turnstile: null });
      return;
    }
    const id = setTimeout(() => {
      consultarDireccion(conexion, leida.slug).then(setLibre, (e: Error) => alVencer(e.message));
    }, 400);
    return () => clearTimeout(id);
  }, [slug, conexion, alVencer]);

  const alFallarTurnstile = useCallback(
    (mensaje: string) => setError({ campo: CAMPO_DE_LA_VERIFICACION, mensaje }),
    [],
  );

  const enviar = async (e: Event) => {
    e.preventDefault();
    setError(null);
    if (nombre.trim().length < 2)
      return setError({ campo: 'nombre', mensaje: 'Escribe el nombre de tu tienda.' });
    if (!libre?.disponible)
      return setError({ campo: 'slug', mensaje: libre?.motivo ?? 'Elige una dirección.' });
    if (!libre.turnstile)
      return setError({
        campo: 'nombre',
        mensaje: 'Abrir una tienda todavía no está disponible. Intenta más tarde.',
      });
    if (!token)
      return setError({
        campo: CAMPO_DE_LA_VERIFICACION,
        mensaje: 'Toca la casilla «Confirma que eres una persona» y espera el visto bueno.',
      });
    setEnviando(true);
    try {
      const r = await abrirMiTienda(conexion, {
        nombre: nombre.trim(),
        slug: libre.slug,
        turnstile: token,
      });
      if (r.tipo === 'abierta') return alAbrir(r.sesion);
      setError({
        campo: r.campo === 'turnstile' ? CAMPO_DE_LA_VERIFICACION : r.campo,
        mensaje: r.mensaje,
      });
      setToken(null);
      window.turnstile?.reset();
    } catch (err) {
      alVencer((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const conError = (campo: string) =>
    `ed1-campo${error?.campo === campo ? ' ed1-campo--con-error' : ''}`;
  return (
    <form class="formulario" onSubmit={enviar} noValidate>
      {error ? <ResumenDeErrores errores={[error]} /> : null}
      <div class={conError('nombre')}>
        <label class="ed1-campo__etiqueta" for="nombre">
          El nombre de tu tienda
        </label>
        <input
          class="ed1-campo__control"
          id="nombre"
          autocomplete="organization"
          maxLength={80}
          value={nombre}
          onInput={(ev) => setNombre((ev.target as HTMLInputElement).value)}
        />
      </div>
      <div class={conError('slug')}>
        <label class="ed1-campo__etiqueta" for="slug">
          Su dirección
        </label>
        <input
          class="ed1-campo__control cifra"
          id="slug"
          autocomplete="off"
          autocapitalize="none"
          spellcheck={false}
          maxLength={40}
          value={slug}
          aria-describedby="slug-estado"
          onInput={(ev) => {
            setTocada(true);
            setSlug((ev.target as HTMLInputElement).value);
          }}
        />
        <p class="ed1-campo__ayuda" id="slug-estado" role="status">
          {libre?.disponible
            ? `Libre: tu tienda será ${libre.direccion}`
            : (libre?.motivo ?? 'Letras sin tildes, números y guiones.')}
        </p>
      </div>
      {libre?.disponible && libre.turnstile ? (
        <Turnstile clave={libre.turnstile} alResolver={setToken} alFallar={alFallarTurnstile} />
      ) : null}
      {libre?.disponible && !libre.turnstile ? (
        <p class="nota">Abrir una tienda todavía no está disponible. Intenta más tarde.</p>
      ) : null}
      <button
        class="ed1-boton ed1-boton--primario"
        type="submit"
        disabled={enviando}
        aria-busy={enviando ? 'true' : undefined}
      >
        Abrir mi tienda
      </button>
    </form>
  );
}

export function SinTienda({
  correo,
  conexion,
  alAbrir,
  alVencer,
  alSalir,
}: {
  correo: string;
  conexion: Conexion;
  alAbrir: (sesion: Sesion) => void;
  alVencer: (motivo: string) => void;
  alSalir: () => void;
}) {
  return (
    <main class="portada">
      <h1>Abre tu tienda</h1>
      <p class="portada__entrada">
        Entraste como <span class="cifra">{correo}</span>. En unos minutos tienes tu tienda en
        internet: dale un nombre y una dirección, y luego agregas tus productos. Si alguien te
        invitó a su tienda, abre el enlace de la invitación con esta cuenta.
      </p>
      <AbrirMiTienda conexion={conexion} alAbrir={alAbrir} alVencer={alVencer} />
      <button class="ed1-boton ed1-boton--secundario" type="button" onClick={alSalir}>
        Entrar con otra cuenta
      </button>
    </main>
  );
}
