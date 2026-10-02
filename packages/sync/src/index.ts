/**
 * Protocolo de sincronización v1 (ARQUITECTURA §5.6): lo comparten el teléfono y la celda (P2).
 *
 *   POST /api/v1/sync/push  { protocolo: 1, dispositivo, app, ops: Operacion[≤25] }
 *     → { acks: [{ id, estado: aceptado | duplicado | cuarentena | reintentar, motivo? }] }
 *
 * - Cada operación lleva la entidad completa tal como está en el teléfono: un registro
 *   (inmutable) o la versión vigente de un catálogo. La celda la valida con los mismos esquemas
 *   de `agro-schema` que la app.
 * - Una operación que no valida no se descarta: va a cuarentena con el motivo en palabras (P1).
 * - Reenviar un lote es inofensivo: el mismo id no se escribe dos veces.
 */
import {
  ErrorDeValidacion,
  FILAS_EXPORTADAS,
  type Registro,
  validarCatalogo,
  validarRegistro,
  type ZodType,
} from '@gestionagro/agro-schema';

export const PROTOCOLO = 1;
/** D1 gratuito admite 50 consultas por invocación; la celda usa 3 lecturas y 1 escritura por op. */
export const LOTE_MAXIMO = 25;

export const ENTIDADES_DE_CATALOGO = [
  'finca',
  'area',
  'ciclo',
  'persona',
  'insumo',
  'cultivo',
  'valor_jornal',
  'tipo_labor',
  'categoria_calidad',
] as const;
export type EntidadDeCatalogo = (typeof ENTIDADES_DE_CATALOGO)[number];
export type Entidad = 'registro' | EntidadDeCatalogo;

export interface Operacion {
  /** Id de la operación en la cola de salida: el del registro, o `<entidad_id>@v<versión>`. */
  id: string;
  entidad: Entidad;
  entidad_id: string;
  version: number;
  datos: unknown;
}

/**
 * - `aceptado` y `duplicado`: la celda lo tiene; sale de la cola del teléfono.
 * - `cuarentena`: la celda lo guardó aparte con un motivo; sale de la cola y se muestra en rojo.
 * - `reintentar`: otro teléfono escribió lo mismo en ese instante; se queda en la cola y se
 *   reenvía (la celda decidirá en la vuelta siguiente, sin perder nada).
 */
export type EstadoAck = 'aceptado' | 'duplicado' | 'cuarentena' | 'reintentar';
export interface Ack {
  id: string;
  estado: EstadoAck;
  motivo?: string;
  /**
   * El registro dice haber pasado más de `RELOJ_CORRIDO_MS` después del reloj de la celda: el
   * teléfono tiene la hora adelantada (ARQUITECTURA §5.7, P8). Se guarda igual; no se corrige en
   * silencio, se avisa.
   */
  aviso?: 'reloj-corrido';
}

export const RELOJ_CORRIDO_MS = 10 * 60_000;

export interface PedidoPush {
  protocolo: typeof PROTOCOLO;
  dispositivo: string;
  /** Versión de la app que envía (HU-E5.5). */
  app: string;
  ops: Operacion[];
}

export interface RespuestaPush {
  acks: Ack[];
  /**
   * La app es más vieja que `APP_MINIMA` (HU-E5.5, CA2). El lote se aceptó igual: esto solo
   * pide actualizar. Nunca se rechaza un dato de campo por venir de una app vieja (ADR-13).
   */
  actualizar?: { minima: string; motivo: string };
}

/**
 * Versión mínima de la app que la celda considera al día. Subirla no rechaza nada: las apps más
 * viejas siguen subiendo y reciben el pedido de actualizar. Se sube cuando una versión tiene un
 * defecto que el teléfono debe dejar atrás; se anota el motivo en el CHANGELOG.
 */
export const APP_MINIMA = '0.1.0';

/** Compara dos versiones X.Y.Z. Una que no se puede leer cuenta como la más vieja (0.0.0). */
export function compararVersiones(a: string, b: string): number {
  const partes = (v: string) => {
    const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
  };
  const [x, y] = [partes(a), partes(b)];
  for (let i = 0; i < 3; i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return Math.sign(d);
  }
  return 0;
}

export const MOTIVO_ACTUALIZAR =
  'Esta versión del cuaderno ya es vieja. Actualízala para seguir sincronizando sin problemas; lo que registraste se está enviando igual.';

/** Lo que la celda agrega a la respuesta del push según la versión de la app que envía. */
export function pedidoDeActualizar(
  app: unknown,
  minima: string = APP_MINIMA,
): RespuestaPush['actualizar'] {
  const version = typeof app === 'string' ? app : '';
  return compararVersiones(version, minima) < 0 ? { minima, motivo: MOTIVO_ACTUALIZAR } : undefined;
}

/** Un catálogo validado: su esquema propio más los metadatos comunes (ADR-4). */
export type CatalogoValido = Record<string, unknown> & {
  id: string;
  org_id: string | null;
  version: number;
  actualizado: string;
};

/** Una operación ya validada: su entidad con los datos tal como los dejó el esquema. */
export type OperacionValida =
  | { id: string; entidad: 'registro'; entidad_id: string; version: number; registro: Registro }
  | {
      id: string;
      entidad: EntidadDeCatalogo;
      entidad_id: string;
      version: number;
      catalogo: CatalogoValido;
    };

const esCatalogo = (e: unknown): e is EntidadDeCatalogo =>
  (ENTIDADES_DE_CATALOGO as readonly unknown[]).includes(e);

/**
 * Valida una operación del lote. Devuelve el motivo en palabras si no sirve: la celda lo guarda
 * en cuarentena y el teléfono lo muestra en rojo (HU-E3.14).
 */
export function validarOperacion(
  entrada: unknown,
): { ok: true; op: OperacionValida } | { ok: false; id: string | null; motivo: string } {
  if (typeof entrada !== 'object' || entrada === null) {
    return { ok: false, id: null, motivo: 'La operación no es un objeto' };
  }
  const o = entrada as Partial<Operacion>;
  const id = typeof o.id === 'string' && o.id.length > 0 && o.id.length <= 120 ? o.id : null;
  if (!id) return { ok: false, id: null, motivo: 'La operación no trae un id válido' };
  if (typeof o.entidad_id !== 'string' || !Number.isInteger(o.version) || (o.version ?? 0) < 1) {
    return { ok: false, id, motivo: 'Faltan la entidad o la versión de la operación' };
  }
  try {
    if (o.entidad === 'registro') {
      const registro = validarRegistro(o.datos);
      if (registro.id !== o.entidad_id) {
        return { ok: false, id, motivo: 'El registro no coincide con su operación' };
      }
      return {
        ok: true,
        op: {
          id,
          entidad: 'registro',
          entidad_id: o.entidad_id,
          version: o.version ?? 1,
          registro,
        },
      };
    }
    if (esCatalogo(o.entidad)) {
      const catalogo = validarCatalogo(
        o.entidad,
        FILAS_EXPORTADAS[o.entidad] as ZodType<unknown>,
        o.datos,
      ) as CatalogoValido;
      if (catalogo.id !== o.entidad_id || catalogo.version !== o.version) {
        return {
          ok: false,
          id,
          motivo: `${o.entidad} no coincide con su operación (id o versión)`,
        };
      }
      return {
        ok: true,
        op: {
          id,
          entidad: o.entidad,
          entidad_id: o.entidad_id,
          version: catalogo.version,
          catalogo,
        },
      };
    }
    return { ok: false, id, motivo: `Entidad desconocida: ${String(o.entidad)}` };
  } catch (e) {
    if (e instanceof ErrorDeValidacion) return { ok: false, id, motivo: e.message };
    throw e;
  }
}

/**
 * Pull (ARQUITECTURA §5.6, HU-E5.3):
 *
 *   GET /api/v1/sync/pull?registro=<seq>&catalogo=<seq>
 *     → { catalogos: [{ entidad, datos }], registros: [Registro], cursor: { registro, catalogo }, mas }
 *
 * Dos cursores porque `seq` es por tabla. Hasta `PAGINA_MAXIMA` cambios por página, los catálogos
 * primero: un registro nombra áreas y ciclos que el teléfono tiene que conocer antes. El cursor
 * vive en el teléfono; la celda no escribe nada para atender un pull.
 */
export const PAGINA_MAXIMA = 200;

export interface Cursor {
  registro: number;
  catalogo: number;
}

export const CURSOR_INICIAL: Cursor = { registro: 0, catalogo: 0 };

/** A qué teléfono se le reemplazó su versión al ganar esta (HU-E5.4). */
export interface Reemplazo {
  /** La versión que perdió. */
  version: number;
  /** El teléfono que la había escrito. */
  dispositivo: string;
  /** La cuenta que escribió la que ganó. */
  por_usuario: string | null;
}

export interface CambioDeCatalogo {
  entidad: EntidadDeCatalogo;
  datos: CatalogoValido;
  /** Solo si esta versión ganó un conflicto: el teléfono que perdió lo avisa. */
  reemplazo?: Reemplazo;
}

export interface RespuestaPull {
  /** Nivel de la celda (ARQUITECTURA §8.2): en `ahorro` el teléfono revisa cada 60 min. */
  nivel?: 'normal' | 'alerta' | 'ahorro';
  catalogos: CambioDeCatalogo[];
  registros: Registro[];
  cursor: Cursor;
  /** Hay más páginas: el teléfono pide la siguiente con el cursor nuevo. */
  mas: boolean;
}

/**
 * Cuándo se reinicia la cuota diaria de D1: a las 00:00 UTC, que son las 19:00 en Colombia
 * (ARQUITECTURA §5.7, P8). La usa el aviso «sincronización en pausa hasta…».
 */
export function proximoReinicioDeCuota(ahoraMs: number): number {
  const d = new Date(ahoraMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

export * from './permisos.ts';
