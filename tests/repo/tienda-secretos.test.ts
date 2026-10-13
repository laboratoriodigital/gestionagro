/**
 * HU-T2.5: los secretos de la Tienda se generan una vez por ambiente, la llave maestra nunca sale
 * a la pantalla ni se guarda sin su copia fuera de línea, y lo que ya existe no se reemplaza. Sin
 * GitHub ni teclado: el mundo del script es de mentira. Cada caso malo es su control negativo (P5).
 */
import { describe, expect, it } from 'vitest';
import {
  comandoDelPortapapeles,
  generar,
  type Mundo,
  nuevoSecreto,
  secretosQueFaltan,
} from '../../scripts/tienda/generar-secretos.ts';

interface Registro {
  guardados: Record<string, string>;
  dicho: string[];
  portapapeles: string[];
}

function mundo(opciones: {
  existentes?: string[];
  respuesta?: string;
  ghLee?: boolean;
  ghGuarda?: boolean;
  copia?: boolean;
}): { m: Mundo; r: Registro } {
  const r: Registro = { guardados: {}, dicho: [], portapapeles: [] };
  let n = 0;
  const m: Mundo = {
    gh(argumentos, entrada) {
      if (argumentos[1] === 'list') {
        return opciones.ghLee === false
          ? { ok: false, salida: 'HTTP 404' }
          : {
              ok: true,
              salida: JSON.stringify((opciones.existentes ?? []).map((name) => ({ name }))),
            };
      }
      if (opciones.ghGuarda === false) return { ok: false, salida: 'HTTP 403: sin permiso' };
      r.guardados[argumentos[2] as string] = entrada ?? '';
      return { ok: true, salida: '' };
    },
    copiar(texto) {
      r.portapapeles.push(texto);
      return opciones.copia !== false;
    },
    preguntar: async (p) => {
      r.dicho.push(p);
      return opciones.respuesta ?? 'sí';
    },
    decir: (t) => r.dicho.push(t),
    aleatorio: (k) => Uint8Array.from({ length: k }, () => (n++ * 37) % 256),
  };
  return { m, r };
}

describe('las piezas', () => {
  it('un secreto son 32 bytes en base64', () => {
    const s = nuevoSecreto((k) => new Uint8Array(k).fill(1));
    expect(atob(s)).toHaveLength(32);
    expect(() => nuevoSecreto(() => new Uint8Array(16))).toThrow(/32 bytes/);
  });

  it('solo se crea lo que falta', () => {
    expect(secretosQueFaltan([])).toEqual(['SECRETO_DESPACHO', 'TIENDA_KEK_V1']);
    expect(secretosQueFaltan(['TIENDA_KEK_V1'])).toEqual(['SECRETO_DESPACHO']);
  });

  it('el portapapeles de Windows primero (P3)', () => {
    expect(comandoDelPortapapeles('win32')).toEqual(['clip', []]);
    expect(comandoDelPortapapeles('aix')).toBeNull();
  });
});

describe('generar (HU-T2.5)', () => {
  it('guarda los dos por stdin y la KEK nunca se dice: va al portapapeles y se borra', async () => {
    const { m, r } = mundo({});
    const resultado = await generar('staging', m);
    expect(resultado).toEqual({
      ok: true,
      creados: ['SECRETO_DESPACHO', 'TIENDA_KEK_V1'],
      existian: [],
    });
    const kek = r.guardados['TIENDA_KEK_V1'] as string;
    expect(atob(kek)).toHaveLength(32);
    expect(r.guardados['SECRETO_DESPACHO']).not.toBe(kek);
    expect(r.dicho.join('\n')).not.toContain(kek);
    expect(r.portapapeles).toEqual([kek, '']);
  });

  it('❌ lo que ya existe no se reemplaza: una KEK nueva dejaría ilegible lo cifrado', async () => {
    const { m, r } = mundo({ existentes: ['TIENDA_KEK_V1', 'SECRETO_DESPACHO'] });
    expect(await generar('produccion', m)).toEqual({
      ok: true,
      creados: [],
      existian: ['SECRETO_DESPACHO', 'TIENDA_KEK_V1'],
    });
    expect(r.guardados).toEqual({});
    expect(r.portapapeles).toEqual([]);
  });

  it('❌ sin la copia fuera de línea la KEK no se guarda, y el portapapeles queda vacío', async () => {
    const { m, r } = mundo({ respuesta: 'no' });
    const resultado = await generar('staging', m);
    expect(resultado.ok).toBe(false);
    expect(resultado.creados).toEqual(['SECRETO_DESPACHO']);
    expect(r.guardados['TIENDA_KEK_V1']).toBeUndefined();
    expect(r.portapapeles.at(-1)).toBe('');
  });

  it('❌ si gh no puede leer el ambiente, no genera nada (CA3)', async () => {
    const { m, r } = mundo({ ghLee: false });
    const resultado = await generar('staging', m);
    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).toMatch(/No se generó nada/);
    expect([r.guardados, r.portapapeles]).toEqual([{}, []]);
  });

  it('❌ si gh no puede guardar, lo dice y no sigue con la KEK', async () => {
    const { m, r } = mundo({ ghGuarda: false });
    const resultado = await generar('staging', m);
    expect(resultado).toMatchObject({ ok: false, creados: [] });
    expect(resultado.motivo).toMatch(/SECRETO_DESPACHO.*sin permiso/);
    expect(r.portapapeles).toEqual([]);
  });

  it('❌ sin portapapeles la KEK no se muestra ni se guarda', async () => {
    const { m, r } = mundo({ existentes: ['SECRETO_DESPACHO'], copia: false });
    const resultado = await generar('staging', m);
    expect(resultado.ok).toBe(false);
    expect(r.guardados).toEqual({});
    expect(r.dicho).toEqual([]);
  });
});
