import { liveQuery } from 'dexie';
import { useEffect, useState } from 'preact/hooks';

/** Una consulta de Dexie que se vuelve a correr cuando cambian sus tablas. */
export function useConsulta<T>(consulta: () => Promise<T>, inicial: T): T {
  const [valor, setValor] = useState<T>(inicial);
  useEffect(() => {
    const s = liveQuery(consulta).subscribe({ next: setValor, error: () => undefined });
    return () => s.unsubscribe();
  }, []);
  return valor;
}
