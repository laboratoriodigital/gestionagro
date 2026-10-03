/**
 * Genera el archivo de respaldo con la temporada simulada de tomate orgánico, para importarlo en
 * Respaldo → Importar. Solo corre si se pide:
 *
 *   SIMULACION_SALIDA=simulacion/temporada-tomate-organico.json pnpm exec vitest run apps/cuaderno/src/simulacion
 *
 * Antes de escribirlo, lo importa en un cuaderno vacío: el archivo que sale ya se sabe importable.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { expect, it } from 'vitest';
import { abrirCuaderno } from '../almacen/db.ts';
import { analizarArchivo, exportarTodo, importar } from '../almacen/respaldo.ts';
import { simularTemporada } from './temporada.ts';

const salida = process.env['SIMULACION_SALIDA'];

it.skipIf(!salida)(
  'temporada de tomate orgánico: respaldo listo para importar',
  async () => {
    const db = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
    const libro = await simularTemporada(db, 2026);
    const archivo = await exportarTodo(db, {
      app: '0.1.0',
      ahora: () => new Date('2026-09-26T17:00:00Z'),
    });
    const texto = JSON.stringify(archivo);

    const vacio = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
    const agregadas = await importar(vacio, await analizarArchivo(vacio, texto));
    expect(agregadas.registro).toBe(await db.registro.count());

    if (!salida) return;
    mkdirSync(dirname(salida), { recursive: true });
    writeFileSync(salida, texto);
    console.log(
      JSON.stringify({
        archivo: salida,
        kb: Math.round(texto.length / 1024),
        registros: agregadas.registro,
        cosechas: libro.cosechas.length,
        kg: Math.round(libro.cosechas.reduce((s, c) => s + c.cantidad, 0)),
        lotes: libro.lotes.length,
        despachos: libro.despachos.length,
        aplicaciones: libro.aplicaciones.length,
        compras: libro.compras.length,
        saltadasPorCarencia: libro.saltadas.length,
      }),
    );
  },
  600_000,
);
