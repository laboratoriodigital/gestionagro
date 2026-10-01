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
import { wranglerDelCore, wranglerDelSitio } from './generar-wrangler.ts';
import { type Celda, type ConfigCeldas, cargarCeldas, planDeDespliegue } from './lib/celdas.ts';
import {
  ARCHIVO_DESPLIEGUE_CORE,
  ARCHIVO_SQL_CELDAS,
  asegurarBaseD1,
  configDelCore,
  escribirDespliegueCore,
  nombreD1Core,
} from './lib/d1-core.ts';
import {
  causaDeWrangler,
  type Destino,
  humo,
  humoCore,
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

interface Credenciales {
  token: string;
  cuenta: string;
}
type Paso = { ok: true; detalle: string[] } | { ok: false; detalle: string[] };

/** Corre wrangler dentro de un paquete con las credenciales de la celda. */
function wrangler(paquete: string, argumentos: string, cred: Credenciales) {
  const r = spawnSync(`pnpm --filter ${paquete} exec wrangler ${argumentos}`, {
    cwd: RAIZ,
    shell: true,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, CLOUDFLARE_API_TOKEN: cred.token, CLOUDFLARE_ACCOUNT_ID: cred.cuenta },
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
  const fallas = await conReintentos(() => humo(fetch, base));
  if (fallas.length > 0) {
    return {
      ok: false,
      detalle: [`sitio desplegado en ${base}, pero la prueba de humo falló:`, ...fallas],
    };
  }
  return { ok: true, detalle: [`sitio: ${base}`, notaKv] };
}

async function desplegarCore(config: ConfigCeldas, cred: Credenciales): Promise<Paso> {
  const nombre = nombreD1Core(config.core.d1, destino as Destino);
  let notaD1: string;
  try {
    const base = await asegurarBaseD1(fetch, cred.token, cred.cuenta, nombre);
    escribirDespliegueCore(
      configDelCore(wranglerDelCore(config), destino as Destino, base.id),
      sentenciasDeCeldas(config.celdas),
    );
    notaD1 = `D1 ${nombre}${base.creada ? ' (creada)' : ''}`;
    console.log(`  ${notaD1}`);
  } catch (e) {
    return { ok: false, detalle: [`base D1 ${nombre}: ${(e as Error).message}`] };
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
  if (!url)
    return {
      ok: false,
      detalle: ['CORE: no se encontró la URL de workers.dev en la salida de wrangler'],
    };
  const activas = config.celdas.filter((x) => x.estado === 'activa').length;
  const fallas = await conReintentos(() => humoCore(fetch, url, activas));
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
    ],
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
    alojaCore,
  );
  if (fallasToken.length > 0 || !token || !cuenta) {
    resultados.push({ celda: celda.id, estado: 'fallo', detalle: fallasToken });
    detenido = true;
    continue;
  }
  if (!alojaSitio && !alojaCore) {
    // Las demás celdas recibirán la API de la celda (HU-E5.1).
    resultados.push({
      celda: celda.id,
      estado: 'desplegada',
      detalle: ['token verificado; aún no hay Workers de celda que desplegar'],
    });
    continue;
  }

  const cred = { token, cuenta };
  const detalle: string[] = [];
  let paso: Paso = { ok: true, detalle: [] };
  if (alojaSitio) {
    paso = await desplegarSitio(configCeldas, celda, cred);
    detalle.push(...paso.detalle);
  }
  if (paso.ok && alojaCore) {
    paso = await desplegarCore(configCeldas, cred);
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
