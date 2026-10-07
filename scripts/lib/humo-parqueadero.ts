/**
 * La prueba de humo del sitio del parqueadero (HU-Q5.1 CA3, HU-Q5.2 CA2): `/caja/` responde con su
 * CSP y su service worker, y `/r/` con la página del recibo. Sin ellos la caja no abre sin red ni
 * puede imprimir (Web Bluetooth y el service worker piden un contexto seguro) y los enlaces de los
 * recibos no abren: un despliegue sin ellos es un despliegue roto (P16). En producción, además, HSTS.
 */
import { CSP_DEL_PARQUEADERO, type EntornoDelParqueadero } from './cabeceras-parqueadero.ts';

export async function humoParqueadero(
  fetchFn: typeof fetch,
  url: string,
  entorno: EntornoDelParqueadero = 'staging',
): Promise<string[]> {
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
    if (entorno === 'produccion' && !caja.headers.get('strict-transport-security')) {
      fallas.push(`parqueadero: ${url}/caja/ no trae HSTS`);
    }
    const recibo = await fetchFn(`${url}/r/`);
    if (recibo.status !== 200 || !(await recibo.text()).includes('Recibo de parqueadero')) {
      fallas.push(`parqueadero: ${url}/r/ respondió ${recibo.status}, sin la página del recibo`);
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
