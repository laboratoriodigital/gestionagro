/**
 * Los derechos del titular y la conservación de los contactos (HU-T7.3, TIENDA-3.0 §14.3, Ley
 * 1581). El comprador pide sus datos, que se corrijan o que se borren; el propietario lo hace aquí
 * sin pedírselo a nadie.
 *
 * - **Buscar por el celular (CA1).** Con el índice ciego de `pedido_contacto` (HMAC con la DEK
 *   `indices`): el celular nunca se guarda en claro. Un contacto escrito antes del índice se abre,
 *   se compara y queda indexado, de a 50.
 * - **Cada acción queda en el registro (CA1)**, sin el celular: buscar dice cuántos pedidos, y
 *   descargar y corregir dejan además su rastro en la historia de cada pedido.
 * - **Suprimir no borra el pedido (CA3).** Se va el sobre del contacto y el pedido queda como
 *   prueba de la venta. Un pedido que no ha terminado conserva su contacto: lo necesita para
 *   llegar; se dice cuántos quedaron.
 * - **La conservación (CA2).** `purgar_despues` sale de `legal.conservacionMeses` (24 si no se
 *   dijo, D-T5) en la misma sentencia que escribe el contacto; bajar el plazo acorta también los
 *   que ya están, y la purga diaria se lleva los vencidos.
 */
import { indiceCiego, type Kek } from '@ed1/cifrado';
import type { SentenciaD1 } from '@ed1/d1';
import { MESES_DE_CONSERVACION } from '@ed1/tienda-horno';
import { taparCelular, taparNombre } from '@ed1/tienda-schema/tapado';
import { z } from 'zod';
import { abrirContactos, ContactoDelPedido, cifrarContacto } from './bandeja.ts';
import {
  esOperacionRepetida,
  guardarOperacion,
  type Quien,
  type Resultado,
  yaAplicada,
} from './catalogo.ts';
import { deksDeLaTienda, dekVigente, paraAbrir } from './llaves.ts';
import { anotar } from './registro.ts';

/** Los 10 dígitos de un celular de Colombia, con o sin +57; `null` si no lo es. */
export function normalizarCelular(texto: string): string | null {
  const d = texto.replace(/\D/g, '');
  const local = d.length === 12 && d.startsWith('57') ? d.slice(2) : d;
  return /^3\d{9}$/.test(local) ? local : null;
}

/**
 * El vencimiento de un contacto, en SQL: el instante más los meses de la ficha legal de la tienda.
 * Se lee en la misma sentencia que escribe, así que no hay carrera con quien cambia el plazo.
 * Toma dos parámetros: el instante y el `org_id`.
 */
export const PURGAR_DESPUES = `strftime('%Y-%m-%dT%H:%M:%fZ', ?, '+' || COALESCE(
    (SELECT json_extract(datos, '$.conservacionMeses') FROM ajuste WHERE org_id = ? AND seccion = 'legal'),
    ${MESES_DE_CONSERVACION}) || ' months')`;

/**
 * Bajar el plazo acorta los contactos que ya están (CA2); subirlo vale para los que lleguen, no
 * alarga lo que se guardó con la política anterior.
 */
export function acortarConservacion(q: Quien, meses: number): SentenciaD1 {
  return q.db
    .prepare(
      `UPDATE pedido_contacto SET purgar_despues = strftime('%Y-%m-%dT%H:%M:%fZ', creado, '+' || ? || ' months')
        WHERE org_id = ? AND purgar_despues > strftime('%Y-%m-%dT%H:%M:%fZ', creado, '+' || ? || ' months')`,
    )
    .bind(meses, q.org, meses);
}

/** Los meses que dice una ficha legal: los suyos, o los de fábrica. */
export const mesesDe = (legal: Record<string, unknown>) =>
  typeof legal['conservacionMeses'] === 'number'
    ? legal['conservacionMeses']
    : MESES_DE_CONSERVACION;

/** El índice ciego del celular de un contacto, con la llave vigente; `null` si no trae celular. */
export async function indiceDelContacto(
  q: Pick<Quien, 'db' | 'org'>,
  kek: Kek,
  contacto: ContactoDelPedido,
  ahora: string,
): Promise<string | null> {
  const celular = contacto.celular ? normalizarCelular(contacto.celular) : null;
  if (!celular) return null;
  return indiceCiego(await dekVigente(q.db, q.org, 'indices', kek, ahora), celular);
}

interface PedidoDelTitular {
  id: string;
  numero: number;
  creado: string;
  estado: string;
  totalCop: number;
  terminado: boolean;
  contacto: ContactoDelPedido;
}

const LOTE = 50;

interface FilaDelPedido {
  id: string;
  numero: number;
  creado: string;
  estado: string;
  total_cop: number;
  terminal: number;
}

/**
 * Los pedidos de un celular, con su contacto abierto. Primero por el índice; después los que no
 * tienen índice, que se abren de a 50 y quedan indexados (los que no traen celular siguen sin él).
 */
async function delTitular(q: Quien, kek: Kek, celular: string): Promise<PedidoDelTitular[]> {
  const deks = await deksDeLaTienda(q.db, q.org, 'indices', paraAbrir(kek));
  const indices = await Promise.all([...deks.values()].map((d) => indiceCiego(d, celular)));
  const ids = new Set<string>();
  if (indices.length > 0) {
    const { results } = await q.db
      .prepare(
        `SELECT pedido_id FROM pedido_contacto
          WHERE org_id = ? AND celular_indice IN (${indices.map(() => '?').join(', ')})`,
      )
      .bind(q.org, ...indices)
      .all<{ pedido_id: string }>();
    for (const f of results) ids.add(f.pedido_id);
  }

  let desde = '';
  for (;;) {
    const { results } = await q.db
      .prepare(
        `SELECT pedido_id FROM pedido_contacto
          WHERE org_id = ? AND celular_indice IS NULL AND pedido_id > ? ORDER BY pedido_id LIMIT ${LOTE}`,
      )
      .bind(q.org, desde)
      .all<{ pedido_id: string }>();
    if (results.length === 0) break;
    desde = results.at(-1)?.pedido_id ?? desde;
    const abiertos = await abrirContactos(
      q,
      kek,
      results.map((f) => f.pedido_id),
    );
    const indexar: SentenciaD1[] = [];
    for (const [pedido, c] of abiertos) {
      const indice = await indiceDelContacto(q, kek, c, q.instante);
      if (!indice) continue;
      if (c.celular && normalizarCelular(c.celular) === celular) ids.add(pedido);
      indexar.push(
        q.db
          .prepare(
            'UPDATE pedido_contacto SET celular_indice = ? WHERE org_id = ? AND pedido_id = ? AND celular_indice IS NULL',
          )
          .bind(indice, q.org, pedido),
      );
    }
    if (indexar.length > 0) await q.db.batch(indexar);
    if (results.length < LOTE) break;
  }
  if (ids.size === 0) return [];

  // D1 admite hasta 100 parámetros por consulta: los pedidos se leen de a 50.
  const lista = [...ids];
  const pedidos: FilaDelPedido[] = [];
  const contactos = new Map<string, ContactoDelPedido>();
  for (let i = 0; i < lista.length; i += LOTE) {
    const parte = lista.slice(i, i + LOTE);
    const { results } = await q.db
      .prepare(
        `SELECT p.id, p.numero, p.creado, p.estado, p.total_cop, e.terminal
           FROM pedido p JOIN ref_estado_pedido e ON e.id = p.estado
          WHERE p.org_id = ? AND p.id IN (${parte.map(() => '?').join(', ')})`,
      )
      .bind(q.org, ...parte)
      .all<FilaDelPedido>();
    pedidos.push(...results);
    for (const [id, c] of await abrirContactos(q, kek, parte)) contactos.set(id, c);
  }
  pedidos.sort((a, b) => b.creado.localeCompare(a.creado));
  return pedidos.flatMap((p) => {
    const contacto = contactos.get(p.id);
    // El índice puede ser de un contacto que ya cambió de celular: lo que manda es el sobre.
    if (!contacto?.celular || normalizarCelular(contacto.celular) !== celular) return [];
    return [
      {
        id: p.id,
        numero: p.numero,
        creado: p.creado,
        estado: p.estado,
        totalCop: p.total_cop,
        terminado: p.terminal === 1,
        contacto,
      },
    ];
  });
}

const PorCelular = z.object({ celular: z.string().max(20) });
const Corregir = PorCelular.extend({
  op: z.string().min(8).max(64),
  contacto: ContactoDelPedido,
});
const Suprimir = PorCelular.extend({ op: z.string().min(8).max(64) });

type Problemas = Extract<Resultado, { estado: 'problemas' }>;
const NO_ES_CELULAR: Problemas = {
  estado: 'problemas',
  problemas: [
    { campo: 'celular', mensaje: 'Escribe los 10 dígitos del celular, empezando por 3.' },
  ],
};
const SIN_LLAVE = {
  estado: 'sin-llave',
  motivo: 'No pudimos abrir los datos de los compradores ahora. Intenta en unos minutos.',
} as const;

export interface Encontrados {
  estado: 'ok';
  comprador: { nombre: string | null; celular: string } | null;
  pedidos: {
    id: string;
    numero: number;
    creado: string;
    estado: string;
    totalCop: number;
    terminado: boolean;
    ciudad: string | null;
  }[];
}

type SinLlave = typeof SIN_LLAVE;
type NoEsCelular = Problemas;

const anotarTitular = (q: Quien, accion: string, despues: Record<string, unknown>) =>
  anotar(q.db, {
    org: q.org,
    actor: q.actor,
    accion,
    entidad: 'titular',
    entidadId: 'comprador',
    antes: null,
    despues,
    instante: q.instante,
  });

/** CA1: buscar. El comprador sale tapado, como en la bandeja; la búsqueda queda en el registro. */
export async function buscarTitular(
  q: Quien,
  kek: Kek | null,
  cuerpo: unknown,
): Promise<Encontrados | SinLlave | NoEsCelular> {
  const r0 = PorCelular.safeParse(cuerpo);
  const celular = r0.success ? normalizarCelular(r0.data.celular) : null;
  if (!celular) return NO_ES_CELULAR;
  if (!kek) return SIN_LLAVE;
  const pedidos = await delTitular(q, kek, celular);
  await (await anotarTitular(q, 'titular.buscar', { pedidos: pedidos.length })).run();
  const nombre = pedidos.find((p) => p.contacto.nombre)?.contacto.nombre;
  return {
    estado: 'ok',
    comprador: pedidos.length
      ? { nombre: nombre ? taparNombre(nombre) : null, celular: taparCelular(celular) }
      : null,
    pedidos: pedidos.map(({ contacto, ...p }) => ({ ...p, ciudad: contacto.ciudad ?? null })),
  };
}

export interface DatosDelTitular {
  estado: 'ok';
  formato: 'titular/1';
  exportada: string;
  pedidos: {
    numero: number;
    creado: string;
    estado: string;
    totalCop: number;
    contacto: ContactoDelPedido;
  }[];
}

const leido = (q: Quien, pedido: string) =>
  q.db
    .prepare(
      `INSERT INTO pedido_evento (org_id, pedido_id, instante, tipo, actor, detalle)
       VALUES (?, ?, ?, 'contacto_leido', ?, ?)`,
    )
    .bind(q.org, pedido, q.instante, q.actor, JSON.stringify({ para: 'titular' }));

/** CA1: los datos de un comprador, en claro, para entregárselos. Cada pedido dice que se leyó. */
export async function exportarTitular(
  q: Quien,
  kek: Kek | null,
  cuerpo: unknown,
): Promise<DatosDelTitular | SinLlave | NoEsCelular> {
  const r0 = PorCelular.safeParse(cuerpo);
  const celular = r0.success ? normalizarCelular(r0.data.celular) : null;
  if (!celular) return NO_ES_CELULAR;
  if (!kek) return SIN_LLAVE;
  const pedidos = await delTitular(q, kek, celular);
  await q.db.batch([
    ...pedidos.map((p) => leido(q, p.id)),
    await anotarTitular(q, 'titular.exportar', { pedidos: pedidos.length }),
  ]);
  return {
    estado: 'ok',
    formato: 'titular/1',
    exportada: q.instante,
    pedidos: pedidos.map((p) => ({
      numero: p.numero,
      creado: p.creado,
      estado: p.estado,
      totalCop: p.totalCop,
      contacto: p.contacto,
    })),
  };
}

export type ResultadoDelTitular =
  | Problemas
  | { estado: 'guardado'; pedidos: number; enCurso: number }
  | SinLlave;

const CAMPOS = ['nombre', 'celular', 'correo', 'direccion', 'ciudad', 'notas'] as const;

/**
 * CA1: corregir. Lo que se escribe reemplaza lo guardado en todos los pedidos de ese celular; lo
 * que se deja vacío sigue como estaba. Si cambia el celular, cambia su índice.
 */
export async function corregirTitular(
  q: Quien,
  kek: Kek | null,
  cuerpo: unknown,
): Promise<ResultadoDelTitular> {
  const r0 = Corregir.safeParse(cuerpo);
  const celular = r0.success ? normalizarCelular(r0.data.celular) : null;
  if (!r0.success || !celular) return NO_ES_CELULAR;
  const d = r0.data;
  const previa = await yaAplicada<ResultadoDelTitular>(q, d.op);
  if (previa) return previa;
  const nuevo = Object.fromEntries(
    CAMPOS.flatMap((k) => {
      const v = d.contacto[k]?.trim();
      return v ? [[k, v]] : [];
    }),
  ) as ContactoDelPedido;
  if (nuevo.celular && !normalizarCelular(nuevo.celular)) {
    return {
      estado: 'problemas',
      problemas: [{ campo: 'contacto.celular', mensaje: 'El celular nuevo no es de Colombia.' }],
    };
  }
  if (Object.keys(nuevo).length === 0) {
    return {
      estado: 'problemas',
      problemas: [{ campo: 'contacto', mensaje: 'Escribe lo que hay que corregir.' }],
    };
  }
  if (!kek) return SIN_LLAVE;
  const pedidos = await delTitular(q, kek, celular);
  const r: ResultadoDelTitular = { estado: 'guardado', pedidos: pedidos.length, enCurso: 0 };
  const lote: SentenciaD1[] = [];
  for (const p of pedidos) {
    const contacto = { ...p.contacto, ...nuevo };
    const sobre = await cifrarContacto(q, kek, p.id, contacto, q.instante);
    lote.push(
      q.db
        .prepare(
          `UPDATE pedido_contacto SET sobre = ?, iv = ?, llave_version = ?, celular_indice = ?
            WHERE org_id = ? AND pedido_id = ?`,
        )
        .bind(
          sobre.sobre,
          sobre.iv,
          sobre.version,
          await indiceDelContacto(q, kek, contacto, q.instante),
          q.org,
          p.id,
        ),
      q.db
        .prepare(
          `INSERT INTO pedido_evento (org_id, pedido_id, instante, tipo, actor, detalle)
           VALUES (?, ?, ?, 'contacto_corregido', ?, ?)`,
        )
        .bind(q.org, p.id, q.instante, q.actor, JSON.stringify({ campos: Object.keys(nuevo) })),
    );
  }
  try {
    await q.db.batch([
      ...lote,
      await anotarTitular(q, 'titular.corregir', {
        pedidos: pedidos.length,
        campos: Object.keys(nuevo),
      }),
      guardarOperacion(q, d.op, 'titular/corregir', r),
    ]);
  } catch (e) {
    if (esOperacionRepetida(e)) return (await yaAplicada<ResultadoDelTitular>(q, d.op)) ?? r;
    throw e;
  }
  return r;
}

/**
 * CA1 y CA3: suprimir. Se van los contactos de los pedidos terminados de ese celular; el pedido, sus
 * líneas y su historia se quedan. Un pedido en curso guarda el suyo hasta terminar.
 */
export async function suprimirTitular(
  q: Quien,
  kek: Kek | null,
  cuerpo: unknown,
): Promise<ResultadoDelTitular> {
  const r0 = Suprimir.safeParse(cuerpo);
  const celular = r0.success ? normalizarCelular(r0.data.celular) : null;
  if (!r0.success || !celular) return NO_ES_CELULAR;
  const d = r0.data;
  const previa = await yaAplicada<ResultadoDelTitular>(q, d.op);
  if (previa) return previa;
  if (!kek) return SIN_LLAVE;
  const pedidos = await delTitular(q, kek, celular);
  const terminados = pedidos.filter((p) => p.terminado);
  const r: ResultadoDelTitular = {
    estado: 'guardado',
    pedidos: terminados.length,
    enCurso: pedidos.length - terminados.length,
  };
  try {
    await q.db.batch([
      ...terminados.flatMap((p) => [
        q.db
          .prepare('DELETE FROM pedido_contacto WHERE org_id = ? AND pedido_id = ?')
          .bind(q.org, p.id),
        q.db
          .prepare(
            `INSERT INTO pedido_evento (org_id, pedido_id, instante, tipo, actor, detalle)
             VALUES (?, ?, ?, 'contacto_suprimido', ?, ?)`,
          )
          .bind(q.org, p.id, q.instante, q.actor, JSON.stringify({ por: 'titular' })),
      ]),
      await anotarTitular(q, 'titular.suprimir', { pedidos: r.pedidos, enCurso: r.enCurso }),
      guardarOperacion(q, d.op, 'titular/suprimir', r),
    ]);
  } catch (e) {
    if (esOperacionRepetida(e)) return (await yaAplicada<ResultadoDelTitular>(q, d.op)) ?? r;
    throw e;
  }
  return r;
}

/**
 * CA2: la purga diaria de los contactos vencidos. Cada pedido dice en su historia que el contacto
 * se fue por el plazo, en el mismo lote que lo borra.
 */
export function purgarContactos(
  db: Quien['db'],
  org: string,
  ahora: string,
): [SentenciaD1, SentenciaD1] {
  return [
    db
      .prepare(
        `INSERT INTO pedido_evento (org_id, pedido_id, instante, tipo, actor, detalle)
         SELECT org_id, pedido_id, ?, 'contacto_suprimido', 'sistema', '{"por":"plazo"}'
           FROM pedido_contacto WHERE org_id = ? AND purgar_despues <= ?`,
      )
      .bind(ahora, org, ahora),
    db
      .prepare('DELETE FROM pedido_contacto WHERE org_id = ? AND purgar_despues <= ?')
      .bind(org, ahora),
  ];
}
