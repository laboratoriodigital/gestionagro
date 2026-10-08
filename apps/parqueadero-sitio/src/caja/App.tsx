/**
 * La caja (HU-Q3.1): la cabecera con sus cuatro señales, la impresora y su asistente (HU-Q2.6), los
 * ajustes (HU-Q3.2) y la entrada con su recibo (HU-Q3.3). Las salidas llegan en Q3.
 */
import { useEffect, useState } from 'preact/hooks';
import { Asistente } from './Asistente.tsx';
import { AvisoActualizacion } from './AvisoActualizacion.tsx';
import { Cabecera } from './Cabecera.tsx';
import { BotonDiagnostico, ConexionImpresora, useEstadoImpresora } from './conexion.tsx';
import {
  type BaseDeLaCaja,
  purgarContactos,
  type Rechazo,
  type RegistroImpresora,
} from './datos.ts';
import { Estadias } from './Estadias.tsx';
import { diaLocalBogota, horaBogota } from './fecha.ts';
import { useConsulta } from './ganchos.ts';
import { diferenciaDeHora, senalDeHora } from './hora.ts';
import { alVolverALaCaja, type ControlDeImpresora } from './impresora.ts';
import type { EstadoDeLaNube, Nube } from './nube.ts';
import {
  type Propuesta,
  senalDeImpresora,
  senalDeLaNube,
  senalDePendientes,
  senalDeRespaldo,
} from './senales.ts';
import { avisoDeTopeViejo } from './topes.ts';
import { type Turno, turnoAbierto } from './turno.ts';
import type { Vista } from './vistas.tsx';

interface Props {
  readonly db: BaseDeLaCaja;
  readonly control: ControlDeImpresora;
  readonly propuesta: Propuesta;
  readonly prueba: boolean;
  readonly reloj: () => number;
  /** La sincronización (HU-Q7.5); sin ella, la caja no dice nada de la nube. */
  readonly nube?: Nube;
  /** La caja volvió de la cuenta con `#entrar=…` (HU-Q7.6): abre «Cuenta y nube». */
  readonly regreso?: string;
}

const NOMBRE_DE_PAGINA = {
  cp850: 'CP850',
  windows1252: 'WPC1252',
  cp858: 'CP858',
  transliterar: 'sin tildes',
} as const;

/** Lo que no se hace en cada vehículo va aparte, al final del inicio (HU-Q6.5 CA1). */
const MENU = [
  ['ajustes', 'Ajustes del parqueadero'],
  ['abonados', 'Abonados'],
  ['respaldo', 'Respaldo'],
  ['letrero', 'Aviso de tarifas'],
  ['aviso', 'Aviso de privacidad'],
] as const;

/**
 * La cuenta y la nube (HU-Q7.6) solo fuera de producción: reclamar la caja del cliente espera la
 * promesa de privacidad con cuenta (HU-Q7.11, HU-Q7.12).
 */
const MENU_DE_PRUEBA = [...MENU, ['cuenta', 'Cuenta y nube']] as const;

export function App({ db, control, propuesta, prueba, reloj, nube, regreso }: Props) {
  const vinculada = useConsulta<boolean>(
    () => db.meta.get('nube').then((m) => m?.clave === 'nube'),
    false,
  );
  const enCola = useConsulta(() => db.outbox.count(), 0);
  const cuarentena = useConsulta<Rechazo[]>(
    () => db.rechazos.orderBy('recibido').reverse().toArray(),
    [],
  );
  const [estadoNube, setEstadoNube] = useState<EstadoDeLaNube>(
    nube?.estado() ?? { tipo: 'sin-vincular' },
  );
  useEffect(() => nube?.escuchar(setEstadoNube), [nube]);
  const registro = useConsulta<RegistroImpresora | undefined>(
    () => db.impresora.get('actual'),
    undefined,
  );
  const pendientes = useConsulta(() => db.entregas_pendientes.count(), 0);
  const turno = useConsulta<Turno | null | undefined>(() => turnoAbierto(db), undefined);
  const ciudad = useConsulta<string | undefined>(
    () =>
      db.catalogos
        .where('entidad')
        .equals('sede')
        .first()
        .then((s) => (s?.entidad === 'sede' ? s.ciudad : undefined)),
    undefined,
  );
  // HU-Q1.2 CA2: un tope de más de 13 meses se dice; la caja sigue cobrando.
  const topeViejo = avisoDeTopeViejo(ciudad, diaLocalBogota(reloj()));
  // El último respaldo: el archivo, o la última vez que todo quedó en la nube (HU-Q7.9).
  const respaldo = useConsulta<number | undefined>(async () => {
    const [archivo, enLaNube] = await Promise.all([
      db.meta.get('respaldo'),
      db.meta.get('nube_al_dia'),
    ]);
    const cuando = [
      archivo?.clave === 'respaldo' ? archivo.instante : null,
      enLaNube?.clave === 'nube_al_dia' ? enLaNube.instante : null,
    ].filter((x): x is number => x !== null);
    return cuando.length > 0 ? Math.max(...cuando) : undefined;
  }, undefined);
  const estado = useEstadoImpresora(control);
  const [persistente, setPersistente] = useState<boolean | null>(null);
  const [vista, setVista] = useState<Vista>({ es: 'inicio' });
  const [vistas, setVistas] = useState<typeof import('./vistas.tsx') | null>(null);
  const inicio = () => setVista({ es: 'inicio' });
  const ir = (v: Vista) => {
    if (v.es === 'inicio' || v.es === 'asistente' || vistas) {
      setVista(v);
      return;
    }
    // La primera vez carga las pantallas que traen zod; luego ya están.
    void import('./vistas.tsx').then((m) => {
      setVistas(m);
      setVista(v);
    });
  };

  // HU-Q7.6: de vuelta de la cuenta, la caja abre donde se quedó.
  useEffect(() => {
    if (regreso) ir({ es: 'cuenta', regreso });
  }, [regreso]);

  // HU-Q2.4 CA1: la impresora emparejada vuelve sola al abrir la caja, sin selector.
  useEffect(() => {
    void control.recuperar();
  }, [control]);

  // HU-Q3.8: la hora del teléfono contra la del servidor, al abrir, cada 30 min y al volver la red.
  const [diferencia, setDiferencia] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    const revisar = () =>
      void diferenciaDeHora(fetch, reloj).then((d) => {
        // Sin red no se borra la última revisión: la hora no cambió por perder la señal.
        if (d !== null) setDiferencia(d);
      });
    revisar();
    const t = setInterval(revisar, 30 * 60_000);
    addEventListener('online', revisar);
    return () => {
      clearInterval(t);
      removeEventListener('online', revisar);
    };
  }, [reloj]);

  // Al desbloquear el teléfono, la conexión puede verse abierta y estar muerta (bitácora 19).
  useEffect(() => {
    let oculta = 0;
    const alCambiar = () => {
      if (document.visibilityState === 'hidden') {
        oculta = reloj();
        return;
      }
      const que = alVolverALaCaja(control.estado(), oculta ? reloj() - oculta : 0);
      if (que !== 'nada') void control.reconectar(que === 'refrescar');
    };
    document.addEventListener('visibilitychange', alCambiar);
    return () => document.removeEventListener('visibilitychange', alCambiar);
  }, [control, reloj]);

  // HU-Q4.1 CA3: los números vencidos se borran al abrir la caja y cada 10 minutos.
  useEffect(() => {
    const purgar = () => void purgarContactos(db, reloj());
    purgar();
    const t = setInterval(purgar, 10 * 60_000);
    return () => clearInterval(t);
  }, [db, reloj]);

  // HU-Q3.1 CA2: pedir que el navegador no borre la caja si se llena el teléfono.
  useEffect(() => {
    const storage = navigator.storage as StorageManager | undefined;
    if (!storage?.persist) {
      setPersistente(false);
      return;
    }
    void storage.persist().then(setPersistente, () => setPersistente(false));
  }, []);

  return (
    <>
      <Cabecera
        impresora={senalDeImpresora(registro, estado)}
        respaldo={senalDeRespaldo(respaldo, reloj())}
        hora={senalDeHora(diferencia)}
        pendientes={senalDePendientes(pendientes)}
        prueba={prueba}
        persistente={persistente}
        nube={senalDeLaNube(vinculada, enCola, estadoNube)}
        cuarentena={cuarentena}
      />
      <AvisoActualizacion />
      {topeViejo && (
        <p class="aviso-tope" role="status" data-prueba="aviso-tope">
          {topeViejo}: revise la norma de su ciudad. La caja sigue cobrando con el tope guardado.
        </p>
      )}
      <main class="contenido">
        {vista.es === 'asistente' ? (
          <Asistente
            db={db}
            control={control}
            propuesta={propuesta}
            reloj={reloj}
            alTerminar={inicio}
          />
        ) : vista.es !== 'inicio' && vistas ? (
          <vistas.Pantalla
            vista={vista}
            db={db}
            reloj={reloj}
            control={control}
            prueba={prueba}
            ir={ir}
            {...(nube ? { nube } : {})}
          />
        ) : (
          <>
            {!registro?.probada ? (
              <section class="tarjeta" data-prueba="sin-impresora">
                <h1>Antes del primer recibo, configure la impresora</h1>
                <p>Son cuatro pasos y una página de prueba. Tenga la impresora prendida y cerca.</p>
                <button
                  type="button"
                  class="boton boton-principal"
                  onClick={() => ir({ es: 'asistente' })}
                >
                  Configurar impresora
                </button>
              </section>
            ) : (
              <section class="tarjeta tarjeta-callada" data-prueba="caja-lista">
                <h1 class="solo-lectores">La caja está lista</h1>
                <ConexionImpresora control={control} />
              </section>
            )}
            {turno !== undefined && (
              <section class="turno-linea" data-prueba="tarjeta-turno">
                {turno ? (
                  <p>
                    Turno de {turno.operador}, desde las{' '}
                    <span class="cifra">
                      {horaBogota(Date.parse(turno.apertura.instante_evento))}
                    </span>
                  </p>
                ) : (
                  <p>Abra el turno antes del primer recibo.</p>
                )}
                <button
                  type="button"
                  class="boton boton-secundario boton-compacto"
                  onClick={() => ir({ es: 'turno' })}
                >
                  {turno ? 'Cerrar turno' : 'Abrir turno'}
                </button>
              </section>
            )}
            <div class="acciones-inicio">
              <button
                type="button"
                class="boton boton-principal boton-grande"
                onClick={() => ir({ es: 'entrada' })}
                data-prueba="nueva-entrada"
              >
                Nueva entrada
              </button>
              <button type="button" class="boton" onClick={() => ir({ es: 'escanear' })}>
                Escanear recibo
              </button>
            </div>
            <Estadias db={db} reloj={reloj} ir={ir} />
            {registro && (
              <section class="seccion" data-prueba="ajustes-impresora">
                <h2 class="etiqueta">Ajustes › Impresora</h2>
                <p class="exacto">{registro.nombre}</p>
                <p class="ayuda" data-prueba="pagina-de-codigos">
                  {registro.paginaDeCodigos === 'transliterar'
                    ? 'Imprime sin tildes: ninguna página de códigos se vio bien en la prueba.'
                    : `Tildes con ${NOMBRE_DE_PAGINA[registro.paginaDeCodigos]}; ${registro.columnas} columnas; QR ${registro.qr === 'nativo' ? 'de la impresora' : 'como imagen'}.`}
                </p>
                <button type="button" class="boton" onClick={() => ir({ es: 'asistente' })}>
                  Probar la impresora otra vez
                </button>
                <BotonDiagnostico control={control} />
              </section>
            )}
            <nav class="seccion" aria-labelledby="titulo-mas">
              <h2 class="etiqueta" id="titulo-mas">
                Más
              </h2>
              <ul class="menu">
                {(prueba ? MENU_DE_PRUEBA : MENU).map(([es, texto]) => (
                  <li key={es}>
                    <button type="button" class="menu-fila" onClick={() => ir({ es })}>
                      {texto}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </>
        )}
      </main>
    </>
  );
}
