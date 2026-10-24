/**
 * ¿Hay finca en este teléfono? Se mira al abrir y después de cada escritura (crear la finca,
 * restaurar un respaldo), como `FincaActiva`. Mientras no se sabe, se cuenta que sí: es el caso de
 * todos los días, y así el menú no salta al abrir.
 */
import { useEffect, useState } from 'preact/hooks';
import { escucharActividad } from '../actividad.ts';
import { cuaderno } from '../almacen/abierto.ts';
import { leerFinca } from '../almacen/finca.ts';

export function usarHayFinca(): boolean {
  const [hay, setHay] = useState(true);
  useEffect(() => {
    const mirar = () => void leerFinca(cuaderno()).then((d) => setHay(Boolean(d?.finca)));
    mirar();
    return escucharActividad((a) => {
      if (a.escriturasEnCurso === 0) mirar();
    });
  }, []);
  return hay;
}
