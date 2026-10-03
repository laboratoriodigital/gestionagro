/**
 * Etiqueta QR de un lote para imprimir en 5 × 5 cm (HU-E6.4, CA4). Con señal y la finca en la
 * nube sale «verificada»; si no, «sin confirmar», con el motivo, y se puede volver a generar
 * después. Al imprimir solo sale la etiqueta.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
import { type Etiqueta, etiquetaDelLote } from '../almacen/etiqueta.ts';
import { funcionActiva } from '../almacen/funciones.ts';
import type { Lote } from '../almacen/lotes.ts';
import { guardarLogo, leerLogo, prepararLogo, quitarLogo } from '../almacen/marca.ts';
import {
  estadoDeSesion,
  leerSesion,
  planDeLaFinca,
  renovarSiHaceFalta,
  urlDelCore,
} from '../almacen/sesion.ts';
import { estadoDelVinculo } from '../almacen/vinculo.ts';
import { CodigoQr, imagenDeEtiqueta } from '../componentes/CodigoQr.tsx';
import { descargar } from '../descargar.ts';
import { fechaHora } from '../formato.ts';

/**
 * La nube que firma la etiqueta, o por qué no se puede ahora: el motivo se muestra tal cual, con
 * lo que hay que hacer (revisión del dueño, 3 oct 2026: «Intentar confirmar» parecía no hacer nada).
 */
async function nube(): Promise<{ api: string; acceso: string } | { motivo: string }> {
  const db = cuaderno();
  if (!navigator.onLine) return { motivo: 'No hay señal. Inténtalo cuando la haya.' };
  let sesion = await leerSesion(db);
  if (!sesion) {
    return { motivo: 'Para confirmarla, entra con tu cuenta y sube tu finca a la nube en Cuenta.' };
  }
  if (estadoDeSesion(sesion, Date.now()) === 'por-renovar') {
    sesion = (await renovarSiHaceFalta(db, urlDelCore(location.hostname))).sesion;
  }
  if (!sesion || estadoDeSesion(sesion, Date.now()) !== 'activa') {
    return { motivo: 'Tu sesión venció: vuelve a entrar con tu cuenta en Cuenta.' };
  }
  if ((await estadoDelVinculo(db, sesion)) !== 'vinculada' || !sesion.url_api) {
    return {
      motivo:
        'Esta finca todavía no está en la nube: súbela en Cuenta y después vuelve a intentarlo.',
    };
  }
  return { api: sesion.url_api, acceso: sesion.acceso };
}

/**
 * Imprime solo la etiqueta: la copia a #impresion, en la raíz de la página, y la hoja de estilo
 * de impresión quita todo lo demás (`estilos.css`). Una sola hoja de 5 × 5 cm.
 */
function imprimir(etiqueta: HTMLElement | null) {
  if (!etiqueta) return;
  document.getElementById('impresion')?.remove();
  const contenedor = document.createElement('div');
  contenedor.id = 'impresion';
  contenedor.append(etiqueta.cloneNode(true));
  document.body.append(contenedor);
  document.documentElement.classList.add('imprimiendo');
  const limpiar = () => {
    document.documentElement.classList.remove('imprimiendo');
    contenedor.remove();
  };
  // En el teléfono el diálogo es asíncrono: se limpia cuando termina.
  window.addEventListener('afterprint', limpiar, { once: true });
  window.print();
}

/**
 * Compartir con el menú nativo del teléfono (Web Share API): la etiqueta como imagen y el enlace,
 * para mandarla por WhatsApp o guardarla. Donde no se pueden compartir archivos, se comparte el
 * enlace; donde no hay menú de compartir (un computador), se descarga la imagen y se copia el
 * enlace. Devuelve qué pasó.
 */
async function compartir(e: Etiqueta, logo: string | null): Promise<string> {
  const titulo = `Lote ${e.datos.l} · ${e.datos.f}`;
  const texto = `${titulo}. De dónde viene: ${e.enlace}`;
  try {
    const imagen = await imagenDeEtiqueta({
      enlace: e.enlace,
      codigo: e.datos.l,
      finca: e.datos.f,
      estado: e.firmada ? 'Verificado' : 'Sin confirmar',
      logo,
    });
    if (navigator.share) {
      const archivo = new File([imagen], `lote-${e.datos.l}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [archivo] })) {
        await navigator.share({ title: titulo, text: texto, files: [archivo] });
      } else {
        await navigator.share({ title: titulo, text: texto, url: e.enlace });
      }
      return '';
    }
    // En un computador: la imagen a las descargas y el enlace al portapapeles.
    descargar(`lote-${e.datos.l}.png`, new Uint8Array(await imagen.arrayBuffer()), 'image/png');
    await navigator.clipboard.writeText(e.enlace).catch(() => undefined);
    return 'La imagen de la etiqueta quedó en tus descargas y el enlace, copiado: adjúntala o pégalo donde quieras compartirlo.';
  } catch (error) {
    // Cerrar el menú sin elegir no es un error.
    if (error instanceof DOMException && error.name === 'AbortError') return '';
    return 'No se pudo compartir. Prueba con «Imprimir» o con el enlace de arriba.';
  }
}

export function EtiquetaQr(props: { lote: Lote; alCerrar: () => void }) {
  const [etiqueta, setEtiqueta] = useState<Etiqueta | null>(null);
  const [intento, setIntento] = useState(0);
  const [intentando, setIntentando] = useState(false);
  const [ultimoIntento, setUltimoIntento] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  const etiquetaRef = useRef<HTMLDivElement>(null);
  // El logo de la finca (plan Finca, revisión del dueño, 3 oct 2026).
  const [conMarca, setConMarca] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const [avisoLogo, setAvisoLogo] = useState<string | null>(null);
  useEffect(() => {
    const db = cuaderno();
    void (async () => {
      setConMarca(funcionActiva('marca_en_etiqueta', planDeLaFinca(await leerSesion(db))));
      setLogo(await leerLogo(db));
    })();
  }, []);
  const elegirLogo = async (archivo: File | undefined) => {
    if (!archivo) return;
    setAvisoLogo(null);
    try {
      const dataUrl = await prepararLogo(archivo);
      await guardarLogo(cuaderno(), dataUrl);
      setLogo(dataUrl);
    } catch (e) {
      setAvisoLogo(e instanceof Error ? e.message : 'No se pudo usar esa imagen.');
    }
  };
  const marca = conMarca ? logo : null;
  useEffect(() => {
    void (async () => {
      const n = await nube();
      const lista = await etiquetaDelLote(cuaderno(), props.lote, {
        origen: location.origin,
        nube: 'motivo' in n ? null : n,
      });
      // El motivo de la nube es más preciso que el genérico del almacén.
      setEtiqueta(lista.firmada || !('motivo' in n) ? lista : { ...lista, motivo: n.motivo });
      if (intento > 0) setUltimoIntento(fechaHora(new Date().toISOString()));
      setIntentando(false);
    })();
  }, [props.lote.registro.id, intento]);

  if (!etiqueta) return <p class="ayuda">Preparando la etiqueta…</p>;
  const d = etiqueta.datos;
  return (
    <div class="etiqueta" data-prueba="etiqueta-qr">
      <div class="etiqueta-imprimible" ref={etiquetaRef}>
        <CodigoQr texto={etiqueta.enlace} titulo={`Código QR del lote ${d.l}`} />
        <p class="etiqueta-codigo">
          {marca && <img class="etiqueta-logo" src={marca} alt={`Logo de ${d.f}`} />}
          {d.l}
        </p>
        <p class="etiqueta-finca">{d.f}</p>
        <p class="etiqueta-estado">{etiqueta.firmada ? 'Verificado' : 'Sin confirmar'}</p>
      </div>
      <p
        class={etiqueta.firmada ? 'exito' : 'ayuda'}
        data-prueba="estado-etiqueta"
        role="status"
        aria-live="polite"
      >
        {etiqueta.firmada
          ? 'Etiqueta verificada por la nube: quien la escanee verá «Verificado por Gestión Agro».'
          : ultimoIntento
            ? `Se intentó a las ${ultimoIntento.slice(11)} y sigue sin confirmar. ${etiqueta.motivo ?? ''}`
            : etiqueta.motivo}
      </p>
      <p>
        <a href={etiqueta.enlace} target="_blank" rel="noopener" data-prueba="enlace-qr">
          Ver lo que verá quien la escanee
        </a>
      </p>
      <div class="acciones">
        <button type="button" class="secundario" onClick={props.alCerrar}>
          Cerrar
        </button>
        {!etiqueta.firmada && (
          <button
            type="button"
            class="secundario"
            disabled={intentando}
            onClick={() => {
              setIntentando(true);
              setIntento(intento + 1);
            }}
          >
            {intentando ? 'Intentando…' : 'Intentar confirmar'}
          </button>
        )}
        <button
          type="button"
          class="secundario"
          onClick={() => void compartir(etiqueta, marca).then(setAviso)}
        >
          Compartir
        </button>
        <button type="button" onClick={() => imprimir(etiquetaRef.current)}>
          Imprimir
        </button>
      </div>
      <div class="logo-etiqueta" data-prueba="logo-etiqueta">
        {conMarca ? (
          <>
            <label class="boton secundario">
              {logo ? 'Cambiar el logo de la finca' : 'Poner el logo de la finca'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                class="solo-lectores"
                onChange={(e) => void elegirLogo((e.currentTarget as HTMLInputElement).files?.[0])}
              />
            </label>
            {logo && (
              <button
                type="button"
                class="secundario"
                onClick={() =>
                  void quitarLogo(cuaderno()).then(() => {
                    setLogo(null);
                  })
                }
              >
                Quitar el logo
              </button>
            )}
            {avisoLogo && (
              <p class="error" role="alert">
                {avisoLogo}
              </p>
            )}
          </>
        ) : (
          <p class="ayuda">
            El logo de tu finca en la etiqueta viene con el plan Finca.{' '}
            <a href="/agro/app/planes/">Ver los planes</a>
          </p>
        )}
      </div>
      {aviso && (
        <p class="ayuda" role="status" data-prueba="aviso-compartir">
          {aviso}
        </p>
      )}
    </div>
  );
}
