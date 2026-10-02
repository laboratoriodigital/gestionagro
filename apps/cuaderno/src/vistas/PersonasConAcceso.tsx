/**
 * Quién tiene acceso a la finca (HU-E4.6), dentro de «Tu equipo»: cambiar el rol de alguien o
 * quitarle el acceso. Quitar pide confirmación y dice lo que pasa: deja de sincronizar en máximo
 * 12 h, lo guardado en su teléfono no se borra a distancia y lo que anotó se queda en la finca.
 */
import { useEffect, useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
import { cambiarRol, leerEquipo, type Miembro, quitarDelEquipo } from '../almacen/equipo.ts';
import { NOMBRE_ROL, ROLES_PARA_INVITAR } from '../almacen/invitacion.ts';
import { ErrorDeSesion, urlDelCore } from '../almacen/sesion.ts';

export function PersonasConAcceso(props: { enLinea: boolean }) {
  const [miembros, setMiembros] = useState<Miembro[] | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const core = urlDelCore(location.hostname);

  const cargar = () => {
    if (!props.enLinea) return;
    leerEquipo(cuaderno(), core)
      .then(setMiembros)
      .catch((e: unknown) =>
        setError(e instanceof ErrorDeSesion ? e.message : 'No se pudo leer el equipo.'),
      );
  };
  useEffect(cargar, [props.enLinea]);

  const hacer = async (accion: () => Promise<unknown>, hecho: string) => {
    setError(null);
    setMensaje(null);
    try {
      await accion();
      setMensaje(hecho);
      setConfirmando(null);
      cargar();
    } catch (e) {
      setError(e instanceof ErrorDeSesion ? e.message : 'No se pudo hacer el cambio.');
    }
  };

  if (!props.enLinea) return null;
  return (
    <div data-prueba="personas-con-acceso">
      <h3>Personas con acceso</h3>
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
      {miembros === null ? (
        <p class="ayuda">Cargando…</p>
      ) : (
        <ul class="areas">
          {miembros.map((m) => (
            <li class="area" key={m.usuario_id} data-prueba="miembro">
              <p class="area-titulo">
                <strong>{m.nombre}</strong> · {NOMBRE_ROL[m.rol] ?? m.rol}
                {m.tu && ' (tú)'}
              </p>
              {!m.tu && confirmando !== m.usuario_id && (
                <div class="acciones-area">
                  <label class="solo-lectores" for={`rol-${m.usuario_id}`}>
                    Rol de {m.nombre}
                  </label>
                  <select
                    id={`rol-${m.usuario_id}`}
                    value={m.rol}
                    onChange={(e) => {
                      const rol = (e.currentTarget as HTMLSelectElement).value;
                      void hacer(
                        () => cambiarRol(cuaderno(), core, m.usuario_id, rol),
                        `${m.nombre} ahora es ${NOMBRE_ROL[rol] ?? rol}. Lo verá al sincronizar, en máximo 12 horas.`,
                      );
                    }}
                  >
                    {ROLES_PARA_INVITAR.map((r) => (
                      <option key={r} value={r}>
                        {NOMBRE_ROL[r]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    class="secundario"
                    onClick={() => setConfirmando(m.usuario_id)}
                  >
                    Quitar acceso
                  </button>
                </div>
              )}
              {confirmando === m.usuario_id && (
                <div class="aviso-ecologico" data-prueba="confirmar-quitar">
                  <p>
                    ¿Quitarle el acceso a {m.nombre}? Deja de sincronizar en máximo 12 horas. Lo que
                    ya está guardado en su teléfono no se puede borrar a distancia. Lo que anotó se
                    queda en la finca.
                  </p>
                  <div class="acciones">
                    <button type="button" class="secundario" onClick={() => setConfirmando(null)}>
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void hacer(
                          () => quitarDelEquipo(cuaderno(), core, m.usuario_id),
                          `${m.nombre} ya no tiene acceso a la finca.`,
                        )
                      }
                    >
                      Sí, quitar acceso
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
