/**
 * El MCP del cuaderno, solo lectura (HU-C9.7, PLATAFORMA §5.5): para que el asistente de un
 * productor le responda «¿qué nave puedo cosechar hoy?» y «¿qué se aplicó esta semana?».
 *
 * - **Dónde:** en la celda del agro, en `POST /mcp` (Streamable HTTP, JSON-RPC 2.0, sin flujo SSE).
 *   En producción, también en su dominio `mcp.cultivopro.co`, donde solo responde lo del MCP.
 * - **Quién:** solo con un token de agente del CORE (`@ed1/tokens`, emisor de agentes) cuyo `aud`
 *   sea este recurso (CA3), con el alcance `agro:registros:leer`, para esta celda y su shard. Sin
 *   token: 401 con `WWW-Authenticate` y el enlace a los metadatos del recurso (RFC 9728, CA2).
 * - **Revocado es revocado:** en cada solicitud se le pregunta al CORE, por service binding, si la
 *   concesión sigue viva (HU-C9.6). Si el CORE no responde, no se lee (falla cerrado).
 * - **Solo lee.** No hay herramienta de escritura (CA3); llega con HU-C9.8.
 * - **Las mismas cuentas que el cuaderno:** el calendario, el costo por kilo, la bodega y el
 *   rendimiento salen de `@ed1/agro-schema` (P2, HU-E0.12). Es la excepción a ADR-5 que decidió
 *   HU-C9.7: la celda calcula solo para responderle al asistente, con lo que ya tiene guardado.
 * - **Del plan Finca en adelante** (HU-E0.12, `asistente_ia` en `funciones.json`): con otro plan,
 *   cada herramienta responde que el asistente viene con el plan Finca. El plan sale de la copia
 *   que la celda guarda de cada organización (`plan_de_org`, HU-C5.6); vencido, cuenta el gratuito.
 * - **Kill switch `ks:agro-mcp`:** apagado, el MCP responde 503 y el cuaderno sigue igual.
 */
import {
  type AplicacionParaCarencias,
  type Area,
  type Ciclo,
  calendarioDeAreas,
  costoPorCiclo,
  type DatosDeLaFinca,
  estadoDeBodega,
  estadosDeAplicaciones,
  fechaAgronomica,
  type Insumo,
  type InsumoParaCarencias,
  type RegistroParaCuentas,
  rendimientoDeLaFinca,
  TIPOS_DEL_COSTO,
  type ValorJornal,
} from '@ed1/agro-schema';
import type { BaseD1 } from '@ed1/d1';
import { type ClavePublica, TokenInvalido, verificarAccesoDeAgente } from '@ed1/tokens';
import type { Context, Hono } from 'hono';
import funciones from '../../../content/agro/cuaderno/funciones.json' with { type: 'json' };

export const PROTOCOLOS_MCP = ['2025-06-18', '2025-03-26'] as const;
export const ALCANCE_DE_LECTURA = 'agro:registros:leer';
/** El producto cuyo kill switch apaga el MCP: `ks:agro-mcp`, de `productos.json`. */
export const PRODUCTO_MCP = 'agro-mcp';
const VERSION = '0.2.0';

export interface EnvDelMcp {
  CELDA?: string;
  /** Este recurso (RFC 8707) en este destino, de `productos.json › recursos_oauth`. */
  RECURSO_MCP?: string;
  /** El servidor de autorización: el CORE de este destino, de `celdas.json`. */
  EMISOR_OAUTH?: string;
  CORE?: { concesionVigente(id: string): Promise<boolean> };
  [clave: string]: unknown;
}

interface Dependencias {
  claves: (env: EnvDelMcp) => ClavePublica[];
  shard: (env: EnvDelMcp, nombre: string) => BaseD1 | undefined;
  apagado: (env: EnvDelMcp) => Promise<boolean>;
  ahora: () => number;
}

const metadatosDelRecurso = (env: EnvDelMcp) => ({
  resource: env.RECURSO_MCP,
  authorization_servers: env.EMISOR_OAUTH ? [env.EMISOR_OAUTH] : [],
  scopes_supported: [ALCANCE_DE_LECTURA],
  bearer_methods_supported: ['header'],
  resource_name: 'Cuaderno de campo de CultivoPro',
  resource_documentation: 'https://cultivopro.co/agro/guia/',
});

const tarjetaDelServidor = (env: EnvDelMcp) => ({
  name: 'cuaderno-cultivopro',
  title: 'Cuaderno de campo de CultivoPro',
  description:
    'Lee tu cuaderno de campo: qué nave puedes cosechar hoy, lo último que se anotó, el costo por kilo, la bodega de insumos, el rendimiento de cada nave y las aplicaciones de un periodo. Solo lee. Con el plan Finca.',
  version: VERSION,
  documentation: 'https://cultivopro.co/agro/guia/',
  protocolVersions: PROTOCOLOS_MCP,
  remotes: [{ type: 'streamable-http', url: `${env.RECURSO_MCP}/mcp` }],
  authentication: {
    type: 'oauth2',
    resource_metadata: `${env.RECURSO_MCP}/.well-known/oauth-protected-resource`,
  },
});

const HERRAMIENTAS = [
  {
    name: 'calendario_de_carencias',
    title: '¿Qué nave puedo cosechar?',
    description:
      'Para cada nave, cama o surco de la finca: si hoy se puede cosechar o entrar, hasta cuándo dura la carencia o la reentrada de lo aplicado, y los días siguientes. Una carencia desconocida nunca sale como «se puede».',
    inputSchema: {
      type: 'object',
      properties: {
        dias: {
          type: 'integer',
          minimum: 1,
          maximum: 14,
          description: 'Días a mostrar desde hoy (1 a 14).',
        },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'ultimos_registros',
    title: 'Lo último que se anotó',
    description:
      'Los registros vigentes más recientes de la finca (riegos, aplicaciones, cosechas, monitoreos, clima…), del más nuevo al más viejo. Lo corregido no aparece.',
    inputSchema: {
      type: 'object',
      properties: {
        tipo: {
          type: 'string',
          description: 'Solo de este tipo, por ejemplo «aplicacion» o «cosecha».',
        },
        limite: {
          type: 'integer',
          minimum: 1,
          maximum: 50,
          description: 'Cuántos (1 a 50; 10 si no se dice).',
        },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'costo_por_kilo',
    title: '¿Cuánto me cuesta cada kilo?',
    description:
      'Para cada ciclo (sus naves) y para lo que no tiene ciclo: insumos aplicados, mano de obra, lo vendible, el costo por unidad vendible, los ingresos de lo despachado y el margen. Si falta un precio o un jornal, el costo dice «al menos»: nunca se suma 0. Las mismas cuentas de la pantalla Costos.',
    inputSchema: {
      type: 'object',
      properties: {
        cultivo: {
          type: 'string',
          description: 'Solo los ciclos de este cultivo, por ejemplo «Tomate».',
        },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'bodega',
    title: '¿Qué insumo se me va a acabar?',
    description:
      'Lo que hay de cada insumo en la bodega, su valor, lo que se usó en los últimos 30 días y, con ese ritmo, para cuántos días alcanza. Una existencia negativa o una aplicación sin cantidad se dicen como tales.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'rendimiento',
    title: '¿Qué nave rinde más?',
    description:
      'Lo cosechado por ciclo y nave: por metro cuadrado, por planta (si se anotaron las plantas) y el % de descarte, agrupado por cultivo y con la mejor nave primero.',
    inputSchema: {
      type: 'object',
      properties: {
        cultivo: { type: 'string', description: 'Solo este cultivo, por ejemplo «Tomate».' },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'aplicaciones_del_periodo',
    title: 'Las aplicaciones de un periodo',
    description:
      'Cada aplicación vigente entre dos fechas, de la más vieja a la más nueva: fecha, naves, producto, dosis, carencia, reentrada y quién aplicó. Sirve para preparar una auditoría. Si no se dicen las fechas, los últimos 6 meses.',
    inputSchema: {
      type: 'object',
      properties: {
        desde: { type: 'string', description: 'AAAA-MM-DD, incluido.' },
        hasta: { type: 'string', description: 'AAAA-MM-DD, incluido.' },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
] as const;

type Rpc = {
  jsonrpc: '2.0';
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};
const respuesta = (id: Rpc['id'], result: unknown) => ({ jsonrpc: '2.0', id: id ?? null, result });
const falla = (id: Rpc['id'], code: number, message: string) => ({
  jsonrpc: '2.0',
  id: id ?? null,
  error: { code, message },
});

interface Sesion {
  org: string;
  db: BaseD1;
}

async function leerFinca(s: Sesion) {
  const catalogo = await s.db
    .prepare(
      "SELECT entidad, datos FROM catalogo WHERE org_id = ? AND entidad IN ('area', 'insumo')",
    )
    .bind(s.org)
    .all<{ entidad: string; datos: string }>();
  const areas: Area[] = [];
  const insumos = new Map<string, InsumoParaCarencias>();
  for (const f of catalogo.results) {
    const d = JSON.parse(f.datos) as Record<string, unknown>;
    if (f.entidad === 'area') areas.push(d as unknown as Area);
    else insumos.set(String(d['id']), d as unknown as InsumoParaCarencias);
  }
  return { areas, insumos };
}

/** Los ids que una corrección anuló: no cuentan (HU-E3.12). */
async function anulados(s: Sesion): Promise<Set<string>> {
  const { results } = await s.db
    .prepare('SELECT anula_id FROM registro WHERE org_id = ? AND anula_id IS NOT NULL')
    .bind(s.org)
    .all<{ anula_id: string }>();
  return new Set(results.map((r) => r.anula_id));
}

export async function calendarioDelMcp(s: Sesion, dias: number, ahora: Date) {
  const { areas, insumos } = await leerFinca(s);
  const fuera = await anulados(s);
  const { results } = await s.db
    .prepare(
      "SELECT id, instante_evento, fecha_agronomica, area_ids, datos FROM registro WHERE org_id = ? AND tipo = 'aplicacion'",
    )
    .bind(s.org)
    .all<{
      id: string;
      instante_evento: string;
      fecha_agronomica: string;
      area_ids: string;
      datos: string;
    }>();
  const aplicaciones: AplicacionParaCarencias[] = results
    .filter((r) => !fuera.has(r.id))
    .map((r) => ({
      instante_evento: r.instante_evento,
      fecha_agronomica: r.fecha_agronomica,
      area_ids: JSON.parse(r.area_ids) as string[],
      datos: JSON.parse(r.datos) as AplicacionParaCarencias['datos'],
    }));
  const filas = calendarioDeAreas(
    areas,
    estadosDeAplicaciones(aplicaciones, insumos, ahora),
    ahora,
    dias,
  );
  const lineas = filas.map((f) => {
    const avisos = [f.hoy.carencia, f.hoy.reentrada].filter(Boolean).join('; ');
    const hoy =
      f.hoy.color === 'verde'
        ? 'hoy se puede cosechar y entrar'
        : f.hoy.color === 'gris'
          ? 'no se sabe'
          : 'hoy no';
    return `- ${f.nombre}: ${hoy}${avisos ? ` (${avisos})` : ''}`;
  });
  return {
    texto:
      filas.length > 0
        ? `Calendario de carencias:\n${lineas.join('\n')}`
        : 'La finca no tiene naves anotadas.',
    datos: {
      areas: filas.map((f) => ({
        nombre: f.nombre,
        hoy: f.hoy,
        dias: f.dias.map((d) => ({ fecha: d.fecha, color: d.color, entrar_desde: d.entrarDesde })),
      })),
    },
  };
}

export async function ultimosDelMcp(s: Sesion, tipo: string | undefined, limite: number) {
  const { areas } = await leerFinca(s);
  const nombres = new Map(areas.map((a) => [a.id, a.nombre]));
  const fuera = await anulados(s);
  const { results } = await s.db
    .prepare(
      `SELECT id, tipo, fecha_agronomica, instante_evento, area_ids, datos FROM registro
        WHERE org_id = ?${tipo ? ' AND tipo = ?' : ''} ORDER BY instante_evento DESC, id DESC LIMIT ?`,
    )
    .bind(s.org, ...(tipo ? [tipo] : []), limite + fuera.size)
    .all<{
      id: string;
      tipo: string;
      fecha_agronomica: string;
      instante_evento: string;
      area_ids: string;
      datos: string;
    }>();
  const vigentes = results.filter((r) => !fuera.has(r.id)).slice(0, limite);
  const registros = vigentes.map((r) => ({
    fecha: r.fecha_agronomica,
    tipo: r.tipo,
    areas: (JSON.parse(r.area_ids) as string[]).map((id) => nombres.get(id) ?? id),
    datos: JSON.parse(r.datos) as unknown,
  }));
  return {
    texto:
      registros.length > 0
        ? registros.map((r) => `- ${r.fecha} · ${r.tipo} · ${r.areas.join(', ')}`).join('\n')
        : 'No hay registros que mostrar.',
    datos: { registros },
  };
}

// ---------------------------------------------------------------------------------------------
// HU-E0.12: el asistente del plan Finca, con las mismas cuentas del cuaderno.

/** El plan de la organización según la copia de la celda; sin fila o vencido, el gratuito. */
export async function planDeLaOrg(s: Sesion, ahora: Date): Promise<string> {
  const fila = await s.db
    .prepare('SELECT plan, plan_vence FROM plan_de_org WHERE org_id = ?')
    .bind(s.org)
    .first<{ plan: string; plan_vence: string | null }>();
  if (!fila) return 'gratuito';
  if (fila.plan_vence !== null && Date.parse(fila.plan_vence) <= ahora.getTime()) return 'gratuito';
  return fila.plan;
}

/** ¿El asistente está encendido para el plan? La misma regla de las funciones del cuaderno. */
export function asistenteActivo(plan: string): boolean {
  const porPlan = funciones.asistente_ia as Record<string, boolean>;
  return porPlan[plan] ?? porPlan['gratuito'] ?? false;
}

export const SIN_PLAN_FINCA =
  'El asistente del cuaderno viene con el plan Finca. Con él puedes preguntarle por tus carencias, tus costos, tu bodega y el rendimiento de tus naves. Los planes están en el cuaderno, en «Cuenta» → «Ver los planes».';

/** Los catálogos y los registros de los tipos pedidos, también los anulados, como en el teléfono. */
type DatosDelShard = DatosDeLaFinca & { personas: { id: string; nombre: string }[] };

async function datosDelShard(s: Sesion, tipos: readonly string[]): Promise<DatosDelShard> {
  const catalogo = await s.db
    .prepare(
      "SELECT entidad, datos FROM catalogo WHERE org_id = ? AND entidad IN ('area', 'ciclo', 'insumo', 'valor_jornal', 'persona')",
    )
    .bind(s.org)
    .all<{ entidad: string; datos: string }>();
  const por: Record<string, unknown[]> = {};
  for (const f of catalogo.results) {
    por[f.entidad] = [...(por[f.entidad] ?? []), JSON.parse(f.datos)];
  }
  const marcas = tipos.map(() => '?').join(', ');
  const { results } = await s.db
    .prepare(
      `SELECT id, tipo, v, area_ids, ciclo_id, persona_ids, fecha_agronomica, instante_evento, anula_id, datos
         FROM registro WHERE org_id = ? AND tipo IN (${marcas})`,
    )
    .bind(s.org, ...tipos)
    .all<{
      id: string;
      tipo: string;
      v: number;
      area_ids: string;
      ciclo_id: string | null;
      persona_ids: string;
      fecha_agronomica: string;
      instante_evento: string;
      anula_id: string | null;
      datos: string;
    }>();
  const registros: RegistroParaCuentas[] = results.map((r) => ({
    id: r.id,
    tipo: r.tipo,
    v: r.v,
    area_ids: JSON.parse(r.area_ids) as string[],
    ciclo_id: r.ciclo_id,
    persona_ids: JSON.parse(r.persona_ids) as string[],
    fecha_agronomica: r.fecha_agronomica,
    instante_evento: r.instante_evento,
    anula_id: r.anula_id,
    datos: JSON.parse(r.datos) as Record<string, unknown>,
  }));
  return {
    areas: (por['area'] ?? []) as Area[],
    ciclos: (por['ciclo'] ?? []) as Ciclo[],
    insumos: (por['insumo'] ?? []) as Insumo[],
    valoresJornal: (por['valor_jornal'] ?? []) as ValorJornal[],
    registros,
    anulados: await anulados(s),
    // Las personas no están en `DatosDeLaFinca`: solo las usa la lista de aplicaciones.
    personas: (por['persona'] ?? []) as { id: string; nombre: string }[],
  };
}

/** «$1.840», con el punto de miles de Colombia. */
const pesos = (n: number) => `$${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
const cifra = (n: number, decimales = 2) =>
  String(Math.round(n * 10 ** decimales) / 10 ** decimales).replace('.', ',');
const mismoCultivo = (a: string, b: string | undefined) =>
  !b || a.localeCompare(b, 'es', { sensitivity: 'base' }) === 0;

export async function costoDelMcp(s: Sesion, cultivo: string | undefined) {
  const filas = costoPorCiclo(await datosDelShard(s, TIPOS_DEL_COSTO)).filter((f) =>
    mismoCultivo(f.ciclo?.cultivo ?? 'Sin ciclo', cultivo),
  );
  const lineas = filas.map((f) => {
    const r = f.resultado;
    const quien = f.ciclo
      ? `${f.ciclo.cultivo} ${f.ciclo.variedad} (${f.areas})`
      : `${f.areas}, sin ciclo`;
    const alMenos = r.costoCompleto ? '' : 'al menos ';
    const porUnidad = f.variasUnidades
      ? 'no se reparte: cosechó en varias unidades'
      : r.porUnidad === null
        ? 'sin cosecha vendible todavía'
        : `${alMenos}${pesos(r.porUnidad)} por ${f.unidad} vendible`;
    const margen =
      r.margen === null
        ? 'sin ventas con precio'
        : `margen ${r.margenCompleto ? '' : 'aproximado '}${pesos(r.margen)}`;
    return `- ${quien}: ${porUnidad}; costo ${alMenos}${pesos(r.costo)} (insumos ${pesos(f.insumos)}, mano de obra ${pesos(f.manoDeObra)}); ingresos ${pesos(f.ingresos)}, ${margen}.`;
  });
  return {
    texto:
      filas.length > 0 ? `Costo por kilo:\n${lineas.join('\n')}` : 'No hay costos que mostrar.',
    datos: { ciclos: filas },
  };
}

export async function bodegaDelMcp(s: Sesion, ahora: Date) {
  const d = await datosDelShard(s, ['movimiento_insumo', 'aplicacion']);
  const existencias = estadoDeBodega(d);
  // Lo usado en los últimos 30 días, de las aplicaciones vigentes con cantidad.
  const desde = fechaAgronomica(ahora.getTime() - 30 * 86_400_000);
  const usado = new Map<string, number>();
  for (const r of d.registros) {
    if (r.tipo !== 'aplicacion' || d.anulados.has(r.id) || r.fecha_agronomica < desde) continue;
    const a = r.datos as { insumo_id?: string; cantidadUsada?: number | null };
    if (a.insumo_id && typeof a.cantidadUsada === 'number')
      usado.set(a.insumo_id, (usado.get(a.insumo_id) ?? 0) + a.cantidadUsada);
  }
  const filas = existencias.map((e) => {
    const mes = usado.get(e.insumoId) ?? 0;
    const alcanzaDias = mes > 0 && e.existencia > 0 ? Math.floor(e.existencia / (mes / 30)) : null;
    return { ...e, usadoEn30Dias: mes, alcanzaDias };
  });
  const lineas = filas.map((f) => {
    const hay = f.quedoNegativa
      ? `quedó en ${cifra(f.existencia)} ${f.unidad}: falta anotar una compra o un ajuste`
      : `quedan ${cifra(f.existencia)} ${f.unidad}`;
    const ritmo =
      f.alcanzaDias === null
        ? f.usadoEn30Dias > 0
          ? `; se usaron ${cifra(f.usadoEn30Dias)} en 30 días`
          : '; sin uso en los últimos 30 días'
        : `; se usaron ${cifra(f.usadoEn30Dias)} en 30 días: alcanza para unos ${f.alcanzaDias} días`;
    const sin =
      f.sinCantidad > 0 ? ` (${f.sinCantidad} aplicaciones sin cantidad no descontaron)` : '';
    return `- ${f.insumo}: ${hay}${ritmo}${sin}.`;
  });
  return {
    texto: filas.length > 0 ? `Bodega:\n${lineas.join('\n')}` : 'La bodega no tiene movimientos.',
    datos: { insumos: filas },
  };
}

export async function rendimientoDelMcp(s: Sesion, cultivo: string | undefined) {
  const grupos = rendimientoDeLaFinca(await datosDelShard(s, ['cosecha'])).filter((g) =>
    mismoCultivo(g.cultivo, cultivo),
  );
  const lineas = grupos.flatMap((g) => [
    `${g.cultivo}:`,
    ...g.filas.map((f) => {
      const r = f.resultado;
      const planta = r.porPlanta === null ? '' : `, ${cifra(r.porPlanta)} ${f.unidad} por planta`;
      const descarte = r.descartePct === null ? '' : `, ${cifra(r.descartePct, 1)} % de descarte`;
      return `- ${f.areas}: ${cifra(r.porM2)} ${f.unidad} por m²${planta}${descarte} (${f.cosechas} cosechas).`;
    }),
  ]);
  return {
    texto:
      grupos.length > 0 ? `Rendimiento:\n${lineas.join('\n')}` : 'No hay cosechas que mostrar.',
    datos: { cultivos: grupos },
  };
}

const esFecha = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export async function aplicacionesDelMcp(s: Sesion, desde: string, hasta: string) {
  const d = await datosDelShard(s, ['aplicacion']);
  const area = new Map(d.areas.map((a) => [a.id, a.nombre]));
  const persona = new Map(d.personas.map((p) => [p.id, p.nombre]));
  const aplicaciones = d.registros
    .filter(
      (r) => !d.anulados.has(r.id) && r.fecha_agronomica >= desde && r.fecha_agronomica <= hasta,
    )
    .sort((a, b) => a.instante_evento.localeCompare(b.instante_evento))
    .map((r) => {
      const a = r.datos as {
        insumo: string;
        dosis?: number;
        dosisUnidad?: string;
        carenciaDias: number | null;
        reentradaHoras: number | null;
      };
      return {
        fecha: r.fecha_agronomica,
        areas: r.area_ids.map((id) => area.get(id) ?? id),
        producto: a.insumo,
        dosis: a.dosis === undefined ? null : `${cifra(a.dosis)} ${a.dosisUnidad ?? ''}`.trim(),
        carencia_dias: a.carenciaDias,
        reentrada_horas: a.reentradaHoras,
        quien: r.persona_ids.map((id) => persona.get(id) ?? 'otra persona'),
      };
    });
  const lineas = aplicaciones.map(
    (a) =>
      `- ${a.fecha} · ${a.areas.join(', ')} · ${a.producto}${a.dosis ? ` ${a.dosis}` : ''} · carencia ${a.carencia_dias ?? 'desconocida'} días, reentrada ${a.reentrada_horas ?? 'desconocida'} h${a.quien.length > 0 ? ` · ${a.quien.join(', ')}` : ''}`,
  );
  return {
    texto:
      aplicaciones.length > 0
        ? `Aplicaciones del ${desde} al ${hasta}:\n${lineas.join('\n')}`
        : `No hay aplicaciones del ${desde} al ${hasta}.`,
    datos: { desde, hasta, aplicaciones },
  };
}

function noAutorizado(c: Context, env: EnvDelMcp, error?: string, descripcion?: string) {
  const partes = [`resource_metadata="${env.RECURSO_MCP}/.well-known/oauth-protected-resource"`];
  if (error) partes.push(`error="${error}"`);
  if (descripcion) partes.push(`error_description="${descripcion}"`);
  c.header('www-authenticate', `Bearer ${partes.join(', ')}`);
  return c.json(
    { error: error ?? 'invalid_token', error_description: descripcion ?? 'Falta el token.' },
    401,
  );
}

/** Las rutas del MCP en el Worker de la celda. */
export function rutasDelMcp(app: Hono<{ Bindings: EnvDelMcp }>, dep: Dependencias) {
  // CA1 y RFC 9728: también en la ruta con `/mcp` al final, como la piden algunos clientes.
  for (const ruta of [
    '/.well-known/oauth-protected-resource',
    '/.well-known/oauth-protected-resource/mcp',
  ]) {
    app.get(ruta, (c) => {
      if (!c.env.RECURSO_MCP) return c.notFound();
      c.header('access-control-allow-origin', '*');
      return c.json(metadatosDelRecurso(c.env));
    });
  }
  app.get('/.well-known/mcp/server-card.json', (c) => {
    if (!c.env.RECURSO_MCP) return c.notFound();
    c.header('access-control-allow-origin', '*');
    return c.json(tarjetaDelServidor(c.env));
  });
  app.get('/mcp', (c) => c.json({ error: 'Este servidor no abre un flujo SSE: usa POST.' }, 405));
  app.post('/mcp', async (c) => {
    const env = c.env;
    if (!env.RECURSO_MCP) return c.notFound();
    if (await dep.apagado(env))
      return c.json(
        falla(null, -32000, 'El asistente del cuaderno está en pausa. El cuaderno sigue igual.'),
        503,
      );
    const token = c.req.header('authorization')?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return noAutorizado(c, env);
    let r: Awaited<ReturnType<typeof verificarAccesoDeAgente>>;
    try {
      r = await verificarAccesoDeAgente(dep.claves(env), token, env.RECURSO_MCP, dep.ahora());
    } catch (e) {
      if (!(e instanceof TokenInvalido)) throw e;
      return noAutorizado(c, env, 'invalid_token', e.message);
    }
    if (!r.scope.split(' ').includes(ALCANCE_DE_LECTURA))
      return c.json(
        { error: 'insufficient_scope', error_description: `Falta ${ALCANCE_DE_LECTURA}.` },
        403,
      );
    const db = r.celda === env.CELDA ? dep.shard(env, r.shard) : undefined;
    if (!db)
      return c.json(
        { error: 'invalid_token', error_description: 'Esta finca vive en otra celda.' },
        403,
      );
    // HU-C9.6 CA2: quitar el acceso corta la siguiente solicitud. Sin respuesta del CORE, no se lee.
    let vigente = false;
    try {
      vigente = env.CORE ? await env.CORE.concesionVigente(r.cnc) : false;
    } catch {
      return c.json(
        falla(null, -32000, 'No se pudo comprobar el acceso. Intenta en un momento.'),
        503,
      );
    }
    if (!vigente) return noAutorizado(c, env, 'invalid_token', 'Quitaron este acceso.');
    const rpc = (await c.req.json().catch(() => null)) as Rpc | null;
    if (!rpc || Array.isArray(rpc) || rpc.jsonrpc !== '2.0' || typeof rpc.method !== 'string')
      return c.json(falla(null, -32600, 'Solicitud JSON-RPC inválida.'), 400);
    // Una notificación no lleva id ni respuesta.
    if (rpc.id === undefined) return c.body(null, 202);
    const s: Sesion = { org: r.org, db };
    switch (rpc.method) {
      case 'initialize': {
        const pedido = String(rpc.params?.['protocolVersion'] ?? '');
        const version = (PROTOCOLOS_MCP as readonly string[]).includes(pedido)
          ? pedido
          : PROTOCOLOS_MCP[0];
        return c.json(
          respuesta(rpc.id, {
            protocolVersion: version,
            capabilities: { tools: { listChanged: false } },
            serverInfo: {
              name: 'cuaderno-cultivopro',
              title: 'Cuaderno de campo de CultivoPro',
              version: VERSION,
            },
            instructions:
              'Lee el cuaderno de campo de la finca: carencias, registros, costo por kilo, bodega, rendimiento y aplicaciones. Solo lee: para anotar, la persona usa el cuaderno. Los montos van en pesos colombianos y las fechas en hora de Colombia.',
          }),
        );
      }
      case 'ping':
        return c.json(respuesta(rpc.id, {}));
      case 'tools/list':
        return c.json(respuesta(rpc.id, { tools: HERRAMIENTAS }));
      case 'tools/call': {
        const nombre = rpc.params?.['name'];
        const args = (rpc.params?.['arguments'] ?? {}) as Record<string, unknown>;
        const entero = (v: unknown, min: number, max: number, def: number) =>
          Number.isInteger(v) ? Math.min(max, Math.max(min, v as number)) : def;
        const texto = (k: string) =>
          typeof args[k] === 'string' && args[k] ? (args[k] as string) : undefined;
        const ahora = new Date(dep.ahora());
        if (!HERRAMIENTAS.some((h) => h.name === nombre))
          return c.json(falla(rpc.id, -32602, `No existe la herramienta ${String(nombre)}.`));
        // HU-E0.12: del plan Finca en adelante. Se dice en la respuesta, para que el asistente
        // se lo cuente a la persona, y no como un error del protocolo.
        if (!asistenteActivo(await planDeLaOrg(s, ahora)))
          return c.json(
            respuesta(rpc.id, { content: [{ type: 'text', text: SIN_PLAN_FINCA }], isError: true }),
          );
        let resultado: { texto: string; datos: unknown };
        if (nombre === 'calendario_de_carencias') {
          resultado = await calendarioDelMcp(s, entero(args['dias'], 1, 14, 7), ahora);
        } else if (nombre === 'ultimos_registros') {
          resultado = await ultimosDelMcp(s, texto('tipo'), entero(args['limite'], 1, 50, 10));
        } else if (nombre === 'costo_por_kilo') {
          resultado = await costoDelMcp(s, texto('cultivo'));
        } else if (nombre === 'bodega') {
          resultado = await bodegaDelMcp(s, ahora);
        } else if (nombre === 'rendimiento') {
          resultado = await rendimientoDelMcp(s, texto('cultivo'));
        } else {
          // Fechas de la finca (Bogotá), no del servidor (P8).
          const hoy = fechaAgronomica(ahora.getTime());
          const seisMeses = fechaAgronomica(ahora.getTime() - 182 * 86_400_000);
          const desde = esFecha(args['desde']) ? args['desde'] : seisMeses;
          const hasta = esFecha(args['hasta']) ? args['hasta'] : hoy;
          resultado = await aplicacionesDelMcp(s, desde, hasta);
        }
        return c.json(
          respuesta(rpc.id, {
            content: [{ type: 'text', text: resultado.texto }],
            structuredContent: resultado.datos,
          }),
        );
      }
      default:
        return c.json(falla(rpc.id, -32601, `Método desconocido: ${rpc.method}`));
    }
  });
}

/**
 * En el dominio propio del MCP solo responde lo del MCP: la API de sincronización del cuaderno no
 * se publica ahí.
 */
export const soloLoDelMcp = (recurso: string | undefined, url: string): boolean => {
  if (!recurso) return true;
  const u = new URL(url);
  const delRecurso = new URL(recurso).host;
  // En staging el recurso es la misma celda en workers.dev: ahí vive todo junto.
  if (u.host !== delRecurso || delRecurso.endsWith('.workers.dev')) return true;
  return u.pathname === '/mcp' || u.pathname.startsWith('/.well-known/');
};
