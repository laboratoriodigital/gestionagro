/**
 * La hoja «¿Qué vas a anotar?» (HU-E0.11): se abre con el botón del centro de la barra y lleva a
 * Registrar con el formulario elegido. Es un `<dialog>` del navegador: el foco queda dentro, Esc
 * la cierra y el lector de pantalla la anuncia. Lo que más anota la finca sale primero.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { cuaderno } from '../almacen/abierto.ts';
import { ultimosRegistros } from '../almacen/consultas.ts';
import { leerFinca } from '../almacen/finca.ts';
import { pedirAnotar, porUso, TIPOS, type TipoRegistro } from '../anotar.ts';
import { rutaDe } from '../rutas.ts';
import { Icono } from './Iconos.tsx';

/** Cuántos registros recientes deciden el orden. */
const RECIENTES = 50;

export function Anotar(props: { abierta: boolean; alCerrar: () => void }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const { route } = useLocation();
  const [orden, setOrden] = useState<(typeof TIPOS)[number][]>([...TIPOS]);

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (props.abierta && !d.open) {
      d.showModal();
      void (async () => {
        const db = cuaderno();
        const finca = (await leerFinca(db))?.finca;
        if (!finca) return;
        const recientes = await ultimosRegistros(
          db,
          finca.id,
          TIPOS.map((t) => t.id),
          RECIENTES,
        );
        setOrden(porUso(recientes));
      })();
    }
    if (!props.abierta && d.open) d.close();
  }, [props.abierta]);

  const elegir = (tipo: TipoRegistro) => {
    pedirAnotar(tipo);
    props.alCerrar();
    route(rutaDe('registrar'));
  };

  return (
    <dialog
      ref={dialogo}
      class="hoja-anotar"
      aria-labelledby="titulo-anotar"
      onClose={props.alCerrar}
      data-prueba="hoja-anotar"
    >
      <div class="hoja-anotar__cuerpo">
        <h2 id="titulo-anotar">¿Qué vas a anotar?</h2>
        <p class="ayuda">Se guarda en este teléfono, con o sin señal.</p>
        <ul class="hoja-anotar__tipos">
          {orden.map((t) => (
            <li key={t.id}>
              <button type="button" class="tipo-anotar" onClick={() => elegir(t.id)}>
                <Icono nombre={t.id} />
                {t.titulo}
              </button>
            </li>
          ))}
        </ul>
        <p class="ayuda">Lo que más anotas sale primero.</p>
        <button type="button" class="secundario hoja-anotar__cerrar" onClick={props.alCerrar}>
          Cerrar
        </button>
      </div>
    </dialog>
  );
}
