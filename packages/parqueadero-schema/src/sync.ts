/**
 * El protocolo de sincronización con las entidades del parqueadero (HU-Q7.3, ADR-39): el mismo
 * `@ed1/sync` del cuaderno, con los registros y catálogos de la caja. Lo usará la API de la celda
 * del parqueadero (HU-Q7.4) y la caja que sincroniza (HU-Q7.5); hoy lo prueba su batería.
 */
import {
  type CambioDeCatalogoDe,
  type CatalogoValido,
  crearValidador,
  type OperacionDe,
  type OperacionValidaDe,
  type PedidoPushDe,
  type RespuestaPullDe,
} from '@ed1/sync';
import type { ZodType } from 'zod';
import { abonado, ajusteRecibo, punto, sede, tarifa } from './catalogos.ts';
import { ErrorDeValidacion, type Registro, validarCatalogo, validarRegistro } from './registro.ts';
import { ENTIDADES, type Entidad as EntidadDeCatalogoDelAnexo } from './tipos.ts';

/**
 * Los catálogos que viajan: los de `ref_entidad` del anexo A, en el orden en que la caja los
 * necesita (la sede antes que el resto).
 */
export const ENTIDADES_DE_CATALOGO = ENTIDADES;
export type EntidadDeCatalogo = EntidadDeCatalogoDelAnexo;
export type Entidad = 'registro' | EntidadDeCatalogo;

const ESQUEMAS: Readonly<Record<EntidadDeCatalogo, ZodType<unknown>>> = {
  sede,
  tarifa,
  abonado,
  ajuste_recibo: ajusteRecibo,
  punto,
};

export type Operacion = OperacionDe<EntidadDeCatalogo>;
export type PedidoPush = PedidoPushDe<EntidadDeCatalogo>;
export type OperacionValida = OperacionValidaDe<Registro, EntidadDeCatalogo>;
export type CambioDeCatalogo = CambioDeCatalogoDe<EntidadDeCatalogo>;
export type RespuestaPull = RespuestaPullDe<Registro, EntidadDeCatalogo>;

/** Valida una operación del lote de una caja; lo que no sirve sale con su motivo en palabras. */
export const validarOperacion = crearValidador<Registro, EntidadDeCatalogo>({
  catalogos: ENTIDADES_DE_CATALOGO,
  validarRegistro,
  validarCatalogo: (entidad, datos) =>
    validarCatalogo(entidad, ESQUEMAS[entidad], datos) as CatalogoValido,
  esErrorDeValidacion: (e): e is Error => e instanceof ErrorDeValidacion,
});
export * from './permisos.ts';
