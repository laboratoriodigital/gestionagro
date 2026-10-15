/**
 * HU-T10.1: envíos y cupones desde el panel (TIENDA-3.0 §5.3 y §6), con las mismas reglas del
 * catálogo: cada escritura lleva su `version` y su `op`, deja su fila en el registro y borrar manda a
 * la papelera de 30 días.
 *
 * - **Envíos.** Precio, «gratis desde», ciudades (ninguna: todas) y días. El plazo es obligatorio
 *   (Ley 1480 art. 50 lit. b); si pasa de 30 días calendario, la tienda lo dice con sus palabras
 *   (`plazoDelEnvio`, Ley 2439) y la compuerta lo revisa al publicar.
 * - **Cupones.** Por porcentaje, valor o envío gratis, con mínimo, vigencia y usos. Los usos los
 *   cuenta la base (`0003_usos_del_cupon.sql`): suben cuando el pedido se confirma o se paga y bajan
 *   si se cancela. Aquí no se escriben nunca, y el tope no puede quedar por debajo de lo ya usado.
 * - La vigencia llega como fechas de Colombia (`AAAA-MM-DD`) y se guarda como instantes: desde el
 *   comienzo del primer día hasta el final del último, que es como la compara `cotizar`.
 */
import type { SentenciaD1 } from '@ed1/d1';
import { PLAZO_DE_LEY_DIAS, plazoDelEnvio } from '@ed1/tienda-horno';
import { z } from 'zod';
import {
  esCambiado,
  esOperacionRepetida,
  guardarOperacion,
  MOTIVO_CAMBIADO,
  type Quien,
  type Resultado,
  SI_CAMBIO,
  yaAplicada,
} from './catalogo.ts';
import { anotar } from './registro.ts';

type Problema = { campo: string; mensaje: string };
const problemasDe = (r: z.ZodSafeParseResult<unknown>): Problema[] =>
  r.success
    ? []
    : r.error.issues.map((i) => ({ campo: i.path.map(String).join('.'), mensaje: i.message }));
const MOTIVO_NO_EXISTE = 'Eso ya no está: puede que lo hayan borrado.';

const Op = z.string().min(8).max(64);
const Version = z.number().int().min(1);
const Pesos = z
  .number({ error: 'escribe el valor en pesos, sin puntos' })
  .int({ error: 'escribe el valor en pesos, sin puntos' })
  .min(0, { error: 'no puede ser negativo' })
  .max(100_000_000, { error: 'revisa el valor: es demasiado alto' });
const Dias = z
  .number({ error: 'escribe los días en números' })
  .int({ error: 'escribe los días en números' })
  .min(0, { error: 'no puede ser negativo' })
  .max(365, { error: 'revisa los días: es más de un año' });
const Fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'escribe la fecha completa' });

/** Colombia no cambia de hora: UTC−5 todo el año. */
const BOGOTA_MS = 5 * 3_600_000;
const inicioDelDia = (fecha: string) => new Date(Date.parse(`${fecha}T00:00:00Z`) + BOGOTA_MS);
const comienzo = (fecha: string) => inicioDelDia(fecha).toISOString();
const fin = (fecha: string) =>
  new Date(inicioDelDia(fecha).getTime() + 86_400_000 - 1).toISOString();
const fechaDe = (instante: string | null) =>
  instante === null ? null : new Date(Date.parse(instante) - BOGOTA_MS).toISOString().slice(0, 10);

function aplicar(
  q: Quien,
  op: string,
  lote: SentenciaD1[],
  r: Resultado,
  versionActual: () => Promise<number | null>,
  traducir: (e: unknown) => Resultado | null = () => null,
): Promise<Resultado> {
  return q.db.batch(lote).then(
    () => r,
    async (e: unknown) => {
      if (esCambiado(e))
        return { estado: 'cambiado', motivo: MOTIVO_CAMBIADO, version: await versionActual() };
      if (esOperacionRepetida(e)) return (await yaAplicada(q, op)) ?? r;
      const dicho = traducir(e);
      if (dicho) return dicho;
      throw e;
    },
  );
}

// ── Envíos ─────────────────────────────────────────────────────────────────────────────────

interface FilaDeEnvio {
  id: string;
  nombre: string;
  precio_cop: number;
  gratis_desde_cop: number | null;
  ciudades: string | null;
  dias_min: number | null;
  dias_max: number | null;
  activa: number;
  version: number;
}

export interface Envio {
  id: string;
  nombre: string;
  precioCop: number;
  gratisDesdeCop: number | null;
  /** `null`: todas las ciudades. */
  ciudades: string[] | null;
  diasMin: number | null;
  diasMax: number | null;
  activa: boolean;
  version: number;
  /** El plazo con las palabras que verá el comprador (CA1: más de 30 días lo dice). */
  plazo: string;
}

const envioDe = (e: FilaDeEnvio): Envio => ({
  id: e.id,
  nombre: e.nombre,
  precioCop: e.precio_cop,
  gratisDesdeCop: e.gratis_desde_cop,
  ciudades: e.ciudades === null ? null : (JSON.parse(e.ciudades) as string[]),
  diasMin: e.dias_min,
  diasMax: e.dias_max,
  activa: e.activa === 1,
  version: e.version,
  plazo: plazoDelEnvio(e.dias_min, e.dias_max),
});

const GuardarEnvio = z.object({
  op: Op,
  id: z.string().min(1).max(40).optional(),
  version: Version.optional(),
  nombre: z
    .string()
    .trim()
    .min(1, { error: 'falta el nombre, por ejemplo «Medellín» o «Nacional»' })
    .max(60, { error: 'máximo 60 letras' }),
  precioCop: Pesos,
  gratisDesdeCop: Pesos.min(1, { error: 'escribe desde cuánto es gratis, o déjalo vacío' })
    .nullable()
    .default(null),
  ciudades: z
    .array(z.string().trim().max(60, { error: 'máximo 60 letras por ciudad' }))
    .max(200, { error: 'máximo 200 ciudades' })
    .nullable()
    .default(null),
  diasMin: Dias.nullable().default(null),
  diasMax: Dias.nullable().default(null),
  activa: z.boolean().default(true),
});

/** Las ciudades sin repetir; ninguna es todas. */
const ciudadesDe = (c: string[] | null) => {
  const unicas = [...new Set((c ?? []).filter((x) => x !== ''))];
  return unicas.length > 0 ? unicas : null;
};

export async function listarVenta(q: Quien): Promise<{ envios: Envio[]; cupones: Cupon[] }> {
  const [envios, cupones] = await Promise.all([
    q.db
      .prepare(
        `SELECT id, nombre, precio_cop, gratis_desde_cop, ciudades, dias_min, dias_max, activa, version
           FROM envio_opcion WHERE org_id = ? AND borrado IS NULL ORDER BY posicion, nombre`,
      )
      .bind(q.org)
      .all<FilaDeEnvio>(),
    q.db
      .prepare(
        `SELECT codigo, tipo, valor, minimo_cop, desde, hasta, usos_maximos, usos, activo, version
           FROM cupon WHERE org_id = ? AND borrado IS NULL ORDER BY codigo`,
      )
      .bind(q.org)
      .all<FilaDeCupon>(),
  ]);
  return { envios: envios.results.map(envioDe), cupones: cupones.results.map(cuponDe) };
}

const leerEnvio = (q: Quien, id: string) =>
  q.db
    .prepare(
      `SELECT id, nombre, precio_cop, gratis_desde_cop, ciudades, dias_min, dias_max, activa, version
         FROM envio_opcion WHERE org_id = ? AND id = ? AND borrado IS NULL`,
    )
    .bind(q.org, id)
    .first<FilaDeEnvio>();

const versionDelEnvio = (q: Quien, id: string) => async () =>
  (await leerEnvio(q, id))?.version ?? null;

export async function guardarEnvio(q: Quien, cuerpo: unknown): Promise<Resultado> {
  const r0 = GuardarEnvio.safeParse(cuerpo);
  if (!r0.success) return { estado: 'problemas', problemas: problemasDe(r0) };
  const d = r0.data;
  const previa = await yaAplicada(q, d.op);
  if (previa) return previa;
  const problemas: Problema[] = [];
  if (d.diasMax === null)
    problemas.push({
      campo: 'diasMax',
      mensaje: 'di en cuántos días llega, como máximo: el comprador lo ve antes de pedir',
    });
  if (d.diasMin !== null && d.diasMax !== null && d.diasMin > d.diasMax)
    problemas.push({ campo: 'diasMin', mensaje: 'los días mínimos pasan de los máximos' });
  if (d.id && d.version === undefined)
    problemas.push({ campo: 'version', mensaje: 'falta la versión que leíste' });
  if (problemas.length > 0) return { estado: 'problemas', problemas };

  const actual = d.id ? await leerEnvio(q, d.id) : null;
  if (d.id && !actual) return { estado: 'no-existe', motivo: MOTIVO_NO_EXISTE };
  if (actual && actual.version !== d.version)
    return { estado: 'cambiado', motivo: MOTIVO_CAMBIADO, version: actual.version };

  const id = actual?.id ?? `e-${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;
  const ciudades = ciudadesDe(d.ciudades);
  const valores = [
    d.nombre,
    d.precioCop,
    d.gratisDesdeCop,
    ciudades === null ? null : JSON.stringify(ciudades),
    d.diasMin,
    d.diasMax,
    d.activa ? 1 : 0,
  ] as const;
  const r: Resultado = { estado: 'guardado', id, version: (actual?.version ?? 0) + 1 };
  const lote: SentenciaD1[] = actual
    ? [
        q.db
          .prepare(
            `UPDATE envio_opcion SET nombre = ?, precio_cop = ?, gratis_desde_cop = ?, ciudades = ?, dias_min = ?,
               dias_max = ?, activa = ?, version = version + 1
             WHERE org_id = ? AND id = ? AND version = ? AND borrado IS NULL`,
          )
          .bind(...valores, q.org, id, actual.version),
        q.db.prepare(SI_CAMBIO),
      ]
    : [
        q.db
          .prepare(
            `INSERT INTO envio_opcion (org_id, id, nombre, precio_cop, gratis_desde_cop, ciudades, dias_min, dias_max,
               activa, posicion)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT coalesce(max(posicion), -1) + 1 FROM envio_opcion WHERE org_id = ?))`,
          )
          .bind(q.org, id, ...valores, q.org),
      ];
  lote.push(
    await anotar(q.db, {
      org: q.org,
      actor: q.actor,
      accion: actual ? 'envio.editar' : 'envio.crear',
      entidad: 'envio_opcion',
      entidadId: id,
      antes: actual ? envioParaElRegistro(envioDe(actual)) : null,
      despues: envioParaElRegistro({
        nombre: d.nombre,
        precioCop: d.precioCop,
        gratisDesdeCop: d.gratisDesdeCop,
        ciudades,
        diasMin: d.diasMin,
        diasMax: d.diasMax,
        activa: d.activa,
      }),
      instante: q.instante,
    }),
    guardarOperacion(q, d.op, 'envios/guardar', r),
  );
  return aplicar(q, d.op, lote, r, versionDelEnvio(q, id));
}

const envioParaElRegistro = (e: Omit<Envio, 'id' | 'version' | 'plazo'>) => ({
  nombre: e.nombre,
  precioCop: e.precioCop,
  gratisDesdeCop: e.gratisDesdeCop,
  ciudades: e.ciudades,
  diasMin: e.diasMin,
  diasMax: e.diasMax,
  activa: e.activa,
  masDeLaLey: Math.max(e.diasMin ?? 0, e.diasMax ?? 0) > PLAZO_DE_LEY_DIAS,
});

const BorrarEnvio = z.object({ op: Op, id: z.string().min(1).max(40), version: Version });

export async function borrarEnvio(q: Quien, cuerpo: unknown): Promise<Resultado> {
  const r0 = BorrarEnvio.safeParse(cuerpo);
  if (!r0.success) return { estado: 'problemas', problemas: problemasDe(r0) };
  const d = r0.data;
  const previa = await yaAplicada(q, d.op);
  if (previa) return previa;
  const actual = await leerEnvio(q, d.id);
  if (!actual) return { estado: 'no-existe', motivo: MOTIVO_NO_EXISTE };
  if (actual.version !== d.version)
    return { estado: 'cambiado', motivo: MOTIVO_CAMBIADO, version: actual.version };
  const r: Resultado = { estado: 'guardado', id: d.id, version: actual.version + 1 };
  return aplicar(
    q,
    d.op,
    [
      q.db
        .prepare(
          'UPDATE envio_opcion SET borrado = ?, version = version + 1 WHERE org_id = ? AND id = ? AND version = ? AND borrado IS NULL',
        )
        .bind(q.instante, q.org, d.id, actual.version),
      q.db.prepare(SI_CAMBIO),
      await anotar(q.db, {
        org: q.org,
        actor: q.actor,
        accion: 'envio.borrar',
        entidad: 'envio_opcion',
        entidadId: d.id,
        antes: { nombre: actual.nombre },
        despues: null,
        instante: q.instante,
      }),
      guardarOperacion(q, d.op, 'envios/borrar', r),
    ],
    r,
    versionDelEnvio(q, d.id),
  );
}

// ── Cupones ────────────────────────────────────────────────────────────────────────────────

export const TIPOS_DE_CUPON = ['porcentaje', 'valor', 'envio_gratis'] as const;
type TipoDeCupon = (typeof TIPOS_DE_CUPON)[number];

interface FilaDeCupon {
  codigo: string;
  tipo: TipoDeCupon;
  valor: number;
  minimo_cop: number;
  desde: string | null;
  hasta: string | null;
  usos_maximos: number | null;
  usos: number;
  activo: number;
  version: number;
}

export interface Cupon {
  codigo: string;
  tipo: TipoDeCupon;
  /** Porcentaje de 1 a 100, pesos, o 0 si es envío gratis. */
  valor: number;
  minimoCop: number;
  /** Fechas de Colombia, `AAAA-MM-DD`. */
  desde: string | null;
  hasta: string | null;
  usosMaximos: number | null;
  /** Pedidos confirmados o pagados con el cupón; los cancelados no cuentan. */
  usos: number;
  activo: boolean;
  version: number;
}

const cuponDe = (c: FilaDeCupon): Cupon => ({
  codigo: c.codigo,
  tipo: c.tipo,
  valor: c.valor,
  minimoCop: c.minimo_cop,
  desde: fechaDe(c.desde),
  hasta: fechaDe(c.hasta),
  usosMaximos: c.usos_maximos,
  usos: c.usos,
  activo: c.activo === 1,
  version: c.version,
});

const Codigo = z
  .string()
  .trim()
  .toUpperCase()
  .min(3, { error: 'el código va de 3 a 24 letras o números' })
  .max(24, { error: 'el código va de 3 a 24 letras o números' })
  .regex(/^[A-Z0-9-]+$/, { error: 'solo letras sin tilde, números y guiones, sin espacios' });

const GuardarCupon = z.object({
  op: Op,
  codigo: Codigo,
  /** Sin versión es un cupón nuevo. */
  version: Version.optional(),
  tipo: z.enum(TIPOS_DE_CUPON, { error: 'elige si descuenta un porcentaje, un valor o el envío' }),
  valor: Pesos.default(0),
  minimoCop: Pesos.default(0),
  desde: Fecha.nullable().default(null),
  hasta: Fecha.nullable().default(null),
  usosMaximos: z
    .number({ error: 'escribe cuántos usos en números' })
    .int({ error: 'escribe cuántos usos en números' })
    .min(1, { error: 'al menos 1 uso, o déjalo vacío para que no tenga tope' })
    .max(1_000_000, { error: 'revisa los usos: son demasiados' })
    .nullable()
    .default(null),
  activo: z.boolean().default(true),
});

const leerCupon = (q: Quien, codigo: string) =>
  q.db
    .prepare(
      `SELECT codigo, tipo, valor, minimo_cop, desde, hasta, usos_maximos, usos, activo, version, borrado
         FROM cupon WHERE org_id = ? AND codigo = ?`,
    )
    .bind(q.org, codigo)
    .first<FilaDeCupon & { borrado: string | null }>();

const versionDelCupon = (q: Quien, codigo: string) => async () =>
  (await leerCupon(q, codigo))?.version ?? null;

export async function guardarCupon(q: Quien, cuerpo: unknown): Promise<Resultado> {
  const r0 = GuardarCupon.safeParse(cuerpo);
  if (!r0.success) return { estado: 'problemas', problemas: problemasDe(r0) };
  const d = r0.data;
  const previa = await yaAplicada(q, d.op);
  if (previa) return previa;
  const problemas: Problema[] = [];
  if (d.tipo === 'porcentaje' && (d.valor < 1 || d.valor > 100))
    problemas.push({ campo: 'valor', mensaje: 'un porcentaje va de 1 a 100' });
  if (d.tipo === 'valor' && d.valor < 1)
    problemas.push({ campo: 'valor', mensaje: 'escribe cuánto descuenta, en pesos' });
  if (d.desde !== null && d.hasta !== null && d.desde > d.hasta)
    problemas.push({ campo: 'hasta', mensaje: 'la vigencia termina antes de empezar' });

  const fila = await leerCupon(q, d.codigo);
  const actual = fila && fila.borrado === null ? fila : null;
  if (d.version === undefined && actual)
    problemas.push({
      campo: 'codigo',
      mensaje: `ya tienes un cupón ${d.codigo}: elige otro código`,
    });
  if (d.version !== undefined && !actual) return { estado: 'no-existe', motivo: MOTIVO_NO_EXISTE };
  if (actual && d.version !== undefined && actual.version !== d.version)
    return { estado: 'cambiado', motivo: MOTIVO_CAMBIADO, version: actual.version };
  // CA2: el tope no baja de lo que ya se usó (la base tampoco lo dejaría).
  const usados = fila?.usos ?? 0;
  if (d.usosMaximos !== null && d.usosMaximos < usados)
    problemas.push({
      campo: 'usosMaximos',
      mensaje: `ya se usó ${usados === 1 ? '1 vez' : `${usados} veces`}: el tope no puede ser menor`,
    });
  if (problemas.length > 0) return { estado: 'problemas', problemas };

  const valores = [
    d.tipo,
    d.tipo === 'envio_gratis' ? 0 : d.valor,
    d.minimoCop,
    d.desde === null ? null : comienzo(d.desde),
    d.hasta === null ? null : fin(d.hasta),
    d.usosMaximos,
    d.activo ? 1 : 0,
  ] as const;
  const r: Resultado = { estado: 'guardado', id: d.codigo, version: (fila?.version ?? 0) + 1 };
  // Uno en la papelera con el mismo código vuelve con lo nuevo y conserva sus usos: ya pasaron.
  const lote: SentenciaD1[] = fila
    ? [
        q.db
          .prepare(
            `UPDATE cupon SET tipo = ?, valor = ?, minimo_cop = ?, desde = ?, hasta = ?, usos_maximos = ?, activo = ?,
               borrado = NULL, version = version + 1
             WHERE org_id = ? AND codigo = ? AND version = ?`,
          )
          .bind(...valores, q.org, d.codigo, fila.version),
        q.db.prepare(SI_CAMBIO),
      ]
    : [
        q.db
          .prepare(
            `INSERT INTO cupon (org_id, codigo, tipo, valor, minimo_cop, desde, hasta, usos_maximos, activo)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(q.org, d.codigo, ...valores),
      ];
  lote.push(
    await anotar(q.db, {
      org: q.org,
      actor: q.actor,
      accion: actual ? 'cupon.editar' : 'cupon.crear',
      entidad: 'cupon',
      entidadId: d.codigo,
      antes: actual ? cuponParaElRegistro(cuponDe(actual)) : null,
      despues: cuponParaElRegistro({
        codigo: d.codigo,
        tipo: d.tipo,
        valor: valores[1],
        minimoCop: d.minimoCop,
        desde: d.desde,
        hasta: d.hasta,
        usosMaximos: d.usosMaximos,
        activo: d.activo,
      }),
      instante: q.instante,
    }),
    guardarOperacion(q, d.op, 'cupones/guardar', r),
  );
  return aplicar(q, d.op, lote, r, versionDelCupon(q, d.codigo), (e) =>
    // Otro creó el mismo código entre la lectura y el lote.
    /UNIQUE constraint failed: cupon\./i.test(String(e))
      ? {
          estado: 'problemas',
          problemas: [
            { campo: 'codigo', mensaje: `ya tienes un cupón ${d.codigo}: elige otro código` },
          ],
        }
      : // Un pedido gastó un uso entre la lectura y el lote y el tope quedó por debajo.
        /CHECK constraint failed/i.test(String(e))
        ? {
            estado: 'problemas',
            problemas: [
              { campo: 'usosMaximos', mensaje: 'el tope no puede ser menor que los usos' },
            ],
          }
        : null,
  );
}

const cuponParaElRegistro = (c: Omit<Cupon, 'usos' | 'version'>) => ({
  nombre: c.codigo,
  tipo: c.tipo,
  valor: c.valor,
  minimoCop: c.minimoCop,
  desde: c.desde,
  hasta: c.hasta,
  usosMaximos: c.usosMaximos,
  activo: c.activo,
});

const BorrarCupon = z.object({ op: Op, codigo: Codigo, version: Version });

export async function borrarCupon(q: Quien, cuerpo: unknown): Promise<Resultado> {
  const r0 = BorrarCupon.safeParse(cuerpo);
  if (!r0.success) return { estado: 'problemas', problemas: problemasDe(r0) };
  const d = r0.data;
  const previa = await yaAplicada(q, d.op);
  if (previa) return previa;
  const actual = await leerCupon(q, d.codigo);
  if (!actual || actual.borrado !== null) return { estado: 'no-existe', motivo: MOTIVO_NO_EXISTE };
  if (actual.version !== d.version)
    return { estado: 'cambiado', motivo: MOTIVO_CAMBIADO, version: actual.version };
  const r: Resultado = { estado: 'guardado', id: d.codigo, version: actual.version + 1 };
  return aplicar(
    q,
    d.op,
    [
      q.db
        .prepare(
          'UPDATE cupon SET borrado = ?, version = version + 1 WHERE org_id = ? AND codigo = ? AND version = ? AND borrado IS NULL',
        )
        .bind(q.instante, q.org, d.codigo, actual.version),
      q.db.prepare(SI_CAMBIO),
      await anotar(q.db, {
        org: q.org,
        actor: q.actor,
        accion: 'cupon.borrar',
        entidad: 'cupon',
        entidadId: d.codigo,
        antes: { nombre: d.codigo, usos: actual.usos },
        despues: null,
        instante: q.instante,
      }),
      guardarOperacion(q, d.op, 'cupones/borrar', r),
    ],
    r,
    versionDelCupon(q, d.codigo),
  );
}
