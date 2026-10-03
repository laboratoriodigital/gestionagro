/**
 * Varias fincas en un mismo teléfono (HU-E4.7): cuáles hay, cambiar de una a otra y agregar otra.
 * Cambiar recarga la app con la base de la otra finca: ninguna pantalla queda con datos mezclados.
 */
import { useEffect, useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
import { abrirCuaderno } from '../almacen/db.ts';
import {
  anotarFinca,
  anotarFincaActiva,
  baseActiva,
  cambiarDeFinca,
  FINCA_SIN_NOMBRE,
  type FincaLocal,
  fincasLocales,
  nuevaBase,
} from '../almacen/fincas-locales.ts';

/**
 * Pasa a otra finca del teléfono, o a una nueva (`base` null). Con `bajar`, la nueva baja esa
 * finca de la nube al abrir Cuenta.
 */
export async function irAFinca(
  base: string | null,
  bajar?: { org_id: string; nombre: string },
): Promise<void> {
  // La finca de ahora entra a la lista aunque hasta hoy fuera la única.
  await anotarFincaActiva(cuaderno(), { siempre: true });
  const hacia = abrirCuaderno({ nombre: base ?? nuevaBase() });
  await cambiarDeFinca(cuaderno(), hacia, { bajarOrg: bajar?.org_id ?? null });
  if (!base) {
    anotarFinca({
      base: hacia.name,
      nombre: bajar?.nombre ?? FINCA_SIN_NOMBRE,
      org_id: bajar?.org_id ?? null,
    });
  }
  hacia.close();
  location.assign(bajar ? '/agro/app/cuenta/' : '/agro/app/');
}

/**
 * Las fincas del teléfono, con la abierta al día (nombre y vínculo). Con una sola, la lista
 * guardada está vacía y la abierta se agrega aquí, sin guardarla.
 */
export function usarFincasLocales(): FincaLocal[] {
  const [lista, setLista] = useState<FincaLocal[]>(() => fincasLocales());
  useEffect(() => {
    void anotarFincaActiva(cuaderno()).then((abierta) => {
      const guardadas = fincasLocales().filter((f) => f.base !== abierta?.base);
      setLista(abierta ? [...guardadas, abierta] : guardadas);
    });
  }, []);
  return lista;
}

export function FincasDelTelefono({ lista }: { lista: FincaLocal[] }) {
  const [cambiando, setCambiando] = useState(false);
  const activa = baseActiva();
  const ir = (base: string | null) => {
    setCambiando(true);
    void irAFinca(base).catch(() => setCambiando(false));
  };
  const deActiva = lista.find((f) => f.base === activa);
  // Agregar otra solo tiene sentido si esta ya tiene finca: si no, se configura aquí mismo.
  const puedeAgregar = Boolean(
    deActiva && (deActiva.nombre !== FINCA_SIN_NOMBRE || deActiva.org_id),
  );
  if (lista.length <= 1 && !puedeAgregar) return null;

  return (
    <div data-prueba="fincas-del-telefono">
      <h2>Fincas en este teléfono</h2>
      {lista.length > 1 && (
        <>
          <ul class="lista-plana">
            {lista.map((f) => (
              <li key={f.base}>
                <strong>{f.nombre}</strong>
                {f.org_id ? '' : ' · solo en este teléfono'}
                {f.base === activa ? (
                  <span class="detalle-insumo"> · abierta</span>
                ) : (
                  <>
                    {' '}
                    <button
                      type="button"
                      class="secundario"
                      disabled={cambiando}
                      onClick={() => ir(f.base)}
                    >
                      Cambiar a esta finca
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          <p class="ayuda">
            Cada finca guarda lo suyo y no se mezclan. Lo que registres en una finca se sube a la
            nube cuando la tengas abierta.
          </p>
        </>
      )}
      {puedeAgregar && (
        <div class="acciones">
          <button
            type="button"
            class="secundario"
            disabled={cambiando}
            onClick={() => ir(null)}
            data-prueba="agregar-finca"
          >
            Agregar otra finca en este teléfono
          </button>
        </div>
      )}
      {lista.length <= 1 && puedeAgregar && (
        <p class="ayuda">
          ¿Llevas más de una finca? Agrégala aquí y pasa de una a otra sin mezclar sus datos.
        </p>
      )}
    </div>
  );
}
