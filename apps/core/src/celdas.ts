/**
 * La tabla `celda` del CORE sale de `infrastructure/celdas.json` (HU-E4.1, CA2; P2). El despliegue
 * escribe estas sentencias en un archivo y las corre con `wrangler d1 execute` después de las
 * migraciones; las pruebas las corren en un D1 local y comparan con celdas.json.
 *
 * - Estado, anillo de despliegue y shards se copian de celdas.json en cada despliegue.
 * - La URL de la API y las claves públicas no se tocan: llegan con HU-E5.1 y HU-E4.2.
 * - Una celda que ya no está en celdas.json queda «fuera», nunca se borra: hay organizaciones
 *   que la nombran (P21). Igual con un shard que sale de la lista: sus organizaciones siguen
 *   ahí; solo deja de recibir nuevas.
 */
import type { CeldaDelDirectorio } from './asignacion.ts';

/** Literal de texto SQL. Los ids ya vienen validados por el esquema; esto es la segunda red. */
const texto = (valor: string) => `'${valor.replaceAll("'", "''")}'`;

export function sentenciasDeCeldas(celdas: readonly CeldaDelDirectorio[]): string[] {
  if (celdas.length === 0) throw new Error('celdas.json no trae celdas: no se toca el directorio');
  const upserts = celdas.map((c) => {
    if (!Number.isInteger(c.anillo_despliegue)) {
      throw new Error(`${c.id}: anillo_despliegue no es un entero`);
    }
    return (
      'INSERT INTO celda (id, estado, anillo_despliegue, shards) VALUES ' +
      `(${texto(c.id)}, ${texto(c.estado)}, ${c.anillo_despliegue}, ${texto(JSON.stringify(c.shards))}) ` +
      'ON CONFLICT (id) DO UPDATE SET estado = excluded.estado, ' +
      'anillo_despliegue = excluded.anillo_despliegue, shards = excluded.shards;'
    );
  });
  const ids = celdas.map((c) => texto(c.id)).join(', ');
  return [...upserts, `UPDATE celda SET estado = 'fuera' WHERE id NOT IN (${ids});`];
}
