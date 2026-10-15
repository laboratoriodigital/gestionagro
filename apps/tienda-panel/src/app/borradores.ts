/**
 * Lo que la persona está escribiendo no se pierde (HU-T8.1 CA2): cada formulario guarda su
 * borrador en el teléfono mientras se escribe. Si la sesión vence y hay que volver a entrar con
 * Google (que sale del panel y vuelve), el formulario aparece como estaba. Al enviarlo bien, el
 * borrador se borra.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Almacen } from './almacen.ts';

const clave = (nombre: string) => `borrador:${nombre}`;

export function usarBorrador<T extends Record<string, string>>(
  almacen: Almacen,
  nombre: string,
  inicial: T,
): { valores: T; cambiar: (campo: keyof T, valor: string) => void; olvidar: () => Promise<void> } {
  const [valores, setValores] = useState<T>(inicial);
  const tocado = useRef(false);
  useEffect(() => {
    let vivo = true;
    void almacen.leer<T>(clave(nombre)).then((guardado) => {
      // Si la persona ya empezó a escribir, lo suyo gana sobre lo guardado.
      if (vivo && guardado && !tocado.current) setValores({ ...inicial, ...guardado });
    });
    return () => {
      vivo = false;
    };
  }, [almacen, nombre]);
  const cambiar = (campo: keyof T, valor: string) => {
    tocado.current = true;
    setValores((antes) => {
      const despues = { ...antes, [campo]: valor };
      void almacen.guardar(clave(nombre), despues);
      return despues;
    });
  };
  const olvidar = async () => {
    await almacen.borrar(clave(nombre));
    tocado.current = false;
    setValores(inicial);
  };
  return { valores, cambiar, olvidar };
}
