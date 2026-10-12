/**
 * Roles y permisos del parqueadero (HU-Q7.8, PARQUEADERO §11.2) sobre la matriz común de
 * `@ed1/sync`: un solo dato para la celda, que decide, y la caja, que esconde (P2, P12). Un permiso
 * escondido en la pantalla es un adorno: lo que cuenta es `decidirEscritura` en la API (bitácora
 * ecommerce 64).
 *
 * - Los roles son los de `infrastructure/productos.json`; una prueba ata las dos listas.
 * - `TABLA` es la tabla de §11.2 tal cual, y una prueba la compara con el documento.
 * - En M0 la caja no tiene cuentas: el PIN de administrador sigue protegiendo lo mismo. La matriz
 *   entra a la caja con la cuenta (HU-Q7.6) y a la celda con su API (HU-Q7.4).
 */
import { type Accion, crearPermisos, type MatrizDe } from '@ed1/sync';
import type { Registro } from './registro.ts';
import type { Entidad, EntidadDeCatalogo, OperacionValida } from './sync.ts';

export const ROLES = ['propietario', 'administrador', 'cajero'] as const;
export type Rol = (typeof ROLES)[number];

/** Lo que el rol puede con una fila de §11.2: todo, nada, o solo lo suyo. */
export type Alcance = 'si' | 'no' | 'suyo';

/** Las filas de PARQUEADERO §11.2, con su texto exacto en el documento. */
export const ACCIONES_DE_SEDE = {
  registrar: 'Registrar entrada y salida, cobrar, imprimir, enviar',
  turno: 'Abrir y cerrar su turno',
  anular: 'Anular',
  reimprimir: 'Reimprimir (copia)',
  ajustes: 'Tarifas, datos legales, textos del recibo',
  reportes: 'Ver reportes de todos los turnos',
  dispositivos: 'Dispositivos: dar de alta, retirar',
  equipo: 'Equipo, plan y pago',
} as const;
export type AccionDeSede = keyof typeof ACCIONES_DE_SEDE;

export const TABLA: Readonly<Record<AccionDeSede, Readonly<Record<Rol, Alcance>>>> = {
  registrar: { propietario: 'si', administrador: 'si', cajero: 'si' },
  turno: { propietario: 'si', administrador: 'si', cajero: 'si' },
  anular: { propietario: 'si', administrador: 'si', cajero: 'suyo' },
  reimprimir: { propietario: 'si', administrador: 'si', cajero: 'si' },
  ajustes: { propietario: 'si', administrador: 'si', cajero: 'no' },
  reportes: { propietario: 'si', administrador: 'si', cajero: 'suyo' },
  dispositivos: { propietario: 'si', administrador: 'si', cajero: 'no' },
  equipo: { propietario: 'si', administrador: 'no', cajero: 'no' },
};

/** Lo que ese rol puede con esa fila; un rol desconocido, nada. */
export const alcance = (rol: string, accion: AccionDeSede): Alcance =>
  TABLA[accion][rol as Rol] ?? 'no';

/** Un cajero anula solo lo suyo y en estos primeros minutos después del recibo (§11.2). */
export const MINUTOS_PARA_ANULAR_LO_SUYO = 10;

const TODOS: readonly Rol[] = ROLES;
const quienes = (accion: AccionDeSede, incluyeSuyo = true): readonly Rol[] =>
  ROLES.filter((r) => TABLA[accion][r] === 'si' || (incluyeSuyo && TABLA[accion][r] === 'suyo'));

/**
 * Las entidades que viajan por la sincronización. Todos leen todo lo de su sede: dos cajas
 * necesitan los vehículos de la otra. Los catálogos (sede, tarifas, textos del recibo, puntos y
 * abonados) son «ajustes»: en M0 los protege el PIN de administrador.
 */
export const MATRIZ: MatrizDe<Entidad, Rol> = {
  registro: { leer: TODOS, escribir: quienes('registrar') },
  sede: { leer: TODOS, escribir: quienes('ajustes') },
  tarifa: { leer: TODOS, escribir: quienes('ajustes') },
  abonado: { leer: TODOS, escribir: quienes('ajustes') },
  ajuste_recibo: { leer: TODOS, escribir: quienes('ajustes') },
  punto: { leer: TODOS, escribir: quienes('ajustes') },
};

/** Tipos de registro con permisos propios; los demás siguen la fila `registro`. */
export const MATRIZ_DE_REGISTROS: Readonly<
  Record<string, Readonly<Record<Accion, readonly Rol[]>>>
> = {
  // El cajero anula también, pero solo lo suyo: lo termina de decidir `decidirEscritura`.
  anulacion: { leer: TODOS, escribir: quienes('anular') },
};

export const NOMBRE_DE_ROL: Readonly<Record<Rol, string>> = {
  propietario: 'propietario',
  administrador: 'administrador',
  cajero: 'cajero',
};

export const { puede, puedeRegistro, tiposNegados, entidadesQuePuede, motivoSinPermiso } =
  crearPermisos<Rol, EntidadDeCatalogo>({
    matriz: MATRIZ,
    matrizDeRegistros: MATRIZ_DE_REGISTROS,
    nombreDeRol: NOMBRE_DE_ROL,
    nombreDeEntidad: {
      registro: 'registros',
      sede: 'los datos de la sede',
      tarifa: 'las tarifas',
      abonado: 'los abonados',
      ajuste_recibo: 'los textos del recibo',
      punto: 'los puntos de entrada y salida',
    },
    nombreDeTipo: { anulacion: 'las anulaciones' },
    aQuienPedir: 'Pídaselo a quien administra el parqueadero.',
  });

/** Quién escribe: el rol y el usuario del token del CORE (`aud = parqueadero`). */
export interface Quien {
  readonly rol: string;
  readonly usuario_id: string;
}

export type Decision = { readonly ok: true } | { readonly ok: false; readonly motivo: string };

const si: Decision = { ok: true };
const no = (motivo: string): Decision => ({ ok: false, motivo });

/**
 * Lo que la celda decide ante cada operación de un push (HU-Q7.8 CA3): la matriz, más las dos
 * reglas de §11.2 que una matriz no dice.
 *
 * - Una anulación de un cajero: solo de un recibo suyo, hecha en los primeros
 *   `MINUTOS_PARA_ANULAR_LO_SUYO` minutos. Cuenta la hora de la anulación, no la de la celda: la
 *   caja anula sin red y sube después (P1). `anulado` es el registro que anula, leído de la celda;
 *   si la celda no lo tiene, el cajero no puede anularlo.
 * - Una copia reimpresa queda con su usuario: sin `autor_usuario_id` no se acepta.
 */
export function decidirEscritura(
  quien: Quien,
  op: OperacionValida,
  anulado?: Pick<Registro, 'autor_usuario_id' | 'instante_evento'> | null,
): Decision {
  if (op.entidad !== 'registro') {
    return puede(quien.rol, 'escribir', op.entidad)
      ? si
      : no(motivoSinPermiso(quien.rol, op.entidad));
  }
  const r = op.registro;
  if (!puedeRegistro(quien.rol, 'escribir', r.tipo)) {
    return no(motivoSinPermiso(quien.rol, 'registro', r.tipo));
  }
  if (r.tipo === 'anulacion' && alcance(quien.rol, 'anular') === 'suyo') {
    if (!anulado || anulado.autor_usuario_id !== quien.usuario_id) {
      return no(`Con el rol de ${NOMBRE_DE_ROL.cajero} solo se anula un recibo propio.`);
    }
    const minutos = (Date.parse(r.instante_evento) - Date.parse(anulado.instante_evento)) / 60_000;
    if (minutos > MINUTOS_PARA_ANULAR_LO_SUYO) {
      return no(
        `Pasaron más de ${MINUTOS_PARA_ANULAR_LO_SUYO} minutos desde el recibo: lo anula quien administra el parqueadero.`,
      );
    }
  }
  if (r.tipo === 'entrega_recibo' && r.autor_usuario_id === null) {
    const copia = (r.datos as { copia?: boolean }).copia === true;
    if (copia) return no('Una copia queda registrada con el usuario que la imprimió.');
  }
  return si;
}
