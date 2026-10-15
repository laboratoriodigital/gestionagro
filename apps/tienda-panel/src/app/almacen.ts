/**
 * Lo que el panel guarda en el teléfono (HU-T8.1 CA1): la sesión, el id del dispositivo y los
 * borradores de los formularios, en IndexedDB. Nunca en `localStorage` ni en una cookie: los tokens
 * no quedan al alcance de cualquier script de la página ni viajan solos en una solicitud.
 *
 * Una sola base (`tienda-panel`) con un solo almacén de clave y valor; sin dependencias.
 */

export interface Almacen {
  leer<T>(clave: string): Promise<T | null>;
  guardar(clave: string, valor: unknown): Promise<void>;
  borrar(clave: string): Promise<void>;
}

const BASE = 'tienda-panel';
const TABLA = 'kv';

function abrir(fabrica: IDBFactory): Promise<IDBDatabase> {
  return new Promise((listo, fallo) => {
    const pedido = fabrica.open(BASE, 1);
    pedido.onupgradeneeded = () => {
      pedido.result.createObjectStore(TABLA);
    };
    pedido.onsuccess = () => listo(pedido.result);
    pedido.onerror = () => fallo(pedido.error);
  });
}

function enTabla<T>(
  db: Promise<IDBDatabase>,
  modo: IDBTransactionMode,
  hacer: (tabla: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return db.then(
    (base) =>
      new Promise<T>((listo, fallo) => {
        const tx = base.transaction(TABLA, modo);
        const pedido = hacer(tx.objectStore(TABLA));
        // Se resuelve cuando la transacción quedó escrita, no solo pedida (P21).
        tx.oncomplete = () => listo(pedido.result as T);
        tx.onerror = () => fallo(tx.error);
        tx.onabort = () => fallo(tx.error);
      }),
  );
}

export function almacenIndexedDb(fabrica: IDBFactory = indexedDB): Almacen {
  let db: Promise<IDBDatabase> | null = null;
  const base = () => {
    db ??= abrir(fabrica);
    return db;
  };
  return {
    leer: async <T>(clave: string) =>
      ((await enTabla<T | undefined>(base(), 'readonly', (t) => t.get(clave))) ?? null) as T | null,
    guardar: async (clave, valor) => {
      await enTabla(base(), 'readwrite', (t) => t.put(valor, clave));
    },
    borrar: async (clave) => {
      await enTabla(base(), 'readwrite', (t) => t.delete(clave));
    },
  };
}

/** En memoria, para las pruebas. */
export function almacenEnMemoria(inicial: Record<string, unknown> = {}): Almacen & {
  datos: Map<string, unknown>;
} {
  const datos = new Map(Object.entries(inicial));
  return {
    datos,
    leer: async <T>(clave: string) => (datos.has(clave) ? (datos.get(clave) as T) : null),
    guardar: async (clave, valor) => {
      datos.set(clave, structuredClone(valor));
    },
    borrar: async (clave) => {
      datos.delete(clave);
    },
  };
}
