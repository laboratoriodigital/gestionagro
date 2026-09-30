/**
 * Servidor estático mínimo para las pruebas e2e: sirve `apps/sitio/dist` como lo haría
 * Workers Static Assets (carpeta → `index.html`, 404 si no existe). Sin dependencias y en Node,
 * para que corra igual en Windows y en Linux (ADR-18).
 *
 * Lo que NO imita (P17): la compresión y la caché de Cloudflare. El presupuesto de JS se mide
 * comprimiendo con gzip en la prueba, no confiando en este servidor.
 *
 * Uso: `node scripts/servir-estatico.ts <carpeta> <puerto>`.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { RAIZ } from './lib/repo.ts';

const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

const carpeta = resolve(RAIZ, process.argv[2] ?? 'apps/sitio/dist');
const puerto = Number(process.argv[3] ?? 4321);

if (!existsSync(carpeta)) {
  console.error(`❌ No existe ${carpeta}. Corre primero «pnpm build».`);
  process.exit(1);
}

createServer((solicitud, respuesta) => {
  const url = new URL(solicitud.url ?? '/', `http://localhost:${puerto}`);
  if (url.pathname.startsWith('/api/')) {
    // El Worker real se prueba aparte (apps/sitio/src/worker.test.ts); aquí solo se acusa recibo.
    respuesta.writeHead(204).end();
    return;
  }
  let ruta = normalize(join(carpeta, decodeURIComponent(url.pathname)));
  if (!ruta.startsWith(carpeta + sep) && ruta !== carpeta) {
    respuesta.writeHead(403).end();
    return;
  }
  if (existsSync(ruta) && statSync(ruta).isDirectory()) ruta = join(ruta, 'index.html');
  if (!existsSync(ruta)) {
    respuesta.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('No existe');
    return;
  }
  respuesta.writeHead(200, { 'content-type': TIPOS[extname(ruta)] ?? 'application/octet-stream' });
  respuesta.end(readFileSync(ruta));
}).listen(puerto, () => {
  console.log(`Sirviendo ${carpeta} en http://localhost:${puerto}`);
});
