/**
 * La finca de este teléfono para las pantallas que la necesitan. Sin finca, esas pantallas
 * mandan a configurarla primero.
 */
import type { Finca } from '@gestionagro/agro-schema';
import { useEffect, useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
import { leerFinca } from '../almacen/finca.ts';

export type EstadoFinca = { cargando: true } | { cargando: false; finca: Finca | null };

export function usarFinca(): EstadoFinca {
  const [estado, setEstado] = useState<EstadoFinca>({ cargando: true });
  useEffect(() => {
    void leerFinca(cuaderno()).then((d) => setEstado({ cargando: false, finca: d?.finca ?? null }));
  }, []);
  return estado;
}

export function SinFinca(props: { lecturaGuardada?: boolean }) {
  return (
    <>
      {props.lecturaGuardada && (
        <p class="estado" data-prueba="lectura-guardada-para-despues">
          Tu lectura de la calculadora quedó en este teléfono: cuando configures la finca, la
          encontrarás en Registrar → Clima (hasta 2 horas).
        </p>
      )}
      <p>
        Primero configura tu finca y sus áreas. <a href="/agro/app/">Ir a configurar</a>
      </p>
    </>
  );
}
