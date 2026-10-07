/**
 * El asistente de la impresora (HU-Q2.6, PARQUEADERO §7.7): el equipo, vincular, la página de
 * prueba y tres preguntas. Una pantalla por paso, con «Siguiente» grande abajo.
 */
import {
  ajustesDesdeRespuestas,
  paginaDePrueba,
  type RespuestasDePrueba,
  TEXTO_DEL_MOTIVO,
} from '@ed1/impresion';
import { useEffect, useState } from 'preact/hooks';
import { abrirFormulario } from './actividad.ts';
import { BotonDiagnostico, textoDeFallo } from './conexion.tsx';
import type { BaseDeLaCaja } from './datos.ts';
import { fechaBogota } from './fecha.ts';
import type { ControlDeImpresora } from './impresora.ts';
import type { Propuesta } from './senales.ts';

/** Lo que lleva el QR de la página de prueba: un enlace corto, como el del papel (§6.3). */
export const QR_DE_PRUEBA = 'https://parqueadero.laboratorio-digital.app/r/#prueba';

interface Props {
  readonly db: BaseDeLaCaja;
  readonly control: ControlDeImpresora;
  readonly propuesta: Propuesta;
  readonly reloj: () => number;
  readonly alTerminar: () => void;
}

type Paso = 1 | 2 | 3 | 4 | 'listo';

const LINEAS = [1, 2, 3, 4] as const;
type QrVisto = 'los-dos' | 'nativo' | 'imagen' | 'ninguno';

export function Asistente({ db, control, propuesta, reloj, alTerminar }: Props) {
  const [paso, setPaso] = useState<Paso>(1);
  const [nombre, setNombre] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const [linea, setLinea] = useState<RespuestasDePrueba['lineaLegible'] | undefined>(undefined);
  const [qr, setQr] = useState<QrVisto | undefined>(undefined);
  const [regla, setRegla] = useState<boolean | undefined>(undefined);
  const [resumen, setResumen] = useState('');

  // Un asistente abierto es un formulario: una versión nueva no recarga la caja (HU-Q3.1 CA3).
  useEffect(() => abrirFormulario(), []);

  async function conectar(verTodos: boolean) {
    setOcupado(true);
    setAviso('');
    try {
      const v = await control.conectar(verTodos);
      setNombre(v.nombre);
    } catch (e) {
      setAviso(textoDeFallo(e));
    } finally {
      setOcupado(false);
    }
  }

  async function imprimirPrueba() {
    setOcupado(true);
    setAviso('');
    const r = await control.imprimir(paginaDePrueba(fechaBogota(reloj()), QR_DE_PRUEBA), {
      paginaDeCodigos: 'cp850',
      qr: 'nativo',
      columnas: 32,
      avanceFinal: 3,
    });
    setOcupado(false);
    if (r.ok) setEnviada(true);
    else setAviso(TEXTO_DEL_MOTIVO[r.motivo]);
  }

  async function guardar() {
    if (linea === undefined || qr === undefined || regla === undefined) return;
    const ajustes = ajustesDesdeRespuestas({
      lineaLegible: linea,
      qrNativoLee: qr === 'los-dos' || qr === 'nativo',
      qrImagenLee: qr === 'los-dos' || qr === 'imagen',
      reglaCabe: regla,
    });
    const probada = ajustes.qr !== null;
    await db.impresora.update('actual', {
      paginaDeCodigos: ajustes.paginaDeCodigos,
      qr: ajustes.qr ?? 'nativo',
      columnas: ajustes.columnas,
      probada,
      ...(probada ? { probadaEn: reloj() } : {}),
    });
    setResumen(
      [
        ajustes.paginaDeCodigos === 'transliterar'
          ? 'Ninguna línea con tildes se vio bien: la caja imprimirá sin tildes («a», «n»).'
          : `Las tildes salen con la línea ${linea}.`,
        ajustes.qr === null
          ? 'Ningún QR se leyó: la impresora queda sin probar. Revise el papel y repita la prueba.'
          : `El QR sale ${ajustes.qr === 'nativo' ? 'con el comando de la impresora' : 'como imagen'}.`,
        regla ? '' : 'La regla no cupo: la caja usará 30 columnas.',
      ]
        .filter(Boolean)
        .join(' '),
    );
    setPaso('listo');
  }

  const faltaRespuesta =
    linea === undefined
      ? 'Falta decir qué línea se lee'
      : qr === undefined
        ? 'Falta decir qué QR lee el teléfono'
        : regla === undefined
          ? 'Falta decir si la regla cabe'
          : '';

  return (
    <section class="asistente" data-prueba="asistente" aria-live="polite">
      {paso === 1 && (
        <>
          <h2>1 de 4 · El equipo</h2>
          <p data-prueba="propuesta">{propuesta.mensaje}</p>
          <button
            type="button"
            class="boton boton-principal"
            disabled={propuesta.camino === null}
            onClick={() => setPaso(2)}
          >
            {propuesta.camino === null ? 'Falta un navegador que pueda imprimir' : 'Siguiente'}
          </button>
        </>
      )}

      {paso === 2 && (
        <>
          <h2>2 de 4 · Conectar la impresora</h2>
          <p>
            Prenda la impresora y téngala cerca. El teléfono le mostrará los equipos que encuentre.
          </p>
          {nombre ? (
            <p class="exito" data-prueba="conectada">
              Conectada: {nombre}
            </p>
          ) : (
            <>
              <button
                type="button"
                class="boton"
                disabled={ocupado}
                onClick={() => void conectar(false)}
              >
                Conectar impresora
              </button>
              <button
                type="button"
                class="boton boton-secundario"
                disabled={ocupado}
                onClick={() => void conectar(true)}
              >
                Ver todos los equipos
              </button>
            </>
          )}
          {aviso && (
            <>
              <p class="error" role="alert" data-prueba="aviso">
                {aviso}
              </p>
              {/* Lo que el adaptador vio, también cuando la impresora no se reconoce. */}
              <BotonDiagnostico key={aviso} control={control} />
            </>
          )}
          <button
            type="button"
            class="boton boton-principal"
            disabled={!nombre}
            onClick={() => setPaso(3)}
          >
            {nombre ? 'Siguiente' : 'Falta conectar la impresora'}
          </button>
        </>
      )}

      {paso === 3 && (
        <>
          <h2>3 de 4 · Página de prueba</h2>
          <p>La impresora va a sacar una regla de números, cuatro líneas con tildes y dos QR.</p>
          <button
            type="button"
            class="boton"
            disabled={ocupado}
            onClick={() => void imprimirPrueba()}
          >
            {enviada ? 'No salió: imprimir otra vez' : 'Imprimir página de prueba'}
          </button>
          {enviada && (
            <p class="exito" data-prueba="enviada">
              Enviado a la impresora.
            </p>
          )}
          {aviso && (
            <>
              <p class="error" role="alert" data-prueba="aviso">
                {aviso}
              </p>
              <BotonDiagnostico key={aviso} control={control} />
            </>
          )}
          <button
            type="button"
            class="boton boton-principal"
            disabled={!enviada}
            onClick={() => setPaso(4)}
          >
            {enviada ? 'Siguiente' : 'Falta imprimir la página de prueba'}
          </button>
        </>
      )}

      {paso === 4 && (
        <>
          <h2>4 de 4 · Mire el papel que acaba de salir</h2>
          <fieldset>
            <legend>¿Qué línea dice completo «Él tenía más años», con sus tildes y la ñ?</legend>
            <p class="ayuda">
              Si a una palabra le falta una letra o sale un signo raro, esa línea no sirve. Si
              ninguna con tildes sirve, toque «Ninguna»: la caja imprimirá sin tildes.
            </p>
            <div class="opciones">
              {LINEAS.map((n) => (
                <button
                  key={n}
                  type="button"
                  class="opcion"
                  aria-pressed={linea === n}
                  onClick={() => setLinea(n)}
                >
                  Línea {n}
                </button>
              ))}
              <button
                type="button"
                class="opcion"
                aria-pressed={linea === null}
                onClick={() => setLinea(null)}
              >
                Ninguna
              </button>
            </div>
          </fieldset>
          <fieldset>
            <legend>¿Los QR se ven cuadrados y su teléfono los lee?</legend>
            <div class="opciones">
              {(
                [
                  ['los-dos', 'Los dos'],
                  ['nativo', 'Solo el de arriba'],
                  ['imagen', 'Solo el de abajo'],
                  ['ninguno', 'Ninguno'],
                ] as const
              ).map(([valor, texto]) => (
                <button
                  key={valor}
                  type="button"
                  class="opcion"
                  aria-pressed={qr === valor}
                  onClick={() => setQr(valor)}
                >
                  {texto}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>¿La regla de números cabe en una sola línea?</legend>
            <div class="opciones">
              <button
                type="button"
                class="opcion"
                aria-pressed={regla === true}
                onClick={() => setRegla(true)}
              >
                Sí
              </button>
              <button
                type="button"
                class="opcion"
                aria-pressed={regla === false}
                onClick={() => setRegla(false)}
              >
                No
              </button>
            </div>
          </fieldset>
          <button
            type="button"
            class="boton boton-principal"
            disabled={faltaRespuesta !== ''}
            onClick={() => void guardar()}
          >
            {faltaRespuesta || 'Guardar'}
          </button>
        </>
      )}

      {paso === 'listo' && (
        <>
          <h2>Impresora configurada</h2>
          <p data-prueba="resumen">{resumen}</p>
          <button type="button" class="boton boton-principal" onClick={alTerminar}>
            Volver a la caja
          </button>
        </>
      )}
    </section>
  );
}
