/**
 * La pantalla del recibo (PARQUEADERO §5.1 y §6.5): lo que dice, y las formas de entregarlo. Si la
 * sede imprime siempre, sale solo (HU-Q3.3 CA2); si no sale, queda en entregas pendientes (CA4).
 * Un recibo nunca dice «Impreso»: dice «Enviado a la impresora» (HU-Q3.6 CA3).
 */
import { FalloDeImpresora, TEXTO_DEL_MOTIVO } from '@ed1/impresion';
import {
  armarRecibo,
  enlaceCompleto,
  enlaceCorto,
  pantalla,
  papel,
  type Recibo as ReciboArmado,
  textoWhatsApp,
} from '@ed1/parqueadero-recibos';
import type { Registro } from '@ed1/parqueadero-schema';
import { enlaceParaCompartir } from '@ed1/whatsapp';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  type Contexto,
  catalogosDelRegistro,
  leerAjustes,
  registrarEntrega,
  vecesImpreso,
} from './almacen.ts';
import type { BaseDeLaCaja } from './datos.ts';
import type { ControlDeImpresora } from './impresora.ts';

interface Props {
  readonly db: BaseDeLaCaja;
  readonly ctx: Contexto;
  readonly control: ControlDeImpresora;
  readonly registro: Registro;
  readonly prueba: boolean;
  readonly alNueva: () => void;
  readonly alVolver: () => void;
}

interface Armado {
  readonly recibo: ReciboArmado;
  readonly enlace: string;
  readonly imprimirSiempre: boolean;
}

export function Recibo({ db, ctx, control, registro, prueba, alNueva, alVolver }: Props) {
  const [armado, setArmado] = useState<Armado | null>(null);
  const [error, setError] = useState('');
  const [papelEstado, setPapelEstado] = useState('');
  const [imprimiendo, setImprimiendo] = useState(false);
  const [conQr, setConQr] = useState(false);
  const [entregas, setEntregas] = useState<{ n: number; texto: string }[]>([]);
  const automatico = useRef(false);

  useEffect(() => {
    void (async () => {
      try {
        const recibo = armarRecibo(registro, await catalogosDelRegistro(db, registro), { prueba });
        const { sede } = await leerAjustes(db);
        setArmado({
          recibo,
          enlace: await enlaceCompleto(recibo),
          imprimirSiempre: sede?.imprimir_siempre === true,
        });
      } catch (e) {
        setError(`El recibo no se pudo armar: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();
  }, [db, registro, prueba]);

  const anotar = (texto: string) => setEntregas((antes) => [...antes, { n: antes.length, texto }]);

  async function imprimir(desdeToque: boolean) {
    if (!armado || imprimiendo) return;
    setImprimiendo(true);
    setPapelEstado('Enviando a la impresora…');
    try {
      // Conectar abre el selector del navegador: solo con un toque del cajero.
      if (desdeToque && control.estado() === 'sin_vincular') await control.conectar(false);
    } catch (e) {
      if (!(e instanceof FalloDeImpresora)) throw e;
    }
    const impresora = await db.impresora.get('actual');
    const copia = await vecesImpreso(db, registro);
    const bloques = papel(armado.recibo, {
      columnas: impresora?.columnas ?? 32,
      paginaDeCodigos: impresora?.paginaDeCodigos ?? 'cp850',
      qr: armado.recibo.clase === 'entrada' ? enlaceCorto(armado.recibo) : null,
    });
    if (copia > 0) {
      bloques.unshift({ tipo: 'texto', texto: `*** COPIA ${copia} ***`, alinear: 'centro' });
    }
    const r = await control.imprimir(bloques, undefined, registro.id);
    if (r.ok) {
      await registrarEntrega(db, registro, 'papel', copia > 0, ctx);
      setPapelEstado(
        copia > 0 ? `Copia ${copia} enviada a la impresora` : 'Enviado a la impresora',
      );
    } else {
      setPapelEstado(
        `No salió: ${TEXTO_DEL_MOTIVO[r.motivo]}. Quedó en entregas pendientes; el registro está guardado.`,
      );
    }
    setImprimiendo(false);
  }

  // HU-Q3.3 CA2: el recibo sale solo si la sede imprime siempre.
  useEffect(() => {
    if (armado?.imprimirSiempre && !automatico.current) {
      automatico.current = true;
      void imprimir(false);
    }
  });

  async function porWhatsApp() {
    if (!armado) return;
    await registrarEntrega(db, registro, 'whatsapp', false, ctx);
    anotar('Abierto en WhatsApp. Confirme con el conductor que le llegó.');
  }

  async function escaneado() {
    await registrarEntrega(db, registro, 'pantalla', false, ctx);
    setConQr(false);
    anotar('El conductor escaneó el QR.');
  }

  if (error) {
    return (
      <section class="tarjeta" data-prueba="recibo">
        <h1>Entrada registrada</h1>
        <p class="error" role="alert">
          {error}
        </p>
        <button type="button" class="boton boton-principal" onClick={alNueva}>
          Nueva entrada
        </button>
      </section>
    );
  }
  if (!armado) return <section class="tarjeta" aria-busy="true" />;

  const vista = pantalla(armado.recibo);
  return (
    <section class="tarjeta" data-prueba="recibo">
      <h1>
        Recibo <span class="exacto">{armado.recibo.numero}</span>
      </h1>
      <dl class="filas" data-prueba="filas-del-recibo">
        {vista.filas.map(([etiqueta, valor]) => (
          <div key={etiqueta}>
            <dt>{etiqueta}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>

      <div class="dos">
        <button
          type="button"
          class="boton boton-principal"
          disabled={imprimiendo}
          onClick={() => void imprimir(true)}
          data-prueba="imprimir"
        >
          {papelEstado && !imprimiendo ? 'Imprimir otra vez' : 'Imprimir'}
        </button>
        <a
          class="boton enlace-boton"
          href={enlaceParaCompartir(textoWhatsApp(armado.recibo, armado.enlace))}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => void porWhatsApp()}
          data-prueba="whatsapp"
        >
          Enviar por WhatsApp
        </a>
      </div>
      <button type="button" class="boton" onClick={() => setConQr(!conQr)}>
        {conQr ? 'Ocultar QR' : 'Mostrar QR'}
      </button>
      {conQr && <QrEnPantalla valor={armado.enlace} alEscanear={() => void escaneado()} />}

      <output aria-live="polite" data-prueba="estado-del-papel">
        {papelEstado}
      </output>
      {entregas.length > 0 && (
        <ul data-prueba="entregas">
          {entregas.map((e) => (
            <li key={e.n}>{e.texto}</li>
          ))}
        </ul>
      )}
      {vista.legal.map((l) => (
        <p key={l} class="ayuda">
          {l}
        </p>
      ))}

      <button type="button" class="boton boton-principal" onClick={alNueva}>
        Nueva entrada
      </button>
      <button type="button" class="boton boton-secundario" onClick={alVolver}>
        Volver al inicio
      </button>
    </section>
  );
}

/** La forma completa en grande, para la cámara del conductor (HU-Q3.6 CA1). */
function QrEnPantalla({ valor, alEscanear }: { valor: string; alEscanear: () => void }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    void import('lean-qr/nano').then(({ generate, correction }) => {
      if (lienzo.current) {
        generate(valor, { minCorrectionLevel: correction.L }).toCanvas(lienzo.current);
      }
    });
  }, [valor]);
  return (
    <div data-prueba="qr-en-pantalla">
      <canvas ref={lienzo} class="qr" role="img" aria-label="QR del recibo para el conductor" />
      <button type="button" class="boton" onClick={alEscanear}>
        Ya lo escaneó
      </button>
    </div>
  );
}
