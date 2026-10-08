/**
 * Copia en el Drive del productor (HU-E8.4, etapa 1) con un Google Drive falso en memoria y el
 * permiso canjeado con un CORE falso. Que Google acepte las solicitudes se comprueba en staging.
 */
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { driveFalso, TOKEN } from '../../../../tests/fixtures/drive-falso.ts';
import { FINCAS_DE_PRUEBA } from '../../../../tests/fixtures/fincas.ts';
import { guardarClima } from './clima.ts';
import { abrirCuaderno } from './db.ts';
import {
  CARPETA,
  CLAVE_ULTIMO_DRIVE,
  CONSERVAR,
  carpetaDeRespaldos,
  descargarCopia,
  ErrorDeDrive,
  guardarCopiaEnDrive,
  listarCopias,
} from './drive.ts';
import { crearFincaConAreas } from './finca.ts';
import {
  canjearPermiso,
  leerVuelta,
  PermisoInvalido,
  textoDelError,
  urlParaPedirPermiso,
} from './permiso-drive.ts';
import { analizarArchivo } from './respaldo.ts';

const T0 = new Date('2026-10-05T15:30:00Z');

describe.each(FINCAS_DE_PRUEBA.map((f) => [f.finca.nombre, f] as const))('%s', (_nombre, f) => {
  async function preparar() {
    const db = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
    const { finca, areas } = await crearFincaConAreas(
      db,
      { nombre: f.finca.nombre, municipio: f.finca.municipio, regimen: f.finca.regimen },
      f.areas.map((x) => ({
        tipo: x.tipo,
        nombre: x.nombre,
        area_m2: x.area_m2,
        capacidad_plantas: null,
      })),
    );
    await guardarClima(
      db,
      finca.id,
      areas[0]?.id ?? '',
      { temperaturaC: 24.5, humedadRelativaPct: 70, temperaturaHojaC: null },
      { ahora: () => T0 },
    );
    return db;
  }

  it('crea la carpeta una sola vez y sube el mismo respaldo que se descarga, restaurable', async () => {
    const db = await preparar();
    const d = driveFalso();
    const r = await guardarCopiaEnDrive(db, d.fn, TOKEN, { app: '0.3.0', ahora: () => T0 });
    expect(r.nombre).toMatch(/^cuaderno-finca-ensayo-(uno|dos)-2026-10-05-1030\.json$/);
    await guardarCopiaEnDrive(db, d.fn, TOKEN, { app: '0.3.0', ahora: () => T0 });
    const carpetas = d.archivos.filter((a) => a.name === CARPETA);
    expect(carpetas).toHaveLength(1);
    const copias = await listarCopias(d.fn, TOKEN, carpetas[0]?.id ?? '');
    expect(copias).toHaveLength(2);
    // Lo que quedó en Drive pasa la misma revisión que un archivo descargado.
    const texto = await descargarCopia(d.fn, TOKEN, copias[0]?.id ?? '');
    const otroTelefono = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
    const resumen = await analizarArchivo(otroTelefono, texto);
    expect(resumen.tablas.registro.nuevas).toBe(1);
    expect((await db.meta.get(CLAVE_ULTIMO_DRIVE))?.valor).toBe(T0.toISOString());
  });

  it(`conserva las ${CONSERVAR} copias más recientes y borra las viejas solo después de subir`, async () => {
    const db = await preparar();
    const d = driveFalso();
    for (let i = 0; i < CONSERVAR + 3; i++) {
      await guardarCopiaEnDrive(db, d.fn, TOKEN, { app: '0.3.0', ahora: () => T0 });
    }
    const carpeta = await carpetaDeRespaldos(d.fn, TOKEN);
    const copias = await listarCopias(d.fn, TOKEN, carpeta);
    expect(copias).toHaveLength(CONSERVAR);
    // Las que quedan son las últimas: la primera subida (a1) ya no está.
    expect(copias.map((c) => c.id)).not.toContain('a2');
  });
});

describe('errores de Drive, dichos para la persona', () => {
  const db = () => abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });

  it('Drive lleno, permiso vencido y sin señal', async () => {
    const lleno = driveFalso({ lleno: true });
    const base = db();
    await crearFincaConAreas(
      base,
      { nombre: 'Finca Ensayo Uno', municipio: 'Municipio Ensayo', regimen: 'ecologico' },
      [{ tipo: 'nave', nombre: 'Nave 1', area_m2: 500, capacidad_plantas: null }],
    );
    await expect(guardarCopiaEnDrive(base, lleno.fn, TOKEN, { app: '0.3.0' })).rejects.toThrow(
      'Tu Google Drive está lleno',
    );
    await expect(carpetaDeRespaldos(driveFalso().fn, 'otro-token')).rejects.toThrow(
      'El permiso de Google venció',
    );
    const sinSenal = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    const e = await carpetaDeRespaldos(sinSenal, TOKEN).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErrorDeDrive);
    expect((e as Error).message).toContain('No hay señal');
  });
});

describe('permiso de Drive: desafío, vuelta y canje', () => {
  const CORE = 'https://core.ejemplo.test';
  const VUELTA = 'https://agro.ejemplo.test/agro/app/respaldo/';

  it('manda al CORE solo el SHA-256 del verificador, y lo canjea con el verificador guardado', async () => {
    const base = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
    const url = new URL(await urlParaPedirPermiso(base, CORE, VUELTA, 'guardar'));
    expect(url.pathname).toBe('/api/core/drive/inicio');
    expect(url.searchParams.get('vuelta')).toBe(VUELTA);
    const desafio = url.searchParams.get('desafio') ?? '';
    expect(desafio).toMatch(/^[A-Za-z0-9_-]{43}$/);
    let enviado: { sellado?: string; verificador?: string } = {};
    const core = (async (_u: string, init?: RequestInit) => {
      enviado = JSON.parse(String(init?.body));
      return Response.json({ acceso: TOKEN, vence: 0 });
    }) as unknown as typeof fetch;
    const r = await canjearPermiso(base, CORE, 'sello-de-prueba', { fetchFn: core });
    expect(r).toEqual({ acceso: TOKEN, accion: 'guardar' });
    expect(enviado.sellado).toBe('sello-de-prueba');
    // El verificador viaja recién en el canje, y su hash es el desafío que salió antes.
    const hash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(enviado.verificador ?? ''),
    );
    expect(Buffer.from(hash).toString('base64url')).toBe(desafio);
    // Se usa una sola vez.
    await expect(canjearPermiso(base, CORE, 'sello-de-prueba', { fetchFn: core })).rejects.toThrow(
      PermisoInvalido,
    );
  });

  it('un pendiente de hace más de 10 minutos no se canjea', async () => {
    const base = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
    const t = Date.UTC(2026, 9, 5, 12);
    await urlParaPedirPermiso(base, CORE, VUELTA, 'traer', () => t);
    const nunca = (async () => {
      throw new Error('no debía llamar al CORE');
    }) as unknown as typeof fetch;
    await expect(
      canjearPermiso(base, CORE, 's', { fetchFn: nunca, ahora: () => t + 10 * 60_000 + 1 }),
    ).rejects.toThrow('hace mucho');
  });

  it('lee la vuelta de Google y dice el error en palabras', () => {
    expect(leerVuelta('#drive=abc.def')).toEqual({ tipo: 'sello', sello: 'abc.def' });
    expect(leerVuelta('#drive-error=cancelada')).toEqual({ tipo: 'error', motivo: 'cancelada' });
    expect(leerVuelta('#t=24&hr=70')).toBeNull();
    expect(textoDelError('cancelada')).toContain('Cancelaste el permiso');
    expect(textoDelError('google')).toContain('Google no dio el permiso');
  });
});
