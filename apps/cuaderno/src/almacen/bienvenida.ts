/**
 * La bienvenida del cuaderno (HU-E0.10): la primera pantalla de un teléfono sin finca y sin cuenta.
 * Ofrece entrar con la cuenta o empezar en el teléfono sin ella (la cuenta es opcional, ED1 §28).
 *
 * Quien elige «empezar sin cuenta» no la vuelve a ver en este teléfono: se guarda en la base local.
 * Con una finca, con una sesión, con una invitación por aceptar o con otra finca en el teléfono
 * (se está agregando una más, HU-E4.7), nunca se muestra: hay a dónde ir.
 */
import type { CuadernoDb } from './db.ts';
import { fincasLocales } from './fincas-locales.ts';
import { codigoPendiente } from './invitacion.ts';
import { leerSesion } from './sesion.ts';

export const CLAVE_SIN_CUENTA = 'empezo_sin_cuenta';

export interface EstadoDeEntrada {
  hayFinca: boolean;
  haySesion: boolean;
  hayInvitacion: boolean;
  hayOtrasFincas: boolean;
  empezoSinCuenta: boolean;
}

export const mostrarBienvenida = (e: EstadoDeEntrada): boolean =>
  !e.hayFinca && !e.haySesion && !e.hayInvitacion && !e.hayOtrasFincas && !e.empezoSinCuenta;

/** Lo que decide la bienvenida, leído de la base local (sin la finca, que la trae `Inicio`). */
export async function leerEstadoDeEntrada(
  db: CuadernoDb,
  locales: () => readonly unknown[] = fincasLocales,
): Promise<Omit<EstadoDeEntrada, 'hayFinca'>> {
  const [sesion, invitacion, sinCuenta] = await Promise.all([
    leerSesion(db),
    codigoPendiente(db),
    db.meta.get(CLAVE_SIN_CUENTA),
  ]);
  return {
    haySesion: sesion !== null,
    hayInvitacion: invitacion !== null,
    hayOtrasFincas: locales().length > 0,
    empezoSinCuenta: sinCuenta?.valor === true,
  };
}

export async function empezarSinCuenta(db: CuadernoDb): Promise<void> {
  await db.meta.put({
    clave: CLAVE_SIN_CUENTA,
    valor: true,
    actualizado: new Date().toISOString(),
  });
}
