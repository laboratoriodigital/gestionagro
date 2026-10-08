import { liveQuery } from 'dexie';
import { useEffect, useState } from 'preact/hooks';
import type { BaseDeLaCaja } from './datos.ts';

/** Una consulta de Dexie que se vuelve a correr cuando cambian sus tablas. */
export function useConsulta<T>(consulta: () => Promise<T>, inicial: T): T {
  const [valor, setValor] = useState<T>(inicial);
  useEffect(() => {
    const s = liveQuery(consulta).subscribe({ next: setValor, error: () => undefined });
    return () => s.unsubscribe();
  }, []);
  return valor;
}

/** Si esta caja está vinculada a la nube (`nube` en `meta`, HU-Q7.6): cambia lo que promete el aviso. */
export const useConCuenta = (db: Pick<BaseDeLaCaja, 'meta'>): boolean =>
  useConsulta(() => db.meta.get('nube').then((m) => m?.clave === 'nube'), false);
