/**
 * Invitaciones en el teléfono (HU-E4.4) sobre fake-indexeddb, con un CORE falso.
 */
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { FINCA_ENSAYO_DOS } from '../../../../tests/fixtures/fincas.ts';
import { abrirCuaderno } from './db.ts';
import { crearFincaConAreas } from './finca.ts';
import {
  aceptarInvitacion,
  CLAVE_INVITACION,
  codigoDelFragmento,
  crearInvitacion,
  enlaceDeWhatsApp,
  guardarCodigo,
} from './invitacion.ts';
import { CLAVE_SESION, type Sesion } from './sesion.ts';
import { leerVinculo } from './vinculo.ts';

const CORE = 'https://core.ejemplo.test';
const ORG = '0199a1b2-0000-7000-8000-0000000000c1';
const sesion: Sesion = {
  acceso: 'acceso',
  acceso_vence: Date.now() + 3_600_000,
  refresh: 'refresh',
  refresh_vence: Date.now() + 86_400_000,
  usuario: { nombre: 'Persona Ensayo', email: 'ensayo@example.com' },
  organizaciones: [],
  org_id: null,
};

async function telefono(conSesion = true) {
  const db = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
  if (conSesion) await db.meta.put({ clave: CLAVE_SESION, valor: sesion, actualizado: '' });
  return db;
}

/** CORE falso que registra lo que se le pide y responde por ruta. */
function coreFalso(respuestas: Record<string, { estado: number; cuerpo: unknown }>) {
  const pedidos: { url: string; cuerpo: unknown; autorizacion: string | null }[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    pedidos.push({
      url,
      cuerpo: JSON.parse(String(init?.body ?? '{}')),
      autorizacion: new Headers(init?.headers).get('authorization'),
    });
    const ruta = Object.keys(respuestas).find((clave) => url.endsWith(clave)) ?? '';
    const r = respuestas[ruta] ?? { estado: 404, cuerpo: {} };
    return Response.json(r.cuerpo, { status: r.estado });
  }) as unknown as typeof fetch;
  return { fn, pedidos };
}

describe('HU-E4.4 · invitar desde el teléfono', () => {
  it('CA1 y CA2: el enlace lleva el código en el fragmento y el mensaje sale listo para WhatsApp', async () => {
    const db = await telefono();
    const { fn, pedidos } = coreFalso({
      '/api/core/invitaciones': {
        estado: 201,
        cuerpo: { codigo: 'codigo-1', rol: 'operario', expira: '2026-10-08T12:00:00.000Z' },
      },
    });
    const r = await crearInvitacion(db, CORE, 'operario', {
      origen: 'https://agro.ejemplo.test',
      finca: 'Finca Ensayo Uno',
      fetchFn: fn,
    });
    expect(r.enlace).toBe('https://agro.ejemplo.test/agro/app/unirme/#invitacion=codigo-1');
    expect(r.mensaje).toContain('Finca Ensayo Uno como operario');
    expect(r.mensaje).toContain('hasta el 8 de octubre');
    expect(pedidos[0]).toMatchObject({
      cuerpo: { rol: 'operario' },
      autorizacion: 'Bearer acceso',
    });
    expect(pedidos[0]?.url).not.toContain('codigo');
    expect(enlaceDeWhatsApp(r.mensaje)).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(codigoDelFragmento('#invitacion=codigo-1')).toBe('codigo-1');
  });

  it('si la nube no deja invitar, dice por qué', async () => {
    const db = await telefono();
    const { fn } = coreFalso({
      '/api/core/invitaciones': {
        estado: 403,
        cuerpo: { motivo: 'Solo quien administra la finca puede invitar.' },
      },
    });
    await expect(
      crearInvitacion(db, CORE, 'operario', { origen: 'x', finca: 'y', fetchFn: fn }),
    ).rejects.toThrow('Solo quien administra la finca puede invitar.');
  });
});

describe('HU-E4.4 · aceptar en el teléfono de quien recibe', () => {
  it('CA4: acepta con el código en el cuerpo, baja la finca y deja el teléfono vinculado', async () => {
    const db = await telefono();
    await guardarCodigo(db, 'codigo-1');
    const { fn, pedidos } = coreFalso({
      '/api/core/invitaciones/aceptar': {
        estado: 200,
        cuerpo: { org_id: ORG, finca: 'Finca Ensayo Dos', rol: 'operario' },
      },
      '/api/core/auth/refrescar': {
        estado: 200,
        cuerpo: {
          ...sesion,
          refresh: null,
          org_id: ORG,
          url_api: 'https://api',
          organizaciones: [{ org_id: ORG, nombre: 'Finca Ensayo Dos', rol: 'operario' }],
        },
      },
    });
    const r = await aceptarInvitacion(db, CORE, { fetchFn: fn });
    expect(r).toMatchObject({ finca: 'Finca Ensayo Dos', rol: 'operario' });
    expect(pedidos[0]).toMatchObject({
      cuerpo: { codigo: 'codigo-1' },
      autorizacion: 'Bearer acceso',
    });
    expect(pedidos.every((p) => !p.url.includes('codigo-1'))).toBe(true);
    expect((await leerVinculo(db))?.org_id).toBe(ORG);
    expect(await db.meta.get(CLAVE_INVITACION)).toBeUndefined();
  });

  it('un teléfono con su propia finca no se mezcla: no acepta y no gasta la invitación', async () => {
    const db = await telefono();
    await crearFincaConAreas(
      db,
      {
        nombre: FINCA_ENSAYO_DOS.finca.nombre,
        municipio: FINCA_ENSAYO_DOS.finca.municipio,
        regimen: 'convencional',
      },
      [{ tipo: 'bloque', nombre: 'Bloque 1', area_m2: 800, capacidad_plantas: null }],
    );
    await guardarCodigo(db, 'codigo-1');
    const { fn, pedidos } = coreFalso({});
    await expect(aceptarInvitacion(db, CORE, { fetchFn: fn })).rejects.toThrow(
      'Este teléfono ya tiene una finca.',
    );
    expect(pedidos).toEqual([]);
  });

  it('CA3: un enlace usado dice por qué, y el teléfono queda como estaba', async () => {
    const db = await telefono();
    await guardarCodigo(db, 'codigo-1');
    const { fn } = coreFalso({
      '/api/core/invitaciones/aceptar': {
        estado: 410,
        cuerpo: {
          motivo: 'Este enlace ya se usó. Pídele a Persona Ensayo que te mande uno nuevo.',
        },
      },
    });
    await expect(aceptarInvitacion(db, CORE, { fetchFn: fn })).rejects.toThrow(
      'Este enlace ya se usó.',
    );
    expect(await leerVinculo(db)).toBeNull();
  });
});
