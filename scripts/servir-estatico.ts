/**
 * Servidor estático mínimo para las pruebas e2e: sirve `apps/sitio/dist` como lo haría
 * Workers Static Assets (carpeta → `index.html`, 404 si no existe). Sin dependencias y en Node,
 * para que corra igual en Windows y en Linux (ADR-18).
 *
 * Lo que NO imita (P17): la compresión y la caché de Cloudflare. El presupuesto de JS se mide
 * comprimiendo con gzip en la prueba, no confiando en este servidor.
 *
 * Uso: `node scripts/servir-estatico.ts <carpeta> <puerto> [/prefijo/=<carpeta> …]`.
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
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

interface Montaje {
  prefijo: string;
  carpeta: string;
  /** Aplicación de una sola página: una ruta sin archivo responde con su index.html. */
  spa: boolean;
}

const puerto = Number(process.argv[3] ?? 4321);
const montajes: Montaje[] = [
  // Montajes extra «/prefijo/=carpeta» (p. ej. el cuaderno en /agro/app/), del más específico al general.
  ...process.argv.slice(4).map((arg) => {
    const [prefijo = '', dir = ''] = arg.split('=');
    return { prefijo, carpeta: resolve(RAIZ, dir), spa: true };
  }),
  { prefijo: '/', carpeta: resolve(RAIZ, process.argv[2] ?? 'apps/sitio/dist'), spa: false },
];

for (const m of montajes) {
  if (!existsSync(m.carpeta)) {
    console.error(`❌ No existe ${m.carpeta}. Corre primero «pnpm build».`);
    process.exit(1);
  }
}

/**
 * Simulación de una versión nueva del service worker para la prueba de actualización (HU-E3.1,
 * CA2). Playwright no intercepta la petición con la que el navegador busca un sw.js nuevo, así
 * que es el servidor el que cambia un byte. Solo existe en este servidor de pruebas.
 */
let versionDePrueba = 0;

createServer((solicitud, respuesta) => {
  const url = new URL(solicitud.url ?? '/', `http://localhost:${puerto}`);
  if (url.pathname === '/__prueba/version-nueva' && solicitud.method === 'POST') {
    versionDePrueba++;
    respuesta.writeHead(204).end();
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    // El Worker real se prueba aparte (apps/sitio/src/worker.test.ts). Aquí la prueba elige el
    // estado con «?estado=500» para comprobar qué hace el cliente con un error (HU-E3.1, CA3).
    const estado = Number(url.searchParams.get('estado') ?? 204);
    respuesta.writeHead(estado, { 'content-type': 'application/json' });
    respuesta.end(estado === 204 ? undefined : JSON.stringify({ estado }));
    return;
  }
  const montaje = montajes.find((m) => url.pathname.startsWith(m.prefijo));
  if (!montaje) {
    respuesta.writeHead(404).end();
    return;
  }
  const relativa = decodeURIComponent(url.pathname.slice(montaje.prefijo.length));
  let ruta = normalize(join(montaje.carpeta, relativa));
  if (!ruta.startsWith(montaje.carpeta + sep) && ruta !== montaje.carpeta) {
    respuesta.writeHead(403).end();
    return;
  }
  if (existsSync(ruta) && statSync(ruta).isDirectory()) ruta = join(ruta, 'index.html');
  if (!existsSync(ruta) && montaje.spa && !extname(ruta))
    ruta = join(montaje.carpeta, 'index.html');
  if (!existsSync(ruta)) {
    respuesta.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('No existe');
    return;
  }
  respuesta.writeHead(200, {
    'content-type': TIPOS[extname(ruta)] ?? 'application/octet-stream',
    // Sin caché HTTP: así las pruebas ven el service worker, no una copia del navegador.
    'cache-control': 'no-cache',
  });
  const cuerpo = readFileSync(ruta);
  respuesta.end(
    versionDePrueba > 0 && ruta.endsWith(`${sep}sw.js`)
      ? Buffer.concat([
          cuerpo,
          Buffer.from(`
// versión de prueba ${versionDePrueba}
`),
        ])
      : cuerpo,
  );
}).listen(puerto, () => {
  console.log(
    `Sirviendo en http://localhost:${puerto}: ${montajes.map((m) => `${m.prefijo} → ${m.carpeta}`).join(', ')}`,
  );
});
