/**
 * Conectar la impresora desde donde esté el cajero (PARQUEADERO §7.4 pasos 4 a 6, P15): en el
 * inicio y en el recibo que no salió. Si la impresora se soltó, «Reconectar» lo intenta sin
 * selector; si no responde, «Elegir la impresora otra vez» abre el selector con un toque nuevo. Todo
 * aviso deja copiar el diagnóstico (bitácora parqueadero 12 y 18).
 */
import { type EstadoImpresora, FalloDeImpresora, TEXTO_DEL_MOTIVO } from '@ed1/impresion';
import { useEffect, useState } from 'preact/hooks';
import type { ControlDeImpresora } from './impresora.ts';

export function textoDeFallo(e: unknown): string {
  return e instanceof FalloDeImpresora ? TEXTO_DEL_MOTIVO[e.motivo] : 'No se pudo conectar';
}

export const NO_RECONECTO =
  'La impresora no respondió. Revise que esté prendida y cerca, y toque «Elegir la impresora otra vez».';

export function useEstadoImpresora(control: ControlDeImpresora): EstadoImpresora {
  const [estado, setEstado] = useState(control.estado());
  useEffect(() => {
    setEstado(control.estado());
    return control.escuchar(setEstado);
  }, [control]);
  return estado;
}

/** Lo que el adaptador vio, para mandarlo a soporte (§7.4 paso 6). */
export function BotonDiagnostico({ control }: { readonly control: ControlDeImpresora }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    await navigator.clipboard?.writeText(control.diagnostico());
    setCopiado(true);
  }
  return (
    <button type="button" class="boton boton-secundario" onClick={() => void copiar()}>
      {copiado ? 'Diagnóstico copiado' : 'Copiar diagnóstico para soporte'}
    </button>
  );
}

interface Props {
  readonly control: ControlDeImpresora;
  /** Después de conectar o reconectar; el recibo que no salió lo vuelve a mandar. */
  readonly alConectar?: () => void;
  /** El diagnóstico a la vista aunque esta pantalla no haya fallado (el recibo que no salió). */
  readonly conDiagnostico?: boolean;
}

export function ConexionImpresora({ control, alConectar, conDiagnostico = false }: Props) {
  const estado = useEstadoImpresora(control);
  const [aviso, setAviso] = useState('');

  async function elegir() {
    setAviso('');
    try {
      await control.conectar(false);
      alConectar?.();
    } catch (e) {
      setAviso(textoDeFallo(e));
    }
  }

  async function reconectar() {
    setAviso('');
    if (await control.reconectar()) alConectar?.();
    else setAviso(NO_RECONECTO);
  }

  const lista = estado === 'conectada' || estado === 'ocupada';
  if (lista && !aviso && !conDiagnostico) return null;
  return (
    <div class="conexion" data-prueba="conexion-impresora">
      {estado === 'conectando' ? (
        <p role="status">Conectando la impresora…</p>
      ) : estado === 'desconectada' ? (
        <>
          <button type="button" class="boton boton-principal" onClick={() => void reconectar()}>
            Reconectar impresora
          </button>
          <button type="button" class="boton" onClick={() => void elegir()}>
            Elegir la impresora otra vez
          </button>
        </>
      ) : estado === 'sin_vincular' ? (
        <button type="button" class="boton boton-principal" onClick={() => void elegir()}>
          Conectar impresora
        </button>
      ) : null}
      {aviso && (
        <p class="error" role="alert" data-prueba="aviso-impresora">
          {aviso}
        </p>
      )}
      {(aviso || conDiagnostico) && <BotonDiagnostico key={aviso} control={control} />}
    </div>
  );
}
