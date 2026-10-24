'SELECT producto, creado FROM organizacion INDEXED BY organizacion_por_creado WHERE creado >= ?'; /**
 * La consola del dueño v0 (EC13, HC8; ED1 §31.1 y §32). Responde las preguntas del Command Center en
 * su versión mínima, con lo que el CORE ya guarda y **solo para leer**:
 *
 * - `POST /api/core/consola/hoy`: lo que entró, lo que vence y los pagos para revisar (HU-C13.2).
 * - `POST /api/core/consola/crecio`: cuentas y espacios nuevos, planes y conversión (HU-C13.3).
 * - `POST /api/core/consola/revisar`: los radicados de la Ley 1581 abiertos (HU-C13.4 CA3).
 * - `POST /api/core/consola/roto`: la copia de la semana y los correos del día (HU-C13.4).
 *
 * **Quién entra (D-C8, decisión del dueño del 23 oct 2026):** como cualquier persona, con Google o con
 * su correo, a la app `consola` (`aud = consola`). Solo las direcciones de `CONSOLA_CORREOS` reciben
 * datos, y con una entrada de hace menos de 12 h. No hay un superusuario: la consola no entra a los
 * datos de ningún cliente, nunca nombra a una persona y no cambia nada. Cada bloque entregado queda
 * en la auditoría (`consola_vista`).
 *
 * Un bloque que no se pudo leer responde 503 con la causa, nunca ceros (P1).
 */
import { diasHabilesEntre, fechaEnBogota } from '@ed1/calendario';
import { TokenInvalido, verificarAcceso } from '@ed1/tokens';
import type { Context } from 'hono';
import { filaDeAuditoria } from './auditoria.ts';
import { semanaDe } from './copia-formato.ts';
import { TOPE_DIARIO_DEL_CORE } from './correo.ts';
import type { Entorno } from './entrar.ts';
import { avisoDelPlan, planesDe } from './productos.ts';

export const PRODUCTO_CONSOLA = 'consola';
export const ENTRADA_DE_LA_CONSOLA_MS = 12 * 60 * 60 * 1000;
/** Un pago `esperando` de más de esto ya no es «alguien pagando ahora»: es para revisar. */
export const ESPERA_PARA_REVISAR_MS = 60 * 60 * 1000;
/** Los radicados que vencen en estos días hábiles o menos salen en rojo (HU-C13.4 CA3). */
export const RADICADO_URGENTE_DIAS = 3;
const DIA_MS = 24 * 60 * 60 * 1000;
const SEMANAS = 8;

export type Bloque = 'hoy' | 'crecio' | 'revisar' | 'roto';

export interface EntornoDeConsola extends Entorno {
  /** Las direcciones del dueño, de `CONSOLA_CORREOS`, separadas por coma. */
  correosDelDueno: string | undefined;
}

const iso = (ms: number) => new Date(ms).toISOString();

/** Las direcciones de `CONSOLA_CORREOS`, normalizadas. Vacía si falta: nadie ve nada (P1). */
export const correosDelDueno = (valor: string | undefined): Set<string> =>
  new Set(
    (valor ?? '')
      .split(',')
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean),
  );

const NO_ES_PARA_TI = { estado: 'prohibido', motivo: 'Esta página no es para tu cuenta.' };

/**
 * Quién pide y si puede (HU-C13.1). A quien no está en la lista le responde siempre lo mismo, sin
 * decir qué faltó (CA3); al dueño con una entrada vieja le dice que vuelva a entrar.
 */
async function delDueno(
  c: Context,
  e: EntornoDeConsola,
): Promise<{ usuarioId: string } | Response> {
  const token = c.req.header('authorization')?.match(/^Bearer (.+)$/)?.[1];
  let reclamos: Awaited<ReturnType<typeof verificarAcceso>> | null = null;
  try {
    reclamos = token ? await verificarAcceso(e.firmante.publica, token, e.ahora()) : null;
  } catch (error) {
    if (!(error instanceof TokenInvalido)) throw error;
  }
  if (!reclamos) {
    return c.json({ estado: 'sin-sesion', motivo: 'Entra para ver la consola.' }, 401);
  }
  if (reclamos.aud !== PRODUCTO_CONSOLA) return c.json(NO_ES_PARA_TI, 403);
  const fila = await e.db
    .prepare('SELECT email FROM usuario WHERE id = ?')
    .bind(reclamos.sub)
    .first<{ email: string }>();
  if (!fila || !correosDelDueno(e.correosDelDueno).has(fila.email.trim().toLowerCase())) {
    return c.json(NO_ES_PARA_TI, 403);
  }
  if (!reclamos.auth_time || e.ahora() - reclamos.auth_time * 1000 > ENTRADA_DE_LA_CONSOLA_MS) {
    return c.json(
      {
        estado: 'entrar-de-nuevo',
        motivo: 'Tu entrada a la consola tiene más de 12 horas. Vuelve a entrar.',
      },
      403,
    );
  }
  return { usuarioId: reclamos.sub };
}

/** Responde un bloque: revisa quién pide, lo lee, lo anota en la auditoría y lo entrega. */
export async function verBloque(
  c: Context,
  e: EntornoDeConsola,
  bloque: Bloque,
): Promise<Response> {
  const quien = await delDueno(c, e);
  if (quien instanceof Response) return quien;
  let datos: Record<string, unknown>;
  try {
    datos = await LECTORES[bloque](e);
  } catch (error) {
    console.error(`agro-core: la consola no pudo leer «${bloque}»:`, (error as Error).message);
    return c.json(
      {
        estado: 'no-se-pudo',
        motivo: `No se pudo leer este bloque (${(error as Error).name}). Intenta de nuevo en un momento.`,
      },
      503,
    );
  }
  await filaDeAuditoria(e.db, {
    instante: iso(e.ahora()),
    producto: PRODUCTO_CONSOLA,
    org_id: null,
    usuario_id: quien.usuarioId,
    accion: 'consola_vista',
    detalle: { bloque },
  }).run();
  return c.json({ estado: 'ok', ...datos });
}

// ── Las ventanas de tiempo, en días de Bogotá (P8) ─────────────────────────────────────────

/** El instante en que empieza ese día de Bogotá (UTC−5, sin horario de verano). */
const inicioDelDia = (fecha: string) => Date.parse(`${fecha}T05:00:00.000Z`);

export function ventanas(ahora: number) {
  const fecha = fechaEnBogota(ahora);
  return {
    hoy: inicioDelDia(fecha),
    semana: inicioDelDia(fecha) - 6 * DIA_MS,
    mes: inicioDelDia(`${fecha.slice(0, 8)}01`),
  };
}

const nombreDe = (e: Entorno, producto: string) =>
  e.catalogo.productos.find((p) => p.id === producto)?.nombre ?? producto;

// ── HU-C13.2 · Hoy: lo que entró y lo que vence ─────────────────────────────────────────────

interface Pago {
  producto: string;
  proveedor: string;
  monto_cop: number;
  actualizado: string;
}

async function hoy(e: Entorno): Promise<Record<string, unknown>> {
  const ahora = e.ahora();
  const v = ventanas(ahora);
  // La ventana más larga es la del mes o la de los 7 días, la que empiece antes.
  const desde = Math.min(v.mes, v.semana);
  const aprobados = await e.db
    .prepare(
      `SELECT producto, proveedor, monto_cop, actualizado FROM pago INDEXED BY pago_por_estado
        WHERE estado = 'aprobado' AND actualizado >= ?`,
    )
    .bind(iso(desde))
    .all<Pago>();
  const sumar = (desdeMs: number) => {
    const grupos = new Map<
      string,
      { producto: string; medio: string; pagos: number; cop: number }
    >();
    for (const p of aprobados.results) {
      if (Date.parse(p.actualizado) < desdeMs) continue;
      const clave = `${p.producto}|${p.proveedor}`;
      const g = grupos.get(clave) ?? {
        producto: nombreDe(e, p.producto),
        medio: p.proveedor === 'efectivo' ? 'Efectivo' : 'Bold',
        pagos: 0,
        cop: 0,
      };
      g.pagos++;
      g.cop += p.monto_cop;
      grupos.set(clave, g);
    }
    const detalle = [...grupos.values()].sort((a, b) => b.cop - a.cop);
    return { total_cop: detalle.reduce((s, g) => s + g.cop, 0), detalle };
  };

  // Lo que vence en 7 días o ya está en gracia: la gracia más larga del catálogo hacia atrás.
  const graciaMaxima = Math.max(0, ...e.catalogo.productos.map((p) => p.gracia_dias ?? 0));
  const porVencer = await e.db
    .prepare(
      `SELECT nombre, producto, plan AS plan_pagado, plan_vence AS vence_pagado
         FROM organizacion INDEXED BY organizacion_por_vencimiento
        WHERE plan_vence IS NOT NULL AND plan_vence > ? AND plan_vence <= ? AND estado = 'activa'
        ORDER BY plan_vence`,
    )
    .bind(iso(ahora - graciaMaxima * DIA_MS), iso(ahora + 7 * DIA_MS))
    .all<{ nombre: string; producto: string; plan_pagado: string; vence_pagado: string }>();
  const vencen = porVencer.results.flatMap((o) => {
    const aviso = avisoDelPlan(e.catalogo, o, ahora);
    if (!aviso) return [];
    const plan = planesDe(e.catalogo, o.producto).find((p) => p.id === o.plan_pagado);
    return [
      {
        espacio: o.nombre,
        producto: nombreDe(e, o.producto),
        plan: plan?.nombre ?? o.plan_pagado,
        vence: o.vence_pagado,
        aviso,
      },
    ];
  });

  // CA3: lo que no se suma a lo que entró.
  const raros = await e.db
    .prepare(
      `SELECT producto, proveedor, monto_cop, estado, creado FROM pago INDEXED BY pago_por_estado
        WHERE estado = 'revisar' OR (estado = 'esperando' AND actualizado < ?)
        ORDER BY creado`,
    )
    .bind(iso(ahora - ESPERA_PARA_REVISAR_MS))
    .all<{
      producto: string;
      proveedor: string;
      monto_cop: number;
      estado: string;
      creado: string;
    }>();

  return {
    entro: { hoy: sumar(v.hoy), semana: sumar(v.semana), mes: sumar(v.mes) },
    vencen,
    para_revisar: raros.results.map((p) => ({
      producto: nombreDe(e, p.producto),
      medio: p.proveedor === 'efectivo' ? 'Efectivo' : 'Bold',
      cop: p.monto_cop,
      estado: p.estado,
      desde: p.creado,
    })),
  };
}

// ── HU-C13.3 · Lo que creció y lo que convierte ─────────────────────────────────────────────

/** La semana (lunes de Bogotá) de un instante, como la usa la copia. */
const semanaDeIso = (instante: string) => semanaDe(Date.parse(instante));

async function crecio(e: Entorno): Promise<Record<string, unknown>> {
  const ahora = e.ahora();
  const desde = iso(Date.parse(`${semanaDe(ahora)}T05:00:00.000Z`) - (SEMANAS - 1) * 7 * DIA_MS);
  const semanas = Array.from({ length: SEMANAS }, (_, i) =>
    semanaDe(Date.parse(desde) + (i * 7 + 1) * DIA_MS),
  );
  // Solo se cuentan filas: ni un nombre ni un correo sale de estas consultas (CA3).
  const cuentas = await e.db
    .prepare('SELECT creado FROM usuario INDEXED BY usuario_por_creado WHERE creado >= ?')
    .bind(desde)
    .all<{ creado: string }>();
  const espacios = await e.db
    .prepare(
      `SELECT producto, creado FROM organizacion INDEXED BY organizacion_por_creado
        WHERE producto IN (SELECT id FROM producto) AND creado >= ?`,
    )
    .bind(desde)
    .all<{ producto: string; creado: string }>();
  const porPlan = await e.db
    .prepare(
      "SELECT producto, plan, count(*) AS n FROM organizacion WHERE estado = 'activa' GROUP BY producto, plan",
    )
    .all<{ producto: string; plan: string; n: number }>();
  const { mes } = ventanas(ahora);
  const primerosPagos = await e.db
    .prepare(
      `SELECT producto, count(*) AS n FROM (
         SELECT org_id, producto, min(actualizado) AS primero FROM pago INDEXED BY pago_por_estado
          WHERE estado = 'aprobado' GROUP BY org_id, producto
       ) WHERE primero >= ? GROUP BY producto`,
    )
    .bind(iso(mes))
    .all<{ producto: string; n: number }>();
  const interes = await e.db
    .prepare('SELECT producto, plan, count(*) AS n FROM interes_plan GROUP BY producto, plan')
    .all<{ producto: string; plan: string; n: number }>();

  const contarPorSemana = (filas: readonly { creado: string }[]) =>
    semanas.map((s) => ({ semana: s, n: filas.filter((f) => semanaDeIso(f.creado) === s).length }));
  const productos = [...new Set(espacios.results.map((x) => x.producto))].sort();
  const nombreDelPlan = (producto: string, plan: string) =>
    planesDe(e.catalogo, producto).find((p) => p.id === plan)?.nombre ?? plan;
  return {
    cuentas_nuevas: contarPorSemana(cuentas.results),
    espacios_nuevos: productos.map((p) => ({
      producto: nombreDe(e, p),
      semanas: contarPorSemana(espacios.results.filter((x) => x.producto === p)),
    })),
    por_plan: porPlan.results.map((r) => ({
      producto: nombreDe(e, r.producto),
      plan: nombreDelPlan(r.producto, r.plan),
      gratuito: planesDe(e.catalogo, r.producto).find((p) => p.id === r.plan)?.gratuito === true,
      espacios: r.n,
    })),
    pagaron_por_primera_vez: primerosPagos.results.map((r) => ({
      producto: nombreDe(e, r.producto),
      espacios: r.n,
    })),
    interes: interes.results.map((r) => ({
      producto: nombreDe(e, r.producto),
      plan: nombreDelPlan(r.producto, r.plan),
      personas: r.n,
    })),
  };
}

// ── HU-C13.4 · Lo que hay que revisar y lo que se rompió ────────────────────────────────────

async function revisar(e: Entorno): Promise<Record<string, unknown>> {
  const hoyBogota = fechaEnBogota(e.ahora());
  const { results } = await e.db
    .prepare(
      "SELECT numero, tipo, vence FROM radicado_datos WHERE estado = 'abierto' ORDER BY vence",
    )
    .all<{ numero: string; tipo: string; vence: string }>();
  return {
    radicados: results.map((r) => {
      const quedan = r.vence < hoyBogota ? -1 : diasHabilesEntre(hoyBogota, r.vence);
      return {
        numero: r.numero,
        tipo: r.tipo,
        vence: r.vence,
        dias_habiles: quedan,
        urgente: quedan <= RADICADO_URGENTE_DIAS,
      };
    }),
  };
}

async function roto(e: Entorno): Promise<Record<string, unknown>> {
  const ahora = e.ahora();
  const semana = semanaDe(ahora);
  const copia = await e.db
    .prepare(
      // `_cierre` es la rotación de la semana, no una base: no se cuenta entre las copiadas.
      "SELECT base, estado, intentos, bytes, motivo, actualizado FROM copia_base WHERE semana = ? AND base <> '_cierre' ORDER BY base",
    )
    .bind(semana)
    .all<{
      base: string;
      estado: string;
      intentos: number;
      bytes: number | null;
      motivo: string | null;
      actualizado: string;
    }>();
  const dia = iso(ahora).slice(0, 10);
  const correos = await e.db
    .prepare(
      `SELECT tipo, estado, motivo, count(*) AS n FROM correo_del_core INDEXED BY correo_por_dia
        WHERE dia = ? GROUP BY tipo, estado, motivo`,
    )
    .bind(dia)
    .all<{ tipo: string; estado: string; motivo: string | null; n: number }>();
  const usados = correos.results
    .filter((c) => c.estado === 'enviando' || c.estado === 'enviado')
    .reduce((s, c) => s + c.n, 0);
  return {
    copia: {
      semana,
      bases: copia.results.map((b) => ({
        base: b.base,
        estado: b.estado,
        intentos: b.intentos,
        bytes: b.bytes,
        motivo: b.motivo,
        actualizado: b.actualizado,
      })),
    },
    correos: {
      dia,
      cupo: TOPE_DIARIO_DEL_CORE,
      usados,
      por_estado: correos.results.map((c) => ({
        tipo: c.tipo,
        estado: c.estado,
        motivo: c.motivo,
        n: c.n,
      })),
    },
  };
}

const LECTORES: Record<Bloque, (e: Entorno) => Promise<Record<string, unknown>>> = {
  hoy,
  crecio,
  revisar,
  roto,
};

/** Para las pruebas: lee un bloque sin pasar por la entrada. */
export const leerBloque = (e: Entorno, bloque: Bloque) => LECTORES[bloque](e);
