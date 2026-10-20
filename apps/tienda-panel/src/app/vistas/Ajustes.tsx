/**
 * HU-T10.3: los ajustes de la tienda, por sección. La lista dice qué falta para publicar; cada
 * sección se guarda sola, con su versión (CA1). Lo que se escribe queda en el teléfono mientras
 * tanto: si cambiar el WhatsApp, el modo o el cobro pide volver a entrar (CA2), al volver el
 * formulario está como estaba. Un WhatsApp nuevo queda sin verificar hasta abrir el chat de prueba
 * y decir que es el propio (CA3).
 */
import { puede } from '@ed1/tienda-schema/permisos';
import { TITULOS_DE_SECCION } from '@ed1/tienda-schema/titulos';
import { Aviso, Campo, type EstadoDeContenido, ResumenDeErrores } from '@ed1/ui/v2/componentes';
import { useCallback, useEffect, useState } from 'preact/hooks';
import {
  aDatos,
  aTexto,
  CAMPOS,
  type CampoDeAjuste,
  campoDelProblema,
  chatDePrueba,
  nombreDelCampo,
  SECCIONES_EN_ORDEN,
  type Seccion,
} from '../ajustes.ts';
import type { Almacen } from '../almacen.ts';
import { type Conexion, pedirAlPanel } from '../api.ts';
import { usarBorrador } from '../borradores.ts';
import { opNueva } from '../catalogo.ts';
import { Lista } from '../componentes/index.ts';
import { FeedsDeLaTienda } from './Feeds.tsx';

interface AjustesDelPanel {
  secciones: Partial<Record<Seccion, { datos: Record<string, unknown>; version: number }>>;
  faltantes: string[];
}

function FaltaParaPublicar({ faltantes }: { faltantes: string[] }) {
  if (faltantes.length === 0)
    return (
      <Aviso tono="exito" titulo="Nada falta para publicar">
        Los ajustes que pide la ley y la venta están completos.
      </Aviso>
    );
  return (
    <Aviso
      tono="aviso"
      titulo={
        faltantes.length === 1
          ? 'Falta 1 dato para publicar'
          : `Faltan ${faltantes.length} datos para publicar`
      }
    >
      <ul>
        {faltantes.map((f) => (
          <li key={f}>{nombreDelCampo(f)}</li>
        ))}
      </ul>
    </Aviso>
  );
}

export function Ajustes({
  conexion,
  alVencer,
}: {
  conexion: Conexion;
  alVencer: (motivo: string) => void;
}) {
  const [estado, setEstado] = useState<EstadoDeContenido<Seccion>>({ tipo: 'cargando' });
  const [faltantes, setFaltantes] = useState<string[] | null>(null);
  useEffect(() => {
    void (async () => {
      const r = await pedirAlPanel<AjustesDelPanel>(conexion, 'ajustes');
      if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
      if (r.tipo !== 'ok') return setEstado({ tipo: 'error', causa: r.motivo });
      setFaltantes(r.datos.faltantes);
      setEstado({
        tipo: 'listo',
        elementos: SECCIONES_EN_ORDEN.filter((s) => s in r.datos.secciones),
      });
    })();
  }, [conexion, alVencer]);

  return (
    <main class="contenido">
      <p>
        <a href="/mas/">Más</a>
      </p>
      <h1>Ajustes</h1>
      {faltantes ? <FaltaParaPublicar faltantes={faltantes} /> : null}
      <Lista
        titulo="Ajustes"
        estado={estado}
        vacio={{ porque: 'Tu rol no puede ver los ajustes.' }}
        fila={(s: Seccion) => {
          const falta = (faltantes ?? []).filter((f) => f.startsWith(`${s}.`)).length;
          return {
            href: `/mas/ajustes/${s}/`,
            dato: TITULOS_DE_SECCION[s],
            detalle: falta === 0 ? '' : falta === 1 ? 'Falta 1 dato' : `Faltan ${falta} datos`,
          };
        }}
      />
    </main>
  );
}

type Lectura =
  | { tipo: 'cargando' }
  | { tipo: 'error'; motivo: string }
  | { tipo: 'listo'; datos: Record<string, unknown>; version: number; faltantes: string[] };

export function AjusteDeSeccion({
  conexion,
  almacen,
  org,
  rol,
  seccion,
  dominioPropio = false,
  alVencer,
}: {
  conexion: Conexion;
  almacen: Almacen;
  org: string;
  rol: string;
  seccion: Seccion;
  /** HU-T14.4: si la dirección principal es el dominio propio del comercio. */
  dominioPropio?: boolean;
  alVencer: (motivo: string) => void;
}) {
  const [lectura, setLectura] = useState<Lectura>({ tipo: 'cargando' });
  const [aviso, setAviso] = useState<string | null>(null);
  const cargar = useCallback(async () => {
    const r = await pedirAlPanel<AjustesDelPanel>(conexion, 'ajustes');
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') return setLectura({ tipo: 'error', motivo: r.motivo });
    const s = r.datos.secciones[seccion];
    if (!s) return setLectura({ tipo: 'error', motivo: 'Tu rol no puede ver esta parte.' });
    setLectura({ tipo: 'listo', ...s, faltantes: r.datos.faltantes });
  }, [conexion, seccion, alVencer]);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  const titulo = TITULOS_DE_SECCION[seccion];
  if (lectura.tipo === 'cargando')
    return (
      <main class="contenido" role="status">
        Cargando {titulo.toLowerCase()}…
      </main>
    );
  if (lectura.tipo === 'error')
    return (
      <main class="contenido">
        <p>
          <a href="/mas/ajustes/">Ajustes</a>
        </p>
        <Aviso tono="peligro" titulo={`No pudimos leer ${titulo.toLowerCase()}`}>
          {lectura.motivo}
        </Aviso>
      </main>
    );
  const falta = lectura.faltantes.filter((f) => f.startsWith(`${seccion}.`));
  return (
    <main class="contenido">
      <p>
        <a href="/mas/ajustes/">Ajustes</a>
      </p>
      <h1>{titulo}</h1>
      {aviso ? (
        <Aviso tono="exito" titulo="Listo">
          {aviso}
        </Aviso>
      ) : null}
      {falta.length > 0 ? <FaltaParaPublicar faltantes={falta} /> : null}
      {seccion === 'contacto' ? (
        <VerificarWhatsapp
          conexion={conexion}
          datos={lectura.datos}
          version={lectura.version}
          alVencer={alVencer}
          alVerificar={async () => {
            setAviso('Tu WhatsApp quedó verificado.');
            await cargar();
          }}
        />
      ) : null}
      <Formulario
        key={lectura.version}
        conexion={conexion}
        almacen={almacen}
        borrador={`ajustes:${org}:${seccion}`}
        rol={rol}
        seccion={seccion}
        datos={lectura.datos}
        version={lectura.version}
        dominioPropio={dominioPropio}
        alVencer={alVencer}
        alGuardar={async () => {
          setAviso(`Guardamos ${titulo.toLowerCase()}.`);
          await cargar();
        }}
        alRecargar={cargar}
      />
      {seccion === 'agentes' ? (
        <FeedsDeLaTienda key={lectura.version} conexion={conexion} alVencer={alVencer} />
      ) : null}
    </main>
  );
}

function VerificarWhatsapp({
  conexion,
  datos,
  version,
  alVencer,
  alVerificar,
}: {
  conexion: Conexion;
  datos: Record<string, unknown>;
  version: number;
  alVencer: (motivo: string) => void;
  alVerificar: () => Promise<void>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const whatsapp = typeof datos['whatsapp'] === 'string' ? datos['whatsapp'] : null;
  if (!whatsapp) return null;
  if (datos['whatsappVerificado'] === true)
    return <p class="nota">Tu WhatsApp está verificado: ahí llegan los pedidos.</p>;
  const verificar = async () => {
    const r = await pedirAlPanel(conexion, 'ajustes/verificar-whatsapp', {
      cuerpo: { op: opNueva(), version },
    });
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') return setError(r.motivo);
    await alVerificar();
  };
  return (
    <Aviso tono="aviso" titulo="Tu WhatsApp está sin verificar">
      <p>
        Antes de recibir pedidos ahí, abre el chat de prueba desde este teléfono y mira que sea el
        tuyo. Mientras no lo confirmes, la tienda no se puede publicar.
      </p>
      <p>
        <a
          class="ed1-boton ed1-boton--secundario"
          href={chatDePrueba(whatsapp)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setAbierto(true)}
        >
          Abrir el chat de prueba
        </a>
      </p>
      {abierto ? (
        <button
          class="ed1-boton ed1-boton--primario"
          type="button"
          onClick={() => void verificar()}
        >
          Sí, es mi WhatsApp
        </button>
      ) : null}
      {error ? <p class="ed1-campo__error">{error}</p> : null}
    </Aviso>
  );
}

const idDe = (campo: string) => `ajuste-${campo}`;

function Formulario({
  conexion,
  almacen,
  borrador,
  rol,
  seccion,
  datos,
  version,
  dominioPropio,
  alVencer,
  alGuardar,
  alRecargar,
}: {
  conexion: Conexion;
  almacen: Almacen;
  borrador: string;
  rol: string;
  seccion: Seccion;
  datos: Record<string, unknown>;
  version: number;
  dominioPropio: boolean;
  alVencer: (motivo: string) => void;
  alGuardar: () => Promise<void>;
  alRecargar: () => Promise<void>;
}) {
  // La versión va en el borrador: si al volver de entrar alguien más guardó, la API lo dice.
  const inicial: Record<string, string> = { ...aTexto(seccion, datos), version: String(version) };
  const { valores, cambiar, olvidar } = usarBorrador(almacen, borrador, inicial);
  const [errores, setErrores] = useState<{ campo: string; mensaje: string }[]>([]);
  const [cambiado, setCambiado] = useState<string | null>(null);
  const [prohibido, setProhibido] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  // HU-T14.4 CA3: lo que pide dominio propio no se ofrece sin él; su valor guardado no se toca.
  const campos = CAMPOS[seccion].filter((c) => !c.soloConDominioPropio || dominioPropio);
  const errorDe = (campo: string) => errores.find((e) => e.campo === idDe(campo))?.mensaje;

  const guardar = async (e: Event) => {
    e.preventDefault();
    setGuardando(true);
    setProhibido(null);
    const r = await pedirAlPanel(conexion, 'ajustes/guardar', {
      cuerpo: {
        op: opNueva(),
        seccion,
        version: Number(valores['version']),
        datos: aDatos(seccion, valores, datos),
      },
    });
    setGuardando(false);
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') {
      if (r.estado === 'cambiado') return setCambiado(r.motivo);
      // HU-T10.5 CA3: la API decide, aunque la pantalla no lo haya ofrecido.
      if (r.estado === 'prohibido') return setProhibido(r.motivo);
      setErrores(
        (r.problemas ?? [{ campo: campos[0]?.campo ?? '', mensaje: r.motivo }]).map((p) => {
          const campo = campoDelProblema(seccion, p.campo);
          const c = campos.find((x) => x.campo === campo);
          return { campo: idDe(campo), mensaje: `${c?.etiqueta ?? campo}: ${p.mensaje}` };
        }),
      );
      return;
    }
    setErrores([]);
    await olvidar();
    await alGuardar();
  };

  return (
    <form
      class="formulario"
      noValidate
      onSubmit={(e) => void guardar(e)}
      onInput={(e) => {
        const campo = e.target as HTMLInputElement;
        if (campo.type !== 'checkbox' && campos.some((c) => c.campo === campo.name))
          cambiar(campo.name, campo.value);
      }}
    >
      {cambiado ? (
        <Aviso tono="aviso" titulo="Alguien más guardó esta parte">
          <p>{cambiado}</p>
          <button
            class="ed1-boton ed1-boton--secundario"
            type="button"
            onClick={() => void olvidar().then(alRecargar)}
          >
            Ver lo que quedó guardado
          </button>
        </Aviso>
      ) : null}
      {prohibido ? (
        <Aviso tono="peligro" titulo="No se guardó">
          {prohibido} Lo cambia quien administra la tienda.
        </Aviso>
      ) : null}
      <ResumenDeErrores errores={errores} />
      {campos.map((c) =>
        c.pide && !puede(rol, c.pide) ? (
          // HU-T10.5 CA2: se ve, pero lo cambia quien administra la tienda; la API también lo niega.
          <div class="ed1-campo" key={c.campo}>
            <p class="ed1-campo__etiqueta">{c.etiqueta}</p>
            <p>
              {(c.opciones ?? []).find(([v]) => v === valores[c.campo])?.[1] ??
                (valores[c.campo] || 'Sin elegir')}
            </p>
            <p class="ed1-campo__ayuda">Lo cambia quien administra la tienda.</p>
          </div>
        ) : (
          <CampoDeSeccion
            key={c.campo}
            c={c}
            valor={valores[c.campo] ?? ''}
            error={errorDe(c.campo)}
            alCambiar={(v) => cambiar(c.campo, v)}
          />
        ),
      )}
      <button
        class="ed1-boton ed1-boton--primario"
        type="submit"
        disabled={guardando}
        aria-busy={guardando ? 'true' : undefined}
      >
        Guardar {TITULOS_DE_SECCION[seccion].toLowerCase()}
      </button>
    </form>
  );
}

function CampoDeSeccion({
  c,
  valor,
  error,
  alCambiar,
}: {
  c: CampoDeAjuste;
  valor: string;
  error: string | undefined;
  alCambiar: (v: string) => void;
}) {
  const id = idDe(c.campo);
  const conError = error ? { error } : {};
  if (
    c.tipo === 'texto' ||
    c.tipo === 'correo' ||
    c.tipo === 'celular' ||
    c.tipo === 'telefono' ||
    c.tipo === 'pesos' ||
    c.tipo === 'numero'
  ) {
    return (
      <Campo
        id={id}
        nombre={c.campo}
        etiqueta={c.etiqueta}
        tipo={
          c.tipo === 'correo'
            ? 'email'
            : c.tipo === 'celular' || c.tipo === 'telefono'
              ? 'tel'
              : 'text'
        }
        valor={valor}
        {...(c.ayuda ? { ayuda: c.ayuda } : {})}
        {...(c.requerido ? { requerido: true } : {})}
        {...conError}
      />
    );
  }
  if (c.tipo === 'formas') {
    const elegidas = valor.split(',').filter(Boolean);
    return (
      <fieldset class="ed1-grupo" id={id}>
        <legend class="ed1-grupo__titulo">{c.etiqueta}</legend>
        {(c.opciones ?? []).map(([v, nombre]) => (
          <label class="casilla" key={v} for={`${id}-${v}`}>
            <input
              id={`${id}-${v}`}
              type="checkbox"
              checked={elegidas.includes(v)}
              onChange={(e) => {
                const si = (e.target as HTMLInputElement).checked;
                const otras = elegidas.filter((x) => x !== v);
                alCambiar((si ? [...otras, v] : otras).join(','));
              }}
            />
            {nombre}
          </label>
        ))}
        {error ? <p class="ed1-campo__error">{error}</p> : null}
      </fieldset>
    );
  }
  const describe =
    [c.ayuda ? `${id}-ayuda` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') ||
    undefined;
  const control =
    c.tipo === 'parrafo' ? (
      <textarea
        class="ed1-campo__control"
        id={id}
        name={c.campo}
        rows={4}
        value={valor}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describe}
      />
    ) : c.tipo === 'color' ? (
      <input
        class="ed1-campo__control"
        id={id}
        name={c.campo}
        type="color"
        value={valor || '#1f1f1d'}
        aria-describedby={describe}
      />
    ) : (
      <select
        class="ed1-campo__control"
        id={id}
        name={c.campo}
        value={valor}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describe}
        onChange={(e) => alCambiar((e.target as HTMLSelectElement).value)}
      >
        <option value="">Sin elegir</option>
        {(c.tipo === 'si-no'
          ? ([
              ['si', 'Sí'],
              ['no', 'No'],
            ] as const)
          : (c.opciones ?? [])
        ).map(([v, nombre]) => (
          <option key={v} value={v}>
            {nombre}
          </option>
        ))}
      </select>
    );
  return (
    <div class={`ed1-campo${error ? ' ed1-campo--con-error' : ''}`}>
      <label class="ed1-campo__etiqueta" for={id}>
        {c.etiqueta}
        {c.requerido ? null : <span class="ed1-campo__opcional"> (opcional)</span>}
      </label>
      {control}
      {c.ayuda ? (
        <p class="ed1-campo__ayuda" id={`${id}-ayuda`}>
          {c.ayuda}
        </p>
      ) : null}
      {error ? (
        <p class="ed1-campo__error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
