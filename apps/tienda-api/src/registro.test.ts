/**
 * HU-T10.6: el registro, quién hizo qué. Contra el shard local: cada fila se cuenta en una frase,
 * se lee de la más nueva a la más vieja, y los datos personales y las llaves nunca quedan en claro.
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import { ENSAYO_DOS, ENSAYO_UNO, siembraDelShard } from '@ed1/tienda-schema/ensayos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  anotar,
  enFrase,
  type FilaDelRegistro,
  leerRegistro,
  sinDatosSensibles,
} from './registro.ts';

const AHORA = '2026-10-15T15:00:00.000Z';
let db: BaseD1;
let cerrar: () => Promise<void>;

beforeAll(async () => {
  ({ db, cerrar } = await baseLocal({
    configuracion: 'apps/tienda-api/wrangler.c1.jsonc',
    binding: 'tienda_c1_s1',
    base: 'tienda',
  }));
  for (const sql of siembraDelShard([ENSAYO_UNO, ENSAYO_DOS], AHORA))
    await db.prepare(sql.replace(/;$/, '')).run();
});
afterAll(async () => cerrar());

const fila = (f: Partial<FilaDelRegistro>): FilaDelRegistro => ({
  id: 1,
  instante: AHORA,
  actor: 'usuario:ensayo-uno',
  accion: 'producto.editar',
  entidad: 'producto',
  entidad_id: 'p-camisa',
  antes: null,
  despues: null,
  ...f,
});

describe('HU-T10.6 · el registro', () => {
  it('CA2: los datos personales y las llaves quedan como huella, a cualquier profundidad', async () => {
    const limpio = (await sinDatosSensibles({
      nombre: 'Camisa de lino',
      contacto: { whatsapp: '+573000000001' },
      pago: { llaveWompi: 'pub_test_ensayo', cuenta: { titular: 'Ensayo Uno' } },
      lista: [{ correo: 'ensayo-uno@ejemplo.test', precioCop: 129000 }],
      telefono: null,
    })) as Record<string, unknown>;
    const texto = JSON.stringify(limpio);
    expect(texto).not.toContain('+573000000001');
    expect(texto).not.toContain('pub_test_ensayo');
    expect(texto).not.toContain('ensayo-uno@ejemplo.test');
    expect(limpio['contacto']).toEqual({ huella: expect.stringMatching(/^[0-9a-f]{16}$/) });
    // Lo que no es sensible sigue en claro (si no, el registro no diría nada).
    expect(limpio).toMatchObject({
      nombre: 'Camisa de lino',
      pago: { cuenta: { titular: 'Ensayo Uno' } },
      lista: [{ precioCop: 129000 }],
      telefono: null,
    });
  });

  it('CA2: la fila guardada en la base tampoco los tiene', async () => {
    await db.batch([
      await anotar(db, {
        org: ENSAYO_DOS.org,
        actor: 'usuario:ensayo-dos',
        accion: 'ajustes.contacto',
        entidad: 'ajuste',
        entidadId: 'contacto',
        antes: { whatsapp: '+573000000002' },
        despues: { whatsapp: '+573000000009', secretoDeEventos: 'test_events_ensayo' },
        instante: AHORA,
      }),
    ]);
    const f = await db
      .prepare('SELECT antes, despues FROM registro WHERE org_id = ? ORDER BY id DESC')
      .bind(ENSAYO_DOS.org)
      .first<{ antes: string; despues: string }>();
    expect(`${f?.antes}${f?.despues}`).not.toMatch(/\+57300000000|test_events_ensayo/);
    // Cambió, y se nota: las dos huellas son distintas.
    expect(JSON.parse(f?.antes ?? '{}').whatsapp).not.toEqual(
      JSON.parse(f?.despues ?? '{}').whatsapp,
    );
  });

  it('CA1: cada acción se cuenta en una frase, con «Tú» para quien pregunta', () => {
    const yo = 'usuario:ensayo-uno';
    expect(
      enFrase(
        fila({
          accion: 'variante.editar',
          antes: JSON.stringify({
            nombre: 'Camisa de lino',
            clave: 'M|Arena',
            precioCop: 129000,
            stock: 4,
          }),
          despues: JSON.stringify({
            nombre: 'Camisa de lino',
            clave: 'M|Arena',
            precioCop: 119000,
            stock: 4,
          }),
        }),
        yo,
      ),
    ).toBe('Tú cambiaste el precio de $129.000 a $119.000 de M / Arena en «Camisa de lino»');
    expect(
      enFrase(
        fila({
          actor: 'usuario:otra',
          accion: 'producto.estado',
          antes: JSON.stringify({ nombre: 'Camisa de lino', estado: 'activo' }),
          despues: JSON.stringify({ nombre: 'Camisa de lino', estado: 'archivado' }),
        }),
        yo,
      ),
    ).toBe('Otra persona del equipo pasó «Camisa de lino» de activo a archivado');
    expect(
      enFrase(
        fila({
          actor: 'sistema',
          accion: 'coleccion.borrar',
          antes: JSON.stringify({ nombre: 'Lino' }),
        }),
        yo,
      ),
    ).toBe('La tienda borró la colección «Lino»; sus productos siguen en la tienda');
    // Una acción que no conoce no se esconde.
    expect(enFrase(fila({ accion: 'algo.nuevo', entidad: 'cosa' }), yo)).toBe(
      'Tú: algo.nuevo (cosa)',
    );
  });

  it('se lee de la más nueva a la más vieja, de a páginas, y solo la de su tienda', async () => {
    for (let i = 1; i <= 5; i++) {
      await db.batch([
        await anotar(db, {
          org: ENSAYO_UNO.org,
          actor: 'usuario:ensayo-uno',
          accion: 'producto.crear',
          entidad: 'producto',
          entidadId: `p-${i}`,
          antes: null,
          despues: { nombre: `Producto ${i}` },
          instante: AHORA,
        }),
      ]);
    }
    const uno = await leerRegistro(db, ENSAYO_UNO.org, null, 2);
    expect(uno.filas.map((f) => f.entidad_id)).toEqual(['p-5', 'p-4']);
    const dos = await leerRegistro(db, ENSAYO_UNO.org, uno.siguiente, 2);
    expect(dos.filas.map((f) => f.entidad_id)).toEqual(['p-3', 'p-2']);
    const tres = await leerRegistro(db, ENSAYO_UNO.org, dos.siguiente, 2);
    expect(tres).toMatchObject({ filas: [{ entidad_id: 'p-1' }], siguiente: null });
    const otra = await leerRegistro(db, ENSAYO_DOS.org, null);
    expect(otra.filas.every((f) => f.actor === 'usuario:ensayo-dos')).toBe(true);
  });
});
