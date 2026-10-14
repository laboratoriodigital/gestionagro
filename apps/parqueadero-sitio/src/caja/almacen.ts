/**
 * Lo que la caja escribe y lee de su almacén (PARQUEADERO §5.2 a §5.4): los ajustes con su
 * historial, el PIN de administrador y la entrada con su consecutivo. Todo pasa por los esquemas de
 * `@ed1/parqueadero-schema` antes de escribirse (P2): lo que la caja guarda hoy sube mañana igual.
 */

import { formatearPesos } from '@ed1/dinero';
import {
  type Catalogos,
  EnlaceInvalido,
  faltantesDeSede,
  type Lectura,
  leerEnlace,
  nombresDeCampos,
  ORIGEN_DEL_RECIBO,
  ReciboIncompleto,
  type ResumenDeTurno,
  resumirTurno,
} from '@ed1/parqueadero-recibos';
import {
  type Abonado,
  type AjusteRecibo,
  abonado,
  ajusteRecibo,
  armarExport,
  type Catalogo,
  csvDeRegistros,
  type DatosDeEntrada,
  type DatosDeEntrega,
  type DatosDeMovimiento,
  type DatosDePagoAbonado,
  type DatosDeSalida,
  type Entidad,
  ErrorDeValidacion,
  type MedioDePago,
  NOVEDADES,
  numeroDeRecibo,
  type ParqueaderoExportV1,
  type Registro,
  type Sede,
  sede,
  type Tarifa,
  tarifa,
  VEHICULOS,
  type Vehiculo,
  validarCatalogo,
  validarRegistro,
  verificarExport,
  type ZodType,
} from '@ed1/parqueadero-schema';
import { type Liquidacion, liquidar, validarTarifa } from '@ed1/parqueadero-tarifas';
import { normalizarNumero } from '@ed1/whatsapp';
import { abonoDeLaPlaca, conPagos, fechaDelAbono, pagadoHastaDe, venceEl } from './abonados.ts';
import { encolar, tablasDeLaCola } from './cola.ts';
import type { BaseDeLaCaja, Contacto, Estadia } from './datos.ts';
import { diaLocalBogota, horaBogota } from './fecha.ts';
import { eventoDeLaEntrega, medir } from './medicion.ts';
import { quitarPendientesDe } from './pendientes.ts';
import { avisoAceptado, VERSION_DEL_AVISO } from './privacidad.ts';
import { topeDeLaCiudad } from './topes.ts';
import {
  exigirOperacion,
  exigirTurno,
  SinTurno,
  type Turno,
  turnoAbierto,
  usaTurnos,
} from './turno.ts';

export { SinTurno, type Turno, turnoAbierto };

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
  await db.transaction('rw', [db.catalogos, db.historial, ...tablasDeLaCola(db)], async () => {
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
    await encolar(db, [nuevo], ctx.reloj());
  });
  return nuevo;
}

export async function guardarSede(
  db: BaseDeLaCaja,
  d: SinMeta<Sede>,
  id: string | null,
  ctx: Contexto,
) {
  if (d.usa_turnos === false && (await turnoAbierto(db))) {
    throw new RangeError('Cierre el turno abierto antes de cambiar a una operación sin turnos.');
  }
  return guardarCatalogo(db, 'sede', sede, d, id, ctx);
}

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
  // HU-Q1.2 CA2: con tope en la ciudad, la tarifa lo declara y no lo pasa.
  const legal = topeDeLaCiudad((await leerAjustes(db)).sede?.ciudad, d.vehiculo);
  if (legal && (d.tope_minuto === null || d.tope_minuto > legal.porMinuto)) {
    problemas.push({
      campo: 'tope_minuto',
      motivo: `en ${legal.ciudad} el tope es de ${legal.porMinuto} pesos por minuto (${legal.norma})`,
    });
  }
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

// ── Abonados por placa (HU-Q3.11) ─────────────────────────────────────────────────────────────

/**
 * Los abonados de la caja, de la placa A a la Z, con la vigencia que suman sus mensualidades
 * cobradas y no anuladas (HU-Q8.4). Con la nube, también las que cobró otra caja.
 */
export async function leerAbonados(db: BaseDeLaCaja): Promise<Abonado[]> {
  const [todos, pagos, sinValor] = await Promise.all([
    db.catalogos.where('entidad').equals('abonado').toArray(),
    db.registros.where('tipo').equals('pago_abonado').toArray(),
    anulados(db),
  ]);
  const vigentes = pagos
    .filter((p) => !sinValor.has(p.id))
    .map((p) => p.datos as DatosDePagoAbonado);
  return conPagos(todos as Abonado[], vigentes).sort((a, b) => a.placa.localeCompare(b.placa));
}

/** Hasta qué día pagó cada abonado en la caja, sin los pagos anulados (HU-Q13.5). */
export async function pagadoHastaDeLosAbonados(db: BaseDeLaCaja): Promise<Map<string, string>> {
  const [pagos, sinValor] = await Promise.all([
    db.registros.where('tipo').equals('pago_abonado').toArray(),
    anulados(db),
  ]);
  return pagadoHastaDe(
    pagos.filter((p) => !sinValor.has(p.id)).map((p) => p.datos as DatosDePagoAbonado),
  );
}

/** Un cambio de abonados sin el PIN de administrador no se guarda (CA1). */
export class PinIncorrecto extends Error {
  constructor() {
    super('Ese no es el PIN de administrador');
    this.name = 'PinIncorrecto';
  }
}

/**
 * Guarda un abonado: solo el administrador, con su PIN (CA1). Con `id`, la versión anterior va al
 * historial. Desactivarlo (`activo: false`) es la forma de quitarlo: nada se borra (P21).
 */
export async function guardarAbonado(
  db: BaseDeLaCaja,
  d: SinMeta<Abonado>,
  id: string | null,
  pin: string,
  ctx: Contexto,
): Promise<Abonado> {
  if (!(await verificarPin(db, pin))) throw new PinIncorrecto();
  return guardarCatalogo(db, 'abonado', abonado, d, id, ctx);
}

/**
 * Las mensualidades cobradas a un abonado y no anuladas, la más reciente primero (HU-Q8.4). Dos
 * cobradas en el mismo instante (lo que debía y el mes siguiente, HU-Q13.5) se ordenan por el
 * periodo que cubren: la última es la que llega más lejos, y es la que se anula.
 */
export async function pagosDelAbonado(db: BaseDeLaCaja, abonadoId: string): Promise<Registro[]> {
  const [pagos, sinValor] = await Promise.all([
    db.registros.where('tipo').equals('pago_abonado').toArray(),
    anulados(db),
  ]);
  const hasta = (p: Registro) => (p.datos as DatosDePagoAbonado).hasta;
  return pagos
    .filter((p) => !sinValor.has(p.id) && (p.datos as DatosDePagoAbonado).abonado_id === abonadoId)
    .sort(
      (a, b) =>
        b.instante_evento.localeCompare(a.instante_evento) || hasta(b).localeCompare(hasta(a)),
    );
}

/** No se cobra la mensualidad de un abonado desactivado o que no existe (HU-Q8.4). */
export class NoSeCobra extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'NoSeCobra';
  }
}

export interface DatosDeLaMensualidad {
  readonly desde: string;
  readonly hasta: string;
  readonly valor: number;
  readonly medio: DatosDePagoAbonado['medio_pago'];
}

/**
 * Cobra una mensualidad (HU-Q8.4 CA1): un registro `pago_abonado` con el número siguiente de la
 * caja, en una transacción, dentro del turno. Lo cobra el cajero, sin el PIN que pide cambiar el
 * abonado: la vigencia la suma `leerAbonados`. El efectivo entra al cierre del turno.
 */
export async function cobrarMensualidad(
  db: BaseDeLaCaja,
  abonadoId: string,
  d: DatosDeLaMensualidad,
  ctx: Contexto,
): Promise<Registro> {
  await exigirOperacion(db);
  const a = (await leerAbonados(db)).find((x) => x.id === abonadoId);
  if (!a) throw new NoSeCobra('Ese abonado no está en esta caja');
  if (!a.activo) throw new NoSeCobra(`${a.placa} está inactivo: actívelo antes de cobrar`);
  const { id: dispositivoId, serie } = await dispositivo(db, ctx);
  return db.transaction('rw', [db.registros, ...tablasDeLaCola(db)], async () => {
    const meta = await db.meta.get('consecutivo');
    const consecutivo = (meta?.clave === 'consecutivo' ? meta.ultimo : 0) + 1;
    const ahora = ctx.reloj();
    const registro = validarRegistro({
      id: ctx.nuevoId(),
      org_id: null,
      tipo: 'pago_abonado',
      v: 1,
      fecha_local: diaLocalBogota(ahora),
      instante_evento: iso(ahora),
      autor_usuario_id: null,
      dispositivo_id: dispositivoId,
      origen: 'manual',
      anula_id: null,
      estadia_id: null,
      serie,
      consecutivo,
      datos: {
        abonado_id: a.id,
        placa: a.placa,
        vehiculo: a.vehiculo,
        desde: d.desde,
        hasta: d.hasta,
        valor: d.valor,
        medio_pago: d.medio,
      },
    });
    await db.registros.add(registro);
    await encolar(db, [registro], ahora);
    await db.meta.put({ clave: 'consecutivo', ultimo: consecutivo });
    return registro;
  });
}

// ── La entrada (HU-Q3.3) ───────────────────────────────────────────────────────────────────────

export interface DatosDeLaEntrada {
  readonly placa: string;
  readonly vehiculo: Vehiculo;
  readonly placaConfirmada: boolean;
  readonly novedades: DatosDeEntrada['novedades'];
  readonly fotos: readonly { readonly tipo: 'image/webp' | 'image/jpeg'; readonly datos: Blob }[];
  /** El WhatsApp del conductor, ya autorizado con la casilla (HU-Q4.1 CA1); nulo si no lo dio. */
  readonly whatsapp?: string | null;
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
  await exigirOperacion(db);
  const numero = d.whatsapp ? numeroAutorizado(ajustes.sede, d.whatsapp) : null;
  const abonados = await leerAbonados(db);

  const tablas = [db.registros, db.estadias, db.fotos, db.contactos, ...tablasDeLaCola(db)];
  return db.transaction('rw', tablas, async () => {
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
        abonado_id: abonoDeLaPlaca(abonados, d.placa, ahora).vigente?.id ?? null,
      },
    });
    await db.registros.add(registro);
    await encolar(db, [registro], ahora);
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
    if (numero) await db.contactos.put(contacto(id, numero, dispositivoId, ahora, null));
    return registro;
  });
}

// ── El WhatsApp del conductor (HU-Q4.1) ───────────────────────────────────────────────────────

/** La sede no ha aceptado el aviso de privacidad vigente: no se guardan números (HU-Q4.4 CA2). */
export class SinAvisoDePrivacidad extends Error {
  constructor() {
    super('Antes del primer número, la sede acepta el aviso de privacidad en Ajustes.');
    this.name = 'SinAvisoDePrivacidad';
  }
}

/** Lanza `SinAvisoDePrivacidad`, o `WhatsAppInvalido` si el número no sirve. */
function numeroAutorizado(laSede: Sede | null, escrito: string): string {
  if (!avisoAceptado(laSede)) throw new SinAvisoDePrivacidad();
  return normalizarNumero(escrito);
}

const VIGENCIA_DEL_NUMERO = 24 * 3_600_000;

const contacto = (
  estadiaId: string,
  numero: string,
  operador: string,
  ahora: number,
  salida: number | null,
): Contacto => ({
  estadia_id: estadiaId,
  numero,
  autorizado: ahora,
  operador,
  aviso_version: VERSION_DEL_AVISO,
  borrar_en: salida === null ? null : salida + VIGENCIA_DEL_NUMERO,
});

/**
 * Guarda el número que el conductor autorizó en la pantalla del recibo. Si el vehículo ya salió,
 * vence 24 h después de esa salida, no de ahora (ADR-38).
 */
export async function guardarContacto(
  db: BaseDeLaCaja,
  estadiaId: string,
  escrito: string,
  ctx: Contexto,
): Promise<Contacto> {
  const numero = numeroAutorizado((await leerAjustes(db)).sede, escrito);
  const { id: dispositivoId } = await dispositivo(db, ctx);
  const salida = await db.registros
    .where('estadia_id')
    .equals(estadiaId)
    .filter((r) => r.tipo === 'salida')
    .first();
  const c = contacto(
    estadiaId,
    numero,
    dispositivoId,
    ctx.reloj(),
    salida ? Date.parse(salida.instante_evento) : null,
  );
  await db.contactos.put(c);
  return c;
}

/** El número vigente de una estadía, o nulo. El de la entrada sirve para el recibo de salida. */
export async function contactoDe(
  db: BaseDeLaCaja,
  estadiaId: string,
  ahora: number,
): Promise<Contacto | null> {
  const c = await db.contactos.get(estadiaId);
  return c && (c.borrar_en === null || c.borrar_en > ahora) ? c : null;
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
  await agregar(db, registro, ahora);
  // Un recibo que salió en papel, o que el conductor escaneó, ya no está pendiente (bitácora 42).
  if (entrega.resultado === 'enviado' || entrega.resultado === 'confirmado') {
    await quitarPendientesDe(db, recibo.id);
  }
  // Recibos por canal y papel que no salió (HU-Q5.3): el canal, nunca el recibo ni el número.
  const evento = eventoDeLaEntrega(entrega);
  if (evento) await medir(db, evento);
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
  const base = { sede: hoy.sede, ajuste: hoy.ajuste, abonado: await abonoDelRecibo(db, r) };
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
 * El abono que va en el recibo de una salida que lo usó: el de la placa al entrar, con su «hasta»
 * de hoy (si se renovó, el recibo lo dice). Nulo en lo demás (HU-Q3.11 CA2).
 */
async function abonoDelRecibo(db: BaseDeLaCaja, r: Registro): Promise<{ hasta: string } | null> {
  if (r.tipo !== 'salida') return null;
  const d = r.datos as DatosDeSalida;
  if (!d.lineas.some((l) => l.concepto === 'abonado')) return null;
  const { vigente } = abonoDeLaPlaca(
    await leerAbonados(db),
    d.placa,
    Date.parse(d.instante_entrada),
  );
  return vigente ? { hasta: vigente.hasta } : null;
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
    const yaAnulados = new Set(
      todos.filter((r) => r.tipo === 'anulacion').map((r) => r.anula_id ?? ''),
    );
    const cerradas = new Set(
      todos
        .filter((r) => r.tipo === 'salida' && !yaAnulados.has(r.id))
        .map((r) => r.estadia_id ?? ''),
    );
    const abiertas: Estadia[] = [];
    for (const r of todos) {
      if (r.tipo !== 'entrada' || yaAnulados.has(r.id) || cerradas.has(r.id)) continue;
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
  /** El abono que tenía la placa al entrar; nulo si entró como visitante (HU-Q3.11). */
  readonly abonado: Abonado | null;
  /** Sin abono al entrar, el último que se le venció: la caja lo dice (HU-Q3.11 CA3). */
  readonly abonoVencido: Abonado | null;
  /** La tarifa cambió en Ajustes después de que entró: se cobra con la de entonces (ADR-4). */
  readonly tarifaCambio: boolean;
}

/** Lo cubrió el abono entero: no paga, y el medio es «abonado» (HU-Q3.11 CA2). */
export const cubiertoPorElAbono = (l: Liquidacion): boolean =>
  l.total === 0 && l.lineas.some((x) => x.concepto === 'abonado');

/** Lo que el cajero lee del abono en la salida; vacío si la placa no tiene ni tuvo. */
export function avisoDelAbono(q: Pick<Cotizacion, 'abonado' | 'abonoVencido' | 'liquidacion'>) {
  if (q.abonado && q.liquidacion.avisos.includes('abonado_vencio')) {
    return `El abono venció el ${fechaDelAbono(q.abonado.hasta)}: se cobra desde ese día`;
  }
  if (q.abonado) return `Abonado hasta el ${fechaDelAbono(q.abonado.hasta)}`;
  if (q.abonoVencido) {
    return `El abono venció el ${fechaDelAbono(q.abonoVencido.hasta)}: se cobra como visitante`;
  }
  return '';
}

/**
 * Por qué una salida da $0, a la vista junto al total: sin esto, un carro que salió dentro de la
 * gracia parecía una tarifa que no calcula (dueño, 8 oct 2026). Vacío si el total no es $0 o si
 * lo cubrió el abono, que ya tiene su aviso. Si la tarifa ya cambió en Ajustes, no manda a
 * revisarla: dice que se cobra con la de la entrada (el tope de $1 que seguía, dueño, 8 oct 2026).
 */
export function motivoDelCero(
  q: Pick<Cotizacion, 'liquidacion' | 'tarifa' | 'tarifaCambio'>,
): string {
  const l = q.liquidacion;
  if (l.total !== 0 || cubiertoPorElAbono(l)) return '';
  if (l.avisos.includes('gracia')) {
    return `Salió dentro de los ${q.tarifa.gracia_min} minutos de gracia: no paga`;
  }
  const conTope = q.tarifa.tope_dia !== null && l.lineas.some((x) => x.concepto === 'tope_dia');
  if (q.tarifaCambio) {
    const causa = conTope
      ? `el tope por día era de ${formatearPesos(q.tarifa.tope_dia ?? 0)}`
      : l.redondeo > 0
        ? `el redondeo hacia abajo dejaba ${formatearPesos(l.subtotal)} en $0`
        : 'la tarifa de este vehículo daba $0';
    return `Entró cuando ${causa}, y se cobra con la tarifa con que entró. Los que entren desde ahora pagan con la nueva`;
  }
  if (conTope) {
    return `El tope por día es de ${formatearPesos(q.tarifa.tope_dia ?? 0)}: revise la tarifa en Ajustes`;
  }
  if (l.redondeo > 0) {
    return `El redondeo hacia abajo deja ${formatearPesos(l.subtotal)} en $0: revise el redondeo en Ajustes`;
  }
  return 'La tarifa de este vehículo da $0: revísela en Ajustes';
}

/**
 * Lo que se cobraría si saliera en `salida`, con la tarifa con que entró (§9). Si la placa tenía
 * abono al entrar, no paga lo que el abono cubre (hasta su día `hasta`, también si se renovó).
 */
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
  const abono = abonoDeLaPlaca(await leerAbonados(db), estadia.placa, estadia.entrada);
  const cubre = abono.vigente ? { vence: venceEl(abono.vigente) } : null;
  const liquidacion = liquidar(estadia.entrada, salida, t, t.tope_minuto, cubre, perdido);
  const hoy = (await db.catalogos.get(t.id)) as Tarifa | undefined;
  return {
    estadia,
    entrada,
    tarifa: t,
    liquidacion,
    salida,
    abonado: abono.vigente,
    abonoVencido: abono.vencido,
    tarifaCambio: hoy !== undefined && hoy.version !== t.version,
  };
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
  await exigirOperacion(db);
  const { id: dispositivoId, serie } = await dispositivo(db, ctx);
  const reloj = ctx.reloj();
  const ahora = instante ?? reloj;
  if (ahora > reloj || reloj - ahora > 10 * 60_000) throw new CotizacionVencida();
  const q = await cotizar(db, estadiaId, ahora, c.perdido);
  const liq = q.liquidacion;
  // Lo que cubre el abono no se cobra: el medio es «abonado», elija lo que elija el cajero.
  const medio: MedioDePago = cubiertoPorElAbono(liq) ? 'abonado' : c.medio;
  const efectivo = medio === 'efectivo';
  if (efectivo && (c.recibido === null || c.recibido < liq.total)) {
    throw new ErrorDeValidacion('salida', [
      { campo: 'recibido', motivo: `es menos que el total (${liq.total})` },
    ]);
  }
  const tablas = [db.registros, db.estadias, db.contactos, ...tablasDeLaCola(db)];
  return db.transaction('rw', tablas, async () => {
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
        medio_pago: medio,
        recibido,
        cambio: recibido === null ? null : recibido - liq.total,
        motivo_cortesia: medio === 'cortesia' ? (c.motivoCortesia?.trim() ?? '') : null,
        perdido: c.perdido,
        tarifa_id: q.tarifa.id,
        tarifa_version: q.tarifa.version,
      },
    });
    await db.registros.add(registro);
    await encolar(db, [registro], ahora);
    await db.estadias.delete(estadiaId);
    await db.meta.put({ clave: 'consecutivo', ultimo: consecutivo });
    await db.contactos.update(estadiaId, { borrar_en: ahora + VIGENCIA_DEL_NUMERO });
    return registro;
  });
}

// ── Anular sin borrar (HU-Q3.7) ───────────────────────────────────────────────────────────────

/** Un registro que no es recibo (anulación, turno, movimiento), validado antes de escribirse. */
function sinNumero(
  tipo: 'anulacion' | 'turno_apertura' | 'turno_cierre' | 'movimiento_caja',
  dispositivoId: string,
  ahora: number,
  datos: object,
  ctx: Contexto,
  enlaces: { anula_id?: string; estadia_id?: string | null } = {},
): Registro {
  return validarRegistro({
    id: ctx.nuevoId(),
    org_id: null,
    tipo,
    v: 1,
    fecha_local: diaLocalBogota(ahora),
    instante_evento: iso(ahora),
    autor_usuario_id: null,
    dispositivo_id: dispositivoId,
    origen: 'manual',
    anula_id: enlaces.anula_id ?? null,
    estadia_id: enlaces.estadia_id ?? null,
    serie: null,
    consecutivo: null,
    datos,
  });
}

/** Un registro suelto con su operación en la cola, en una transacción (HU-Q7.5 CA1). */
const agregar = (db: BaseDeLaCaja, r: Registro, ahora: number) =>
  db.transaction('rw', [db.registros, ...tablasDeLaCola(db)], async () => {
    await db.registros.add(r);
    await encolar(db, [r], ahora);
  });

// ── Respaldo y restauración (HU-Q3.10) ────────────────────────────────────────────────────────

export interface Respaldo {
  readonly json: ParqueaderoExportV1;
  readonly csv: string;
  /** `parqueadero-2026-10-07-1405`, sin extensión. */
  readonly nombre: string;
}

/**
 * Todo lo de la caja en `parqueadero-export/1` más su CSV (§5.3 regla 6). Sin fotos ni números de
 * WhatsApp: las fotos viven en el teléfono hasta M2 (CA3) y los números nunca salen (ADR-38).
 */
export async function armarRespaldo(
  db: BaseDeLaCaja,
  ctx: Contexto,
  app: string,
): Promise<Respaldo> {
  const [catalogo, registro, historial, disp] = await Promise.all([
    db.catalogos.toArray(),
    db.registros.toArray(),
    db.historial.toArray(),
    dispositivo(db, ctx),
  ]);
  const ahora = ctx.reloj();
  const json = await armarExport({
    generado: iso(ahora),
    app,
    dispositivo: disp,
    sede_id: catalogo.find((c) => c.entidad === 'sede')?.id ?? null,
    catalogo,
    registro,
    historial,
  });
  const hora = horaBogota(ahora).replace(':', '');
  return {
    json,
    csv: csvDeRegistros(registro),
    nombre: `parqueadero-${diaLocalBogota(ahora)}-${hora}`,
  };
}

/** El respaldo ya salió del teléfono: la cabecera lo dice (CA1), y se cuenta (HU-Q5.3). */
export async function anotarRespaldo(db: BaseDeLaCaja, instante: number): Promise<void> {
  await db.meta.put({ clave: 'respaldo', instante });
  await medir(db, { evento: 'respaldo.hecho' });
}

/** Un archivo que no se puede unir: se rechaza entero, sin tocar lo local (CA4). */
export class RespaldoInvalido extends Error {
  readonly problemas: readonly string[];
  constructor(problemas: readonly string[]) {
    super(problemas.join('; '));
    this.name = 'RespaldoInvalido';
    this.problemas = problemas;
  }
}

export interface Restauracion {
  readonly agregados: number;
  readonly yaEstaban: number;
}

/**
 * Restaura **uniendo** (bitácora ecommerce 77, P21): agrega por id lo que no está y no toca lo que
 * ya hay. Antes de escribir verifica la huella, la versión, la sede y cada registro; si algo falla,
 * no escribe nada. El consecutivo sigue desde el número más alto: un recibo nunca se repite.
 */
export async function restaurar(db: BaseDeLaCaja, archivo: unknown): Promise<Restauracion> {
  const problemas = await verificarExport(archivo);
  if (problemas.length > 0) throw new RespaldoInvalido(problemas);
  const r = archivo as ParqueaderoExportV1;
  const local = (await leerAjustes(db)).sede;
  if (local && r.sede_id !== local.id) {
    throw new RespaldoInvalido([
      'el archivo es de otro parqueadero: restáurelo en una caja nueva, antes de llenar los ajustes',
    ]);
  }
  const registros = r.tablas.registro.filas.map((x) => {
    try {
      return validarRegistro(x);
    } catch (e) {
      throw new RespaldoInvalido([`el registro ${x.id} no se puede leer: ${String(e)}`]);
    }
  });
  const catalogos = r.tablas.catalogo.filas;
  const historial = r.tablas.historial.filas;
  const tablas = [db.registros, db.catalogos, db.historial, db.estadias, ...tablasDeLaCola(db)];
  const res = await db.transaction('rw', tablas, async () => {
    const nuevos = async <T extends { id: string }>(
      t: { bulkGet(ids: string[]): Promise<unknown[]> },
      filas: readonly T[],
    ) => {
      const hay = await t.bulkGet(filas.map((x) => x.id));
      return filas.filter((_, i) => hay[i] === undefined);
    };
    const reg = await nuevos(db.registros, registros);
    const cat = await nuevos(db.catalogos, catalogos);
    const his = await nuevos(db.historial, historial);
    await db.registros.bulkAdd(reg);
    await db.catalogos.bulkAdd(cat);
    await db.historial.bulkAdd(his);
    // Vinculada, lo restaurado que la nube no tiene sube como lo demás; la celda contesta
    // `duplicado` a lo que ya tenía.
    await encolar(db, [...cat, ...reg], Date.now());
    // Un teléfono nuevo toma la caja del archivo: su serie y su numeración siguen.
    const propia = await db.meta.get('dispositivo');
    if (propia?.clave !== 'dispositivo')
      await db.meta.put({ clave: 'dispositivo', ...r.dispositivo });
    const serie = propia?.clave === 'dispositivo' ? propia.serie : r.dispositivo.serie;
    const meta = await db.meta.get('consecutivo');
    const ultimo = Math.max(
      meta?.clave === 'consecutivo' ? meta.ultimo : 0,
      ...registros.filter((x) => x.serie === serie).map((x) => x.consecutivo ?? 0),
    );
    await db.meta.put({ clave: 'consecutivo', ultimo });
    const total = registros.length + catalogos.length + historial.length;
    const agregados = reg.length + cat.length + his.length;
    return { agregados, yaEstaban: total - agregados };
  });
  await reconstruirEstadias(db);
  return res;
}

// ── El turno (HU-Q3.9) ─────────────────────────────────────────────────────────────────────────

/** Abre el turno con el operador y la base de caja (CA1). Si ya hay uno abierto, lo devuelve. */
export async function abrirTurno(
  db: BaseDeLaCaja,
  d: { readonly operador: string; readonly base: number },
  ctx: Contexto,
): Promise<Turno> {
  const abierto = await turnoAbierto(db);
  if (abierto) return abierto;
  const { id: dispositivoId } = await dispositivo(db, ctx);
  const apertura = sinNumero(
    'turno_apertura',
    dispositivoId,
    ctx.reloj(),
    { operador: d.operador.trim(), base: d.base },
    ctx,
  );
  await agregar(db, apertura, ctx.reloj());
  return exigirTurno(db);
}

/** Un ingreso o un gasto de la caja, con su concepto (CA1). */
export async function registrarMovimiento(
  db: BaseDeLaCaja,
  d: Pick<DatosDeMovimiento, 'clase' | 'valor' | 'concepto'>,
  ctx: Contexto,
): Promise<Registro> {
  const turno = await exigirTurno(db);
  const { id: dispositivoId } = await dispositivo(db, ctx);
  const m = sinNumero(
    'movimiento_caja',
    dispositivoId,
    ctx.reloj(),
    { ...d, concepto: d.concepto.trim(), turno_id: turno.apertura.id },
    ctx,
  );
  await agregar(db, m, ctx.reloj());
  return m;
}

/**
 * Lo que lleva el turno hasta ahora: los registros de esta caja desde su apertura (un turno a la
 * vez). Lo que cobró otra caja del parqueadero no está en este cajón (HU-Q7.5).
 */
export async function resumenDelTurno(db: BaseDeLaCaja, t: Turno): Promise<ResumenDeTurno> {
  const desde = await db.registros
    .where('instante_evento')
    .aboveOrEqual(t.apertura.instante_evento)
    .filter((r) => r.dispositivo_id === t.apertura.dispositivo_id)
    .toArray();
  return resumirTurno(t.apertura, desde, t.numero);
}

/**
 * Cierra el turno con el efectivo contado. Lo esperado se calcula aquí, en el dispositivo (CA1).
 * Una diferencia sin motivo no se guarda (CA4): lo exige el esquema y lanza `ErrorDeValidacion`.
 */
export async function cerrarTurno(
  db: BaseDeLaCaja,
  t: Turno,
  d: { readonly contado: number; readonly motivo: string | null },
  ctx: Contexto,
): Promise<{ readonly cierre: Registro; readonly resumen: ResumenDeTurno }> {
  const resumen = await resumenDelTurno(db, t);
  const { id: dispositivoId } = await dispositivo(db, ctx);
  const motivo = d.motivo?.trim() || null;
  const cierre = sinNumero(
    'turno_cierre',
    dispositivoId,
    ctx.reloj(),
    {
      apertura_id: t.apertura.id,
      esperado: resumen.esperado,
      contado: d.contado,
      diferencia: d.contado - resumen.esperado,
      motivo,
    },
    ctx,
  );
  await agregar(db, cierre, ctx.reloj());
  await medir(db, { evento: 'turno.cerrado' });
  return { cierre, resumen };
}

/** Por qué no se anula: el cajero lo lee tal cual. */
export class NoSeAnula extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'NoSeAnula';
  }
}

/** Quién opera la caja ahora: el del turno abierto. */
export async function operadorActual(db: BaseDeLaCaja): Promise<string> {
  const { sede: laSede } = await leerAjustes(db);
  if (!usaTurnos(laSede)) {
    const propia = await db.meta.get('dispositivo');
    return `Caja ${propia?.clave === 'dispositivo' ? propia.serie : 'local'}`;
  }
  return (await exigirTurno(db)).operador;
}

/** Las anulaciones de la caja, por el id de lo anulado. */
export async function anulados(db: BaseDeLaCaja): Promise<Set<string>> {
  const todas = await db.registros.where('tipo').equals('anulacion').toArray();
  return new Set(todas.map((a) => a.anula_id ?? ''));
}

/**
 * Anula una entrada, una salida o una mensualidad con un registro `anulacion` (§10.2, P21): nada
 * se borra ni se reescribe. Pide el PIN de administrador (M0). Una entrada anulada cierra su
 * estadía; una salida anulada la reabre; una mensualidad anulada deja de sumar vigencia. Lanza `NoSeAnula` con el motivo si no se puede.
 */
export async function anular(
  db: BaseDeLaCaja,
  registroId: string,
  d: { readonly motivo: string; readonly pin: string; readonly operador: string },
  ctx: Contexto,
): Promise<Registro> {
  await exigirOperacion(db);
  if (!d.motivo.trim()) throw new NoSeAnula('Falta el motivo de la anulación');
  if (!(await verificarPin(db, d.pin))) throw new NoSeAnula('Ese no es el PIN de administrador');
  const { id: dispositivoId } = await dispositivo(db, ctx);
  const tablas = [db.registros, db.estadias, db.contactos, ...tablasDeLaCola(db)];
  return db.transaction('rw', tablas, async () => {
    const r = await db.registros.get(registroId);
    if (!r || (r.tipo !== 'entrada' && r.tipo !== 'salida' && r.tipo !== 'pago_abonado')) {
      throw new NoSeAnula('Solo se anula una entrada, una salida o una mensualidad');
    }
    if ((await anulados(db)).has(r.id)) throw new NoSeAnula('Este recibo ya está anulado');
    // Una mensualidad anulada deja de sumar vigencia; no tiene estadía (HU-Q8.4).
    if (r.tipo === 'pago_abonado') {
      const anulacion = sinNumero(
        'anulacion',
        dispositivoId,
        ctx.reloj(),
        { motivo: d.motivo.trim(), operador: d.operador },
        ctx,
        { anula_id: r.id },
      );
      await db.registros.add(anulacion);
      await encolar(db, [anulacion], ctx.reloj());
      return anulacion;
    }
    const abierta = await db.estadias.get(r.estadia_id ?? '');
    if (r.tipo === 'entrada' && !abierta) {
      throw new NoSeAnula('Este vehículo ya salió: primero se anula su salida');
    }
    // Reabrir la estadía no puede dejar la misma placa adentro dos veces (HU-Q3.3 CA3).
    const placa = (r.datos as { placa: string }).placa;
    if (r.tipo === 'salida' && (await db.estadias.where('placa').equals(placa).count()) > 0) {
      throw new NoSeAnula(`${placa} volvió a entrar: primero se anula esa entrada`);
    }
    const ahora = ctx.reloj();
    const anulacion = sinNumero(
      'anulacion',
      dispositivoId,
      ahora,
      { motivo: d.motivo.trim(), operador: d.operador },
      ctx,
      { anula_id: r.id, estadia_id: r.estadia_id },
    );
    await db.registros.add(anulacion);
    await encolar(db, [anulacion], ahora);
    if (r.tipo === 'entrada') {
      await db.estadias.delete(r.id);
    } else {
      const entrada = await db.registros.get(r.estadia_id ?? '');
      if (entrada?.serie && entrada.consecutivo) {
        const de = entrada.datos as DatosDeEntrada;
        await db.estadias.put({
          id: entrada.id,
          placa: de.placa,
          vehiculo: de.vehiculo,
          numero: numeroDeRecibo(entrada.serie, entrada.consecutivo),
          entrada: Date.parse(entrada.instante_evento),
        });
      }
      // El vehículo sigue adentro: su número ya no vence con esa salida.
      await db.contactos.update(entrada?.id ?? '', { borrar_en: null });
    }
    return anulacion;
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
export async function buscarPorLectura(
  db: BaseDeLaCaja,
  texto: string,
  origenes: readonly string[] = [ORIGEN_DEL_RECIBO],
): Promise<Hallazgo> {
  const no = (motivo: string): Hallazgo => ({ encontrada: false, motivo });
  if (!origenes.some((o) => texto.startsWith(`${o}#`))) {
    return no('Este QR no es un recibo del parqueadero.');
  }
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
