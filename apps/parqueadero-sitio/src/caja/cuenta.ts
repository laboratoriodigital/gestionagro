/**
 * La cuenta en la caja y el paso a la nube (HU-Q7.6 y HU-Q7.7; PARQUEADERO §5.4 y §11.3). Es el
 * patrón del cuaderno (`apps/cuaderno/src/almacen/sesion.ts` y `vinculo.ts`) con el producto
 * `parqueadero`. Sin cuenta, la caja registra igual que en `v0.2.x` (P10).
 *
 * - **Entrar (CA1):** la cuenta del CORE con `producto=parqueadero` y su política vigente; vuelve a
 *   `/caja/#entrar=<código>`. El código se borra de la barra antes de canjearlo. Los tokens viven en
 *   `meta` (clave `sesion`), nunca en `localStorage` ni en el respaldo (P13).
 * - **Subir este parqueadero (CA2, CA3):** crea el parqueadero en la cuenta con un id hecho aquí
 *   (reintentar no crea otro), renueva la sesión hacia él, reclama la caja con su serie de siempre
 *   y pone en la cola todo lo que la caja guardó. La cola lo sube de a 25 con los mismos ids, y
 *   `verificarReclamo` lo da por subido solo cuando la celda tiene lo mismo (P21).
 * - **Sumar una caja nueva (HU-Q7.7):** un teléfono vacío entra a un parqueadero de la cuenta, la
 *   celda le da la siguiente serie libre y la sincronización le baja los ajustes y los vehículos.
 *   Una caja con recibos propios no se suma: sus números chocarían con los de las otras.
 * - Salir de la cuenta borra los tokens y el vínculo, nunca los registros ni la cola.
 */
import { uuidv7 } from '@ed1/ids';
import politica from '../../../../content/parqueadero/privacidad/politica.json' with {
  type: 'json',
};
import { dispositivo as cajaDeEsteTelefono } from './almacen.ts';
import { idDeOperacion } from './cola.ts';
import type { BaseDeLaCaja, Meta, OperacionSalida, Sesion } from './datos.ts';
import { conTerminos } from './terminos.ts';

/** La versión de la política que se acepta al entrar: la del CORE (HU-E0.5 CA3). */
export const VERSION_DE_LA_POLITICA: string = politica.version;
/** La caja se piensa como teléfono barato: la cola se llena de a estos, sin trabarlo. */
const LOTE_LOCAL = 500;

type Reclamo = Extract<Meta, { clave: 'reclamo' }>;

/** Adónde lleva «Entrar con Google»: el CORE vuelve a esta caja con el código de un uso. */
export function urlDeEntrada(core: string, origen: string): string {
  const q = new URLSearchParams({
    producto: 'parqueadero',
    vuelta: `${origen}/caja/`,
    politica: VERSION_DE_LA_POLITICA,
  });
  return `${core}/api/core/auth/google/inicio?${q}`;
}

/** Lo que llegó en el fragmento al volver de la cuenta. */
export type Regreso = { codigo: string } | { error: string } | null;

export function leerRegreso(fragmento: string): Regreso {
  const datos = new URLSearchParams(fragmento.replace(/^#/, ''));
  const codigo = datos.get('entrar');
  if (codigo) return { codigo };
  const error = datos.get('entrar-error');
  return error ? { error } : null;
}

export const MENSAJES_DE_ERROR: Readonly<Record<string, string>> = {
  cancelada: 'Canceló la entrada con Google. Puede intentarlo cuando quiera.',
  invalida: 'No se pudo comprobar la entrada. Toque «Entrar con Google» otra vez.',
  google: 'Google no respondió bien. Intente de nuevo en un momento.',
};

export class ErrorDeCuenta extends Error {
  override name = 'ErrorDeCuenta';
}

interface Opciones {
  readonly fetchFn?: typeof fetch;
  readonly ahora?: () => number;
}

async function pedir(
  fetchFn: typeof fetch,
  url: string,
  o: { metodo?: 'GET' | 'POST'; acceso?: string; cuerpo?: unknown } = {},
): Promise<{ estado: number; datos: Record<string, unknown> }> {
  let r: Response;
  try {
    // A la celda va con la versión de los términos aceptada (HU-Q7.11); al CORE, como está.
    r = await fetchFn(conTerminos(url), {
      method: o.metodo ?? (o.cuerpo === undefined ? 'GET' : 'POST'),
      headers: {
        ...(o.cuerpo === undefined ? {} : { 'content-type': 'application/json' }),
        ...(o.acceso ? { authorization: `Bearer ${o.acceso}` } : {}),
      },
      ...(o.cuerpo === undefined ? {} : { body: JSON.stringify(o.cuerpo) }),
    });
  } catch {
    throw new ErrorDeCuenta('Sin señal: no se pudo hablar con la nube. La caja sigue igual.');
  }
  return { estado: r.status, datos: (await r.json().catch(() => ({}))) as Record<string, unknown> };
}

const motivo = (datos: Record<string, unknown>, otro: string) =>
  typeof datos['motivo'] === 'string' ? datos['motivo'] : otro;

/** La sesión que el CORE entrega al canjear o renovar; `refresh` es null si no rotó. */
const sesionDe = (datos: Record<string, unknown>, refresh: string): Sesion => ({
  ...(datos as unknown as Sesion),
  refresh: typeof datos['refresh'] === 'string' ? datos['refresh'] : refresh,
});

export async function leerSesion(db: BaseDeLaCaja): Promise<Sesion | null> {
  const m = await db.meta.get('sesion');
  return m?.clave === 'sesion' ? m.sesion : null;
}

export type EstadoDeSesion = 'sin-cuenta' | 'activa' | 'por-renovar' | 'vencida';

export function estadoDeSesion(sesion: Sesion | null, ahora: number): EstadoDeSesion {
  if (!sesion) return 'sin-cuenta';
  if (sesion.refresh_vence <= ahora) return 'vencida';
  return sesion.acceso_vence > ahora ? 'activa' : 'por-renovar';
}

/** El rol de esta cuenta en el parqueadero de la sesión. */
export const rolDeLaSesion = (sesion: Sesion | null): string | null =>
  sesion?.organizaciones.find((o) => o.org_id === sesion.org_id)?.rol ?? null;

/** El id de esta caja: el mismo con que numera sus recibos. */
const idDeLaCaja = (db: BaseDeLaCaja, ahora: () => number) =>
  cajaDeEsteTelefono(db, { reloj: ahora, nuevoId: () => uuidv7(ahora) });

/** Canjea el código de un uso por la sesión. */
export async function canjear(
  db: BaseDeLaCaja,
  codigo: string,
  core: string,
  o: Opciones = {},
): Promise<Sesion> {
  const { fetchFn = fetch, ahora = () => Date.now() } = o;
  const { id } = await idDeLaCaja(db, ahora);
  const r = await pedir(fetchFn, `${core}/api/core/auth/canje`, {
    cuerpo: { codigo, dispositivo: id },
  });
  if (r.estado !== 200 || typeof r.datos['refresh'] !== 'string') {
    throw new ErrorDeCuenta(motivo(r.datos, 'No se pudo comprobar la entrada. Intente otra vez.'));
  }
  const sesion = sesionDe(r.datos, r.datos['refresh']);
  await db.meta.put({ clave: 'sesion', sesion });
  return sesion;
}

/**
 * Renueva el acceso si venció (o si `forzar`), siempre hacia el parqueadero de la caja, y deja el
 * acceso nuevo también en `nube` en la misma transacción. Sin señal no falla: queda «por renovar».
 * Si el CORE dice que la sesión ya no sirve, la borra y lo dice; la cola espera.
 */
export async function renovar(
  db: BaseDeLaCaja,
  core: string,
  o: Opciones & { readonly forzar?: boolean; readonly enLinea?: () => boolean } = {},
): Promise<{ sesion: Sesion | null; aviso: string | null }> {
  const { fetchFn = fetch, ahora = () => Date.now(), enLinea = () => navigator.onLine } = o;
  const sesion = await leerSesion(db);
  const estado = estadoDeSesion(sesion, ahora());
  if (!sesion || (estado === 'activa' && !o.forzar)) return { sesion, aviso: null };
  if (estado === 'vencida') {
    await db.meta.delete('sesion');
    return { sesion: null, aviso: 'La sesión venció. Vuelva a entrar con su cuenta.' };
  }
  if (!enLinea()) return { sesion, aviso: null };
  const nube = await db.meta.get('nube');
  const org = (nube?.clave === 'nube' ? nube.org_id : undefined) ?? sesion.org_id;
  let r: Awaited<ReturnType<typeof pedir>>;
  try {
    r = await pedir(fetchFn, `${core}/api/core/auth/refrescar`, {
      cuerpo: { refresh: sesion.refresh, ...(org ? { org_id: org } : {}) },
    });
  } catch {
    return { sesion, aviso: null }; // la señal se fue a mitad: se intenta en la próxima vuelta
  }
  if (r.estado === 401) {
    await db.meta.delete('sesion');
    return { sesion: null, aviso: motivo(r.datos, 'La sesión venció. Vuelva a entrar.') };
  }
  if (r.estado !== 200) return { sesion, aviso: null }; // CORE en pausa: se reintenta después
  const nueva = sesionDe(r.datos, sesion.refresh);
  await db.transaction('rw', db.meta, async () => {
    await db.meta.put({ clave: 'sesion', sesion: nueva });
    const n = await db.meta.get('nube');
    if (n?.clave === 'nube' && nueva.org_id === n.org_id) {
      await db.meta.put({ ...n, acceso: nueva.acceso });
    }
  });
  return { sesion: nueva, aviso: null };
}

/** Sale de la cuenta: borra los tokens y el vínculo. Los registros y la cola se quedan. */
export async function salir(db: BaseDeLaCaja): Promise<void> {
  await db.transaction('rw', db.meta, async () => {
    await db.meta.bulkDelete(['sesion', 'nube', 'org_pendiente']);
  });
}

/**
 * Lo que la caja puede hacer con la cuenta:
 * - `para-subir`: la caja tiene lo suyo (ajustes o recibos) y no está en la nube: se reclama.
 * - `para-sumar`: la caja está vacía y la cuenta tiene un parqueadero: se suma como caja nueva.
 * - `sin-ajustes`: caja vacía y cuenta sin parqueadero: primero los ajustes.
 */
export type Situacion = 'sin-cuenta' | 'vinculada' | 'para-subir' | 'para-sumar' | 'sin-ajustes';

export async function situacion(db: BaseDeLaCaja, sesion: Sesion | null): Promise<Situacion> {
  if (!sesion) return 'sin-cuenta';
  if ((await db.meta.get('nube'))?.clave === 'nube') return 'vinculada';
  const propios = (await db.registros.count()) + (await db.catalogos.count());
  if (propios > 0) return 'para-subir';
  return sesion.organizaciones.length > 0 ? 'para-sumar' : 'sin-ajustes';
}

/** Renueva la sesión hacia un parqueadero; falla si el CORE no la da para él. */
async function sesionPara(
  fetchFn: typeof fetch,
  core: string,
  sesion: Sesion,
  org: string,
): Promise<Sesion> {
  const r = await pedir(fetchFn, `${core}/api/core/auth/refrescar`, {
    cuerpo: { refresh: sesion.refresh, org_id: org },
  });
  if (r.estado !== 200 || r.datos['org_id'] !== org || typeof r.datos['url_api'] !== 'string') {
    throw new ErrorDeCuenta(
      motivo(r.datos, 'No se pudo abrir el parqueadero en la nube. Intente otra vez.'),
    );
  }
  return sesionDe(r.datos, sesion.refresh);
}

/**
 * Pone en la cola todo lo que la caja guardó y no está ya en ella: la sede primero, los demás
 * catálogos y los registros en el orden de sus ids (UUIDv7: el de sus instantes). Idempotente.
 */
export async function encolarTodo(db: BaseDeLaCaja, ahora: () => number): Promise<number> {
  const catalogos = (await db.catalogos.toArray()).sort(
    (a, b) => Number(b.entidad === 'sede') - Number(a.entidad === 'sede'),
  );
  const registros = (await db.registros.toCollection().primaryKeys()).sort();
  const desde = ahora();
  const ops: OperacionSalida[] = [
    ...catalogos.map((c) => ({
      id: idDeOperacion(c.entidad, c.id, c.version),
      entidad: c.entidad,
      entidad_id: c.id,
      version: c.version,
    })),
    ...registros.map((id) => ({ id, entidad: 'registro' as const, entidad_id: id, version: 1 })),
  ].map((op, i) => ({ ...op, creado: desde + i }));
  let agregadas = 0;
  for (let i = 0; i < ops.length; i += LOTE_LOCAL) {
    const tramo = ops.slice(i, i + LOTE_LOCAL);
    await db.transaction('rw', db.outbox, async () => {
      const ya = await db.outbox.bulkGet(tramo.map((o) => o.id));
      const faltan = tramo.filter((_, k) => !ya[k]);
      await db.outbox.bulkAdd(faltan);
      agregadas += faltan.length;
    });
  }
  return agregadas;
}

/** Lo del reclamo que falta encolar (un corte a mitad lo deja así): se encola y se anota. */
export async function encolarReclamo(db: BaseDeLaCaja, ahora: () => number): Promise<number> {
  const r = await db.meta.get('reclamo');
  if (r?.clave !== 'reclamo' || r.estado !== 'subiendo' || r.encolado) return 0;
  const n = await encolarTodo(db, ahora);
  await db.meta.put({ ...r, encolado: true });
  return n;
}

/**
 * Sube este parqueadero a la cuenta (HU-Q7.6 CA2 y CA3): el parqueadero, la caja con su serie y lo
 * que guardó. Devuelve la serie con que quedó y cuánto entró a la cola.
 */
export async function subirParqueadero(
  db: BaseDeLaCaja,
  core: string,
  o: Opciones = {},
): Promise<{ serie: string; encoladas: number }> {
  const { fetchFn = fetch, ahora = () => Date.now() } = o;
  const sesion = await leerSesion(db);
  if (!sesion) throw new ErrorDeCuenta('Entre con su cuenta para subir el parqueadero.');
  if ((await db.meta.get('nube'))?.clave === 'nube') {
    throw new ErrorDeCuenta('Esta caja ya está en la nube.');
  }
  const sede = await db.catalogos.where('entidad').equals('sede').first();
  if (sede?.entidad !== 'sede') {
    throw new ErrorDeCuenta('Primero llene los datos de la sede en los ajustes del parqueadero.');
  }

  // El parqueadero de la cuenta: el que ya tiene (un reclamo cortado a mitad) o uno nuevo.
  let org = sesion.org_id ?? sesion.organizaciones[0]?.org_id ?? null;
  if (!org) {
    const pendiente = await db.meta.get('org_pendiente');
    org = pendiente?.clave === 'org_pendiente' ? pendiente.id : uuidv7(ahora);
    await db.meta.put({ clave: 'org_pendiente', id: org });
    const creada = await pedir(fetchFn, `${core}/api/core/organizaciones`, {
      acceso: sesion.acceso,
      cuerpo: { id: org, nombre: sede.nombre },
    });
    if (creada.estado !== 200 && creada.estado !== 201) {
      throw new ErrorDeCuenta(
        motivo(creada.datos, `No se pudo crear el parqueadero en la nube (${creada.estado}).`),
      );
    }
  }
  const nueva = await sesionPara(fetchFn, core, sesion, org);
  const api = nueva.url_api as string;
  const caja = await idDeLaCaja(db, ahora);
  const reclamada = await pedir(fetchFn, `${api}/api/v1/reclamar`, {
    acceso: nueva.acceso,
    cuerpo: { dispositivo: caja.id, serie: caja.serie, sede_id: sede.id },
  });
  // HU-Q7.10: el parqueadero ya existe en la cuenta, pero su plan no trae la nube. La sesión se
  // queda con él, para que «Cuenta y nube» ofrezca pagarlo; subir se intenta de nuevo después.
  if (reclamada.estado === 402) {
    await db.transaction('rw', db.meta, async () => {
      await db.meta.put({ clave: 'sesion', sesion: nueva });
      await db.meta.delete('org_pendiente');
    });
  }
  if (reclamada.estado !== 200 && reclamada.estado !== 201) {
    throw new ErrorDeCuenta(
      motivo(reclamada.datos, `La nube no recibió esta caja (${reclamada.estado}).`),
    );
  }
  // Primero el vínculo y el reclamo sin encolar: si la caja se cierra a mitad de la cola, la
  // siguiente vuelta de la nube termina de encolar (`encolarReclamo`). Lo nuevo entra solo.
  await db.transaction('rw', db.meta, async () => {
    await db.meta.put({ clave: 'sesion', sesion: nueva });
    await db.meta.put({ clave: 'nube', api, acceso: nueva.acceso, org_id: org });
    await db.meta.put({ clave: 'reclamo', estado: 'subiendo', encolado: false, desde: ahora() });
    await db.meta.delete('org_pendiente');
  });
  return { serie: caja.serie, encoladas: await encolarReclamo(db, ahora) };
}

/**
 * Suma esta caja, vacía, a un parqueadero de la cuenta (HU-Q7.7 CA1): la celda le da su serie y
 * la sincronización le baja lo demás.
 */
export async function sumarCaja(
  db: BaseDeLaCaja,
  core: string,
  org: string,
  o: Opciones = {},
): Promise<{ serie: string }> {
  const { fetchFn = fetch, ahora = () => Date.now() } = o;
  const sesion = await leerSesion(db);
  if (!sesion) throw new ErrorDeCuenta('Entre con su cuenta para sumar esta caja.');
  if ((await db.registros.count()) + (await db.catalogos.count()) > 0) {
    throw new ErrorDeCuenta(
      'Esta caja ya tiene datos propios: súbala como su propio parqueadero, o use un teléfono vacío.',
    );
  }
  const nueva = await sesionPara(fetchFn, core, sesion, org);
  const api = nueva.url_api as string;
  const caja = await idDeLaCaja(db, ahora);
  const r = await pedir(fetchFn, `${api}/api/v1/dispositivos`, {
    acceso: nueva.acceso,
    cuerpo: { dispositivo: caja.id },
  });
  const dada = r.datos['caja'] as { serie?: unknown } | undefined;
  if ((r.estado !== 200 && r.estado !== 201) || typeof dada?.serie !== 'string') {
    throw new ErrorDeCuenta(motivo(r.datos, `La nube no dio de alta esta caja (${r.estado}).`));
  }
  const serie = dada.serie;
  await db.transaction('rw', db.meta, async () => {
    await db.meta.put({ clave: 'dispositivo', id: caja.id, serie });
    await db.meta.put({ clave: 'sesion', sesion: nueva });
    await db.meta.put({ clave: 'nube', api, acceso: nueva.acceso, org_id: org });
  });
  return { serie };
}

/** Lo que la celda dice tener (`GET /api/v1/resumen`). */
export interface ResumenDeLaNube {
  readonly registros: number;
  readonly catalogos: number;
  readonly caja: {
    readonly dispositivo: string;
    readonly estado: string;
    readonly registros: number;
    readonly en_cuarentena: number;
  };
}

/** Adónde y con qué habla esta caja con la nube; null sin vínculo. */
export async function destinoDeLaCaja(
  db: BaseDeLaCaja,
): Promise<{ api: string; acceso: string; dispositivo: string } | null> {
  const [nube, disp] = await Promise.all([db.meta.get('nube'), db.meta.get('dispositivo')]);
  if (nube?.clave !== 'nube' || disp?.clave !== 'dispositivo') return null;
  return { api: nube.api, acceso: nube.acceso, dispositivo: disp.id };
}

export async function resumenDeLaNube(
  destino: { api: string; acceso: string; dispositivo: string },
  o: Opciones = {},
): Promise<ResumenDeLaNube> {
  const { fetchFn = fetch } = o;
  const r = await pedir(
    fetchFn,
    `${destino.api}/api/v1/resumen?dispositivo=${encodeURIComponent(destino.dispositivo)}`,
    { acceso: destino.acceso },
  );
  if (r.estado !== 200) {
    throw new ErrorDeCuenta(motivo(r.datos, `La nube respondió ${r.estado}.`));
  }
  return r.datos as unknown as ResumenDeLaNube;
}

/**
 * Con la cola vacía, compara lo de la caja con lo de la celda (P21). Iguales: «verificado». Si
 * faltan y la celda puso algo en cuarentena: «con-rechazos», y la caja lo muestra. Si faltan sin
 * motivo, vuelve a encolar todo: lo que ya está vuelve como `duplicado` y lo que falta entra.
 */
export async function verificarReclamo(
  db: BaseDeLaCaja,
  destino: { api: string; acceso: string; dispositivo: string },
  o: Opciones = {},
): Promise<Reclamo | null> {
  const { ahora = () => Date.now() } = o;
  const r = await db.meta.get('reclamo');
  if (r?.clave !== 'reclamo' || r.estado !== 'subiendo') return r?.clave === 'reclamo' ? r : null;
  if (!r.encolado || (await db.outbox.count()) > 0) return r;
  const celda = await resumenDeLaNube(destino, o);
  const propios = await db.registros
    .filter((x) => x.dispositivo_id === destino.dispositivo)
    .count();
  const catalogos = await db.catalogos.count();
  let nuevo: Reclamo;
  if (celda.caja.registros >= propios && celda.catalogos >= catalogos) {
    nuevo = {
      ...r,
      estado: 'verificado',
      verificado: { registros: celda.caja.registros, catalogos: celda.catalogos, cuando: ahora() },
    };
  } else if ((await db.rechazos.count()) > 0) {
    nuevo = { ...r, estado: 'con-rechazos' };
  } else {
    nuevo = { ...r, encolado: false };
  }
  await db.meta.put(nuevo);
  return nuevo;
}

/** Una caja del parqueadero, como la lista la celda (`GET /api/v1/dispositivos`). */
export interface CajaDeLaNube {
  readonly dispositivo: string;
  readonly serie: string;
  readonly nombre: string;
  readonly estado: 'activo' | 'retirado';
  readonly creado: string;
  readonly retirado: string | null;
  readonly ultimo: number;
}

export async function cajasDelParqueadero(
  destino: { api: string; acceso: string },
  o: Opciones = {},
): Promise<CajaDeLaNube[]> {
  const { fetchFn = fetch } = o;
  const r = await pedir(fetchFn, `${destino.api}/api/v1/dispositivos`, { acceso: destino.acceso });
  if (r.estado !== 200 || !Array.isArray(r.datos['dispositivos'])) {
    throw new ErrorDeCuenta(motivo(r.datos, `La nube respondió ${r.estado}.`));
  }
  return r.datos['dispositivos'] as CajaDeLaNube[];
}

/** Retira una caja (HU-Q7.7 CA2): no sube ni baja nada más; lo suyo sigue con su serie. */
export async function retirarCaja(
  destino: { api: string; acceso: string },
  dispositivo: string,
  o: Opciones = {},
): Promise<void> {
  const { fetchFn = fetch } = o;
  const r = await pedir(fetchFn, `${destino.api}/api/v1/dispositivos/retirar`, {
    acceso: destino.acceso,
    cuerpo: { dispositivo },
  });
  if (r.estado !== 200) throw new ErrorDeCuenta(motivo(r.datos, `La nube respondió ${r.estado}.`));
}

/**
 * Lo que tiene esta caja frente a lo que tiene la nube del parqueadero (HU-Q7.9): con la caja al
 * día, su archivo de respaldo tiene todo lo de la nube. Null sin vínculo o sin respuesta.
 */
export async function compararConLaNube(
  db: BaseDeLaCaja,
  o: Opciones = {},
): Promise<{ registros: [number, number]; catalogos: [number, number] } | null> {
  const destino = await destinoDeLaCaja(db);
  if (!destino) return null;
  try {
    const nube = await resumenDeLaNube(destino, o);
    return {
      registros: [await db.registros.count(), nube.registros],
      catalogos: [await db.catalogos.count(), nube.catalogos],
    };
  } catch {
    return null;
  }
}

/**
 * Cierra en el CORE las sesiones de la cuenta abiertas en esa caja (HU-Q7.7 CA2): el CORE anota
 * la caja de cada sesión al canjear (`dispositivo`) y `telefonos/retirar` revoca su renovación. El
 * acceso ya emitido vence solo (12 h); hasta entonces la celda le cierra la puerta por su id.
 * Solo alcanza las sesiones de esta misma cuenta. Devuelve cuántas cerró; sin señal, ninguna.
 */
export async function cerrarSesionesDeLaCaja(
  db: BaseDeLaCaja,
  core: string,
  caja: string,
  o: Opciones = {},
): Promise<number> {
  const { fetchFn = fetch } = o;
  const sesion = await leerSesion(db);
  if (!sesion) return 0;
  try {
    const vistos = await pedir(fetchFn, `${core}/api/core/telefonos/ver`, {
      acceso: sesion.acceso,
      cuerpo: {},
    });
    const telefonos = vistos.datos['telefonos'];
    if (vistos.estado !== 200 || !Array.isArray(telefonos)) return 0;
    let cerradas = 0;
    for (const t of telefonos as { id: string; dispositivo: string }[]) {
      if (t.dispositivo !== caja) continue;
      const r = await pedir(fetchFn, `${core}/api/core/telefonos/retirar`, {
        acceso: sesion.acceso,
        cuerpo: { id: t.id },
      });
      if (r.estado === 200) cerradas++;
    }
    return cerradas;
  } catch {
    return 0;
  }
}
