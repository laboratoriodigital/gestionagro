/**
 * El protocolo de sincronización con las entidades del agro (HU-Q7.3): `@ed1/sync` no sabe de
 * fincas; el cuaderno y su celda lo usan desde aquí, con los mismos nombres de antes. El formato
 * en el cable no cambió.
 */
import {
  type CambioDeCatalogoDe,
  type CatalogoValido,
  crearValidador,
  type OperacionDe,
  type OperacionValidaDe,
  type PedidoPushDe,
  pedidoDeActualizar as pedidoGeneral,
  type RespuestaPullDe,
  type RespuestaPush,
} from '@ed1/sync';
import type { ZodType } from 'zod';
import { FILAS_EXPORTADAS } from './exportacion.ts';
import { ErrorDeValidacion, type Registro, validarCatalogo, validarRegistro } from './registro.ts';

export * from '@ed1/sync';
export * from './permisos-sync.ts';

export const ENTIDADES_DE_CATALOGO = [
  'finca',
  'area',
  'ciclo',
  'persona',
  'insumo',
  'cultivo',
  'valor_jornal',
  'tipo_labor',
  'categoria_calidad',
] as const;
export type EntidadDeCatalogo = (typeof ENTIDADES_DE_CATALOGO)[number];
export type Entidad = 'registro' | EntidadDeCatalogo;

export type Operacion = OperacionDe<EntidadDeCatalogo>;
export type PedidoPush = PedidoPushDe<EntidadDeCatalogo>;
export type OperacionValida = OperacionValidaDe<Registro, EntidadDeCatalogo>;
export type CambioDeCatalogo = CambioDeCatalogoDe<EntidadDeCatalogo>;
export type RespuestaPull = RespuestaPullDe<Registro, EntidadDeCatalogo>;

/**
 * Versión mínima del cuaderno que la celda considera al día. Subirla no rechaza nada: las apps más
 * viejas siguen subiendo y reciben el pedido de actualizar. Se sube cuando una versión tiene un
 * defecto que el teléfono debe dejar atrás; se anota el motivo en el CHANGELOG.
 */
export const APP_MINIMA = '0.1.0';

export const MOTIVO_ACTUALIZAR =
  'Esta versión del cuaderno ya es vieja. Actualízala para seguir sincronizando sin problemas; lo que registraste se está enviando igual.';

/** Lo que la celda agrega a la respuesta del push según la versión del cuaderno que envía. */
export function pedidoDeActualizar(
  app: unknown,
  minima: string = APP_MINIMA,
): RespuestaPush['actualizar'] {
  return pedidoGeneral(app, minima, MOTIVO_ACTUALIZAR);
}

/**
 * Valida una operación del lote del cuaderno con los esquemas de este paquete. Devuelve el motivo
 * en palabras si no sirve: la celda lo guarda en cuarentena y el teléfono lo muestra en rojo
 * (HU-E3.14).
 */
export const validarOperacion = crearValidador<Registro, EntidadDeCatalogo>({
  catalogos: ENTIDADES_DE_CATALOGO,
  validarRegistro,
  validarCatalogo: (entidad, datos) =>
    validarCatalogo(
      entidad,
      FILAS_EXPORTADAS[entidad] as ZodType<unknown>,
      datos,
    ) as CatalogoValido,
  esErrorDeValidacion: (e): e is Error => e instanceof ErrorDeValidacion,
});
