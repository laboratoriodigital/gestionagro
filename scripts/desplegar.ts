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
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSULTAS_DEL_CATALOGO,
  diferenciasDelCatalogo,
  sentenciasDelCatalogo,
} from '../apps/core/src/catalogo.ts';
import { sentenciasDeCeldas } from '../apps/core/src/celdas.ts';
import { killSwitchesDelCore } from '../apps/core/src/constantes.ts';
import { SITIO } from '../apps/sitio/src/lib/seo.ts';
import { claveKillSwitch } from '../packages/kill-switch/src/index.ts';
import { direccionDeLaTienda } from '../packages/tienda-schema/src/alta.ts';
import { hostDeStaging } from '../packages/tienda-schema/src/ensayos.ts';
import { DOMINIO_DE_LA_MARCA } from '../packages/tienda-schema/src/marca.ts';
import { generarClavePrivada } from '../packages/tokens/src/index.ts';
import { archivosDeLaVitrina } from './armar-vitrina.ts';
import {
  baseDelShard,
  DOMINIO_PARQUEADERO,
  DOMINIOS_DE_LA_TIENDA,
  WORKER_PARQUEADERO,
  wranglerDeLaCelda,
  wranglerDeLaCeldaDeLaTienda,
  wranglerDeLaCeldaDelParqueadero,
  wranglerDelCore,
  wranglerDelSitio,
  wranglerDelSitioDeLaTienda,
  ZONA_DE_LAS_TIENDAS,
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
import { armarLaLandingPara } from './lib/cabeceras-tiendapro.ts';
import {
  ARCHIVO_DESPLIEGUE_PARQUEADERO,
  CONSULTA_HUMO_SHARD,
  celdasDelDirectorio,
  configDeLaCeldaDelParqueadero,
  escribirDespliegueDelParqueadero,
  origenesDeLaCaja,
  preparaLasCeldasDelParqueadero,
  secretosDeLaCeldaDelParqueadero,
  tablasQueFaltan,
} from './lib/celda-parqueadero.ts';
import {
  ARCHIVO_DESPLIEGUE_TIENDA,
  ARCHIVO_SQL_RESERVADOS,
  configDeLaApi,
  configDelSitio,
  consultaDeEnsayosEnElCore,
  correoDelDueno,
  ensayosDelDestino,
  ensayosEnElCore,
  escribirDespliegue,
  escribirHosts,
  escribirReservados,
  escribirSiembra,
  hostsDeLaCelda,
  humoDeLaTienda,
  kekQueSeRetiran,
  nombreKvHosts,
  notaDeEnsayosEnElCore,
  preparaLaTienda,
  publicarEnsayos,
  reenvolverEnLaCelda,
  reservadosDeDominios,
  SECRETO_DESPACHO,
  secretosDeLaTienda,
  sentenciasDeReservados,
  subirRelease,
  urlQueNoDebeResponder,
} from './lib/celda-tienda.ts';
import { type Celda, type ConfigCeldas, cargarCeldas, planDeDespliegue } from './lib/celdas.ts';
import {
  type ClaveQr,
  clavesQrDe,
  PAGINA_RECIBO,
  PAGINAS,
  ponerClavesEnLaPagina,
} from './lib/claves-qr.ts';
import {
  idsDeZonas,
  permisosDeMas,
  permisosEnObservacion,
  verificarTokenDeMetricas,
  verificarTokenDeSaas,
} from './lib/credenciales.ts';
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
  secretosOpcionalesDelCore,
  valorOpcionalDelCore,
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
import { parteDe, productosADesplegar, productosDeLaParte } from './lib/publicacion.ts';
import {
  cargarProductos as cargarRegistroDeProductos,
  catalogoDelRepositorio,
} from './lib/registro-productos.ts';
import { RAIZ } from './lib/repo.ts';
import { nombresDeSecretos } from './lib/secretos-de-wrangler.ts';
import {
  esperadoDelRepositorio,
  type InformeDeAgentes,
  informeDeAgentes,
  verificarAgentes,
} from './lib/verificar-agentes.ts';
import { verificarTienda } from './lib/verificar-tienda.ts';

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
// HU-C11.3 CA2: con `--parte`, solo lo de esa parte; el flujo la corre con solo sus secretos.
const parte = parteDe(argumento('--parte'));
const productos = productosDeLaParte(productosADesplegar(argumento('--productos')), parte);
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

/**
 * Bitácora tienda3 64 y 75: la subida de los archivos a Cloudflare puede fallar una vez sin causa
 * (`assets-upload-session`, código 10013). Un `wrangler deploy` se reintenta tres veces antes de
 * detener el despliegue; desplegar otra vez la misma versión no cambia nada.
 */
async function desplegarConIntentos(paquete: string, argumentos: string, cred: Credenciales) {
  let deploy = { ok: false, salida: '' };
  for (let intento = 1; intento <= 3; intento++) {
    deploy = wrangler(paquete, `deploy ${argumentos}`, cred);
    if (deploy.ok || intento === 3) break;
    console.log(`  ${paquete} no subió (intento ${intento}); reintento en ${intento * 10} s`);
    await new Promise((listo) => setTimeout(listo, intento * 10_000));
  }
  return deploy;
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
  // HU-C8.5: lo legible por agentes. En staging, una falla detiene el trabajo y producción no sale.
  const esperado = esperadoDelRepositorio(RAIZ, SITIO, (ruta) =>
    existsSync(ruta) ? readFileSync(ruta, 'utf8') : null,
  );
  let agentes: InformeDeAgentes = { fallas: [], avisos: [], noAplica: [] };
  await conReintentos(async () => {
    agentes = await verificarAgentes(fetch, base, esperado);
    return agentes.fallas;
  });
  if (agentes.fallas.length > 0) {
    return {
      ok: false,
      detalle: [
        `sitio desplegado en ${base}, pero lo legible por agentes falló:`,
        ...informeDeAgentes(agentes),
      ],
    };
  }
  return {
    ok: true,
    detalle: [
      `sitio: ${base}`,
      ...agentes.avisos.map((a) => `agentes: ${a}`),
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
  // HU-T2.10 CA2: en staging, las organizaciones de los comercios de prueba de la Tienda, con el
  // dueño de propietario si su correo está en el ambiente. Un correo mal escrito no detiene el CORE.
  const ensayos = ensayosDelDestino(dest);
  const celdaDeLaTienda = config.celdas.find((x) => x.producto === 'tienda');
  const delDueno = correoDelDueno(process.env);
  const correo = delDueno.ok ? delDueno.correo : null;
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
        ...(celdaDeLaTienda
          ? ensayosEnElCore(ensayos, celdaDeLaTienda, correo, new Date().toISOString())
          : []),
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
  // HU-T2.10 CA2: se lee lo que quedó, no se le cree a wrangler (P16).
  let notaEnsayos: string | null = null;
  if (ensayos.length > 0 && celdaDeLaTienda) {
    const lectura = wrangler(
      '@ed1/core',
      `d1 execute DB --remote --json --command "${consultaDeEnsayosEnElCore(ensayos, correo)}" ${c}`,
      cred,
    );
    const fila = lectura.ok ? resultadosDeLaSalida(lectura.salida)?.[0]?.[0] : undefined;
    const r = notaDeEnsayosEnElCore(ensayos.length, fila, correo);
    if (!r.ok) {
      return {
        ok: false,
        detalle: [r.nota, ...(lectura.ok ? [] : causaDeWrangler(lectura.salida))],
      };
    }
    notaEnsayos = delDueno.ok ? r.nota : `${r.nota} (${delDueno.motivo})`;
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
    existentes = nombresDeSecretos(lista.salida);
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
      { token: process.env['TELEGRAM_BOT_TOKEN'], chat: process.env['TELEGRAM_CHAT_ID'] },
      Object.fromEntries(
        secretosOpcionalesDelCore(dest).map((k) => [k, valorOpcionalDelCore(k, process.env)]),
      ),
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
      ...(notaEnsayos ? [notaEnsayos] : []),
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
  const staging = dest === 'staging';
  if (celda.shards.length === 0) {
    return { ok: false, detalle: [`${celda.id}: no tiene shards en celdas.json`] };
  }
  const titulo = nombreKvFlags(celda.id, dest, celda.producto);
  const bases: Record<string, string> = {};
  const nuevas: string[] = [];
  let notaKv: string;
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
        clavesCore: await clavesDelCore(fetch, staging ? config.core.url_staging : config.core.url),
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
  const configurada = staging ? celda.api_staging : celda.api;
  if (url !== configurada) {
    return {
      ok: false,
      detalle: [
        `API de ${celda.id} desplegada en ${url ?? '(sin URL de workers.dev en la salida)'}, pero celdas.json dice ${configurada}: corrígela por PR y vuelve a desplegar.`,
      ],
    };
  }
  // HU-Q8.1 CA3: la llave de recibos se genera una vez, solo si el Worker no tiene una.
  const lista = wrangler('@ed1/parqueadero-api', `secret list --format json ${c}`, cred);
  let existentes: string[];
  try {
    existentes = nombresDeSecretos(lista.salida);
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
  // La caja sale después de su celda: su `/r/` lleva la llave pública de recibos de la celda.
  const caja = await desplegarParqueadero(cred, dest);
  return {
    ok: caja.ok,
    detalle: [
      `celda ${celda.id} del parqueadero (${dest}): ${celda.shards.length} shard(s) con migraciones aplicadas${nuevas.length > 0 ? ` (creadas: ${nuevas.join(', ')})` : ''}`,
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

/**
 * La celda de la Tienda (HU-T2.4): sus bases con las migraciones, los reservados, sus KV y sus tres
 * Workers con sus secretos, seguida de su prueba de humo. Ver `scripts/lib/celda-tienda.ts`.
 */
async function prepararCeldaDeLaTienda(
  config: ConfigCeldas,
  celda: Celda,
  cred: Credenciales,
): Promise<Paso> {
  const dest = destino as Destino;
  const staging = dest === 'staging';
  const secretos = secretosDeLaTienda(process.env);
  if (!secretos.ok) return { ok: false, detalle: [`tienda: ${secretos.motivo}`] };
  const control = celda.control;
  if (!control) return { ok: false, detalle: [`${celda.id}: no declara su base de control`] };
  const bases: Record<string, string> = {};
  const nuevas: string[] = [];
  let notaKv: string;
  let hostsId = '';
  try {
    for (const base of [...celda.shards, control]) {
      const b = await asegurarBaseD1(fetch, cred.token, cred.cuenta, baseDelShard(base, staging));
      bases[base] = b.id;
      if (b.creada) nuevas.push(baseDelShard(base, staging));
    }
    const flags = await asegurarNamespace(
      fetch,
      cred.token,
      cred.cuenta,
      nombreKvFlags(celda.id, dest, celda.producto),
    );
    const hosts = await asegurarNamespace(
      fetch,
      cred.token,
      cred.cuenta,
      nombreKvHosts(celda.id, dest),
    );
    hostsId = hosts.id;
    const producto = cargarRegistroDeProductos().productos.find((p) => p.id === celda.producto);
    const claves = await asegurarClaves(
      fetch,
      cred.token,
      cred.cuenta,
      flags.id,
      producto?.kill_switches ?? [],
    );
    notaKv = `KV de flags: ${claves.creadas.length} kill switch(es) creados en «encendido», ${claves.existentes.length} ya existían y no se tocaron; KV de hosts ${hosts.creado ? 'creado' : 'existente'}`;
    escribirDespliegue(
      'tienda-api',
      configDeLaApi(wranglerDeLaCeldaDeLaTienda(celda), dest, {
        bases,
        flagsId: flags.id,
        hostsId: hosts.id,
        clavesCore: await clavesDelCore(fetch, staging ? config.core.url_staging : config.core.url),
        vitrinaRelease: archivosDeLaVitrina().release,
        cuenta: cred.cuenta,
      }),
    );
    escribirDespliegue(
      'tienda-sitio',
      configDelSitio(wranglerDelSitioDeLaTienda(config), dest, {
        hostsId: hosts.id,
        flagsId: flags.id,
      }),
    );
    escribirReservados(sentenciasDeReservados(reservadosDeDominios()));
  } catch (e) {
    return { ok: false, detalle: [`celda ${celda.id} de la Tienda: ${(e as Error).message}`] };
  }
  const c = `-c ${ARCHIVO_DESPLIEGUE_TIENDA} ${entorno}`;
  // CA4: antes de migrar una base con datos, ninguna fila huérfana (bitácora core 2).
  for (const base of [...celda.shards, control]) {
    const huerfanas = wrangler(
      '@ed1/tienda-api',
      `d1 execute ${base} --remote --json --command "${CONSULTA_HUERFANAS}" ${c}`,
      cred,
    );
    const lista = huerfanas.ok ? huerfanasDeLaSalida(huerfanas.salida) : null;
    if (lista === null || lista.length > 0) {
      return {
        ok: false,
        detalle: [
          lista === null
            ? `${base}: no se pudo revisar las claves foráneas; no se migra (P1)`
            : `${base}: ${lista.length} fila(s) huérfana(s); no se migra`,
          ...(lista ?? causaDeWrangler(huerfanas.salida)),
        ],
      };
    }
    const migrar = wrangler('@ed1/tienda-api', `d1 migrations apply ${base} --remote ${c}`, cred);
    if (!migrar.ok) {
      return {
        ok: false,
        detalle: [`migraciones de ${base} fallaron:`, ...causaDeWrangler(migrar.salida)],
      };
    }
  }
  const reservados = wrangler(
    '@ed1/tienda-api',
    `d1 execute ${control} --remote --file ${ARCHIVO_SQL_RESERVADOS} ${c}`,
    cred,
  );
  if (!reservados.ok) {
    return {
      ok: false,
      detalle: [
        'los reservados de dominios.json no entraron a la base de control:',
        ...causaDeWrangler(reservados.salida),
      ],
    };
  }
  // HU-T2.6: los comercios de prueba, solo en staging (CA3).
  const ensayos = ensayosDelDestino(dest);
  if (ensayos.length > 0) {
    const archivos = escribirSiembra(celda, new Date().toISOString());
    for (const [base, archivo] of [
      [celda.shards[0] ?? '', archivos.shard],
      [control, archivos.control],
    ] as const) {
      const siembra = wrangler(
        '@ed1/tienda-api',
        `d1 execute ${base} --remote --file ${archivo} ${c}`,
        cred,
      );
      if (!siembra.ok) {
        return {
          ok: false,
          detalle: [
            `la siembra de los comercios de prueba en ${base} falló:`,
            ...causaDeWrangler(siembra.salida),
          ],
        };
      }
    }
    try {
      await escribirHosts(fetch, cred.token, cred.cuenta, hostsId, hostsDeLaCelda(celda));
    } catch (e) {
      return { ok: false, detalle: [`tienda: ${(e as Error).message}`] };
    }
  }
  // HU-T13.1: el token de Cloudflare for SaaS, probado antes de cargarlo; solo en producción y con
  // SaaS activo en la zona (celdas.json). Sin él, conectar un dominio dice «no disponible».
  const avisosDeSaas: string[] = [];
  if (!staging && celda.saas) {
    const saas = await verificarTokenDeSaas(
      fetch,
      process.env['CF_SAAS_TOKEN']?.trim(),
      cred.cuenta,
      ZONA_DE_LAS_TIENDAS,
    );
    avisosDeSaas.push(...saas.avisos);
    if (saas.cargar) secretos.api['CF_SAAS_TOKEN'] = process.env['CF_SAAS_TOKEN']?.trim() ?? '';
  }
  // La API primero: el despacho y el panel la nombran en sus bindings de servicio.
  const pasos: [string, string, Record<string, string>][] = [
    ['@ed1/tienda-api', c, secretos.api],
    ['@ed1/tienda-sitio', c, secretos.frente],
    ['@ed1/tienda-panel', entorno, secretos.frente],
  ];
  const urls: Record<string, string | null> = {};
  for (const [paquete, opciones, deEste] of pasos) {
    const deploy = await desplegarConIntentos(paquete, opciones, cred);
    if (!deploy.ok) {
      return {
        ok: false,
        detalle: [`wrangler deploy de ${paquete} falló:`, ...causaDeWrangler(deploy.salida)],
      };
    }
    urls[paquete] = urlDeWorkersDev(deploy.salida);
    const carga = wrangler(paquete, `secret bulk ${opciones}`, cred, JSON.stringify(deEste));
    if (!carga.ok) {
      return {
        ok: false,
        detalle: [`los secretos de ${paquete} no se cargaron:`, ...causaDeWrangler(carga.salida)],
      };
    }
  }
  // HU-T2.9: producción no tiene workers.dev; el panel y el despacho están en sus dominios.
  const panel = staging ? urls['@ed1/tienda-panel'] : `https://${DOMINIOS_DE_LA_TIENDA.panel}`;
  const sitio = staging ? urls['@ed1/tienda-sitio'] : `https://${DOMINIOS_DE_LA_TIENDA.origen}`;
  const esperado = staging ? celda.api_staging : celda.api;
  if (!panel || !sitio || panel !== esperado) {
    return {
      ok: false,
      detalle: [
        `panel desplegado en ${panel ?? '?'} y despacho en ${sitio ?? '?'}, pero celdas.json dice ${esperado} para el panel: corrígelo por PR y vuelve a desplegar.`,
      ],
    };
  }
  // HU-T18.5: la landing de TiendaPro, con el panel de este ambiente en «Crear tienda». Producción
  // la vuelve a armar para producción: el build la deja lista para staging.
  const landing = await desplegarLaLanding(dest, cred, panel);
  if (!landing.ok) return landing;
  // HU-T4.6 CA2: la release de este despliegue, al almacén, para cuando llegue la siguiente.
  if (secretos.ok) {
    const { release, archivos } = archivosDeLaVitrina();
    const fallasDeLaRelease = await conReintentos(() =>
      subirRelease(fetch, panel, secretos.frente[SECRETO_DESPACHO] ?? '', release, archivos),
    );
    if (fallasDeLaRelease.length > 0) {
      return {
        ok: false,
        detalle: [
          'la Tienda se desplegó, pero su vitrina no quedó guardada:',
          ...fallasDeLaRelease,
        ],
      };
    }
  }
  // HU-T17.6: las llaves de las tiendas, reenvueltas con la KEK vigente; la que salió del ambiente
  // de GitHub se borra del Worker solo si ninguna llave la usa (CA2).
  let notaLlaves: string | null = null;
  if (secretos.conKek) {
    const llaves = await reenvolverEnLaCelda(fetch, panel, secretos.frente[SECRETO_DESPACHO] ?? '');
    if (llaves.fallas.length > 0 || !llaves.uso) {
      return {
        ok: false,
        detalle: ['la Tienda se desplegó, pero sus llaves no se reenvolvieron:', ...llaves.fallas],
      };
    }
    const lista = wrangler('@ed1/tienda-api', `secret list --format json ${c}`, cred);
    let enElWorker: string[];
    try {
      enElWorker = nombresDeSecretos(lista.salida);
    } catch {
      return {
        ok: false,
        detalle: [
          'no se pudo leer la lista de secretos de la API de la Tienda (wrangler secret list)',
        ],
      };
    }
    const retiro = kekQueSeRetiran(
      enElWorker,
      Object.keys(secretos.api),
      llaves.uso.enUso,
      llaves.uso.ilegibles,
    );
    if (retiro.fallas.length > 0) {
      return { ok: false, detalle: ['la Tienda se desplegó, pero:', ...retiro.fallas] };
    }
    for (const nombre of retiro.borrar) {
      const borrar = wrangler('@ed1/tienda-api', `secret delete ${nombre} ${c}`, cred, 'y\n');
      if (!borrar.ok) {
        return {
          ok: false,
          detalle: [`${nombre} no se pudo borrar del Worker:`, ...causaDeWrangler(borrar.salida)],
        };
      }
    }
    const u = llaves.uso;
    notaLlaves = `llaves de la Tienda: envuelve ${u.vigente}${u.reenvueltas > 0 ? `, ${u.reenvueltas} reenvueltas` : ''}${u.quedan > 0 ? `, ${u.quedan} todavía con otra KEK (sigue el cron)` : ''}${retiro.borrar.length > 0 ? `; retiradas del Worker: ${retiro.borrar.join(', ')}` : ''}`;
  }
  // Bitácora tienda3 49: los comercios de prueba que no se publicaron por llenos siguen con su versión.
  const omitidas = new Set<string>();
  // HU-T4.4: en staging, publicar a los comercios de prueba antes del humo, que mira sus portadas.
  if (ensayos.length > 0 && secretos.ok) {
    const despacho = secretos.frente[SECRETO_DESPACHO] ?? '';
    const fallasAlPublicar = await conReintentos(() =>
      publicarEnsayos(fetch, panel, despacho, (slugs) => {
        for (const s of slugs) omitidas.add(s);
      }),
    );
    if (fallasAlPublicar.length > 0) {
      return {
        ok: false,
        detalle: [
          'la Tienda se desplegó, pero no pudo publicar a los comercios de prueba:',
          ...fallasAlPublicar,
        ],
      };
    }
  }
  let avisos: string[] = [];
  const fallas = await conReintentos(async () => {
    const r = await humoDeLaTienda(
      fetch,
      {
        panel,
        sitio,
        apiPorFuera: urlQueNoDebeResponder(celda, dest),
        // HU-T18.6 CA3: con el comodín de este ambiente, una dirección que nadie tiene.
        ...(celda.comodin === true || (celda.comodin === 'staging' && staging)
          ? {
              sinTiendaEnLaZona: `https://${direccionDeLaTienda(`humo-${Date.now().toString(36)}`, dest)}`,
            }
          : {}),
      },
      ensayos,
      { ambiente: dest },
    );
    avisos = r.avisos;
    return r.fallas;
  });
  if (fallas.length > 0) {
    return {
      ok: false,
      detalle: ['la Tienda se desplegó, pero la prueba de humo falló:', ...fallas],
    };
  }
  // HU-T15.6: lo legible por agentes de cada comercio de prueba, con todas las fallas a la vez. Una
  // falla en staging detiene la salida a producción (P16).
  const agentesDelEcosistema = (
    JSON.parse(readFileSync(join(RAIZ, 'content', 'agentes.json'), 'utf8')) as {
      familias: { agentes: string[] }[];
    }
  ).familias.flatMap((x) => x.agentes);
  const deLosAgentes: string[] = [];
  const sinMcp: string[] = [];
  for (const e of ensayos) {
    if (omitidas.has(e.slug)) {
      sinMcp.push(
        `agentes de ${e.slug}: no se revisa, se omitió al publicar por llena (bitácora tienda3 31)`,
      );
      continue;
    }
    const base = `https://${hostDeStaging(e.slug)}`;
    let informe: InformeDeAgentes = { fallas: [], avisos: [], noAplica: [] };
    await conReintentos(async () => {
      informe = await verificarTienda(fetch, base, agentesDelEcosistema);
      return informe.fallas;
    });
    deLosAgentes.push(...informe.fallas.map((x) => `${e.slug}: ${x}`));
    sinMcp.push(...informe.noAplica.map((x) => `agentes de ${e.slug}: ${x}`));
  }
  if (deLosAgentes.length > 0) {
    return {
      ok: false,
      detalle: ['la Tienda se desplegó, pero lo legible por agentes falló:', ...deLosAgentes],
    };
  }
  return {
    ok: true,
    detalle: [
      `celda ${celda.id} de la Tienda (${dest}): shard y control con migraciones aplicadas${nuevas.length > 0 ? ` (creadas: ${nuevas.join(', ')})` : ''}, y los reservados de dominios.json`,
      notaKv,
      ...(ensayos.length > 0
        ? [
            `comercios de prueba: ${ensayos.map((e) => `https://${hostDeStaging(e.slug)}`).join(', ')}`,
          ]
        : []),
      `panel: ${panel}`,
      `despacho: ${sitio}`,
      ...landing.detalle,
      ...(notaLlaves ? [notaLlaves] : []),
      ...avisosDeSaas,
      ...avisos,
      ...sinMcp,
    ],
  };
}

/**
 * HU-T18.5: la landing de TiendaPro (`apps/tiendapro-sitio`), solo assets. En producción va a
 * `tiendapro.co` y `www.`; en staging, a workers.dev y sin indexar. Después de desplegarla se mira
 * que responda y que «Crear tienda» lleve al panel de este ambiente (P16).
 */
async function desplegarLaLanding(dest: Destino, cred: Credenciales, panel: string): Promise<Paso> {
  const dist = join(RAIZ, 'apps', 'tiendapro-sitio', 'dist');
  if (!existsSync(join(dist, 'index.html'))) {
    return { ok: false, detalle: ['la landing de TiendaPro no está armada: falta su build'] };
  }
  armarLaLandingPara(dist, dest);
  const deploy = await desplegarConIntentos(
    '@ed1/tiendapro-sitio',
    dest === 'staging' ? '--env staging' : '--env=',
    cred,
  );
  if (!deploy.ok) {
    return {
      ok: false,
      detalle: [
        'wrangler deploy de la landing de TiendaPro falló:',
        ...causaDeWrangler(deploy.salida),
      ],
    };
  }
  const url =
    dest === 'staging' ? urlDeWorkersDev(deploy.salida) : `https://${DOMINIO_DE_LA_MARCA}`;
  if (!url) return { ok: false, detalle: ['la landing de TiendaPro no dijo su dirección'] };
  const fallas = await conReintentos(async () => {
    try {
      const r = await fetch(`${url}/`);
      const html = await r.text();
      if (r.status !== 200) return [`la landing respondió ${r.status}`];
      const alPanel = panel.replace(/\/$/, '');
      return html.includes(`href="${alPanel}/"`)
        ? []
        : [`«Crear tienda» de la landing no lleva a ${alPanel}/`];
    } catch (e) {
      return [`la landing no respondió (${(e as Error).message})`];
    }
  });
  if (fallas.length > 0) return { ok: false, detalle: ['la landing de TiendaPro:', ...fallas] };
  return { ok: true, detalle: [`landing: ${url}`] };
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
      // Las de los contratos del agro y las del producto en productos.json (ks:agro-mcp, HU-C9.7).
      [
        ...clavesDeKillSwitch(cargarProductos()),
        ...(cargarRegistroDeProductos().productos.find((p) => p.id === celda.producto)
          ?.kill_switches ?? []),
      ],
    );
    const claves = await clavesDelCore(fetch, staging ? config.core.url_staging : config.core.url);
    const productosDeBases = await productosDeLasBases(
      fetch,
      cred.token,
      cred.cuenta,
      config.core.d1,
    );
    escribirDespliegueCelda(
      configDeLaCelda(wranglerDeLaCelda(celda, config.core), dest, {
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
    existentes = nombresDeSecretos(lista.salida);
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

// HU-C11.3 CA2: una parte sin nada que desplegar termina antes de leer un solo token.
// La celda del parqueadero y la de la Tienda se preparan en staging aunque su versión no cambie.
const prepararParqueaderoEnStaging = parte === 'parqueadero' && destino === 'staging';
const prepararTiendaEnStaging = parte === 'tienda' && destino === 'staging';
if (parte && productos.size === 0 && !prepararParqueaderoEnStaging && !prepararTiendaEnStaging) {
  console.log(`Parte ${parte}: nada que desplegar en ${destino} (su versión no cambió).`);
  process.exit(0);
}
/** La nota de lo que no se despliega: en otro paso, o porque su versión no cambió. */
const noSale = (cual: string, deLaParte: string) =>
  parte && parte !== deLaParte
    ? `${cual}: en su propio paso del despliegue`
    : `${cual}: sin publicar en este despliegue (su versión no cambió)`;

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
  const zonasDeLaCelda = [
    ...(celda.id === configCeldas.sitio.celda ? [configCeldas.sitio.zona] : []),
    ...(celda.id === configCeldas.core.celda && configCeldas.core.zona
      ? [configCeldas.core.zona]
      : []),
    // HU-Q5.2: el parqueadero vive con el CORE y sale a su zona cuando se publica (P12).
    ...(celda.id === configCeldas.core.celda && productos.has('parqueadero')
      ? [ZONA_PARQUEADERO]
      : []),
  ];
  const fallasToken = await verificarToken(
    fetch,
    celda,
    token,
    cuenta,
    destino,
    zonasDeLaCelda,
    true, // toda celda crea y migra las bases de sus shards (HU-E5.1)
  );
  // HU-C11.5: lo que sobra también detiene, en el de despliegue y en el de métricas (CA3).
  let avisosDeCredenciales: string[] = [];
  if (fallasToken.length === 0 && token && cuenta) {
    const zonas = destino === 'produccion' ? await idsDeZonas(fetch, token, zonasDeLaCelda) : [];
    fallasToken.push(...(await permisosDeMas(fetch, 'despliegue', token, cuenta, zonas)));
    const enObservacion = await permisosEnObservacion(fetch, 'despliegue', token, cuenta, zonas);
    const metricas = await verificarTokenDeMetricas(
      fetch,
      process.env[celda.secretos.metricas],
      cuenta,
    );
    fallasToken.push(...metricas.fallas);
    avisosDeCredenciales = [...metricas.avisos, ...enObservacion];
  }
  if (fallasToken.length > 0 || !token || !cuenta) {
    resultados.push({ celda: celda.id, estado: 'fallo', detalle: fallasToken });
    detenido = true;
    continue;
  }
  const cred = { token, cuenta };
  const detalle: string[] = [...avisosDeCredenciales];
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
    detalle.push(noSale('CORE', 'core'));
  }
  // HU-Q7.2: cada celda despliega lo de su producto. La del CORE y el sitio es del agro.
  if (celda.producto === 'parqueadero') {
    const prepara =
      (!parte || parte === 'parqueadero') &&
      preparaLasCeldasDelParqueadero(destino as Destino, productos);
    if (paso.ok && prepara) {
      paso = await prepararCeldaDelParqueadero(configCeldas, celda, cred);
      detalle.push(...paso.detalle);
    } else if (!prepara) {
      detalle.push(noSale('parqueadero', 'parqueadero'));
    }
  } else if (celda.producto === 'tienda') {
    // HU-T2.4: la celda de la Tienda nunca toma el camino del agro. Staging, siempre; producción,
    // cuando la Tienda salga (HU-T2.9).
    const prepara =
      (!parte || parte === 'tienda') && preparaLaTienda(destino as Destino, productos);
    if (paso.ok && prepara) {
      paso = await prepararCeldaDeLaTienda(configCeldas, celda, cred);
      detalle.push(...paso.detalle);
    } else if (!prepara) {
      detalle.push(noSale('tienda', 'tienda'));
    }
  } else if (paso.ok && productos.has('agro')) {
    paso = await desplegarApiCelda(configCeldas, celda, cred);
    detalle.push(...paso.detalle);
    if (paso.ok && alojaSitio) {
      paso = await desplegarSitio(configCeldas, celda, cred);
      detalle.push(...paso.detalle);
    }
  } else if (!productos.has('agro')) {
    detalle.push(noSale('agro', 'agro'));
  }
  // HU-Q0.3 y HU-Q5.2: el parqueadero publicado va a su dominio, nunca a workers.dev. Con una
  // celda del parqueadero en celdas.json, la caja sale con ella (HU-Q7.12), no aquí.
  if (
    paso.ok &&
    alojaCore &&
    destino === 'produccion' &&
    productos.has('parqueadero') &&
    !configCeldas.celdas.some((c) => c.producto === 'parqueadero')
  ) {
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
