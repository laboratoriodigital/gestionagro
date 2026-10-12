/**
 * Claves públicas de las celdas dentro de las páginas que verifican firmas sin pedir nada a la
 * nube (ARQUITECTURA §5.9, ADR-36):
 * - el QR de trazabilidad en `/agro/t/` (HU-E6.4): `#claves-qr`, de `/api/claves-qr`;
 * - el recibo del parqueadero en `/r/` (HU-Q8.2): `#claves-recibo`, de `/api/claves-recibo`.
 *
 * El build deja `[]` en el bloque; el despliegue lo reemplaza por las claves que publica cada
 * celda activa del producto antes de subir la página. Funciones con `fetch` inyectado, para
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
export const PAGINA_RECIBO = join(RAIZ, 'apps', 'parqueadero-sitio', 'dist', 'r', 'index.html');

/** Cada página con su bloque y la ruta de la celda que da sus claves. */
export const PAGINAS = {
  qr: { bloque: 'claves-qr', ruta: '/api/claves-qr', nombre: 'del QR', pagina: '/agro/t/' },
  recibo: {
    bloque: 'claves-recibo',
    ruta: '/api/claves-recibo',
    nombre: 'de recibos',
    pagina: '/r/',
  },
} as const;
type Pagina = (typeof PAGINAS)[keyof typeof PAGINAS];

const marca = (bloque: string) =>
  new RegExp(`(<script type="application/json" id="${bloque}">)([\\s\\S]*?)(</script>)`);

/** Las claves que publica una celda. Lanza con el motivo si no las da. */
export async function clavesQrDe(
  fetchFn: Fetch,
  api: string,
  pagina: Pagina = PAGINAS.qr,
): Promise<ClaveQr[]> {
  let r: Response;
  try {
    r = await fetchFn(`${api}${pagina.ruta}`);
  } catch (e) {
    throw new Error(
      `${api} no respondió al pedir sus claves ${pagina.nombre}: ${(e as Error).message}`,
    );
  }
  const cuerpo = (await r.json().catch(() => ({}))) as { claves?: unknown };
  const claves = Array.isArray(cuerpo.claves) ? (cuerpo.claves as Partial<ClaveQr>[]) : [];
  const validas = claves.filter(
    (c): c is ClaveQr => typeof c.kid === 'string' && typeof c.x === 'string',
  );
  if (r.status !== 200 || validas.length === 0) {
    throw new Error(`${api} no entregó sus claves ${pagina.nombre} (HTTP ${r.status})`);
  }
  return validas.map(({ kid, x }) => ({ kid, x }));
}

/** El HTML de la página con las claves dentro. Lanza si la página no tiene el lugar marcado. */
export function conClavesQr(
  html: string,
  claves: readonly ClaveQr[],
  pagina: Pagina = PAGINAS.qr,
): string {
  const MARCA = marca(pagina.bloque);
  if (!MARCA.test(html)) {
    throw new Error(
      `la página ${pagina.pagina} no tiene el bloque #${pagina.bloque}: ¿cambió la plantilla?`,
    );
  }
  // `<` escapado: una clave nunca puede cerrar el bloque de script.
  const json = JSON.stringify(claves).replaceAll('<', '\\u003c');
  return html.replace(
    MARCA,
    (_t, abre: string, _viejo: string, cierra: string) => `${abre}${json}${cierra}`,
  );
}

export function ponerClavesEnLaPagina(
  claves: readonly ClaveQr[],
  ruta: string = PAGINA_QR,
  pagina: Pagina = PAGINAS.qr,
): void {
  writeFileSync(ruta, conClavesQr(readFileSync(ruta, 'utf8'), claves, pagina));
}
