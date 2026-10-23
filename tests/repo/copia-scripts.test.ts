/**
 * Los dos scripts del dueño para la copia fuera de Cloudflare (HU-C11.4): el simulacro de restaurar
 * (CA2) con copias hechas por el mismo formato que usa el CORE, y el permiso de Drive con Google y
 * GitHub de mentira, como el de Gmail. Cada caso malo es su control negativo (P5).
 */
import { describe, expect, it } from 'vitest';
import { cifrarCopia, importarLlave } from '../../apps/core/src/copia-formato.ts';
import { ALCANCE_DE_DRIVE, darPermisoDeDrive } from '../../scripts/copia/permiso-de-drive.ts';
import { simular } from '../../scripts/copia/simulacro.ts';
import type { Mundo } from '../../scripts/correo/permiso-de-gmail.ts';

const LLAVE = Buffer.alloc(32, 7).toString('base64');
const VOLCADO = [
  'PRAGMA defer_foreign_keys=TRUE;',
  'CREATE TABLE usuario (id TEXT PRIMARY KEY, nombre TEXT);',
  `INSERT INTO "usuario" VALUES('u-1','Ana');`,
  `INSERT INTO "usuario" VALUES('u-2','Beto');`,
  'CREATE TABLE sesion (id TEXT PRIMARY KEY);',
  `INSERT INTO "sesion" VALUES('s-1');`,
  '',
].join('\n');

const copia = async (volcado = VOLCADO, base = 'agro_core', semana = '2026-10-26') => {
  const { archivo } = await cifrarCopia(await importarLlave(LLAVE), {
    base,
    semana,
    volcado: new TextEncoder().encode(volcado),
  });
  return { nombre: `${semana}_${base}.sql.ed1`, bytes: archivo };
};

describe('el simulacro de restaurar (HU-C11.4 CA2)', () => {
  it('restaura en una base vacía y las filas de cada tabla cuadran con lo que dice la copia', async () => {
    const [r] = await simular([await copia()], LLAVE);
    expect(r).toEqual({
      archivo: '2026-10-26_agro_core.sql.ed1',
      ok: true,
      detalle: '3 filas en 2 tablas, todas cuadran',
    });
  });

  it('❌ una copia que no se descifra con la llave sale en rojo con su causa', async () => {
    const otra = Buffer.alloc(32, 9).toString('base64');
    const [r] = await simular([await copia()], otra);
    expect(r?.ok).toBe(false);
    expect(r?.detalle).toContain('no se pudo descifrar');
  });

  it('❌ un archivo renombrado a otra base no pasa por esa base', async () => {
    const c = await copia();
    const [r] = await simular([{ ...c, nombre: '2026-10-26_agro_c0_s1.sql.ed1' }], LLAVE);
    expect(r?.ok).toBe(false);
  });

  it('❌ un volcado que no restaura todas sus filas no cuadra', async () => {
    // La segunda fila choca con la primera: SQLite la rechaza y la base queda con una.
    const malo = VOLCADO.replace("VALUES('u-2','Beto')", "VALUES('u-1','Beto')");
    const [r] = await simular([await copia(malo)], LLAVE);
    expect(r?.ok).toBe(false);
  });
});

function mundo(o: { listado?: string; scope?: string; refresh?: boolean } = {}) {
  const guardados: Record<string, string> = {};
  const dicho: string[] = [];
  let autorizar: URL | null = null;
  const respuestas = ['1234-abc.apps.googleusercontent.com', 'GOCSPX-secreto-de-prueba'];
  const m: Mundo = {
    gh(argumentos, entrada) {
      if (argumentos[1] === 'list') return { ok: true, salida: o.listado ?? '[]' };
      guardados[argumentos[2] ?? ''] = entrada ?? '';
      return { ok: true, salida: '' };
    },
    preguntar: async () => respuestas.shift() ?? '',
    abrir(url) {
      autorizar = new URL(url);
      const vuelta = new URL(autorizar.searchParams.get('redirect_uri') ?? '');
      vuelta.searchParams.set('state', autorizar.searchParams.get('state') ?? '');
      vuelta.searchParams.set('code', 'codigo-1');
      void fetch(vuelta).then((r) => r.text());
    },
    decir: (t) => dicho.push(t),
    async fetch(_url, init) {
      const cuerpo = new URLSearchParams(String(init?.body ?? ''));
      if (cuerpo.get('grant_type') === 'refresh_token') return Response.json({ access_token: 'a' });
      return Response.json({
        ...(o.refresh === false ? {} : { refresh_token: '1//refresh' }),
        scope: o.scope ?? ALCANCE_DE_DRIVE,
      });
    },
  };
  return { m, guardados, dicho, autorizar: () => autorizar };
}

describe('el permiso del Drive del dueño (HU-C11.4 CA1b, WI-C11.4.3)', () => {
  it('pide solo drive.file, guarda el permiso y crea la llave la primera vez', async () => {
    const w = mundo();
    const r = await darPermisoDeDrive('staging', w.m, { azar: (n) => Buffer.alloc(n, 3) });
    expect(r).toEqual({ ok: true, llave: Buffer.alloc(32, 3).toString('base64') });
    expect(w.autorizar()?.searchParams.get('scope')).toBe(ALCANCE_DE_DRIVE);
    expect(Object.keys(w.guardados)).toEqual([
      'COPIA_DRIVE_CLIENTE_ID',
      'COPIA_DRIVE_CLIENTE_SECRETO',
      'COPIA_DRIVE_REFRESH',
      'COPIA_LLAVE',
    ]);
    expect(w.dicho.join('\n')).not.toContain('1//refresh');
  });

  it('❌ si el ambiente ya tiene llave, no la cambia sin --llave-nueva: las copias de antes la necesitan', async () => {
    const w = mundo({ listado: '[{"name":"COPIA_LLAVE"}]' });
    const r = await darPermisoDeDrive('staging', w.m);
    expect(r).toEqual({ ok: true });
    expect(w.guardados['COPIA_LLAVE']).toBeUndefined();
    const nueva = mundo({ listado: '[{"name":"COPIA_LLAVE"}]' });
    expect((await darPermisoDeDrive('staging', nueva.m, { llaveNueva: true })).llave).toBeTruthy();
  });

  it('❌ un permiso sin Drive, o sin refresh, no guarda nada', async () => {
    for (const o of [{ scope: 'openid' }, { refresh: false }]) {
      const w = mundo(o);
      expect((await darPermisoDeDrive('staging', w.m)).ok).toBe(false);
      expect(w.guardados).toEqual({});
    }
  });
});
