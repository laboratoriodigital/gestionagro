/**
 * `node scripts/copia/simulacro.ts --carpeta <carpeta con las copias bajadas de Drive>` (HU-C11.4
 * CA2): el simulacro trimestral de restaurar, en el computador del dueño y sin Cloudflare, como
 * sería el día que la cuenta no responda (ED1 §20.3).
 *
 * Por cada `<semana>_<base>.sql.ed1` de la carpeta: lo abre con la llave (que pide sin mostrarla),
 * comprueba la huella del volcado, lo carga en una base SQLite vacía (`node:sqlite`, el mismo motor
 * de D1) y cuenta las filas de cada tabla contra las que la copia dice traer. Un archivo que no se
 * abre o que no cuadra sale en rojo con su causa (CA3), y el script termina con error.
 *
 * Nada se escribe en disco: la base vive en memoria. Los pasos están en `docs/runbooks/copia-en-drive.md`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { CopiaIlegible, descifrarCopia, importarLlave } from '../../apps/core/src/copia-formato.ts';
import { mundoReal } from '../correo/permiso-de-gmail.ts';

export interface ResultadoDelSimulacro {
  archivo: string;
  ok: boolean;
  /** Filas restauradas por tabla, o la causa de que no cuadrara. */
  detalle: string;
}

const PATRON = /^(\d{4}-\d{2}-\d{2})_(.+)\.sql\.ed1$/;

/** Restaura cada copia en una base vacía y compara las filas de cada tabla. */
export async function simular(
  archivos: readonly { nombre: string; bytes: Uint8Array<ArrayBuffer> }[],
  llaveBase64: string,
): Promise<ResultadoDelSimulacro[]> {
  const llave = await importarLlave(llaveBase64);
  const resultados: ResultadoDelSimulacro[] = [];
  for (const { nombre, bytes } of archivos) {
    const m = PATRON.exec(nombre);
    if (!m) continue;
    const [, semana = '', base = ''] = m;
    try {
      const { manifiesto, volcado } = await descifrarCopia(llave, { base, semana }, bytes);
      const sqlite = new DatabaseSync(':memory:');
      try {
        sqlite.exec(new TextDecoder().decode(volcado));
        const distintas: string[] = [];
        for (const [tabla, esperadas] of Object.entries(manifiesto.filas)) {
          const fila = sqlite
            .prepare(`SELECT count(*) AS n FROM "${tabla.replace(/"/g, '""')}"`)
            .get() as { n: number } | undefined;
          if (Number(fila?.n ?? -1) !== esperadas) {
            distintas.push(`${tabla}: ${fila?.n ?? 'sin tabla'} de ${esperadas}`);
          }
        }
        const total = Object.values(manifiesto.filas).reduce((a, b) => a + b, 0);
        resultados.push(
          distintas.length === 0
            ? {
                archivo: nombre,
                ok: true,
                detalle: `${total} filas en ${Object.keys(manifiesto.filas).length} tablas, todas cuadran`,
              }
            : { archivo: nombre, ok: false, detalle: `no cuadran: ${distintas.join('; ')}` },
        );
      } finally {
        sqlite.close();
      }
    } catch (e) {
      resultados.push({
        archivo: nombre,
        ok: false,
        detalle:
          e instanceof CopiaIlegible
            ? e.message
            : `el volcado no se pudo restaurar (${(e as Error).message})`,
      });
    }
  }
  return resultados;
}

if (process.argv[1]?.endsWith('simulacro.ts')) {
  const i = process.argv.indexOf('--carpeta');
  const carpeta = process.argv[i + 1];
  if (i < 0 || !carpeta) {
    console.error('❌ Uso: node scripts/copia/simulacro.ts --carpeta <carpeta con las copias>');
    process.exit(1);
  }
  const archivos = readdirSync(carpeta)
    .filter((n) => PATRON.test(n))
    .map((nombre) => ({ nombre, bytes: new Uint8Array(readFileSync(join(carpeta, nombre))) }));
  if (archivos.length === 0) {
    console.error(`❌ En ${carpeta} no hay copias (<semana>_<base>.sql.ed1).`);
    process.exit(1);
  }
  const llave = (
    await mundoReal().preguntar('Llave de la copia (no se ve al pegarla): ', true)
  ).trim();
  const resultados = await simular(archivos, llave).catch((e: Error) => {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  });
  for (const r of resultados) console.log(`${r.ok ? '✅' : '❌'} ${r.archivo}: ${r.detalle}`);
  process.exit(resultados.every((r) => r.ok) ? 0 : 1);
}
