/**
 * Elegir la tienda (HU-T8.1, el boceto): una tarjeta por tienda con su nombre, el rol y el plan.
 * Elegir renueva la sesión hacia esa tienda; el token solo sirve para ella (HU-T2.8).
 */
import { Aviso } from '@ed1/ui/v2/componentes';
import { useState } from 'preact/hooks';
import type { TiendaDeLaCuenta } from '../sesion.ts';

export const NOMBRE_DEL_ROL: Readonly<Record<string, string>> = {
  propietario: 'Propietario',
  colaborador: 'Colaborador',
  despachos: 'Despachos',
};

export function ElegirTienda({
  tiendas,
  aviso,
  alElegir,
}: {
  tiendas: readonly TiendaDeLaCuenta[];
  aviso: string | null;
  alElegir: (org: string) => Promise<void>;
}) {
  const [abriendo, setAbriendo] = useState<string | null>(null);
  return (
    <main class="contenido">
      <h1>¿Qué tienda abres?</h1>
      {aviso ? <Aviso tono="aviso" titulo={aviso} /> : null}
      <ul class="tiendas">
        {tiendas.map((t) => (
          <li key={t.org_id} class="tienda">
            <h2 class="tienda__nombre">{t.nombre}</h2>
            <p class="tienda__datos">
              <span class="etiqueta">{NOMBRE_DEL_ROL[t.rol] ?? t.rol}</span>
              <span class="etiqueta">Plan {t.plan ?? 'sin dato'}</span>
            </p>
            <button
              class="ed1-boton ed1-boton--primario"
              type="button"
              disabled={abriendo !== null}
              aria-busy={abriendo === t.org_id ? 'true' : undefined}
              onClick={async () => {
                setAbriendo(t.org_id);
                try {
                  await alElegir(t.org_id);
                } finally {
                  setAbriendo(null);
                }
              }}
            >
              Abrir {t.nombre}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
