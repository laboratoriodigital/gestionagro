/**
 * Google Drive en memoria para las pruebas de la copia en el Drive de la persona (`@ed1/drive`):
 * solo lo que usan el cuaderno (HU-E8.4) y la caja del parqueadero (HU-Q10.1). Que Google acepte
 * las solicitudes se comprueba en staging.
 */
export const TOKEN = 'ya29.token-de-prueba';
const T0 = new Date('2026-10-05T15:30:00Z');

export interface Archivo {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  contenido: string;
  createdTime: string;
}

/** Google Drive en memoria: solo lo que usa la app. */
export function driveFalso(opciones: { lleno?: boolean; porPagina?: number } = {}) {
  const archivos: Archivo[] = [];
  let reloj = 0;
  const fn = (async (url: string, init?: RequestInit) => {
    const u = new URL(url);
    const metodo = init?.method ?? 'GET';
    const cabeceras = (init?.headers ?? {}) as Record<string, string>;
    if (cabeceras['authorization'] !== `Bearer ${TOKEN}`)
      return new Response('{}', { status: 401 });
    if (u.pathname === '/upload/drive/v3/files' && metodo === 'POST') {
      if (opciones.lleno) {
        return Response.json(
          { error: { errors: [{ reason: 'storageQuotaExceeded' }] } },
          { status: 403 },
        );
      }
      const limite = (cabeceras['content-type'] ?? '').split('boundary=')[1] ?? '';
      // Una foto llega como Blob (`subirArchivo`); la copia, como texto (`subirCopia`).
      const cuerpo = init?.body instanceof Blob ? await init.body.text() : String(init?.body);
      const partes = cuerpo.split(`--${limite}`);
      const cuerpoDe = (p: string) =>
        p.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '');
      const meta = JSON.parse(cuerpoDe(partes[1] ?? '')) as {
        name: string;
        parents: string[];
        mimeType: string;
      };
      const nuevo: Archivo = {
        id: `a${archivos.length + 1}`,
        name: meta.name,
        mimeType: meta.mimeType,
        parents: meta.parents,
        contenido: cuerpoDe(partes[2] ?? ''),
        createdTime: new Date(T0.getTime() + reloj++ * 1000).toISOString(),
      };
      archivos.push(nuevo);
      return Response.json({ id: nuevo.id });
    }
    if (u.pathname === '/drive/v3/files' && metodo === 'POST') {
      const meta = JSON.parse(String(init?.body)) as { name: string; mimeType: string };
      const carpeta: Archivo = {
        id: `c${archivos.length + 1}`,
        name: meta.name,
        mimeType: meta.mimeType,
        parents: [],
        contenido: '',
        createdTime: T0.toISOString(),
      };
      archivos.push(carpeta);
      return Response.json({ id: carpeta.id });
    }
    if (u.pathname === '/drive/v3/files' && metodo === 'GET') {
      const q = u.searchParams.get('q') ?? '';
      const padre = q.match(/^'([^']+)' in parents/)?.[1];
      const nombre = q.match(/name = '([^']+)'/)?.[1];
      const lista = archivos
        .filter((a) => (padre ? a.parents.includes(padre) : a.name === nombre))
        .sort((x, y) => y.createdTime.localeCompare(x.createdTime));
      // Con `porPagina`, pagina como Google: `pageToken` es la posición de la siguiente.
      const desde = Number(u.searchParams.get('pageToken') ?? 0);
      const tamano = opciones.porPagina ?? lista.length;
      const pagina = lista.slice(desde, desde + tamano);
      const siguiente = desde + tamano < lista.length ? String(desde + tamano) : undefined;
      return Response.json({
        ...(siguiente ? { nextPageToken: siguiente } : {}),
        files: pagina.map((a) => ({
          id: a.id,
          name: a.name,
          size: String(a.contenido.length),
          createdTime: a.createdTime,
        })),
      });
    }
    const id = u.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/)?.[1];
    const archivo = archivos.find((a) => a.id === id);
    if (!archivo) return new Response('{}', { status: 404 });
    if (metodo === 'DELETE') {
      archivos.splice(archivos.indexOf(archivo), 1);
      return new Response(null, { status: 204 });
    }
    return new Response(archivo.contenido, { status: 200 });
  }) as unknown as typeof fetch;
  return { fn, archivos };
}
