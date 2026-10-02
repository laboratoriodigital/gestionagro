/**
 * Claves públicas del QR de trazabilidad en la página `/agro/t/` (HU-E6.4, ARQUITECTURA §5.9).
 *
 * La página verifica la firma sin pedir nada a la nube, así que lleva las claves dentro. El build
 * deja `[]` en `#claves-qr`; el despliegue del sitio lo reemplaza por las claves que publica cada
 * celda activa (`/api/claves-qr`) antes de subirlo. Funciones con `fetch` inyectado, para
 * probarlas sin tocar Cloudflare.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Fetch } from './despliegue.ts';
import { RAIZ } from './repo.ts';

export interface ClaveQr {
  kid: string;
  x: string;
}

export const PAGINA_QR = join(RAIZ, 'apps', 'sitio', 'dist', 'agro', 't', 'index.html');
const MARCA = /(<script type="application\/json" id="claves-qr">)([\s\S]*?)(<\/script>)/;

/** Las claves que publica una celda. Lanza con el motivo si no las da. */
export async function clavesQrDe(fetchFn: Fetch, api: string): Promise<ClaveQr[]> {
  let r: Response;
  try {
    r = await fetchFn(`${api}/api/claves-qr`);
  } catch (e) {
    throw new Error(`${api} no respondió al pedir sus claves del QR: ${(e as Error).message}`);
  }
  const cuerpo = (await r.json().catch(() => ({}))) as { claves?: unknown };
  const claves = Array.isArray(cuerpo.claves) ? (cuerpo.claves as Partial<ClaveQr>[]) : [];
  const validas = claves.filter(
    (c): c is ClaveQr => typeof c.kid === 'string' && typeof c.x === 'string',
  );
  if (r.status !== 200 || validas.length === 0) {
    throw new Error(`${api} no entregó sus claves del QR (HTTP ${r.status})`);
  }
  return validas.map(({ kid, x }) => ({ kid, x }));
}

/** El HTML de la página con las claves dentro. Lanza si la página no tiene el lugar marcado. */
export function conClavesQr(html: string, claves: readonly ClaveQr[]): string {
  if (!MARCA.test(html)) {
    throw new Error('la página /agro/t/ no tiene el bloque #claves-qr: ¿cambió la plantilla?');
  }
  // `<` escapado: una clave nunca puede cerrar el bloque de script.
  const json = JSON.stringify(claves).replaceAll('<', '\\u003c');
  return html.replace(
    MARCA,
    (_t, abre: string, _viejo: string, cierra: string) => `${abre}${json}${cierra}`,
  );
}

export function ponerClavesEnLaPagina(claves: readonly ClaveQr[], ruta = PAGINA_QR): void {
  writeFileSync(ruta, conClavesQr(readFileSync(ruta, 'utf8'), claves));
}
