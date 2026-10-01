/**
 * Inicio del cuaderno. Pide almacenamiento persistente y dice el resultado en palabras
 * (ARQUITECTURA §5.3, regla 6). La configuración de la finca llega con HU-E3.3.
 */
import { useEffect, useState } from 'preact/hooks';
import { abrirCuaderno } from '../almacen/db.ts';
import { type EstadoPersistencia, pedirPersistencia } from '../almacen/persistencia.ts';

const TEXTO_PERSISTENCIA: Record<EstadoPersistencia, string> = {
  concedida: 'Este teléfono guardará tus registros de forma permanente.',
  negada:
    'El navegador podría borrar tus registros si el teléfono se queda sin espacio. Cuando exista la exportación, haz una copia cada semana.',
  'no-disponible':
    'Este navegador no permite pedir almacenamiento permanente. Cuando exista la exportación, haz una copia cada semana.',
};

export function Inicio() {
  const [persistencia, setPersistencia] = useState<EstadoPersistencia | null>(null);

  useEffect(() => {
    const db = abrirCuaderno();
    pedirPersistencia(db, navigator.storage).then(setPersistencia, () =>
      setPersistencia('no-disponible'),
    );
    return () => db.close();
  }, []);

  return (
    <section aria-labelledby="titulo-inicio">
      <h1 id="titulo-inicio">Tu cuaderno de campo</h1>
      <p>Funciona sin señal. Lo que registres se guarda primero en este teléfono.</p>
      <p class="estado" data-prueba="persistencia" aria-live="polite">
        {persistencia
          ? TEXTO_PERSISTENCIA[persistencia]
          : 'Revisando el almacenamiento del teléfono…'}
      </p>
      <p>Pronto podrás configurar tu finca y sus naves desde aquí.</p>
    </section>
  );
}
