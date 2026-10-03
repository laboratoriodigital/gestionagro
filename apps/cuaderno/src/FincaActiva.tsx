/**
 * En la cabecera, en qué finca se está cuando el teléfono lleva más de una (HU-E4.7, CA2). Un
 * toque lleva a Cuenta, donde se cambia. Con una sola finca no se muestra: nada cambia para quien
 * no lo necesita. El nombre se anota al abrir y tras cada escritura (configurar o renombrar).
 */
import { useEffect, useState } from 'preact/hooks';
import { escucharActividad } from './actividad.ts';
import { cuaderno } from './almacen/abierto.ts';
import { anotarFincaActiva, baseActiva, fincasLocales } from './almacen/fincas-locales.ts';

export function FincaActiva() {
  const [lista, setLista] = useState(() => fincasLocales());
  useEffect(() => {
    const anotar = () => void anotarFincaActiva(cuaderno()).then(() => setLista(fincasLocales()));
    anotar();
    return escucharActividad((a) => {
      if (a.escriturasEnCurso === 0) anotar();
    });
  }, []);
  if (lista.length < 2) return null;
  const activa = lista.find((f) => f.base === baseActiva());
  return (
    <a class="indicador finca-activa" href="/agro/app/cuenta/" data-prueba="finca-activa">
      Finca: {activa?.nombre ?? 'sin nombre'} · cambiar
    </a>
  );
}
