/**
 * HU-T11.2: la pantalla Cobro (TIENDA-3.0 §9.2 y §9.7), solo para quien administra la tienda.
 *
 * - Antes de pegar las llaves, los términos del servicio (HU-T7.2) y la cláusula de custodia.
 * - El estado de las llaves en palabras, por ambiente, con «Probar».
 * - Pegar las llaves pide haber entrado hace poco; si pide volver a entrar, lo pegado se pierde a
 *   propósito: las llaves nunca se guardan en el teléfono (CA4).
 * - Lo que cobra Bold, y que recibir el dinero de inmediato cuesta más.
 * - HU-T11.3: el cobro de prueba guiado, paso a paso, y pasar a cobrar de verdad, que la API niega
 *   sin la prueba aprobada (CA3). El cambio llega a los compradores al publicar: hasta entonces el
 *   cobro sigue en el ambiente de lo publicado, igual que su franja.
 */
import { Aviso, ResumenDeErrores } from '@ed1/ui/v2/componentes';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { type Conexion, pedirAlPanel } from '../api.ts';
import { opNueva } from '../catalogo.ts';
import {
  AMBIENTES,
  type Ambiente,
  COMISIONES,
  type CobroDelPanel,
  comisionEnTexto,
  enLista,
  guardarLlaves,
  leerCobro,
  llavesEnPalabras,
  NOMBRE_DEL_AMBIENTE,
  probarLlaves,
  pruebaEnPalabras,
} from '../cobro.ts';
import { leerTerminos, type TerminosDelPanel } from '../terminos.ts';
import { Aceptable } from './Terminos.tsx';

type Lectura =
  | { tipo: 'cargando' }
  | { tipo: 'error'; motivo: string }
  | { tipo: 'listo'; cobro: CobroDelPanel; textos: TerminosDelPanel };

/** Una llave: no se muestra mientras se pega, ni la completa el navegador. */
function CampoDeLlave({
  id,
  etiqueta,
  valor,
  error,
  alCambiar,
}: {
  id: 'identidad' | 'secreta';
  etiqueta: string;
  valor: string;
  error: string | undefined;
  alCambiar: (v: string) => void;
}) {
  return (
    <div class={`ed1-campo${error ? ' ed1-campo--con-error' : ''}`}>
      <label class="ed1-campo__etiqueta" for={id}>
        {etiqueta}
      </label>
      <input
        class="ed1-campo__control cifra"
        id={id}
        name={id}
        type="password"
        autocomplete="off"
        spellcheck={false}
        value={valor}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onInput={(e) => alCambiar((e.target as HTMLInputElement).value)}
      />
      {error ? (
        <p class="ed1-campo__error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function PegarLlaves({
  conexion,
  alGuardar,
  alVencer,
}: {
  conexion: Conexion;
  alGuardar: (ambiente: Ambiente) => void;
  alVencer: (motivo: string) => void;
}) {
  const [ambiente, setAmbiente] = useState<Ambiente>('pruebas');
  const [identidad, setIdentidad] = useState('');
  const [secreta, setSecreta] = useState('');
  const [errores, setErrores] = useState<{ campo: string; mensaje: string }[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const error = (campo: string) => errores.find((e) => e.campo === campo)?.mensaje;

  const guardar = async (e: Event) => {
    e.preventDefault();
    const faltan = [
      ...(identidad.trim() ? [] : [{ campo: 'identidad', mensaje: 'Pega la llave de identidad' }]),
      ...(secreta.trim() ? [] : [{ campo: 'secreta', mensaje: 'Pega la llave secreta' }]),
    ];
    setErrores(faltan);
    setAviso(null);
    if (faltan.length > 0) return;
    setGuardando(true);
    const r = await guardarLlaves(conexion, { ambiente, identidad, secreta });
    setGuardando(false);
    if (r.tipo === 'sin-sesion') {
      // Las llaves no se quedan en el teléfono: al volver a entrar se pegan otra vez (CA4).
      setIdentidad('');
      setSecreta('');
      return alVencer(r.motivo);
    }
    if (r.tipo === 'ok') {
      setIdentidad('');
      setSecreta('');
      return alGuardar(ambiente);
    }
    if (r.estado === 'problemas' && r.problemas) return setErrores(r.problemas);
    setAviso(r.motivo);
  };

  return (
    <form class="formulario" noValidate onSubmit={(e) => void guardar(e)}>
      <h2>Pegar tus llaves</h2>
      <p>
        Cópialas de tu cuenta de Bold. Cada ambiente tiene las suyas: las de pruebas no cobran de
        verdad.
      </p>
      <ResumenDeErrores errores={errores} />
      {aviso ? (
        <Aviso tono="peligro" titulo="No se guardaron">
          {aviso}
        </Aviso>
      ) : null}
      <fieldset class="ed1-campo">
        <legend class="ed1-campo__etiqueta">Ambiente</legend>
        {AMBIENTES.map((a) => (
          <label class="casilla" key={a} for={`ambiente-${a}`}>
            <input
              id={`ambiente-${a}`}
              type="radio"
              name="ambiente"
              checked={ambiente === a}
              onChange={() => setAmbiente(a)}
            />
            <span>{NOMBRE_DEL_AMBIENTE[a]}</span>
          </label>
        ))}
      </fieldset>
      <CampoDeLlave
        id="identidad"
        etiqueta="Llave de identidad"
        valor={identidad}
        error={error('identidad')}
        alCambiar={setIdentidad}
      />
      <CampoDeLlave
        id="secreta"
        etiqueta="Llave secreta"
        valor={secreta}
        error={error('secreta')}
        alCambiar={setSecreta}
      />
      <p class="nota">
        Guardarlas pide que hayas entrado hace poco. Por seguridad no se guardan en este teléfono:
        si te pide volver a entrar, pégalas otra vez.
      </p>
      <button
        class="ed1-boton ed1-boton--primario"
        type="submit"
        disabled={guardando}
        aria-busy={guardando ? 'true' : undefined}
      >
        Guardar y comprobar con Bold
      </button>
    </form>
  );
}

/** HU-T11.3: el cobro de prueba, paso a paso, y el paso a cobrar de verdad. */
function CobroDePrueba({
  conexion,
  cobro,
  alCambiar,
  alVencer,
}: {
  conexion: Conexion;
  cobro: CobroDelPanel;
  alCambiar: () => void;
  alVencer: (motivo: string) => void;
}) {
  const [cambiando, setCambiando] = useState(false);
  const [aviso, setAviso] = useState<{ tono: 'exito' | 'peligro'; texto: string } | null>(null);
  const [copiada, setCopiada] = useState(false);
  const estado = pruebaEnPalabras(cobro.prueba);
  const llavesDe = (a: Ambiente) => Boolean(cobro.llaves[a].identidad && cobro.llaves[a].secreta);

  /** El ambiente se guarda en la sección `cobro` de los ajustes, con su versión (HU-T10.3). */
  const pasarA = async (ambiente: Ambiente) => {
    setCambiando(true);
    setAviso(null);
    const a = await pedirAlPanel<{
      secciones: Record<string, { datos: Record<string, unknown>; version: number }>;
    }>(conexion, 'ajustes');
    if (a.tipo === 'sin-sesion') return alVencer(a.motivo);
    if (a.tipo !== 'ok') {
      setCambiando(false);
      return setAviso({ tono: 'peligro', texto: a.motivo });
    }
    const actual = a.datos.secciones['cobro'] ?? { datos: {}, version: 0 };
    const g = await pedirAlPanel(conexion, 'ajustes/guardar', {
      cuerpo: {
        op: opNueva(),
        seccion: 'cobro',
        version: actual.version,
        datos: { ...actual.datos, ambiente },
      },
    });
    setCambiando(false);
    if (g.tipo === 'sin-sesion') return alVencer(g.motivo);
    if (g.tipo !== 'ok')
      return setAviso({
        tono: 'peligro',
        texto: g.problemas?.map((p) => p.mensaje).join(' ') || g.motivo,
      });
    setAviso({
      tono: 'exito',
      texto:
        ambiente === 'produccion'
          ? 'Listo. Publica tu tienda para que tus compradores paguen de verdad: hasta entonces sigue en pruebas, con su franja.'
          : 'Listo. Publica tu tienda para que vuelva a pruebas: hasta entonces sigue cobrando de verdad.',
    });
    alCambiar();
  };

  return (
    <section>
      <h2>El cobro de prueba</h2>
      <Aviso tono={estado.tono} titulo={cobro.prueba.aprobada ? 'Prueba aprobada' : 'En qué va'}>
        {estado.texto}
      </Aviso>
      {cobro.prueba.aprobada ? null : (
        <ol class="pasos">
          <li>
            Pega tus llaves de pruebas de Bold, aquí arriba.{' '}
            {llavesDe('pruebas') ? <strong>Listo.</strong> : null}
          </li>
          <li>
            En tu cuenta de Bold, pon esta dirección para los avisos de pago:{' '}
            {cobro.avisos ? (
              <>
                <span class="cifra">{cobro.avisos}</span>{' '}
                <button
                  class="ed1-boton ed1-boton--texto"
                  type="button"
                  onClick={() =>
                    void navigator.clipboard
                      ?.writeText(cobro.avisos ?? '')
                      .then(() => setCopiada(true))
                  }
                >
                  {copiada ? 'Copiada' : 'Copiar la dirección'}
                </button>
              </>
            ) : (
              'tu tienda todavía no tiene su dirección.'
            )}
          </li>
          <li>
            En Ajustes › Venta, elige recibir pagos en línea y publica tu tienda. Mientras cobre en
            pruebas, una franja lo dice en cada página.{' '}
            {cobro.modo !== 'whatsapp' ? <strong>Listo.</strong> : null}
          </li>
          <li>
            Abre tu tienda, compra algo y paga «En línea» con un medio de prueba de Bold: no cobra
            de verdad.
          </li>
          <li>
            Vuelve aquí. Cuando Bold avise que se aprobó, tu llave secreta y los avisos quedan
            probados.
          </li>
        </ol>
      )}
      <button class="ed1-boton ed1-boton--secundario" type="button" onClick={alCambiar}>
        Ver cómo va
      </button>
      {aviso ? (
        <Aviso tono={aviso.tono} titulo={aviso.tono === 'exito' ? 'Guardado' : 'No se cambió'}>
          {aviso.texto}
        </Aviso>
      ) : null}
      {cobro.ambiente === 'pruebas' ? (
        <>
          <h3>Cobrar de verdad</h3>
          <p>
            {!cobro.prueba.aprobada
              ? 'Se habilita cuando el cobro de prueba esté aprobado.'
              : !llavesDe('produccion')
                ? 'Primero pega tus llaves de producción, aquí arriba.'
                : 'Tus compradores pagarán de verdad, y el dinero llegará a tu cuenta de Bold.'}
          </p>
          <button
            class="ed1-boton ed1-boton--primario"
            type="button"
            disabled={!cobro.prueba.aprobada || !llavesDe('produccion') || cambiando}
            aria-busy={cambiando ? 'true' : undefined}
            onClick={() => void pasarA('produccion')}
          >
            Pasar a cobrar de verdad
          </button>
        </>
      ) : (
        <>
          <h3>Cobrando de verdad</h3>
          <button
            class="ed1-boton ed1-boton--secundario"
            type="button"
            disabled={cambiando}
            onClick={() => void pasarA('pruebas')}
          >
            Volver a pruebas
          </button>
        </>
      )}
    </section>
  );
}

export function Cobro({
  conexion,
  alVencer,
}: {
  conexion: Conexion;
  alVencer: (motivo: string) => void;
}) {
  const [lectura, setLectura] = useState<Lectura>({ tipo: 'cargando' });
  const [listo, setListo] = useState<string | null>(null);
  const [prueba, setPrueba] = useState<{ tono: 'exito' | 'peligro'; texto: string } | null>(null);
  const [probando, setProbando] = useState<Ambiente | null>(null);
  const cargar = useCallback(async () => {
    const [c, t] = await Promise.all([leerCobro(conexion), leerTerminos(conexion)]);
    if (c.tipo === 'sin-sesion') return alVencer(c.motivo);
    if (t.tipo === 'sin-sesion') return alVencer(t.motivo);
    if (c.tipo !== 'ok') return setLectura({ tipo: 'error', motivo: c.motivo });
    if (t.tipo !== 'ok') return setLectura({ tipo: 'error', motivo: t.motivo });
    setLectura({ tipo: 'listo', cobro: c.datos, textos: t.datos });
  }, [conexion, alVencer]);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  const probar = async (a: Ambiente) => {
    setProbando(a);
    setPrueba(null);
    const r = await probarLlaves(conexion, a);
    setProbando(null);
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') return setPrueba({ tono: 'peligro', texto: r.motivo });
    setPrueba({ tono: r.datos.estado === 'valida' ? 'exito' : 'peligro', texto: r.datos.motivo });
    void cargar();
  };

  const volver = (
    <p>
      <a href="/mas/">Más</a>
    </p>
  );
  if (lectura.tipo === 'cargando')
    return (
      <main class="contenido" role="status">
        {volver}
        Leyendo tu cobro…
      </main>
    );
  if (lectura.tipo === 'error')
    return (
      <main class="contenido">
        {volver}
        <h1>Cobro en línea</h1>
        <Aviso tono="peligro" titulo="No pudimos leer tu cobro">
          {lectura.motivo}
        </Aviso>
      </main>
    );
  const { cobro, textos } = lectura;
  return (
    <main class="contenido">
      {volver}
      <h1>Cobro en línea</h1>
      <p>
        Tus compradores pagan con tarjeta, PSE, Bancolombia o billeteras, y el dinero llega a tu
        cuenta de Bold. Laboratorio Digital no lo recibe ni lo toca.
      </p>
      {cobro.faltan.length > 0 ? (
        <Aviso tono="peligro" titulo="El pago en línea todavía no funciona">
          Falta {enLista(cobro.faltan)}.
        </Aviso>
      ) : null}
      {cobro.modo === 'whatsapp' ? (
        <Aviso tono="info" titulo="Hoy recibes los pedidos por WhatsApp">
          Para ofrecer el pago en línea, deja tus llaves listas aquí y cambia el modo en Ajustes ›
          Venta.
        </Aviso>
      ) : null}
      {listo ? (
        <Aviso tono="exito" titulo="Llaves guardadas">
          {listo}
        </Aviso>
      ) : null}
      {!cobro.terminos ? (
        <Aviso tono="aviso" titulo="Primero, los términos del servicio">
          Antes de conectar tu cuenta de Bold, acéptalos en nombre de tu tienda.{' '}
          <a href="/mas/terminos/">Leer y aceptar</a>
        </Aviso>
      ) : !cobro.custodia ? (
        <section class="texto-legal">
          <h2>Antes de pegar tus llaves</h2>
          <Aceptable
            conexion={conexion}
            texto={textos.custodia}
            boton="Autorizar"
            alAceptar={() => void cargar()}
            alCambiar={() => void cargar()}
            alVencer={alVencer}
          />
        </section>
      ) : null}

      <h2>Tus llaves</h2>
      <p>
        Tu tienda cobra en <strong>{NOMBRE_DEL_AMBIENTE[cobro.ambiente].toLowerCase()}</strong>.
        {cobro.ambiente === 'pruebas' ? ' Ahí nadie paga de verdad.' : ''}
      </p>
      {prueba ? (
        <Aviso tono={prueba.tono} titulo={prueba.tono === 'exito' ? 'Bold respondió' : 'Revisa'}>
          {prueba.texto}
        </Aviso>
      ) : null}
      <dl class="datos">
        {AMBIENTES.map((a) => (
          <div key={a}>
            <dt>{NOMBRE_DEL_AMBIENTE[a]}</dt>
            <dd>
              {llavesEnPalabras(cobro.llaves[a])}
              {cobro.llaves[a].identidad ? (
                <>
                  {' '}
                  <button
                    class="ed1-boton ed1-boton--texto"
                    type="button"
                    disabled={probando !== null}
                    aria-busy={probando === a ? 'true' : undefined}
                    onClick={() => void probar(a)}
                  >
                    Probar las de {NOMBRE_DEL_AMBIENTE[a].toLowerCase()}
                  </button>
                </>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>

      {cobro.terminos && cobro.custodia ? (
        <PegarLlaves
          conexion={conexion}
          alGuardar={(a) => {
            setListo(
              `Bold reconoció tu llave de identidad de ${NOMBRE_DEL_AMBIENTE[a].toLowerCase()}. La secreta se comprueba con el cobro de prueba. No hace falta publicar: la tienda usa estas llaves desde ya.`,
            );
            void cargar();
          }}
          alVencer={alVencer}
        />
      ) : null}

      {cobro.terminos && cobro.custodia ? (
        <CobroDePrueba
          conexion={conexion}
          cobro={cobro}
          alCambiar={() => void cargar()}
          alVencer={alVencer}
        />
      ) : null}

      <h2>Lo que cobra Bold</h2>
      <p>Lo paga tu tienda en cada venta en línea, antes del IVA de la comisión.</p>
      <dl class="datos">
        {COMISIONES.map((c) => (
          <div key={c.medio}>
            <dt>{c.medio}</dt>
            <dd class="cifra">{comisionEnTexto(c)}</dd>
          </div>
        ))}
      </dl>
      <p>
        Recibir el dinero de inmediato cuesta 0,6 puntos más que recibirlo al día siguiente: lo
        eliges en tu cuenta de Bold. En un pedido pequeño pesa el cargo fijo: en uno de $20.000, la
        comisión de PSE es el 7,4 %.
      </p>
    </main>
  );
}
