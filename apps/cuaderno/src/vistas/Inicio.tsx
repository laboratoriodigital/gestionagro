/**
 * Inicio del cuaderno. Sin finca, abre el asistente (HU-E3.3); con finca, la muestra.
 * Un teléfono sin finca y sin cuenta ve antes la bienvenida (HU-E0.10), hasta que entra o elige
 * empezar sin cuenta.
 * Pide almacenamiento persistente y dice el resultado en palabras (ARQUITECTURA §5.3, regla 6).
 */
import type { Area, Ciclo, Cultivo, Finca } from '@ed1/agro-schema';
import { useEffect, useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
import { empezarSinCuenta, leerEstadoDeEntrada, mostrarBienvenida } from '../almacen/bienvenida.ts';
import { leerCiclos, leerCultivos } from '../almacen/ciclos.ts';
import { leerFinca } from '../almacen/finca.ts';
import { type EstadoPersistencia, pedirPersistencia } from '../almacen/persistencia.ts';
import { Asistente } from './Asistente.tsx';
import { Bienvenida } from './Bienvenida.tsx';
import { MiFinca } from './MiFinca.tsx';

const TEXTO_PERSISTENCIA: Record<EstadoPersistencia, string> = {
  concedida: 'Este teléfono guardará tus registros de forma permanente.',
  negada:
    'El navegador podría borrar tus registros si el teléfono se queda sin espacio. Descarga una copia cada semana en «Respaldo», o sube tu finca a la nube en «Cuenta».',
  'no-disponible':
    'Este navegador no permite pedir almacenamiento permanente. Descarga una copia cada semana en «Respaldo», o sube tu finca a la nube en «Cuenta».',
};

type Estado =
  | { cargando: true }
  | {
      cargando: false;
      datos: { finca: Finca; areas: Area[]; ciclos: Ciclo[]; cultivos: Cultivo[] } | null;
      bienvenida: boolean;
    };

export function Inicio() {
  const db = cuaderno();
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
      const entrada = await leerEstadoDeEntrada(db);
      setEstado({
        cargando: false,
        datos,
        bienvenida: mostrarBienvenida({ hayFinca: datos !== null, ...entrada }),
      });
    })();
  };

  const sinCuenta = () => {
    void empezarSinCuenta(db).then(() =>
      setEstado((e) => (e.cargando ? e : { ...e, bienvenida: false })),
    );
  };

  useEffect(() => {
    pedirPersistencia(db, navigator.storage).then(setPersistencia, () =>
      setPersistencia('no-disponible'),
    );
    cargar();
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
      ) : estado.bienvenida ? (
        <Bienvenida alEmpezar={sinCuenta} />
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
