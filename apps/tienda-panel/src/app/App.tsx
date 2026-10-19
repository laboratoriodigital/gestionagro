/**
 * El panel de la Tienda (HU-T8.1 y HU-T3.5, TIENDA-3.0 §12): entrar, elegir la tienda y el marco
 * del panel con su navegación.
 *
 * - Al abrir: si el fragmento trae el código de la cuenta, se borra de la barra y se canjea.
 * - «Sin sesión», «sin tienda», «elegir» y «error» son pantallas distintas que dicen cosas distintas.
 * - Con la tienda elegida, `GET /api/panel/v1/yo` dice cuál es, el rol, el plan y lo que el plan
 *   permite. Se vuelve a preguntar al cambiar de pantalla y al volver al panel.
 * - Si la sesión vence (401 aun renovando), aparece «vuelve a entrar» encima de lo que se estaba
 *   haciendo, sin navegar ni recargar (CA2); los formularios guardan su borrador.
 */
import { puede } from '@ed1/tienda-schema/permisos';
import { Aviso } from '@ed1/ui/v2/componentes';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { AvisoActualizacion } from './AvisoActualizacion.tsx';
import { esSeccion, type Seccion } from './ajustes.ts';
import { type Almacen, almacenIndexedDb } from './almacen.ts';
import { pedirAlPanel, type RespuestaDelPanel, type Yo } from './api.ts';
import { Barra, Navegacion } from './componentes/index.ts';
import { irA, usarRuta } from './ruta.ts';
import {
  canjear,
  leerRegreso,
  leerSesion,
  MENSAJES_DE_ERROR,
  pantallaDe,
  renovar,
  type Sesion,
  salir,
  urlDeEntrada,
  urlDelCore,
} from './sesion.ts';
import { AjusteDeSeccion, Ajustes } from './vistas/Ajustes.tsx';
import { Anotar } from './vistas/Anotar.tsx';
import { Coleccion, Colecciones } from './vistas/Colecciones.tsx';
import { Datos } from './vistas/Datos.tsx';
import { ElegirTienda, NOMBRE_DEL_ROL } from './vistas/ElegirTienda.tsx';
import { Entrar } from './vistas/Entrar.tsx';
import { Equipo } from './vistas/Equipo.tsx';
import { Galeria } from './vistas/Galeria.tsx';
import { Inicio } from './vistas/Inicio.tsx';
import { Existencias, Inventario } from './vistas/Inventario.tsx';
import { Mas } from './vistas/Mas.tsx';
import { Bandeja, Pedido } from './vistas/Pedidos.tsx';
import { Privacidad } from './vistas/Privacidad.tsx';
import { Producto } from './vistas/Producto.tsx';
import { Productos } from './vistas/Productos.tsx';
import { Publicar } from './vistas/Publicar.tsx';
import { Recaudos } from './vistas/Recaudos.tsx';
import { Registro } from './vistas/Registro.tsx';
import { SinTienda } from './vistas/SinTienda.tsx';
import { Solicitud, Solicitudes } from './vistas/Solicitudes.tsx';
import { Terminos } from './vistas/Terminos.tsx';
import { Titular } from './vistas/Titular.tsx';
import { Unirme } from './vistas/Unirme.tsx';
import { CuponDeLaTienda, EnvioDeLaTienda, Venta } from './vistas/Venta.tsx';

const LIBRES = new Set(['/privacidad/', '/_galeria/', '/unirme/']);

function VuelveAEntrar({ motivo, alEntrar }: { motivo: string; alEntrar: () => void }) {
  return (
    <div class="vuelve-a-entrar" role="alertdialog" aria-labelledby="vuelve-titulo">
      <p class="vuelve-a-entrar__titulo" id="vuelve-titulo">
        Vuelve a entrar
      </p>
      <p>{motivo}</p>
      <p>Lo que estabas escribiendo se queda en este teléfono.</p>
      <button class="ed1-boton ed1-boton--primario" type="button" onClick={alEntrar}>
        Entrar con Google
      </button>
    </div>
  );
}

export function App({ almacen: dado }: { almacen?: Almacen }) {
  // Uno solo por montaje: un almacén nuevo en cada render cambiaría `preguntar` y volvería a
  // preguntar a la API sin fin.
  const almacen = useMemo(() => dado ?? almacenIndexedDb(), [dado]);
  const core = useMemo(() => urlDelCore(location.hostname, __CORE_DEL_PANEL__), []);
  const conexion = useMemo(() => ({ almacen, core }), [almacen, core]);
  const ruta = usarRuta();
  const [abriendo, setAbriendo] = useState(true);
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [eligiendo, setEligiendo] = useState(false);
  const [yo, setYo] = useState<RespuestaDelPanel<Yo> | null>(null);
  const [vencida, setVencida] = useState<string | null>(null);

  const entrar = useCallback(() => {
    location.assign(urlDeEntrada(core, `${location.origin}${location.pathname}`));
  }, [core]);

  // Al abrir: el regreso de la cuenta y la sesión guardada.
  useEffect(() => {
    void (async () => {
      const regreso = leerRegreso(location.hash);
      if (regreso) {
        // El código no se queda en la barra ni en el historial (P13), aun si el canje falla.
        history.replaceState(null, '', location.pathname);
        if ('codigo' in regreso) {
          try {
            await canjear(almacen, core, regreso.codigo);
          } catch (e) {
            setAviso(e instanceof Error ? e.message : 'No se pudo entrar. Intenta otra vez.');
          }
        } else {
          setAviso(MENSAJES_DE_ERROR[regreso.error] ?? 'No se pudo entrar. Intenta otra vez.');
        }
      }
      setSesion(await leerSesion(almacen));
      setAbriendo(false);
    })();
  }, [almacen, core]);

  const pantalla = pantallaDe(sesion);
  const orgElegida = sesion?.org_id ?? null;

  // Con la tienda elegida: a qué tienda llegó la sesión. Se pregunta al cambiar de pantalla o de
  // tienda y al volver a la pestaña.
  const preguntar = useCallback(async () => {
    if (pantallaDe(await leerSesion(almacen)) !== 'panel') return;
    const r = await pedirAlPanel<Yo>({ almacen, core }, 'yo');
    if (r.tipo === 'sin-sesion') {
      setVencida(r.motivo);
      return;
    }
    setVencida(null);
    setYo(r);
    setSesion(await leerSesion(almacen));
  }, [almacen, core]);

  useEffect(() => {
    // `orgElegida`: cambiar de tienda desde «Más» no cambia la pantalla ni la ruta, y sin ella
    // nadie preguntaba por la tienda nueva (bitácora tienda3 17).
    if (!abriendo && pantalla === 'panel') void preguntar();
  }, [abriendo, pantalla, ruta, orgElegida, preguntar]);
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === 'visible') void preguntar();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [preguntar]);

  const alElegir = async (org: string) => {
    const r = await renovar(almacen, core, { org });
    setAviso(r.motivo);
    setEligiendo(false);
    setYo(null);
    setSesion(r.sesion);
    // La tienda nueva abre en su inicio, no en «Más».
    if (r.sesion?.org_id) irA('/');
  };
  const alSalir = async () => {
    await salir(almacen);
    setYo(null);
    setSesion(null);
    setAviso(null);
  };

  const libre = LIBRES.has(ruta);
  let cuerpo: preact.ComponentChildren;
  if (ruta === '/privacidad/') cuerpo = <Privacidad />;
  else if (ruta === '/_galeria/') cuerpo = <Galeria almacen={almacen} />;
  else if (abriendo)
    cuerpo = (
      <main class="portada" role="status">
        Abriendo tu panel…
      </main>
    );
  // Después de abrir: el regreso de Google ya salió de la barra y la sesión está guardada.
  else if (ruta === '/unirme/')
    cuerpo = (
      <Unirme
        conexion={conexion}
        sesion={sesion}
        alEntrar={entrar}
        alUnirse={(nueva) => {
          setYo(null);
          setEligiendo(false);
          setSesion(nueva);
          irA('/');
        }}
      />
    );
  else if (pantalla === 'entrar') cuerpo = <Entrar aviso={aviso} alEntrar={entrar} />;
  else if (pantalla === 'sin-tienda' && sesion)
    cuerpo = <SinTienda correo={sesion.usuario.email} alSalir={() => void alSalir()} />;
  else if ((pantalla === 'elegir' || eligiendo) && sesion)
    cuerpo = <ElegirTienda tiendas={sesion.organizaciones} aviso={aviso} alElegir={alElegir} />;
  else if (!yo)
    cuerpo = (
      <main class="contenido" role="status">
        Abriendo tu tienda…
      </main>
    );
  else if (yo.tipo === 'sin-tienda' && sesion)
    cuerpo = <SinTienda correo={sesion.usuario.email} alSalir={() => void alSalir()} />;
  else if (yo.tipo !== 'ok')
    cuerpo = (
      <main class="contenido">
        <Aviso tono="peligro" titulo="No pudimos abrir tu tienda">
          {yo.motivo}
        </Aviso>
        <button
          class="ed1-boton ed1-boton--secundario"
          type="button"
          onClick={() => void preguntar()}
        >
          Intentar otra vez
        </button>
      </main>
    );
  // HU-T7.2 CA1: sin los términos vigentes, el propietario los ve antes que el resto del panel.
  else if (
    yo.datos.terminos?.aceptados === false &&
    puede(yo.datos.rol, 'terminos.aceptar') &&
    ruta !== '/mas/terminos/'
  )
    cuerpo = (
      <Terminos
        conexion={conexion}
        rol={yo.datos.rol}
        pedir
        alAceptar={() => void preguntar()}
        alVencer={setVencida}
      />
    );
  else if (ruta === '/')
    cuerpo = <Inicio yo={yo.datos} conexion={conexion} alVencer={setVencida} />;
  else if (ruta === '/pedidos/') cuerpo = <Bandeja conexion={conexion} alVencer={setVencida} />;
  else if (ruta === '/pedidos/nuevo/')
    cuerpo = <Anotar conexion={conexion} alVencer={setVencida} />;
  else if (ruta === '/pedidos/recaudos/')
    cuerpo = <Recaudos conexion={conexion} alVencer={setVencida} />;
  else if (ruta === '/pedidos/solicitudes/')
    cuerpo = <Solicitudes conexion={conexion} alVencer={setVencida} />;
  else if (/^\/pedidos\/solicitudes\/[^/]+\/$/.test(ruta))
    cuerpo = (
      <Solicitud
        key={ruta}
        conexion={conexion}
        id={decodeURIComponent(ruta.split('/')[3] ?? '')}
        alVencer={setVencida}
      />
    );
  else if (/^\/pedidos\/[^/]+\/$/.test(ruta))
    cuerpo = (
      <Pedido
        key={ruta}
        conexion={conexion}
        id={decodeURIComponent(ruta.split('/')[2] ?? '')}
        alVencer={setVencida}
      />
    );
  else if (ruta === '/productos/' || ruta === '/productos/papelera/')
    cuerpo = (
      <Productos
        key={ruta}
        conexion={conexion}
        papelera={ruta === '/productos/papelera/'}
        alVencer={setVencida}
      />
    );
  else if (ruta === '/productos/colecciones/')
    cuerpo = <Colecciones conexion={conexion} alVencer={setVencida} />;
  else if (ruta === '/productos/inventario/')
    cuerpo = <Inventario conexion={conexion} alVencer={setVencida} />;
  else if (/^\/productos\/inventario\/[^/]+\/$/.test(ruta))
    cuerpo = (
      <Existencias
        key={ruta}
        conexion={conexion}
        variante={decodeURIComponent(ruta.split('/')[3] ?? '')}
        alVencer={setVencida}
      />
    );
  else if (/^\/productos\/colecciones\/[^/]+\/$/.test(ruta))
    cuerpo = (
      <Coleccion
        key={ruta}
        conexion={conexion}
        id={decodeURIComponent(ruta.split('/')[3] ?? '')}
        alVencer={setVencida}
      />
    );
  else if (/^\/productos\/[^/]+\/$/.test(ruta)) {
    const id = decodeURIComponent(ruta.split('/')[2] ?? '');
    cuerpo = (
      <Producto
        conexion={conexion}
        almacen={almacen}
        id={id === 'nuevo' ? null : id}
        alVencer={setVencida}
      />
    );
  } else if (ruta === '/mas/ajustes/')
    cuerpo = <Ajustes conexion={conexion} alVencer={setVencida} />;
  else if (esSeccion(ruta.match(/^\/mas\/ajustes\/([^/]+)\/$/)?.[1] ?? '') && sesion?.org_id)
    cuerpo = (
      <AjusteDeSeccion
        key={ruta}
        conexion={conexion}
        almacen={almacen}
        org={sesion.org_id}
        rol={yo.datos.rol}
        seccion={ruta.split('/')[3] as Seccion}
        alVencer={setVencida}
      />
    );
  else if (ruta === '/mas/publicar/')
    cuerpo = <Publicar conexion={conexion} alVencer={setVencida} />;
  else if (ruta === '/mas/venta/') cuerpo = <Venta conexion={conexion} alVencer={setVencida} />;
  else if (/^\/mas\/venta\/envios\/[^/]+\/$/.test(ruta)) {
    const id = decodeURIComponent(ruta.split('/')[4] ?? '');
    cuerpo = (
      <EnvioDeLaTienda
        key={ruta}
        conexion={conexion}
        id={id === 'nuevo' ? null : id}
        alVencer={setVencida}
      />
    );
  } else if (/^\/mas\/venta\/cupones\/[^/]+\/$/.test(ruta)) {
    const codigo = decodeURIComponent(ruta.split('/')[4] ?? '');
    cuerpo = (
      <CuponDeLaTienda
        key={ruta}
        conexion={conexion}
        codigo={codigo === 'nuevo' ? null : codigo}
        alVencer={setVencida}
      />
    );
  } else if (ruta === '/mas/terminos/')
    cuerpo = (
      <Terminos
        conexion={conexion}
        rol={yo.datos.rol}
        pedir={false}
        alAceptar={() => void preguntar()}
        alVencer={setVencida}
      />
    );
  else if (ruta === '/mas/registro/')
    cuerpo = <Registro conexion={conexion} alVencer={setVencida} />;
  else if (ruta === '/mas/datos/')
    cuerpo = <Datos conexion={conexion} rol={yo.datos.rol} alVencer={setVencida} />;
  else if (ruta === '/mas/titular/')
    cuerpo = <Titular conexion={conexion} rol={yo.datos.rol} alVencer={setVencida} />;
  else if (ruta === '/mas/equipo/')
    cuerpo = (
      <Equipo
        conexion={conexion}
        rol={yo.datos.rol}
        tienda={yo.datos.tienda?.nombre ?? 'tu tienda'}
      />
    );
  else if (ruta.startsWith('/mas/') && sesion)
    cuerpo = (
      <Mas
        correo={sesion.usuario.email}
        rol={yo.datos.rol}
        variasTiendas={sesion.organizaciones.length > 1}
        alCambiar={() => setEligiendo(true)}
        alSalir={() => void alSalir()}
      />
    );
  else
    cuerpo = (
      <main class="contenido">
        <h1>Esta pantalla no existe</h1>
        <p>
          <a href="/">Volver al inicio</a>
        </p>
      </main>
    );

  const conMarco = !libre && !abriendo && pantalla === 'panel' && !eligiendo && yo?.tipo === 'ok';
  const tienda = sesion?.organizaciones.find((o) => o.org_id === sesion.org_id);
  return (
    <>
      {conMarco && yo?.tipo === 'ok' ? (
        <Barra
          tienda={yo.datos.tienda?.nombre ?? tienda?.nombre ?? 'Tu tienda'}
          rol={NOMBRE_DEL_ROL[yo.datos.rol] ?? yo.datos.rol}
        />
      ) : null}
      {cuerpo}
      {conMarco ? <Navegacion ruta={ruta} /> : null}
      {vencida && !libre ? <VuelveAEntrar motivo={vencida} alEntrar={entrar} /> : null}
      <AvisoActualizacion />
    </>
  );
}
