/**
 * Sesión de la cuenta en el teléfono (HU-E4.2, CA2 y CA4 del lado de la app) sobre
 * fake-indexeddb, con un CORE falso.
 */
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { abrirCuaderno } from './db.ts';
import { crearFincaConAreas } from './finca.ts';
import { exportarTodo } from './respaldo.ts';
import {
  CLAVE_SESION,
  canjear,
  estadoDeSesion,
  leerRegreso,
  leerSesion,
  renovarSiHaceFalta,
  type Sesion,
  urlDeLaCuenta,
  urlDelCore,
} from './sesion.ts';
import { CLAVE_VINCULO, sesionDeLaFinca } from './vinculo.ts';

const CORE = 'https://core.ejemplo.test';
const T0 = Date.UTC(2026, 9, 1, 12);
const HORA = 60 * 60 * 1000;
const nueva = () => abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });

const respuesta = (extra: Partial<Omit<Sesion, 'refresh'>> & { refresh?: string | null } = {}) => ({
  acceso: 'acceso-1',
  acceso_vence: T0 + 12 * HORA,
  refresh: 'refresh-1',
  refresh_vence: T0 + 60 * 24 * HORA,
  usuario: { nombre: 'Persona Ensayo', email: 'ensayo@example.com' },
  organizaciones: [],
  org_id: null,
  ...extra,
});

/** CORE falso: guarda lo que se le pidió y responde lo indicado por ruta. */
function coreFalso(respuestas: Record<string, { estado: number; cuerpo: unknown } | 'sin-red'>) {
  const pedidos: { url: string; cuerpo: Record<string, unknown> }[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    pedidos.push({ url, cuerpo: JSON.parse(String(init?.body ?? '{}')) });
    const ruta = Object.keys(respuestas).find((clave) => url.endsWith(clave)) ?? '';
    const r = respuestas[ruta];
    if (!r || r === 'sin-red') throw new TypeError('Failed to fetch');
    return Response.json(r.cuerpo, { status: r.estado });
  }) as unknown as typeof fetch;
  return { fn, pedidos };
}

describe('volver de Google', () => {
  it('lee el código o el motivo del fragmento', () => {
    expect(leerRegreso('#entrar=abc')).toEqual({ codigo: 'abc' });
    expect(leerRegreso('#entrar-error=cancelada')).toEqual({ error: 'cancelada' });
    expect(leerRegreso('#t=24&hr=70')).toBeNull();
  });

  it('el canje manda el código y el id del teléfono por POST y guarda la sesión en la base local', async () => {
    const db = nueva();
    const { fn, pedidos } = coreFalso({
      '/api/core/auth/canje': { estado: 200, cuerpo: respuesta() },
    });
    await canjear(db, 'codigo-1', CORE, fn, () => T0);
    expect(pedidos).toEqual([
      {
        url: `${CORE}/api/core/auth/canje`,
        cuerpo: { codigo: 'codigo-1', dispositivo: expect.any(String) },
      },
    ]);
    expect((await leerSesion(db))?.refresh).toBe('refresh-1');
  });

  it('un código vencido dice por qué, y no guarda nada', async () => {
    const db = nueva();
    const { fn } = coreFalso({
      '/api/core/auth/canje': {
        estado: 401,
        cuerpo: { motivo: 'Este enlace de entrada ya se usó o venció.' },
      },
    });
    await expect(canjear(db, 'viejo', CORE, fn)).rejects.toThrow('ya se usó o venció');
    expect(await leerSesion(db)).toBeNull();
  });
});

describe('CA2 · sin señal y con el access vencido, no hay error', () => {
  const conSesion = async () => {
    const db = nueva();
    await canjear(
      db,
      'c',
      CORE,
      coreFalso({ '/api/core/auth/canje': { estado: 200, cuerpo: respuesta() } }).fn,
      () => T0,
    );
    return db;
  };

  it('sin señal no pide nada y el estado es «por renovar»', async () => {
    const db = await conSesion();
    const { fn, pedidos } = coreFalso({});
    const r = await renovarSiHaceFalta(db, CORE, {
      fetchFn: fn,
      ahora: () => T0 + 13 * HORA,
      enLinea: () => false,
    });
    expect(pedidos).toEqual([]);
    expect(r.aviso).toBeNull();
    expect(estadoDeSesion(r.sesion, T0 + 13 * HORA)).toBe('por-renovar');
  });

  it('si la señal se cae a mitad, conserva la sesión para el próximo intento', async () => {
    const db = await conSesion();
    const { fn } = coreFalso({ '/api/core/auth/refrescar': 'sin-red' });
    const r = await renovarSiHaceFalta(db, CORE, {
      fetchFn: fn,
      ahora: () => T0 + 13 * HORA,
      enLinea: () => true,
    });
    expect(r.sesion?.refresh).toBe('refresh-1');
  });

  it('con señal renueva, y conserva el refresh si el CORE no lo rotó', async () => {
    const db = await conSesion();
    const { fn } = coreFalso({
      '/api/core/auth/refrescar': {
        estado: 200,
        cuerpo: respuesta({ acceso: 'acceso-2', acceso_vence: T0 + 25 * HORA, refresh: null }),
      },
    });
    const r = await renovarSiHaceFalta(db, CORE, {
      fetchFn: fn,
      ahora: () => T0 + 13 * HORA,
      enLinea: () => true,
    });
    expect(r.sesion).toMatchObject({ acceso: 'acceso-2', refresh: 'refresh-1' });
    expect(estadoDeSesion(r.sesion, T0 + 13 * HORA)).toBe('activa');
  });

  it('si el CORE dice que la sesión ya no sirve, la borra y lo dice; los registros no se tocan', async () => {
    const db = await conSesion();
    const { fn } = coreFalso({
      '/api/core/auth/refrescar': {
        estado: 401,
        cuerpo: { motivo: 'El acceso de este teléfono fue retirado.' },
      },
    });
    const r = await renovarSiHaceFalta(db, CORE, {
      fetchFn: fn,
      ahora: () => T0 + 13 * HORA,
      enLinea: () => true,
    });
    expect(r).toEqual({ sesion: null, aviso: 'El acceso de este teléfono fue retirado.' });
    expect(await leerSesion(db)).toBeNull();
  });
});

describe('CA4 · los tokens no salen del almacén local', () => {
  it('no van a localStorage ni al respaldo', async () => {
    const db = nueva();
    await crearFincaConAreas(
      db,
      { nombre: 'Finca Ensayo Uno', municipio: 'Municipio Ensayo', regimen: 'ecologico' },
      [{ tipo: 'nave', nombre: 'Nave 1', area_m2: 500, capacidad_plantas: null }],
    );
    await canjear(
      db,
      'c',
      CORE,
      coreFalso({ '/api/core/auth/canje': { estado: 200, cuerpo: respuesta() } }).fn,
      () => T0,
    );
    expect((await db.meta.get(CLAVE_SESION))?.valor).toBeTruthy();
    expect(JSON.stringify(await exportarTodo(db, { app: '0.1.0' }))).not.toContain('refresh-1');
    expect(globalThis.localStorage?.length ?? 0).toBe(0);
  });
});

describe('URL del CORE por host (celdas.json)', () => {
  const config = {
    dominio: 'agro.ejemplo.test',
    url: 'https://core',
    url_staging: 'https://core-stg',
  };
  it('producción en el dominio; staging y local, en el CORE de staging', () => {
    expect(urlDelCore('agro.ejemplo.test', config)).toBe('https://core');
    expect(urlDelCore('agro-sitio-staging.x.workers.dev', config)).toBe('https://core-stg');
    expect(urlDelCore('localhost', config)).toBe('https://core-stg');
  });

  it('la cuenta de Laboratorio Digital: la de producción en el dominio; si no, la del CORE de staging', () => {
    const conCuenta = { ...config, cuenta: 'https://cuenta.ejemplo.test/' };
    expect(urlDeLaCuenta('agro.ejemplo.test', conCuenta)).toBe('https://cuenta.ejemplo.test/');
    expect(urlDeLaCuenta('localhost', conCuenta)).toBe('https://core-stg/');
  });
});

describe('bitácora agro 25 · una cuenta en dos fincas sincroniza la de este teléfono', () => {
  const FINCA = '0199a1b2-0000-7000-8000-0000000000a1';
  const OTRA = '0199a1b2-0000-7000-8000-0000000000a2';
  const dos = [
    { org_id: OTRA, nombre: 'Finca Ensayo Uno', rol: 'propietario' },
    { org_id: FINCA, nombre: 'Finca Ensayo Dos', rol: 'operario' },
  ];
  /** Volvió a entrar con Google: con dos fincas, el CORE da una sesión sin finca. */
  const sinFinca = async () => {
    const db = nueva();
    await canjear(
      db,
      'c',
      CORE,
      coreFalso({
        '/api/core/auth/canje': { estado: 200, cuerpo: respuesta({ organizaciones: dos }) },
      }).fn,
      () => T0,
    );
    await db.meta.put({
      clave: CLAVE_VINCULO,
      valor: { org_id: FINCA, finca_id: null, vinculado: '' },
      actualizado: '',
    });
    return db;
  };
  const conFinca = respuesta({ acceso: 'acceso-2', organizaciones: dos, org_id: FINCA });

  it('con el access vigente pero sin finca, renueva enseguida pidiendo la de este teléfono', async () => {
    const db = await sinFinca();
    const { fn, pedidos } = coreFalso({
      '/api/core/auth/refrescar': { estado: 200, cuerpo: conFinca },
    });
    const r = await sesionDeLaFinca(db, CORE, {
      fetchFn: fn,
      ahora: () => T0,
      enLinea: () => true,
    });
    expect(pedidos.map((p) => p.cuerpo['org_id'])).toEqual([FINCA]);
    expect(r.sesion).toMatchObject({ acceso: 'acceso-2', org_id: FINCA });
  });

  it('al renovar un access vencido, pide la finca de este teléfono aunque la sesión no la tenga', async () => {
    const db = await sinFinca();
    const { fn, pedidos } = coreFalso({
      '/api/core/auth/refrescar': { estado: 200, cuerpo: conFinca },
    });
    await sesionDeLaFinca(db, CORE, {
      fetchFn: fn,
      ahora: () => T0 + 13 * HORA,
      enLinea: () => true,
    });
    expect(pedidos.map((p) => p.cuerpo['org_id'])).toEqual([FINCA]);
  });

  it('con la sesión ya en su finca y vigente, no pide nada', async () => {
    const db = await sinFinca();
    await db.meta.put({
      clave: CLAVE_SESION,
      valor: { ...(await leerSesion(db)), org_id: FINCA },
      actualizado: '',
    });
    const { fn, pedidos } = coreFalso({});
    await sesionDeLaFinca(db, CORE, { fetchFn: fn, ahora: () => T0, enLinea: () => true });
    expect(pedidos).toEqual([]);
  });
});
