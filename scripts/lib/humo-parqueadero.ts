/**
 * La prueba de humo del sitio del parqueadero (HU-Q5.1 CA3): `/caja/` responde con su CSP y su
 * service worker. Sin ellos la caja no abre sin red ni puede imprimir (Web Bluetooth y el service
 * worker piden un contexto seguro), así que un staging sin ellos es un staging roto (P16).
 */
import { CSP_DEL_PARQUEADERO } from './cabeceras-parqueadero.ts';

export async function humoParqueadero(fetchFn: typeof fetch, url: string): Promise<string[]> {
  const fallas: string[] = [];
  try {
    const caja = await fetchFn(`${url}/caja/`);
    if (caja.status !== 200) fallas.push(`parqueadero: ${url}/caja/ respondió ${caja.status}`);
    else if (!(await caja.text()).includes('Caja del parqueadero')) {
      fallas.push(`parqueadero: ${url}/caja/ no es la caja`);
    }
    if (caja.headers.get('content-security-policy') !== CSP_DEL_PARQUEADERO) {
      fallas.push(`parqueadero: ${url}/caja/ no trae la CSP de la caja`);
    }
    if (caja.headers.get('x-robots-tag') !== 'noindex') {
      fallas.push(`parqueadero: ${url}/caja/ se podría indexar (falta X-Robots-Tag)`);
    }
    const sw = await fetchFn(`${url}/caja/sw.js`);
    if (sw.status !== 200 || !(sw.headers.get('content-type') ?? '').includes('javascript')) {
      fallas.push(`parqueadero: ${url}/caja/sw.js respondió ${sw.status}, sin service worker`);
    }
  } catch (e) {
    fallas.push(`parqueadero: ${url} no respondió (${(e as Error).message})`);
  }
  return fallas;
}
