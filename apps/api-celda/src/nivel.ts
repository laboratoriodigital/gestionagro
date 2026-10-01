/**
 * Nivel de degradación de la celda (ARQUITECTURA §8.2) para el push y el pull (HU-E5.3, HU-E8.6).
 *
 * - `ahorro`: todo sigue; el pull avisa el nivel para que el teléfono espacie las revisiones.
 * - `esencial`: solo sube; bajar lo del equipo espera al reinicio de la cuota.
 * - `bloqueo`: D1 rechazaría; ni sube ni baja hasta el reinicio. El teléfono guarda todo.
 *
 * La pausa responde 503 con la causa (`estado`), `Retry-After` y la hora de reanudación. El
 * teléfono escribe el mensaje con su catálogo (`mensajes-de-pausa.ts`); aquí no hay textos de
 * pantalla.
 */
import { crearLectorDeNivel, type LectorKv, type Nivel } from '@gestionagro/kill-switch';
import { proximoReinicioDeCuota } from '@gestionagro/sync';
import type { ContextoCelda } from './worker.ts';

let lector: { kv: LectorKv; lector: ReturnType<typeof crearLectorDeNivel> } | null = null;

export async function nivelDeLaCelda(kv: LectorKv | undefined): Promise<Nivel> {
  if (!kv) return 'normal';
  if (lector?.kv !== kv) lector = { kv, lector: crearLectorDeNivel({ kv }) };
  return lector.lector.nivel();
}

export function respuestaDePausa(
  c: ContextoCelda,
  nivel: 'esencial' | 'bloqueo',
  ahora: number,
): Response {
  const reanuda = proximoReinicioDeCuota(ahora);
  c.header('retry-after', String(Math.max(60, Math.ceil((reanuda - ahora) / 1000))));
  return c.json(
    {
      estado: nivel,
      motivo:
        nivel === 'bloqueo'
          ? 'La nube llegó a su límite de hoy. Tus registros están guardados en este teléfono.'
          : 'La nube está en modo esencial: se suben tus registros y bajar lo del equipo espera. Tus registros están guardados en este teléfono.',
      reanuda: new Date(reanuda).toISOString(),
    },
    503,
  );
}
