/**
 * `node scripts/generar-wrangler.ts`: genera `apps/sitio/wrangler.jsonc` (HU-E1.5, CA1) y
 * `apps/core/wrangler.jsonc` (HU-E4.1) desde `celdas.json`, y las de las apps del parqueadero y de
 * la Tienda (HU-T2.3). No se editan a mano; una prueba exige que sean los generados (P2).
 *
 * - El sitio es asset estático; solo `/api/*` ejecuta el Worker (ED1 [H3]).
 * - Ningún id de cuenta en el archivo: wrangler lo toma de `CLOUDFLARE_ACCOUNT_ID` (ADR-6).
 * - Producción en el dominio de ADR-19; staging en workers.dev, con su propio dataset de eventos.
 * - El CORE vive en workers.dev en los dos entornos, con una base D1 por entorno. El id de la base
 *   lo agrega el despliegue en un archivo fuera de git (ADR-6), como el del KV de flags.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RegistroDeProductos } from '@ed1/productos';
import { ENSAYOS, hostDeStaging } from '../packages/tienda-schema/src/ensayos.ts';
import {
  DOMINIO_DE_LA_MARCA,
  REMITENTE_DE_LOS_CORREOS,
  ZONA_ANTERIOR,
  ZONA_DE_LAS_TIENDAS,
} from '../packages/tienda-schema/src/marca.ts';
import { type Celda, type ConfigCeldas, cargarCeldas } from './lib/celdas.ts';
import { RUTAS_DEL_WORKER } from './lib/cuenta.ts';
import { cargarProductos } from './lib/registro-productos.ts';
import { RAIZ } from './lib/repo.ts';

/** Fecha de compatibilidad del runtime de Workers. Cambiarla es una decisión, no un descuido. */
export const FECHA_COMPATIBILIDAD = '2026-09-30';

export const RUTA_WRANGLER_SITIO = join(RAIZ, 'apps', 'sitio', 'wrangler.jsonc');
export const RUTA_WRANGLER_CORE = join(RAIZ, 'apps', 'core', 'wrangler.jsonc');

/** Migraciones del CORE, relativas a apps/core (ARQUITECTURA §11: por base, en infrastructure/). */
export const MIGRACIONES_CORE = '../../infrastructure/migraciones/core';

export function wranglerDelSitio(config: ConfigCeldas): Record<string, unknown> {
  const { sitio } = config;
  return {
    $schema: 'node_modules/wrangler/config-schema.json',
    name: sitio.worker,
    main: 'src/worker.ts',
    compatibility_date: FECHA_COMPATIBILIDAD,
    assets: {
      directory: './dist',
      binding: 'ASSETS',
      run_worker_first: ['/api/*'],
    },
    workers_dev: false,
    routes: [{ pattern: sitio.dominio, custom_domain: true }],
    analytics_engine_datasets: [{ binding: 'EVENTOS', dataset: sitio.dataset_eventos }],
    observability: { enabled: true },
    env: {
      staging: {
        name: `${sitio.worker}-staging`,
        workers_dev: true,
        routes: [],
        analytics_engine_datasets: [
          { binding: 'EVENTOS', dataset: `${sitio.dataset_eventos}_staging` },
        ],
      },
    },
  };
}

export const CRON_CONCILIACION = '*/15 * * * *';

export function wranglerDelCore(config: ConfigCeldas): Record<string, unknown> {
  const { core } = config;
  const base = (nombre: string) => [
    { binding: 'DB', database_name: nombre, migrations_dir: MIGRACIONES_CORE },
  ];
  return {
    $schema: 'node_modules/wrangler/config-schema.json',
    name: core.worker,
    main: 'src/worker.ts',
    compatibility_date: FECHA_COMPATIBILIDAD,
    // HU-C4.6: el dominio propio, solo en producción. workers.dev sigue vivo: los cuadernos
    // instalados llaman a esa URL (P10).
    // HU-C7.2: la cuenta son assets del CORE. El Worker corre primero solo en sus rutas: una página
    // pública nunca gasta una invocación. Lo exige una prueba (CA3).
    assets: {
      directory: '../cuenta/dist',
      run_worker_first: [...RUTAS_DEL_WORKER],
      not_found_handling: '404-page',
    },
    workers_dev: true,
    ...(core.dominio ? { routes: [{ pattern: core.dominio, custom_domain: true }] } : {}),
    d1_databases: base(core.d1),
    // La conciliación de pagos (HU-E0.7), cada 15 min. Con el vigía de la celda son 4 de los 5
    // Cron Triggers que da la cuenta gratuita.
    triggers: { crons: [CRON_CONCILIACION] },
    observability: { enabled: true },
    env: {
      staging: {
        name: `${core.worker}-staging`,
        workers_dev: true,
        routes: [],
        d1_databases: base(`${core.d1}_staging`),
        triggers: { crons: [CRON_CONCILIACION] },
      },
    },
  };
}

/** Migraciones de los shards de una celda, relativas a apps/api-celda. */
export const MIGRACIONES_CELDA = '../../infrastructure/migraciones/celda';

export const rutaWranglerCelda = (celdaId: string) =>
  join(RAIZ, 'apps', 'api-celda', `wrangler.${celdaId}.jsonc`);

/** Nombre de la base de un shard en el destino: el mismo, con `_staging` en staging. */
export const baseDelShard = (shard: string, staging: boolean) =>
  staging ? `${shard}_staging` : shard;

/**
 * API de una celda (HU-E5.1): un Worker por celda, `agro-api-<celda>`, con un binding D1 por
 * shard, cuyo nombre es el del shard. El token dice el shard y el Worker toma ese binding.
 * Los ids de las bases, el KV de flags y la clave pública del CORE los agrega el despliegue.
 */
/**
 * El presupuesto que vigila una celda con Workers Paid (HU-C11.1): la suma de los de todos los
 * productos activos, porque las métricas son de toda la cuenta; y lo que se apaga, solo de su producto.
 */
export function presupuestoDeLaCelda(
  celda: Celda,
  registro: RegistroDeProductos = cargarProductos(),
): { PRESUPUESTO_USD_MES: string; AL_AGOTARSE: string; FILAS_D1_POR_PRODUCTO: string } {
  const activos = registro.productos.filter((p) => p.estado !== 'retirado');
  const suma = activos.reduce((s, p) => s + (p.presupuesto?.usd_mes ?? 0), 0);
  const propio = registro.productos.find((p) => p.id === celda.producto);
  // HU-Q7.13: en el plan gratuito, las filas de D1 por día que cada producto declara. El vigía mide
  // toda la cuenta, así que las conoce todas para decir quién pasó la suya.
  const filas = Object.fromEntries(
    activos.flatMap((p) =>
      p.presupuesto?.d1_filas_escritas_dia ? [[p.id, p.presupuesto.d1_filas_escritas_dia]] : [],
    ),
  );
  return {
    PRESUPUESTO_USD_MES: String(suma),
    AL_AGOTARSE: (propio?.presupuesto?.al_agotarse ?? []).join(','),
    FILAS_D1_POR_PRODUCTO: JSON.stringify(filas),
  };
}

/**
 * La API de una celda del agro. `workerDelCore` es el de `celdas.json › core`: la celda lo llama por
 * service binding con RPC para tener los planes al día (HU-C5.6), y staging llama al CORE de
 * staging. Un service binding solo une Workers de la misma cuenta (ADR-23).
 */
export function wranglerDeLaCelda(
  celda: Celda,
  coreDelDirectorio: ConfigCeldas['core'],
): Record<string, unknown> {
  const workerDelCore = coreDelDirectorio.worker;
  // HU-C9.7: el MCP del producto, si declara uno, con su servidor de autorización (el CORE).
  const recurso = cargarProductos().productos.find((p) => p.id === celda.producto)
    ?.recursos_oauth?.[0];
  const mcp = (staging: boolean) =>
    recurso
      ? {
          RECURSO_MCP: staging ? recurso.staging : recurso.produccion,
          EMISOR_OAUTH: staging
            ? coreDelDirectorio.url_staging
            : coreDelDirectorio.dominio
              ? `https://${coreDelDirectorio.dominio}`
              : coreDelDirectorio.url,
        }
      : {};
  const bases = (staging: boolean) =>
    celda.shards.map((shard) => ({
      binding: shard,
      database_name: baseDelShard(shard, staging),
      migrations_dir: MIGRACIONES_CELDA,
    }));
  const core = (staging: boolean) => [
    {
      binding: 'CORE',
      service: staging ? `${workerDelCore}-staging` : workerDelCore,
      entrypoint: 'ServicioDelCore',
    },
  ];
  const nombre = `agro-api-${celda.id}`;
  const presupuesto = presupuestoDeLaCelda(celda);
  return {
    $schema: 'node_modules/wrangler/config-schema.json',
    name: nombre,
    main: 'src/worker.ts',
    compatibility_date: FECHA_COMPATIBILIDAD,
    workers_dev: true,
    vars: {
      CELDA: celda.id,
      PRODUCTO: celda.producto,
      PLAN: celda.plan,
      ...presupuesto,
      ...mcp(false),
    },
    // En producción, el dominio propio del MCP (HU-C9.7); la zona es la del sitio, que el token ve.
    ...(recurso
      ? { routes: [{ pattern: new URL(recurso.produccion).host, custom_domain: true }] }
      : {}),
    d1_databases: bases(false),
    services: core(false),
    // El vigía de cuota (HU-E8.2) y los planes al día (HU-C5.6), cada hora. Uno por destino: 2 de
    // los 5 Cron Triggers que da la cuenta gratuita.
    triggers: { crons: ['0 * * * *'] },
    observability: { enabled: true },
    env: {
      staging: {
        name: `${nombre}-staging`,
        workers_dev: true,
        vars: {
          CELDA: celda.id,
          PRODUCTO: celda.producto,
          PLAN: celda.plan,
          ...presupuesto,
          ...mcp(true),
        },
        // Las rutas se heredan entre entornos de wrangler: staging no lleva el dominio de producción.
        routes: [],
        d1_databases: bases(true),
        services: core(true),
        triggers: { crons: ['0 * * * *'] },
      },
    },
  };
}

const CABECERA =
  '// GENERADO por scripts/generar-wrangler.ts desde infrastructure/celdas.json. No editar a mano.\n';
const comoTexto = (config: Record<string, unknown>) =>
  `${CABECERA}${JSON.stringify(config, null, 2)}\n`;

/**
 * La app del producto de ensayo (HU-C3.7): solo assets, sin código de Worker. Existe solo en
 * staging: el despliegue nunca la publica en producción, y su configuración de arriba no se usa.
 */
export const WORKER_ENSAYO = 'ed1-ensayo';
export const RUTA_WRANGLER_ENSAYO = join(RAIZ, 'apps', 'ensayo', 'wrangler.jsonc');
export function wranglerDeEnsayo(): Record<string, unknown> {
  return {
    $schema: 'node_modules/wrangler/config-schema.json',
    name: WORKER_ENSAYO,
    compatibility_date: FECHA_COMPATIBILIDAD,
    assets: { directory: './dist' },
    workers_dev: true,
    env: { staging: { name: `${WORKER_ENSAYO}-staging`, workers_dev: true } },
  };
}

/**
 * El sitio y la caja del Parqueadero ED1 (HU-Q5.1, HU-Q5.2): assets, y un Worker que solo corre
 * para `/_m`, los eventos anónimos de la caja (HU-Q5.3, ADR-32). Producción va a su dominio, nunca
 * a `workers.dev`: si la zona no responde, el despliegue falla (HU-Q5.2 CA3, P1). Staging sigue en
 * `workers.dev`, con su propio dataset de eventos.
 */
export const WORKER_PARQUEADERO = 'ed1-parqueadero';
/** El host de los recibos: `entorno.ts` de la caja y `ORIGEN_DEL_RECIBO` dicen el mismo (P2). */
export const DOMINIO_PARQUEADERO = 'parqueadero.laboratorio-digital.app';
/** Su zona: el token de producción tiene que verla (P12). */
export const ZONA_PARQUEADERO = 'laboratorio-digital.app';
export const RUTA_WRANGLER_PARQUEADERO = join(RAIZ, 'apps', 'parqueadero-sitio', 'wrangler.jsonc');
/** El dataset de Analytics Engine de la caja; staging lleva `_staging`. */
export const DATASET_PARQUEADERO = 'parqueadero_eventos';
export function wranglerDelParqueadero(): Record<string, unknown> {
  return {
    $schema: 'node_modules/wrangler/config-schema.json',
    name: WORKER_PARQUEADERO,
    main: 'src/worker.ts',
    compatibility_date: FECHA_COMPATIBILIDAD,
    assets: { directory: './dist', binding: 'ASSETS', run_worker_first: ['/_m'] },
    workers_dev: false,
    routes: [{ pattern: DOMINIO_PARQUEADERO, custom_domain: true }],
    analytics_engine_datasets: [{ binding: 'EVENTOS', dataset: DATASET_PARQUEADERO }],
    observability: { enabled: true },
    env: {
      staging: {
        name: `${WORKER_PARQUEADERO}-staging`,
        workers_dev: true,
        routes: [],
        analytics_engine_datasets: [
          { binding: 'EVENTOS', dataset: `${DATASET_PARQUEADERO}_staging` },
        ],
      },
    },
  };
}

export const textoWranglerDelParqueadero = (): string => comoTexto(wranglerDelParqueadero());
export const textoWranglerDelSitio = (config: ConfigCeldas): string =>
  comoTexto(wranglerDelSitio(config));
export const textoWranglerDelCore = (config: ConfigCeldas): string =>
  comoTexto(wranglerDelCore(config));
export const textoWranglerDeLaCelda = (celda: Celda, core: ConfigCeldas['core']): string =>
  comoTexto(wranglerDeLaCelda(celda, core));

/** Las celdas que sirven al agro: las únicas con la API de `apps/api-celda` (HU-Q7.2). */
export const celdasDelAgro = (config: ConfigCeldas): Celda[] =>
  config.celdas.filter((c) => c.producto === 'agro');
/** Las celdas del parqueadero (HU-Q7.2): sus bases D1, su KV y su API (`apps/parqueadero-api`, HU-Q7.4). */
export const celdasDelParqueadero = (config: ConfigCeldas): Celda[] =>
  config.celdas.filter((c) => c.producto === 'parqueadero');

/** Migraciones de los shards del parqueadero, relativas a apps/parqueadero-api. */
export const MIGRACIONES_PARQUEADERO = '../../infrastructure/migraciones/parqueadero';
export const rutaWranglerCeldaDelParqueadero = (celdaId: string) =>
  join(RAIZ, 'apps', 'parqueadero-api', `wrangler.${celdaId}.jsonc`);

/**
 * Una celda del parqueadero (HU-Q7.2): el Worker de su API (`parqueadero-api-<celda>`, HU-Q7.4) y
 * un binding D1 por shard con sus migraciones, para `wrangler d1 migrations apply` y para el D1
 * local de las pruebas. Los ids, el KV, las claves del CORE y los orígenes los agrega el despliegue.
 */
export function wranglerDeLaCeldaDelParqueadero(celda: Celda): Record<string, unknown> {
  const bases = (staging: boolean) =>
    celda.shards.map((shard) => ({
      binding: shard,
      database_name: baseDelShard(shard, staging),
      migrations_dir: MIGRACIONES_PARQUEADERO,
    }));
  const nombre = `parqueadero-api-${celda.id}`;
  return {
    $schema: '../../node_modules/wrangler/config-schema.json',
    name: nombre,
    main: 'src/worker.ts',
    compatibility_date: FECHA_COMPATIBILIDAD,
    workers_dev: true,
    vars: { CELDA: celda.id, PRODUCTO: celda.producto, PLAN: celda.plan },
    d1_databases: bases(false),
    env: {
      staging: {
        name: `${nombre}-staging`,
        workers_dev: true,
        vars: { CELDA: celda.id, PRODUCTO: celda.producto, PLAN: celda.plan },
        d1_databases: bases(true),
      },
    },
  };
}
export const textoWranglerDeLaCeldaDelParqueadero = (celda: Celda): string =>
  comoTexto(wranglerDeLaCeldaDelParqueadero(celda));

/**
 * La Tienda 3.0 (HU-T2.3, TIENDA-3.0 §3.1): tres Workers que salen de las celdas de la Tienda en
 * `celdas.json`, nunca escritos a mano (P2).
 *
 * - `tienda-api-<celda>`: Hono, **sin rutas ni workers.dev** (`workers_dev: false`). Solo se llega por
 *   los bindings de servicio del despacho y del panel, así la cabecera con la tienda que resolvió el
 *   despacho es confiable (TIENDA §14.1). Un binding D1 por shard y la base de control del producto.
 * - `tienda-sitio`: el despacho por `Host`, con un binding a la API de cada celda (`API_C1`).
 * - `tienda-panel`: solo assets; el Worker corre únicamente en `/api/*`, que pasa a la API.
 *
 * Staging vive en workers.dev, y el despacho de staging atiende además las direcciones
 * `<slug>--staging.mitiendapro.co` de los dos comercios de prueba (HU-T2.6), del mismo
 * fixture que siembra sus datos (P2). Producción
 * no lleva rutas hasta que la Tienda salga a producción (HU-T2.9): no se declara lo que todavía no
 * existe (P1), y un despliegue a producción por error no toma ningún hostname. Los ids de las bases
 * y de los KV (flags y `TIENDA_HOSTS`) los agrega el despliegue, fuera de git (ADR-6).
 */
/**
 * El host público de las fotos de la Tienda (HU-T5.6): el dominio propio del bucket `medios`, que
 * conecta el dueño (`docs/runbooks/tienda-fotos.md`). Ningún Worker lo toma como ruta: la API lo usa
 * para hornear las URL de las fotos y el despacho para su CSP.
 */
export const MEDIOS_DE_LA_TIENDA = {
  produccion: 'img.laboratorio-digital.app',
  staging: 'img--staging.laboratorio-digital.app',
} as const;

/**
 * Los hostnames de la Tienda en producción (HU-T2.9, TIENDA §4.1), como dominios propios de sus
 * Workers. HU-T18.1 y HU-T18.2 (D-T15): el panel y el MCP del comercio en la marca (`tiendapro.co`),
 * y `origen.`, el origen de respaldo de Cloudflare for SaaS, en la zona de las tiendas
 * (`mitiendapro.co`), donde sin tienda responde «Esta dirección no tiene tienda».
 */
export const DOMINIOS_DE_LA_TIENDA = {
  panel: `app.${DOMINIO_DE_LA_MARCA}`,
  origen: `origen.${ZONA_DE_LAS_TIENDAS}`,
  // HU-T15.7: el MCP del comercio, en el Worker del panel.
  mcp: `mcp.${DOMINIO_DE_LA_MARCA}`,
} as const;

/** La zona de las tiendas: la del comodín, de Cloudflare for SaaS y sus dominios propios (HU-T13.1). */
export { ZONA_DE_LAS_TIENDAS };

/** El cron de la Tienda: uno por hora, que reparte las tareas por frecuencia (HU-T17.1). */
export const CRON_DE_LA_TIENDA = '0 * * * *';

/**
 * Los limitadores por IP de lo público de la Tienda (HU-T5.5, HU-T6.4, HU-T6.5 y HU-T11.4), con Workers Rate Limiting:
 * un contador por clave y periodo, sin escribir en la base ni en el KV. Solo admite periodos de 10 o
 * 60 segundos (bitácora tienda3 11). El `namespace_id` es un número propio de la cuenta, distinto
 * por destino, para que staging no gaste el de producción.
 */
export const LIMITES_DE_LA_TIENDA = {
  LIMITE_COTIZAR: { produccion: '3001', staging: '3101', limit: 30, period: 60 },
  LIMITE_AVISAME: { produccion: '3002', staging: '3102', limit: 10, period: 60 },
  LIMITE_PEDIDOS: { produccion: '3003', staging: '3103', limit: 10, period: 60 },
  LIMITE_SEGUIMIENTO: { produccion: '3004', staging: '3104', limit: 20, period: 60 },
  LIMITE_SOLICITUDES: { produccion: '3005', staging: '3105', limit: 5, period: 60 },
  LIMITE_COBROS: { produccion: '3006', staging: '3106', limit: 3, period: 60 },
  // HU-T11.11: un aviso «de pruebas» lo firma cualquiera; sin tope, cada uno lee D1. Bold avisa una vez
  // por pago y reintenta lo que no recibió: 60 por minuto desde una IP no lo frena.
  LIMITE_AVISOS: { produccion: '3007', staging: '3107', limit: 60, period: 60 },
  // HU-T14.1: los lotes de la medición propia; la vitrina manda uno por página que se cierra.
  LIMITE_MEDICION: { produccion: '3008', staging: '3108', limit: 60, period: 60 },
  // HU-T15.4: el MCP público; preparar un pedido, aparte (la spec dice 5 por hora: el limitador no
  // cuenta horas, y uno por minuto es lo más cercano).
  LIMITE_MCP: { produccion: '3009', staging: '3109', limit: 60, period: 60 },
  LIMITE_MCP_PEDIDOS: { produccion: '3010', staging: '3110', limit: 1, period: 60 },
} as const;

/** HU-T14.1: el dataset de Analytics Engine de la medición propia de las tiendas. */
export const DATASET_TIENDA = 'tienda_eventos';
const limitadoresDeLaTienda = (staging: boolean) =>
  Object.entries(LIMITES_DE_LA_TIENDA).map(([name, l]) => ({
    name,
    namespace_id: staging ? l.staging : l.produccion,
    simple: { limit: l.limit, period: l.period },
  }));

export const celdasDeLaTienda = (config: ConfigCeldas): Celda[] =>
  config.celdas.filter((c) => c.producto === 'tienda');

/** Migraciones del shard y de la base de control, relativas a apps/tienda-api. */
export const MIGRACIONES_TIENDA = '../../infrastructure/migraciones/tienda';
export const MIGRACIONES_TIENDA_CONTROL = '../../infrastructure/migraciones/tienda-control';
export const rutaWranglerCeldaDeLaTienda = (celdaId: string) =>
  join(RAIZ, 'apps', 'tienda-api', `wrangler.${celdaId}.jsonc`);
export const WORKER_TIENDA_SITIO = 'tienda-sitio';
export const WORKER_TIENDA_PANEL = 'tienda-panel';
export const RUTA_WRANGLER_TIENDA_SITIO = join(RAIZ, 'apps', 'tienda-sitio', 'wrangler.jsonc');
export const RUTA_WRANGLER_TIENDA_PANEL = join(RAIZ, 'apps', 'tienda-panel', 'wrangler.jsonc');

export const workerDeLaApiDeLaTienda = (celdaId: string, staging = false) =>
  `tienda-api-${celdaId}${staging ? '-staging' : ''}`;
/** El binding con que el despacho y el panel llegan a la API de una celda: `API_C1`. */
export const bindingDeLaApi = (celdaId: string) => `API_${celdaId.toUpperCase()}`;

export function wranglerDeLaCeldaDeLaTienda(celda: Celda): Record<string, unknown> {
  if (!celda.control) throw new Error(`la celda ${celda.id} de la Tienda no declara su control`);
  if (!celda.almacen) throw new Error(`la celda ${celda.id} de la Tienda no declara su almacén`);
  const almacen = celda.almacen;
  const control = celda.control;
  const bases = (staging: boolean) => [
    ...celda.shards.map((shard) => ({
      binding: shard,
      database_name: baseDelShard(shard, staging),
      migrations_dir: MIGRACIONES_TIENDA,
    })),
    {
      binding: control,
      database_name: baseDelShard(control, staging),
      migrations_dir: MIGRACIONES_TIENDA_CONTROL,
    },
  ];
  const vars = { CELDA: celda.id, PRODUCTO: celda.producto, PLAN: celda.plan };
  // HU-T15.7: el MCP del comercio, si la Tienda declara su recurso, con el CORE de cada destino
  // como servidor de autorización; la API le pregunta por service binding si una concesión sigue viva.
  const core = cargarCeldas().core;
  const recurso = cargarProductos().productos.find((p) => p.id === celda.producto)
    ?.recursos_oauth?.[0];
  const mcp = (staging: boolean) =>
    recurso
      ? {
          RECURSO_MCP_COMERCIO: staging ? recurso.staging : recurso.produccion,
          EMISOR_OAUTH: staging
            ? core.url_staging
            : core.dominio
              ? `https://${core.dominio}`
              : core.url,
        }
      : {};
  const alCore = (staging: boolean) =>
    recurso
      ? {
          services: [
            {
              binding: 'CORE',
              service: staging ? `${core.worker}-staging` : core.worker,
              entrypoint: 'ServicioDelCore',
            },
          ],
        }
      : {};
  const medios = {
    MEDIOS: MEDIOS_DE_LA_TIENDA.produccion,
    AMBIENTE: 'produccion',
    // HU-T18.4: producción manda con Resend desde la marca; la clave es un secreto aparte.
    CORREO_REMITENTE: REMITENTE_DE_LOS_CORREOS,
    // HU-T13.1: los dominios propios, solo con Cloudflare for SaaS activo en la zona.
    ...(celda.saas ? { ZONA_TIENDAS: ZONA_DE_LAS_TIENDAS } : {}),
  };
  // HU-T8.3: el bucket de las fotos, solo donde ya existe.
  const fotos = (ambiente: 'produccion' | 'staging') =>
    celda.medios && celda.medios_creados?.includes(ambiente)
      ? [
          {
            binding: 'FOTOS',
            bucket_name: ambiente === 'staging' ? `${celda.medios}-staging` : celda.medios,
          },
        ]
      : [];
  return {
    $schema: '../../node_modules/wrangler/config-schema.json',
    name: workerDeLaApiDeLaTienda(celda.id),
    main: 'src/worker.ts',
    compatibility_date: FECHA_COMPATIBILIDAD,
    workers_dev: false,
    vars: { ...vars, ...medios, ...mcp(false) },
    ...alCore(false),
    d1_databases: bases(false),
    r2_buckets: [{ binding: 'SITIOS', bucket_name: almacen }, ...fotos('produccion')],
    // HU-T17.1 y D-T10: el quinto cron de la cuenta, solo en producción; staging no tiene.
    triggers: { crons: [CRON_DE_LA_TIENDA] },
    ratelimits: limitadoresDeLaTienda(false),
    analytics_engine_datasets: [{ binding: 'MEDICION', dataset: DATASET_TIENDA }],
    observability: { enabled: true },
    env: {
      staging: {
        name: workerDeLaApiDeLaTienda(celda.id, true),
        workers_dev: false,
        // HU-T2.6 y HU-T4.4: solo staging publica a los comercios de prueba.
        vars: {
          ...vars,
          MEDIOS: MEDIOS_DE_LA_TIENDA.staging,
          AMBIENTE: 'staging',
          ENSAYOS: '1',
          ...mcp(true),
        },
        ...alCore(true),
        d1_databases: bases(true),
        r2_buckets: [{ binding: 'SITIOS', bucket_name: `${almacen}-staging` }, ...fotos('staging')],
        triggers: { crons: [] },
        ratelimits: limitadoresDeLaTienda(true),
        analytics_engine_datasets: [{ binding: 'MEDICION', dataset: `${DATASET_TIENDA}_staging` }],
      },
    },
  };
}

const serviciosDeLaTienda = (config: ConfigCeldas, staging: boolean) =>
  celdasDeLaTienda(config)
    .filter((c) => c.estado === 'activa')
    .map((c) => ({
      binding: bindingDeLaApi(c.id),
      service: workerDeLaApiDeLaTienda(c.id, staging),
    }));

/** El almacén de cada celda para el despacho: `SITIOS_C1`, de solo lectura en su código. */
const almacenesDeLaTienda = (config: ConfigCeldas, staging: boolean) =>
  celdasDeLaTienda(config)
    .filter((c) => c.estado === 'activa' && c.almacen)
    .map((c) => ({
      binding: `SITIOS_${c.id.toUpperCase()}`,
      bucket_name: staging ? `${c.almacen}-staging` : (c.almacen as string),
    }));

export function wranglerDelSitioDeLaTienda(config: ConfigCeldas): Record<string, unknown> {
  return {
    $schema: '../../node_modules/wrangler/config-schema.json',
    name: WORKER_TIENDA_SITIO,
    main: 'src/worker.ts',
    compatibility_date: FECHA_COMPATIBILIDAD,
    // HU-T3.3: los archivos comunes de la vitrina (`/_t/<release>/`) son assets: no ejecutan el
    // Worker. Todo lo demás pasa por el despacho.
    assets: { directory: './dist', binding: 'ASSETS', run_worker_first: ['/*', '!/_t/*'] },
    workers_dev: false,
    // HU-T2.9: en producción, `origen.`; el comodín llega con la primera tienda real. HU-T13.1: con
    // Cloudflare for SaaS, los dominios propios llegan por la ruta de toda la zona; los dominios de
    // los Workers (el panel, `origen.`) y las rutas más específicas siguen ganándole.
    routes: [
      { pattern: DOMINIOS_DE_LA_TIENDA.origen, custom_domain: true },
      ...(config.celdas.some((c) => c.producto === 'tienda' && c.saas)
        ? [{ pattern: '*/*', zone_name: ZONA_DE_LAS_TIENDAS }]
        : []),
      // HU-T13.4: las tiendas que abre el alta, con el registro DNS comodín del dueño. En producción,
      // solo cuando la Tienda se lanza (D-T14).
      ...(config.celdas.some((c) => c.producto === 'tienda' && c.comodin === true)
        ? [{ pattern: `*.${ZONA_DE_LAS_TIENDAS}/*`, zone_name: ZONA_DE_LAS_TIENDAS }]
        : []),
    ],
    services: serviciosDeLaTienda(config, false),
    r2_buckets: almacenesDeLaTienda(config, false),
    vars: { MEDIOS: MEDIOS_DE_LA_TIENDA.produccion },
    observability: { enabled: true },
    env: {
      staging: {
        name: `${WORKER_TIENDA_SITIO}-staging`,
        workers_dev: true,
        routes: [
          ...ENSAYOS.map((e) => ({ pattern: hostDeStaging(e.slug), custom_domain: true })),
          ...(config.celdas.some((c) => c.producto === 'tienda' && c.comodin)
            ? [{ pattern: `*--staging.${ZONA_DE_LAS_TIENDAS}/*`, zone_name: ZONA_DE_LAS_TIENDAS }]
            : []),
          // HU-T18.1 CA2: las direcciones de staging de antes siguen llegando al despacho, que las
          // lleva a mitiendapro.co con un 301. Producción no tuvo tiendas en la zona anterior.
          ...ENSAYOS.map((e) => ({
            pattern: `${e.slug}--staging.${ZONA_ANTERIOR}`,
            custom_domain: true,
          })),
          ...(config.celdas.some((c) => c.producto === 'tienda' && c.comodin)
            ? [{ pattern: `*--staging.${ZONA_ANTERIOR}/*`, zone_name: ZONA_ANTERIOR }]
            : []),
        ],
        services: serviciosDeLaTienda(config, true),
        r2_buckets: almacenesDeLaTienda(config, true),
        vars: { MEDIOS: MEDIOS_DE_LA_TIENDA.staging },
      },
    },
  };
}

export function wranglerDelPanelDeLaTienda(config: ConfigCeldas): Record<string, unknown> {
  return {
    $schema: '../../node_modules/wrangler/config-schema.json',
    name: WORKER_TIENDA_PANEL,
    main: 'src/worker.ts',
    compatibility_date: FECHA_COMPATIBILIDAD,
    // HU-T8.1: una PWA de una sola página; una ruta del panel sin archivo es `index.html`.
    assets: {
      directory: './dist',
      binding: 'ASSETS',
      // HU-T15.7: también el MCP del comercio y sus metadatos (RFC 9728), que pasan a la API.
      run_worker_first: ['/api/*', '/mcp', '/.well-known/*'],
      not_found_handling: 'single-page-application',
    },
    workers_dev: false,
    routes: [
      { pattern: DOMINIOS_DE_LA_TIENDA.panel, custom_domain: true },
      { pattern: DOMINIOS_DE_LA_TIENDA.mcp, custom_domain: true },
    ],
    services: serviciosDeLaTienda(config, false),
    observability: { enabled: true },
    env: {
      staging: {
        name: `${WORKER_TIENDA_PANEL}-staging`,
        workers_dev: true,
        routes: [],
        services: serviciosDeLaTienda(config, true),
      },
    },
  };
}

export const textoWranglerDeLaCeldaDeLaTienda = (celda: Celda): string =>
  comoTexto(wranglerDeLaCeldaDeLaTienda(celda));
export const textoWranglerDelSitioDeLaTienda = (config: ConfigCeldas): string =>
  comoTexto(wranglerDelSitioDeLaTienda(config));
export const textoWranglerDelPanelDeLaTienda = (config: ConfigCeldas): string =>
  comoTexto(wranglerDelPanelDeLaTienda(config));

if (process.argv[1]?.endsWith('generar-wrangler.ts')) {
  const config = cargarCeldas();
  writeFileSync(RUTA_WRANGLER_SITIO, textoWranglerDelSitio(config));
  writeFileSync(RUTA_WRANGLER_CORE, textoWranglerDelCore(config));
  const deCeldas = celdasDelAgro(config).map((celda) => {
    writeFileSync(rutaWranglerCelda(celda.id), textoWranglerDeLaCelda(celda, config.core));
    return rutaWranglerCelda(celda.id);
  });
  mkdirSync(join(RAIZ, 'apps', 'parqueadero-api'), { recursive: true });
  for (const celda of celdasDelParqueadero(config)) {
    writeFileSync(
      rutaWranglerCeldaDelParqueadero(celda.id),
      textoWranglerDeLaCeldaDelParqueadero(celda),
    );
    deCeldas.push(rutaWranglerCeldaDelParqueadero(celda.id));
  }
  for (const celda of celdasDeLaTienda(config)) {
    mkdirSync(join(RAIZ, 'apps', 'tienda-api'), { recursive: true });
    writeFileSync(rutaWranglerCeldaDeLaTienda(celda.id), textoWranglerDeLaCeldaDeLaTienda(celda));
    deCeldas.push(rutaWranglerCeldaDeLaTienda(celda.id));
  }
  for (const [ruta, texto] of [
    [RUTA_WRANGLER_TIENDA_SITIO, textoWranglerDelSitioDeLaTienda(config)],
    [RUTA_WRANGLER_TIENDA_PANEL, textoWranglerDelPanelDeLaTienda(config)],
  ] as const) {
    mkdirSync(join(ruta, '..'), { recursive: true });
    writeFileSync(ruta, texto);
    deCeldas.push(ruta);
  }
  writeFileSync(RUTA_WRANGLER_ENSAYO, comoTexto(wranglerDeEnsayo()));
  writeFileSync(RUTA_WRANGLER_PARQUEADERO, textoWranglerDelParqueadero());
  for (const ruta of [
    RUTA_WRANGLER_SITIO,
    RUTA_WRANGLER_CORE,
    RUTA_WRANGLER_ENSAYO,
    RUTA_WRANGLER_PARQUEADERO,
    ...deCeldas,
  ])
    console.log(`✅ ${ruta}`);
}
