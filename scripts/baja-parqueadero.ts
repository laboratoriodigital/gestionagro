/**
 * Un parqueadero se va (HU-Q10.2): la línea de comandos del runbook
 * `docs/runbooks/parqueadero-baja.md`. Corre en el PC del dueño, que es Windows (P3): solo Node,
 * sin shell ni wrangler; habla con D1 por su API HTTP con `CF_API_TOKEN` y `CF_ACCOUNT_ID`.
 *
 *   node scripts/baja-parqueadero.ts exportar --destino staging --org <id> [--salida <carpeta>]
 *   node scripts/baja-parqueadero.ts verificar --archivo <ruta.json> --huella <sha256>
 *   node scripts/baja-parqueadero.ts purgar --destino staging --org <id> --archivo <ruta.json>
 *       --huella <sha256> --autor "<quién autoriza>" --confirmar "<nombre del parqueadero>"
 *   node scripts/baja-parqueadero.ts ensayar --destino staging
 *
 * `ensayar` es el ensayo de punta a punta con Parqueadero Ensayo Dos (CA2): solo en staging.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { uuidv7 } from '../packages/ids/src/index.ts';
import {
  ENTRADA_ENSAYO,
  SALIDA_ENSAYO,
  SEDE_ENSAYO_DOS,
  TARIFA_CARRO,
} from '../packages/parqueadero-schema/src/ensayos.fixture.ts';
import { baseDelShard } from './generar-wrangler.ts';
import {
  BajaRechazada,
  type Consultor,
  consultorHttp,
  ensayarBaja,
  exportar,
  purgar,
  verificarEntrega,
} from './lib/baja-parqueadero.ts';
import { cargarCeldas } from './lib/celdas.ts';

const USO = `Uso:
  node scripts/baja-parqueadero.ts exportar --destino staging|produccion --org <id> [--salida <carpeta>]
  node scripts/baja-parqueadero.ts verificar --archivo <ruta.json> --huella <sha256>
  node scripts/baja-parqueadero.ts purgar --destino staging|produccion --org <id> --archivo <ruta.json> --huella <sha256> --autor "<quién autoriza>" --confirmar "<nombre del parqueadero>"
  node scripts/baja-parqueadero.ts ensayar --destino staging`;

const argumento = (nombre: string) => {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

function exigir(nombre: string): string {
  const v = argumento(nombre);
  if (!v) throw new BajaRechazada(`falta ${nombre}\n\n${USO}`);
  return v;
}

/** La celda del parqueadero y la base de su shard en el destino (`celdas.json`, P2). */
async function conectar(destino: string): Promise<{ db: Consultor; celda: string; base: string }> {
  if (destino !== 'staging' && destino !== 'produccion') {
    throw new BajaRechazada(`--destino es staging o produccion\n\n${USO}`);
  }
  const token = process.env['CF_API_TOKEN'];
  const cuenta = process.env['CF_ACCOUNT_ID'];
  if (!token || !cuenta) {
    throw new BajaRechazada(
      'faltan CF_API_TOKEN y CF_ACCOUNT_ID (el token con «Account → D1: Edit»): docs/runbooks/parqueadero-baja.md, paso 0',
    );
  }
  const celdas = cargarCeldas().celdas.filter((c) => c.producto === 'parqueadero');
  const celda = celdas[0];
  if (celdas.length !== 1 || !celda || celda.shards.length !== 1) {
    throw new BajaRechazada(
      'hay más de una celda o de un shard del parqueadero: este script todavía no sabe en cuál está cada uno',
    );
  }
  const base = baseDelShard(celda.shards[0] ?? '', destino === 'staging');
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${cuenta}/d1/database?name=${encodeURIComponent(base)}&per_page=100`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  const lista = (
    (await r.json().catch(() => ({}))) as { result?: { uuid: string; name: string }[] }
  ).result;
  const id = lista?.find((b) => b.name === base)?.uuid;
  if (!r.ok || !id) {
    throw new BajaRechazada(
      r.status === 401 || r.status === 403
        ? 'al token le falta «Account → D1: Edit»'
        : `no existe la base ${base} en esa cuenta (HTTP ${r.status})`,
    );
  }
  return { db: consultorHttp(fetch, { token, cuenta, base: id }), celda: celda.id, base };
}

async function principal(): Promise<void> {
  const accion = process.argv[2];
  const ahora = () => Date.now();
  if (accion === 'exportar') {
    const org = exigir('--org');
    const { db, celda, base } = await conectar(exigir('--destino'));
    const ex = await exportar(db, org, { celda, ahora });
    const carpeta = resolve(argumento('--salida') ?? '.');
    mkdirSync(carpeta, { recursive: true });
    const json = join(carpeta, `${ex.nombre}.json`);
    writeFileSync(json, ex.texto);
    writeFileSync(join(carpeta, `${ex.nombre}.csv`), ex.csv);
    console.log(
      [
        `✅ ${ex.parqueadero}, exportado de ${base}:`,
        `   ${ex.archivo.tablas.registro.recuento} registros, ${ex.archivo.tablas.catalogo.recuento} catálogos y ${ex.archivo.tablas.historial.recuento} versiones anteriores.`,
        `   Archivo: ${json} (y su .csv para Excel)`,
        `   Huella (SHA-256): ${ex.huella}`,
        '',
        'Siguiente: entregue los dos archivos al parqueadero y anote la huella (runbook, paso 3).',
      ].join('\n'),
    );
    return;
  }
  if (accion === 'verificar') {
    const archivo = await verificarEntrega(
      readFileSync(exigir('--archivo'), 'utf8'),
      exigir('--huella'),
    );
    console.log(
      `✅ El archivo es el entregado y está entero: ${archivo.tablas.registro.recuento} registros.`,
    );
    return;
  }
  if (accion === 'purgar') {
    const org = exigir('--org');
    const texto = readFileSync(exigir('--archivo'), 'utf8');
    const { db, base } = await conectar(exigir('--destino'));
    const r = await purgar(db, org, {
      texto,
      huella: exigir('--huella'),
      autor: exigir('--autor'),
      confirmar: exigir('--confirmar'),
      ahora,
    });
    const b = r.borrados;
    console.log(
      r.yaHecha
        ? `✅ Ese parqueadero ya estaba purgado en ${base} con esa huella: no quedaba nada.`
        : `✅ Purgado en ${base}: ${b.registro} registros, ${b.catalogo} catálogos, ${b.entidad_historial} versiones anteriores y ${b.cuarentena} en cuarentena. La fila de purga guarda la huella.`,
    );
    return;
  }
  if (accion === 'ensayar') {
    const destino = exigir('--destino');
    if (destino !== 'staging') throw new BajaRechazada('el ensayo solo corre en staging');
    const { db, celda, base } = await conectar(destino);
    const r = await ensayarBaja(
      db,
      { sede: SEDE_ENSAYO_DOS, tarifa: TARIFA_CARRO, registros: [ENTRADA_ENSAYO, SALIDA_ENSAYO] },
      { celda, ahora, nuevoId: () => uuidv7() },
    );
    console.log(
      [`✅ Ensayo de la baja en ${base}:`, ...r.pasos.map((p) => `   · ${p}`)].join('\n'),
    );
    return;
  }
  throw new BajaRechazada(USO);
}

principal().catch((e: unknown) => {
  console.error(e instanceof BajaRechazada ? `❌ ${e.message}` : e);
  process.exitCode = 1;
});
