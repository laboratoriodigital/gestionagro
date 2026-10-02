/**
 * Los dispositivos donde entraste con tu cuenta (HU-E4.6), en Cuenta: teléfonos, tabletas o
 * computadores. Retirar uno (perdido, robado, prestado) invalida su sesión: deja de sincronizar en
 * máximo 12 horas (CA1). Lo guardado en ese dispositivo no se puede borrar a distancia, y la
 * pantalla lo dice (CA2). Lista plana: una fila por dispositivo, con su botón al lado.
 */
import { useEffect, useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
import { idDispositivo } from '../almacen/dispositivo.ts';
import { leerTelefonos, retirarTelefono, type Telefono } from '../almacen/equipo.ts';
import { ErrorDeSesion, urlDelCore } from '../almacen/sesion.ts';

const fecha = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Bogota',
  }).format(Date.parse(iso));

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** «1 sep 2026» en Colombia, para que la fila quepa en 360 px junto a su botón. */
const fechaCorta = (iso: string) => {
  const [a, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' })
    .format(Date.parse(iso))
    .split('-')
    .map(Number) as [number, number, number];
  return `${d} ${MESES[m - 1]} ${a}`;
};

export function TusDispositivos(props: { enLinea: boolean }) {
  const [dispositivos, setDispositivos] = useState<Telefono[] | null>(null);
  const [este, setEste] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const core = urlDelCore(location.hostname);

  const cargar = () => {
    if (!props.enLinea) return;
    const db = cuaderno();
    void idDispositivo(db).then(setEste);
    leerTelefonos(db, core)
      .then(setDispositivos)
      .catch((e: unknown) =>
        setError(e instanceof ErrorDeSesion ? e.message : 'No se pudieron leer tus dispositivos.'),
      );
  };
  useEffect(cargar, [props.enLinea]);

  const retirar = async (d: Telefono) => {
    setError(null);
    try {
      await retirarTelefono(cuaderno(), core, d.id);
      setMensaje(
        'Listo. Ese dispositivo deja de sincronizar en máximo 12 horas. Lo que ya tenía guardado no se puede borrar a distancia.',
      );
      setConfirmando(null);
      cargar();
    } catch (e) {
      setError(e instanceof ErrorDeSesion ? e.message : 'No se pudo retirar el dispositivo.');
    }
  };

  if (!props.enLinea) return null;
  return (
    <div data-prueba="tus-dispositivos">
      <h2>Tus dispositivos</h2>
      <p>Donde entraste con tu cuenta. Si perdiste uno, retírale el acceso.</p>
      {mensaje && (
        <p class="exito" role="status">
          {mensaje}
        </p>
      )}
      {error && (
        <p class="error" role="alert">
          {error}
        </p>
      )}
      {dispositivos === null ? (
        <p class="ayuda">Cargando…</p>
      ) : (
        <ul class="lista-plana">
          {dispositivos.map((d) => (
            <li key={d.id} data-prueba="dispositivo">
              <div class="fila-plana">
                <span>
                  {d.dispositivo === este ? <strong>Este dispositivo</strong> : 'Otro dispositivo'}{' '}
                  · desde el {fechaCorta(d.creado)}
                </span>
                {d.dispositivo !== este && confirmando !== d.id && (
                  <button
                    type="button"
                    class="secundario"
                    onClick={() => setConfirmando(d.id)}
                    aria-label={`Retirar acceso al dispositivo que entró el ${fecha(d.creado)}`}
                  >
                    Retirar
                  </button>
                )}
              </div>
              {confirmando === d.id && (
                <div class="aviso-ecologico" data-prueba="confirmar-retirar">
                  <p>
                    ¿Retirarle el acceso a este dispositivo? Deja de sincronizar en máximo 12 horas.
                    Lo que ya está guardado en él no se puede borrar a distancia.
                  </p>
                  <div class="acciones">
                    <button type="button" class="secundario" onClick={() => setConfirmando(null)}>
                      Cancelar
                    </button>
                    <button type="button" onClick={() => void retirar(d)}>
                      Sí, retirar acceso
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
