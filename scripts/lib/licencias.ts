/**
 * Licencias de las dependencias (HU-E1.2, ED1 [H6]). Una AGPL o una dependencia sin licencia
 * rompe el build con el nombre del paquete; la excepción se decide a mano (ARQUITECTURA §5.3).
 */

/** Formato de `pnpm licenses list --json`: licencia → paquetes. */
export type ListadoDeLicencias = Record<
  string,
  ReadonlyArray<{ name: string; versions: string[] }>
>;

export interface Rechazo {
  paquete: string;
  licencia: string;
  motivo: string;
}

const SIN_LICENCIA = /^(|unknown|unlicensed|none|see license in .*)$/i;
const PROHIBIDA = /\bAGPL\b/i;

/** `MIT OR AGPL-3.0` se acepta: se puede elegir la alternativa. `MIT AND AGPL-3.0` no. */
function esProhibida(expresion: string): boolean {
  const alternativas = expresion.replace(/[()]/g, ' ').split(/\s+OR\s+/i);
  return alternativas.every((alt) => PROHIBIDA.test(alt));
}

export function revisarLicencias(listado: ListadoDeLicencias): Rechazo[] {
  const rechazos: Rechazo[] = [];
  for (const [licencia, paquetes] of Object.entries(listado)) {
    const expresion = licencia.trim();
    const motivo = SIN_LICENCIA.test(expresion)
      ? 'sin licencia declarada'
      : esProhibida(expresion)
        ? 'licencia AGPL'
        : null;
    if (!motivo) continue;
    for (const p of paquetes) {
      rechazos.push({
        paquete: `${p.name}@${p.versions.join(',')}`,
        licencia: expresion || '(vacía)',
        motivo,
      });
    }
  }
  return rechazos.sort((a, b) => a.paquete.localeCompare(b.paquete));
}
