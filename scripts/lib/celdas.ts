/**
 * Celdas del agro (ARQUITECTURA §5.5 y §7.3, HU-E1.5). `infrastructure/celdas.json` es la única
 * lista (P2): de aquí salen la configuración de wrangler y el orden del despliegue.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { RAIZ } from './repo.ts';

export interface Celda {
  id: string;
  /** El producto al que sirve (HU-C1.4): uno de `infrastructure/productos.json`. */
  producto: string;
  cuenta: string;
  plan: 'free' | 'paid' | 'cliente';
  anillo_despliegue: number;
  estado: 'activa' | 'fuera';
  /** Nombres de los secretos de GitHub: token de despliegue, cuenta y token de métricas (HU-E8.2). */
  secretos: { token: string; cuenta: string; metricas: string };
  /** URL de la API de la celda (HU-E5.1), por destino. */
  api: string;
  api_staging: string;
  shards: string[];
  /** La base de control del producto (`<producto>_control`), si la tiene: la Tienda (HU-T2.3). */
  control?: string;
  /** El bucket R2 de la celda (HU-T4.4); en staging, con `-staging`. */
  almacen?: string;
  /** El bucket R2 público de las fotos (HU-T5.6), aparte del almacén privado. */
  medios?: string;
  /**
   * HU-T8.3: los ambientes donde el dueño ya creó el bucket de las fotos
   * (`docs/runbooks/tienda-fotos.md`). Solo ahí la API lo enlaza como `FOTOS`: enlazar un bucket que
   * no existe hace fallar el despliegue.
   */
  medios_creados?: ('produccion' | 'staging')[];
  /**
   * HU-T13.1: el dueño ya activó Cloudflare for SaaS en la zona de las tiendas, con su origen de
   * respaldo (`docs/runbooks/tienda-conectar-un-dominio.md`). Solo entonces la API de producción sabe
   * su zona y el despacho recibe los dominios propios. Staging nunca: el origen de respaldo es uno
   * por zona y es el de producción.
   */
  saas?: boolean;
}

export interface ConfigCeldas {
  sitio: {
    celda: string;
    worker: string;
    dominio: string;
    url_staging: string;
    zona: string;
    dataset_eventos: string;
  };
  /** CORE v0 (ARQUITECTURA §5.4): su Worker y su base D1 viven en la cuenta de `celda`. */
  core: {
    celda: string;
    worker: string;
    d1: string;
    url: string;
    url_staging: string;
    /** Dominio propio en producción y su zona (HU-C4.6). */
    dominio?: string;
    zona?: string;
  };
  celdas: Celda[];
}

const leerJson = (ruta: string) => JSON.parse(readFileSync(join(RAIZ, ruta), 'utf8'));

/** Lee y valida celdas.json; lanza con todas las fallas, ids repetidos o un sitio o CORE sin celda. */
export function cargarCeldas(
  datos: unknown = leerJson('infrastructure/celdas.json'),
): ConfigCeldas {
  const validar = new Ajv2020({ allErrors: true, strict: true }).compile(
    leerJson('schemas/celdas.schema.json'),
  );
  if (!validar(datos)) {
    const fallas = (validar.errors ?? []).map((e) => `${e.instancePath || '(raíz)'} ${e.message}`);
    throw new Error(`celdas.json inválido:\n- ${fallas.join('\n- ')}`);
  }
  const config = datos as ConfigCeldas;
  const ids = config.celdas.map((c) => c.id);
  const repetidos = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (repetidos.length > 0) throw new Error(`celdas.json repite ids: ${repetidos.join(', ')}`);
  // Los shards se llaman <producto>_c<N>_s<k> (PLATAFORMA §4.9): el nombre dice de quién es la base.
  const shardsAjenos = config.celdas.flatMap((c) =>
    c.shards.filter((s) => !s.startsWith(`${c.producto}_${c.id}_s`)).map((s) => `${c.id}: ${s}`),
  );
  if (shardsAjenos.length > 0) {
    throw new Error(
      `celdas.json tiene shards que no llevan el producto y la celda en el nombre: ${shardsAjenos.join(', ')}`,
    );
  }
  // HU-T5.6: el bucket público de las fotos nunca es el almacén privado (respaldos, exportaciones).
  for (const c of config.celdas.filter((x) => x.medios !== undefined && x.medios === x.almacen)) {
    throw new Error(
      `celdas.json: ${c.id} usa «${c.medios}» para las fotos y para su almacén; el de las fotos es público y el almacén guarda datos personales`,
    );
  }
  // HU-T2.3: la base de control lleva el nombre de su producto, y es una sola por producto.
  for (const c of config.celdas.filter((x) => x.control !== undefined)) {
    if (c.control !== `${c.producto}_control`) {
      throw new Error(
        `celdas.json: la base de control de ${c.id} es «${c.control}»; debe ser ${c.producto}_control`,
      );
    }
  }
  for (const [quien, celdaId] of [
    ['El sitio', config.sitio.celda],
    ['El CORE', config.core.celda],
  ] as const) {
    const celda = config.celdas.find((c) => c.id === celdaId);
    if (!celda) throw new Error(`${quien} apunta a la celda «${celdaId}», que no existe`);
    if (celda.estado === 'fuera')
      throw new Error(`${quien} apunta a «${celda.id}», que está «fuera»`);
  }
  return config;
}

export interface Plan {
  /** En orden de anillo; dentro del mismo anillo, por id. */
  aDesplegar: Celda[];
  /** Marcadas «fuera»: no reciben despliegues (CA4). */
  fuera: Celda[];
}

/** Orden del despliegue. `soloCelda` despliega una sola (para seguir después de una falla). */
export function planDeDespliegue(config: ConfigCeldas, soloCelda?: string): Plan {
  const ordenadas = [...config.celdas].sort(
    (a, b) =>
      a.anillo_despliegue - b.anillo_despliegue ||
      a.id.localeCompare(b.id, 'es', { numeric: true }),
  );
  const fuera = ordenadas.filter((c) => c.estado === 'fuera');
  let aDesplegar = ordenadas.filter((c) => c.estado === 'activa');
  if (soloCelda) {
    const elegida = config.celdas.find((c) => c.id === soloCelda);
    if (!elegida) throw new Error(`No existe la celda «${soloCelda}» en celdas.json`);
    if (elegida.estado === 'fuera')
      throw new Error(`La celda «${soloCelda}» está «fuera»: no recibe despliegues`);
    aDesplegar = [elegida];
  }
  return { aDesplegar, fuera };
}

/** Nombres de todos los secretos que nombran las celdas (para atarlos al flujo y a §7.5). */
export function secretosDeCeldas(config: ConfigCeldas): string[] {
  return [...new Set(config.celdas.flatMap((c) => [c.secretos.token, c.secretos.cuenta]))].sort();
}
