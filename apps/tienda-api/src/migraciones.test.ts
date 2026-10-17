/**
 * Bitácora tienda3 29: cada migración del shard, medida contra la tienda llena. El 17 oct 2026 la
 * 0007 corrió en staging con Ensayo Uno lleno y leyó 24 millones de filas en una sola sentencia:
 * el límite diario de D1 es de 5 millones para toda la cuenta, también para el parqueadero, que ya
 * tiene un cliente. Solo el D1 de workerd cuenta las filas que lee.
 *
 * La tienda se siembra con el esquema de antes de `DESDE` y cada migración siguiente se aplica una
 * por una. Una migración nueva entra sola en la prueba.
 */
import type { BaseD1 } from '@ed1/d1';
import { archivosDeMigracion, baseLocal, sentenciasDe } from '@ed1/d1/local';
import { ENSAYO_UNO, siembraDelShard } from '@ed1/tienda-schema/ensayos';
import { siembraDeVolumen } from '@ed1/tienda-schema/volumen';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const AHORA = '2026-10-20T17:00:00.000Z';
/** La primera migración que se mide: la siembra de la tienda llena necesita el esquema de antes. */
const DESDE = '0007';
/**
 * Lo que puede leer una migración con la tienda llena: la tienda tiene unas 16.000 filas, así que
 * alcanza para recorrer cada tabla varias veces. Es el 4 % de lo que da D1 al día a toda la cuenta.
 */
export const TOPE_DE_UNA_MIGRACION = 200_000;

let shard: BaseD1;
const cerrar: (() => Promise<void>)[] = [];

beforeAll(async () => {
  const s = await baseLocal({
    instrumento: 'workerd',
    configuracion: CONFIGURACION,
    binding: 'tienda_c1_s1',
    base: 'tienda',
    antesDe: DESDE,
  });
  shard = s.db;
  cerrar.push(s.cerrar);
  for (const sql of [
    ...siembraDelShard([ENSAYO_UNO], AHORA),
    ...siembraDeVolumen(ENSAYO_UNO, AHORA),
  ])
    await shard.prepare(sql.replace(/;$/, '')).run();
}, 180_000);
afterAll(async () => {
  for (const c of cerrar) await c();
});

const posteriores = archivosDeMigracion('tienda').filter((a) => a.nombre >= DESDE);

describe('bitácora tienda3 29 · cada migración del shard cabe en el día de D1 con la tienda llena', () => {
  it('hay migraciones que medir', () => {
    expect(posteriores.map((a) => a.nombre)).toContain('0007_lecturas_del_catalogo.sql');
  });

  // En orden: cada una corre sobre el esquema que dejaron las anteriores.
  it.each(posteriores.map((a) => [a.nombre, a.sql] as const))(
    '%s lee menos de 200.000 filas',
    async (_nombre, sql) => {
      let filas = 0;
      let peor = { filas: 0, sentencia: '' };
      for (const sentencia of sentenciasDe(sql)) {
        const r = (await shard.prepare(sentencia).run()) as { meta?: { rows_read?: number } };
        const n = Number(r.meta?.rows_read ?? 0);
        filas += n;
        if (n > peor.filas)
          peor = { filas: n, sentencia: sentencia.replace(/\s+/g, ' ').slice(0, 160) };
      }
      expect(filas, `la que más leyó (${peor.filas} filas): ${peor.sentencia}`).toBeLessThanOrEqual(
        TOPE_DE_UNA_MIGRACION,
      );
    },
    120_000,
  );
});
