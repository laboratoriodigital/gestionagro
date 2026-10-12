/**
 * `node scripts/desplegar.ts --destino staging|produccion [--solo c0]` (HU-E1.5).
 *
 * Por cada celda activa, en orden de anillo: verifica el token (P12) y despliega lo que esa celda
 * aloja según celdas.json, cada cosa seguida de su prueba de humo (P11):
 * - el sitio: KV de flags y claves de kill switch (HU-E8.1), Worker del sitio;
 * - el CORE (HU-E4.1): base D1, migraciones, directorio de celdas y Worker del CORE.
 * Se detiene en la primera celda que falle y nombra las que quedaron sin tocar (bitácora
 * ecommerce 105). Lo corre `.github/workflows/desplegar.yml`.
 *
 * La API de la celda (HU-E5.1) se agregará a este mismo recorrido. Comandos constantes;
 * `shell: true` solo porque en Windows `pnpm` es un `.cmd`.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSULTAS_DEL_CATALOGO,
  diferenciasDelCatalogo,
  sentenciasDelCatalogo,
} from '../apps/core/src/catalogo.ts';
import { sentenciasDeCeldas } from '../apps/core/src/celdas.ts';
import { killSwitchesDelCore } from '../apps/core/src/constantes.ts';
import { claveKillSwitch } from '../packages/kill-switch/src/index.ts';
import { generarClavePrivada } from '../packages/tokens/src/index.ts';
import {
  baseDelShard,
  DOMINIO_PARQUEADERO,
  WORKER_PARQUEADERO,
  wranglerDeLaCelda,
  wranglerDeLaCeldaDelParqueadero,
  wranglerDelCore,
  wranglerDelSitio,
  ZONA_PARQUEADERO,
} from './generar-wrangler.ts';
import {
  ARCHIVO_DESPLIEGUE_CELDA,
  clavesDelCore,
  configDeLaCelda,
  escribirDespliegueCelda,
  humoCelda,
  secretosDeLaCelda,
} from './lib/api-celda.ts';
import { escribirCabecerasDelParqueadero } from './lib/cabeceras-parqueadero.ts';
import {
  ARCHIVO_DESPLIEGUE_PARQUEADERO,
  CONSULTA_HUMO_SHARD,
  celdasDelDirectorio,
  configDeLaCeldaDelParqueadero,
  escribirDespliegueDelParqueadero,
  notaSinProduccion,
  origenesDeLaCaja,
  preparaLasCeldasDelParqueadero,
  secretosDeLaCeldaDelParqueadero,
  tablasQueFaltan,
} from './lib/celda-parqueadero.ts';
import { type Celda, type ConfigCeldas, cargarCeldas, planDeDespliegue } from './lib/celdas.ts';
import {
  type ClaveQr,
  clavesQrDe,
  PAGINA_RECIBO,
  PAGINAS,
  ponerClavesEnLaPagina,
} from './lib/claves-qr.ts';
import {
  ARCHIVO_DESPLIEGUE_CORE,
  ARCHIVO_SQL_CELDAS,
  asegurarBaseD1,
  CONSULTA_HUERFANAS,
  configDelCore,
  escribirDespliegueCore,
  huerfanasDeLaSalida,
  nombreD1Core,
  productosDeLasBases,
  resultadosDeLaSalida,
  secretosDelCore,
} from './lib/d1-core.ts';
import {
  causaDeWrangler,
  type Destino,
  humo,
  humoCore,
  humoEntrar,
  humoSinProductosDePrueba,
  type ResultadoCelda,
  resumenDespliegue,
  urlDeWorkersDev,
  verificarToken,
} from './lib/despliegue.ts';
import { humoParqueadero } from './lib/humo-parqueadero.ts';
import {
  ARCHIVO_DESPLIEGUE,
  asegurarClaves,
  asegurarNamespace,
  clavesDeKillSwitch,
  configDeDespliegue,
  escribirConfigDeDespliegue,
  nombreKvFlags,
} from './lib/kv-flags.ts';
import { cargarProductos } from './lib/productos.ts';
import {
  cargarProductosDePrueba,
  productosDePruebaEn,
  registroDelDestino,
} from './lib/productos-de-prueba.ts';
import { productosADesplegar } from './lib/publicacion.ts';
import {
  cargarProductos as cargarRegistroDeProductos,
  catalogoDelRepositorio,
} from './lib/registro-productos.ts';
import { RAIZ } from './lib/repo.ts';

const argumento = (nombre: string) => {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const destino = argumento('--destino') as Destino | undefined;
if (destino !== 'staging' && destino !== 'produccion') {
  console.error(
    '❌ Uso: node scripts/desplegar.ts --destino staging|produccion [--solo c0] [--productos core,agro]',
  );
  process.exit(1);
}
const solo = argumento('--solo') || undefined;
// HU-C0.3: qué productos se despliegan. Sin la opción, todos (staging y el «Run workflow» a mano).
const productos = productosADesplegar(argumento('--productos'));
// Producción es el entorno de nivel superior de wrangler.jsonc: «--env=» lo elige sin aviso.
const entorno = destino === 'staging' ? '--env staging' : '--env=';

/** Origen del cuaderno en el destino: el único que el CORE y las celdas aceptan (CORS). */
const origenDelCuaderno = (config: ConfigCeldas) =>
  destino === 'produccion' ? `https://${config.sitio.dominio}` : config.sitio.url_staging;

interface Credenciales {
  token: string;
  cuenta: string;
}
interface Paso {
  ok: boolean;
  detalle: string[];
  /** URL pública de lo desplegado (el sitio se la pasa al CORE como origen permitido). */
  url?: string;
}

/**
 * Corre wrangler dentro de un paquete con las credenciales de la celda. `entrada` va por stdin:
 * así los secretos nunca tocan el disco ni la línea de comandos (P13).
 */
function wrangler(paquete: string, argumentos: string, cred: Credenciales, entrada?: string) {
  const r = spawnSync(`pnpm --filter ${paquete} exec wrangler ${argumentos}`, {
    cwd: RAIZ,
    shell: true,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, CLOUDFLARE_API_TOKEN: cred.token, CLOUDFLARE_ACCOUNT_ID: cred.cuenta },
    ...(entrada === undefined ? {} : { input: entrada }),
  });
  const salida = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  process.stdout.write(salida);
  return { ok: r.status === 0, salida };
}

/** Un despliegue nuevo tarda unos segundos en verse en todas partes: hasta 5 intentos. */
async function conReintentos(probar: () => Promise<string[]>): Promise<string[]> {
  let fallas: string[] = [];
  for (let intento = 1; intento <= 5; intento++) {
    fallas = await probar();
    if (fallas.length === 0) break;
    console.log(
      `  humo, intento ${intento}: ${fallas.length} fallas; reintento en ${intento * 3} s`,
    );
    await new Promise((listo) => setTimeout(listo, intento * 3000));
  }
  return fallas;
}

async function desplegarSitio(
  config: ConfigCeldas,
  celda: Celda,
  cred: Credenciales,
): Promise<Paso> {
  // HU-E8.1: KV de flags y claves de kill switch, antes de publicar el Worker que las lee.
  const titulo = nombreKvFlags(celda.id, destino as Destino);
  let notaKv: string;
  try {
    const ns = await asegurarNamespace(fetch, cred.token, cred.cuenta, titulo);
    const claves = await asegurarClaves(
      fetch,
      cred.token,
      cred.cuenta,
      ns.id,
      clavesDeKillSwitch(cargarProductos()),
    );
    escribirConfigDeDespliegue(
      configDeDespliegue(wranglerDelSitio(config), destino as Destino, ns.id),
    );
    notaKv = `KV ${titulo}${ns.creado ? ' (creado)' : ''}: ${claves.creadas.length} claves creadas en «encendido», ${claves.existentes.length} ya existían y no se tocaron`;
    console.log(`  ${notaKv}`);
  } catch (e) {
    return { ok: false, detalle: [`KV de flags ${titulo}: ${(e as Error).message}`] };
  }

  // Claves del QR de cada celda activa, dentro de /agro/t/ (HU-E6.4). Sin la de la celda que
  // aloja el sitio, que se acaba de desplegar, no se publica: los QR firmados saldrían «sin
  // confirmar». Una celda que no responde se avisa y no detiene el sitio.
  const clavesQr: ClaveQr[] = [];
  const avisosQr: string[] = [];
  for (const otra of config.celdas.filter((x) => x.estado === 'activa' && x.producto === 'agro')) {
    try {
      clavesQr.push(
        ...(await clavesQrDe(fetch, destino === 'staging' ? otra.api_staging : otra.api)),
      );
    } catch (e) {
      if (otra.id === celda.id) {
        return { ok: false, detalle: [`sitio: ${(e as Error).message}`] };
      }
      avisosQr.push(`⚠ QR: ${(e as Error).message}; sus etiquetas saldrán «sin confirmar»`);
    }
  }
  try {
    ponerClavesEnLaPagina(clavesQr);
  } catch (e) {
    return { ok: false, detalle: [`sitio: ${(e as Error).message}`] };
  }

  const deploy = wrangler('@ed1/sitio', `deploy -c ${ARCHIVO_DESPLIEGUE} ${entorno}`, cred);
  if (!deploy.ok) {
    return {
      ok: false,
      detalle: ['wrangler deploy del sitio falló:', ...causaDeWrangler(deploy.salida)],
    };
  }
  const base =
    destino === 'produccion' ? `https://${config.sitio.dominio}` : urlDeWorkersDev(deploy.salida);
  if (!base) {
    return {
      ok: false,
      detalle: ['sitio: no se encontró la URL de workers.dev en la salida de wrangler'],
    };
  }
  // El CORE y las celdas aceptan al cuaderno por el origen de celdas.json: debe ser este (P2).
  if (base !== origenDelCuaderno(config)) {
    return {
      ok: false,
      detalle: [
        `sitio desplegado en ${base}, pero celdas.json dice ${origenDelCuaderno(config)}. Corrige sitio.url_staging por PR y vuelve a desplegar.`,
      ],
    };
  }
  const fallas = await conReintentos(() => humo(fetch, base));
  if (fallas.length > 0) {
    return {
      ok: false,
      detalle: [`sitio desplegado en ${base}, pero la prueba de humo falló:`, ...fallas],
    };
  }
  return {
    ok: true,
    detalle: [
      `sitio: ${base}`,
      notaKv,
      `QR de trazabilidad: ${clavesQr.length} clave(s) de celda en /agro/t/`,
      ...avisosQr,
    ],
    url: base,
  };
}

async function desplegarCore(
  config: ConfigCeldas,
  celda: Celda,
  cred: Credenciales,
  origenApp: string,
): Promise<Paso> {
  const dest = destino as Destino;
  const nombre = nombreD1Core(config.core.d1, dest);
  const titulo = nombreKvFlags(celda.id, dest);
  let notaD1: string;
  try {
    const base = await asegurarBaseD1(fetch, cred.token, cred.cuenta, nombre);
    // HU-E4.2: el kill switch del CORE vive en el mismo KV de flags de la celda.
    const ns = await asegurarNamespace(fetch, cred.token, cred.cuenta, titulo);
    // HU-C3.6: el de todo el CORE (con su nombre de antes), el de pagos y uno por producto.
    // HU-C3.7: en staging, también los productos de prueba.
    const registro = registroDelDestino(dest, cargarRegistroDeProductos());
    const idsDeProductos = registro.productos.map((p) => p.id);
    await asegurarClaves(
      fetch,
      cred.token,
      cred.cuenta,
      ns.id,
      killSwitchesDelCore(idsDeProductos).map(claveKillSwitch),
    );
    escribirDespliegueCore(
      configDelCore(wranglerDelCore(config), dest, {
        baseId: base.id,
        flagsId: ns.id,
        origenesApp: [origenApp],
      }),
      // HU-C2.3: el catálogo de productos va antes que las celdas, porque una celda nombra su
      // producto. Los dos salen de sus archivos (P2) en el mismo SQL.
      // HU-C3.7: en staging, también los productos de prueba y sus celdas de directorio.
      [
        ...sentenciasDelCatalogo(catalogoDelRepositorio(registro), new Date().toISOString()),
        ...sentenciasDeCeldas(
          [
            ...celdasDelDirectorio(config.celdas, dest),
            ...(dest === 'staging' ? cargarProductosDePrueba().celdas : []),
          ],
          dest,
        ),
      ],
    );
    notaD1 = `D1 ${nombre}${base.creada ? ' (creada)' : ''}`;
    console.log(`  ${notaD1}`);
  } catch (e) {
    return { ok: false, detalle: [`CORE (${nombre}, ${titulo}): ${(e as Error).message}`] };
  }

  const c = `-c ${ARCHIVO_DESPLIEGUE_CORE} ${entorno}`;
  // HU-C2.2, CA4b: sin huérfanas antes de migrar. Si las hay, o no se sabe, no se migra (P1).
  const revision = wrangler(
    '@ed1/core',
    `d1 execute DB --remote --json --command "${CONSULTA_HUERFANAS}" ${c}`,
    cred,
  );
  const huerfanas = revision.ok ? huerfanasDeLaSalida(revision.salida) : null;
  if (huerfanas === null) {
    return {
      ok: false,
      detalle: [
        'no se pudo revisar si la base del CORE tiene filas huérfanas; no se migra sin saberlo:',
        ...causaDeWrangler(revision.salida),
      ],
    };
  }
  if (huerfanas.length > 0) {
    return {
      ok: false,
      detalle: [
        `la base del CORE tiene ${huerfanas.length} fila(s) huérfana(s); la guarda de las migraciones las rechazaría. Resolverlas antes de migrar (PLATAFORMA §4.4):`,
        ...huerfanas,
      ],
    };
  }
  const pasos: [string, string][] = [
    ['migraciones del CORE', `d1 migrations apply DB --remote ${c}`],
    [
      'catálogo de productos y directorio de celdas',
      `d1 execute DB --remote --file ${ARCHIVO_SQL_CELDAS} ${c}`,
    ],
    ['wrangler deploy del CORE', `deploy ${c}`],
  ];
  let salidaDeploy = '';
  for (const [nombrePaso, argumentos] of pasos) {
    if (nombrePaso === 'wrangler deploy del CORE') {
      // HU-C2.3: antes de publicar el Worker, la base tiene que decir lo mismo que el archivo.
      // No se le cree a wrangler que aplicó: se lee (P16).
      const lectura = wrangler(
        '@ed1/core',
        `d1 execute DB --remote --json --command "${CONSULTAS_DEL_CATALOGO}" ${c}`,
        cred,
      );
      const filas = lectura.ok ? resultadosDeLaSalida(lectura.salida) : null;
      const diferencias =
        filas === null
          ? ['no se pudo leer el catálogo de la base', ...causaDeWrangler(lectura.salida)]
          : [
              ...diferenciasDelCatalogo(
                catalogoDelRepositorio(registroDelDestino(dest, cargarRegistroDeProductos())),
                filas,
              ),
              // HU-C3.7, CA3: un producto de prueba en la base de producción detiene el despliegue.
              ...(dest === 'produccion'
                ? productosDePruebaEn(
                    filas,
                    cargarProductosDePrueba().productos.map((p) => p.id),
                  )
                : []),
            ];
      if (diferencias.length > 0) {
        return {
          ok: false,
          detalle: [
            'el catálogo de la base no es el de productos.json y planes.json:',
            ...diferencias,
          ],
        };
      }
    }
    const r = wrangler('@ed1/core', argumentos, cred);
    if (!r.ok)
      return { ok: false, detalle: [`${nombrePaso} falló:`, ...causaDeWrangler(r.salida)] };
    salidaDeploy = r.salida;
  }
  const url = urlDeWorkersDev(salidaDeploy);
  const configurada = dest === 'produccion' ? config.core.url : config.core.url_staging;
  if (url !== configurada) {
    return {
      ok: false,
      detalle: [
        `CORE desplegado en ${url ?? '(sin URL de workers.dev en la salida)'}, pero celdas.json dice ${configurada}. El cuaderno usa la de celdas.json: corrígela por PR y vuelve a desplegar.`,
      ],
    };
  }

  // Secretos del Worker (HU-E4.2): Google siempre; la clave de firma, solo si no tiene una.
  const lista = wrangler('@ed1/core', `secret list --format json ${c}`, cred);
  let existentes: string[] = [];
  try {
    existentes = (
      JSON.parse(lista.salida.slice(lista.salida.indexOf('['))) as { name: string }[]
    ).map((s) => s.name);
  } catch {
    return {
      ok: false,
      detalle: ['no se pudo leer la lista de secretos del CORE (wrangler secret list)'],
    };
  }
  let secretos: Record<string, string>;
  try {
    secretos = await secretosDelCore(
      existentes,
      { id: process.env['GOOGLE_CLIENT_ID'], secreto: process.env['GOOGLE_CLIENT_SECRET'] },
      generarClavePrivada,
      // HU-E0.7: staging cobra con las llaves de pruebas de Bold; producción, con las reales.
      dest === 'produccion'
        ? {
            identidad: process.env['BOLD_IDENTIDAD_PRODUCCION'],
            secreta: process.env['BOLD_SECRETA_PRODUCCION'],
            ambiente: 'produccion',
          }
        : {
            identidad: process.env['BOLD_IDENTIDAD_PRUEBAS'],
            secreta: process.env['BOLD_SECRETA_PRUEBAS'],
            ambiente: 'pruebas',
          },
    );
  } catch (e) {
    return { ok: false, detalle: [`CORE: ${(e as Error).message}`] };
  }
  const carga = wrangler('@ed1/core', `secret bulk ${c}`, cred, JSON.stringify(secretos));
  if (!carga.ok) {
    return {
      ok: false,
      detalle: ['carga de secretos del CORE falló:', ...causaDeWrangler(carga.salida)],
    };
  }
  const notaClave = secretos['CORE_JWT_PRIVATE_KEY']
    ? 'clave de firma nueva generada'
    : 'clave de firma existente conservada';

  // HU-C3.7: en staging, el directorio tiene además las celdas de los productos de prueba.
  const activas =
    celdasDelDirectorio(config.celdas, dest).filter((x) => x.estado === 'activa').length +
    (dest === 'staging' ? cargarProductosDePrueba().celdas.length : 0);
  const fallas = await conReintentos(async () => [
    ...(await humoCore(fetch, url, activas)),
    ...(dest === 'produccion'
      ? await humoSinProductosDePrueba(
          fetch,
          url,
          cargarProductosDePrueba().productos.map((p) => p.id),
        )
      : []),
    ...(await humoEntrar(fetch, url, {
      clienteId: process.env['GOOGLE_CLIENT_ID'] ?? '',
      origenApp,
    })),
  ]);
  if (fallas.length > 0) {
    return {
      ok: false,
      detalle: [`CORE desplegado en ${url}, pero la prueba de humo falló:`, ...fallas],
    };
  }
  return {
    ok: true,
    detalle: [
      `CORE: ${url}`,
      `${notaD1}: migraciones aplicadas y ${activas} celdas activas en el directorio`,
      `Entrar con Google: responde, ${notaClave}, vuelve a ${origenApp}`,
      ...(destino === 'produccion' && config.core.dominio
        ? [await notaDelDominio(fetch, config.core.dominio)]
        : []),
    ],
  };
}

/**
 * HU-C4.6: si el dominio propio del CORE ya responde. Informa y no detiene: el certificado de un
 * Custom Domain nuevo puede tardar unos minutos, y los cuadernos usan la URL de workers.dev (P10).
 */
async function notaDelDominio(fetchFn: typeof fetch, dominio: string): Promise<string> {
  try {
    const r = await fetchFn(`https://${dominio}/api/core/salud`, { redirect: 'manual' });
    return r.status === 200
      ? `dominio ${dominio}: responde`
      : `⚠️ dominio ${dominio}: respondió ${r.status}; si es nuevo, vuelve a mirar en unos minutos`;
  } catch (e) {
    return `⚠️ dominio ${dominio}: todavía no responde (${(e as Error).message}); el certificado puede tardar unos minutos`;
  }
}

/**
 * HU-C3.7: la app del producto de ensayo, solo en staging. Solo assets: su origen tiene que ser el
 * que declara `productos-de-prueba.json`, porque el CORE solo acepta ese (P2).
 */
async function desplegarEnsayo(cred: Credenciales): Promise<Paso> {
  const deploy = wrangler('@ed1/ensayo', 'deploy --env staging', cred);
  if (!deploy.ok) {
    return {
      ok: false,
      detalle: ['ensayo: wrangler deploy falló:', ...causaDeWrangler(deploy.salida)],
    };
  }
  const url = urlDeWorkersDev(deploy.salida);
  const declarado = cargarProductosDePrueba().productos.find((p) => p.id === 'ensayo')?.app
    .origenes;
  const esperado = typeof declarado === 'object' ? declarado.staging : undefined;
  if (!url || url !== esperado) {
    return {
      ok: false,
      detalle: [
        `ensayo desplegado en ${url ?? '?'}, pero productos-de-prueba.json dice ${esperado ?? '?'}. Corrígelo por PR.`,
      ],
    };
  }
  const fallas = await conReintentos(async () => {
    try {
      const r = await fetch(`${url}/`);
      return r.status === 200 && (await r.text()).includes('Ensayo')
        ? []
        : [`ensayo: ${url}/ respondió ${r.status}`];
    } catch (e) {
      return [`ensayo: ${url}/ no respondió (${(e as Error).message})`];
    }
  });
  return fallas.length > 0
    ? { ok: false, detalle: fallas }
    : { ok: true, detalle: [`ensayo (segundo producto, solo staging): ${url}`] };
}

/**
 * HU-Q5.1 y HU-Q5.2: el sitio y la caja del parqueadero. Assets y el Worker de `/_m` (HU-Q5.3),
 * sin secretos. Staging va a `workers.dev`; producción, a su dominio y nunca a `workers.dev`: si
 * la zona no responde, `wrangler` falla y el despliegue lo dice (HU-Q5.2 CA3, P1). La prueba de
 * humo exige la caja con su CSP y su service worker, la página del recibo y el Worker de eventos.
 */
async function desplegarParqueadero(cred: Credenciales, para: Destino): Promise<Paso> {
  const produccion = para === 'produccion';
  // El build deja las cabeceras de staging; producción lleva HSTS y se deja encontrar.
  if (produccion) {
    escribirCabecerasDelParqueadero(join(RAIZ, 'apps', 'parqueadero-sitio', 'dist'), 'produccion');
  }
  const deploy = wrangler(
    '@ed1/parqueadero-sitio',
    produccion ? 'deploy' : 'deploy --env staging',
    cred,
  );
  if (!deploy.ok) {
    return {
      ok: false,
      detalle: [
        `parqueadero: wrangler deploy falló${produccion ? ` (¿la zona ${ZONA_PARQUEADERO} está activa?)` : ''}:`,
        ...causaDeWrangler(deploy.salida),
      ],
    };
  }
  const url = produccion ? `https://${DOMINIO_PARQUEADERO}` : urlDeWorkersDev(deploy.salida);
  if (!produccion && !url?.startsWith(`https://${WORKER_PARQUEADERO}-staging.`)) {
    return {
      ok: false,
      detalle: [`parqueadero desplegado en ${url ?? '?'}, que no es su staging`],
    };
  }
  const base = url ?? '';
  const fallas = await conReintentos(() => humoParqueadero(fetch, base, para));
  return fallas.length > 0
    ? { ok: false, detalle: fallas }
    : { ok: true, detalle: [`parqueadero${produccion ? '' : ' (staging)'}: ${base}/caja/`] };
}

/**
 * Una celda del parqueadero (HU-Q7.2 y HU-Q7.4): sus bases D1 con las migraciones, su KV de flags
 * con los kill switches del producto y el Worker de su API. Solo staging: ver
 * `scripts/lib/celda-parqueadero.ts`.
 */
async function prepararCeldaDelParqueadero(
  config: ConfigCeldas,
  celda: Celda,
  cred: Credenciales,
): Promise<Paso> {
  const dest = destino as Destino;
  if (dest === 'produccion') return { ok: true, detalle: [notaSinProduccion(celda.id)] };
  if (celda.shards.length === 0) {
    return { ok: false, detalle: [`${celda.id}: no tiene shards en celdas.json`] };
  }
  const titulo = nombreKvFlags(celda.id, dest, celda.producto);
  const bases: Record<string, string> = {};
  const nuevas: string[] = [];
  let notaKv: string;
  try {
    for (const shard of celda.shards) {
      const base = await asegurarBaseD1(fetch, cred.token, cred.cuenta, baseDelShard(shard, true));
      bases[shard] = base.id;
      if (base.creada) nuevas.push(baseDelShard(shard, true));
    }
    const ns = await asegurarNamespace(fetch, cred.token, cred.cuenta, titulo);
    const producto = cargarRegistroDeProductos().productos.find((p) => p.id === celda.producto);
    const claves = await asegurarClaves(
      fetch,
      cred.token,
      cred.cuenta,
      ns.id,
      producto?.kill_switches ?? [],
    );
    notaKv = `KV ${titulo}${ns.creado ? ' (creado)' : ''}: ${claves.creadas.length} kill switch(es) creados en «encendido», ${claves.existentes.length} ya existían y no se tocaron`;
    escribirDespliegueDelParqueadero(
      configDeLaCeldaDelParqueadero(wranglerDeLaCeldaDelParqueadero(celda), dest, {
        bases,
        flagsId: ns.id,
        clavesCore: await clavesDelCore(fetch, config.core.url_staging),
        origenesApp: origenesDeLaCaja(producto, dest),
      }),
    );
  } catch (e) {
    return { ok: false, detalle: [`celda ${celda.id} del parqueadero: ${(e as Error).message}`] };
  }
  const c = `-c ${ARCHIVO_DESPLIEGUE_PARQUEADERO} ${entorno}`;
  for (const shard of celda.shards) {
    const migrar = wrangler(
      '@ed1/parqueadero-api',
      `d1 migrations apply ${shard} --remote ${c}`,
      cred,
    );
    if (!migrar.ok) {
      return {
        ok: false,
        detalle: [`migraciones del shard ${shard} fallaron:`, ...causaDeWrangler(migrar.salida)],
      };
    }
    const humoShard = wrangler(
      '@ed1/parqueadero-api',
      `d1 execute ${shard} --remote --json --command "${CONSULTA_HUMO_SHARD}" ${c}`,
      cred,
    );
    const faltan = humoShard.ok ? tablasQueFaltan(humoShard.salida) : null;
    if (faltan === null || faltan.length > 0) {
      return {
        ok: false,
        detalle: [
          faltan === null
            ? `shard ${shard}: no se pudo leer su lista de tablas`
            : `shard ${shard}: le faltan las tablas ${faltan.join(', ')}`,
          ...causaDeWrangler(humoShard.salida),
        ],
      };
    }
  }
  const deploy = wrangler('@ed1/parqueadero-api', `deploy ${c}`, cred);
  if (!deploy.ok) {
    return {
      ok: false,
      detalle: [
        `wrangler deploy de la API de ${celda.id} falló:`,
        ...causaDeWrangler(deploy.salida),
      ],
    };
  }
  const url = urlDeWorkersDev(deploy.salida);
  if (url !== celda.api_staging) {
    return {
      ok: false,
      detalle: [
        `API de ${celda.id} desplegada en ${url ?? '(sin URL de workers.dev en la salida)'}, pero celdas.json dice ${celda.api_staging}: corrígela por PR y vuelve a desplegar.`,
      ],
    };
  }
  // HU-Q8.1 CA3: la llave de recibos se genera una vez, solo si el Worker no tiene una.
  const lista = wrangler('@ed1/parqueadero-api', `secret list --format json ${c}`, cred);
  let existentes: string[];
  try {
    existentes = (
      JSON.parse(lista.salida.slice(lista.salida.indexOf('['))) as { name: string }[]
    ).map((x) => x.name);
  } catch {
    return {
      ok: false,
      detalle: [
        `no se pudo leer la lista de secretos de la API de ${celda.id} (wrangler secret list)`,
      ],
    };
  }
  const deLaCelda = await secretosDeLaCeldaDelParqueadero(existentes, generarClavePrivada);
  if (deLaCelda.claveNueva) {
    const carga = wrangler(
      '@ed1/parqueadero-api',
      `secret bulk ${c}`,
      cred,
      JSON.stringify(deLaCelda.secretos),
    );
    if (!carga.ok) {
      return {
        ok: false,
        detalle: ['carga de la llave de recibos falló:', ...causaDeWrangler(carga.salida)],
      };
    }
  }
  const fallas = await conReintentos(() => humoCelda(fetch, url, celda.shards.length));
  if (fallas.length > 0) {
    return {
      ok: false,
      detalle: [
        `API de ${celda.id} desplegada en ${url}, pero la prueba de humo falló:`,
        ...fallas,
      ],
    };
  }
  // HU-Q8.2: `/r/` lleva dentro la llave de recibos de la celda; sin ella, la caja no se publica.
  let claves: ClaveQr[] = [];
  const sinClaves = await conReintentos(async () => {
    try {
      claves = await clavesQrDe(fetch, url, PAGINAS.recibo);
      return [];
    } catch (e) {
      return [(e as Error).message];
    }
  });
  if (sinClaves.length > 0) return { ok: false, detalle: [`/r/: ${sinClaves.join('; ')}`] };
  try {
    ponerClavesEnLaPagina(claves, PAGINA_RECIBO, PAGINAS.recibo);
  } catch (e) {
    return { ok: false, detalle: [`parqueadero: ${(e as Error).message}`] };
  }
  const caja = await desplegarParqueadero(cred, 'staging');
  return {
    ok: caja.ok,
    detalle: [
      `celda ${celda.id} del parqueadero (staging): ${celda.shards.length} shard(s) con migraciones aplicadas${nuevas.length > 0 ? ` (creadas: ${nuevas.join(', ')})` : ''}`,
      notaKv,
      `API: ${url}`,
      deLaCelda.claveNueva
        ? 'recibos: llave de la celda nueva generada'
        : 'recibos: llave de la celda existente conservada',
      ...caja.detalle,
      `recibos: ${claves.length} llave(s) de celda en /r/`,
    ],
  };
}

async function desplegarApiCelda(
  config: ConfigCeldas,
  celda: Celda,
  cred: Credenciales,
): Promise<Paso> {
  const dest = destino as Destino;
  const staging = dest === 'staging';
  if (celda.shards.length === 0) {
    return {
      ok: false,
      detalle: [`${celda.id}: no tiene shards en celdas.json; la API no tiene dónde guardar`],
    };
  }
  const titulo = nombreKvFlags(celda.id, dest);
  const bases: Record<string, string> = {};
  const nuevas: string[] = [];
  try {
    for (const shard of celda.shards) {
      const base = await asegurarBaseD1(
        fetch,
        cred.token,
        cred.cuenta,
        baseDelShard(shard, staging),
      );
      bases[shard] = base.id;
      if (base.creada) nuevas.push(baseDelShard(shard, staging));
    }
    const ns = await asegurarNamespace(fetch, cred.token, cred.cuenta, titulo);
    await asegurarClaves(
      fetch,
      cred.token,
      cred.cuenta,
      ns.id,
      clavesDeKillSwitch(cargarProductos()),
    );
    const claves = await clavesDelCore(fetch, staging ? config.core.url_staging : config.core.url);
    const productosDeBases = await productosDeLasBases(
      fetch,
      cred.token,
      cred.cuenta,
      config.core.d1,
    );
    escribirDespliegueCelda(
      configDeLaCelda(wranglerDeLaCelda(celda, config.core.worker), dest, {
        bases,
        flagsId: ns.id,
        clavesCore: claves,
        origenesApp: [origenDelCuaderno(config)],
        cuenta: cred.cuenta,
        productosDeLasBases: productosDeBases,
      }),
    );
  } catch (e) {
    return { ok: false, detalle: [`API de ${celda.id}: ${(e as Error).message}`] };
  }

  const c = `-c ${ARCHIVO_DESPLIEGUE_CELDA} ${entorno}`;
  const pasos: [string, string][] = [
    ...celda.shards.map((shard): [string, string] => [
      `migraciones del shard ${shard}`,
      `d1 migrations apply ${shard} --remote ${c}`,
    ]),
    [`wrangler deploy de la API de ${celda.id}`, `deploy ${c}`],
  ];
  let salidaDeploy = '';
  for (const [nombrePaso, argumentos] of pasos) {
    const r = wrangler('@ed1/api-celda', argumentos, cred);
    if (!r.ok)
      return { ok: false, detalle: [`${nombrePaso} falló:`, ...causaDeWrangler(r.salida)] };
    salidaDeploy = r.salida;
  }
  // Secretos de la celda, por stdin (P13): el token del vigía (HU-E8.2) y la clave de firma del QR
  // (HU-E6.4), que solo se genera si el Worker no tiene una. Lo que falta se dice (P1).
  const tokenMetricas = process.env[celda.secretos.metricas];
  const lista = wrangler('@ed1/api-celda', `secret list --format json ${c}`, cred);
  let existentes: string[] = [];
  try {
    existentes = (
      JSON.parse(lista.salida.slice(lista.salida.indexOf('['))) as { name: string }[]
    ).map((x) => x.name);
  } catch {
    return {
      ok: false,
      detalle: [
        `no se pudo leer la lista de secretos de la API de ${celda.id} (wrangler secret list)`,
      ],
    };
  }
  const deLaCelda = await secretosDeLaCelda(
    existentes,
    tokenMetricas,
    celda.secretos.metricas,
    generarClavePrivada,
    { token: process.env['TELEGRAM_BOT_TOKEN'], chat: process.env['TELEGRAM_CHAT_ID'] },
  );
  const avisoMetricas = deLaCelda.avisos;
  if (Object.keys(deLaCelda.secretos).length > 0) {
    const carga = wrangler(
      '@ed1/api-celda',
      `secret bulk ${c}`,
      cred,
      JSON.stringify(deLaCelda.secretos),
    );
    if (!carga.ok) {
      return {
        ok: false,
        detalle: ['carga de secretos de la celda falló:', ...causaDeWrangler(carga.salida)],
      };
    }
  }
  const url = urlDeWorkersDev(salidaDeploy);
  const configurada = staging ? celda.api_staging : celda.api;
  if (url !== configurada) {
    return {
      ok: false,
      detalle: [
        `API de ${celda.id} desplegada en ${url ?? '(sin URL de workers.dev en la salida)'}, pero celdas.json dice ${configurada}. El directorio del CORE usa la de celdas.json: corrígela por PR y vuelve a desplegar.`,
      ],
    };
  }
  const fallas = await conReintentos(() => humoCelda(fetch, url, celda.shards.length));
  if (fallas.length > 0) {
    return {
      ok: false,
      detalle: [
        `API de ${celda.id} desplegada en ${url}, pero la prueba de humo falló:`,
        ...fallas,
      ],
    };
  }
  return {
    ok: true,
    detalle: [
      `API: ${url}`,
      `${celda.shards.length} shard(s) con migraciones aplicadas${nuevas.length > 0 ? ` (creadas: ${nuevas.join(', ')})` : ''}; clave del CORE cargada`,
      tokenMetricas ? 'vigía de cuota: token de métricas cargado; corre cada hora' : '',
      deLaCelda.claveNueva
        ? 'QR de trazabilidad: clave de firma nueva generada'
        : 'QR de trazabilidad: clave de firma existente conservada',
      ...avisoMetricas,
    ].filter(Boolean),
  };
}

const configCeldas = cargarCeldas();
const plan = planDeDespliegue(configCeldas, solo);
const resultados: ResultadoCelda[] = plan.fuera.map((c) => ({
  celda: c.id,
  estado: 'fuera',
  detalle: ['marcada «fuera» en celdas.json'],
}));
let detenido = false;

for (const celda of plan.aDesplegar) {
  if (detenido) {
    resultados.push({ celda: celda.id, estado: 'sin-tocar', detalle: [] });
    continue;
  }
  console.log(`\n▶ ${celda.id} (${celda.cuenta}) → ${destino}`);
  const alojaSitio = celda.id === configCeldas.sitio.celda;
  const alojaCore = celda.id === configCeldas.core.celda;
  const token = process.env[celda.secretos.token];
  const cuenta = process.env[celda.secretos.cuenta];
  const fallasToken = await verificarToken(
    fetch,
    celda,
    token,
    cuenta,
    destino,
    [
      ...(celda.id === configCeldas.sitio.celda ? [configCeldas.sitio.zona] : []),
      ...(celda.id === configCeldas.core.celda && configCeldas.core.zona
        ? [configCeldas.core.zona]
        : []),
      // HU-Q5.2: el parqueadero vive con el CORE y sale a su zona cuando se publica (P12).
      ...(celda.id === configCeldas.core.celda && productos.has('parqueadero')
        ? [ZONA_PARQUEADERO]
        : []),
    ],
    true, // toda celda crea y migra las bases de sus shards (HU-E5.1)
  );
  if (fallasToken.length > 0 || !token || !cuenta) {
    resultados.push({ celda: celda.id, estado: 'fallo', detalle: fallasToken });
    detenido = true;
    continue;
  }
  const cred = { token, cuenta };
  const detalle: string[] = [];
  let paso: Paso = { ok: true, detalle: [] };
  // En orden: el CORE (la celda necesita su clave pública), la API de la celda y el sitio, que
  // lleva dentro las claves públicas del QR de las celdas (HU-E6.4). La caja de staging sale con
  // la celda del parqueadero, que da las llaves de recibos de `/r/` (HU-Q8.2).
  if (alojaCore && productos.has('core')) {
    paso = await desplegarCore(configCeldas, celda, cred, origenDelCuaderno(configCeldas));
    detalle.push(...paso.detalle);
    if (paso.ok && destino === 'staging') {
      paso = await desplegarEnsayo(cred);
      detalle.push(...paso.detalle);
    }
  } else if (alojaCore) {
    detalle.push('CORE: sin publicar en este despliegue (su versión no cambió)');
  }
  // HU-Q7.2: cada celda despliega lo de su producto. La del CORE y el sitio es del agro.
  if (celda.producto === 'parqueadero') {
    const prepara = preparaLasCeldasDelParqueadero(destino as Destino, productos);
    if (paso.ok && prepara) {
      paso = await prepararCeldaDelParqueadero(configCeldas, celda, cred);
      detalle.push(...paso.detalle);
    } else if (!prepara) {
      detalle.push('parqueadero: sin publicar en este despliegue (su versión no cambió)');
    }
  } else if (paso.ok && productos.has('agro')) {
    paso = await desplegarApiCelda(configCeldas, celda, cred);
    detalle.push(...paso.detalle);
    if (paso.ok && alojaSitio) {
      paso = await desplegarSitio(configCeldas, celda, cred);
      detalle.push(...paso.detalle);
    }
  } else if (!productos.has('agro')) {
    detalle.push('agro: sin publicar en este despliegue (su versión no cambió)');
  }
  // HU-Q0.3 y HU-Q5.2: el parqueadero publicado va a su dominio, nunca a workers.dev.
  if (paso.ok && alojaCore && destino === 'produccion' && productos.has('parqueadero')) {
    paso = await desplegarParqueadero(cred, 'produccion');
    detalle.push(...paso.detalle);
  }
  resultados.push({ celda: celda.id, estado: paso.ok ? 'desplegada' : 'fallo', detalle });
  if (!paso.ok) detenido = true;
}

const resumen = resumenDespliegue(destino, resultados);
console.log(`\n${resumen}`);
const archivoResumen = process.env['GITHUB_STEP_SUMMARY'];
if (archivoResumen) appendFileSync(archivoResumen, `${resumen}\n`);
process.exitCode = resultados.some((r) => r.estado === 'fallo') ? 1 : 0;
