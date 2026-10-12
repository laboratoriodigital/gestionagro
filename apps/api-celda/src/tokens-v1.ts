/**
 * El registro de tokens v1 aceptados (HU-C4.5 CA2, PLATAFORMA §4.6): antes de que las celdas los
 * rechacen (fase N+2), una semana de registro tiene que mostrar que ya nadie entra con uno.
 *
 * - **Un día con v1 deja una clave** en el KV de flags (`tokens_v1:AAAA-MM-DD`), que vence sola a
 *   los 40 días. No se cuenta cuántos: para decidir basta saber si hubo alguno, y así son a lo
 *   sumo una lectura y una escritura por día y por instancia del Worker, no una por solicitud.
 * - **Los Workers Logs del plan gratuito duran 3 días:** no alcanzan para la semana. Por eso el KV.
 * - Lo lee el reporte semanal (`scripts/reporte-semanal.ts`). Si el KV falla, la solicitud sigue:
 *   un registro nunca tumba la sincronización (P1: se dice en el log).
 */
import type { KvDeFlags } from './vigia.ts';

export const PREFIJO_TOKENS_V1 = 'tokens_v1:';
/** Lo que dura cada marca: más que la semana del registro, por si el reporte de un lunes falla. */
export const DURACION_DE_LA_MARCA_S = 40 * 24 * 60 * 60;

export const claveDelDia = (ahora: number) =>
  `${PREFIJO_TOKENS_V1}${new Date(ahora).toISOString().slice(0, 10)}`;

/** Las claves ya anotadas por esta instancia, por KV: evita volver a leer el mismo día. */
const anotadas = new WeakMap<object, Set<string>>();

export async function anotarTokenV1(
  kv: KvDeFlags | undefined,
  ahora: number,
): Promise<'anotado' | 'ya-estaba' | 'sin-kv' | 'fallo'> {
  if (!kv) return 'sin-kv';
  const clave = claveDelDia(ahora);
  const deEste = anotadas.get(kv) ?? new Set<string>();
  anotadas.set(kv, deEste);
  if (deEste.has(clave)) return 'ya-estaba';
  try {
    if ((await kv.get(clave)) !== null) {
      deEste.add(clave);
      return 'ya-estaba';
    }
    await kv.put(clave, '1', { expirationTtl: DURACION_DE_LA_MARCA_S });
    deEste.add(clave);
    console.log(`tokens: se aceptó un token v1 (${clave})`);
    return 'anotado';
  } catch (e) {
    console.error(`tokens: no se pudo anotar el token v1 del día: ${(e as Error).message}`);
    return 'fallo';
  }
}
