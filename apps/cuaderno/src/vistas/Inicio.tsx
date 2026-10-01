/**
 * Inicio del cuaderno. Sin finca, abre el asistente (HU-E3.3); con finca, la muestra.
 * Pide almacenamiento persistente y dice el resultado en palabras (ARQUITECTURA §5.3, regla 6).
 */
import type { Area, Ciclo, Cultivo, Finca } from '@gestionagro/agro-schema';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { leerCiclos, leerCultivos } from '../almacen/ciclos.ts';
import { abrirCuaderno } from '../almacen/db.ts';
import { leerFinca } from '../almacen/finca.ts';
import { type EstadoPersistencia, pedirPersistencia } from '../almacen/persistencia.ts';
import { Asistente } from './Asistente.tsx';
import { MiFinca } from './MiFinca.tsx';

const TEXTO_PERSISTENCIA: Record<EstadoPersistencia, string> = {
  concedida: 'Este teléfono guardará tus registros de forma permanente.',
  negada:
    'El navegador podría borrar tus registros si el teléfono se queda sin espacio. Cuando exista la exportación, haz una copia cada semana.',
  'no-disponible':
    'Este navegador no permite pedir almacenamiento permanente. Cuando exista la exportación, haz una copia cada semana.',
};

type Estado =
  | { cargando: true }
  | {
      cargando: false;
      datos: { finca: Finca; areas: Area[]; ciclos: Ciclo[]; cultivos: Cultivo[] } | null;
    };

export function Inicio() {
  const db = useMemo(() => abrirCuaderno(), []);
  const [persistencia, setPersistencia] = useState<EstadoPersistencia | null>(null);
  const [estado, setEstado] = useState<Estado>({ cargando: true });

  const cargar = () => {
    void (async () => {
      const base = await leerFinca(db);
      const datos = base
        ? {
            ...base,
            ciclos: await leerCiclos(db, base.finca.id),
            cultivos: await leerCultivos(db, base.finca.id),
          }
        : null;
      setEstado({ cargando: false, datos });
    })();
  };

  useEffect(() => {
    pedirPersistencia(db, navigator.storage).then(setPersistencia, () =>
      setPersistencia('no-disponible'),
    );
    cargar();
    return () => db.close();
  }, []);

  return (
    <>
      {estado.cargando ? (
        <p>Abriendo tu cuaderno…</p>
      ) : estado.datos ? (
        <MiFinca
          db={db}
          finca={estado.datos.finca}
          areas={estado.datos.areas}
          ciclos={estado.datos.ciclos}
          cultivos={estado.datos.cultivos}
          alCambiar={cargar}
        />
      ) : (
        <>
          <p class="bienvenida">
            Tu cuaderno de campo funciona sin señal. Lo que registres se guarda primero en este
            teléfono. Empieza por tu finca.
          </p>
          <Asistente db={db} alTerminar={cargar} />
        </>
      )}
      <p class="estado" data-prueba="persistencia" aria-live="polite">
        {persistencia
          ? TEXTO_PERSISTENCIA[persistencia]
          : 'Revisando el almacenamiento del teléfono…'}
      </p>
    </>
  );
}
