/**
 * HU-T10.6: el registro, quién hizo qué (TIENDA-3.0 §5.3, `registro`). Cada escritura del panel
 * deja una fila con el antes y el después, en el mismo lote que la escritura: si una falla, no
 * queda ninguna de las dos. La pantalla lo cuenta en frases (como la actividad del CORE, HU-C7.8).
 *
 * CA2: las llaves y los datos personales nunca se guardan en claro, ni en el antes ni en el
 * después: en su lugar va `{ huella }`, los primeros 16 caracteres de su SHA-256. Así se sabe que
 * cambiaron sin poder leerlos.
 *
 * El shard no sabe los nombres de las personas (viven en el CORE): la frase dice «Tú» para quien
 * pregunta y «Otra persona del equipo» para los demás.
 */
import type { BaseD1, SentenciaD1 } from '@ed1/d1';
import { formatearPesos } from '@ed1/dinero';
import { TITULOS_DE_SECCION } from '@ed1/tienda-schema/titulos';
import { sha256 } from './pedidos.ts';

/** Los campos que nunca se guardan en claro: datos personales y secretos. */
const SENSIBLE =
  /telefono|celular|whatsapp|correo|email|documento|direccion|contacto|comprador|transferencia|llave|secret|token|clave|credencial|password|contrasena/i;

export const esSensible = (campo: string): boolean => SENSIBLE.test(campo);

/** Una copia del valor con cada campo sensible cambiado por su huella, a cualquier profundidad. */
export async function sinDatosSensibles(valor: unknown): Promise<unknown> {
  if (Array.isArray(valor)) return Promise.all(valor.map(sinDatosSensibles));
  if (valor === null || typeof valor !== 'object') return valor;
  const limpio: Record<string, unknown> = {};
  for (const [campo, v] of Object.entries(valor)) {
    limpio[campo] =
      esSensible(campo) && v !== null && v !== undefined
        ? { huella: (await sha256(JSON.stringify(v))).slice(0, 16) }
        : await sinDatosSensibles(v);
  }
  return limpio;
}

export interface Anotacion {
  org: string;
  /** `usuario:<sub>` desde el panel; `sistema` para las tareas. */
  actor: string;
  /** Lo que pasó, en un verbo corto: `producto.crear`, `producto.estado`, `variantes.guardar`… */
  accion: string;
  entidad: string;
  entidadId: string | null;
  antes: unknown;
  despues: unknown;
  instante: string;
}

/** La fila del registro, para ir en el mismo lote que la escritura que cuenta. */
export async function anotar(db: BaseD1, a: Anotacion): Promise<SentenciaD1> {
  const json = async (v: unknown) =>
    v === null || v === undefined ? null : JSON.stringify(await sinDatosSensibles(v));
  return db
    .prepare(
      `INSERT INTO registro (org_id, instante, actor, accion, entidad, entidad_id, antes, despues)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      a.org,
      a.instante,
      a.actor,
      a.accion,
      a.entidad,
      a.entidadId,
      await json(a.antes),
      await json(a.despues),
    );
}

export interface FilaDelRegistro {
  id: number;
  instante: string;
  actor: string;
  accion: string;
  entidad: string;
  entidad_id: string | null;
  antes: string | null;
  despues: string | null;
}

const leer = (t: string | null): Record<string, unknown> => {
  if (!t) return {};
  try {
    const v = JSON.parse(t) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const ESTADOS: Record<string, string> = {
  borrador: 'borrador',
  activo: 'activo',
  archivado: 'archivado',
};

const nombreDe = (antes: Record<string, unknown>, despues: Record<string, unknown>) =>
  String(despues['nombre'] ?? antes['nombre'] ?? 'un producto');

/** Lo que cambió en una frase corta: «el precio de M|Arena de $129.000 a $119.000». */
function cambios(antes: Record<string, unknown>, despues: Record<string, unknown>): string[] {
  const dichos: string[] = [];
  for (const campo of ['nombre', 'slug', 'estado']) {
    if (campo in antes && campo in despues && antes[campo] !== despues[campo]) {
      dichos.push(
        `${campo === 'slug' ? 'la dirección' : `el ${campo}`} de «${antes[campo]}» a «${despues[campo]}»`,
      );
    }
  }
  if (typeof antes['precioCop'] === 'number' && typeof despues['precioCop'] === 'number') {
    if (antes['precioCop'] !== despues['precioCop']) {
      dichos.push(
        `el precio de ${formatearPesos(antes['precioCop'])} a ${formatearPesos(despues['precioCop'])}`,
      );
    }
  }
  if ('stock' in antes && 'stock' in despues && antes['stock'] !== despues['stock']) {
    const en = (v: unknown) => (v === null ? 'sin contar' : String(v));
    dichos.push(`las existencias de ${en(antes['stock'])} a ${en(despues['stock'])}`);
  }
  return dichos;
}

/**
 * La combinación como la lee el comercio: «M / Arena»; la única de un producto sin opciones. Se
 * anota como `combinacion`: un campo `clave` se guarda como huella, porque «clave» también es una
 * contraseña (`SENSIBLE`).
 */
const combinacion = (fila: Record<string, unknown>) => {
  const c = fila['combinacion'];
  return typeof c === 'string' && c !== '' ? c.split('|').join(' / ') : 'única';
};

/**
 * La frase de una fila, para quien pregunta (`usuario:<sub>`). Una acción que no conoce se dice
 * igual, con su nombre: nunca se esconde una fila.
 */
export function enFrase(f: FilaDelRegistro, quienPregunta: string): string {
  const tu = f.actor === quienPregunta;
  const quien = tu ? 'Tú' : f.actor === 'sistema' ? 'La tienda' : 'Otra persona del equipo';
  /** El verbo en la persona de quien lo hizo: «Tú creaste», «La tienda creó». */
  const hizo = (raiz: string, segunda: string, tercera: string) =>
    `${quien} ${raiz}${tu ? segunda : tercera}`;
  const antes = leer(f.antes);
  const despues = leer(f.despues);
  const nombre = nombreDe(antes, despues);
  switch (f.accion) {
    case 'producto.crear':
      return `${hizo('cre', 'aste', 'ó')} «${nombre}»`;
    case 'producto.editar': {
      const c = cambios(antes, despues);
      return c.length > 0
        ? `${hizo('cambi', 'aste', 'ó')} ${c.join(', ')} en «${nombre}»`
        : `${hizo('edit', 'aste', 'ó')} «${nombre}»`;
    }
    case 'producto.estado':
      return `${hizo('pas', 'aste', 'ó')} «${nombre}» de ${ESTADOS[String(antes['estado'])] ?? antes['estado']} a ${ESTADOS[String(despues['estado'])] ?? despues['estado']}`;
    case 'producto.borrar':
      return `${hizo('mand', 'aste', 'ó')} «${nombre}» a la papelera`;
    case 'producto.restaurar':
      return `${hizo('sac', 'aste', 'ó')} «${nombre}» de la papelera`;
    case 'productos.ordenar':
      return `${hizo('reorden', 'aste', 'ó')} los productos`;
    case 'variante.crear':
      return `${hizo('agreg', 'aste', 'ó')} la combinación ${combinacion(despues)} a «${nombre}»`;
    case 'variante.editar': {
      const c = cambios(antes, despues);
      const clave = combinacion('combinacion' in despues ? despues : antes);
      return c.length > 0
        ? `${hizo('cambi', 'aste', 'ó')} ${c.join(', ')} de ${clave} en «${nombre}»`
        : `${hizo('edit', 'aste', 'ó')} la combinación ${clave} de «${nombre}»`;
    }
    case 'variante.quitar':
      return `${hizo('quit', 'aste', 'ó')} la combinación ${combinacion(antes)} de «${nombre}»`;
    case 'coleccion.crear':
      return `${hizo('cre', 'aste', 'ó')} la colección «${nombre}»`;
    case 'coleccion.editar':
      return `${hizo('edit', 'aste', 'ó')} la colección «${nombre}»`;
    case 'coleccion.borrar':
      return `${hizo('borr', 'aste', 'ó')} la colección «${nombre}»; sus productos siguen en la tienda`;
    case 'colecciones.ordenar':
      return `${hizo('reorden', 'aste', 'ó')} las colecciones`;
    case 'medio.subir':
      return `${hizo('sub', 'iste', 'ió')} una foto de «${nombre}»`;
    case 'medio.quitar':
      return `${hizo('quit', 'aste', 'ó')} una foto de «${nombre}»`;
    case 'inventario.ajustar':
      return `${hizo('ajust', 'aste', 'ó')} las existencias de ${combinacion(despues)} en «${nombre}» de ${antes['stock']} a ${despues['stock']}`;
    case 'inventario.contar':
      return `${hizo('cont', 'aste', 'ó')} ${combinacion(despues)} de «${nombre}»: había ${antes['stock']}, hay ${despues['stock']}`;
    case 'avisame.atender': {
      const n = Number(antes['personas'] ?? 0);
      const a = n === 1 ? 'a la persona que esperaba' : `a las ${n} personas que esperaban`;
      return `${hizo('avis', 'aste', 'ó')} ${a} ${combinacion(antes)} de «${nombre}»`;
    }
    case 'pedido.contacto_ver':
      return despues['para'] === 'whatsapp'
        ? `${hizo('abr', 'iste', 'ió')} el WhatsApp del pedido #${despues['numero']} con sus datos de entrega`
        : `${hizo('v', 'iste', 'io')} los datos de entrega del pedido #${despues['numero']}`;
    case 'pedido.confirmar':
      return `${hizo('confirm', 'aste', 'ó')} el pedido #${despues['numero']}`;
    case 'pedido.despachar':
      return `${hizo('despach', 'aste', 'ó')} el pedido #${despues['numero']}${despues['transportadora'] ? ` por ${despues['transportadora']}` : ''}${despues['guia'] ? `, guía ${despues['guia']}` : ''}`;
    case 'ajustes.guardar':
      return `${hizo('cambi', 'aste', 'ó')} los ajustes de ${TITULOS_DE_SECCION[f.entidad_id as keyof typeof TITULOS_DE_SECCION] ?? f.entidad_id}`;
    case 'ajustes.whatsapp_verificado':
      return `${hizo('verific', 'aste', 'ó')} el WhatsApp de la tienda`;
    default:
      return `${quien}: ${f.accion} (${f.entidad})`;
  }
}

/** Las filas más nuevas primero, de a `limite`; `cursor` es el id desde el que se sigue. */
export async function leerRegistro(
  db: BaseD1,
  org: string,
  cursor: number | null,
  limite = 50,
): Promise<{ filas: FilaDelRegistro[]; siguiente: number | null }> {
  const { results } = await db
    .prepare(
      `SELECT id, instante, actor, accion, entidad, entidad_id, antes, despues FROM registro
        WHERE org_id = ? AND id < ? ORDER BY id DESC LIMIT ?`,
    )
    .bind(org, cursor ?? Number.MAX_SAFE_INTEGER, limite + 1)
    .all<FilaDelRegistro>();
  const filas = results.slice(0, limite);
  return {
    filas,
    siguiente: results.length > limite ? (filas.at(-1)?.id ?? null) : null,
  };
}
