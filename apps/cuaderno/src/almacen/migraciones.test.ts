/**
 * Migraciones locales (HU-E3.2, CA3; ARQUITECTURA §7.4). Una base creada con cualquier versión
 * anterior y con datos de las dos fincas de prueba se abre con la última: no se pierde nada
 * (P4 al revés, P21).
 *
 * Lo que fake-indexeddb NO imita (P17): la cuota y el desalojo del navegador, ni una
 * actualización interrumpida a mitad por cerrar la app.
 */
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { SEMILLAS } from '../../../../tests/fixtures/semillas.ts';
import { abrirCuaderno, type CuadernoDb, VERSIONES_LOCALES, type VersionLocal } from './db.ts';

async function sembrar(db: CuadernoDb): Promise<void> {
  await db.open();
  const existe = (tabla: string) => db.tables.some((t) => t.name === tabla);
  for (const s of SEMILLAS) {
    if (existe('finca')) await db.finca.add(s.finca);
    if (existe('area')) await db.area.bulkAdd(s.areas);
    if (existe('persona')) await db.persona.bulkAdd(s.personas);
    if (existe('registro')) await db.registro.bulkAdd(s.registros);
    if (existe('outbox')) {
      await db.outbox.bulkAdd(
        s.registros.map((r) => ({
          id: r.id,
          entidad: 'registro' as const,
          op: 'crear' as const,
          creado: r.instante_evento,
        })),
      );
    }
  }
}

async function contenido(db: CuadernoDb): Promise<Map<string, Set<string>>> {
  await db.open();
  const mapa = new Map<string, Set<string>>();
  for (const tabla of db.tables) {
    mapa.set(tabla.name, new Set((await tabla.toCollection().primaryKeys()).map(String)));
  }
  return mapa;
}

/** Siembra cada versión anterior, abre la última y devuelve lo que se perdió. */
async function perdidasAlMigrar(versiones: readonly VersionLocal[]): Promise<string[]> {
  const perdidas: string[] = [];
  const ultima = versiones.at(-1)?.version;
  for (let k = 1; k <= versiones.length; k++) {
    const indexedDB = new IDBFactory();
    const nombre = `migracion-desde-${k}`;
    const antes = abrirCuaderno({
      indexedDB,
      IDBKeyRange,
      nombre,
      versiones: versiones.slice(0, k),
    });
    await sembrar(antes);
    const filasAntes = await contenido(antes);
    antes.close();

    const despues = abrirCuaderno({ indexedDB, IDBKeyRange, nombre, versiones });
    const filasDespues = await contenido(despues);
    despues.close();

    for (const [tabla, ids] of filasAntes) {
      const faltan = [...ids].filter((id) => !filasDespues.get(tabla)?.has(id));
      if (faltan.length > 0) {
        perdidas.push(
          `v${versiones[k - 1]?.version} → v${ultima}: «${tabla}» perdió ${faltan.length} de ${ids.size}`,
        );
      }
    }
  }
  return perdidas;
}

describe('migraciones del almacén local', () => {
  it('ninguna versión anterior pierde datos al abrir la última', async () => {
    expect(await perdidasAlMigrar(VERSIONES_LOCALES)).toEqual([]);
  });

  it('la semilla trae datos de las dos fincas en cada tabla que prueba', () => {
    expect(SEMILLAS.map((s) => s.finca.nombre)).toEqual(['Finca Ensayo Uno', 'Finca Ensayo Dos']);
    for (const s of SEMILLAS) {
      expect(s.areas.length).toBeGreaterThan(0);
      expect(s.personas.length).toBeGreaterThan(0);
      expect(s.registros.length).toBeGreaterThan(0);
    }
  });

  // Control negativo permanente (P5): el arnés tiene que ver una versión que destruye datos.
  it('detecta una versión nueva que borra una tabla', async () => {
    const ultima = VERSIONES_LOCALES.at(-1)?.version ?? 0;
    const conBorrado: VersionLocal[] = [
      ...VERSIONES_LOCALES,
      { version: ultima + 1, tablas: { registro: null } },
    ];
    expect(await perdidasAlMigrar(conBorrado)).toEqual(
      expect.arrayContaining([expect.stringContaining('«registro» perdió')]),
    );
  });

  it('detecta una migración que vacía registros', async () => {
    const ultima = VERSIONES_LOCALES.at(-1)?.version ?? 0;
    const conVaciado: VersionLocal[] = [
      ...VERSIONES_LOCALES,
      { version: ultima + 1, tablas: {}, migrar: async (tx) => tx.table('registro').clear() },
    ];
    expect(await perdidasAlMigrar(conVaciado)).toEqual(
      expect.arrayContaining([expect.stringContaining('«registro» perdió')]),
    );
  });

  it('el historial de versiones solo crece y nunca borra una tabla', () => {
    const numeros = VERSIONES_LOCALES.map((v) => v.version);
    expect(numeros).toEqual([...numeros].sort((a, b) => a - b));
    expect(new Set(numeros).size).toBe(numeros.length);
    const borradas = VERSIONES_LOCALES.flatMap((v) =>
      Object.entries(v.tablas)
        .filter(([, def]) => def === null)
        .map(([tabla]) => `v${v.version}: ${tabla}`),
    );
    expect(borradas).toEqual([]);
  });
});
