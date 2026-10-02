/**
 * CORE v0 contra un D1 local de verdad (HU-E4.1, CA1 a CA4). Qué no imita el D1 local: ver
 * `@gestionagro/d1/local` (P17).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BaseD1 } from '@gestionagro/d1';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cargarCeldas } from '../../../scripts/lib/celdas.ts';
import { PILOTOS_MAXIMOS, SinCeldaDisponible } from './asignacion.ts';
import { baseDelCore, vaciarCore } from './base-de-prueba.ts';
import { sentenciasDeCeldas } from './celdas.ts';
import {
  agregarMembresia,
  crearOrganizacion,
  directorioDeUsuario,
  ErrorDelCore,
  leerCeldas,
  usuarioDeIdentidad,
} from './repositorio.ts';
import app from './worker.ts';

let db: BaseD1;
let cerrar: () => Promise<void>;
beforeAll(async () => {
  ({ db, cerrar } = await baseDelCore());
}, 60_000);
afterAll(async () => cerrar?.());
beforeEach(async () => vaciarCore(db));

const real = cargarCeldas();
const sincronizar = async (celdas = real.celdas, destino: 'staging' | 'produccion' = 'staging') => {
  for (const s of sentenciasDeCeldas(celdas, destino)) await db.prepare(s).run();
};
const contar = async (tabla: string) =>
  (await db.prepare(`SELECT count(*) AS n FROM ${tabla}`).first<{ n: number }>())?.n;

// Reloj fijo (P8): 1 oct 2026, 12:00 UTC.
const reloj = () => Date.UTC(2026, 9, 1, 12);
const persona = (n: number) =>
  usuarioDeIdentidad(
    db,
    { sub: `google-${n}`, nombre: `Persona Ensayo ${n}`, email: `ensayo${n}@example.com` },
    reloj,
  );

describe('CA1 · las tablas son las de ARQUITECTURA §5.4, y ninguna más', () => {
  it('la migración crea exactamente las tablas que lista el documento', async () => {
    const doc = readFileSync(
      join(import.meta.dirname, '..', '..', '..', 'docs', 'ARQUITECTURA.md'),
      'utf8',
    );
    const seccion = doc.slice(doc.indexOf('### 5.4'), doc.indexOf('### 5.5'));
    const delDocumento = [...seccion.matchAll(/^\| `([a-z_]+)` \|/gm)].map((m) => m[1]).sort();
    const { results } = await db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations' ORDER BY name",
      )
      .all<{ name: string }>();
    expect(delDocumento).toHaveLength(7);
    expect(results.map((r) => r.name)).toEqual(delDocumento);
  });
});

describe('CA2 · la tabla celda sale de celdas.json', () => {
  it('después de sincronizar, el directorio es celdas.json', async () => {
    await sincronizar();
    expect(await leerCeldas(db)).toEqual(
      real.celdas.map(({ id, estado, anillo_despliegue, shards }) => ({
        id,
        estado,
        anillo_despliegue,
        shards,
      })),
    );
  });

  it('volver a sincronizar actualiza shards y la URL de la API del destino, y conserva las claves', async () => {
    await sincronizar();
    await db.prepare("UPDATE celda SET clave_publica = 'clave' WHERE id = 'c0'").run();
    const c0 = {
      ...real.celdas[0],
      id: 'c0',
      shards: ['agro_c0_s1', 'agro_c0_s2'],
    } as (typeof real.celdas)[0];
    await sincronizar([c0], 'produccion');
    const fila = await db
      .prepare("SELECT url_api, clave_publica, shards FROM celda WHERE id = 'c0'")
      .first();
    expect(fila).toEqual({
      url_api: c0.api,
      clave_publica: 'clave',
      shards: '["agro_c0_s1","agro_c0_s2"]',
    });
  });

  it('una celda que sale de celdas.json queda «fuera» y no se borra (P21)', async () => {
    const [c0] = real.celdas;
    if (!c0) throw new Error('celdas.json sin celdas');
    await sincronizar([c0, { ...c0, id: 'c1', shards: ['agro_c1_s1'] }]);
    await sincronizar([c0]);
    expect(await leerCeldas(db)).toEqual([
      expect.objectContaining({ id: 'c0', estado: 'activa' }),
      expect.objectContaining({ id: 'c1', estado: 'fuera' }),
    ]);
  });
});

describe('CA3 y CA4 · usuarios, organizaciones, membresías y directorio', () => {
  beforeEach(async () => sincronizar());

  it('la misma identidad de Google es el mismo usuario y no escribe dos veces', async () => {
    const primera = await persona(1);
    const segunda = await persona(1);
    expect(primera.nuevo).toBe(true);
    expect(segunda).toEqual({ id: primera.id, nuevo: false });
    expect(await contar('usuario')).toBe(1);
    expect(await contar('identidad')).toBe(1);
  });

  it('una organización nace en c0 por la regla, con su propietario, y aparece en el directorio', async () => {
    const { id: usuarioId } = await persona(1);
    const org = await crearOrganizacion(
      db,
      { propietarioId: usuarioId, nombre: 'Finca Ensayo Uno', tipo: 'finca' },
      reloj,
    );
    expect(org).toMatchObject({ celda_id: 'c0', shard: 'agro_c0_s1', anillo: 1, plan: 'gratuito' });
    expect(await directorioDeUsuario(db, usuarioId)).toEqual([
      {
        org_id: org.id,
        nombre: 'Finca Ensayo Uno',
        tipo: 'finca',
        plan: 'gratuito',
        rol: 'propietario',
        celda_id: 'c0',
        shard: 'agro_c0_s1',
        anillo: 1,
        url_api: real.celdas[0]?.api_staging,
      },
    ]);
  });

  it(`la organización número ${PILOTOS_MAXIMOS + 1} ya no es piloto (anillo 2)`, async () => {
    const { id } = await persona(1);
    const anillos: number[] = [];
    for (let i = 0; i <= PILOTOS_MAXIMOS; i++) {
      anillos.push(
        (
          await crearOrganizacion(
            db,
            { propietarioId: id, nombre: `Finca ${i}`, tipo: 'finca' },
            reloj,
          )
        ).anillo,
      );
    }
    expect(anillos).toEqual([...Array(PILOTOS_MAXIMOS).fill(1), 2]);
  });

  it('con dos celdas, la nueva va a la menos cargada (Finca Ensayo Dos en c1)', async () => {
    const [c0] = real.celdas;
    if (!c0) throw new Error('celdas.json sin celdas');
    await sincronizar([c0, { ...c0, id: 'c1', anillo_despliegue: 1, shards: ['agro_c1_s1'] }]);
    const { id } = await persona(1);
    const uno = await crearOrganizacion(
      db,
      { propietarioId: id, nombre: 'Finca Ensayo Uno', tipo: 'finca' },
      reloj,
    );
    const dos = await crearOrganizacion(
      db,
      { propietarioId: id, nombre: 'Finca Ensayo Dos', tipo: 'finca' },
      reloj,
    );
    expect([uno.celda_id, dos.celda_id]).toEqual(['c0', 'c1']);
  });

  it('sin celda disponible no escribe nada y dice por qué (P1)', async () => {
    await db.prepare("UPDATE celda SET estado = 'fuera'").run();
    const { id } = await persona(1);
    await expect(
      crearOrganizacion(
        db,
        { propietarioId: id, nombre: 'Finca Ensayo Uno', tipo: 'finca' },
        reloj,
      ),
    ).rejects.toThrow(SinCeldaDisponible);
    expect(await contar('organizacion')).toBe(0);
  });

  it('organización y membresía son una transacción: si falla una, no queda ninguna', async () => {
    await expect(
      crearOrganizacion(
        db,
        { propietarioId: 'usuario-que-no-existe', nombre: 'Finca Ensayo Uno', tipo: 'finca' },
        reloj,
      ),
    ).rejects.toThrow();
    expect(await contar('organizacion')).toBe(0);
    expect(await contar('membresia')).toBe(0);
  });

  it('una membresía nueva entra al directorio; repetirla avisa sin duplicar', async () => {
    const propietario = await persona(1);
    const operario = await persona(2);
    const org = await crearOrganizacion(
      db,
      { propietarioId: propietario.id, nombre: 'Finca Ensayo Dos', tipo: 'finca' },
      reloj,
    );
    await agregarMembresia(db, { usuarioId: operario.id, orgId: org.id, rol: 'operario' }, reloj);
    expect((await directorioDeUsuario(db, operario.id)).map((e) => e.rol)).toEqual(['operario']);
    await expect(
      agregarMembresia(db, { usuarioId: operario.id, orgId: org.id, rol: 'supervisor' }, reloj),
    ).rejects.toThrow(new ErrorDelCore('Esa persona ya es operario de esta organización'));
    expect(await contar('membresia')).toBe(2);
  });

  it('la base rechaza lo que el código no debería mandar: rol inventado, organización inexistente', async () => {
    const { id } = await persona(1);
    await expect(
      db
        .prepare("INSERT INTO membresia VALUES (?, 'org-inexistente', 'operario', '2026-10-01')")
        .bind(id)
        .run(),
    ).rejects.toThrow(/FOREIGN KEY/);
    const org = await crearOrganizacion(
      db,
      { propietarioId: id, nombre: 'Finca Ensayo Uno', tipo: 'finca' },
      reloj,
    );
    await expect(
      db
        .prepare(
          "INSERT INTO invitacion VALUES ('h', ?, 'jefe', '2026-10-08', ?, '2026-10-01', NULL, NULL)",
        )
        .bind(org.id, id)
        .run(),
    ).rejects.toThrow(/CHECK/);
  });

  it('nombres vacíos no se guardan: no hay valores de fábrica (P1)', async () => {
    const { id } = await persona(1);
    await expect(
      crearOrganizacion(db, { propietarioId: id, nombre: '   ', tipo: 'finca' }, reloj),
    ).rejects.toThrow('Falta el nombre de la organización');
    await expect(
      usuarioDeIdentidad(db, { sub: 'google-9', nombre: 'Persona', email: ' ' }, reloj),
    ).rejects.toThrow('Falta el email');
  });
});

describe('GET /api/core/salud (prueba de humo del despliegue)', () => {
  const salud = () => app.fetch(new Request('https://core.test/api/core/salud'), { DB: db });

  it('sin celdas activas responde 503: un CORE que no puede crear organizaciones no está sano (P1)', async () => {
    expect((await salud()).status).toBe(503);
    await sincronizar();
    await db.prepare("UPDATE celda SET estado = 'fuera'").run();
    const r = await salud();
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({ estado: 'sin-celdas' });
  });

  it('con el directorio sincronizado responde 200 con el número de celdas activas', async () => {
    await sincronizar();
    const r = await salud();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      estado: 'ok',
      celdas: real.celdas.filter((c) => c.estado === 'activa').length,
    });
  });

  it('una ruta desconocida responde 404 en español', async () => {
    const r = await app.fetch(new Request('https://core.test/api/core/ruta-inventada'), { DB: db });
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({
      estado: 'no-encontrado',
      motivo: 'Ruta del CORE desconocida',
    });
  });
});
