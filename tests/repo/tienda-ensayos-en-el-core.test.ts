/**
 * HU-T2.10 CA2: las organizaciones de Ensayo Uno y Ensayo Dos en el CORE de staging, con el dueño
 * de propietario. Contra la base del CORE de verdad (sus migraciones y sus claves foráneas), con el
 * catálogo y el directorio que escribe el mismo despliegue. Cada caso malo es su control negativo.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sentenciasDelCatalogo } from '../../apps/core/src/catalogo.ts';
import { sentenciasDeCeldas } from '../../apps/core/src/celdas.ts';
import type { BaseD1 } from '../../packages/d1/src/index.ts';
import { baseLocal } from '../../packages/d1/src/local.ts';
import { ENSAYO_DOS, ENSAYO_UNO, ENSAYOS } from '../../packages/tienda-schema/src/ensayos.ts';
import {
  consultaDeEnsayosEnElCore,
  correoDelDueno,
  ensayosDelDestino,
  ensayosEnElCore,
  notaDeEnsayosEnElCore,
  SECRETO_CORREO_DUENO,
} from '../../scripts/lib/celda-tienda.ts';
import { cargarCeldas } from '../../scripts/lib/celdas.ts';
import { registroDelDestino } from '../../scripts/lib/productos-de-prueba.ts';
import { cargarProductos, catalogoDelRepositorio } from '../../scripts/lib/registro-productos.ts';

const CORREO = 'dueno@ejemplo.test';
const AHORA = '2026-10-15T00:00:00.000Z';
const config = cargarCeldas();
const c1 = config.celdas.find((c) => c.producto === 'tienda');
if (!c1) throw new Error('sin la celda de la Tienda');

let db: BaseD1;
let cerrar: () => Promise<void>;
const correr = async (sentencias: readonly string[]) => {
  for (const s of sentencias) await db.prepare(s.replace(/;$/, '')).run();
};
const leer = async (correo: string | null) =>
  (await db.prepare(consultaDeEnsayosEnElCore(ENSAYOS, correo)).first()) ?? undefined;

beforeAll(async () => {
  ({ db, cerrar } = await baseLocal({
    configuracion: 'apps/core/wrangler.jsonc',
    binding: 'DB',
    base: 'core',
  }));
  // Lo mismo que el despliegue de staging escribe antes: el catálogo y el directorio de celdas.
  await correr([
    ...sentenciasDelCatalogo(
      catalogoDelRepositorio(registroDelDestino('staging', cargarProductos())),
      AHORA,
    ),
    ...sentenciasDeCeldas(config.celdas, 'staging'),
  ]);
}, 60_000);
afterAll(async () => cerrar?.());

describe('los comercios de prueba en el CORE de staging (HU-T2.10 CA2)', () => {
  it('en producción no hay nada que sembrar', () => {
    expect(ensayosEnElCore(ensayosDelDestino('produccion'), c1, CORREO, AHORA)).toEqual([]);
  });

  it('sin el correo, las dos organizaciones entran sin propietario, con los ids del fixture', async () => {
    await correr(ensayosEnElCore(ENSAYOS, c1, null, AHORA));
    const { results } = await db
      .prepare(
        "SELECT id, producto, tipo, plan, celda_id, shard FROM organizacion WHERE producto = 'tienda' ORDER BY nombre DESC",
      )
      .all();
    expect(results).toEqual([
      {
        id: ENSAYO_UNO.org,
        producto: 'tienda',
        tipo: 'tienda',
        plan: 'entrada',
        celda_id: 'c1',
        shard: 'tienda_c1_s1',
      },
      {
        id: ENSAYO_DOS.org,
        producto: 'tienda',
        tipo: 'tienda',
        plan: 'gratis',
        celda_id: 'c1',
        shard: 'tienda_c1_s1',
      },
    ]);
    expect(notaDeEnsayosEnElCore(2, await leer(null), null)).toEqual({
      ok: true,
      nota: `comercios de prueba en el CORE: 2 organizaciones, sin propietario (falta ${SECRETO_CORREO_DUENO})`,
    });
  });

  it('con el correo de alguien que todavía no entró, no se crea nada a su nombre', async () => {
    await correr(ensayosEnElCore(ENSAYOS, c1, CORREO, AHORA));
    const n = await db.prepare('SELECT count(*) AS n FROM membresia').first<{ n: number }>();
    expect(n?.n).toBe(0);
    expect(notaDeEnsayosEnElCore(2, await leer(CORREO), CORREO).nota).toMatch(
      /todavía no tiene cuenta en staging/,
    );
  });

  it('cuando ya entró, queda de propietario de las dos; correrlo otra vez no cambia nada', async () => {
    await db
      .prepare('INSERT INTO usuario (id, nombre, email, creado) VALUES (?, ?, ?, ?)')
      .bind('u-dueno', 'Persona Ensayo', 'Dueno@Ejemplo.test', AHORA)
      .run();
    // Un plan cambiado por una prueba de pagos no se pisa.
    await db
      .prepare("UPDATE organizacion SET plan = 'intermedio' WHERE id = ?")
      .bind(ENSAYO_DOS.org)
      .run();
    await correr(ensayosEnElCore(ENSAYOS, c1, CORREO, AHORA));
    await correr(ensayosEnElCore(ENSAYOS, c1, CORREO, AHORA));
    const { results } = await db
      .prepare('SELECT usuario_id, org_id, producto, rol FROM membresia ORDER BY org_id')
      .all();
    expect(results).toEqual(
      [ENSAYO_UNO.org, ENSAYO_DOS.org].sort().map((org_id) => ({
        usuario_id: 'u-dueno',
        org_id,
        producto: 'tienda',
        rol: 'propietario',
      })),
    );
    const plan = await db
      .prepare('SELECT plan FROM organizacion WHERE id = ?')
      .bind(ENSAYO_DOS.org)
      .first<{ plan: string }>();
    expect(plan?.plan).toBe('intermedio');
    expect(notaDeEnsayosEnElCore(2, await leer(CORREO), CORREO)).toEqual({
      ok: true,
      nota: 'comercios de prueba en el CORE: 2 organizaciones, el dueño es propietario',
    });
  });

  it('❌ si falta una organización, el despliegue falla', () => {
    expect(notaDeEnsayosEnElCore(2, { orgs: 1, propias: 0 }, CORREO).ok).toBe(false);
    expect(notaDeEnsayosEnElCore(2, undefined, null).ok).toBe(false);
  });
});

describe('el correo del dueño viene del ambiente', () => {
  it('sin el secreto, no hay correo y no es un error', () => {
    expect(correoDelDueno({})).toEqual({ ok: true, correo: null });
    expect(correoDelDueno({ [SECRETO_CORREO_DUENO]: '  ' })).toEqual({ ok: true, correo: null });
  });

  it('con el secreto, el correo sin espacios', () => {
    expect(correoDelDueno({ [SECRETO_CORREO_DUENO]: ` ${CORREO}\n` })).toEqual({
      ok: true,
      correo: CORREO,
    });
  });

  it.each(['sin-arroba', "o'a@ejemplo.test", 'a@ejemplo.test" ; rm -rf', 'a@ejemplo.test$(id)'])(
    '❌ «%s» no es un correo: no llega al SQL ni a la línea de comandos',
    (valor) => {
      expect(correoDelDueno({ [SECRETO_CORREO_DUENO]: valor }).ok).toBe(false);
      expect(() => ensayosEnElCore(ENSAYOS, c1, valor, AHORA)).toThrow(/no es válido/);
    },
  );
});
