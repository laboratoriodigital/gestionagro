/**
 * Registros a nivel de cama o surco (revisión del dueño, 3 oct 2026), del plan Finca en adelante
 * (interruptor `registros_por_cama` en `funciones.json`). Ubicar un foco de plaga o tratar solo
 * una cama ahorra producto; la carencia de la cama cuenta para cosechar su nave y la de la nave
 * para sus camas (`bloqueoPorCarencia`).
 */
import type { Area } from '@ed1/agro-schema';
import { useEffect, useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
import { leerFinca } from '../almacen/finca.ts';
import { funcionActiva } from '../almacen/funciones.ts';
import { leerSesion, planDeLaFinca } from '../almacen/sesion.ts';
import { CampoSeleccion } from './Campo.tsx';

/** Si el plan permite registrar por cama, y las camas y surcos activos de cada área. */
export function usarCamas() {
  const [estado, setEstado] = useState<{ porCama: boolean; areas: Area[] }>({
    porCama: false,
    areas: [],
  });
  useEffect(() => {
    const db = cuaderno();
    void (async () => {
      const [sesion, finca] = await Promise.all([leerSesion(db), leerFinca(db)]);
      setEstado({
        porCama: funcionActiva('registros_por_cama', planDeLaFinca(sesion)),
        areas: (finca?.areas ?? []).filter((a) => a.activa),
      });
    })();
  }, []);
  return {
    porCama: estado.porCama,
    camasDe: (areaId: string) => estado.areas.filter((a) => a.padre_id === areaId),
    nombreDe: (areaId: string) => estado.areas.find((a) => a.id === areaId)?.nombre,
  };
}

/** «Cama o surco (opcional)»: vacío es toda el área. Solo aparece si el área tiene camas. */
export function CampoCama(props: {
  id: string;
  camas: Area[];
  valor: string;
  alCambiar: (id: string) => void;
}) {
  if (props.camas.length === 0) return null;
  return (
    <CampoSeleccion
      id={props.id}
      etiqueta="Cama o surco (opcional)"
      indicacion="Toda el área"
      opciones={props.camas.map((c) => ({ valor: c.id, texto: c.nombre }))}
      valor={props.valor}
      alCambiar={props.alCambiar}
    />
  );
}
