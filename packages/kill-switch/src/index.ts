/**
 * Kill switch por producto (HU-E8.1, ARQUITECTURA §8.2). La clave `ks:<product.id>` en el KV de
 * flags de la celda vale `encendido` o `apagado`. Cada Worker la lee con una caché en memoria de
 * hasta 60 s (CA1).
 *
 * Cuánto tarda en apagarse, de verdad (P7): hasta 60 s de esta caché, más lo que tarde KV en
 * propagar el cambio (Cloudflare dice que puede ser 60 s o más). En la práctica, hasta 2 minutos.
 *
 * - Solo `apagado` apaga. Una clave que falta o un valor raro no apagan nada: se ven en el
 *   despliegue, que crea las que faltan.
 * - Si KV falla, se usa el último valor leído aunque esté vencido; si nunca se leyó, el producto
 *   sigue encendido y se escribe en el log. Un KV caído no debe apagar todos los productos.
 */

export const APAGADO = 'apagado';
export const ENCENDIDO = 'encendido';
export const MAX_EDAD_MS = 60_000;

export const claveKillSwitch = (productoId: string): string => `ks:${productoId}`;

/** Lo único que se usa de un KVNamespace de Workers. */
export interface LectorKv {
  get(clave: string): Promise<string | null>;
}

export interface LectorKillSwitch {
  apagado(productoId: string): Promise<boolean>;
}

export function crearLectorKillSwitch(opciones: {
  kv: LectorKv;
  maxEdadMs?: number;
  ahora?: () => number;
  avisar?: (mensaje: string) => void;
}): LectorKillSwitch {
  const {
    kv,
    maxEdadMs = MAX_EDAD_MS,
    ahora = () => Date.now(),
    avisar = (m) => console.error(m),
  } = opciones;
  const cache = new Map<string, { apagado: boolean; leido: number }>();
  return {
    async apagado(productoId) {
      const guardado = cache.get(productoId);
      const t = ahora();
      if (guardado && t - guardado.leido < maxEdadMs) return guardado.apagado;
      try {
        const valor = await kv.get(claveKillSwitch(productoId));
        const apagado = valor?.trim().toLowerCase() === APAGADO;
        cache.set(productoId, { apagado, leido: t });
        return apagado;
      } catch (e) {
        avisar(`kill switch: no se pudo leer ${claveKillSwitch(productoId)} (${String(e)})`);
        return guardado?.apagado ?? false;
      }
    },
  };
}

/**
 * Nivel de degradación de la celda (ARQUITECTURA §8.2), clave `nivel` del KV de flags. Lo escribe
 * el vigía de cuota (HU-E8.2) solo cuando cambia; aquí se lee con la misma caché de 60 s.
 * Sin clave, el nivel es `normal`: la celda arranca así. Un valor desconocido también, pero se
 * escribe en el log (P1): un error al escribir el nivel no debe apagar la sincronización.
 */
export const NIVELES = ['normal', 'alerta', 'ahorro', 'esencial', 'bloqueo'] as const;
export type Nivel = (typeof NIVELES)[number];
export const CLAVE_NIVEL = 'nivel';

export function crearLectorDeNivel(opciones: {
  kv: LectorKv;
  maxEdadMs?: number;
  ahora?: () => number;
  avisar?: (mensaje: string) => void;
}): { nivel(): Promise<Nivel> } {
  const {
    kv,
    maxEdadMs = MAX_EDAD_MS,
    ahora = () => Date.now(),
    avisar = (m) => console.error(m),
  } = opciones;
  let guardado: { nivel: Nivel; leido: number } | null = null;
  return {
    async nivel() {
      const t = ahora();
      if (guardado && t - guardado.leido < maxEdadMs) return guardado.nivel;
      try {
        const valor = (await kv.get(CLAVE_NIVEL))?.trim().toLowerCase() ?? 'normal';
        const nivel = (NIVELES as readonly string[]).includes(valor) ? (valor as Nivel) : 'normal';
        if (nivel !== valor) avisar(`nivel de la celda desconocido: «${valor}»; se usa «normal»`);
        guardado = { nivel, leido: t };
        return nivel;
      } catch (e) {
        avisar(`nivel de la celda: no se pudo leer (${String(e)})`);
        return guardado?.nivel ?? 'normal';
      }
    },
  };
}
