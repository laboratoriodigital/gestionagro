/**
 * Qué puede hacer en este teléfono la persona de la sesión (HU-E4.5). La matriz es la misma de la
 * celda (`@ed1/sync`): aquí solo se esconde lo que la celda negaría de todos modos.
 *
 * Sin finca en la nube, el teléfono es de quien lo configuró: puede todo. El plan de la finca viene
 * con la misma sesión, para los topes del plan (HU-E0.13).
 */
import {
  type Accion,
  type Entidad,
  NOMBRE_DE_ROL,
  puede,
  puedeRegistro,
  type Rol,
} from '@ed1/agro-schema/sync';
import { useEffect, useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
import { nombreDelPlan } from '../almacen/limites.ts';
import { leerSesion, planDeLaFinca, rolEnLaFinca } from '../almacen/sesion.ts';

export interface Permisos {
  /** null: sin finca en la nube. undefined: todavía cargando. */
  rol: string | null | undefined;
  puede: (accion: Accion, entidad: Entidad) => boolean;
  /** Para un tipo de registro con permisos propios (HU-E6.3). */
  puedeRegistro: (accion: Accion, tipo: string) => boolean;
  /** El plan de la finca; sin finca en la nube, el gratuito. undefined: todavía cargando. */
  plan: string | undefined;
}

export function usarPermisos(): Permisos {
  const [rol, setRol] = useState<string | null | undefined>(undefined);
  const [plan, setPlan] = useState<string | undefined>(undefined);
  useEffect(() => {
    void leerSesion(cuaderno()).then((s) => {
      setRol(rolEnLaFinca(s));
      setPlan(planDeLaFinca(s));
    });
  }, []);
  return {
    rol,
    plan,
    // Mientras carga no se ofrece cambiar nada: es un instante y evita mostrar y quitar botones.
    puede: (accion, entidad) =>
      rol === undefined ? false : puede(rol ?? 'propietario', accion, entidad),
    puedeRegistro: (accion, tipo) =>
      rol === undefined ? false : puedeRegistro(rol ?? 'propietario', accion, tipo),
  };
}

/** Aviso de que el plan ya no deja agregar más (HU-E0.13), con el camino a los planes. */
export function TopeDelPlan(props: { plan: string; children: string }) {
  return (
    <p class="ayuda" data-prueba="tope-del-plan">
      {`Con el plan ${nombreDelPlan(props.plan)} ${props.children}`}{' '}
      <a href="/agro/app/planes/">Ver los planes</a>
    </p>
  );
}

/** Aviso para quien ve una pantalla que su rol no cambia. */
export function SoloConsulta(props: { rol: string | null | undefined; que: string }) {
  if (!props.rol) return null;
  return (
    <p class="ayuda" data-prueba="solo-consulta">
      Con el rol de {NOMBRE_DE_ROL[props.rol as Rol] ?? props.rol} puedes consultar {props.que}. Los
      cambios los hace quien administra la finca.
    </p>
  );
}
