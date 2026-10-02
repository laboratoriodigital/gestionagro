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
import { sentenciasDeCeldas } from '../apps/core/src/celdas.ts';
import { PRODUCTO_CORE } from '../apps/core/src/constantes.ts';
import { claveKillSwitch } from '../packages/kill-switch/src/index.ts';
import { generarClavePrivada } from '../packages/tokens/src/index.ts';
import {
  baseDelShard,
  wranglerDeLaCelda,
  wranglerDelCore,
  wranglerDelSitio,
} from './generar-wrangler.ts';
import {
  ARCHIVO_DESPLIEGUE_CELDA,
  clavesDelCore,
  configDeLaCelda,
  escribirDespliegueCelda,
  humoCelda,
  secretosDeLaCelda,
} from './lib/api-celda.ts';
import { type Celda, type ConfigCeldas, cargarCeldas, planDeDespliegue } from './lib/celdas.ts';
import { type ClaveQr, clavesQrDe, ponerClavesEnLaPagina } from './lib/claves-qr.ts';
import {
  ARCHIVO_DESPLIEGUE_CORE,
  ARCHIVO_SQL_CELDAS,
  asegurarBaseD1,
  configDelCore,
  escribirDespliegueCore,
  nombreD1Core,
  secretosDelCore,
} from './lib/d1-core.ts';
import {
  causaDeWrangler,
  type Destino,
  humo,
  humoCore,
  humoEntrar,
  type ResultadoCelda,
  resumenDespliegue,
  urlDeWorkersDev,
  verificarToken,
} from './lib/despliegue.ts';
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
import { RAIZ } from './lib/repo.ts';

const argumento = (nombre: string) => {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const destino = argumento('--destino') as Destino | undefined;
if (destino !== 'staging' && destino !== 'produccion') {
  console.error('❌ Uso: node scripts/desplegar.ts --destino staging|produccion [--solo c0]');
  process.exit(1);
}
const solo = argumento('--solo') || undefined;
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
  for (const otra of config.celdas.filter((x) => x.estado === 'activa')) {
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

  const deploy = wrangler('@gestionagro/sitio', `deploy -c ${ARCHIVO_DESPLIEGUE} ${entorno}`, cred);
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
    await asegurarClaves(fetch, cred.token, cred.cuenta, ns.id, [claveKillSwitch(PRODUCTO_CORE)]);
    escribirDespliegueCore(
      configDelCore(wranglerDelCore(config), dest, {
        baseId: base.id,
        flagsId: ns.id,
        origenesApp: [origenApp],
      }),
      sentenciasDeCeldas(config.celdas, dest),
    );
    notaD1 = `D1 ${nombre}${base.creada ? ' (creada)' : ''}`;
    console.log(`  ${notaD1}`);
  } catch (e) {
    return { ok: false, detalle: [`CORE (${nombre}, ${titulo}): ${(e as Error).message}`] };
  }

  const c = `-c ${ARCHIVO_DESPLIEGUE_CORE} ${entorno}`;
  const pasos: [string, string][] = [
    ['migraciones del CORE', `d1 migrations apply DB --remote ${c}`],
    ['directorio de celdas', `d1 execute DB --remote --file ${ARCHIVO_SQL_CELDAS} ${c}`],
    ['wrangler deploy del CORE', `deploy ${c}`],
  ];
  let salidaDeploy = '';
  for (const [nombrePaso, argumentos] of pasos) {
    const r = wrangler('@gestionagro/core', argumentos, cred);
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
  const lista = wrangler('@gestionagro/core', `secret list --format json ${c}`, cred);
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
    );
  } catch (e) {
    return { ok: false, detalle: [`CORE: ${(e as Error).message}`] };
  }
  const carga = wrangler('@gestionagro/core', `secret bulk ${c}`, cred, JSON.stringify(secretos));
  if (!carga.ok) {
    return {
      ok: false,
      detalle: ['carga de secretos del CORE falló:', ...causaDeWrangler(carga.salida)],
    };
  }
  const notaClave = secretos['CORE_JWT_PRIVATE_KEY']
    ? 'clave de firma nueva generada'
    : 'clave de firma existente conservada';

  const activas = config.celdas.filter((x) => x.estado === 'activa').length;
  const fallas = await conReintentos(async () => [
    ...(await humoCore(fetch, url, activas)),
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
    escribirDespliegueCelda(
      configDeLaCelda(wranglerDeLaCelda(celda), dest, {
        bases,
        flagsId: ns.id,
        clavesCore: claves,
        origenesApp: [origenDelCuaderno(config)],
        cuenta: cred.cuenta,
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
    const r = wrangler('@gestionagro/api-celda', argumentos, cred);
    if (!r.ok)
      return { ok: false, detalle: [`${nombrePaso} falló:`, ...causaDeWrangler(r.salida)] };
    salidaDeploy = r.salida;
  }
  // Secretos de la celda, por stdin (P13): el token del vigía (HU-E8.2) y la clave de firma del QR
  // (HU-E6.4), que solo se genera si el Worker no tiene una. Lo que falta se dice (P1).
  const tokenMetricas = process.env[celda.secretos.metricas];
  const lista = wrangler('@gestionagro/api-celda', `secret list --format json ${c}`, cred);
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
      '@gestionagro/api-celda',
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
    configCeldas.sitio.zona,
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
  // lleva dentro las claves públicas del QR de las celdas (HU-E6.4).
  if (alojaCore) {
    paso = await desplegarCore(configCeldas, celda, cred, origenDelCuaderno(configCeldas));
    detalle.push(...paso.detalle);
  }
  if (paso.ok) {
    paso = await desplegarApiCelda(configCeldas, celda, cred);
    detalle.push(...paso.detalle);
  }
  if (paso.ok && alojaSitio) {
    paso = await desplegarSitio(configCeldas, celda, cred);
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
