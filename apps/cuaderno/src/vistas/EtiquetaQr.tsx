/**
 * Etiqueta QR de un lote para imprimir en 5 × 5 cm (HU-E6.4, CA4). Con señal y la finca en la
 * nube sale «verificada»; si no, «sin confirmar», con el motivo, y se puede volver a generar
 * después. Al imprimir solo sale la etiqueta.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
import { type Etiqueta, etiquetaDelLote } from '../almacen/etiqueta.ts';
import type { Lote } from '../almacen/lotes.ts';
import { estadoDeSesion, leerSesion } from '../almacen/sesion.ts';
import { estadoDelVinculo } from '../almacen/vinculo.ts';
import { CodigoQr, imagenDeEtiqueta } from '../componentes/CodigoQr.tsx';

async function nube() {
  const db = cuaderno();
  const sesion = await leerSesion(db);
  if (!navigator.onLine || !sesion?.url_api) return null;
  if (estadoDeSesion(sesion, Date.now()) !== 'activa') return null;
  if ((await estadoDelVinculo(db, sesion)) !== 'vinculada') return null;
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
 * enlace; donde no hay menú de compartir (un computador), se copia el enlace. Devuelve qué pasó.
 */
async function compartir(e: Etiqueta): Promise<string> {
  const titulo = `Lote ${e.datos.l} · ${e.datos.f}`;
  const texto = `${titulo}. De dónde viene: ${e.enlace}`;
  try {
    if (navigator.share) {
      const imagen = await imagenDeEtiqueta({
        enlace: e.enlace,
        codigo: e.datos.l,
        finca: e.datos.f,
        estado: e.firmada ? 'Verificado' : 'Sin confirmar',
      });
      const archivo = new File([imagen], `lote-${e.datos.l}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [archivo] })) {
        await navigator.share({ title: titulo, text: texto, files: [archivo] });
      } else {
        await navigator.share({ title: titulo, text: texto, url: e.enlace });
      }
      return '';
    }
    await navigator.clipboard.writeText(e.enlace);
    return 'Enlace copiado: pégalo donde quieras compartirlo.';
  } catch (error) {
    // Cerrar el menú sin elegir no es un error.
    if (error instanceof DOMException && error.name === 'AbortError') return '';
    return 'No se pudo compartir. Prueba con «Imprimir» o con el enlace de arriba.';
  }
}

export function EtiquetaQr(props: { lote: Lote; alCerrar: () => void }) {
  const [etiqueta, setEtiqueta] = useState<Etiqueta | null>(null);
  const [intento, setIntento] = useState(0);
  const [aviso, setAviso] = useState('');
  const etiquetaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    void (async () => {
      setEtiqueta(
        await etiquetaDelLote(cuaderno(), props.lote, {
          origen: location.origin,
          nube: await nube(),
        }),
      );
    })();
  }, [props.lote.registro.id, intento]);

  if (!etiqueta) return <p class="ayuda">Preparando la etiqueta…</p>;
  const d = etiqueta.datos;
  return (
    <div class="etiqueta" data-prueba="etiqueta-qr">
      <div class="etiqueta-imprimible" ref={etiquetaRef}>
        <CodigoQr texto={etiqueta.enlace} titulo={`Código QR del lote ${d.l}`} />
        <p class="etiqueta-codigo">{d.l}</p>
        <p class="etiqueta-finca">{d.f}</p>
        <p class="etiqueta-estado">{etiqueta.firmada ? 'Verificado' : 'Sin confirmar'}</p>
      </div>
      <p class={etiqueta.firmada ? 'exito' : 'ayuda'} data-prueba="estado-etiqueta">
        {etiqueta.firmada
          ? 'Etiqueta verificada por la nube: quien la escanee verá «Verificado por Gestión Agro».'
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
          <button type="button" class="secundario" onClick={() => setIntento(intento + 1)}>
            Intentar confirmar
          </button>
        )}
        <button
          type="button"
          class="secundario"
          onClick={() => void compartir(etiqueta).then(setAviso)}
        >
          Compartir
        </button>
        <button type="button" onClick={() => imprimir(etiquetaRef.current)}>
          Imprimir
        </button>
      </div>
      {aviso && (
        <p class="ayuda" role="status" data-prueba="aviso-compartir">
          {aviso}
        </p>
      )}
    </div>
  );
}
