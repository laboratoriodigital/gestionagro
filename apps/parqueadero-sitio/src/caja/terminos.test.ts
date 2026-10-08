/**
 * Los términos de la nube en la caja (HU-Q7.11): se arman sin marcadores sueltos, la aceptación
 * queda con su versión y su hora, y solo los pedidos a la celda llevan la versión.
 */
import 'fake-indexeddb/auto';
import { uuidv7 } from '@ed1/ids';
import { describe, expect, it } from 'vitest';
import politica from '../../../../content/parqueadero/privacidad/politica.json' with {
  type: 'json',
};
import { abrirBase } from './datos.ts';
import {
  aceptarTerminos,
  conTerminos,
  estadoDeLosTerminos,
  registrarTerminos,
  terminos,
  VERSION_DE_LOS_TERMINOS,
} from './terminos.ts';

describe('los términos de la nube (HU-Q7.11)', () => {
  it('dicen qué sube y qué no, con el número del conductor entre lo que no sale (CA1)', () => {
    const t = terminos();
    expect(t.sube.join(' ')).toContain('placas');
    expect(t.noSale.join(' ')).toContain('número de celular del conductor');
    const todo = t.secciones.flat().join('\n');
    expect(todo).toContain('Encargado');
    expect(todo).not.toMatch(/[{}]/);
    // Lo que falta del encargado se ve como falta, no como un hueco.
    if (politica.responsable.identificacion === null) expect(todo).toContain('por completar');
  });

  it('la aceptación queda con su versión y su hora; sin ella, la caja no sincroniza (CA1, CA3)', async () => {
    const db = abrirBase(`terminos-${uuidv7()}`);
    expect(await estadoDeLosTerminos(db)).toBe('sin-aceptar');
    await aceptarTerminos(db, () => 1_760_000_000_000);
    expect(await db.meta.get('terminos')).toEqual({
      clave: 'terminos',
      version: VERSION_DE_LOS_TERMINOS,
      aceptados: 1_760_000_000_000,
      registrados: null,
    });
    expect(await estadoDeLosTerminos(db)).toBe('por-registrar');
    await db.meta.put({ clave: 'terminos', version: '0', aceptados: 1, registrados: '0' });
    expect(await estadoDeLosTerminos(db)).toBe('sin-aceptar');
  });

  it('registrar manda la hora en UTC y solo marca registrados si la celda dijo que sí', async () => {
    const db = abrirBase(`terminos-${uuidv7()}`);
    await aceptarTerminos(db, () => Date.UTC(2026, 9, 8, 18));
    const pedidos: { url: string; cuerpo: unknown }[] = [];
    const responder = (status: number) =>
      (async (url: string, init?: RequestInit) => {
        pedidos.push({ url, cuerpo: JSON.parse(String(init?.body)) });
        return new Response('{}', { status });
      }) as unknown as typeof fetch;
    const destino = { api: 'https://api.ejemplo.test', acceso: 't', dispositivo: 'caja-1' };
    expect(await registrarTerminos(db, destino, responder(404))).toBe(false);
    expect(await estadoDeLosTerminos(db)).toBe('por-registrar');
    expect(await registrarTerminos(db, destino, responder(200))).toBe(true);
    expect(await estadoDeLosTerminos(db)).toBe('al-dia');
    expect(pedidos[1]).toEqual({
      url: `https://api.ejemplo.test/api/v1/terminos?terminos=${VERSION_DE_LOS_TERMINOS}`,
      cuerpo: {
        dispositivo: 'caja-1',
        version: VERSION_DE_LOS_TERMINOS,
        aceptados: '2026-10-08T18:00:00.000Z',
      },
    });
  });

  it('solo los pedidos a la celda llevan la versión; los del CORE no', () => {
    expect(conTerminos('https://c.test/api/v1/resumen?dispositivo=x')).toBe(
      `https://c.test/api/v1/resumen?dispositivo=x&terminos=${VERSION_DE_LOS_TERMINOS}`,
    );
    expect(conTerminos('https://core.test/api/core/auth/refrescar')).toBe(
      'https://core.test/api/core/auth/refrescar',
    );
  });
});
