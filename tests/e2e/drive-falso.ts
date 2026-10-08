/**
 * Google Drive y el permiso del CORE, falsos, para las e2e de la copia en el Drive de la persona
 * (`@ed1/drive`): el cuaderno (HU-E8.4) y la caja del parqueadero (HU-Q10.1). Esta prueba no ve
 * Google de verdad (P17); el permiso real se prueba en staging (P16).
 */
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

const { core } = JSON.parse(readFileSync('infrastructure/celdas.json', 'utf8')) as {
  core: { url_staging: string };
};
const CORE = core.url_staging;
export const TOKEN = 'token-drive-e2e';
export const T0 = new Date('2026-10-05T15:30:00Z');

interface Archivo {
  id: string;
  name: string;
  parents: string[];
  contenido: string;
  createdTime: string;
}

/** Un Google Drive en memoria, compartido por los «teléfonos» de una prueba. */
export function crearDrive() {
  const archivos: Archivo[] = [];
  let n = 0;
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, DELETE',
  };
  async function atender(page: Page) {
    await page.route('https://www.googleapis.com/**', async (ruta) => {
      const pedido = ruta.request();
      if (pedido.method() === 'OPTIONS') return ruta.fulfill({ status: 204, headers: cors });
      if (pedido.headers()['authorization'] !== `Bearer ${TOKEN}`) {
        return ruta.fulfill({ status: 401, headers: cors, json: {} });
      }
      const u = new URL(pedido.url());
      if (u.pathname === '/upload/drive/v3/files') {
        const limite = (pedido.headers()['content-type'] ?? '').split('boundary=')[1] ?? '';
        const partes = (pedido.postData() ?? '').split(`--${limite}`);
        const cuerpo = (p: string) =>
          p.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '');
        const meta = JSON.parse(cuerpo(partes[1] ?? '')) as { name: string; parents: string[] };
        const id = `a${++n}`;
        archivos.push({
          id,
          name: meta.name,
          parents: meta.parents,
          contenido: cuerpo(partes[2] ?? ''),
          createdTime: new Date(T0.getTime() + n * 1000).toISOString(),
        });
        return ruta.fulfill({ headers: cors, json: { id } });
      }
      if (u.pathname === '/drive/v3/files' && pedido.method() === 'POST') {
        const meta = pedido.postDataJSON() as { name: string };
        const id = `c${++n}`;
        archivos.push({
          id,
          name: meta.name,
          parents: [],
          contenido: '',
          createdTime: T0.toISOString(),
        });
        return ruta.fulfill({ headers: cors, json: { id } });
      }
      if (u.pathname === '/drive/v3/files') {
        const q = u.searchParams.get('q') ?? '';
        const padre = q.match(/^'([^']+)' in parents/)?.[1];
        const nombre = q.match(/name = '([^']+)'/)?.[1];
        const lista = archivos
          .filter((a) => (padre ? a.parents.includes(padre) : a.name === nombre))
          .sort((x, y) => y.createdTime.localeCompare(x.createdTime))
          .map((a) => ({
            id: a.id,
            name: a.name,
            size: String(a.contenido.length),
            createdTime: a.createdTime,
          }));
        return ruta.fulfill({ headers: cors, json: { files: lista } });
      }
      const id = u.pathname.split('/').at(-1);
      const archivo = archivos.find((a) => a.id === id);
      if (!archivo) return ruta.fulfill({ status: 404, headers: cors, json: {} });
      if (pedido.method() === 'DELETE') {
        archivos.splice(archivos.indexOf(archivo), 1);
        return ruta.fulfill({ status: 204, headers: cors });
      }
      return ruta.fulfill({ headers: cors, body: archivo.contenido });
    });
  }
  return { archivos, atender };
}

/** CORE falso: el inicio «vuelve de Google» con un sello o un error; el canje entrega el token. */
export async function coreFalso(page: Page, vuelta: 'sello' | 'cancelada' = 'sello') {
  const pedidos: { desafio: string; verificador?: string } = { desafio: '' };
  await page.route(`${CORE}/api/core/drive/inicio?*`, async (ruta) => {
    const u = new URL(ruta.request().url());
    pedidos.desafio = u.searchParams.get('desafio') ?? '';
    const destino = u.searchParams.get('vuelta');
    const fragmento = vuelta === 'sello' ? 'drive=sello-e2e' : 'drive-error=cancelada';
    await ruta.fulfill({ status: 302, headers: { location: `${destino}#${fragmento}` } });
  });
  await page.route(`${CORE}/api/core/drive/canje`, async (ruta) => {
    pedidos.verificador = (ruta.request().postDataJSON() as { verificador: string }).verificador;
    await ruta.fulfill({
      json: { acceso: TOKEN, vence: Date.now() + 3600_000 },
      headers: { 'access-control-allow-origin': new URL(page.url()).origin },
    });
  });
  return pedidos;
}
