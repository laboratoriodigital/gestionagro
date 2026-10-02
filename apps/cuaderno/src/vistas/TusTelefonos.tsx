/**
 * Los teléfonos donde entraste con tu cuenta (HU-E4.6), en Cuenta. Retirar uno (perdido, robado,
 * prestado) invalida su sesión: deja de sincronizar en máximo 12 horas (CA1). Lo guardado en ese
 * teléfono no se puede borrar a distancia, y la pantalla lo dice (CA2).
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

export function TusTelefonos(props: { enLinea: boolean }) {
  const [telefonos, setTelefonos] = useState<Telefono[] | null>(null);
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
      .then(setTelefonos)
      .catch((e: unknown) =>
        setError(e instanceof ErrorDeSesion ? e.message : 'No se pudieron leer tus teléfonos.'),
      );
  };
  useEffect(cargar, [props.enLinea]);

  const retirar = async (t: Telefono) => {
    setError(null);
    try {
      await retirarTelefono(cuaderno(), core, t.id);
      setMensaje(
        'Listo. Ese teléfono deja de sincronizar en máximo 12 horas. Lo que ya tenía guardado no se puede borrar a distancia.',
      );
      setConfirmando(null);
      cargar();
    } catch (e) {
      setError(e instanceof ErrorDeSesion ? e.message : 'No se pudo retirar el teléfono.');
    }
  };

  if (!props.enLinea) return null;
  return (
    <div data-prueba="tus-telefonos">
      <h2>Tus teléfonos</h2>
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
      {telefonos === null ? (
        <p class="ayuda">Cargando…</p>
      ) : (
        <ul class="areas">
          {telefonos.map((t) => (
            <li class="area" key={t.id} data-prueba="telefono">
              <p class="area-titulo">
                {t.dispositivo === este ? <strong>Este teléfono</strong> : 'Otro teléfono'} · entró
                el {fecha(t.creado)}
              </p>
              {t.dispositivo !== este && confirmando !== t.id && (
                <div class="acciones-area">
                  <button type="button" class="secundario" onClick={() => setConfirmando(t.id)}>
                    Retirar acceso
                  </button>
                </div>
              )}
              {confirmando === t.id && (
                <div class="aviso-ecologico" data-prueba="confirmar-retirar">
                  <p>
                    ¿Retirarle el acceso a este teléfono? Deja de sincronizar en máximo 12 horas. Lo
                    que ya está guardado en él no se puede borrar a distancia.
                  </p>
                  <div class="acciones">
                    <button type="button" class="secundario" onClick={() => setConfirmando(null)}>
                      Cancelar
                    </button>
                    <button type="button" onClick={() => void retirar(t)}>
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
