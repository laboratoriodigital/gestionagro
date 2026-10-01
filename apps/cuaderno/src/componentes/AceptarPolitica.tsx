/**
 * Casilla para aceptar la política de tratamiento de datos antes de entrar con Google (HU-E0.5,
 * CA3). La usan Cuenta y «Unirme»; la versión sale de la misma fuente que la página y el CORE (P2).
 */
import politica from '../../../../content/agro/privacidad/politica.json' with { type: 'json' };

export const VERSION_POLITICA: string = politica.version;

/** Dirección para entrar con Google: vuelve a `vuelta` y lleva la versión aceptada. */
export const urlDeEntrada = (core: string, vuelta: string) =>
  `${core}/api/core/auth/google/inicio?vuelta=${encodeURIComponent(vuelta)}&politica=${encodeURIComponent(VERSION_POLITICA)}`;

export function AceptarPolitica(props: { acepta: boolean; alCambiar: (acepta: boolean) => void }) {
  return (
    <div class="opcion">
      <input
        id="acepta-politica"
        type="checkbox"
        checked={props.acepta}
        onChange={(e) => props.alCambiar((e.currentTarget as HTMLInputElement).checked)}
      />
      <label for="acepta-politica">
        Leí y acepto la{' '}
        <a href="/agro/privacidad/" target="_blank" rel="noopener">
          política de tratamiento de datos
        </a>{' '}
        (versión {VERSION_POLITICA}).
      </label>
    </div>
  );
}
