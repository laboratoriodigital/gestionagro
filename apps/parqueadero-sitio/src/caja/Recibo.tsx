/**
 * La pantalla del recibo (PARQUEADERO §5.1 y §6.5): lo que dice, y las formas de entregarlo. Si la
 * sede imprime siempre, sale solo (HU-Q3.3 CA2); si no sale, queda en entregas pendientes (CA4).
 * Un recibo nunca dice «Impreso»: dice «Enviado a la impresora» (HU-Q3.6 CA3). El WhatsApp va al
 * número del conductor con su autorización; el de la entrada sirve para la salida (HU-Q4.1 CA3).
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
import type { DatosDeEntrega, Registro } from '@ed1/parqueadero-schema';
import { enlaceConNumero } from '@ed1/whatsapp';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  type Contexto,
  catalogosDelRegistro,
  contactoDe,
  guardarContacto,
  leerAjustes,
  registrarEntrega,
  vecesImpreso,
} from './almacen.ts';
import type { BaseDeLaCaja, Contacto } from './datos.ts';
import { origenDelRecibo } from './entorno.ts';
import type { ControlDeImpresora } from './impresora.ts';
import { avisoAceptado } from './privacidad.ts';
import { CampoWhatsApp, faltaDelWhatsApp, terminaEn } from './whatsapp.tsx';

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
  readonly pideNumero: boolean;
}

export function Recibo({ db, ctx, control, registro, prueba, alNueva, alVolver }: Props) {
  const [armado, setArmado] = useState<Armado | null>(null);
  const [error, setError] = useState('');
  const [papelEstado, setPapelEstado] = useState('');
  const [imprimiendo, setImprimiendo] = useState(false);
  const [conQr, setConQr] = useState(false);
  const [entregas, setEntregas] = useState<{ n: number; texto: string }[]>([]);
  const [veces, setVeces] = useState(0);
  const [ultimoPapel, setUltimoPapel] = useState<Registro | null>(null);
  const [whatsapp, setWhatsapp] = useState<Registro | null>(null);
  const [contacto, setContacto] = useState<Contacto | null>(null);
  const [numero, setNumero] = useState('');
  const [autoriza, setAutoriza] = useState(false);
  const automatico = useRef(false);
  const estadiaId = registro.estadia_id ?? registro.id;

  useEffect(() => {
    void (async () => {
      try {
        const recibo = armarRecibo(registro, await catalogosDelRegistro(db, registro), { prueba });
        const { sede } = await leerAjustes(db);
        setVeces(await vecesImpreso(db, registro));
        setContacto(await contactoDe(db, estadiaId, ctx.reloj()));
        setArmado({
          recibo,
          enlace: await enlaceCompleto(recibo, origenDelRecibo(location)),
          imprimirSiempre: sede?.imprimir_siempre === true,
          pideNumero: avisoAceptado(sede),
        });
      } catch (e) {
        setError(`El recibo no se pudo armar: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();
  }, [db, registro, prueba, estadiaId, ctx]);

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
      qr:
        armado.recibo.clase === 'entrada'
          ? enlaceCorto(armado.recibo, origenDelRecibo(location))
          : null,
    });
    if (copia > 0) {
      bloques.unshift({ tipo: 'texto', texto: `*** COPIA ${copia} ***`, alinear: 'centro' });
    }
    const r = await control.imprimir(bloques, undefined, registro.id);
    if (r.ok) {
      const entrega = await registrarEntrega(
        db,
        registro,
        {
          canal: 'papel',
          copia: copia > 0,
          camino: impresora?.camino ?? null,
          resultado: 'enviado',
        },
        ctx,
      );
      setUltimoPapel(entrega);
      setVeces(copia + 1);
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

  /** «No salió» (§7.6): anota el fallo del último envío y reimprime el original, sin copia. */
  async function noSalio() {
    if (!ultimoPapel) return;
    const d = ultimoPapel.datos as DatosDeEntrega;
    await registrarEntrega(db, registro, { ...d, resultado: 'fallido' }, ctx);
    setUltimoPapel(null);
    setVeces(await vecesImpreso(db, registro));
    anotar('Se anotó que el papel no salió.');
    await imprimir(true);
  }

  // El toque solo navega: el enlace ya está armado, y el número y la entrega se anotan sin
  // esperar (HU-Q4.1 CA2). Ningún `await` aquí: lo exige una prueba.
  function porWhatsApp() {
    if (!contacto) void guardarContacto(db, estadiaId, numero, ctx).then(setContacto);
    void registrarEntrega(
      db,
      registro,
      { canal: 'whatsapp', copia: false, resultado: 'abierto', autorizado: true },
      ctx,
    ).then(setWhatsapp);
    anotar('Abierto en WhatsApp.');
  }

  async function noSeEnvio() {
    await registrarEntrega(
      db,
      registro,
      { canal: 'whatsapp', copia: false, resultado: 'no_enviado', autorizado: true },
      ctx,
    );
    setWhatsapp(null);
    anotar('WhatsApp: no se envió.');
  }

  async function escaneado() {
    await registrarEntrega(
      db,
      registro,
      { canal: 'pantalla', copia: false, resultado: 'confirmado' },
      ctx,
    );
    setConQr(false);
    anotar('El conductor escaneó el QR.');
  }

  if (error) {
    return (
      <section class="tarjeta" data-prueba="recibo">
        <h1>{registro.tipo === 'salida' ? 'Salida registrada' : 'Entrada registrada'}</h1>
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
  const falta = contacto
    ? ''
    : armado.pideNumero
      ? faltaDelWhatsApp(numero, autoriza)
      : 'Falta el aviso de privacidad';
  const destino = contacto?.numero ?? numero;
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

      {contacto ? (
        <p class="ayuda" data-prueba="whatsapp-guardado">
          WhatsApp del conductor: el que termina en {terminaEn(contacto.numero)}
        </p>
      ) : (
        <CampoWhatsApp
          pideNumero={armado.pideNumero}
          numero={numero}
          autoriza={autoriza}
          alEscribir={setNumero}
          alAutorizar={setAutoriza}
        />
      )}

      <div class="dos">
        <button
          type="button"
          class="boton boton-principal"
          disabled={imprimiendo}
          onClick={() => void imprimir(true)}
          data-prueba="imprimir"
        >
          {veces > 0 ? 'Reimprimir' : 'Imprimir'}
        </button>
        {falta ? (
          <button type="button" class="boton" disabled data-prueba="whatsapp">
            {falta}
          </button>
        ) : (
          <a
            class="boton enlace-boton"
            href={enlaceConNumero(destino, textoWhatsApp(armado.recibo, armado.enlace))}
            target="_blank"
            rel="noopener noreferrer"
            onClick={porWhatsApp}
            data-prueba="whatsapp"
          >
            Enviar por WhatsApp
          </a>
        )}
        <button type="button" class="boton" onClick={() => setConQr(!conQr)}>
          {conQr ? 'Ocultar QR' : 'Mostrar QR'}
        </button>
        {ultimoPapel && !imprimiendo ? (
          <button type="button" class="boton" onClick={() => void noSalio()}>
            No salió
          </button>
        ) : whatsapp ? (
          <button type="button" class="boton" onClick={() => void noSeEnvio()}>
            No se envió
          </button>
        ) : null}
      </div>
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
