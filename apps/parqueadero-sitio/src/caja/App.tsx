/**
 * La caja (HU-Q3.1). En Q1: la cabecera con sus cuatro señales, la impresora y su asistente
 * (HU-Q2.6). Las entradas y salidas llegan en Q2.
 */
import { FalloDeImpresora, TEXTO_DEL_MOTIVO } from '@ed1/impresion';
import { useEffect, useState } from 'preact/hooks';
import { Asistente } from './Asistente.tsx';
import { AvisoActualizacion } from './AvisoActualizacion.tsx';
import { Cabecera } from './Cabecera.tsx';
import type { BaseDeLaCaja, RegistroImpresora } from './datos.ts';
import { useConsulta } from './ganchos.ts';
import type { ControlDeImpresora } from './impresora.ts';
import { type Propuesta, senalDeImpresora, senalDePendientes } from './senales.ts';

interface Props {
  readonly db: BaseDeLaCaja;
  readonly control: ControlDeImpresora;
  readonly propuesta: Propuesta;
  readonly prueba: boolean;
  readonly reloj: () => number;
}

const NOMBRE_DE_PAGINA = {
  cp850: 'CP850',
  windows1252: 'WPC1252',
  cp858: 'CP858',
  transliterar: 'sin tildes',
} as const;

export function App({ db, control, propuesta, prueba, reloj }: Props) {
  const registro = useConsulta<RegistroImpresora | undefined>(
    () => db.impresora.get('actual'),
    undefined,
  );
  const pendientes = useConsulta(() => db.entregas_pendientes.count(), 0);
  const [estado, setEstado] = useState(control.estado());
  const [persistente, setPersistente] = useState<boolean | null>(null);
  const [asistente, setAsistente] = useState(false);
  const [aviso, setAviso] = useState('');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => control.escuchar(setEstado), [control]);

  // HU-Q3.1 CA2: pedir que el navegador no borre la caja si se llena el teléfono.
  useEffect(() => {
    const storage = navigator.storage as StorageManager | undefined;
    if (!storage?.persist) {
      setPersistente(false);
      return;
    }
    void storage.persist().then(setPersistente, () => setPersistente(false));
  }, []);

  async function conectar() {
    setAviso('');
    try {
      await control.conectar(false);
    } catch (e) {
      setAviso(e instanceof FalloDeImpresora ? TEXTO_DEL_MOTIVO[e.motivo] : 'No se pudo conectar');
    }
  }

  async function copiarDiagnostico() {
    await navigator.clipboard?.writeText(control.diagnostico());
    setCopiado(true);
  }

  return (
    <>
      <Cabecera
        impresora={senalDeImpresora(registro, estado)}
        respaldo={{ texto: 'Respaldo sin hacer', tono: 'aviso' }}
        hora={{ texto: 'Hora sin revisar', tono: 'neutro' }}
        pendientes={senalDePendientes(pendientes)}
        prueba={prueba}
        persistente={persistente}
      />
      <AvisoActualizacion />
      <main class="contenido">
        {asistente ? (
          <Asistente
            db={db}
            control={control}
            propuesta={propuesta}
            reloj={reloj}
            alTerminar={() => setAsistente(false)}
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
                  onClick={() => setAsistente(true)}
                >
                  Configurar impresora
                </button>
              </section>
            ) : (
              <section class="tarjeta" data-prueba="caja-lista">
                <h1>La caja está lista</h1>
                <p>Las entradas y las salidas llegan en la próxima versión.</p>
                {estado === 'sin_vincular' && (
                  <button
                    type="button"
                    class="boton boton-principal"
                    onClick={() => void conectar()}
                  >
                    Conectar impresora
                  </button>
                )}
                {aviso && (
                  <p class="error" role="alert">
                    {aviso}
                  </p>
                )}
              </section>
            )}
            {registro && (
              <section class="tarjeta" data-prueba="ajustes-impresora">
                <h2>Ajustes › Impresora</h2>
                <p class="exacto">{registro.nombre}</p>
                <p data-prueba="pagina-de-codigos">
                  {registro.paginaDeCodigos === 'transliterar'
                    ? 'Imprime sin tildes: ninguna página de códigos se vio bien en la prueba.'
                    : `Tildes con ${NOMBRE_DE_PAGINA[registro.paginaDeCodigos]}; ${registro.columnas} columnas; QR ${registro.qr === 'nativo' ? 'de la impresora' : 'como imagen'}.`}
                </p>
                <button type="button" class="boton" onClick={() => setAsistente(true)}>
                  Probar la impresora otra vez
                </button>
                <button
                  type="button"
                  class="boton boton-secundario"
                  onClick={() => void copiarDiagnostico()}
                >
                  {copiado ? 'Diagnóstico copiado' : 'Copiar diagnóstico para soporte'}
                </button>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
