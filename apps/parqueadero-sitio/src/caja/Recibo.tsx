/**
 * La pantalla del recibo (PARQUEADERO §5.1 y §6.5): lo que dice, y las formas de entregarlo. Si la
 * sede imprime siempre, sale solo (HU-Q3.3 CA2); si no sale, queda en entregas pendientes (CA4).
 * Un recibo nunca dice «Impreso»: dice «Enviado a la impresora» (HU-Q3.6 CA3). El WhatsApp va al
 * número del conductor con su autorización; el de la entrada sirve para la salida (HU-Q4.1 CA3).
 */
import { TEXTO_DEL_MOTIVO } from '@ed1/impresion';
import {
  armarRecibo,
  enlaceCompleto,
  enlaceCorto,
  pantalla,
  papel,
  type Recibo as ReciboArmado,
  textoWhatsApp,
} from '@ed1/parqueadero-recibos';
import {
  type DatosDeEntrega,
  type Papel,
  papelDeLaSede,
  type Registro,
} from '@ed1/parqueadero-schema';
import { enlaceConNumero } from '@ed1/whatsapp';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Anular } from './Anular.tsx';
import {
  anulados,
  type Contexto,
  catalogosDelRegistro,
  contactoDe,
  guardarContacto,
  leerAjustes,
  registrarEntrega,
  vecesImpreso,
} from './almacen.ts';
import { ConexionImpresora, textoDeFallo } from './conexion.tsx';
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
  /** HU-Q4.3: `siempre` imprime al registrar; `salvo_digital`, al salir si no hubo digital. */
  readonly papel: Papel;
  readonly pideNumero: boolean;
}

export function Recibo({ db, ctx, control, registro, prueba, alNueva, alVolver }: Props) {
  const [armado, setArmado] = useState<Armado | null>(null);
  const [error, setError] = useState('');
  const [papelEstado, setPapelEstado] = useState('');
  const [imprimiendo, setImprimiendo] = useState(false);
  /** El último envío no salió: el recibo ofrece conectar y el diagnóstico (bitácora 18). */
  const [noImprimio, setNoImprimio] = useState(false);
  const [conQr, setConQr] = useState(false);
  const [entregas, setEntregas] = useState<{ n: number; texto: string }[]>([]);
  const [veces, setVeces] = useState(0);
  const [ultimoPapel, setUltimoPapel] = useState<Registro | null>(null);
  const [whatsapp, setWhatsapp] = useState<Registro | null>(null);
  const [contacto, setContacto] = useState<Contacto | null>(null);
  const [numero, setNumero] = useState('');
  const [autoriza, setAutoriza] = useState(false);
  const automatico = useRef(false);
  /** Un recibo anulado ya no vale: no se imprime ni se envía (HU-Q3.7). */
  const [anulado, setAnulado] = useState(false);
  /** El conductor recibió el digital: WhatsApp abierto o el QR escaneado (HU-Q4.3 CA1). */
  const [digital, setDigital] = useState(false);
  const estadiaId = registro.estadia_id ?? registro.id;

  useEffect(() => {
    void (async () => {
      try {
        const recibo = armarRecibo(registro, await catalogosDelRegistro(db, registro), { prueba });
        const { sede } = await leerAjustes(db);
        setVeces(await vecesImpreso(db, registro));
        setAnulado((await anulados(db)).has(registro.id));
        setContacto(await contactoDe(db, estadiaId, ctx.reloj()));
        setArmado({
          recibo,
          enlace: await enlaceCompleto(recibo, origenDelRecibo(location)),
          papel: sede ? papelDeLaSede(sede) : 'siempre',
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
    setNoImprimio(false);
    // Reconectar puede tardar hasta 30 s: la pantalla dice qué está pasando (P15).
    setPapelEstado(
      control.estado() === 'desconectada'
        ? 'Reconectando la impresora…'
        : 'Enviando a la impresora…',
    );
    const alFallar = (porQue: string, pendiente = true) => {
      setNoImprimio(true);
      setPapelEstado(
        `No salió: ${porQue}. ${pendiente ? 'Quedó en entregas pendientes; el' : 'El'} registro está guardado.`,
      );
    };
    try {
      let sinConectar = '';
      try {
        // Conectar abre el selector del navegador: solo con un toque del cajero.
        if (desdeToque && control.estado() === 'sin_vincular') await control.conectar(false);
      } catch (e) {
        sinConectar = textoDeFallo(e);
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
        alFallar(
          sinConectar ||
            (control.estado() === 'sin_vincular'
              ? 'La impresora no está conectada'
              : TEXTO_DEL_MOTIVO[r.motivo]),
        );
      }
    } catch (e) {
      // Nunca deja el botón esperando (P15).
      alFallar(e instanceof Error ? e.message : String(e), false);
    } finally {
      setImprimiendo(false);
    }
  }

  // HU-Q3.3 CA2: el recibo sale solo si la sede imprime siempre.
  useEffect(() => {
    if (armado?.papel === 'siempre' && !anulado && !automatico.current) {
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

  /** Al salir del recibo: con `salvo_digital` y sin entrega digital ni papel, sale en papel. */
  async function salir(ir: () => void) {
    if (armado?.papel === 'salvo_digital' && !digital && veces === 0 && !anulado) {
      await imprimir(false);
    }
    ir();
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
    setDigital(true);
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
    setDigital(false);
    anotar('WhatsApp: no se envió.');
    // Sin el digital, nadie se queda sin recibo (HU-Q4.3 CA3).
    if (armado?.papel === 'salvo_digital' && veces === 0) await imprimir(true);
  }

  async function escaneado() {
    await registrarEntrega(
      db,
      registro,
      { canal: 'pantalla', copia: false, resultado: 'confirmado' },
      ctx,
    );
    setConQr(false);
    setDigital(true);
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
  const salvo = armado.papel === 'salvo_digital';
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

      {anulado ? (
        <p class="error" role="status" data-prueba="anulado">
          Recibo anulado: ya no vale. La anulación queda en el cierre del turno.
        </p>
      ) : contacto ? (
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

      {salvo && !anulado && (
        <p class="pregunta" data-prueba="pregunta-papel">
          ¿Recibo por WhatsApp o en papel? Si no lo recibe por WhatsApp o en la pantalla, sale en
          papel al terminar.
        </p>
      )}
      {!anulado && (
        <div class="dos">
          <button
            type="button"
            // Ya impreso, «Nueva entrada» es lo que sigue: reimprimir no compite con eso (HU-Q6.5).
            class={salvo || veces > 0 ? 'boton' : 'boton boton-principal'}
            disabled={imprimiendo}
            onClick={() => void imprimir(true)}
            data-prueba="imprimir"
          >
            {veces > 0 ? 'Reimprimir' : 'Imprimir'}
          </button>
          {falta ? (
            <button
              type="button"
              class={salvo ? 'boton primero' : 'boton'}
              disabled
              data-prueba="whatsapp"
            >
              {falta}
            </button>
          ) : (
            <a
              class={salvo ? 'boton enlace-boton boton-principal primero' : 'boton enlace-boton'}
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
      )}
      {conQr && !anulado && (
        <QrEnPantalla valor={armado.enlace} alEscanear={() => void escaneado()} />
      )}

      <output aria-live="polite" data-prueba="estado-del-papel">
        {papelEstado}
      </output>
      {noImprimio && !imprimiendo && (
        <ConexionImpresora
          control={control}
          alConectar={() => void imprimir(false)}
          conDiagnostico
        />
      )}
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

      <button type="button" class="boton boton-principal" onClick={() => void salir(alNueva)}>
        Nueva entrada
      </button>
      <button type="button" class="boton boton-secundario" onClick={() => void salir(alVolver)}>
        Volver al inicio
      </button>
      {/* Lo que deshace va al final, lejos del pulgar (HU-Q6.5). */}
      {!anulado && (
        <Anular db={db} ctx={ctx} registro={registro} alAnular={() => setAnulado(true)} />
      )}
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
