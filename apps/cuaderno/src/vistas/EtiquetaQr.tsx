/**
 * Etiqueta QR de un lote para imprimir en 5 × 5 cm (HU-E6.4, CA4). Con señal y la finca en la
 * nube sale «verificada»; si no, «sin confirmar», con el motivo, y se puede volver a generar
 * después. Al imprimir solo sale la etiqueta.
 */
import { useEffect, useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
import { type Etiqueta, etiquetaDelLote } from '../almacen/etiqueta.ts';
import type { Lote } from '../almacen/lotes.ts';
import { estadoDeSesion, leerSesion } from '../almacen/sesion.ts';
import { estadoDelVinculo } from '../almacen/vinculo.ts';
import { CodigoQr } from '../componentes/CodigoQr.tsx';

async function nube() {
  const db = cuaderno();
  const sesion = await leerSesion(db);
  if (!navigator.onLine || !sesion?.url_api) return null;
  if (estadoDeSesion(sesion, Date.now()) !== 'activa') return null;
  if ((await estadoDelVinculo(db, sesion)) !== 'vinculada') return null;
  return { api: sesion.url_api, acceso: sesion.acceso };
}

export function EtiquetaQr(props: { lote: Lote; alCerrar: () => void }) {
  const [etiqueta, setEtiqueta] = useState<Etiqueta | null>(null);
  const [intento, setIntento] = useState(0);
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
      <div class="etiqueta-imprimible">
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
        <button type="button" onClick={() => window.print()}>
          Imprimir
        </button>
      </div>
    </div>
  );
}
