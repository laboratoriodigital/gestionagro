/**
 * La pantalla del dominio propio (HU-T13.1 a HU-T13.3, TIENDA-3.0 §4.2 y §4.3): las direcciones de
 * la tienda, los registros que el comercio crea en su proveedor y su estado, que la API pregunta a
 * Cloudflare al abrir la pantalla.
 */
import type { EstadoDelDominio, Registro } from '@ed1/tienda-schema/dominios';
import { type Conexion, pedirAlPanel } from './api.ts';
import { opNueva } from './catalogo.ts';

export interface DominioDelPanel {
  hostname: string;
  tipo: 'plataforma' | 'propio';
  rol: 'canonico' | 'alias';
  estado: EstadoDelDominio;
  enPalabras: string;
  motivo: string | null;
  registros: Registro[];
  activado: string | null;
}

export interface DominiosDelPanel {
  disponible: boolean;
  dominios: DominioDelPanel[];
}

export const leerDominios = (c: Conexion) => pedirAlPanel<DominiosDelPanel>(c, 'dominios');

export const conectarDominio = (c: Conexion, hostname: string) =>
  pedirAlPanel<{ estado: 'guardado'; dominio?: DominioDelPanel }>(c, 'dominios/conectar', {
    cuerpo: { op: opNueva(), hostname },
  });

export const elegirPrincipal = (c: Conexion, hostname: string) =>
  pedirAlPanel<{ estado: 'guardado' }>(c, 'dominios/canonico', {
    cuerpo: { op: opNueva(), hostname },
  });

export const desconectarDominio = (c: Conexion, hostname: string) =>
  pedirAlPanel<{ estado: 'guardado' }>(c, 'dominios/retirar', {
    cuerpo: { op: opNueva(), hostname },
  });

/** Cada cuánto se vuelve a preguntar mientras un dominio espera y la pantalla sigue abierta. */
export const REVISAR_CADA_MS = 60_000;

/** Si alguno espera a Cloudflare: la pantalla vuelve a preguntar sola. */
export const algunoEspera = (d: readonly DominioDelPanel[]) =>
  d.some((x) => x.estado === 'pendiente' || x.estado === 'validando');

/** El papel de una dirección, en palabras. */
export const rolEnPalabras = (d: DominioDelPanel) =>
  d.estado !== 'activo'
    ? null
    : d.rol === 'canonico'
      ? 'Dirección principal: la que ve Google'
      : 'Lleva a la dirección principal';
