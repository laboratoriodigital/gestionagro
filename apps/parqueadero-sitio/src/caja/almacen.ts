/**
 * Lo que la caja escribe y lee de su almacén (PARQUEADERO §5.2 a §5.4): los ajustes con su
 * historial, el PIN de administrador y la entrada con su consecutivo. Todo pasa por los esquemas de
 * `@ed1/parqueadero-schema` antes de escribirse (P2): lo que la caja guarda hoy sube mañana igual.
 */

import {
  type Catalogos,
  faltantesDeSede,
  nombresDeCampos,
  ReciboIncompleto,
} from '@ed1/parqueadero-recibos';
import {
  type AjusteRecibo,
  ajusteRecibo,
  type Catalogo,
  type DatosDeEntrada,
  type Entidad,
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
import { validarTarifa } from '@ed1/parqueadero-tarifas';
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

/** Cómo salió un recibo: queda en los registros, sin número (§7.6). */
export async function registrarEntrega(
  db: BaseDeLaCaja,
  recibo: Registro,
  canal: 'papel' | 'whatsapp' | 'pantalla',
  copia: boolean,
  ctx: Contexto,
): Promise<void> {
  const ahora = ctx.reloj();
  await db.registros.add(
    validarRegistro({
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
      datos: { recibo_id: recibo.id, canal, copia },
    }),
  );
}

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

/** Cuántas veces salió ya un recibo en papel: la siguiente es «COPIA n» (§7.6). */
export async function vecesImpreso(db: BaseDeLaCaja, recibo: Registro): Promise<number> {
  return db.registros
    .where('estadia_id')
    .equals(recibo.estadia_id ?? recibo.id)
    .filter((r) => {
      const d = r.datos as { recibo_id?: string; canal?: string };
      return r.tipo === 'entrega_recibo' && d.recibo_id === recibo.id && d.canal === 'papel';
    })
    .count();
}
