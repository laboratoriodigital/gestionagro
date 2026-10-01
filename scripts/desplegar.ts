/**
 * `node scripts/desplegar.ts --destino staging|produccion [--solo c0]` (HU-E1.5).
 *
 * Por cada celda activa, en orden de anillo: verifica el token (P12), asegura el KV de flags y
 * las claves de kill switch (HU-E8.1), despliega el Worker del sitio con wrangler y corre la
 * prueba de humo (P11). Se detiene en la primera celda que falle y
 * nombra las que quedaron sin tocar (bitácora ecommerce 105). Lo corre `.github/workflows/desplegar.yml`.
 *
 * Hoy solo el sitio vive en una celda (c0). La API de la celda (HU-E5.1) se agregará a este mismo
 * recorrido. Comandos constantes; `shell: true` solo porque en Windows `pnpm` es un `.cmd`.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { wranglerDelSitio } from './generar-wrangler.ts';
import { cargarCeldas, planDeDespliegue } from './lib/celdas.ts';
import {
  causaDeWrangler,
  type Destino,
  humo,
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

const config = cargarCeldas();
const plan = planDeDespliegue(config, solo);
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
  const token = process.env[celda.secretos.token];
  const cuenta = process.env[celda.secretos.cuenta];
  const fallasToken = await verificarToken(fetch, celda, token, cuenta, destino, config.sitio.zona);
  if (fallasToken.length > 0) {
    resultados.push({ celda: celda.id, estado: 'fallo', detalle: fallasToken });
    detenido = true;
    continue;
  }

  // Solo la celda del sitio despliega el sitio. Las demás recibirán la API de la celda (HU-E5.1).
  if (celda.id !== config.sitio.celda) {
    resultados.push({
      celda: celda.id,
      estado: 'desplegada',
      detalle: ['token verificado; aún no hay Workers de celda que desplegar'],
    });
    continue;
  }

  // HU-E8.1: KV de flags y claves de kill switch, antes de publicar el Worker que las lee.
  const titulo = nombreKvFlags(celda.id, destino);
  let notaKv: string;
  try {
    const ns = await asegurarNamespace(fetch, token ?? '', cuenta ?? '', titulo);
    const claves = await asegurarClaves(
      fetch,
      token ?? '',
      cuenta ?? '',
      ns.id,
      clavesDeKillSwitch(cargarProductos()),
    );
    escribirConfigDeDespliegue(configDeDespliegue(wranglerDelSitio(config), destino, ns.id));
    notaKv = `KV ${titulo}${ns.creado ? ' (creado)' : ''}: ${claves.creadas.length} claves creadas en «encendido», ${claves.existentes.length} ya existían y no se tocaron`;
    console.log(`  ${notaKv}`);
  } catch (e) {
    resultados.push({
      celda: celda.id,
      estado: 'fallo',
      detalle: [`KV de flags ${titulo}: ${(e as Error).message}`],
    });
    detenido = true;
    continue;
  }

  // Producción es el entorno de nivel superior de wrangler.jsonc: «--env=» lo elige sin aviso.
  const entorno = destino === 'staging' ? '--env staging' : '--env=';
  const comando = `pnpm --filter @gestionagro/sitio exec wrangler deploy -c ${ARCHIVO_DESPLIEGUE} ${entorno}`;
  const r = spawnSync(comando, {
    cwd: RAIZ,
    shell: true,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: cuenta },
  });
  const salida = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  process.stdout.write(salida);
  if (r.status !== 0) {
    resultados.push({
      celda: celda.id,
      estado: 'fallo',
      detalle: ['wrangler deploy falló:', ...causaDeWrangler(salida)],
    });
    detenido = true;
    continue;
  }

  const base =
    destino === 'produccion' ? `https://${config.sitio.dominio}` : urlDeWorkersDev(salida);
  if (!base) {
    resultados.push({
      celda: celda.id,
      estado: 'fallo',
      detalle: ['no se encontró la URL de workers.dev en la salida de wrangler'],
    });
    detenido = true;
    continue;
  }

  // Un despliegue nuevo tarda unos segundos en verse en todas partes: hasta 5 intentos.
  let fallasHumo: string[] = [];
  for (let intento = 1; intento <= 5; intento++) {
    fallasHumo = await humo(fetch, base);
    if (fallasHumo.length === 0) break;
    console.log(
      `  humo, intento ${intento}: ${fallasHumo.length} fallas; reintento en ${intento * 3} s`,
    );
    await new Promise((listo) => setTimeout(listo, intento * 3000));
  }
  if (fallasHumo.length > 0) {
    resultados.push({
      celda: celda.id,
      estado: 'fallo',
      detalle: [`desplegado en ${base}, pero la prueba de humo falló:`, ...fallasHumo],
    });
    detenido = true;
    continue;
  }
  resultados.push({ celda: celda.id, estado: 'desplegada', detalle: [base, notaKv] });
}

const resumen = resumenDespliegue(destino, resultados);
console.log(`\n${resumen}`);
const archivoResumen = process.env['GITHUB_STEP_SUMMARY'];
if (archivoResumen) appendFileSync(archivoResumen, `${resumen}\n`);
process.exitCode = resultados.some((r) => r.estado === 'fallo') ? 1 : 0;
