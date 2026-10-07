/**
 * Lo que la caja escribe y lee de su almacén (PARQUEADERO §5.2 a §5.4): los ajustes con su
 * historial, el PIN de administrador y la entrada con su consecutivo. Todo pasa por los esquemas de
 * `@ed1/parqueadero-schema` antes de escribirse (P2): lo que la caja guarda hoy sube mañana igual.
 */

import {
  type Catalogos,
  EnlaceInvalido,
  faltantesDeSede,
  type Lectura,
  leerEnlace,
  nombresDeCampos,
  ORIGEN_DEL_RECIBO,
  ReciboIncompleto,
} from '@ed1/parqueadero-recibos';
import {
  type AjusteRecibo,
  ajusteRecibo,
  type Catalogo,
  type DatosDeEntrada,
  type DatosDeEntrega,
  type Entidad,
  ErrorDeValidacion,
  type MedioDePago,
  NOVEDADES,
  numeroDeRecibo,
  type Registro,
  type Sede,
  sede,
  type Tarifa,
  tarifa,
  VEHICULOS,
  type Vehiculo,
  validarCatalogo,
  validarRegistro,
  type ZodType,
} from '@ed1/parqueadero-schema';
import { type Liquidacion, liquidar, validarTarifa } from '@ed1/parqueadero-tarifas';
import type { BaseDeLaCaja, Estadia } from './datos.ts';
import { diaLocalBogota } from './fecha.ts';

export interface Contexto {
  readonly reloj: () => number;
  /** Un UUIDv7 nuevo (`@ed1/ids`). */
  readonly nuevoId: () => string;
}

const iso = (ms: number) => new Date(ms).toISOString();

/** El id y la serie de esta caja. En M0 la serie es «A» (§5.4). */
export async function dispositivo(
  db: BaseDeLaCaja,
  ctx: Contexto,
): Promise<{ id: string; serie: string }> {
  const meta = await db.meta.get('dispositivo');
  if (meta?.clave === 'dispositivo') return { id: meta.id, serie: meta.serie };
  const nuevo = { clave: 'dispositivo' as const, id: ctx.nuevoId(), serie: 'A' };
  await db.meta.put(nuevo);
  return { id: nuevo.id, serie: nuevo.serie };
}

export interface Ajustes {
  readonly sede: Sede | null;
  readonly tarifas: readonly Tarifa[];
  readonly ajuste: AjusteRecibo | null;
}

export async function leerAjustes(db: BaseDeLaCaja): Promise<Ajustes> {
  const todos = await db.catalogos.toArray();
  return {
    sede: (todos.find((c) => c.entidad === 'sede') as Sede | undefined) ?? null,
    tarifas: todos.filter((c): c is Tarifa => c.entidad === 'tarifa'),
    ajuste: (todos.find((c) => c.entidad === 'ajuste_recibo') as AjusteRecibo | undefined) ?? null,
  };
}

/**
 * Lo que falta para registrar una entrada, como lo lee el cajero: «el NIT», «la tarifa de moto».
 * Vacío = la caja puede hacer recibos (HU-Q3.2 CA2).
 */
export function faltaParaRegistrar(a: Ajustes, vehiculos: readonly Vehiculo[]): string[] {
  const faltan = nombresDeCampos(faltantesDeSede(a.sede));
  for (const v of vehiculos) {
    if (!a.tarifas.some((t) => t.vehiculo === v)) {
      faltan.push(`la tarifa de ${VEHICULOS[v].nombre.toLowerCase()}`);
    }
  }
  return faltan;
}

type SinMeta<T> = Omit<T, 'id' | 'org_id' | 'version' | 'actualizado' | 'entidad'>;

/**
 * Guarda un catálogo con la versión siguiente; la anterior va al historial (ADR-4). Lanza
 * `ErrorDeValidacion` con cada campo si no cumple su esquema: nada se guarda a medias.
 */
async function guardarCatalogo<T extends Catalogo>(
  db: BaseDeLaCaja,
  entidad: Entidad,
  esquema: ZodType<T>,
  datos: object,
  id: string | null,
  ctx: Contexto,
): Promise<T> {
  const anterior = id ? await db.catalogos.get(id) : undefined;
  const ahora = iso(ctx.reloj());
  const nuevo = validarCatalogo(entidad, esquema, {
    ...datos,
    id: anterior?.id ?? ctx.nuevoId(),
    org_id: anterior?.org_id ?? null,
    version: (anterior?.version ?? 0) + 1,
    actualizado: ahora,
    entidad,
  });
  await db.transaction('rw', [db.catalogos, db.historial], async () => {
    if (anterior) {
      const { id: entidadId, version, ...resto } = anterior;
      await db.historial.add({
        id: ctx.nuevoId(),
        entidad,
        entidad_id: entidadId,
        version,
        datos: resto,
        reemplazada: ahora,
        motivo: 'edicion',
      });
    }
    await db.catalogos.put(nuevo);
  });
  return nuevo;
}

export const guardarSede = (db: BaseDeLaCaja, d: SinMeta<Sede>, id: string | null, ctx: Contexto) =>
  guardarCatalogo(db, 'sede', sede, d, id, ctx);

export const guardarAjusteRecibo = (
  db: BaseDeLaCaja,
  d: SinMeta<AjusteRecibo>,
  id: string | null,
  ctx: Contexto,
) => guardarCatalogo(db, 'ajuste_recibo', ajusteRecibo, d, id, ctx);

/** Una tarifa por encima del tope no se guarda (HU-Q1.1 CA3, HU-Q3.2 CA3). */
export class TarifaSobreElTope extends Error {
  readonly problemas: readonly { campo: string; motivo: string }[];
  constructor(problemas: readonly { campo: string; motivo: string }[]) {
    super(problemas.map((p) => p.motivo).join('; '));
    this.name = 'TarifaSobreElTope';
    this.problemas = problemas;
  }
}

export async function guardarTarifa(
  db: BaseDeLaCaja,
  d: SinMeta<Tarifa>,
  id: string | null,
  ctx: Contexto,
): Promise<Tarifa> {
  const problemas = validarTarifa(d, d.tope_minuto);
  if (problemas.length > 0) throw new TarifaSobreElTope(problemas);
  return guardarCatalogo(db, 'tarifa', tarifa, d, id, ctx);
}

// ── PIN de administrador (HU-Q3.2 CA1) ─────────────────────────────────────────────────────────

export const PIN_VALIDO = /^\d{4,6}$/;

const hex = (b: ArrayBuffer | Uint8Array) =>
  Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');

/** PBKDF2 con 100.000 vueltas: un PIN de 4 cifras no se adivina copiando la base del teléfono. */
async function huellaDePin(pin: string, sal: string): Promise<string> {
  const codificar = new TextEncoder();
  const llave = await crypto.subtle.importKey('raw', codificar.encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: codificar.encode(sal), iterations: 100_000 },
    llave,
    256,
  );
  return hex(bits);
}

export async function guardarPin(db: BaseDeLaCaja, pin: string): Promise<void> {
  if (!PIN_VALIDO.test(pin)) throw new RangeError('El PIN es de 4 a 6 números');
  const sal = hex(crypto.getRandomValues(new Uint8Array(16)));
  await db.meta.put({ clave: 'pin', sal, huella: await huellaDePin(pin, sal) });
}

export async function tienePin(db: BaseDeLaCaja): Promise<boolean> {
  return (await db.meta.get('pin')) !== undefined;
}

export async function verificarPin(db: BaseDeLaCaja, pin: string): Promise<boolean> {
  const m = await db.meta.get('pin');
  if (m?.clave !== 'pin') return false;
  return (await huellaDePin(pin, m.sal)) === m.huella;
}

// ── La entrada (HU-Q3.3) ───────────────────────────────────────────────────────────────────────

export interface DatosDeLaEntrada {
  readonly placa: string;
  readonly vehiculo: Vehiculo;
  readonly placaConfirmada: boolean;
  readonly novedades: DatosDeEntrada['novedades'];
  readonly fotos: readonly { readonly tipo: 'image/webp' | 'image/jpeg'; readonly datos: Blob }[];
}

/** La placa ya tiene una estadía abierta: no se crea otra (HU-Q3.3 CA3). */
export class EstadiaYaAbierta extends Error {
  readonly estadia: Estadia;
  constructor(estadia: Estadia) {
    super(`La placa ${estadia.placa} ya está adentro: entró con el recibo ${estadia.numero}`);
    this.name = 'EstadiaYaAbierta';
    this.estadia = estadia;
  }
}

export { NOVEDADES };

/**
 * Registra una entrada: en **una** transacción, el registro, el consecutivo y la estadía abierta,
 * más sus fotos (§5.3 reglas 1 y 2). Si algo falla, nada queda escrito y el número no se gasta
 * (HU-Q3.3 CA4). No espera a la impresora ni a la red.
 */
export async function registrarEntrada(
  db: BaseDeLaCaja,
  d: DatosDeLaEntrada,
  ctx: Contexto,
): Promise<Registro> {
  const { id: dispositivoId, serie } = await dispositivo(db, ctx);
  const ajustes = await leerAjustes(db);
  const faltan = faltaParaRegistrar(ajustes, [d.vehiculo]);
  const tarifaVigente = ajustes.tarifas.find((t) => t.vehiculo === d.vehiculo);
  if (faltan.length > 0 || !tarifaVigente) throw new ReciboIncompleto(faltan);

  return db.transaction('rw', [db.registros, db.estadias, db.meta, db.fotos], async () => {
    const abierta = await db.estadias.where('placa').equals(d.placa).first();
    if (abierta) throw new EstadiaYaAbierta(abierta);
    const meta = await db.meta.get('consecutivo');
    const consecutivo = (meta?.clave === 'consecutivo' ? meta.ultimo : 0) + 1;
    const ahora = ctx.reloj();
    const id = ctx.nuevoId();
    const fotos = d.fotos.map((f) => ({ ...f, id: ctx.nuevoId() }));
    const registro = validarRegistro({
      id,
      org_id: null,
      tipo: 'entrada',
      v: 1,
      fecha_local: diaLocalBogota(ahora),
      instante_evento: iso(ahora),
      autor_usuario_id: null,
      dispositivo_id: dispositivoId,
      origen: 'manual',
      anula_id: null,
      estadia_id: id,
      serie,
      consecutivo,
      datos: {
        placa: d.placa,
        vehiculo: d.vehiculo,
        placa_confirmada: d.placaConfirmada,
        novedades: d.novedades,
        foto_ids: fotos.map((f) => f.id),
        tarifa_id: tarifaVigente.id,
        tarifa_version: tarifaVigente.version,
        abonado_id: null,
      },
    });
    await db.registros.add(registro);
    await db.estadias.add({
      id,
      placa: d.placa,
      vehiculo: d.vehiculo,
      numero: numeroDeRecibo(serie, consecutivo),
      entrada: ahora,
    });
    await db.meta.put({ clave: 'consecutivo', ultimo: consecutivo });
    for (const f of fotos) {
      await db.fotos.add({ id: f.id, estadia_id: id, tipo: f.tipo, datos: f.datos, creada: ahora });
    }
    return registro;
  });
}

export type DatosDeEntregaRecibo = Omit<DatosDeEntrega, 'recibo_id'>;

/**
 * Cómo salió un recibo: queda en los registros, sin número, sin teléfono y sin texto (§7.6,
 * HU-Q3.6 CA2). Devuelve el registro, para poder decir después «No salió» sobre él.
 */
export async function registrarEntrega(
  db: BaseDeLaCaja,
  recibo: Registro,
  entrega: DatosDeEntregaRecibo,
  ctx: Contexto,
): Promise<Registro> {
  const ahora = ctx.reloj();
  const registro = validarRegistro({
    id: ctx.nuevoId(),
    org_id: null,
    tipo: 'entrega_recibo',
    v: 1,
    fecha_local: diaLocalBogota(ahora),
    instante_evento: iso(ahora),
    autor_usuario_id: null,
    dispositivo_id: recibo.dispositivo_id,
    origen: 'manual',
    anula_id: null,
    estadia_id: recibo.estadia_id,
    serie: null,
    consecutivo: null,
    datos: { recibo_id: recibo.id, ...entrega },
  });
  await db.registros.add(registro);
  return registro;
}

/** Las entregas de un recibo, en orden. */
export const entregasDe = (db: BaseDeLaCaja, recibo: Registro): Promise<Registro[]> =>
  db.registros
    .where('estadia_id')
    .equals(recibo.estadia_id ?? recibo.id)
    .filter(
      (r) => r.tipo === 'entrega_recibo' && (r.datos as DatosDeEntrega).recibo_id === recibo.id,
    )
    .sortBy('instante_evento');

/**
 * Los catálogos con que se hizo un registro: la sede y el pie de hoy, y la tarifa en la versión que
 * dice el registro, del historial si ya cambió (ADR-4). Un recibo reimpreso cobra lo de su día.
 */
export async function catalogosDelRegistro(db: BaseDeLaCaja, r: Registro): Promise<Catalogos> {
  const hoy = await leerAjustes(db);
  const base = { sede: hoy.sede, ajuste: hoy.ajuste };
  const d = r.datos as Partial<DatosDeEntrada>;
  if (!d.tarifa_id) return { ...base, tarifa: null };
  const vigente = (await db.catalogos.get(d.tarifa_id)) as Tarifa | undefined;
  if (vigente && vigente.version === d.tarifa_version) return { ...base, tarifa: vigente };
  const vieja = await db.historial
    .where('entidad_id')
    .equals(d.tarifa_id)
    .filter((h) => h.version === d.tarifa_version)
    .first();
  const tarifaVieja = vieja
    ? ({ ...(vieja.datos as object), id: vieja.entidad_id, version: vieja.version } as Tarifa)
    : null;
  return { ...base, tarifa: tarifaVieja };
}

/**
 * Cuántas veces salió ya un recibo en papel: la siguiente es «COPIA n» (§7.6). Un «No salió»
 * descuenta el envío que falló: la reimpresión es el original, sin marca de copia.
 */
export async function vecesImpreso(db: BaseDeLaCaja, recibo: Registro): Promise<number> {
  let veces = 0;
  for (const r of await entregasDe(db, recibo)) {
    const d = r.datos as DatosDeEntrega;
    if (d.canal !== 'papel') continue;
    veces += d.resultado === 'fallido' ? -1 : 1;
  }
  return Math.max(0, veces);
}

// ── Estadías abiertas y salida (HU-Q3.4, HU-Q3.5) ──────────────────────────────────────────────

/** Las estadías abiertas, de la más vieja a la más nueva (UUIDv7 ordena por instante). */
export const estadiasAbiertas = (db: BaseDeLaCaja): Promise<Estadia[]> =>
  db.estadias.orderBy('id').toArray();

/**
 * Rehace `estadias` desde `registros`, que es la verdad (HU-Q3.4 CA3): una entrada sigue abierta
 * mientras no tenga una salida vigente ni esté anulada. Una salida anulada la reabre.
 */
export async function reconstruirEstadias(db: BaseDeLaCaja): Promise<number> {
  return db.transaction('rw', [db.registros, db.estadias], async () => {
    const todos = await db.registros.toArray();
    const anulados = new Set(
      todos.filter((r) => r.tipo === 'anulacion').map((r) => r.anula_id ?? ''),
    );
    const cerradas = new Set(
      todos
        .filter((r) => r.tipo === 'salida' && !anulados.has(r.id))
        .map((r) => r.estadia_id ?? ''),
    );
    const abiertas: Estadia[] = [];
    for (const r of todos) {
      if (r.tipo !== 'entrada' || anulados.has(r.id) || cerradas.has(r.id)) continue;
      if (r.serie === null || r.consecutivo === null) continue;
      const d = r.datos as DatosDeEntrada;
      abiertas.push({
        id: r.id,
        placa: d.placa,
        vehiculo: d.vehiculo,
        numero: numeroDeRecibo(r.serie, r.consecutivo),
        entrada: Date.parse(r.instante_evento),
      });
    }
    await db.estadias.clear();
    await db.estadias.bulkAdd(abiertas);
    return abiertas.length;
  });
}

/** La estadía ya salió o no existe: no se cobra dos veces. */
export class EstadiaCerrada extends Error {
  constructor() {
    super('Esta estadía ya no está abierta: puede que ya haya salido');
    this.name = 'EstadiaCerrada';
  }
}

export interface Cotizacion {
  readonly estadia: Estadia;
  readonly entrada: Registro;
  readonly tarifa: Tarifa;
  readonly liquidacion: Liquidacion;
  readonly salida: number;
}

/** Lo que se cobraría si saliera en `salida`, con la tarifa con que entró (§9). */
export async function cotizar(
  db: BaseDeLaCaja,
  estadiaId: string,
  salida: number,
  perdido: boolean,
): Promise<Cotizacion> {
  const estadia = await db.estadias.get(estadiaId);
  const entrada = await db.registros.get(estadiaId);
  if (!estadia || !entrada) throw new EstadiaCerrada();
  const t = (await catalogosDelRegistro(db, entrada)).tarifa;
  if (!t) throw new ReciboIncompleto(['la tarifa']);
  const liquidacion = liquidar(estadia.entrada, salida, t, t.tope_minuto, null, perdido);
  return { estadia, entrada, tarifa: t, liquidacion, salida };
}

export interface DatosDelCobro {
  readonly perdido: boolean;
  readonly medio: Exclude<MedioDePago, 'abonado'>;
  /** Solo en efectivo. */
  readonly recibido: number | null;
  /** Solo en cortesía. */
  readonly motivoCortesia: string | null;
}

/** El total que vio el cajero tiene más de 10 minutos: se vuelve a liquidar antes de cobrar. */
export class CotizacionVencida extends Error {
  constructor() {
    super('El total cambió: pasaron más de 10 minutos desde que se calculó');
    this.name = 'CotizacionVencida';
  }
}

/**
 * Cobra y cierra: en una transacción, la salida con su consecutivo y la estadía cerrada (§5.3).
 * Se liquida con el instante de la cotización que vio el cajero (`instante`), para que lo cobrado
 * sea lo que se mostró; si tiene más de 10 minutos, lanza `CotizacionVencida`. Lanza
 * `ErrorDeValidacion` si el efectivo no alcanza o la cortesía no dice por qué (HU-Q3.5 CA4).
 */
export async function registrarSalida(
  db: BaseDeLaCaja,
  estadiaId: string,
  c: DatosDelCobro,
  ctx: Contexto,
  instante?: number,
): Promise<Registro> {
  const { id: dispositivoId, serie } = await dispositivo(db, ctx);
  const reloj = ctx.reloj();
  const ahora = instante ?? reloj;
  if (ahora > reloj || reloj - ahora > 10 * 60_000) throw new CotizacionVencida();
  const q = await cotizar(db, estadiaId, ahora, c.perdido);
  const liq = q.liquidacion;
  const efectivo = c.medio === 'efectivo';
  if (efectivo && (c.recibido === null || c.recibido < liq.total)) {
    throw new ErrorDeValidacion('salida', [
      { campo: 'recibido', motivo: `es menos que el total (${liq.total})` },
    ]);
  }
  return db.transaction('rw', [db.registros, db.estadias, db.meta], async () => {
    if (!(await db.estadias.get(estadiaId))) throw new EstadiaCerrada();
    const meta = await db.meta.get('consecutivo');
    const consecutivo = (meta?.clave === 'consecutivo' ? meta.ultimo : 0) + 1;
    const recibido = efectivo ? c.recibido : null;
    const registro = validarRegistro({
      id: ctx.nuevoId(),
      org_id: null,
      tipo: 'salida',
      v: 1,
      fecha_local: diaLocalBogota(ahora),
      instante_evento: iso(ahora),
      autor_usuario_id: null,
      dispositivo_id: dispositivoId,
      origen: 'manual',
      anula_id: null,
      estadia_id: estadiaId,
      serie,
      consecutivo,
      datos: {
        entrada_numero: q.estadia.numero,
        placa: q.estadia.placa,
        vehiculo: q.estadia.vehiculo,
        instante_entrada: iso(q.estadia.entrada),
        minutos: liq.minutos,
        lineas: liq.lineas,
        subtotal: liq.subtotal,
        redondeo: liq.redondeo,
        total: liq.total,
        medio_pago: c.medio,
        recibido,
        cambio: recibido === null ? null : recibido - liq.total,
        motivo_cortesia: c.medio === 'cortesia' ? (c.motivoCortesia?.trim() ?? '') : null,
        perdido: c.perdido,
        tarifa_id: q.tarifa.id,
        tarifa_version: q.tarifa.version,
      },
    });
    await db.registros.add(registro);
    await db.estadias.delete(estadiaId);
    await db.meta.put({ clave: 'consecutivo', ultimo: consecutivo });
    return registro;
  });
}

export type Hallazgo =
  | { readonly encontrada: true; readonly estadiaId: string }
  | { readonly encontrada: false; readonly motivo: string };

/**
 * Lo que dice un QR escaneado: la estadía abierta que abre, o por qué no abre ninguna (HU-Q3.4
 * CA2 y CA3). Sirven la forma corta del papel y la completa del teléfono del conductor; un QR de
 * otro parqueadero o de una estadía cerrada dice qué es y no abre una salida.
 */
export async function buscarPorLectura(db: BaseDeLaCaja, texto: string): Promise<Hallazgo> {
  const no = (motivo: string): Hallazgo => ({ encontrada: false, motivo });
  if (!texto.startsWith(ORIGEN_DEL_RECIBO)) return no('Este QR no es un recibo del parqueadero.');
  let lectura: Lectura;
  try {
    lectura = await leerEnlace(texto);
  } catch (e) {
    if (e instanceof EnlaceInvalido) return no('No se pudo leer este recibo: el QR está dañado.');
    throw e;
  }
  const r =
    lectura.forma === 'corta'
      ? lectura
      : {
          numero: lectura.recibo.salida?.entradaNumero ?? lectura.recibo.numero,
          placa: lectura.recibo.placa,
          entrada: lectura.recibo.entrada,
        };
  const abierta = await db.estadias
    .where('placa')
    .equals(r.placa)
    .filter((e) => e.numero === r.numero && Math.floor(e.entrada / 1000) * 1000 === r.entrada)
    .first();
  if (abierta) return { encontrada: true, estadiaId: abierta.id };
  const deEstaCaja = await db.registros
    .where('instante_evento')
    // El enlace lleva segundos enteros; el registro, milisegundos.
    .between(iso(r.entrada), iso(r.entrada + 999), true, true)
    .filter((x) => x.tipo === 'entrada' && (x.datos as DatosDeEntrada).placa === r.placa)
    .count();
  return no(
    deEstaCaja > 0 || (lectura.forma === 'completa' && lectura.recibo.clase === 'salida')
      ? `La estadía de ${r.placa} (recibo ${r.numero}) ya salió.`
      : `El recibo ${r.numero} de ${r.placa} no es de esta caja: puede ser de otro parqueadero.`,
  );
}
