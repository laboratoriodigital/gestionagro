/**
 * Los eventos de la caja del parqueadero (HU-Q5.3, PARQUEADERO §14.4): cuántos recibos salen por
 * cada canal y cuántas impresiones fallan, para medir la meta de menos papel y la de impresión
 * confiable. Lista cerrada (P10): un evento, un adaptador o una causa fuera de ella no se cuenta,
 * no se manda y el Worker lo rechaza.
 *
 * Sin datos personales (P13): un evento es su nombre y, si falló una impresión, el adaptador y la
 * causa, todos de una lista. No hay dónde poner una placa, un número o un nombre: la clave de un
 * conteo solo se arma con valores de estas listas, y `leerClave` rechaza cualquier otra.
 *
 * La caja suma los conteos sin red y los manda en lote cuando hay (CA2). Un lote es un objeto de
 * claves y cuentas: `{"recibo.papel": 12, "impresion.fallida/bluetooth/tiempo": 1}`.
 */

export const EVENTOS_DE_LA_CAJA = [
  'recibo.papel',
  'recibo.whatsapp',
  'recibo.pantalla',
  'recibo.copia',
  'impresion.fallida',
  'respaldo.hecho',
  'turno.cerrado',
] as const;
export type NombreDeEventoDeLaCaja = (typeof EVENTOS_DE_LA_CAJA)[number];

/** Por dónde iba el papel: los caminos de `@ed1/impresion`, o `ninguno` sin impresora. */
export const ADAPTADORES_DE_IMPRESION = [
  'bluetooth',
  'serial',
  'sistema',
  'rawbt',
  'prueba',
  'ninguno',
] as const;
export type AdaptadorDeImpresion = (typeof ADAPTADORES_DE_IMPRESION)[number];

/**
 * Por qué falló: los motivos de `@ed1/impresion` (una prueba de repositorio los ata, P2), más
 * `no_salio`, el «No salió» del cajero cuando el envío salió y el papel no.
 */
export const CAUSAS_DE_FALLO = [
  'cancelado',
  'sin_permiso',
  'fuera_de_alcance',
  'enlace_ocupado',
  'sin_caracteristica',
  'tiempo',
  'sin_papel',
  'no_soportado',
  'no_salio',
] as const;
export type CausaDeFallo = (typeof CAUSAS_DE_FALLO)[number];

export type EventoDeLaCaja =
  | { readonly evento: Exclude<NombreDeEventoDeLaCaja, 'impresion.fallida'> }
  | {
      readonly evento: 'impresion.fallida';
      readonly adaptador: AdaptadorDeImpresion;
      readonly causa: CausaDeFallo;
    };

export const PRODUCTO_DE_LA_CAJA = 'parqueadero-caja';
export const VERSION_DEL_LOTE_DE_LA_CAJA = 2;

/** Cuántas veces pasó cada evento, por su clave. */
export type Conteos = Readonly<Record<string, number>>;

export interface LoteDeLaCaja {
  readonly v: typeof VERSION_DEL_LOTE_DE_LA_CAJA;
  readonly producto: typeof PRODUCTO_DE_LA_CAJA;
  readonly conteos: Conteos;
}

/** Lo más que un lote puede contar de una clave: una caja sin red una semana, con holgura. */
export const CUENTA_MAXIMA_DE_LA_CAJA = 100_000;

const incluye = <T extends string>(lista: readonly T[], valor: unknown): valor is T =>
  typeof valor === 'string' && (lista as readonly string[]).includes(valor);

/** La clave de un conteo: el nombre, y con una impresión fallida, su adaptador y su causa. */
export function claveDeEvento(e: EventoDeLaCaja): string {
  return e.evento === 'impresion.fallida' ? `${e.evento}/${e.adaptador}/${e.causa}` : e.evento;
}

/** El evento de una clave, o `null` si algo en ella no está en las listas. */
export function leerClave(clave: string): EventoDeLaCaja | null {
  const [evento, adaptador, causa, ...resto] = clave.split('/');
  if (resto.length > 0 || !incluye(EVENTOS_DE_LA_CAJA, evento)) return null;
  if (evento === 'impresion.fallida') {
    if (!incluye(ADAPTADORES_DE_IMPRESION, adaptador) || !incluye(CAUSAS_DE_FALLO, causa)) {
      return null;
    }
    return { evento, adaptador, causa };
  }
  return adaptador === undefined ? { evento } : null;
}

/** Un adaptador cualquiera, en la lista: lo que no está cuenta como `ninguno`. */
export const adaptadorDe = (camino: string | null | undefined): AdaptadorDeImpresion =>
  incluye(ADAPTADORES_DE_IMPRESION, camino) ? camino : 'ninguno';

/** Suma uno a la clave del evento. */
export function contar(conteos: Conteos, e: EventoDeLaCaja): Conteos {
  const clave = claveDeEvento(e);
  return { ...conteos, [clave]: (conteos[clave] ?? 0) + 1 };
}

/** Lo que queda después de mandar `enviados`: lo contado mientras viajaba el lote no se pierde. */
export function descontar(conteos: Conteos, enviados: Conteos): Conteos {
  const quedan: Record<string, number> = {};
  for (const [clave, cuenta] of Object.entries(conteos)) {
    const resto = cuenta - (enviados[clave] ?? 0);
    if (resto > 0) quedan[clave] = resto;
  }
  return quedan;
}

/** El lote de lo contado, o `null` si no hay nada que mandar. */
export function armarLoteDeLaCaja(conteos: Conteos): LoteDeLaCaja | null {
  const validos = Object.fromEntries(
    Object.entries(conteos).filter(([clave, cuenta]) => leerClave(clave) && cuenta > 0),
  );
  if (Object.keys(validos).length === 0) return null;
  return { v: VERSION_DEL_LOTE_DE_LA_CAJA, producto: PRODUCTO_DE_LA_CAJA, conteos: validos };
}

/** Valida un lote de la caja. Devuelve el motivo del rechazo, o `null` si es válido. */
export function motivoDeRechazoDeLaCaja(lote: unknown): string | null {
  if (typeof lote !== 'object' || lote === null || Array.isArray(lote)) {
    return 'el lote no es un objeto';
  }
  const l = lote as Record<string, unknown>;
  const sobran = Object.keys(l).filter((k) => !['v', 'producto', 'conteos'].includes(k));
  if (sobran.length > 0) return `campos desconocidos: ${sobran.join(', ')}`;
  if (l['v'] !== VERSION_DEL_LOTE_DE_LA_CAJA)
    return `versión de lote desconocida: ${String(l['v'])}`;
  if (l['producto'] !== PRODUCTO_DE_LA_CAJA)
    return `producto desconocido: ${String(l['producto'])}`;
  const conteos = l['conteos'];
  if (typeof conteos !== 'object' || conteos === null || Array.isArray(conteos)) {
    return 'faltan los conteos';
  }
  const entradas = Object.entries(conteos);
  if (entradas.length === 0) return 'el lote no trae conteos';
  for (const [clave, cuenta] of entradas) {
    if (!leerClave(clave)) return `evento desconocido: ${clave}`;
    if (!Number.isInteger(cuenta) || (cuenta as number) < 1) {
      return `cuenta inválida para ${clave}: ${String(cuenta)}`;
    }
    if ((cuenta as number) > CUENTA_MAXIMA_DE_LA_CAJA) return `cuenta demasiado grande: ${clave}`;
  }
  return null;
}
